// Engine's task/step graph. References use the existing unique step IDs; no
// second task store or connector coordinates are needed in the planner data.
const childrenOf = (step) => Array.isArray(step?.children) ? step.children : [];

export function DDengineMoveTask(task, lanes = []) {
  if (lanes.some((lane) => lane.id === task.lane)) {
    return { ...task, parkedFromLane: task.lane, lane: "" };
  }
  const lane = lanes.find((entry) => entry.id === task.parkedFromLane) || lanes[0];
  if (!lane) return task;
  const { parkedFromLane, ...rest } = task;
  return { ...rest, lane: lane.id };
}

export function DDengineColumns(day = {}, lanes = []) {
  const valid = new Set(lanes.map((lane) => lane.id));
  const rank = (task) => task.pri === 1 ? 3 : task.pri === 2 ? 2 : task.pri === 3 ? 1 : 0;
  const sorted = (items) => items.map((task, index) => ({ task, index }))
    .sort((a, b) => Number(!!a.task.done) - Number(!!b.task.done) || rank(b.task) - rank(a.task) || a.index - b.index)
    .map(({ task }) => task);
  const blocks = day.blocks || [];
  return [
    { id: "today", blocks: sorted(blocks.filter((block) => valid.has(block.lane))) },
    { id: "park", blocks: sorted(blocks.filter((block) => !valid.has(block.lane))) },
  ];
}

export function DDengineStepGraph(day = {}) {
  const steps = new Map();
  for (const task of day.blocks || []) {
    function visit(items, previous = null, depth = 0) {
      let last = previous;
      for (const step of items || []) {
        if (!step?.id || steps.has(step.id)) continue;
        steps.set(step.id, { id: step.id, step, taskId: task.id, taskName: task.name || "", depth, previous: last });
        visit(childrenOf(step), null, depth + 1);
        last = step.id;
      }
    }
    visit(task.subtasks);
  }
  const deps = new Map();
  for (const node of steps.values()) {
    const explicit = Array.isArray(node.step.dependsOn) ? node.step.dependsOn : [];
    const ids = [...new Set([...explicit, ...(node.step.flow === "after" && node.previous ? [node.previous] : [])])]
      .filter((id) => id !== node.id && steps.has(id));
    deps.set(node.id, ids);
  }
  function reachable(from, target, visiting = new Set()) {
    if (from === target) return true;
    if (visiting.has(from)) return false;
    visiting.add(from);
    return (deps.get(from) || []).some((id) => reachable(id, target, visiting));
  }
  const status = (id) => {
    const node = steps.get(id);
    if (!node) return { ready: false, waiting: [], done: false };
    const waiting = (deps.get(id) || []).filter((dep) => !steps.get(dep)?.step.done);
    return { ready: waiting.length === 0, waiting, done: !!node.step.done };
  };
  // A parent checkbox also completes its descendants. External prerequisites
  // must be done before that group can be checked as a whole.
  function canToggle(id) {
    const node = steps.get(id);
    if (!node || node.step.done) return !!node;
    const subtree = new Set();
    function collect(step) {
      subtree.add(step.id);
      childrenOf(step).forEach(collect);
    }
    collect(node.step);
    return [...subtree].every((stepId) =>
      steps.get(stepId)?.step.done || status(stepId).waiting.every((dep) => subtree.has(dep)));
  }
  return { steps, deps, status, reachable, canToggle };
}

// Changing a dependency is an immutable day edit. Cycles, missing steps and
// self-references are rejected; the state boundary remains safe for D1 sync.
export function DDengineSetDependency(day, stepId, prerequisiteId, enabled = true) {
  const graph = DDengineStepGraph(day);
  const node = graph.steps.get(stepId);
  if (!node || (enabled && (!graph.steps.has(prerequisiteId) || prerequisiteId === stepId || graph.reachable(prerequisiteId, stepId)))) return day;
  const current = Array.isArray(node.step.dependsOn) ? node.step.dependsOn : [];
  const next = enabled ? [...new Set([...current, prerequisiteId])] : current.filter((id) => id !== prerequisiteId);
  if (JSON.stringify(next) === JSON.stringify(current)) return day;
  return DDengineEditStep(day, stepId, (step) => ({ ...step, dependsOn: next }));
}

export function DDengineEditStep(day, stepId, edit) {
  let changed = false;
  const visit = (items) => (items || []).map((step) => {
    if (step.id === stepId) { changed = true; return edit(step); }
    const children = visit(childrenOf(step));
    return children.some((child, index) => child !== childrenOf(step)[index]) ? { ...step, children } : step;
  });
  const blocks = (day.blocks || []).map((task) => {
    const subtasks = visit(task.subtasks);
    return subtasks.some((step, index) => step !== (task.subtasks || [])[index]) ? { ...task, subtasks } : task;
  });
  return changed ? { ...day, blocks } : day;
}

export function DDengineSetFlow(day, stepId, flow) {
  if (!["after", "parallel"].includes(flow)) return day;
  const graph = DDengineStepGraph(day), node = graph.steps.get(stepId);
  if (!node) return day;
  if (flow === "after" && node.previous && graph.reachable(node.previous, stepId)) return day;
  return DDengineEditStep(day, stepId, (step) => ({ ...step, flow }));
}

export function DDengineToggleStep(day, taskId, stepId, toggle) {
  const task = (day.blocks || []).find((item) => item.id === taskId);
  const graph = DDengineStepGraph(day);
  if (!task || graph.steps.get(stepId)?.taskId !== taskId || !graph.canToggle(stepId)) return day;
  return { ...day, blocks: day.blocks.map((block) => block.id === taskId ? toggle(block, stepId) : block) };
}
