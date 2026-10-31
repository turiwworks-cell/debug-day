import { DDlifeItems } from "./life-board.js";
// Membership is stored in blocks/subtasks, never in a second Board-only tree.
const copy = (value) => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function DDreconcileSnapshot(value, before) {
  if (!value?.days || !value?.setup || !before?.days) return value;
  const lanesChanged = !same(value.setup.lanes, before.setup?.lanes);
  let days;
  for (const [date, day] of Object.entries(value.days)) {
    if (day === before.days[date] && !lanesChanged) continue;
    const fixed = DDreconcileDay(
      day,
      before.days[date],
      value.setup,
      before.setup,
    );
    if (!same(fixed, day)) {
      days ||= { ...value.days };
      days[date] = fixed;
    }
  }
  return days ? { ...value, days } : value;
}
export function DDtaskRefs(block) {
  const refs = ["b:" + block.id, "sec:" + block.id];
  const walk = (items) => {
    for (const s of items || []) {
      refs.push("sub:" + block.id + ":" + s.id);
      walk(s.children);
    }
  };
  walk(block.subtasks);
  return refs;
}
export function DDrelation(from, to, laneIds = []) {
  const lane = (ref) =>
    ref === "lane:parked"
      ? ""
      : ref.startsWith("lane:") && laneIds.includes(ref.slice(5))
        ? ref.slice(5)
        : null;
  const task = (ref) => /^b:(.+)$/.exec(ref)?.[1];
  for (const [a, b] of [
    [from, to],
    [to, from],
  ]) {
    if (lane(a) !== null && task(b))
      return { kind: "lane", blockId: task(b), lane: lane(a) };
    if (task(a) && b.startsWith("bug:"))
      return { kind: "feeling", blockId: task(a), bugId: b.slice(4) };
    if (task(a) && b.startsWith("sticky:"))
      return { kind: "note", blockId: task(a), noteId: b.slice(7) };
  }
  if (/^(?:b:|sub:)/.test(from) && /^sub:[^:]+:.+$/.test(to))
    return { kind: "step", parent: from, child: to };
  return null;
}
export function DDcanonicalEdges(day, laneIds = []) {
  const edges = [];
  const add = (from, to) =>
    edges.push({ id: "auto:" + from + "->" + to, from, to });
  for (const lane of laneIds) add("day:root", "lane:" + lane);
  if ((day.blocks || []).some((b) => !laneIds.includes(b.lane)))
    add("day:root", "lane:parked");
  for (const block of day.blocks || []) {
    add(
      "lane:" + (laneIds.includes(block.lane) ? block.lane : "parked"),
      "b:" + block.id,
    );
    const walk = (items, parent) => {
      for (const s of items || []) {
        const ref = "sub:" + block.id + ":" + s.id;
        add(parent, ref);
        walk(s.children, ref);
      }
    };
    walk(block.subtasks, "b:" + block.id);
    for (const bug of day.bugs || [])
      if (bug.blockId === block.id) add("b:" + block.id, "bug:" + bug.id);
  }
  return edges;
}
// Drop stale positions only when membership changed, keeping explicitly moved
// positions in the current edit. A Plan/MCP edit clears both old layouts.
export function DDreconcileDay(
  value,
  before,
  setup = {},
  previousSetup = setup,
) {
  if (!value) return value;
  const day = copy(value),
    board = day.canvas?.board4,
    oldBoard = before?.canvas?.board4;
  if (!board || typeof board !== "object" || Array.isArray(board)) return day;
  for (const field of ["layouts", "overrides", "styles", "groups"])
    if (
      board[field] &&
      (typeof board[field] !== "object" || Array.isArray(board[field]))
    )
      delete board[field];
  if (board.links && !Array.isArray(board.links)) delete board.links;
  for (const [mode, positions] of Object.entries(board.layouts || {}))
    if (!positions || typeof positions !== "object" || Array.isArray(positions))
      delete board.layouts[mode];
  const lanes = (setup.lanes || []).map((l) => l.id),
    blocks = new Map((day.blocks || []).map((b) => [b.id, b]));
  const previousLanes = (previousSetup?.lanes || []).map((l) => l.id);
  const valid = new Set([
    "day:root",
    "lane:parked",
    "section:feelings",
    "section:habits",
    "section:notes",
    "section:life",
    // Where the Engine was moved to on the board (an offset, not a node).
    "section:engine",
    ...DDlifeItems(setup).map((i) => "life:" + i.id),
    ...lanes.map((id) => "lane:" + id),
  ]);
  for (const b of blocks.values())
    for (const ref of DDtaskRefs(b)) valid.add(ref);
  for (const n of day.notes || []) valid.add("sticky:" + n.id);
  for (const b of day.bugs || []) valid.add("bug:" + b.id);
  for (const h of setup.habits || []) valid.add("habit:" + h.id);
  for (const old of before?.blocks || []) {
    const now = blocks.get(old.id);
    if (
      !now ||
      (lanes.includes(now.lane) ? now.lane : "") ===
        (previousLanes.includes(old.lane) ? old.lane : "")
    )
      continue;
    delete now.bx;
    delete now.by;
    const oldEdge =
      "auto:lane:" +
      (previousLanes.includes(old.lane) ? old.lane : "parked") +
      "->b:" +
      old.id;
    const nextEdge =
      "auto:lane:" +
      (lanes.includes(now.lane) ? now.lane : "parked") +
      "->b:" +
      now.id;
    if (board.overrides?.[oldEdge] && oldEdge !== nextEdge) {
      board.overrides[nextEdge] = {
        ...board.overrides[oldEdge],
        ...(board.overrides[nextEdge] || {}),
      };
      delete board.overrides[oldEdge];
    }
    if (day.canvas.positions) delete day.canvas.positions[old.id];
    const refs = new Set(DDtaskRefs(now));
    for (const b of day.bugs || [])
      if (b.blockId === now.id) refs.add("bug:" + b.id);
    for (const l of board.links || []) {
      const r = DDrelation(l.from, l.to, lanes);
      if (r?.kind === "note" && r.blockId === now.id)
        refs.add("sticky:" + r.noteId);
    }
    for (const [mode, positions] of Object.entries(board.layouts || {}))
      for (const ref of refs)
        if (same(positions[ref], oldBoard?.layouts?.[mode]?.[ref]))
          delete positions[ref];
  }
  // A lane/task or task/step line is derived from the actual relationship.
  // Old decorative copies must not contradict it after moving the task in Plan.
  const canonical = DDcanonicalEdges(day, lanes),
    ids = new Set(canonical.map((e) => e.id));
  const notes = new Set();
  const filteredLinks = (board.links || []).filter((link) => {
    if (!valid.has(link.from) || !valid.has(link.to) || link.from === link.to)
      return false;
    const r = DDrelation(link.from, link.to, lanes);
    if (
      ["lane", "step"].includes(r?.kind) ||
      (r?.kind === "feeling" &&
        (day.bugs || []).find((b) => b.id === r.bugId)?.blockId === r.blockId)
    ) {
      const child =
        r.kind === "lane"
          ? "b:" + r.blockId
          : r.kind === "step"
            ? r.child
            : "bug:" + r.bugId;
      const edge = canonical.find((e) => e.to === child);
      if (edge) {
        board.overrides ||= {};
        const { id, from, to, ...appearance } = link;
        board.overrides[edge.id] = {
          ...appearance,
          ...(board.overrides[edge.id] || {}),
        };
      }
      return false;
    }
    if (r?.kind === "note") {
      if (notes.has(r.noteId)) return false;
      notes.add(r.noteId);
    }
    return true;
  });
  if (Array.isArray(board.links)) board.links = filteredLinks;
  const manualIds = new Set(filteredLinks.map((e) => e.id));
  if (Array.isArray(board.hidden))
    board.hidden = board.hidden.filter((id) => !id.startsWith("auto:"));
  for (const [id, patch] of Object.entries(board.overrides || {})) {
    if (
      (!ids.has(id) && !manualIds.has(id)) ||
      !patch ||
      typeof patch !== "object"
    ) {
      delete board.overrides[id];
      continue;
    }
    for (const k of ["from", "to"]) delete patch[k];
  }
  for (const positions of Object.values(board.layouts || {}))
    for (const ref of Object.keys(positions))
      if (!valid.has(ref)) delete positions[ref];
  for (const field of ["styles"])
    if (board[field])
      for (const ref of Object.keys(board[field]))
        if (!valid.has(ref)) delete board[field][ref];
  for (const field of ["locked", "stack"])
    if (Array.isArray(board[field]))
      board[field] = board[field].filter((ref) => valid.has(ref));
  for (const [id, refs] of Object.entries(board.groups || {})) {
    if (!Array.isArray(refs)) {
      delete board.groups[id];
      continue;
    }
    board.groups[id] = refs.filter((ref) => valid.has(ref));
    if (board.groups[id].length < 2) delete board.groups[id];
  }
  for (const bug of day.bugs || [])
    if (bug.blockId && !blocks.has(bug.blockId)) bug.blockId = "";
  return day;
}
export function DDmoveTask(day, blockId, lane, setup) {
  if (lane && !setup.lanes?.some((l) => l.id === lane)) return day;
  const block = day.blocks?.find((b) => b.id === blockId);
  if (
    !block ||
    (block.lane || "") === lane ||
    day.canvas?.board4?.locked?.includes("b:" + blockId)
  )
    return day;
  const next = copy(day);
  next.blocks.find((b) => b.id === blockId).lane = lane;
  return DDreconcileDay(next, day, setup);
}
export function DDconnectRelation(day, from, to, setup) {
  const r = DDrelation(
    from,
    to,
    (setup.lanes || []).map((l) => l.id),
  );
  if (!r) return null;
  if (day.canvas?.board4?.locked?.some?.((ref) => ref === from || ref === to))
    return day;
  if (r.kind === "lane") return DDmoveTask(day, r.blockId, r.lane, setup);
  const next = copy(day);
  if (r.kind === "feeling") {
    const bug = next.bugs?.find((b) => b.id === r.bugId);
    if (!bug || !next.blocks?.some((b) => b.id === r.blockId)) return day;
    bug.blockId = r.blockId;
    bug.on = "";
    for (const positions of Object.values(next.canvas?.board4?.layouts || {}))
      delete positions["bug:" + bug.id];
    return DDreconcileDay(next, day, setup);
  }
  // Notes remain a real stored link (a note has a single task owner).
  if (r.kind === "note") return null;
  const child = /^sub:([^:]+):(.+)$/.exec(r.child),
    parent = /^(b|sub):([^:]+)(?::(.+))?$/.exec(r.parent);
  const source = next.blocks?.find((b) => b.id === child?.[1]),
    target = next.blocks?.find((b) => b.id === parent?.[2]);
  if (!source || !target) return day;
  const find = (items, id) => {
    for (const s of items || []) {
      if (s.id === id) return s;
      const found = find(s.children, id);
      if (found) return found;
    }
  };
  const step = find(source.subtasks, child[2]),
    owner = parent[1] === "sub" ? find(target.subtasks, parent[3]) : target;
  if (
    !step ||
    !owner ||
    step === owner ||
    (parent[1] === "sub" && find(step.children, owner.id))
  )
    return day;
  const currentParent = (items, ref) => {
    for (const s of items || []) {
      if (s.id === step.id) return ref;
      const found = currentParent(s.children, "sub:" + source.id + ":" + s.id);
      if (found) return found;
    }
  };
  if (currentParent(source.subtasks, "b:" + source.id) === r.parent) return day;
  const remove = (items) =>
    (items || [])
      .filter((s) => s.id !== step.id)
      .map((s) => ({ ...s, children: remove(s.children) }));
  // Detach only from the source branch; re-find the destination after removal.
  source.subtasks = remove(source.subtasks);
  const dest = parent[1] === "sub" ? find(target.subtasks, parent[3]) : target;
  if (!dest) return day;
  if (parent[1] === "sub") (dest.children ||= []).push(step);
  else (dest.subtasks ||= []).push(step);
  dest.expanded = true;
  target.expanded = true;
  const remap = new Map(),
    collect = (s) => {
      remap.set(
        "sub:" + source.id + ":" + s.id,
        "sub:" + target.id + ":" + s.id,
      );
      for (const c of s.children || []) collect(c);
    };
  collect(step);
  const board = next.canvas?.board4;
  if (board) {
    const oldEdges = DDcanonicalEdges(
      day,
      (setup.lanes || []).map((l) => l.id),
    );
    const newEdges = DDcanonicalEdges(
      next,
      (setup.lanes || []).map((l) => l.id),
    );
    for (const edge of oldEdges) {
      if (!remap.has(edge.to) || !board.overrides?.[edge.id]) continue;
      const targetEdge = newEdges.find((e) => e.to === remap.get(edge.to));
      if (targetEdge && targetEdge.id !== edge.id) {
        board.overrides[targetEdge.id] = {
          ...board.overrides[edge.id],
          ...(board.overrides[targetEdge.id] || {}),
        };
        delete board.overrides[edge.id];
      }
    }
    board.links = (board.links || []).map((l) => ({
      ...l,
      from: remap.get(l.from) || l.from,
      to: remap.get(l.to) || l.to,
    }));
    for (const ref of remap.keys())
      for (const pos of Object.values(board.layouts || {})) delete pos[ref];
    for (const field of ["styles"])
      for (const [a, b] of remap)
        if (board[field]?.[a] && a !== b) {
          board[field][b] = board[field][a];
          delete board[field][a];
        }
    for (const field of ["locked", "stack"])
      if (board[field])
        board[field] = board[field].map((ref) => remap.get(ref) || ref);
    for (const key of Object.keys(board.groups || {}))
      board.groups[key] = board.groups[key].map((ref) => remap.get(ref) || ref);
  }
  // Completion follows the tree's new contents, including both affected cards.
  const settle = (items) => {
    for (const s of items || []) {
      settle(s.children);
      if (s.children?.length) s.done = s.children.every((c) => c.done);
    }
  };
  for (const b of new Set([source, target])) {
    settle(b.subtasks);
    if (b.subtasks.length) b.done = b.subtasks.every((s) => s.done);
  }
  return DDreconcileDay(next, day, setup);
}
export function DDdisconnectRelation(day, from, to, setup) {
  const relation = DDrelation(
    from,
    to,
    (setup.lanes || []).map((l) => l.id),
  );
  if (
    !relation ||
    day.canvas?.board4?.locked?.some?.((ref) => ref === from || ref === to)
  )
    return day;
  if (relation.kind === "lane")
    return DDmoveTask(day, relation.blockId, "", setup);
  if (relation.kind === "feeling") {
    const next = copy(day),
      bug = next.bugs?.find((b) => b.id === relation.bugId);
    if (!bug) return day;
    bug.blockId = "";
    bug.on = "";
    for (const pos of Object.values(next.canvas?.board4?.layouts || {}))
      delete pos["bug:" + bug.id];
    return DDreconcileDay(next, day, setup);
  }
  // A nested step can leave its immediate parent while remaining in its card.
  if (relation.kind === "step" && from.startsWith("sub:"))
    return DDconnectRelation(day, "b:" + to.split(":")[1], to, setup) || day;
  // Root-to-lane and card-to-root-step links explain the tree and cannot be
  // hidden independently; moving the step to another card is supported.
  return day;
}
export function DDrewireRelation(day, edge, from, to, setup) {
  const lanes = (setup.lanes || []).map((l) => l.id),
    old = DDrelation(edge.from, edge.to, lanes),
    next = DDrelation(from, to, lanes);
  if (!edge.automatic) {
    const result = DDconnectRelation(day, from, to, setup);
    if (result === null || result === day) return result;
    if (Array.isArray(result.canvas?.board4?.links))
      result.canvas.board4.links = result.canvas.board4.links.filter(
        (link) => link.id !== edge.id,
      );
    return DDreconcileDay(result, day, setup);
  }
  if (!old || !next || old.kind !== next.kind) return day;
  const locked = Array.isArray(day.canvas?.board4?.locked)
    ? day.canvas.board4.locked
    : [];
  if ([edge.from, edge.to, from, to].some((ref) => locked.includes(ref)))
    return day;
  if (old.kind === "step" && old.child !== next.child) return day;
  let result = day;
  if (
    (old.kind === "lane" && old.blockId !== next.blockId) ||
    (old.kind === "feeling" && old.bugId !== next.bugId)
  )
    result = DDdisconnectRelation(result, edge.from, edge.to, setup);
  return DDconnectRelation(result, from, to, setup) || day;
}
