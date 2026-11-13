// The Engine's screen (5.50): one calm list for the day and one shelf.
//
//   Today · Friday   every task of the day, the most important first, with its
//                    steps one tap away and the next step always in sight.
//   Park             tasks that are not for today. The shelf stays from day to
//                    day (setup.later), so nothing waits on an old day.
//
// Order (5.51): a task or step can come "after" another, even in another task.
// When the day has an order, Today shows it in waves: what can go side by side
// now, then what follows. A waiting task is shown as waiting, never locked.
//
// The same screen is the Engine tab (the old Plan page) and the Engine that E
// brings over the Board. It keeps no copy: every change goes through onChange
// (the day) or onSetup (Park, lanes), so the Board, its Lanes view, Calendar and
// search show it at once.
import {
  DDengineCarry,
  DDengineCarryHidden,
  DDhideEngineCarry,
  DDengineCopy,
  DDengineEarlierDay,
  DDengineHas,
  DDengineTask,
  DDengineOrder,
  DDengineShows,
  DDengineNextStep,
  DDengineStepCount,
  DDengineParked,
  DDengineLaneFor,
} from "./engine.js";
import { DDcompletion, DDpriorityLabel, DDTaskMetadata, DDTaskTags } from "./planner.js";
import { DDmeasureOf, DDmeasureText, DDMeasureControl, DDsetMeasure, DDplanMinutes, DDduration } from "./measure.js";
import { DDenergyOf, DDsetEnergy, DDenergyLabel } from "./energy.js";
import { DDsetTaskDone, DDtoggleSubtask, DDcleanBoard } from "./search.js";
import { DDPlanNudges } from "./nudges.js";
import { DDshortPath } from "./life-board.js";
import { DDflowItems, DDflowCanAdd, DDflowAdd, DDflowRemove, DDflowWaitingOn, DDflowWaves, DDflowStepRef, DDflowTaskRef } from "./flow.js";

const words = (fa) => (en, f) => (fa ? f : en);

// How a task or step is named in an order: "Task" or "Task › Step".
const flowName = (item, fa) => {
  const task = item.block.name || (fa ? "بی‌نام" : "Untitled");
  return DDshortPath(item.step ? [task, item.step.text || (fa ? "قدم" : "Step")] : [task], 44).short;
};
const flowNames = (list, fa) => list.map((item) => flowName(item, fa)).join(fa ? "، " : ", ");

// "After …": what a task or step comes after, each one removable, and a picker
// for one more. The picker lists today's tasks with their steps under them,
// leaving out anything that would go round in a circle.
function AfterEditor({ React: R, flow, refId, language, compact, onDone }) {
  const h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    item = flow.items.get(refId);
  if (!item) return null;
  const choices = [...flow.items.values()].filter((other) => DDflowCanAdd(flow.items, refId, other.ref)),
    groups = [];
  for (const other of choices) {
    const last = groups.at(-1);
    if (last && last.block === other.block) last.list.push(other);
    else groups.push({ block: other.block, list: [other] });
  }
  return h(
    "span",
    { className: "dd-engine-after-edit" + (compact ? " is-compact" : "") },
    !compact &&
      item.after.map((ref) => {
        const before = flow.items.get(ref);
        return (
          before &&
          h(
            "span",
            { key: ref, className: "dd-engine-after-chip", "data-before": ref, "data-done": before.done || undefined, dir: "auto" },
            (before.done ? "✓ " : "") + flowName(before, fa),
            h("button", { type: "button", "aria-label": t("No longer after ", "دیگر بعد از ") + flowName(before, fa), onClick: () => flow.remove(refId, ref) }, "×"),
          )
        );
      }),
    choices.length > 0 &&
      h(
        "select",
        {
          className: "dd-engine-after-pick",
          value: "",
          autoFocus: compact,
          "aria-label": t("Do after…", "انجام بعد از…"),
          onChange: (event) => {
            const value = event.target.value;
            if (value) flow.add(refId, value);
            onDone?.();
          },
          onBlur: () => compact && onDone?.(),
          onKeyDown: (event) => {
            event.stopPropagation();
            if (event.key === "Escape") onDone?.();
          },
        },
        h("option", { value: "" }, t("+ After…", "+ بعد از…")),
        groups.map((group) =>
          h(
            "optgroup",
            { key: group.block.id, label: group.block.name || t("Untitled", "بی‌نام") },
            group.list.map((other) => h("option", { key: other.ref, value: other.ref }, other.step ? "  · " + (other.step.text || t("Step", "قدم")) : group.block.name || t("Untitled", "بی‌نام"))),
          ),
        ),
      ),
  );
}
const digits = (n, fa) => (fa ? Number(n).toLocaleString("fa-IR") : String(n));

// "Friday", or "Saturday 14 Nov" for a day that is not today.
export function DDengineDayName(date, today, language) {
  const fa = language === "fa",
    at = new Date(String(date) + "T12:00:00Z");
  if (Number.isNaN(at.getTime())) return "";
  const format = (options) => new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { timeZone: "UTC", ...options }).format(at);
  return date === today ? format({ weekday: "long" }) : format({ weekday: "long", day: "numeric", month: "short" });
}

// Small, local UI memory (which tasks show their steps, the filter). Device only.
function remembered(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function remember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Steps are trees: these keep a change to one step from touching the others.
const mapSteps = (items, id, fn) =>
  (items || []).map((item) => (item.id === id ? fn(item) : { ...item, children: mapSteps(item.children, id, fn) }));
const dropStep = (items, id) =>
  (items || []).filter((item) => item.id !== id).map((item) => ({ ...item, children: dropStep(item.children, id) }));
const stepRefs = (items, blockId) =>
  (items || []).flatMap((item) => ["sub:" + blockId + ":" + item.id, ...stepRefs(item.children, blockId)]);

const KINDS = [
  ["time", "✓", "Tick", "تیکی"],
  ["score", "★", "Score", "نمره‌ای"],
  ["wait", "⏳", "Waiting", "ویتینگ"],
];

// The earlier Engine, shown inside today's: copy one task, or every open one.
function EarlierEngine({ React: R, days, day, language, dateFormat, onCopy }) {
  const h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    [skip, setSkip] = R.useState(0),
    earlier = DDengineEarlierDay(days, day.date, skip);
  if (!earlier) return h("div", { className: "dd-engine-earlier", "data-empty": true }, t("No earlier day has tasks yet.", "هنوز روز قبلی با کار نداری."));
  const open = earlier.day.blocks.filter((b) => !b.done && !DDengineHas(day, b));
  return h(
    "div",
    { className: "dd-engine-earlier", "data-earlier-date": earlier.date },
    h(
      "div",
      { className: "dd-engine-earlier-head" },
      h("button", { type: "button", disabled: !earlier.more, "aria-label": t("Earlier day", "روز قبل‌تر"), onClick: () => setSkip(skip + 1) }, fa ? "›" : "‹"),
      h("strong", null, t("Engine of ", "انجین ") + (dateFormat ? dateFormat(earlier.date) : earlier.date)),
      h("button", { type: "button", disabled: !skip, "aria-label": t("Later day", "روز بعدتر"), onClick: () => setSkip(Math.max(0, skip - 1)) }, fa ? "‹" : "›"),
      h("button", { type: "button", className: "dd-engine-copy-all", disabled: !open.length, onClick: () => onCopy(open) }, t("Copy all open", "کپی همهٔ کارهای باز") + " (" + digits(open.length, fa) + ")"),
    ),
    h(
      "ul",
      null,
      earlier.day.blocks.map((block) =>
        h(
          "li",
          { key: block.id, "data-done": !!block.done, "data-earlier-task": block.id },
          h("span", { className: "dd-engine-earlier-name", dir: "auto" }, (block.done ? "✓ " : "") + (block.name || t("Untitled", "بی‌نام"))),
          DDengineHas(day, block)
            ? h("span", { className: "dd-engine-here" }, t("Already today", "امروز هست"))
            : h("button", { type: "button", className: "dd-engine-copy", "aria-label": t("Copy to today: ", "کپی به امروز: ") + (block.name || ""), onClick: () => onCopy([block]) }, t("+ Today", "+ امروز")),
        ),
      ),
    ),
  );
}

// The soft line at the top: what is still open from the last day and what you
// are still waiting for, brought in with one tap. No counts of missed days, no
// red: just an offer, and "Not today" puts it away.
function CarryLine({ React: R, carry, language, dateFormat, onBring, onChoose, onHide }) {
  const h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    when = carry.date ? (dateFormat ? dateFormat(carry.date) : carry.date) : "",
    parts = [
      carry.open.length && t(`${carry.open.length} still open from ${when}`, `${digits(carry.open.length, true)} کار باز از ${when}`),
      carry.waiting.length && t(`${carry.waiting.length} still waiting`, `${digits(carry.waiting.length, true)} در انتظار`),
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

// One step and the steps inside it. Tap the circle to tick, the text to rename.
function StepItem({ React: R, step, depth, language, blockId, flow, onTick, onRename, onRemove, onAddInside }) {
  const h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    [editing, setEditing] = R.useState(false),
    [adding, setAdding] = R.useState(false),
    [ordering, setOrdering] = R.useState(false),
    ref = DDflowStepRef(blockId, step.id),
    item = flow?.items.get(ref),
    waiting = item && !step.done ? DDflowWaitingOn(flow.items, ref) : [];
  return h(
    "li",
    { className: "dd-engine-step", "data-step": step.id, "data-done": !!step.done, "data-waiting": waiting.length > 0 || undefined, style: { "--depth": depth } },
    h(
      "div",
      { className: "dd-engine-step-row" },
      h("button", {
        type: "button",
        className: "dd-engine-step-check",
        "aria-pressed": !!step.done,
        "aria-label": (step.done ? t("Mark step not done: ", "برداشتن تیک قدم: ") : t("Mark step done: ", "تیک قدم: ")) + (step.text || ""),
        onClick: () => onTick(step.id),
      }),
      editing
        ? h("input", {
            className: "dd-engine-step-input",
            defaultValue: step.text || "",
            autoFocus: true,
            dir: "auto",
            maxLength: 300,
            "aria-label": t("Step text", "متن قدم"),
            onBlur: (event) => {
              const value = event.target.value.trim();
              setEditing(false);
              if (value && value !== step.text) onRename(step.id, value);
            },
            onKeyDown: (event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") (event.currentTarget.value = step.text || ""), event.currentTarget.blur();
            },
          })
        : h("button", { type: "button", className: "dd-engine-step-text", dir: "auto", title: t("Rename", "تغییر نام"), onClick: () => setEditing(true) }, step.text || t("Untitled step", "قدم بی‌نام")),
      flow && h("button", { type: "button", className: "dd-engine-step-tool", "data-step-order": step.id, title: t("Do after another task or step", "انجام بعد از یک کار یا قدم دیگر"), "aria-label": t("Do after…: ", "انجام بعد از…: ") + (step.text || ""), "aria-expanded": ordering, onClick: () => setOrdering(!ordering) }, "⤷"),
      h("button", { type: "button", className: "dd-engine-step-tool", title: t("Add a step inside", "افزودن قدم داخل"), "aria-label": t("Add a step inside: ", "افزودن قدم داخل: ") + (step.text || ""), onClick: () => setAdding(!adding) }, "+"),
      h("button", { type: "button", className: "dd-engine-step-tool", title: t("Remove step", "حذف قدم"), "aria-label": t("Remove step: ", "حذف قدم: ") + (step.text || ""), onClick: () => onRemove(step.id) }, "×"),
    ),
    item?.after.length > 0 &&
        h(
          "span",
          { className: "dd-engine-step-after", "data-waiting": waiting.length > 0 || undefined, dir: "auto", title: t("After ", "بعد از ") + flowNames(item.after.map((r) => flow.items.get(r)).filter(Boolean), fa) },
          (waiting.length ? "↳ " : "✓ ") + t("after ", "بعد از ") + flowNames(waiting.length ? waiting : item.after.map((r) => flow.items.get(r)).filter(Boolean), fa),
        ),
    ordering && h("div", { className: "dd-engine-step-order" }, h(AfterEditor, { React: R, flow, refId: ref, language, onDone: () => setOrdering(false) })),
    (step.children?.length > 0 || adding) &&
      h(
        "ul",
        { className: "dd-engine-steps" },
        (step.children || []).map((child) => h(StepItem, { key: child.id, React: R, step: child, depth: depth + 1, language, blockId, flow, onTick, onRename, onRemove, onAddInside })),
        adding && h(AddLine, { React: R, className: "dd-engine-step-add", placeholder: t("+ Step", "+ قدم"), label: t("New step inside ", "قدم تازه داخل ") + (step.text || ""), autoFocus: true, onAdd: (text) => onAddInside(step.id, text), onDone: () => setAdding(false) }),
      ),
  );
}

// A one-line input that adds on Enter and stays ready for the next one.
function AddLine({ React: R, className, placeholder, label, autoFocus, onAdd, onDone, onEscape, id, inputRef }) {
  const h = R.createElement,
    [value, setValue] = R.useState("");
  return h(
    "form",
    {
      className: "dd-engine-add " + (className || ""),
      autoComplete: "off",
      onSubmit: (event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onAdd(value);
        setValue("");
      },
    },
    h("input", {
      id,
      ref: inputRef,
      value,
      dir: "auto",
      maxLength: 300,
      autoFocus,
      placeholder,
      "aria-label": label,
      onChange: (event) => setValue(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Escape" && (onDone || onEscape)) (event.stopPropagation(), setValue(""), (onDone || onEscape)());
      },
      onBlur: () => !value.trim() && onDone?.(),
    }),
  );
}

// A task's steps: the toggle shows how many are done and the next open one,
// so the steps are in sight without opening anything.
function StepsToggle({ React: R, block, language, flow, open, onToggle }) {
  const h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    count = DDengineStepCount(block.subtasks),
    next = DDengineNextStep(block.subtasks, (step) => flow && DDflowWaitingOn(flow.items, DDflowStepRef(block.id, step.id)).length > 0);
  return h(
    "button",
    {
      type: "button",
      className: "dd-engine-steps-toggle",
      "aria-expanded": open,
      "data-steps": count.total,
      title: open ? t("Hide steps", "پنهان کردن قدم‌ها") : t("Show steps", "نمایش قدم‌ها"),
      onClick: onToggle,
    },
    h("span", { className: "dd-engine-caret", "aria-hidden": true }, open ? "▾" : fa ? "◂" : "▸"),
    count.total ? digits(count.done, fa) + "/" + digits(count.total, fa) + " " + t("steps", "قدم") : t("+ Step", "+ قدم"),
    !open && next && h("span", { className: "dd-engine-next-step", dir: "auto" }, t("Next: ", "بعدی: ") + next.text),
  );
}

// The steps themselves, nested, each one ticked, renamed or removed in place.
function StepsTree({ React: R, block, language, flow, onChange, makeId, onClose }) {
  const h = R.createElement,
    t = words(language === "fa"),
    setSteps = (fn) => onChange((b) => ({ ...b, subtasks: fn(b.subtasks || []) })),
    newStep = (text) => ({ id: makeId(), text: String(text).trim().slice(0, 300), done: false, expanded: true, children: [] });
  return h(
    "ul",
    { className: "dd-engine-steps", "data-steps-of": block.id },
    (block.subtasks || []).map((step) =>
      h(StepItem, {
        key: step.id,
        React: R,
        step,
        depth: 0,
        language,
        blockId: block.id,
        flow,
        onTick: (id) => onChange((b) => DDtoggleSubtask(b, id)),
        onRename: (id, text) => setSteps((items) => mapSteps(items, id, (s) => ({ ...s, text }))),
        onRemove: (id) => setSteps((items) => dropStep(items, id)),
        onAddInside: (id, text) => setSteps((items) => mapSteps(items, id, (s) => ({ ...s, expanded: true, children: [...(s.children || []), newStep(text)] }))),
      }),
    ),
    h(AddLine, {
      React: R,
      className: "dd-engine-step-add",
      placeholder: t("+ Step", "+ قدم"),
      label: t("New step in ", "قدم تازه در ") + (block.name || ""),
      autoFocus: !block.subtasks?.length,
      onAdd: (text) => onChange((b) => ({ ...b, done: false, subtasks: [...(b.subtasks || []), newStep(text)] })),
      // Esc folds the steps away again; nothing is made from an empty line.
      onEscape: onClose,
    }),
  );
}

// The quiet details of one task, opened with ⋯: kind, priority, energy, time,
// section, lane, note and the actions that move it.
function Details({ React: R, block, place, lanes, sources, language, flow, onChange, actions }) {
  const h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    kind = DDmeasureOf(block),
    from = sources.find((s) => s.id === block.from),
    sourcePath = (s) => DDshortPath((s.parts || [s.name]).map((p) => p.trim() || t("Section", "سکشن")), 34),
    field = (label, ...control) => h("div", { className: "dd-engine-field" }, h("span", { className: "dd-engine-field-label" }, label), ...control),
    chips = (name, options, value, set) =>
      h(
        "span",
        { className: "dd-engine-chips", role: "group", "aria-label": name },
        options.map(([id, label, title]) => h("button", { key: id, type: "button", "aria-pressed": value === id, title: title || label, onClick: () => set(id) }, label)),
      );
  return h(
    "div",
    { className: "dd-engine-details" },
    place === "today" &&
      field(
        t("Kind", "نوع"),
        h(
          "span",
          { className: "dd-engine-kinds", role: "group", "aria-label": t("Kind", "نوع") },
          KINDS.map(([id, icon, en, f]) => h("button", { key: id, type: "button", "aria-pressed": kind === id, "aria-label": t(en, f), title: t(en, f), onClick: () => onChange((b) => DDsetMeasure(b, id)) }, icon, h("span", null, t(en, f)))),
        ),
      ),
    field(
      t("Energy", "انرژی"),
      chips(
        t("Energy", "انرژی"),
        [["", t("Any", "هر")], ["light", DDenergyLabel("light", language)], ["heavy", DDenergyLabel("heavy", language)]],
        DDenergyOf(block),
        (energy) => onChange((b) => DDsetEnergy(b, energy)),
      ),
    ),
    kind === "time" &&
      field(
        t("Time", "زمان"),
        h(
          "span",
          { className: "dd-engine-time" },
          h("button", { type: "button", "aria-label": t("Less time", "زمان کمتر"), onClick: () => onChange((b) => ({ ...b, min: Math.max(15, (Number(b.min) || 60) - 15) })) }, "−"),
          h("b", null, DDduration(Number(block.min) || 0, language)),
          h("button", { type: "button", "aria-label": t("More time", "زمان بیشتر"), onClick: () => onChange((b) => ({ ...b, min: Math.min(720, (Number(b.min) || 60) + 15) })) }, "+"),
        ),
      ),
    field(
      t("Section", "سکشن"),
      h(
        "select",
        {
          className: "dd-engine-from",
          "data-from": block.from || "",
          value: from ? block.from : "",
          "aria-label": t("Came from", "از کجا آمده") + (from ? ": " + sourcePath(from).full : ""),
          style: from?.tint ? { background: from.tint.fill, color: from.tint.ink, borderColor: from.tint.line } : undefined,
          onChange: (event) => {
            const value = event.target.value;
            onChange((b) => {
              const next = { ...b, from: value };
              if (!value) delete next.from;
              return next;
            });
          },
        },
        h("option", { value: "" }, "↖ " + t("Main board", "برد اصلی")),
        sources.map((s) => h("option", { key: s.id, value: s.id, style: s.tint ? { background: s.tint.fill, color: s.tint.ink } : undefined }, "↖ " + sourcePath(s).short)),
      ),
    ),
    flow && field(t("After", "بعد از"), h(AfterEditor, { React: R, flow, refId: DDflowTaskRef(block.id), language })),
    place === "today" &&
      lanes.length > 1 &&
      field(
        t("Lane (Board)", "لاین (برد)"),
        h(
          "select",
          {
            className: "dd-engine-lane",
            value: lanes.some((lane) => lane.id === block.lane) ? block.lane : lanes[0]?.id,
            "aria-label": t("Lane", "لاین"),
            onChange: (event) => {
              const lane = event.target.value;
              onChange((b) => ({ ...b, lane }));
            },
          },
          lanes.map((lane) => h("option", { key: lane.id, value: lane.id }, lane.name || lane.id)),
        ),
      ),
    place === "today" &&
      field(
        t("At (optional)", "ساعت (اختیاری)"),
        h("input", {
          type: "time",
          className: "dd-engine-at",
          value: block.at || "",
          "aria-label": t("Anchor time (optional)", "ساعت ثابت (اختیاری)"),
          onChange: (event) => { const at = event.target.value; onChange((b) => ({ ...b, at })); },
        }),
      ),
    // Priority, tags and links: the same editor the Board's card details use.
    h(DDTaskMetadata, { React: R, task: block, language, onChange: (patch) => onChange((b) => ({ ...b, ...patch })) }),
    h("textarea", {
      className: "dd-engine-note",
      dir: "auto",
      rows: 2,
      maxLength: 4000,
      defaultValue: block.note || "",
      placeholder: t("A note…", "یادداشت…"),
      "aria-label": t("Note", "یادداشت"),
      onKeyDown: (event) => event.stopPropagation(),
      onBlur: (event) => event.target.value !== (block.note || "") && onChange((b) => ({ ...b, note: event.target.value })),
    }),
    h(
      "div",
      { className: "dd-engine-actions" },
      actions.filter(Boolean).map(([key, label, run, extra = {}]) => h("button", { key, type: "button", className: "dd-engine-action", "data-action": key, onClick: run, ...extra }, label)),
    ),
  );
}

// One task. The name comes first; everything else is quiet until wanted.
function TaskRow(props) {
  const {
      React: R,
      block,
      place,
      next,
      focused,
      lanes,
      sources,
      language,
      stepsOpen,
      onToggleSteps,
      onChange,
      onMove,
      onRemove,
      onDuplicate,
      onTomorrow,
      onReveal,
      onFocusTimer,
      onOpenSection,
      makeId,
      flow,
      wave,
      Emoji,
    } = props,
    h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    [editing, setEditing] = R.useState(false),
    [tools, setTools] = R.useState(false),
    after = flow ? (flow.items.get(DDflowTaskRef(block.id))?.after || []).map((ref) => flow.items.get(ref)).filter(Boolean) : [],
    waiting = flow && !block.done ? DDflowWaitingOn(flow.items, DDflowTaskRef(block.id)) : [],
    kind = DDmeasureOf(block),
    today = place === "today",
    pri = Number(block.pri) || 0,
    from = sources.find((s) => s.id === block.from),
    energy = DDenergyOf(block),
    name = block.name || t("Untitled", "بی‌نام");
  return h(
    "li",
    {
      className: "dd-engine-task",
      "data-engine-task": block.id,
      // Ticking a task here gets the same small reaction as everywhere (playful.js).
      ...(place === "today" ? { "data-playful-task": block.id } : {}),
      "data-place": place,
      "data-wave": wave,
      "data-waiting-on": waiting.length ? waiting.map((item) => item.ref).join(" ") : undefined,
      "data-done": !!block.done,
      "data-kind": kind,
      "data-pri": pri || undefined,
      "data-next": next || undefined,
      "data-focus": focused || undefined,
      "data-tools": tools ? "open" : undefined,
    },
    today && (kind === "time" || kind === "count")
      ? h(
          "button",
          {
            type: "button",
            className: "dd-engine-check",
            "aria-pressed": !!block.done,
            "aria-label": (block.done ? t("Mark not done: ", "برداشتن تیک: ") : t("Mark done: ", "تیک زدن: ")) + (block.name || ""),
            onClick: () => onChange((b) => DDsetTaskDone(b, !b.done)),
          },
          block.done ? "✓" : "",
        )
      : h("span", { className: "dd-engine-kind-dot", "aria-hidden": true }, !today ? "·" : kind === "score" ? "★" : "⏳"),
    h(
      "div",
      { className: "dd-engine-main" },
      h(
        "div",
        { className: "dd-engine-line" },
        pri > 0 && h("span", { className: "dd-engine-pri", "data-pri": pri, title: DDpriorityLabel(pri, language) }, "P" + pri),
        block.emo && Emoji && h(Emoji, { emoji: block.emo, size: 16, className: "dd-engine-emo" }),
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
                if (value && value !== block.name) onChange((b) => ({ ...b, name: value }));
              },
              onKeyDown: (event) => {
                event.stopPropagation();
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") (event.currentTarget.value = block.name || ""), event.currentTarget.blur();
              },
            })
          : h("button", { type: "button", className: "dd-engine-name", dir: "auto", title: t("Rename", "تغییر نام"), onClick: () => setEditing(true) }, name),
        next && h("span", { className: "dd-engine-up-next" }, t("Up next", "قدم بعدی")),
      ),
      h(
        "div",
        { className: "dd-engine-meta" },
        today && kind !== "time" && h(DDMeasureControl, { React: R, block, language, onChange }),
        kind === "time" && Number(block.min) > 0 && h("span", { className: "dd-engine-min" }, DDmeasureText(block, language)),
        h(StepsToggle, { React: R, block, language, flow, open: stepsOpen, onToggle: onToggleSteps }),
        // What this task waits for (its own order, or a step's in another task).
        (waiting.length > 0 || after.length > 0) &&
          h(
            "span",
            { className: "dd-engine-after", "data-waiting": waiting.length > 0 || undefined, dir: "auto", title: t("After ", "بعد از ") + flowNames(waiting.length ? waiting : after, fa) },
            (waiting.length ? "↳ " + t("After ", "بعد از ") : "✓ " + t("After ", "بعد از ")) + flowNames(waiting.length ? waiting : after, fa),
          ),
        from &&
          h(
            onOpenSection ? "button" : "span",
            {
              ...(onOpenSection ? { type: "button", onClick: () => onOpenSection(block.from) } : {}),
              className: "dd-engine-tag",
              "data-from": block.from,
              dir: "auto",
              title: (onOpenSection ? t("Open section: ", "باز کردن سکشن: ") : t("Came from ", "آمده از ")) + DDshortPath(from.parts || [from.name], 60).full,
              style: from.tint ? { background: from.tint.fill, color: from.tint.ink, borderColor: from.tint.line } : undefined,
            },
            "↖ " + DDshortPath((from.parts || [from.name]).map((p) => p.trim() || t("Section", "سکشن")), 28).short,
          ),
        energy && h("span", { className: "dd-energy", "data-energy": energy }, DDenergyLabel(energy, language)),
        h(DDTaskTags, { React: R, task: block, language }),
        block.at && h("span", { className: "dd-engine-min" }, block.at),
      ),
      stepsOpen && h(StepsTree, { React: R, block, language, flow, onChange, makeId, onClose: onToggleSteps }),
      tools &&
        h(Details, {
          React: R,
          block,
          place,
          lanes,
          sources,
          language,
          flow,
          onChange,
          actions: [
            ["move", today ? t("→ Park", "→ پارک") : t("← Today", "← امروز"), () => onMove(block.id)],
            today && onTomorrow && ["tomorrow", t("Tomorrow", "فردا"), () => onTomorrow(block.id)],
            today && ["duplicate", t("Duplicate", "تکثیر"), () => onDuplicate(block.id)],
            today && onReveal && ["reveal", t("◎ Show on the board", "◎ نشان دادن روی برد"), () => onReveal(block.id)],
            today && onFocusTimer && !block.done && ["focus", t("Focus", "تمرکز"), () => onFocusTimer(block)],
            ["remove", t("Delete", "حذف"), () => onRemove(block.id), { "data-quiet": true }],
          ],
        }),
    ),
    h(
      "div",
      { className: "dd-engine-side" },
      h(
        "button",
        {
          type: "button",
          className: "dd-engine-move",
          title: today ? t("Park it: not for today", "پارکش کن: برای امروز نیست") : t("Bring to today", "بیار به امروز"),
          "aria-label": (today ? t("Park: ", "پارک: ") : t("Bring to today: ", "آوردن به امروز: ")) + (block.name || ""),
          onClick: () => onMove(block.id),
        },
        today ? (fa ? "←" : "→") : fa ? "→" : "←",
      ),
      h(
        "button",
        {
          type: "button",
          className: "dd-engine-more",
          "aria-expanded": tools,
          "aria-label": t("More for: ", "بیشتر برای: ") + (block.name || ""),
          title: t("Kind, priority, section and more", "نوع، اولویت، سکشن و بیشتر"),
          onClick: () => setTools(!tools),
        },
        "⋯",
      ),
    ),
  );
}

export function DDEnginePanel(props) {
  const {
      React: R,
      mode = "page",
      day,
      today = day?.date,
      days,
      setup = {},
      language,
      dateLabel,
      dateFormat = dateLabel,
      makeId = () => crypto.randomUUID(),
      parseTask,
      sources = [],
      from = "",
      focusId,
      onChange,
      onSetup,
      onTomorrow,
      onReveal,
      onFocusTimer,
      onOpenSection,
      onClose,
      quickRef,
      findRef,
      Emoji,
    } = props,
    h = R.createElement,
    fa = language === "fa",
    t = words(fa),
    lanes = setup.lanes || [],
    page = mode === "page",
    [show, setShowState] = R.useState(() => remembered("debug-day:engine-show", "all")),
    [query, setQuery] = R.useState(""),
    [opened, setOpened] = R.useState(() => new Set(remembered("debug-day:engine-steps", []))),
    [earlierOpen, setEarlierOpen] = R.useState(false),
    [carryHidden, setCarryHidden] = R.useState(() => DDengineCarryHidden(day.date)),
    panel = R.useRef(null);
  DDinstallEnginePanelStyles();
  R.useEffect(() => {
    if (!focusId) return;
    const row = panel.current?.querySelector?.(`[data-engine-task="${CSS.escape(focusId)}"]`);
    row?.scrollIntoView?.({ block: "center" });
  }, [focusId]);
  const setShow = (value) => (setShowState(value), remember("debug-day:engine-show", value)),
    toggleSteps = (id) =>
      setOpened((old) => {
        const next = new Set(old);
        next.has(id) ? next.delete(id) : next.add(id);
        remember("debug-day:engine-steps", [...next].slice(-200));
        return next;
      }),
    blocks = day.blocks || [],
    parked = DDengineParked(setup),
    progress = DDcompletion(day),
    left = blocks.filter((b) => !b.done).reduce((sum, b) => sum + DDplanMinutes(b), 0),
    carry = days && day.date === today ? DDengineCarry(days, day) : null,
    shown = (list) => DDengineOrder(list.filter((b) => DDengineShows(b, show, query))),
    todayList = shown(blocks),
    parkList = shown(parked),
    // Order between today's tasks and steps (flow.js), changed for the whole day.
    flow = {
      items: DDflowItems(day),
      add: (ref, before) => onChange((d) => DDflowAdd(d, ref, before)),
      remove: (ref, before) => onChange((d) => DDflowRemove(d, ref, before)),
    },
    waitsNow = (b) => DDflowWaitingOn(flow.items, DDflowTaskRef(b.id)).length > 0,
    upNext = DDengineOrder(blocks).find((b) => !b.done && DDmeasureOf(b) !== "wait" && !waitsNow(b)),
    // With an order in the day, Today reads in waves: now, then, after that.
    waves = show === "done" ? [] : DDflowWaves(day, blocks),
    // A change to one task of the day, or to one parked task.
    changeToday = (id) => (fn) => onChange((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? fn(b) : b)) })),
    changePark = (id) => (fn) => onSetup((s) => ({ ...s, later: DDengineParked(s).map((b) => (b.id === id ? fn(b) : b)) })),
    newTask = (text, list, lane) =>
      (parseTask && parseTask(text, { blocks: list })) ||
      DDengineTask(text, lane, setup, makeId(), from),
    addToday = (text) => {
      const task = newTask(text, blocks, lanes[0]?.id || "");
      if (!task) return;
      if (from && !task.from) task.from = from;
      if (!lanes.some((lane) => lane.id === task.lane)) task.lane = lanes[0]?.id || "";
      onChange((d) => ({ ...d, blocks: [...d.blocks, task] }));
      if (show === "done") setShow("all");
    },
    addPark = (text) => {
      const task = newTask(text, parked, "");
      if (task) onSetup((s) => ({ ...s, later: [...DDengineParked(s), task] }));
    },
    // Today -> Park and back is the same task changing place: added where it
    // goes first, then taken from where it was, so nothing is lost on the way.
    park = (id) => {
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      const parkedCopy = structuredClone(block);
      parkedCopy.parkedLane = block.lane || "";
      delete parkedCopy.bx;
      delete parkedCopy.by;
      onSetup((s) => ({ ...s, later: [...DDengineParked(s).filter((b) => b.id !== id), parkedCopy] }));
      onChange((d) => {
        const next = structuredClone(d);
        next.blocks = next.blocks.filter((b) => b.id !== id);
        DDcleanBoard(next, ["b:" + id, ...stepRefs(block.subtasks, id)]);
        return next;
      });
    },
    unpark = (id) => {
      const block = parked.find((b) => b.id === id);
      if (!block) return;
      const task = structuredClone(block);
      task.lane = DDengineLaneFor(block, lanes);
      delete task.parkedLane;
      if (blocks.some((b) => b.id === task.id)) task.id = makeId();
      onChange((d) => ({ ...d, blocks: [...d.blocks, task] }));
      onSetup((s) => ({ ...s, later: DDengineParked(s).filter((b) => b.id !== id) }));
    },
    removeToday = (id) =>
      onChange((d) => {
        const block = d.blocks.find((b) => b.id === id),
          next = structuredClone(d);
        next.blocks = next.blocks.filter((b) => b.id !== id);
        if (block) DDcleanBoard(next, ["b:" + id, ...stepRefs(block.subtasks, id)]);
        return next;
      }),
    duplicate = (id) =>
      onChange((d) => {
        const index = d.blocks.findIndex((b) => b.id === id);
        if (index < 0) return d;
        const copy = DDengineCopy(d.blocks[index], makeId);
        return { ...d, blocks: [...d.blocks.slice(0, index + 1), copy, ...d.blocks.slice(index + 1)] };
      }),
    row = (block, place, wave) =>
      h(TaskRow, {
        key: block.id,
        React: R,
        block,
        place,
        wave,
        next: place === "today" && block === upNext,
        focused: block.id === focusId,
        lanes,
        Emoji,
        sources,
        language,
        makeId,
        stepsOpen: opened.has(block.id),
        onToggleSteps: () => toggleSteps(block.id),
        onChange: place === "today" ? changeToday(block.id) : changePark(block.id),
        onMove: place === "today" ? park : unpark,
        onRemove: place === "today" ? removeToday : (id) => onSetup((s) => ({ ...s, later: DDengineParked(s).filter((b) => b.id !== id) })),
        onDuplicate: duplicate,
        onTomorrow,
        onReveal,
        onFocusTimer,
        onOpenSection,
        flow: place === "today" ? flow : null,
      }),
    // One list, so a task keeps its open details when its wave changes; each
    // wave starts with a small heading and its tasks carry the wave's rail.
    todayRows = () => {
      if (waves.length < 2) return h("ul", { className: "dd-engine-list" }, todayList.map((block) => row(block, "today")));
      const visible = new Set(todayList.map((b) => b.id)),
        names = [t("Now", "اکنون"), t("Next", "بعدی"), t("After that", "بعد از آن"), t("Later", "بعدتر")],
        items = [];
      waves.forEach((wave, index) => {
        const list = DDengineOrder(wave.filter((b) => visible.has(b.id)));
        if (!list.length) return;
        const name = names[Math.min(index, 3)];
        items.push(
          h(
            "li",
            { key: "wave-" + index, className: "dd-engine-wave-head", "data-wave-head": index, role: "presentation" },
            h("b", null, name),
            list.length > 1 && h("span", { className: "dd-engine-wave-side", title: t("These can go side by side", "این‌ها می‌توانند هم‌زمان پیش بروند") }, "⇉ " + digits(list.length, fa) + t(" side by side", " هم‌زمان")),
            index > 0 && list.length === 1 && h("span", { className: "dd-engine-wave-side" }, t("one after another", "پشت سر هم")),
          ),
          ...list.map((block) => row(block, "today", index)),
        );
      });
      const done = todayList.filter((b) => b.done);
      if (done.length) items.push(h("li", { key: "wave-done", className: "dd-engine-wave-head", "data-wave-head": "done", role: "presentation" }, h("b", null, t("Done", "انجام‌شده"))), ...done.map((block) => row(block, "today")));
      return h("ul", { className: "dd-engine-list dd-engine-flow" }, items);
    },
    emptyLine = (list, all, text) =>
      !list.length && h("p", { className: "dd-engine-empty" }, all.length ? t("Nothing here with this filter.", "با این فیلتر چیزی نیست.") : text),
    dayName = DDengineDayName(day.date, today, language);
  return h(
    "section",
    {
      className: "dd-engine",
      "data-mode": mode,
      ...(page ? { id: "plan", "data-section-id": "plan" } : { role: "dialog", "aria-modal": "true", tabIndex: -1 }),
      "aria-label": t("Engine", "انجین"),
      "data-panel": "engine",
      dir: fa ? "rtl" : "ltr",
      ref: panel,
    },
    h(
      "header",
      { className: "dd-engine-head" },
      h("span", { className: "dd-engine-icon", "aria-hidden": true }, "⚙️"),
      h("div", { className: "dd-engine-title" }, h("strong", null, t("Engine", "انجین")), dateLabel && h("small", null, typeof dateLabel === "function" ? dateLabel(day.date) : dateLabel)),
      h(
        "div",
        { className: "dd-engine-progress", "data-completion": progress.percent, title: t("Done, weighted by priority", "انجام‌شده، با وزن اولویت") },
        h("span", { className: "dd-engine-bar" }, h("i", { style: { width: progress.percent + "%" } })),
        h("b", null, digits(progress.done, fa) + "/" + digits(progress.total, fa)),
        left > 0 && h("small", null, DDduration(left, language) + t(" left", " مانده")),
      ),
      days && h("button", { type: "button", className: "dd-engine-earlier-toggle", "aria-expanded": earlierOpen, onClick: () => setEarlierOpen(!earlierOpen) }, t("Earlier Engine", "انجین روزهای قبل")),
      onClose && h("button", { type: "button", className: "dd-engine-close", onClick: onClose, "aria-label": t("Close Engine", "بستن انجین") }, h("kbd", null, "E"), " ", t("Close", "بستن")),
    ),
    h(
      "div",
      { className: "dd-engine-tools" },
      h(
        "label",
        { className: "dd-engine-find" },
        h("span", { "aria-hidden": true }, "⌕"),
        h("input", {
          ...(page ? { id: "q" } : {}),
          ref: findRef,
          type: "search",
          dir: "auto",
          value: query,
          placeholder: t("Find a task or step", "پیدا کردن کار یا قدم"),
          "aria-label": t("Find a task", "پیدا کردن کار"),
          onChange: (event) => setQuery(event.target.value),
          onKeyDown: (event) => event.key === "Escape" && query && (event.stopPropagation(), setQuery("")),
        }),
      ),
      h(
        "div",
        { className: "dd-engine-show", role: "group", "aria-label": t("Show", "نمایش") },
        [
          ["all", t("All", "همه")],
          ["left", t("Left", "مانده")],
          ["done", t("Done", "انجام‌شده")],
        ].map(([id, label]) => h("button", { key: id, type: "button", "aria-pressed": show === id, "data-show": id, onClick: () => setShow(id) }, label)),
      ),
      h(AddLine, {
        React: R,
        className: "dd-engine-quick",
        id: page ? "qa" : undefined,
        inputRef: quickRef,
        placeholder: t("Add a task: Portfolio > Sketch 90m p1", "افزودن کار: پورتفولیو > اسکچ ۹۰m p1"),
        label: t("Quick add", "افزودن سریع"),
        onAdd: addToday,
      }),
    ),
    carry && carry.count > 0 && !carryHidden && !earlierOpen &&
      h(CarryLine, {
        React: R,
        carry,
        language,
        dateFormat,
        onBring: () => onChange((d) => ({ ...d, blocks: [...d.blocks, ...[...carry.open, ...carry.waiting].map((b) => DDengineCopy(b, makeId))] })),
        onChoose: () => setEarlierOpen(true),
        onHide: () => (DDhideEngineCarry(day.date), setCarryHidden(true)),
      }),
    earlierOpen &&
      h(EarlierEngine, {
        React: R,
        days,
        day,
        language,
        dateFormat,
        onCopy: (list) => onChange((d) => ({ ...d, blocks: [...d.blocks, ...list.map((b) => DDengineCopy(b, makeId))] })),
      }),
    day.date >= today &&
      h(DDPlanNudges, {
        React: R,
        day,
        days,
        date: day.date,
        today,
        language,
        makeId,
        without: ["carry"],
        dateLabel: dateFormat,
        onUpdateDay: onChange,
        onMove: onTomorrow,
      }),
    h(
      "div",
      { className: "dd-engine-cols" },
      h(
        "section",
        { className: "dd-engine-col", "data-col": "today", "aria-label": t("Today", "امروز") },
        h(
          "h3",
          null,
          h("span", null, day.date === today ? t("Today", "امروز") : t("Day", "روز"), h("em", null, " · " + dayName)),
          h("small", null, digits(blocks.filter((b) => b.done).length, fa) + "/" + digits(blocks.length, fa)),
        ),
        todayRows(),
        emptyLine(todayList, blocks, t("Nothing planned yet. Add a task, or bring one from Park.", "هنوز کاری نیست. یک کار اضافه کن یا از پارک بیار.")),
        h(AddLine, { React: R, placeholder: t("+ New task", "+ کار تازه"), label: t("New task today", "کار تازه برای امروز"), onAdd: addToday }),
      ),
      h(
        "section",
        { className: "dd-engine-col", "data-col": "park", "aria-label": t("Park", "پارک") },
        h(
          "h3",
          null,
          h("span", null, t("Park", "پارک")),
          h("small", null, digits(parked.length, fa)),
        ),
        h("p", { className: "dd-engine-col-hint" }, t("Not for today. Stays here from day to day.", "برای امروز نیست. از روزی به روز دیگر همین‌جا می‌ماند.")),
        h("ul", { className: "dd-engine-list" }, parkList.map((block) => row(block, "park"))),
        emptyLine(parkList, parked, t("Park is empty.", "پارک خالی است.")),
        h(AddLine, { React: R, placeholder: t("+ Park a task", "+ پارک کردن کار"), label: t("New parked task", "کار تازه در پارک"), onAdd: addPark }),
      ),
    ),
    !page &&
      h("footer", { className: "dd-engine-foot" }, t("Same tasks as the Board and its Lanes. → parks a task; ← brings it back.", "همان کارهای برد و لاین‌ها. → کار را پارک می‌کند و ← برمی‌گرداند.")),
  );
}

// The Engine brought over the board: the board stays behind it, dimmed.
// E, Esc, the close button or a click on the dimmed board closes it.
export function DDEngineOverlay(props) {
  const { React: R, onClose } = props,
    h = R.createElement,
    holder = R.useRef(null);
  R.useEffect(() => {
    const previous = document.activeElement;
    holder.current?.querySelector?.(".dd-engine")?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  return h(
    "div",
    {
      className: "dd-engine-backdrop",
      ref: holder,
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
    h(DDEnginePanel, { ...props, mode: "overlay" }),
  );
}

export const DDenginePanelCSS = `
.dd-engine-backdrop{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(18,18,17,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);animation:dd-engine-in .14s ease-out}
.b2-board-focus .dd-engine-backdrop,.b4-focus .dd-engine-backdrop{position:fixed}
@keyframes dd-engine-in{from{opacity:0}to{opacity:1}}
.dd-engine{display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#121211);outline:none;min-width:0}
.dd-engine[data-mode=overlay]{width:min(1120px,100%);max-height:min(86vh,100%);border-radius:16px;box-shadow:0 24px 60px #0006,0 0 0 1px var(--rule-2,#0002);overflow:hidden}
.dd-engine[data-mode=page]{border-radius:16px;box-shadow:0 0 0 1px var(--rule,#0001)}
.dd-engine:focus,.dd-engine:focus-visible,.b6 .dd-engine:focus-visible{outline:none}
.dd-engine-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--rule-2,#0001);flex-wrap:wrap}
.dd-engine-icon{font-size:20px}
.dd-engine-title{display:flex;flex-direction:column;gap:2px;min-width:0}
.dd-engine-title strong{font-size:16px}
.dd-engine-title small{font-size:12px;color:var(--ink-3,#666)}
.dd-engine-progress{display:flex;align-items:center;gap:8px;margin-inline-start:auto;font:500 12px/1 var(--mono,monospace)}
.dd-engine-progress small{font:inherit;color:var(--ink-3,#666)}
.dd-engine-bar{width:120px;height:6px;border-radius:9px;background:var(--wash,#eee);overflow:hidden}
.dd-engine-bar i{display:block;height:100%;background:var(--panel-engine,#F05A28);border-radius:inherit;transition:width .2s}
.dd-engine-close{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;background:var(--wash,#eee);color:var(--ink,#121211);font-size:12px}
.dd-engine-close kbd{font:600 11px/1 var(--mono,monospace);padding:2px 5px;border-radius:4px;background:var(--paper,#fff);box-shadow:0 1px 0 var(--rule-2,#0002)}
.dd-engine-earlier-toggle{padding:6px 10px;border-radius:8px;background:none;color:var(--ink-2,#444);font-size:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-earlier-toggle[aria-expanded=true]{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 18px 0}
.dd-engine-find{display:flex;align-items:center;gap:6px;flex:1 1 180px;min-width:0;height:32px;padding:0 10px;border-radius:9px;background:var(--wash,#f1efe9);color:var(--ink-3,#666)}
.dd-engine-find input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink,#121211);outline:none}
.dd-engine-show{display:inline-flex;gap:2px;padding:2px;border-radius:9px;background:var(--wash,#f1efe9)}
.dd-engine-show button{height:28px;padding:0 10px;border-radius:7px;background:none;color:var(--ink-2,#444);font-size:12px}
.dd-engine-show button[aria-pressed=true]{background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 1px 2px #0002}
.dd-engine-quick{flex:2 1 260px;min-width:0}
.dd-engine-quick input{height:32px}
.dd-engine-cols{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px;padding:14px 18px 18px;overflow:auto;align-items:start}
.dd-engine-col{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px;border-radius:12px;background:var(--wash,#f6f5f2);box-shadow:inset 0 0 0 1px var(--rule-2,#0001)}
.dd-engine-col[data-col=park]{background:transparent;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-col h3{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0;font-size:14px;text-transform:none}
.dd-engine-col h3 em{font-style:normal;font-weight:500;color:var(--ink-3,#666)}
.dd-engine-col h3 small{font:500 11px/1 var(--mono,monospace);color:var(--ink-3,#666)}
.dd-engine-col-hint{margin:-4px 0 2px;font-size:12px;color:var(--ink-3,#666)}
.dd-engine-empty{margin:4px 2px;font-size:12px;color:var(--ink-3,#666)}
.dd-engine-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dd-engine-task{position:relative;display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:10px;background:var(--paper,#fff);box-shadow:0 1px 2px #0001}
.dd-engine-task[data-place=park]{box-shadow:inset 0 0 0 1px var(--rule-2,#0001)}
.dd-engine-task[data-next]{box-shadow:0 1px 2px #0001,inset 3px 0 0 var(--now,var(--panel-engine,#F05A28))}
[dir=rtl] .dd-engine-task[data-next]{box-shadow:0 1px 2px #0001,inset -3px 0 0 var(--now,var(--panel-engine,#F05A28))}
.dd-engine-task[data-focus]{outline:2px solid var(--panel-engine,#F05A28);outline-offset:1px}
.dd-engine-task[data-done=true] .dd-engine-name{text-decoration:line-through;opacity:.55}
.dd-engine-check{flex:none;width:22px;height:22px;border-radius:6px;border:1.6px solid var(--ink-3,#888);display:grid;place-items:center;font-size:13px;color:#fff;background:none}
.dd-engine-check[aria-pressed=true]{background:var(--panel-engine,#F05A28);border-color:var(--panel-engine,#F05A28)}
.dd-engine-kind-dot{flex:none;width:22px;height:22px;display:grid;place-items:center;font-size:13px;color:var(--ink-3,#666)}
.dd-engine-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.dd-engine-line{display:flex;align-items:baseline;gap:6px;min-width:0}
.dd-engine-name{all:unset;cursor:text;font-size:14px;line-height:1.35;overflow-wrap:anywhere;min-width:0}
.dd-engine-name:focus-visible{outline:2px solid var(--panel-engine,#F05A28);outline-offset:2px;border-radius:3px}
.dd-engine-name-input,.dd-engine-step-input{font:inherit;font-size:14px;padding:3px 6px;border-radius:6px;border:1px solid var(--rule-2,#ccc);background:var(--wash,#fff);color:var(--ink,#121211);width:100%;box-sizing:border-box}
.dd-engine-pri{flex:none;padding:0 5px;border-radius:5px;font:600 10.5px/1.6 var(--mono,monospace);color:var(--ink,#121211);box-shadow:inset 0 0 0 1px var(--ink-3,#888)}
.dd-engine-pri[data-pri="1"]{background:var(--ink,#121211);color:var(--paper,#fff);box-shadow:none}
.dd-engine-pri[data-pri="3"]{color:var(--ink-3,#666);box-shadow:inset 0 0 0 1px var(--rule-2,#ccc)}
.dd-engine-up-next{flex:none;margin-inline-start:auto;font-size:11px;color:color-mix(in srgb,var(--now,var(--panel-engine,#F05A28)) 80%,var(--ink,#121211))}
.dd-engine-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--ink-3,#666);min-width:0}
.dd-engine-meta .step{min-height:24px;border:0;padding:0;background:none;color:var(--ink-2,#444);font-family:inherit}
.dd-engine-meta .step span{font-family:inherit;letter-spacing:0}
.dd-engine-steps-toggle{display:inline-flex;align-items:center;gap:5px;max-width:100%;min-width:0;padding:2px 6px;border-radius:6px;background:none;color:var(--ink-2,#444);font-size:12px}
.dd-engine-steps-toggle:hover{background:var(--wash,#eee)}
.dd-engine-steps-toggle[data-steps="0"]:not([aria-expanded=true]){opacity:0}
.dd-engine-task:hover .dd-engine-steps-toggle[data-steps="0"],.dd-engine-task:focus-within .dd-engine-steps-toggle[data-steps="0"],.dd-engine-steps-toggle:focus-visible{opacity:1}
.dd-engine-caret{font-size:10px;color:var(--ink-3,#666)}
.dd-engine-next-step{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-3,#666)}
.dd-engine-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;width:100%}
.dd-engine-steps .dd-engine-steps{padding-inline-start:18px;border-inline-start:1px dashed var(--rule-2,#ccc);margin-inline-start:10px}
.dd-engine-step-row{display:flex;align-items:center;gap:6px;min-height:28px;padding:0 4px;border-radius:7px}
.dd-engine-step-row:hover{background:var(--wash,#f1efe9)}
.dd-engine-step-check{flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--ink-3,#888);background:none;padding:0}
.dd-engine-step[data-done=true]>.dd-engine-step-row .dd-engine-step-check{background:var(--ok,#2E8B3A);border-color:var(--ok,#2E8B3A)}
.dd-engine-step[data-done=true]>.dd-engine-step-row .dd-engine-step-text{text-decoration:line-through;opacity:.55}
.dd-engine-step-text{all:unset;cursor:text;flex:1;min-width:0;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
.dd-engine-step-tool{flex:none;width:22px;height:22px;border-radius:6px;background:none;color:var(--ink-3,#666);opacity:0}
.dd-engine-step-row:hover .dd-engine-step-tool,.dd-engine-step-tool:focus-visible{opacity:1}
.dd-engine-step-add input{font-size:12.5px;padding:5px 8px}
.dd-engine-tag{flex:none;max-width:min(240px,70%);padding:1px 8px;border:1px solid;border-radius:999px;font:inherit;font-size:11px;font-weight:500;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:none}
button.dd-engine-tag{cursor:pointer}
.dd-engine-after,.dd-engine-step-after{flex:none;max-width:min(260px,80%);padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink-3,#666);background:var(--wash,#f1efe9)}
.dd-engine-after[data-waiting],.dd-engine-step-after[data-waiting]{color:color-mix(in srgb,var(--panel-engine,#F05A28) 80%,var(--ink,#121211));background:color-mix(in srgb,var(--panel-engine,#F05A28) 10%,transparent)}
.dd-engine-step-after{display:inline-block;max-width:calc(100% - 26px);margin:0 0 2px;margin-inline-start:26px}
.dd-engine-task[data-waiting-on] .dd-engine-check{border-style:dashed;opacity:.7}
.dd-engine-step[data-waiting=true]>.dd-engine-step-row .dd-engine-step-check{border-style:dashed}
.dd-engine-after-edit{display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-width:0}
.dd-engine-after-chip{display:inline-flex;align-items:center;gap:2px;max-width:100%;padding:1px 3px 1px 9px;border-radius:999px;font-size:12px;background:color-mix(in srgb,var(--panel-engine,#F05A28) 10%,var(--paper,#fff));color:var(--ink,#121211);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--panel-engine,#F05A28) 25%,transparent)}
.dd-engine-after-chip[data-done]{opacity:.6}
.dd-engine-after-chip button{width:20px;height:20px;border-radius:50%;background:none;color:var(--ink-3,#666);font-size:13px;line-height:1}
.dd-engine-after-chip button:hover{background:var(--wash,#eee)}
.dd-engine-after-pick{max-width:220px;font:inherit;font-size:12px;padding:3px 8px;border-radius:999px;border:1px dashed var(--rule-2,#0003);background:transparent;color:var(--ink-2,#444)}
.dd-engine-step-order{padding:2px 0 4px calc(22px + var(--depth,0) * 0px)}
.dd-engine-flow>.dd-engine-task[data-wave]{margin-inline-start:14px}
.dd-engine-flow>.dd-engine-task[data-wave]::before{content:"";position:absolute;inset-inline-start:-10px;top:-6px;bottom:-6px;border-inline-start:2px solid color-mix(in srgb,var(--panel-engine,#F05A28) 28%,transparent)}
.dd-engine-wave-head{position:relative;display:flex;align-items:baseline;gap:8px;margin:8px 0 0;padding-inline-start:14px;font-size:12px;font-weight:500;color:var(--ink-2,#444)}
.dd-engine-wave-head:first-child{margin-top:0}
.dd-engine-wave-head::before{content:"";position:absolute;inset-inline-start:0;top:4px;width:10px;height:10px;border-radius:50%;background:color-mix(in srgb,var(--panel-engine,#F05A28) 55%,var(--paper,#fff))}
.dd-engine-wave-head[data-wave-head=done]::before{background:var(--ok,#2E8B3A);opacity:.5}
.dd-engine-wave-head b{font-weight:600;color:var(--ink,#121211)}
.dd-engine-wave-side{font-size:11px;color:var(--ink-3,#666)}
.dd-engine-emo{flex:none;align-self:center}
.dd-engine-meta .dd-task-tags{display:inline-flex;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--ink-3,#666)}
.dd-engine-side{display:flex;align-items:center;gap:2px;flex:none}
.dd-engine-move,.dd-engine-more{flex:none;width:26px;height:24px;border-radius:6px;background:none;color:var(--ink-3,#666);font-size:15px;line-height:1;opacity:0}
.dd-engine-task:hover .dd-engine-move,.dd-engine-task:hover .dd-engine-more,.dd-engine-move:focus-visible,.dd-engine-more:focus-visible,.dd-engine-more[aria-expanded=true],.dd-engine-task[data-tools=open] .dd-engine-move{opacity:1}
.dd-engine-move:hover,.dd-engine-more:hover,.dd-engine-more[aria-expanded=true]{background:var(--wash,#eee);color:var(--ink,#121211)}
@media (hover:none){.dd-engine-move,.dd-engine-more{opacity:1;width:34px;height:34px}.dd-engine-steps-toggle[data-steps="0"]:not([aria-expanded=true]){opacity:1}.dd-engine-step-tool{opacity:1;width:30px;height:30px}}
.dd-engine-details{display:flex;flex-direction:column;gap:8px;margin-top:2px;padding:10px;border-radius:9px;background:var(--wash,#f1efe9)}
.dd-engine-field{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.dd-engine-field-label{min-width:84px;color:var(--ink-3,#666)}
.dd-engine-kinds,.dd-engine-chips{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border-radius:7px;background:var(--paper,#fff)}
.dd-engine-kinds button,.dd-engine-chips button{min-height:24px;padding:0 8px;border-radius:5px;font-size:12px;color:var(--ink-2,#444);background:none;display:inline-flex;align-items:center;gap:4px}
.dd-engine-kinds button[aria-pressed=true],.dd-engine-chips button[aria-pressed=true]{background:var(--ink,#121211);color:var(--paper,#fff)}
.dd-engine-time{display:inline-flex;align-items:center;gap:6px}
.dd-engine-time button{width:26px;height:24px;border-radius:6px;background:var(--paper,#fff);color:var(--ink,#121211)}
.dd-engine-time b{min-width:52px;text-align:center;font:500 12px/1 var(--mono,monospace)}
.dd-engine-from,.dd-engine-lane,.dd-engine-type,.dd-engine-at{max-width:240px;font:inherit;font-size:12px;padding:3px 8px;border-radius:999px;border:1px solid var(--rule-2,#0002);background:var(--paper,#fff);color:var(--ink,#121211);text-overflow:ellipsis}
.dd-engine-note{font:inherit;font-size:13px;padding:6px 8px;border-radius:7px;border:1px solid var(--rule-2,#0002);background:var(--paper,#fff);color:var(--ink,#121211);resize:vertical;min-height:38px}
.dd-engine-details .dd-task-metadata{display:flex;flex-direction:column;flex:none;gap:6px;font-size:12px}
.dd-engine-actions{display:flex;flex-wrap:wrap;gap:6px}
.dd-engine-action{min-height:28px;padding:0 10px;border-radius:7px;background:var(--paper,#fff);color:var(--ink,#121211);font-size:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-action[data-quiet]{margin-inline-start:auto;background:none;color:var(--ink-3,#666);box-shadow:none}
.dd-engine-add input{width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:7px 9px;border-radius:8px;border:1px dashed var(--rule-2,#bbb);background:transparent;color:var(--ink,#121211)}
.dd-engine-add input:focus{border-style:solid;outline:none;border-color:var(--panel-engine,#F05A28)}
.dd-engine-quick input{border-style:solid;background:var(--paper,#fff)}
.dd-engine .dd-nudges{margin:12px 18px 0}
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
.dd-engine-copy{padding:3px 8px;border-radius:6px;background:var(--wash,#eee);color:var(--ink,#121211);font-size:12px;white-space:nowrap}
.dd-engine-here{font-size:11px;color:var(--ink-3,#666);white-space:nowrap}
.dd-engine-carry{display:flex;align-items:center;gap:10px;margin:12px 18px 0;padding:8px 8px 8px 12px;border-radius:12px;background:color-mix(in srgb,var(--panel-engine,#F05A28) 7%,var(--wash,#f1efe9));flex:none;min-width:0}
.dd-engine-carry-icon{font-size:16px;color:color-mix(in srgb,var(--panel-engine,#F05A28) 75%,var(--ink,#121211))}
.dd-engine-carry-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dd-engine-carry-text b{font-size:13px;font-weight:600}
.dd-engine-carry-text small{font-size:12px;color:var(--ink-2,#555);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-engine-carry-all{flex:none;padding:6px 12px;border-radius:8px;background:var(--panel-engine,#F05A28);color:#fff;font-size:12px;font-weight:600}
.dd-engine-carry-pick{flex:none;padding:6px 10px;border-radius:8px;background:var(--paper,#fff);color:var(--ink,#121211);font-size:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-carry-hide{flex:none;width:28px;height:28px;border-radius:8px;background:none;color:var(--ink-3,#666);font-size:16px;line-height:1}
.dd-engine-carry-hide:hover{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-foot{padding:10px 18px;font-size:12px;color:var(--ink-3,#666);border-top:1px solid var(--rule-2,#0001)}
@media (max-width:760px){.dd-engine-cols{grid-template-columns:1fr;padding:12px}.dd-engine-tools{padding:10px 12px 0}.dd-engine-head{padding:12px}.dd-engine-carry{flex-wrap:wrap;margin:10px 12px 0}.dd-engine-carry-text{flex-basis:calc(100% - 40px)}.dd-engine-carry-all,.dd-engine-carry-pick{min-height:36px}.dd-engine-backdrop{padding:10px;align-items:stretch}.dd-engine[data-mode=overlay]{max-height:none}.dd-engine-bar{width:64px}.dd-engine-check{min-width:28px;min-height:28px}.dd-engine .dd-nudges{margin:10px 12px 0}.dd-engine-steps .dd-engine-steps{padding-inline-start:10px;margin-inline-start:6px}.dd-engine-task{display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:8px;row-gap:6px;align-items:start}.dd-engine-main{display:contents}.dd-engine-line{grid-row:1;grid-column:2}.dd-engine-side{grid-row:1;grid-column:3}.dd-engine-main>.dd-engine-meta{grid-column:2/-1}.dd-engine-main>.dd-engine-steps,.dd-engine-main>.dd-engine-details{grid-column:1/-1}}
@media (prefers-reduced-motion:reduce){.dd-engine-backdrop{animation:none}}
`;

export function DDinstallEnginePanelStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-panel-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-panel-css", textContent: DDenginePanelCSS }));
}
