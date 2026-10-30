// The Engine: today's tasks, each tied to one lane, ticked, scored or waited on.
// It is not a copy: it reads and writes day.blocks, the same data Plan, Lanes
// and the Board show, so a change here is the same change everywhere.
import { DDcompletion } from "./planner.js";

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
export function DDengineTask(name, lane, setup = {}, id = crypto.randomUUID()) {
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
  };
}

const KINDS = [
  ["time", "✓", "Tick", "تیکی"],
  ["score", "★", "Score", "نمره‌ای"],
  ["wait", "⏳", "Waiting", "ویتینگ"],
];

function EngineRow({ React: R, block, lanes, language, measure, setDone, change, onReveal }) {
  const fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    h = R.createElement,
    [editing, setEditing] = R.useState(false),
    kind = measure.DDmeasureOf(block),
    update = (fn) => change((day) => ({ ...day, blocks: day.blocks.map((b) => (b.id === block.id ? fn(b) : b)) }));
  return h(
    "li",
    { className: "dd-engine-task", "data-done": !!block.done, "data-kind": kind, "data-engine-task": block.id },
    kind === "time" || kind === "count"
      ? h(
          "button",
          {
            type: "button",
            className: "dd-engine-check",
            "aria-pressed": !!block.done,
            "aria-label": (block.done ? t("Mark not done: ", "برداشتن تیک: ") : t("Mark done: ", "تیک زدن: ")) + (block.name || ""),
            onClick: () => update((b) => setDone(b, !b.done)),
          },
          block.done ? "✓" : "",
        )
      : h("span", { className: "dd-engine-kind-dot", "aria-hidden": true }, kind === "score" ? "★" : "⏳"),
    h(
      "div",
      { className: "dd-engine-main" },
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
      h(
        "div",
        { className: "dd-engine-meta" },
        kind !== "time" &&
          h(measure.DDMeasureControl, { React: R, block, language, onChange: update }),
        kind === "time" && Number(block.min) > 0 && h("span", { className: "dd-engine-min" }, measure.DDmeasureText(block, language)),
        h(
          "span",
          { className: "dd-engine-kinds", role: "group", "aria-label": t("Kind", "نوع") },
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
        h(
          "select",
          {
            className: "dd-engine-lane",
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
        onReveal &&
          h(
            "button",
            {
              type: "button",
              className: "dd-engine-reveal",
              title: t("Show on the board", "نشان دادن روی برد"),
              "aria-label": t("Show on the board: ", "نشان دادن روی برد: ") + (block.name || ""),
              onClick: () => onReveal(block.id),
            },
            "◎",
          ),
      ),
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
  onChange,
  onAdd,
  onReveal,
  onClose,
}) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    lanes = setup?.lanes || [],
    groups = DDengineGroups(day, lanes),
    progress = DDcompletion(day, lanes.map((lane) => lane.id)),
    panel = R.useRef(null);
  R.useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);
  // The empty lanes still show, so a task can be added straight into them.
  const shown = groups.length ? groups : lanes.map((lane) => ({ lane, blocks: [] }));
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
        h(
          "button",
          { type: "button", className: "dd-engine-close", onClick: onClose, "aria-label": t("Close Engine", "بستن انجین") },
          h("kbd", null, "E"),
          " ",
          t("Close", "بستن"),
        ),
      ),
      h(
        "div",
        { className: "dd-engine-lanes" },
        shown.map(({ lane, blocks }) =>
          h(
            "section",
            { key: lane.id || "parked", className: "dd-engine-lane-col", "data-lane": lane.id || "parked" },
            h(
              "h3",
              null,
              lane.parked || !lane.id ? t("Parked", "پارک‌شده") : lane.name || lane.id,
              h("small", null, blocks.filter((b) => b.done).length + "/" + blocks.length),
            ),
            h(
              "ul",
              null,
              blocks.map((block) =>
                h(EngineRow, { key: block.id, React: R, block, lanes, language, measure, setDone, change: onChange, onReveal }),
              ),
            ),
            h(AddTask, { React: R, lane, language, onAdd }),
          ),
        ),
      ),
      h(
        "footer",
        { className: "dd-engine-foot" },
        t(
          "Same tasks as Plan and Lanes. Each task sits in one lane only.",
          "همان کارهای پلن و لاین‌ها. هر کار فقط در یک لاین است.",
        ),
      ),
    ),
  );
}

export const DDengineCSS = `
.dd-engine-backdrop{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(18,18,17,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);animation:dd-engine-in .14s ease-out}
.b2-board-focus .dd-engine-backdrop,.b4-focus .dd-engine-backdrop{position:fixed}
@keyframes dd-engine-in{from{opacity:0}to{opacity:1}}
.dd-engine{width:min(1080px,100%);max-height:min(82vh,100%);display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#121211);border-radius:16px;box-shadow:0 24px 60px #0006,0 0 0 1px var(--rule-2,#0002);overflow:hidden;outline:none}
.dd-engine-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--rule-2,#0001)}
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
.dd-engine-foot{padding:10px 18px;font-size:12px;color:var(--ink-3,#666);border-top:1px solid var(--rule-2,#0001)}
@media (max-width:640px){.dd-engine-backdrop{padding:10px;align-items:stretch}.dd-engine{max-height:none}.dd-engine-lanes{grid-template-columns:1fr;padding:12px}.dd-engine-bar{width:64px}.dd-engine-check,.dd-engine-kinds button,.dd-engine-reveal{min-width:28px;min-height:28px}}
@media (prefers-reduced-motion:reduce){.dd-engine-backdrop{animation:none}}
`;

export function DDinstallEngineStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-css", textContent: DDengineCSS }));
}
