// The Engine: today's tasks, each tied to one lane, ticked, scored or waited on.
// It is not a copy: it reads and writes day.blocks, the same data Plan, Lanes
// and the Board show, so a change here is the same change everywhere.
import { DDcompletion } from "./planner.js";
import { DDsectionTint, DDshortPath, DDlifePath, DDlifeItems } from "./life-board.js";
import { DDengineMoveTask, DDengineColumns, DDengineStepGraph, DDengineSetDependency, DDengineSetFlow, DDengineToggleStep, DDengineEditStep } from "./engine-intelligence.js";

// Ask the Board to bring the Engine up. The request waits until a Board is
// on screen (Ctrl+Space can ask from Plan or Calendar before the Board opens).
export const DDengineBus = {
  pending: false,
  listeners: new Set(),
  request() {
    this.pending = true;
    for (const listener of [...this.listeners]) listener();
  },
  take() {
    const pending = this.pending;
    this.pending = false;
    return pending;
  },
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};

// Today's tasks grouped by lane, in lane order. Tasks with no known lane are
// "parked" and listed last, so nothing goes missing.
export function DDengineGroups(day, lanes = []) {
  const blocks = day?.blocks || [],
    ids = new Set(lanes.map((lane) => lane.id)),
    groups = lanes.map((lane) => ({
      lane: { id: lane.id, name: lane.name || "" },
      blocks: blocks.filter((block) => block.lane === lane.id),
    })),
    parked = blocks.filter((block) => !ids.has(block.lane));
  if (parked.length) groups.push({ lane: { id: "", name: "", parked: true }, blocks: parked });
  return groups;
}

// A new task for the Engine, with the same defaults as the Board's "+ task".
// `from` is the Life section it came from, if any (see DDengineSourceHistory).
export function DDengineTask(name, lane, setup = {}, id = crypto.randomUUID(), from = "") {
  return {
    id,
    name: String(name || "").trim().slice(0, 300),
    type: setup.types?.[0]?.id || "work",
    lane: lane || "",
    min: Number(setup.preferences?.defaultMinutes) || 60,
    note: "",
    pri: 0,
    emo: "",
    done: false,
    expanded: true,
    subtasks: [],
    ...(from ? { from } : {}),
  };
}

// A note turned into a task: the first line is its name, the other lines its steps.
export function DDengineTaskFromNote(text, lane, setup = {}, makeId = () => crypto.randomUUID(), from = "") {
  const lines = String(text || "").split("\n").map(line=>({done:/^\s*- \[x\]/i.test(line),text:line.replace(/\*\*|~~/g,"").replace(/^\s*(?:- \[[ xX]\]|[-*•]|\d+[.)]|\[[ xX]?\])\s*/,"").trim()})).filter(line=>line.text);
  const task = DDengineTask(lines[0]?.text || "", lane, setup, makeId(), from);
  task.subtasks = lines.slice(1).map(line=>({id:makeId(),text:line.text,done:line.done,expanded:true,children:[]}));
  return task;
}

// Each day starts with a fresh Engine. The latest earlier day that had tasks,
// counted back from `date`; `skip` steps further back, one such day at a time.
export function DDengineEarlierDay(days = {}, date, skip = 0) {
  const earlier = Object.keys(days)
    .filter((key) => key < date && (days[key]?.blocks || []).length)
    .sort()
    .reverse();
  const key = earlier[Math.max(0, Math.min(skip, earlier.length - 1))];
  return key ? { date: key, day: days[key], more: skip < earlier.length - 1 } : null;
}

// A copy of an earlier task for today: new ids, not done, no score yet.
export function DDengineCopyMany(blocks, makeId = () => crypto.randomUUID()) {
  const ids = new Map();
  const steps = (items) => (items || []).map((item) => {
    const id = makeId(); ids.set(item.id, id);
    return { ...item, id, done: false, children: steps(item.children) };
  });
  const copied = blocks.map((block) => {
    const copy = { ...structuredClone(block), id: makeId(), done: false, subtasks: steps(block.subtasks) };
    delete copy.score; delete copy.bx; delete copy.by; delete copy.at;
    if (copy.measure === "count") copy.count = 0;
    return copy;
  });
  const remap = (items) => items.map((step) => ({
    ...step,
    ...(Array.isArray(step.dependsOn) ? { dependsOn: step.dependsOn.map((id) => ids.get(id)).filter(Boolean) } : {}),
    children: remap(step.children || []),
  }));
  return copied.map((copy) => ({ ...copy, subtasks: remap(copy.subtasks) }));
}
export function DDengineCopy(block, makeId = () => crypto.randomUUID()) {
  return DDengineCopyMany([block], makeId)[0];
}

// Is a task with this name already in today's Engine?
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
export function DDengineHas(day, block) {
  return (day?.blocks || []).some((b) => sameName(b.name, block.name));
}

// What is still open to bring into today (5.37), read from the days, nothing
// stored. `open`: the tasks of the latest earlier day with tasks that are not
// done and not already here. `waiting`: waiting tasks left on an older day
// (never arrived, never carried on to a later day), newest first, so a reply
// you are waiting for does not stay behind on the day you started waiting.
export function DDengineCarry(days = {}, day = {}, lookback = 60) {
  const date = day?.date || "",
    named = (b) => String(b?.name || "").trim() !== "",
    earlier = DDengineEarlierDay(days, date),
    open = earlier ? (earlier.day.blocks || []).filter((b) => named(b) && !b.done && !DDengineHas(day, b)) : [],
    taken = new Set(open.map((b) => String(b.name).trim().toLowerCase())),
    dates = Object.keys(days).filter((key) => key < date).sort().reverse().slice(0, lookback),
    waiting = [];
  for (const key of dates)
    for (const block of days[key]?.blocks || []) {
      const name = String(block.name || "").trim().toLowerCase();
      if (block.measure !== "wait" || block.done || !named(block) || taken.has(name) || DDengineHas(day, block)) continue;
      if (dates.some((later) => later > key && DDengineHas(days[later], block))) continue;
      taken.add(name);
      waiting.push(block);
    }
  return { date: earlier?.date || "", open, waiting, count: open.length + waiting.length };
}

// "Not today" on the carry line is remembered for that day on this device only.
const CARRY_KEY = "debug-day:engine-carry-hidden";
export function DDengineCarryHidden(date) {
  try { return localStorage.getItem(CARRY_KEY) === date; } catch { return false; }
}
export function DDhideEngineCarry(date) {
  try { localStorage.setItem(CARRY_KEY, date); } catch {}
}

// The Life sections a task can come from, top down, for the "from" picker.
// Each one carries its whole path and its root's tint, read live from Life.
export function DDengineSources(items = []) {
  const sections = items.filter((i) => i.type === "section"),
    seen = new Set(),
    out = [],
    walk = (parent, depth) =>
      sections
        .filter((s) => (s.parent || "") === parent && !seen.has(s.id))
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .forEach((s) => {
          seen.add(s.id);
          out.push({ id: s.id, name: s.text || "", depth, ...sourceLook(items, s.id) });
          walk(s.id, depth + 1);
        });
  walk("", 0);
  for (const s of sections) if (!seen.has(s.id)) (seen.add(s.id), out.push({ id: s.id, name: s.text || "", depth: 0, ...sourceLook(items, s.id) }));
  return out;
}
function sourceLook(items, id) {
  return { parts: DDlifePath(items, id).filter((i) => i.type === "section").map((i) => i.text || ""), tint: DDsectionTint(items, id) };
}

// Each section's record: per day, the tasks that came from it or from a section
// inside it (so a big section also counts its small ones). Newest day first,
// only days that had such tasks. Nothing is stored: it is read from the days.
export function DDengineSourceHistory(days = {}, items = [], endDate = "", limit = 90) {
  const sections = new Set(items.filter((i) => i.type === "section").map((i) => i.id)),
    parentOf = new Map(items.map((i) => [i.id, i.parent || ""])),
    out = new Map(),
    dates = Object.keys(days)
      .filter((date) => !endDate || date <= endDate)
      .sort()
      .reverse()
      .slice(0, limit);
  for (const date of dates)
    for (const block of days[date]?.blocks || []) {
      if (!sections.has(block.from)) continue;
      let id = block.from,
        hops = 0;
      while (id && hops++ < 60) {
        if (sections.has(id)) {
          if (!out.has(id)) out.set(id, []);
          const list = out.get(id);
          let entry = list.at(-1);
          if (!entry || entry.date !== date) list.push((entry = { date, done: 0, total: 0, tasks: [] }));
          entry.total++;
          if (block.done) entry.done++;
          entry.tasks.push({ id: block.id, name: block.name || "", done: !!block.done, from: block.from });
        }
        id = parentOf.get(id);
      }
    }
  return out;
}

// The last `count` days ending on `endDate`, oldest first, each marked
// none (no task from here), done (all done), some, or open (none done yet).
export function DDengineStrip(entries = [], endDate, count = 14) {
  const byDate = new Map(entries.map((e) => [e.date, e])),
    out = [];
  for (let n = count - 1; n >= 0; n--) {
    const d = new Date(endDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - n);
    const date = d.toISOString().slice(0, 10),
      e = byDate.get(date);
    out.push({ date, done: e?.done || 0, total: e?.total || 0, state: !e ? "none" : e.done === e.total ? "done" : e.done ? "some" : "open" });
  }
  return out;
}

// The earlier Engine, shown inside today's: copy one task, or every open one.
function EarlierEngine({ React: R, days, day, lanes, language, dateFormat, onCopy }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    [skip, setSkip] = R.useState(0),
    earlier = DDengineEarlierDay(days, day.date, skip);
  if (!earlier)
    return h("div", { className: "dd-engine-earlier", "data-empty": true }, t("No earlier day has tasks yet.", "هنوز روز قبلی با کار نداری."));
  const laneName = (id) => lanes.find((lane) => lane.id === id)?.name || t("Parked", "پارک‌شده"),
    open = earlier.day.blocks.filter((b) => !b.done && !DDengineHas(day, b));
  return h(
    "div",
    { className: "dd-engine-earlier", "data-earlier-date": earlier.date },
    h(
      "div",
      { className: "dd-engine-earlier-head" },
      h(
        "button",
        { type: "button", disabled: !earlier.more, "aria-label": t("Earlier day", "روز قبل‌تر"), onClick: () => setSkip(skip + 1) },
        fa ? "›" : "‹",
      ),
      h("strong", null, t("Engine of ", "انجین ") + (dateFormat ? dateFormat(earlier.date) : earlier.date)),
      h(
        "button",
        { type: "button", disabled: !skip, "aria-label": t("Later day", "روز بعدتر"), onClick: () => setSkip(Math.max(0, skip - 1)) },
        fa ? "‹" : "›",
      ),
      h(
        "button",
        {
          type: "button",
          className: "dd-engine-copy-all",
          disabled: !open.length,
          onClick: () => onCopy(open),
        },
        t("Copy all open", "کپی همهٔ کارهای باز") + " (" + open.length + ")",
      ),
    ),
    h(
      "ul",
      null,
      earlier.day.blocks.map((block) => {
        const here = DDengineHas(day, block);
        return h(
          "li",
          { key: block.id, "data-done": !!block.done, "data-earlier-task": block.id },
          h("span", { className: "dd-engine-earlier-name", dir: "auto" }, (block.done ? "✓ " : "") + (block.name || t("Untitled", "بی‌نام"))),
          h("small", null, laneName(block.lane)),
          here
            ? h("span", { className: "dd-engine-here" }, t("Already today", "امروز هست"))
            : h(
                "button",
                {
                  type: "button",
                  className: "dd-engine-copy",
                  "aria-label": t("Copy to today: ", "کپی به امروز: ") + (block.name || ""),
                  onClick: () => onCopy([block]),
                },
                t("+ Today", "+ امروز"),
              ),
        );
      }),
    ),
  );
}

// The soft line at the top of the Engine: what is still open from the last day
// and what you are still waiting for, brought in with one tap. No counts of days
// missed, no red: just an offer, and "Not today" puts it away.
function CarryLine({ React: R, carry, language, dateFormat, onBring, onChoose, onHide }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    num = (n) => Number(n).toLocaleString(fa ? "fa-IR" : "en-US"),
    when = carry.date ? (dateFormat ? dateFormat(carry.date) : carry.date) : "",
    parts = [
      carry.open.length && t(`${carry.open.length} still open from ${when}`, `${num(carry.open.length)} کار باز از ${when}`),
      carry.waiting.length && t(`${carry.waiting.length} still waiting`, `${num(carry.waiting.length)} در انتظار`),
    ].filter(Boolean),
    names = [...carry.open, ...carry.waiting].map((b) => b.name).join(" · ");
  return h(
    "div",
    { className: "dd-engine-carry", role: "group", "aria-label": t("Still open", "هنوز باز"), "data-carry-date": carry.date },
    h("span", { className: "dd-engine-carry-icon", "aria-hidden": true }, "↺"),
    h("div", { className: "dd-engine-carry-text" }, h("b", null, parts.join(" · ")), h("small", { dir: "auto", title: names }, names)),
    h("button", { type: "button", className: "dd-engine-carry-all", onClick: onBring }, carry.count === 1 ? t("Bring it", "بیارش") : t("Bring them", "بیارشون")),
    carry.open.length > 0 && h("button", { type: "button", className: "dd-engine-carry-pick", onClick: onChoose }, t("Choose…", "انتخاب…")),
    h("button", { type: "button", className: "dd-engine-carry-hide", "aria-label": t("Not today", "امروز نه"), title: t("Not today", "امروز نه"), onClick: onHide }, "×"),
  );
}

const KINDS = [
  ["time", "✓", "Tick", "تیکی"],
  ["score", "★", "Score", "نمره‌ای"],
  ["wait", "⏳", "Waiting", "ویتینگ"],
];

function EngineSteps({ React: R, block, graph, items, language, change, toggleStep, depth = 0 }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => fa ? f : en;
  const [editingDependency, setEditingDependency] = R.useState(null);
  return h("ol", { className: "dd-engine-steps", "data-depth": depth }, (items || []).map((step) => {
    const node = graph.steps.get(step.id), state = graph.status(step.id), prereqs = graph.deps.get(step.id) || [],
      candidates = editingDependency !== step.id ? [] : [...graph.steps.values()].filter((other) => other.id !== step.id && !prereqs.includes(other.id) && !graph.reachable(other.id, step.id));
    return h("li", { key: step.id, className: "dd-engine-step", "data-step": step.id, "data-flow": step.flow === "after" ? "after" : "parallel", "data-blocked": !state.ready, "data-done": !!step.done },
      h("div", { className: "dd-engine-step-line" },
        h("button", { type: "button", className: "dd-step-check", disabled: !graph.canToggle(step.id),
          "aria-pressed": !!step.done, "aria-label": t("Toggle step: ", "تغییر وضعیت قدم: ") + step.text,
          onClick: () => change((day) => DDengineToggleStep(day, block.id, step.id, toggleStep)) }, step.done ? "✓" : ""),
        h("input", { className: "dd-step-text", dir: "auto", defaultValue: step.text, key: step.id + ":" + step.text,
          "aria-label": t("Step", "قدم"), maxLength: 300,
          onBlur: (event) => { const text = event.target.value.trim(); if (text && text !== step.text) change((day) => DDengineEditStep(day, step.id, (s) => ({ ...s, text }))); },
          onKeyDown: (event) => { event.stopPropagation(); if (event.key === "Enter") event.currentTarget.blur(); } }),
        node?.previous && h("button", { type: "button", className: "dd-step-flow", "aria-pressed": step.flow === "after",
          title: step.flow === "after" ? t("Runs after the previous step", "پس از قدم قبلی") : t("Can run in parallel", "قابل انجام موازی"),
          onClick: () => change((day) => DDengineSetFlow(day, step.id, step.flow === "after" ? "parallel" : "after")) }, step.flow === "after" ? "↳" : "∥"),
        !state.ready && h("small", { className: "dd-step-blocked" }, t("Waiting", "در انتظار"))),
      h("div", { className: "dd-engine-step-deps" },
        prereqs.map((id) => { const dep = graph.steps.get(id); return h("button", { type: "button", key: id,
          title: t("Remove dependency", "حذف وابستگی"), className: "dd-step-dep", onClick: () => change((day) =>
            step.flow === "after" && node?.previous === id ? DDengineSetFlow(day, step.id, "parallel") : DDengineSetDependency(day, step.id, id, false)) },
          "← " + (dep?.taskId !== block.id ? (dep?.taskName || "") + " › " : "") + (dep?.step.text || id) + " ×"); }),
        h("button", { type: "button", className: "dd-step-dep-edit", "aria-expanded": editingDependency === step.id,
          onClick: () => setEditingDependency(editingDependency === step.id ? null : step.id) }, t("Prerequisites", "پیش‌نیازها")),
        editingDependency === step.id && h("select", { value: "", className: "dd-step-dependency", "aria-label": t("Add prerequisite to ", "افزودن پیش‌نیاز برای ") + step.text,
          onChange: (event) => { const id = event.target.value; if (id) { change((day) => DDengineSetDependency(day, step.id, id)); setEditingDependency(null); } } },
          h("option", { value: "" }, candidates.length ? t("+ Depends on…", "+ وابسته به…") : t("No available steps", "قدمی برای انتخاب نیست")),
          candidates.map((n) => h("option", { key: n.id, value: n.id }, n.taskName + " › " + n.step.text)))),
      (step.children || []).length > 0 && h(EngineSteps, { React: R, block, graph, items: step.children, language, change, toggleStep, depth: depth + 1 }));
  }));
}

function EngineRow({ React: R, block, lanes, sources = [], language, measure, setDone, toggleStep, graph, makeId, change, onReveal, onOpenSection }) {
  const fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    h = R.createElement,
    [editing, setEditing] = R.useState(false),
    // The kind, lane and "show" controls stay out of sight until the row is
    // hovered or focused, or ⋯ is tapped (5.37): a calm list of names first.
    [tools, setTools] = R.useState(false),
    [stepsOpen, setStepsOpen] = R.useState(true),
    [stepDraft, setStepDraft] = R.useState(""),
    kind = measure.DDmeasureOf(block),
    from = sources.find((s) => s.id === block.from),
    sourcePath = (s) => DDshortPath((s.parts || [s.name]).map((p) => p.trim() || t("Section", "سکشن")), 34),
    update = (fn) => change((day) => ({ ...day, blocks: day.blocks.map((b) => (b.id === block.id ? fn(b) : b)) })),
    taskSteps = [...graph.steps.values()].filter((n) => n.taskId === block.id).length,
    leftSteps = [...graph.steps.values()].filter((n) => n.taskId === block.id && !n.step.done).length,
    taskBlocked = [...graph.steps.values()].some((n) => n.taskId === block.id && !n.step.done && !graph.status(n.id).ready);
  return h(
    "li",
    { className: "dd-engine-task", "data-done": !!block.done, "data-kind": kind, "data-engine-task": block.id, "data-tools": tools ? "open" : undefined },
    kind === "time" || kind === "count"
      ? h(
          "button",
          {
            type: "button",
            className: "dd-engine-check",
            disabled: !block.done && taskBlocked,
            "aria-pressed": !!block.done,
            "aria-label": (block.done ? t("Mark not done: ", "برداشتن تیک: ") : t("Mark done: ", "تیک زدن: ")) + (block.name || ""),
            onClick: () => update((b) => setDone(b, !b.done)),
          },
          block.done ? "✓" : "",
        )
      : h("span", { className: "dd-engine-kind-dot", "aria-hidden": true }, kind === "score" ? "★" : "⏳"),
    h("div", { className: "dd-engine-main" },
      from && onOpenSection && h("button", { className: "dd-engine-source-link", type: "button", onClick: () => onOpenSection(from.id),
        style: from.tint ? { borderColor: from.tint.line, color: from.tint.ink, background: from.tint.fill } : undefined }, "↗ " + sourcePath(from).short),
      editing
        ? h("input", {
            className: "dd-engine-name-input",
            defaultValue: block.name || "",
            autoFocus: true,
            dir: "auto",
            maxLength: 300,
            "aria-label": t("Task name", "نام کار"),
            onBlur: (event) => {
              const value = event.target.value.trim();
              setEditing(false);
              if (value && value !== block.name) update((b) => ({ ...b, name: value }));
            },
            onKeyDown: (event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = block.name || "";
                event.currentTarget.blur();
              }
            },
          })
        : h(
            "button",
            {
              type: "button",
              className: "dd-engine-name",
              dir: "auto",
              title: t("Rename", "تغییر نام"),
              onClick: () => setEditing(true),
            },
            block.name || t("Untitled", "بی‌نام"),
          ),
      h("div", { className: "dd-engine-meta" },
        taskBlocked && h("small", { className: "dd-step-blocked", title: t("A prerequisite is still open", "پیش‌نیازی هنوز باز است") }, t("Blocked", "وابسته")),
        h("button", { type: "button", className: "dd-engine-move", title: t("Move between Today and Park", "انتقال بین امروز و پارک"),
          onClick: () => update((b) => DDengineMoveTask(b, lanes)) },
          lanes.some((l) => l.id === block.lane) ? t("→ Park", "← پارک") : t("→ Today", "← امروز")),
        h("span", { className: "dd-engine-priority", "data-priority": block.pri || 0 }, block.pri ? "P" + block.pri : t("Normal", "عادی")),
        h("select", { className: "dd-engine-priority-pick dd-engine-tool", value: String(block.pri || 0), "aria-label": t("Priority", "اولویت"),
          onChange: (event) => update((b) => ({ ...b, pri: Number(event.target.value) })) },
          [[0, t("Normal", "عادی")], [1, "P1"], [2, "P2"], [3, "P3"]].map(([id, label]) => h("option", { value: id, key: id }, label))),
        kind !== "time" &&
          h(measure.DDMeasureControl, { React: R, block, language, onChange: update }),
        kind === "time" && Number(block.min) > 0 && h("span", { className: "dd-engine-min" }, measure.DDmeasureText(block, language)),
        h(
          "span",
          { className: "dd-engine-kinds dd-engine-tool", role: "group", "aria-label": t("Kind", "نوع") },
          KINDS.map(([id, icon, en, f]) =>
            h(
              "button",
              {
                key: id,
                type: "button",
                "aria-pressed": kind === id,
                "aria-label": t(en, f),
                title: t(en, f),
                onClick: () => update((b) => measure.DDsetMeasure(b, id)),
              },
              icon,
            ),
          ),
        ),
        // One lane only: picking another lane moves the task there.
        h("select",
          {
            className: "dd-engine-lane dd-engine-tool",
            value: lanes.some((lane) => lane.id === block.lane) ? block.lane : "",
            "aria-label": t("Lane", "لاین"),
            onChange: (event) => {
              const lane = event.target.value;
              change((day) => ({ ...day, blocks: day.blocks.map((b) => (b.id === block.id ? { ...b, lane } : b)) }));
            },
          },
          lanes.map((lane) => h("option", { key: lane.id, value: lane.id }, lane.name || lane.id)),
          h("option", { value: "" }, t("Parked", "پارک‌شده")),
        ),
        // Where the task came from: a Life section, or the main board.
        h("select",
          {
            // A task's source stays in sight (it is read often); "Main board" only with the tools.
            className: "dd-engine-from",
            "data-from": block.from || "",
            value: from ? block.from : "",
            "aria-label": t("Came from", "از کجا آمده") + (from ? ": " + sourcePath(from).full : ""),
            title: t("Came from", "از کجا آمده") + (from ? ": " + sourcePath(from).full : ""),
            style: from?.tint ? { background: from.tint.fill, color: from.tint.ink, borderColor: from.tint.line } : undefined,
            onChange: (event) => {
              const from = event.target.value;
              update((b) => {
                const next = { ...b, from };
                if (!from) delete next.from;
                return next;
              });
            },
          },
          h("option", { value: "" }, "↖ " + t("Main board", "برد اصلی")),
          sources.map((s) => h("option", { key: s.id, value: s.id, style: s.tint ? { background: s.tint.fill, color: s.tint.ink } : undefined }, "↖ " + sourcePath(s).short)),
        ),
        onReveal &&
          h(
            "button",
            {
              type: "button",
              className: "dd-engine-reveal dd-engine-tool",
              title: t("Show on the board", "نشان دادن روی برد"),
              "aria-label": t("Show on the board: ", "نشان دادن روی برد: ") + (block.name || ""),
              onClick: () => onReveal(block.id),
            },
            "◎",
          ),
      ),
      h("div", { className: "dd-engine-step-head" },
        h("button", { type: "button", "aria-expanded": stepsOpen, onClick: () => setStepsOpen(!stepsOpen) },
          (stepsOpen ? "⌄ " : "› ") + t("Steps", "قدم‌ها") + " · " + (taskSteps ? (taskSteps - Math.min(taskSteps, leftSteps)) + "/" + taskSteps : "0"))),
      stepsOpen && h("div", { className: "dd-engine-step-body" },
        h(EngineSteps, { React: R, block, graph, items: block.subtasks || [], language, change, toggleStep }),
        h("form", { className: "dd-engine-step-add", onSubmit: (event) => {
          event.preventDefault(); const text = stepDraft.trim(); if (!text) return;
          update((b) => ({ ...b, done: false, subtasks: [...(b.subtasks || []), { id: makeId(), text, done: false, expanded: true, children: [] }] }));
          setStepDraft("");
        } },
          h("input", { value: stepDraft, dir: "auto", maxLength: 300, placeholder: t("+ Add a step", "+ قدم جدید"),
            "aria-label": t("Add a step", "افزودن قدم"), onChange: (event) => setStepDraft(event.target.value) }))),
    ),
    h(
      "button",
      {
        type: "button",
        className: "dd-engine-more",
        "aria-expanded": tools,
        "aria-label": t("More for: ", "بیشتر برای: ") + (block.name || ""),
        title: t("Kind, lane and more", "نوع، لاین و بیشتر"),
        onClick: () => setTools(!tools),
      },
      "⋯",
    ),
  );
}

function AddTask({ React: R, lane, language, onAdd }) {
  const h = R.createElement,
    fa = language === "fa",
    [value, setValue] = R.useState("");
  return h(
    "form",
    {
      className: "dd-engine-add",
      onSubmit: (event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onAdd(value, lane.id);
        setValue("");
      },
    },
    h("input", {
      value,
      dir: "auto",
      maxLength: 300,
      placeholder: fa ? "+ کار تازه" : "+ New task",
      "aria-label": (fa ? "کار تازه در " : "New task in ") + (lane.name || (fa ? "پارک‌شده" : "Parked")),
      onChange: (event) => setValue(event.target.value),
    }),
  );
}

function EngineSharedNotes({ React: R, setup, language, onAdd, onEdit }) {
  const h = R.createElement, t = (en, fa) => language === "fa" ? fa : en,
    [draft, setDraft] = R.useState(""),
    notes = DDlifeItems(setup).filter((item) => item.type === "sticky" && item.id.startsWith("lf-engine-note-"));
  return h("aside", { className: "dd-engine-shared", "aria-label": t("Shared Engine notes", "نوت‌های مشترک انجین") },
    h("strong", null, t("Shared notes", "نوت‌های مشترک")),
    h("div", { className: "dd-engine-shared-list" },
      notes.map((note) => h("textarea", { key: note.id, defaultValue: note.text, dir: "auto", rows: 2,
        "aria-label": t("Shared note", "نوت مشترک"), onBlur: (event) => {
          if (event.target.value !== note.text) onEdit?.(note.id, event.target.value);
        } })),
      h("form", { onSubmit: (event) => { event.preventDefault(); if (draft.trim()) { onAdd?.(draft.trim()); setDraft(""); } } },
        h("input", { value: draft, dir: "auto", placeholder: t("+ Note for every section", "+ نوت برای همهٔ سکشن‌ها"),
          "aria-label": t("New shared note", "نوت مشترک جدید"), onChange: (event) => setDraft(event.target.value) }))),
    h("small", null, t("Visible in Engine from every section and kept in the shared Feed.", "در انجین همهٔ سکشن‌ها دیده می‌شود و در فید مشترک می‌ماند.")));
}

// The Engine brought over the board: the board stays behind it, dimmed.
// E, Esc, the close button or a click on the dimmed board closes it.
export function DDEngineOverlay({
  React: R,
  day,
  setup,
  language,
  dateLabel,
  measure,
  setDone,
  toggleStep,
  onChange,
  onAdd,
  onReveal,
  onOpenSection,
  onCapture,
  onPause,
  onAddSharedNote,
  onEditSharedNote,
  onClose,
  days,
  dateFormat,
  makeId,
  sources = [],
  renderPlan,
  sectionId = "",
}) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    weekday = new Intl.DateTimeFormat(fa ? "fa-IR" : "en-US", { weekday: "long", timeZone: "UTC" }).format(new Date((day.date || "2026-01-01") + "T12:00:00Z")),
    lanes = setup?.lanes || [],
    [planning, setPlanning] = R.useState(false),
    [allSections, setAllSections] = R.useState(false),
    section = sources.find((entry) => entry.id === sectionId),
    scopedDay = section && !allSections ? { ...day, blocks: day.blocks.filter((task) => task.from === section.id) } : day,
    groups = DDengineColumns(scopedDay, lanes),
    graph = DDengineStepGraph(day),
    progress = DDcompletion(scopedDay, lanes.map((lane) => lane.id)),
    [filter, setFilter] = R.useState("all"),
    [earlierOpen, setEarlierOpen] = R.useState(false),
    [carryHidden, setCarryHidden] = R.useState(() => DDengineCarryHidden(day.date)),
    carry = days ? DDengineCarry(days, day) : null,
    panel = R.useRef(null);
  R.useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  const shown = groups.map((group) => ({ ...group, blocks: group.blocks.filter((b) => filter === "all" || (filter === "done" ? b.done : !b.done)) }));
  return h(
    "div",
    {
      className: "dd-engine-backdrop",
      onPointerDown: (event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      },
      onWheel: (event) => event.stopPropagation(),
      onKeyDown: (event) => {
        const typing = event.target.closest?.("input,textarea,select");
        if (event.key === "Escape" || (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (event.key === "e" || event.code === "KeyE"))) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        event.stopPropagation();
      },
    },
    h(
      "section",
      {
        className: "dd-engine",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": t("Engine", "انجین"),
        "data-panel": "engine",
        dir: fa ? "rtl" : "ltr",
        tabIndex: -1,
        ref: panel,
      },
      h(
        "header",
        { className: "dd-engine-head" },
        h("span", { className: "dd-engine-icon", "aria-hidden": true }, "⚙️"),
        h("div", { className: "dd-engine-title" }, h("strong", null, t("Engine", "انجین")), dateLabel && h("small", null, dateLabel)),
        h(
          "div",
          { className: "dd-engine-progress", title: t("Done, weighted by priority", "انجام‌شده، با وزن اولویت") },
          h("span", { className: "dd-engine-bar" }, h("i", { style: { width: progress.percent + "%" } })),
          h("b", null, progress.done + "/" + progress.total),
        ),
        days &&
          h(
            "button",
            {
              type: "button",
              className: "dd-engine-earlier-toggle",
              "aria-expanded": earlierOpen,
              onClick: () => setEarlierOpen(!earlierOpen),
            },
            t("Earlier Engine", "انجین روزهای قبل"),
          ),
        renderPlan && h("button", { type: "button", className: "dd-engine-head-action", "aria-pressed": planning,
          onClick: () => setPlanning(!planning) }, planning ? t("Back to tasks", "بازگشت به کارها") : t("Planning tools", "ابزارهای پلن")),
        onCapture && h("button", { type: "button", className: "dd-engine-head-action", onClick: onCapture }, t("Capture", "ثبت سریع")),
        onPause && h("button", { type: "button", className: "dd-engine-head-action", onClick: onPause }, t("Pause the day", "توقف روز")),
        h(
          "button",
          { type: "button", className: "dd-engine-close", onClick: onClose, "aria-label": t("Close Engine", "بستن انجین") },
          h("kbd", null, "E"),
          " ",
          t("Close", "بستن"),
        ),
      ),
      planning ? h("div", { className: "dd-engine-planning" }, renderPlan()) : h(R.Fragment, null,
      carry && carry.count > 0 && !carryHidden && !earlierOpen &&
        h(CarryLine, {
          React: R,
          carry,
          language,
          dateFormat,
          onBring: () => onChange((d) => ({ ...d, blocks: [...d.blocks, ...DDengineCopyMany([...carry.open, ...carry.waiting], makeId)] })),
          onChoose: () => setEarlierOpen(true),
          onHide: () => { DDhideEngineCarry(day.date); setCarryHidden(true); },
        }),
      earlierOpen &&
        h(EarlierEngine, {
          React: R,
          days,
          day,
          lanes,
          language,
          dateFormat,
          onCopy: (blocks) =>
            onChange((d) => ({ ...d, blocks: [...d.blocks, ...DDengineCopyMany(blocks, makeId)] })),
        }),
      h("div", { className: "dd-engine-filter", role: "group", "aria-label": t("Filter tasks", "فیلتر کارها") },
        section && h("select", { value: allSections ? "all" : "here", "aria-label": t("Section scope", "محدودهٔ سکشن"),
          onChange: (event) => setAllSections(event.target.value === "all") },
          h("option", { value: "here" }, section.parts.join(" › ")),
          h("option", { value: "all" }, t("All sections", "همهٔ سکشن‌ها"))),
        [["all", t("All", "همه")], ["left", t("Left", "مانده")], ["done", t("Done", "انجام‌شده")]].map(([id, label]) =>
          h("button", { type: "button", key: id, "aria-pressed": filter === id, onClick: () => setFilter(id) }, label))),
      h(
        "div",
        { className: "dd-engine-lanes" },
        shown.map(({ id, blocks }) =>
          h(
            "section",
            { key: id, className: "dd-engine-lane-col", "data-lane": id, "data-engine-zone": id },
            h(
              "h3",
              null,
              id === "park" ? t("Park", "پارک") : t("Today", "امروز") + " · " + weekday,
              h("small", null, groups.find((c) => c.id === id).blocks.filter((b) => b.done).length + "/" + groups.find((c) => c.id === id).blocks.length),
            ),
            h(
              "ul",
              null,
              blocks.map((block) =>
                h(EngineRow, { key: block.id, React: R, block, lanes, sources, language, measure, setDone,
                  toggleStep, graph, makeId,
                  change: onChange, onReveal, onOpenSection }),
              ),
            ),
            h(AddTask, { React: R, lane: { id: id === "park" ? "" : lanes[0]?.id || "", name: id === "park" ? t("Park", "پارک") : t("Today", "امروز") }, language, onAdd }),
          ),
        ),
      ),
      h(EngineSharedNotes, { React: R, setup, language, onAdd: onAddSharedNote, onEdit: onEditSharedNote }),
      h(
        "footer",
        { className: "dd-engine-foot" },
        t(
          "Priority brings important open work forward. Steps can run in sequence or parallel, including across tasks.",
          "کارهای مهم و باز بالاتر می‌آیند. قدم‌ها می‌توانند پشت‌سرهم یا موازی باشند، حتی بین چند کار.",
        ),
      ),
    )),
  );
}

export const DDengineCSS = `
.dd-engine-backdrop{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(18,18,17,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);animation:dd-engine-in .14s ease-out}
.b2-board-focus .dd-engine-backdrop,.b4-focus .dd-engine-backdrop{position:fixed}
@keyframes dd-engine-in{from{opacity:0}to{opacity:1}}
.dd-engine{width:min(1080px,100%);max-height:min(82vh,100%);display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#121211);border-radius:16px;box-shadow:0 24px 60px #0006,0 0 0 1px var(--rule-2,#0002);overflow:hidden;outline:none}
.dd-engine-planning{overflow:auto;min-height:0;padding:12px 16px}.dd-engine-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--rule-2,#0001)}
.dd-engine-icon{font-size:20px}
.dd-engine-title{display:flex;flex-direction:column;gap:2px;min-width:0}
.dd-engine-title strong{font-size:16px}
.dd-engine-title small{font-size:12px;color:var(--ink-3,#666)}
.dd-engine-progress{display:flex;align-items:center;gap:8px;margin-inline-start:auto;font:500 12px/1 var(--mono,monospace)}
.dd-engine-bar{width:120px;height:6px;border-radius:9px;background:var(--wash,#eee);overflow:hidden}
.dd-engine-bar i{display:block;height:100%;background:var(--panel-engine,#F05A28);border-radius:inherit;transition:width .2s}
.dd-engine-close{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;background:var(--wash,#eee);color:var(--ink,#121211);font-size:12px}
.dd-engine-close kbd{font:600 11px/1 var(--mono,monospace);padding:2px 5px;border-radius:4px;background:var(--paper,#fff);box-shadow:0 1px 0 var(--rule-2,#0002)}
.dd-engine-lanes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;padding:16px 18px;overflow:auto}
.dd-engine-lane-col{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px;border-radius:12px;background:var(--panel,#f6f5f2);box-shadow:inset 0 0 0 1px var(--rule-2,#0001)}
.dd-engine-lane-col h3{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0;font-size:13px;text-transform:none}
.dd-engine-lane-col h3 small{font:500 11px/1 var(--mono,monospace);color:var(--ink-3,#666)}
.dd-engine-lane-col ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dd-engine-task{display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:9px;background:var(--paper,#fff);box-shadow:0 1px 2px #0001}
.dd-engine-task[data-done=true] .dd-engine-name{text-decoration:line-through;opacity:.55}
.dd-engine-check{flex:none;width:22px;height:22px;border-radius:6px;border:1.6px solid var(--ink-3,#888);display:grid;place-items:center;font-size:13px;color:#fff;background:none}
.dd-engine-check[aria-pressed=true]{background:var(--panel-engine,#F05A28);border-color:var(--panel-engine,#F05A28)}
.dd-engine-kind-dot{flex:none;width:22px;height:22px;display:grid;place-items:center;font-size:13px;color:var(--ink-3,#666)}
.dd-engine-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.dd-engine-name{all:unset;cursor:text;font-size:14px;line-height:1.35;overflow-wrap:anywhere}
.dd-engine-name:focus-visible{outline:2px solid var(--panel-engine,#F05A28);outline-offset:2px;border-radius:3px}
.dd-engine-name-input{font:inherit;font-size:14px;padding:3px 6px;border-radius:6px;border:1px solid var(--rule-2,#ccc);background:var(--panel,#fff);color:var(--ink,#121211);width:100%;box-sizing:border-box}
.dd-engine-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--ink-3,#666)}
.dd-engine-meta .step{min-height:24px;border:0;padding:0;background:none;color:var(--ink-2,#444);font-family:inherit}
.dd-engine-meta .step span{font-family:inherit;letter-spacing:0}
.dd-engine:focus,.b6 .dd-engine:focus-visible,.dd-engine:focus-visible{outline:none}
.dd-engine-kinds{display:inline-flex;gap:1px;padding:1px;border-radius:6px;background:var(--wash,#eee)}
.dd-engine-kinds button{width:22px;height:20px;border-radius:5px;font-size:11px;color:var(--ink-3,#666);background:none}
.dd-engine-kinds button[aria-pressed=true]{background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 1px 2px #0002}
.dd-engine-lane{font:inherit;font-size:12px;padding:2px 4px;border-radius:6px;border:1px solid var(--rule-2,#ccc);background:var(--paper,#fff);color:var(--ink,#121211);max-width:120px}
.dd-engine-reveal{width:22px;height:20px;border-radius:5px;background:none;color:var(--ink-3,#666)}
.dd-engine-reveal:hover{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-add input{width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:7px 9px;border-radius:8px;border:1px dashed var(--rule-2,#bbb);background:transparent;color:var(--ink,#121211)}
.dd-engine-add input:focus{border-style:solid;outline:none;border-color:var(--panel-engine,#F05A28)}
.dd-engine-earlier-toggle{padding:6px 10px;border-radius:8px;background:none;color:var(--ink-2,#444);font-size:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-earlier-toggle[aria-expanded=true]{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-earlier{margin:12px 18px 0;padding:10px 12px;border-radius:12px;background:var(--wash,#f1efe9);font-size:13px;max-height:34vh;overflow:auto;flex:none}
.dd-engine-earlier[data-empty]{color:var(--ink-3,#666)}
.dd-engine-earlier-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.dd-engine-earlier-head>button:not(.dd-engine-copy-all){width:26px;height:26px;border-radius:7px;background:var(--paper,#fff);color:var(--ink,#121211)}
.dd-engine-earlier-head>button:disabled{opacity:.35}
.dd-engine-copy-all{margin-inline-start:auto;padding:5px 10px;border-radius:7px;background:var(--panel-engine,#F05A28);color:#fff;font-size:12px}
.dd-engine-copy-all:disabled{opacity:.4}
.dd-engine-earlier ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.dd-engine-earlier li{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;background:var(--paper,#fff)}
.dd-engine-earlier li[data-done=true] .dd-engine-earlier-name{opacity:.55}
.dd-engine-earlier-name{flex:1;min-width:0;overflow-wrap:anywhere}
.dd-engine-earlier small{color:var(--ink-3,#666);font-size:11px}
.dd-engine-copy{padding:3px 8px;border-radius:6px;background:var(--wash,#eee);color:var(--ink,#121211);font-size:12px;white-space:nowrap}
.dd-engine-here{font-size:11px;color:var(--ink-3,#666);white-space:nowrap}
.dd-history-strip{display:inline-flex;align-items:center;gap:3px}
.dd-history-strip i{display:block;width:8px;height:8px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink,#121211) 22%,transparent)}
.dd-history-strip i[data-state=done]{background:#2E8B3A;box-shadow:none}
.dd-history-strip i[data-state=some]{background:linear-gradient(90deg,#2E8B3A 50%,color-mix(in srgb,#D9434A 30%,transparent) 50%);box-shadow:none}
.dd-history-strip i[data-state=open]{box-shadow:inset 0 0 0 1.5px #D9434A}
.b6 .b4-life-section>.dd-sec-history{--k:var(--dd-sec-k,1);position:absolute;top:calc(10px * var(--k));right:calc(10px * var(--k));z-index:30;display:flex;align-items:center;gap:calc(6px * var(--k));height:calc(28px * var(--k));max-width:calc(100% - 20px * var(--k));padding:0 calc(8px * var(--k));border-radius:calc(6px * var(--k));border:calc(1px * var(--k)) solid color-mix(in srgb,var(--node-color) 60%,#1e1e1e 20%);background:var(--paper,#fff);color:var(--ink,#121211);font:600 calc(11px * var(--k))/1 var(--mono,ui-monospace,monospace);overflow:hidden;cursor:pointer;min-width:0;min-height:0}
.b6 .b4-life-section>.dd-sec-history .dd-history-strip{gap:calc(3px * var(--k))}
.b6 .b4-life-section>.dd-sec-history i{width:calc(8px * var(--k));height:calc(8px * var(--k))}
.dd-room-history{position:absolute;box-sizing:border-box;transform:scale(clamp(1,var(--b4-inverse,1),1.6));transform-origin:0 0;padding:16px 18px;border-radius:16px;background:var(--paper,#fff);color:var(--ink,#121211);border:1px solid var(--rule-2,#0002);box-shadow:0 6px 20px #0000001a;font:14px/1.4 var(--sans,system-ui);z-index:2}
.dd-room-history header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
.dd-room-history header small{color:var(--ink-2,#555);font-size:12px}
.dd-room-history>.dd-history-strip{margin-bottom:12px}
.dd-room-history>.dd-history-strip i{width:12px;height:12px}
.dd-room-history ol,.dd-room-history ul{list-style:none;margin:0;padding:0}
.dd-room-history ol>li{padding:8px 0;border-top:1px solid var(--rule-2,#0001)}
.dd-room-history-day{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--ink-2,#555);margin-bottom:4px}
.dd-room-history-day b{color:var(--ink,#121211);font-weight:600}
.dd-room-history ul li{display:flex;align-items:baseline;gap:8px;padding:2px 0}
.dd-room-history ul li>span:first-child{width:14px;flex:none;color:#D9434A;font-weight:700}
.dd-room-history ul li[data-done=true]>span:first-child{color:#2E8B3A}
.dd-room-history ul li[data-done=true]>span:nth-child(2){color:var(--ink-2,#555)}
.dd-room-history ul li small{margin-inline-start:auto;color:var(--ink-2,#555);font-size:11px;white-space:nowrap}
.dd-room-history p{margin:0;color:var(--ink-2,#555);font-size:13px}
.dd-room-history-more{margin-top:10px;border:1px solid var(--rule-2,#0002);border-radius:999px;background:transparent;color:inherit;font:12px/1 var(--sans,system-ui);padding:6px 12px;cursor:pointer}
.dd-room-history-more:hover{background:#0000000d}
.dd-task-from{position:absolute;top:-10px;right:10px;z-index:3;max-width:62%;box-sizing:border-box;padding:1px 7px;border-radius:999px;font-size:10.5px;line-height:1.5;border:1px solid color-mix(in srgb,var(--panel-engine,#F05A28) 35%,transparent);background:color-mix(in srgb,var(--panel-engine,#F05A28) 10%,var(--paper,#fff));color:color-mix(in srgb,var(--panel-engine,#F05A28) 80%,var(--ink,#121211));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-engine-from{max-width:170px;font:inherit;font-size:12px;padding:3px 6px;border-radius:999px;border:1px solid color-mix(in srgb,var(--panel-engine,#F05A28) 35%,transparent);background:color-mix(in srgb,var(--panel-engine,#F05A28) 8%,transparent);color:var(--ink,#121211);text-overflow:ellipsis}
.dd-engine-from[data-from=""]{border-color:var(--rule-2,#0002);background:transparent;color:var(--ink-2,#555)}
.dd-engine-area{position:absolute;border:2px dashed color-mix(in srgb,var(--panel-engine,#F05A28) 55%,transparent);background:color-mix(in srgb,var(--panel-engine,#F05A28) 5%,transparent);border-radius:28px;box-sizing:border-box}
.dd-engine-area-title{position:absolute;left:18px;bottom:calc(100% - 16px);transform:scale(clamp(1,var(--b4-inverse,1),4));display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:var(--panel-engine,#F05A28);color:#fff;font:600 15px/1.2 var(--sans,system-ui);white-space:nowrap;transform-origin:0 100%;box-shadow:0 2px 8px #0002}
.dd-engine-area-title small{font-weight:500;opacity:.85}
.dd-engine-area-title button{padding:2px 8px;border-radius:999px;background:#fff3;color:#fff;font-size:12px}
.dd-engine-carry{display:flex;align-items:center;gap:10px;margin:12px 18px 0;padding:8px 8px 8px 12px;border-radius:12px;background:color-mix(in srgb,var(--panel-engine,#F05A28) 7%,var(--wash,#f1efe9));flex:none;min-width:0}
.dd-engine-carry-icon{font-size:16px;color:color-mix(in srgb,var(--panel-engine,#F05A28) 75%,var(--ink,#121211))}
.dd-engine-carry-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dd-engine-carry-text b{font-size:13px;font-weight:600}
.dd-engine-carry-text small{font-size:12px;color:var(--ink-2,#555);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-engine-carry-all{flex:none;padding:6px 12px;border-radius:8px;background:var(--panel-engine,#F05A28);color:#fff;font-size:12px;font-weight:600}
.dd-engine-carry-pick{flex:none;padding:6px 10px;border-radius:8px;background:var(--paper,#fff);color:var(--ink,#121211);font-size:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-carry-hide{flex:none;width:28px;height:28px;border-radius:8px;background:none;color:var(--ink-3,#666);font-size:16px;line-height:1}
.dd-engine-carry-hide:hover{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-task{position:relative}
.dd-engine-task:not(:hover):not(:focus-within):not([data-tools=open]) .dd-engine-tool{display:none}
.dd-engine-more{flex:none;width:24px;height:22px;margin-inline-start:-2px;border-radius:6px;background:none;color:var(--ink-3,#666);font-size:15px;line-height:1;opacity:0}
.dd-engine-task:hover .dd-engine-more,.dd-engine-more:focus-visible,.dd-engine-more[aria-expanded=true]{opacity:1}
.dd-engine-more:hover,.dd-engine-more[aria-expanded=true]{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine{width:min(1160px,100%);max-height:min(91vh,100%);border-radius:20px}
.dd-engine-lanes{grid-template-columns:minmax(0,1.8fr) minmax(260px,1fr);gap:12px;align-items:start;padding-top:10px}
.dd-engine-lane-col{background:color-mix(in srgb,var(--ink,#121211) 3%,var(--paper,#fff));border:1px solid var(--rule-2,#0001);box-shadow:none}
.dd-engine-lane-col[data-lane=park]{background:var(--wash,#f4f4f2)}
.dd-engine-lane-col h3{padding:3px 2px 8px;font-size:16px;font-weight:650}
.dd-engine-task{padding:12px;border:1px solid var(--rule-2,#0001);box-shadow:0 2px 6px #00000005}
.dd-engine-filter{display:flex;align-items:center;gap:3px;margin:12px 18px 0;padding:3px;width:max-content;border-radius:9px;background:var(--wash,#eee)}
.dd-engine-filter button{padding:6px 14px;border-radius:7px;background:none;color:var(--ink-2,#555);font-size:12px}
.dd-engine-filter button[aria-pressed=true]{background:var(--paper,#fff);box-shadow:0 1px 3px #0002;color:var(--ink,#111)}
.dd-engine-head-action{padding:7px 9px;border-radius:8px;background:transparent;box-shadow:inset 0 0 0 1px var(--rule-2,#0002);font-size:12px;color:var(--ink,#111)}
.dd-engine-move{border-radius:6px;background:var(--wash,#eee);color:var(--ink-2,#555);padding:4px 7px;font-size:11px}
.dd-engine-priority{display:inline-flex;align-items:center;border-radius:5px;color:var(--ink-3,#777);font:600 10px/1.6 var(--mono,monospace)}
.dd-engine-priority[data-priority="1"]{color:#d3443d}.dd-engine-priority[data-priority="2"]{color:#c18622}.dd-engine-priority[data-priority="3"]{color:#547f9d}
.dd-engine-priority-pick{border:1px solid var(--rule-2,#0002);border-radius:5px;background:var(--paper,#fff);color:var(--ink,#111);font-size:11px}
.dd-engine-source-link{display:block;align-self:flex-start;border:1px solid var(--rule-2,#0002);border-radius:999px;padding:2px 8px;font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.dd-engine-step-head{display:flex;gap:10px;align-items:center}
.dd-engine-step-head button{background:none;color:var(--ink-2,#555);font-size:11px;padding:4px 0}
.dd-engine-steps{display:flex;flex-direction:column;gap:4px;padding:0 0 0 11px;margin:0;list-style:none;border-inline-start:1px solid var(--rule-2,#0003)}
.dd-engine-step{position:relative;min-width:0;padding:3px 0 3px 8px}
.dd-engine-step:before{content:"";position:absolute;width:8px;top:16px;inset-inline-start:-11px;border-top:1px solid var(--rule-2,#0004)}
.dd-engine-step[data-flow=after]:before{border-color:var(--panel-engine,#F05A28);border-width:2px}
.dd-engine-step-line{display:flex;align-items:center;min-width:0;gap:6px}
.dd-step-check{flex:none;width:19px;height:19px;border:1.3px solid var(--ink-3,#999);border-radius:5px;background:none;color:#fff;font-size:11px}
.dd-step-check[aria-pressed=true]{background:var(--panel-engine,#F05A28);border-color:var(--panel-engine,#F05A28)}
.dd-step-check:disabled{opacity:.4;cursor:not-allowed}
.dd-step-text{flex:1;min-width:0;border:0;border-radius:4px;outline:none;color:var(--ink,#111);background:transparent;font:12px/1.5 var(--sans,system-ui);padding:3px 2px}
.dd-step-text:focus{outline:1px solid var(--panel-engine,#F05A28);background:var(--paper,#fff)}
.dd-engine-step[data-done=true]>.dd-engine-step-line .dd-step-text{text-decoration:line-through;color:var(--ink-3,#777)}
.dd-step-flow{width:27px;height:24px;flex:none;border-radius:6px;background:var(--wash,#eee);color:var(--ink-2,#555);font-size:15px}
.dd-step-flow[aria-pressed=true]{background:color-mix(in srgb,var(--panel-engine,#F05A28) 13%,var(--paper,#fff));color:var(--panel-engine,#F05A28)}
.dd-step-blocked{font-size:10px;color:#bc7436}
.dd-engine-step-deps{display:flex;flex-wrap:wrap;gap:3px;margin:3px 0 0 24px;max-width:100%}
.dd-step-dep{max-width:100%;overflow:hidden;text-overflow:ellipsis;border-radius:5px;background:var(--wash,#eee);color:var(--ink-2,#444);padding:3px 6px;font-size:10px}
.dd-step-dep-edit{background:none;color:var(--ink-3,#666);font-size:11px;padding:3px 5px}.dd-step-dependency{max-width:135px;padding:3px 4px;border:1px dashed var(--rule-2,#0003);border-radius:5px;background:transparent;color:var(--ink-3,#666);font-size:10px}
.dd-engine-step-add input{width:100%;border:0;border-bottom:1px dashed var(--rule-2,#0003);background:transparent;color:var(--ink,#111);font-size:12px;padding:6px 2px;outline:none}
.dd-engine-step-add input:focus{border-color:var(--panel-engine,#F05A28)}
.dd-engine-shared{padding:10px 18px;border-top:1px solid var(--rule-2,#0001);display:flex;flex-direction:column;gap:8px}
.dd-engine-shared>strong{font-size:12px}.dd-engine-shared>small{font-size:10px;color:var(--ink-3,#777)}
.dd-engine-shared-list{display:flex;gap:8px;overflow-x:auto;max-height:110px;padding-bottom:4px;scrollbar-width:thin}
.dd-engine-shared-list textarea,.dd-engine-shared-list input{width:200px;min-width:180px;box-sizing:border-box;resize:none;padding:9px;border-radius:9px;border:1px solid var(--rule-2,#0002);background:var(--wash,#f7f6f3);color:var(--ink,#111);font:12px/1.45 var(--sans,system-ui)}
.dd-engine-shared-list form{flex:none}.dd-engine-shared-list input{height:64px;border-style:dashed}
@media (hover:none){.dd-engine-more{opacity:1;width:32px;height:32px}}
.dd-engine-foot{padding:10px 18px;font-size:12px;color:var(--ink-3,#666);border-top:1px solid var(--rule-2,#0001)}
@media (max-width:760px){.dd-engine-carry{flex-wrap:wrap;margin:10px 12px 0}.dd-engine-carry-text{flex-basis:calc(100% - 40px)}.dd-engine-carry-all,.dd-engine-carry-pick{min-height:36px}.dd-engine-backdrop{padding:10px;align-items:stretch}.dd-engine{max-height:none}.dd-engine-head{flex-wrap:wrap}.dd-engine-lanes{grid-template-columns:1fr;padding:12px}.dd-engine-bar{width:64px}.dd-engine-check,.dd-engine-kinds button,.dd-engine-reveal{min-width:28px;min-height:28px}}
@media (prefers-reduced-motion:reduce){.dd-engine-backdrop{animation:none}}
`;

export function DDinstallEngineStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-css", textContent: DDengineCSS }));
}
