// The Engine, redesigned (5.50): today and the park, and nothing else.
//
// The old Engine split the day into lanes (Work, Life…) and showed one line per
// task. This Engine is the day itself: two places — Today (the current day's
// name) and Park (what is set aside) — with each task's steps in sight, which
// steps can run together and which must wait for one another, and a small tag
// that says which Feed section the task came from. It reads and writes
// day.blocks like every other view, so Plan, Lanes, Calendar and the Board show
// the same change at once (CLAUDE.md › 0).
//
// Pure helpers first (nothing here touches the DOM), then the view, then styles.
import { DDcompletion, DDpriorityWeight } from "./planner.js";
import { DDsectionPath, DDsectionTint, DDlifeItems } from "./life-board.js";
import { DDaddDays } from "./dates.js";

// ── Which tasks are today and which are parked ──────────────────────────────
// Parked is a choice the person makes (`block.park`), not a missing lane.
export function DDtaskParked(block) {
  return block?.park === true;
}

// The day split in two, each list in the order the Engine shows it: important
// first, then the order they were added.
export function DDengineToday(day = {}, filter = "all") {
  const blocks = (day.blocks || []).filter((b) => String(b?.name || "").trim() !== ""),
    today = blocks.filter((b) => !DDtaskParked(b)),
    park = blocks.filter(DDtaskParked),
    pick = (list) =>
      filter === "left"
        ? list.filter((b) => !b.done)
        : filter === "done"
          ? list.filter((b) => b.done)
          : [...list.filter((b) => !b.done), ...list.filter((b) => b.done)];
  return {
    filter: DDengineFilters.includes(filter) ? filter : "all",
    today: pick(DDpriorityOrder(today)),
    park: pick(DDpriorityOrder(park)),
    counts: { today: today.length, park: park.length, total: blocks.length },
  };
}

export const DDengineFilters = ["all", "left", "done"];

// Important first (P1, P2, P3, normal), then open before done, then as they are.
export function DDpriorityOrder(list = []) {
  return list
    .map((block, index) => ({ block, index }))
    .sort(
      (a, b) =>
        DDpriorityWeight(b.block) - DDpriorityWeight(a.block) ||
        Number(!!a.block.done) - Number(!!b.block.done) ||
        a.index - b.index,
    )
    .map(({ block }) => block);
}

export function DDparkTask(block) {
  return { ...block, park: true };
}

// Taking a task out of the park puts it back in today, as it was.
export function DDunparkTask(block) {
  const { park, ...rest } = block;
  return rest;
}

// ── Steps, in one flat list per task ────────────────────────────────────────
export function DDtaskSteps(block, depth = 0, out = []) {
  for (const step of block?.subtasks || []) {
    out.push({ id: step.id, text: step.text || "", done: !!step.done, depth, taskId: block.id, after: DDstepAfter(step) });
    DDtaskSteps({ id: block.id, subtasks: step.children }, depth + 1, out);
  }
  return out;
}

// A step may wait for other steps. A dependency is written "taskId:stepId" for
// a step (another task's step too), or just "taskId" for a whole task.
export function DDstepAfter(step) {
  return Array.isArray(step?.after) ? step.after.filter((ref) => typeof ref === "string" && ref) : [];
}

export function DDstepRef(taskId, stepId) {
  return stepId ? taskId + ":" + stepId : taskId;
}

export function DDparseStepRef(ref) {
  const value = String(ref || ""),
    at = value.indexOf(":");
  return at < 0 ? { taskId: value, stepId: "" } : { taskId: value.slice(0, at), stepId: value.slice(at + 1) };
}

// Every step of the day, with the task it belongs to, for the dependency picker.
export function DDengineSteps(day = {}) {
  return (day.blocks || []).flatMap((block) =>
    DDtaskSteps(block).map((step) => ({ ...step, taskName: block.name || "", ref: DDstepRef(block.id, step.id) })),
  );
}

// Is a step's own work finished? A task with no steps counts as its tick.
export function DDstepDone(day, ref) {
  const { taskId, stepId } = DDparseStepRef(ref),
    block = (day.blocks || []).find((b) => b.id === taskId);
  if (!block) return false;
  if (!stepId) return !!block.done;
  const step = DDtaskSteps(block).find((s) => s.id === stepId);
  return !!step?.done;
}

// What a step is still waiting for: its own list, those not done yet.
export function DDstepWaiting(day, step) {
  return DDstepAfter(step).filter((ref) => !DDstepDone(day, ref));
}

// ── Together or one after another ───────────────────────────────────────────
// A task can wait for another whole task (`block.after`, written when a step of
// it waits for a step of that one). Tasks waiting for nothing run together; the
// rest come in the order their waiting allows.
export function DDtaskWaitsFor(block) {
  const own = Array.isArray(block?.after) ? block.after.filter((id) => typeof id === "string" && id) : [],
    fromSteps = DDtaskSteps(block).flatMap(DDstepAfter).map((ref) => DDparseStepRef(ref).taskId);
  return [...new Set([...own, ...fromSteps])].filter((id) => id && id !== block.id);
}

// Waves of tasks: everything in one wave can run at the same time, and each
// wave starts when the one before it is done. A wait that goes round in a circle
// stops (a task is placed once), so nothing can loop forever.
export function DDengineWaves(blocks = []) {
  const known = new Set(blocks.map((b) => b.id)),
    waits = new Map(blocks.map((b) => [b.id, DDtaskWaitsFor(b).filter((id) => known.has(id))])),
    placed = new Map(),
    waves = [];
  let guard = 0;
  while (placed.size < blocks.length && guard++ <= blocks.length + 1) {
    const wave = blocks.filter((b) => !placed.has(b.id) && waits.get(b.id).every((id) => placed.has(id)));
    // A circle of waits: everything left goes in one last wave.
    const batch = wave.length ? wave : blocks.filter((b) => !placed.has(b.id));
    for (const block of batch) placed.set(block.id, waves.length);
    waves.push(batch);
  }
  return waves;
}

// Each task with its wave and what it is still waiting for, for the view.
export function DDenginePlan(day = {}, blocks = []) {
  const waves = DDengineWaves(blocks),
    waveOf = new Map(waves.flatMap((wave, index) => wave.map((b) => [b.id, index])));
  return waves.map((wave, index) => ({
    wave: index,
    parallel: wave.length > 1,
    blocks: wave.map((block) => ({
      block,
      wave: index,
      waiting: DDtaskWaitsFor(block).filter((id) => waveOf.get(id) === index),
    })),
  }));
}

// ── The section tag ─────────────────────────────────────────────────────────
// A task's tag is the Feed section it came from (`block.from`), the same value
// the Board and Plan read. It is set from a small picker in the Engine instead
// of dragging the task onto a section.
export function DDtaskTag(block) {
  return String(block?.from || "");
}

export function DDsetTaskTag(block, from) {
  const next = { ...block };
  if (from) next.from = from;
  else delete next.from;
  return next;
}

// What a tag shows: the section path in the person's own words, with its tint.
export function DDtagLook(setup, from, language, max = 30) {
  const items = DDlifeItems(setup),
    path = from ? DDsectionPath(items, from, max, language === "fa" ? "سکشن" : "Section") : null,
    tint = from ? DDsectionTint(items, from) : null;
  return path && tint ? { from, label: path.short, full: path.full, ...tint } : null;
}

// Where clicking the tag takes you: into that section's own board.
export function DDtagPlace(from) {
  return from ? { view: "board", room: from } : null;
}

// The sections a tag can point at, top down, ready for a picker.
export function DDtagSections(setup, language) {
  const items = DDlifeItems(setup),
    fa = language === "fa",
    out = [],
    seen = new Set(),
    walk = (parent, depth) => {
      for (const item of items.filter((i) => i.type === "section" && (i.parent || "") === parent && !seen.has(i.id)).sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0))) {
        seen.add(item.id);
        const look = DDsectionTint(items, item.id);
        out.push({
          id: item.id,
          name: String(item.text || "").trim() || (fa ? "سکشن" : "Section"),
          path: DDsectionPath(items, item.id, 34, fa ? "سکشن" : "Section").full,
          depth,
          tint: look?.fill || "",
        });
        walk(item.id, depth + 1);
      }
    };
  walk("", 0);
  return out;
}

// ── Notes that stay with you ────────────────────────────────────────────────
// The Engine's own notes live in the Feed, in one section of their own, so a
// note written on the Engine is the same note inside every section's board and
// on every day (they are not copies).
export const DDengineFeedId = "lf-engine";

export function DDengineNote(snapshot, text, date, makeId = () => crypto.randomUUID()) {
  const words = String(text || "").trim();
  if (!words) return snapshot;
  const data = structuredClone(snapshot),
    state = data.setup.life && Array.isArray(data.setup.life.items) ? data.setup.life : { v: 2, items: [], links: [] },
    items = [...state.items];
  if (!items.some((i) => i.id === DDengineFeedId && i.type === "section"))
    items.push({ id: DDengineFeedId, type: "section", text: "Engine", color: "#F5E0CE", x: 0, y: 0, w: 640, h: 304 });
  items.push({
    id: makeId(),
    type: "sticky",
    parent: DDengineFeedId,
    text: words.slice(0, 4000),
    at: date,
    color: "#FFE299",
  });
  data.setup.life = { ...state, items };
  return data;
}

// The Feed notes that belong to the Engine, newest first.
export function DDengineNotes(setup) {
  return DDlifeItems(setup)
    .filter((i) => i.type === "sticky" && i.parent === DDengineFeedId)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

// ── The daily flow, without being asked ─────────────────────────────────────
// Starting a new day used to be the same small chores every morning. These run
// once when the Engine opens a day that has not been opened yet (a day keeps
// `opened` so it happens once), and they only ever move what the person left
// open, never a task they closed on purpose.
export function DDopenedBefore(day) {
  return !!day?.opened;
}

// `steps`: carry open tasks from the last day with tasks, and mark the day as
// opened. Nothing is copied twice: a task already here is left alone.
export function DDdailyFlow(day, days = {}, date = day?.date || "", options = {}) {
  const { carry = true, makeId = () => crypto.randomUUID() } = options,
    next = structuredClone(day);
  if (!next || DDopenedBefore(next)) return day;
  next.opened = date;
  if (carry) {
    const earlier = Object.keys(days)
      .filter((key) => key < date && (days[key]?.blocks || []).length)
      .sort()
      .reverse()[0];
    const there = (earlier && days[earlier]?.blocks) || [],
      names = new Set(next.blocks.map((b) => String(b.name || "").trim().toLowerCase()));
    for (const block of there) {
      const name = String(block.name || "").trim().toLowerCase();
      if (block.done || block.park || !name || names.has(name)) continue;
      next.blocks.push({
        ...structuredClone(block),
        id: makeId(),
        done: false,
        subtasks: (block.subtasks || []).map((step) => ({ ...structuredClone(step), id: makeId(), done: false })),
      });
      names.add(name);
    }
  }
  return next;
}

// "Tomorrow" for the pause sheet, so the Engine can offer it without the Plan.
export function DDtomorrow(date) {
  return DDaddDays(date, 1);
}

// A day's small totals, for the Engine's head line.
export function DDengineTotals(day = {}, setup = {}) {
  const lanes = (setup.lanes || []).map((lane) => lane.id),
    progress = DDcompletion(day, lanes);
  return { ...progress, open: (day.blocks || []).filter((b) => !b.done && !DDtaskParked(b)).length };
}
