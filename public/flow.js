// Order between tasks and steps: "do this after that" (5.51).
// The order lives on the task or step itself, as `after: [ref, …]`, where a ref
// is "b:<task>" or "sub:<task>:<step>", the same ids the Board uses for its
// cards. The Engine, the Board and Lanes all read it from there, so drawing a
// line on the Board and picking "After…" in the Engine are the same change.
// It is soft: a task that waits is shown as waiting, never locked.

const MAX_AFTER = 12;
const copy = (value) => structuredClone(value);

export const DDflowTaskRef = (blockId) => "b:" + blockId;
export const DDflowStepRef = (blockId, stepId) => `sub:${blockId}:${stepId}`;

export function DDflowParse(ref) {
  const match = /^(?:b:([^:]+)|sub:([^:]+):(.+))$/.exec(String(ref || ""));
  if (!match) return null;
  return match[1] ? { blockId: match[1], stepId: null } : { blockId: match[2], stepId: match[3] };
}

// Every task and step of the day by ref, with what it waits for and where it
// sits in its task (the chain of its parents), so a step is never ordered
// after its own parent or child.
export function DDflowItems(day) {
  const items = new Map();
  for (const block of day?.blocks || []) {
    const taskRef = DDflowTaskRef(block.id);
    items.set(taskRef, { ref: taskRef, block, step: null, name: block.name || "", done: !!block.done, after: list(block.after), parents: [] });
    const walk = (steps, parents) => {
      for (const step of steps || []) {
        const ref = DDflowStepRef(block.id, step.id);
        items.set(ref, { ref, block, step, name: step.text || "", done: !!step.done, after: list(step.after), parents });
        walk(step.children, [...parents, ref]);
      }
    };
    walk(block.subtasks, [taskRef]);
  }
  return items;
}
// What the planner keeps when it loads a task or step: a clean list, or nothing.
export const DDflowKeep = (value) => {
  const kept = [...new Set(list(value))];
  return kept.length ? kept : undefined;
};
const list = (value) => (Array.isArray(value) ? value.filter((ref) => typeof ref === "string" && DDflowParse(ref)).slice(0, MAX_AFTER) : []);

// What a task or step still waits for: the refs it is after that exist today
// and are not done yet. A task also waits for whatever its steps wait for in
// other tasks, so "Colour pass" after "Sketch › Lines" makes the whole task wait.
export function DDflowWaitingOn(items, ref) {
  const item = items.get(ref);
  if (!item) return [];
  const own = item.after.map((r) => items.get(r)).filter((other) => other && !other.done);
  if (item.step) return own;
  const seen = new Set(own.map((o) => o.ref));
  for (const other of items.values()) {
    if (other.block !== item.block || !other.step || other.done) continue;
    for (const r of other.after) {
      const target = items.get(r);
      if (target && !target.done && target.block !== item.block && !seen.has(r)) seen.add(r), own.push(target);
    }
  }
  return own;
}

// Can `ref` be put after `before`? Not itself, not its own parent or child, not
// one already there, and never a loop (A after B after A).
export function DDflowCanAdd(items, ref, before) {
  const item = items.get(ref), target = items.get(before);
  if (!item || !target || ref === before) return false;
  if (item.parents.includes(before) || target.parents.includes(ref)) return false;
  if (item.after.includes(before) || item.after.length >= MAX_AFTER) return false;
  return !reaches(items, before, ref);
}
// Does `from` (through what it is after, and through its parents) lead to `to`?
function reaches(items, from, to) {
  const stack = [from], seen = new Set();
  while (stack.length) {
    const ref = stack.pop();
    if (ref === to) return true;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const item = items.get(ref);
    if (!item) continue;
    stack.push(...item.after, ...item.parents);
  }
  return false;
}

// Writes the list onto the task or step itself; an empty list leaves no trace.
export function DDflowSetAfter(day, ref, refs) {
  const at = DDflowParse(ref);
  if (!at) return day;
  const next = copy(day), block = next.blocks?.find((b) => b.id === at.blockId);
  if (!block) return day;
  const find = (steps) => {
    for (const step of steps || []) {
      if (step.id === at.stepId) return step;
      const found = find(step.children);
      if (found) return found;
    }
    return null;
  };
  const owner = at.stepId ? find(block.subtasks) : block;
  if (!owner) return day;
  const clean = [...new Set(list(refs))];
  if (clean.length) owner.after = clean;
  else delete owner.after;
  return next;
}
export function DDflowAdd(day, ref, before) {
  const items = DDflowItems(day);
  if (!DDflowCanAdd(items, ref, before)) return day;
  return DDflowSetAfter(day, ref, [...items.get(ref).after, before]);
}
export function DDflowRemove(day, ref, before) {
  const item = DDflowItems(day).get(ref);
  if (!item || !item.after.includes(before)) return day;
  return DDflowSetAfter(day, ref, item.after.filter((r) => r !== before));
}

// Drops refs to tasks and steps that are no longer on this day (deleted, moved
// to another day or to Park). Returns the same day when nothing changed.
export function DDflowClean(day) {
  const items = DDflowItems(day);
  let changed = false;
  const tidy = (owner) => {
    if (!Array.isArray(owner.after)) {
      if ("after" in owner) delete owner.after, (changed = true);
      return;
    }
    const kept = owner.after.filter((r) => items.has(r));
    if (kept.length !== owner.after.length) changed = true;
    if (kept.length) owner.after = kept;
    else delete owner.after;
  };
  const next = copy(day);
  for (const block of next.blocks || []) {
    tidy(block);
    const walk = (steps) => (steps || []).forEach((step) => (tidy(step), walk(step.children)));
    walk(block.subtasks);
  }
  return changed ? next : day;
}

// One line per "after": from what comes first to what follows. The Board draws
// these as its order lines.
export function DDflowEdges(day) {
  const items = DDflowItems(day), edges = [];
  for (const item of items.values())
    for (const before of item.after) if (items.has(before)) edges.push({ from: before, to: item.ref });
  return edges;
}

// Today's open tasks in waves: the first wave can all go side by side now, each
// later wave waits for something in an earlier one. Done tasks are left out.
// Without any order between tasks there is one wave, and the Engine shows a
// plain list.
export function DDflowWaves(day, blocks = day?.blocks || []) {
  const items = DDflowItems(day), depth = new Map();
  const open = blocks.filter((b) => !b.done);
  const openIds = new Set(open.map((b) => b.id));
  const level = (blockId, trail = new Set()) => {
    if (depth.has(blockId)) return depth.get(blockId);
    if (trail.has(blockId)) return 0;
    trail.add(blockId);
    const waits = DDflowWaitingOn(items, DDflowTaskRef(blockId))
      .map((other) => other.block.id)
      .filter((id) => id !== blockId && openIds.has(id));
    const value = waits.length ? 1 + Math.max(...waits.map((id) => level(id, trail))) : 0;
    trail.delete(blockId);
    depth.set(blockId, value);
    return value;
  };
  const waves = [];
  for (const block of open) (waves[level(block.id)] ||= []).push(block);
  return waves.filter(Boolean);
}
