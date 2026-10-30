// The Engine: today's tasks, each tied to one lane, ticked, scored or waited on.
// It is not a copy: it reads and writes day.blocks, the same data Plan, Lanes
// and the Board show, so a change here is the same change everywhere.
import { DDcompletion } from "./planner.js";
import { DDsectionTint, DDshortPath, DDlifePath } from "./life-board.js";

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
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s+/, "").trim())
    .filter(Boolean);
  const task = DDengineTask(lines[0] || "", lane, setup, makeId(), from);
  task.subtasks = lines.slice(1).map((line) => ({ id: makeId(), text: line, done: false, expanded: true, children: [] }));
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
export function DDengineCopy(block, makeId = () => crypto.randomUUID()) {
  const steps = (items) =>
    (items || []).map((item) => ({ ...item, id: makeId(), done: false, children: steps(item.children) }));
  const copy = { ...structuredClone(block), id: makeId(), done: false, subtasks: steps(block.subtasks) };
  delete copy.score;
  delete copy.bx;
  delete copy.by;
  delete copy.at;
  if (copy.measure === "count") copy.count = 0;
  return copy;
}

// Is a task with this name already in today's Engine?
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
export function DDengineHas(day, block) {
  return (day?.blocks || []).some((b) => sameName(b.name, block.name));
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

const KINDS = [
  ["time", "✓", "Tick", "تیکی"],
  ["score", "★", "Score", "نمره‌ای"],
  ["wait", "⏳", "Waiting", "ویتینگ"],
];

function EngineRow({ React: R, block, lanes, sources = [], language, measure, setDone, change, onReveal }) {
  const fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    h = R.createElement,
    [editing, setEditing] = R.useState(false),
    kind = measure.DDmeasureOf(block),
    from = sources.find((s) => s.id === block.from),
    sourcePath = (s) => DDshortPath((s.parts || [s.name]).map((p) => p.trim() || t("Section", "سکشن")), 34),
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
        // Where the task came from: a Life section, or the main board.
        h(
          "select",
          {
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
  days,
  dateFormat,
  makeId,
  sources = [],
}) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    lanes = setup?.lanes || [],
    groups = DDengineGroups(day, lanes),
    progress = DDcompletion(day, lanes.map((lane) => lane.id)),
    [earlierOpen, setEarlierOpen] = R.useState(false),
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
        h(
          "button",
          { type: "button", className: "dd-engine-close", onClick: onClose, "aria-label": t("Close Engine", "بستن انجین") },
          h("kbd", null, "E"),
          " ",
          t("Close", "بستن"),
        ),
      ),
      earlierOpen &&
        h(EarlierEngine, {
          React: R,
          days,
          day,
          lanes,
          language,
          dateFormat,
          onCopy: (blocks) =>
            onChange((d) => ({ ...d, blocks: [...d.blocks, ...blocks.map((b) => DDengineCopy(b, makeId))] })),
        }),
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
                h(EngineRow, { key: block.id, React: R, block, lanes, sources, language, measure, setDone, change: onChange, onReveal }),
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
.b6 .b4-life-section>.dd-sec-history{--k:var(--dd-sec-k,1);position:absolute;top:calc(10px * var(--k));right:calc(10px * var(--k));z-index:3;display:flex;align-items:center;gap:calc(6px * var(--k));height:calc(28px * var(--k));max-width:calc(100% - 20px * var(--k));padding:0 calc(8px * var(--k));border-radius:calc(6px * var(--k));border:calc(1px * var(--k)) solid color-mix(in srgb,var(--node-color) 60%,#1e1e1e 20%);background:var(--paper,#fff);color:var(--ink,#121211);font:600 calc(11px * var(--k))/1 var(--mono,ui-monospace,monospace);overflow:hidden;cursor:pointer;min-width:0;min-height:0}
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
.dd-engine-foot{padding:10px 18px;font-size:12px;color:var(--ink-3,#666);border-top:1px solid var(--rule-2,#0001)}
@media (max-width:640px){.dd-engine-backdrop{padding:10px;align-items:stretch}.dd-engine{max-height:none}.dd-engine-lanes{grid-template-columns:1fr;padding:12px}.dd-engine-bar{width:64px}.dd-engine-check,.dd-engine-kinds button,.dd-engine-reveal{min-width:28px;min-height:28px}}
@media (prefers-reduced-motion:reduce){.dd-engine-backdrop{animation:none}}
`;

export function DDinstallEngineStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-css", textContent: DDengineCSS }));
}
