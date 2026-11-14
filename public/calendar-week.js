// Calendar extras (5.46): section colors on each day, a Week view, and a short
// weekly look back. Everything here reads the same days and the same Feed, so a
// task moved here moves in Plan and on the Board too. Nothing is scored.
import { DDlifeItems, DDsectionTint, DDsectionPath } from "./life-board.js";
import { DDplanMinutes, DDduration } from "./measure.js";
import { DDbudgetOf, DDbudgetUsed, DDbudgetText, DDgoalOf, DDgoalText } from "./budgets.js";
import { DDdueBetween, DDdueOn, DDdueText, DDdueDate, DDdueName } from "./deadlines.js";
import { DDtodoDueItems, DDtodoLists } from "./todos.js";
import { DDenergyOf, DDenergyLabel } from "./energy.js";
import { DDaddDays } from "./dates.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const DDcalShift = DDaddDays;

// The week starts on Saturday in Persian and on Monday in English, like the month.
export function DDweekStart(date, language) {
  const start = language === "fa" ? 6 : 1, at = new Date(date + "T12:00:00Z");
  return DDcalShift(date, -((at.getUTCDay() - start + 7) % 7));
}
export const DDweekDays = (date, language) => Array.from({ length: 7 }, (_, i) => DDcalShift(DDweekStart(date, language), i));

const calendarOf = (language) => {
  let calendar = language === "fa" ? "persian" : "gregory";
  try { const saved = JSON.parse(localStorage.getItem("debug-day:review-calendar")); if (["persian", "gregory"].includes(saved)) calendar = saved; } catch {}
  return calendar;
};
const fmt = (language, options) => new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", { calendar: calendarOf(language), timeZone: "UTC", ...options });
const at = (date) => new Date(date + "T12:00:00Z");

// "2 – 8 Nov" or "28 Oct – 3 Nov".
export function DDweekLabel(date, language) {
  const days = DDweekDays(date, language), a = at(days[0]), b = at(days[6]);
  try {
    const sameMonth = fmt(language, { month: "short" }).format(a) === fmt(language, { month: "short" }).format(b);
    return (sameMonth ? fmt(language, { day: "numeric" }).format(a) : fmt(language, { day: "numeric", month: "short" }).format(a)) + " – " + fmt(language, { day: "numeric", month: "short" }).format(b);
  } catch { return days[0] + " – " + days[6]; }
}

// Which sections a day's tasks came from, with their colors (block.from).
export function DDdaySections(day, items) {
  const out = new Map();
  for (const b of day?.blocks || []) {
    if (!b?.from || !String(b.name || "").trim()) continue;
    const tint = DDsectionTint(items, b.from);
    if (!tint) continue;
    const row = out.get(b.from) || { id: b.from, color: tint.fill, name: DDsectionPath(items, b.from, 28).short, minutes: 0, tasks: 0, done: 0 };
    row.minutes += DDplanMinutes(b) || 30;
    row.tasks += 1;
    if (b.done) row.done += 1;
    out.set(b.from, row);
  }
  return [...out.values()].sort((a, b) => b.minutes - a.minutes);
}

// The thin color line under a day in the month.
export function DDCalSections({ React: R, day, items }) {
  const rows = DDdaySections(day, items);
  if (!rows.length) return null;
  return R.createElement("span", { className: "dd-cal-sections", "aria-hidden": true, "data-cal-sections": rows.map((r) => r.id).join(" ") },
    rows.slice(0, 5).map((r) => R.createElement("i", { key: r.id, style: { flexGrow: r.minutes, background: r.color }, "data-done": r.done === r.tasks })));
}

// The week ahead's focus, one line per week, kept in setup.reviews.
export function DDreviewsClean(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const rows = Object.entries(value)
    .filter(([k, v]) => DAY.test(k) && v && typeof v.focus === "string" && v.focus.trim())
    .sort(([a], [b]) => b.localeCompare(a)).slice(0, 104)
    .map(([k, v]) => [k, { focus: v.focus.slice(0, 500) }]);
  return rows.length ? Object.fromEntries(rows) : undefined;
}
export const DDweekFocus = (setup, date, language) => setup?.reviews?.[DDweekStart(date, language)]?.focus || "";
export function DDsetWeekFocus(data, weekStart, focus) {
  const reviews = { ...(data.setup.reviews || {}) }, text = String(focus || "").slice(0, 500);
  if (text.trim()) reviews[weekStart] = { focus: text }; else delete reviews[weekStart];
  const { reviews: _old, ...setup } = data.setup;
  return { ...data, setup: Object.keys(reviews).length ? { ...setup, reviews } : setup };
}

// The numbers behind the weekly look back.
export function DDweekSummary(data, date, today, language) {
  const days = DDweekDays(date, language), items = DDlifeItems(data.setup), types = data.setup.types || [];
  let planned = 0, done = 0, doneMinutes = 0, light = 0, heavy = 0;
  const sections = new Map(), moods = [];
  for (const key of days) {
    const day = data.days?.[key];
    moods.push({ date: key, mood: day?.mood || "" });
    for (const b of day?.blocks || []) {
      if (!String(b?.name || "").trim()) continue;
      planned++;
      if (!b.done) continue;
      done++;
      doneMinutes += DDplanMinutes(b);
      if (DDenergyOf(b) === "light") light++;
      if (DDenergyOf(b) === "heavy") heavy++;
      const tint = b.from ? DDsectionTint(items, b.from) : null;
      const id = tint ? b.from : "", row = sections.get(id) || { id, color: tint?.fill || "", name: tint ? DDsectionPath(items, b.from, 32).short : "", minutes: 0, tasks: 0 };
      row.minutes += DDplanMinutes(b);
      row.tasks += 1;
      sections.set(id, row);
    }
  }
  // A section with a weekly budget shows how much of it was used.
  for (const it of items) {
    const budget = DDbudgetOf(it);
    if (it.type !== "section" || !budget || budget.per !== "week") continue;
    const row = sections.get(it.id) || { id: it.id, color: DDsectionTint(items, it.id)?.fill || "", name: DDsectionPath(items, it.id, 32).short, minutes: 0, tasks: 0 };
    row.budget = DDbudgetText(budget, DDbudgetUsed(data.days, items, it.id, days[6], budget, language), language);
    sections.set(it.id, row);
  }
  const goals = items.filter((i) => i.type === "sticky" && (i.goal || i.role === "goal")).map((i) => ({ id: i.id, name: DDdueName(i, language), text: DDgoalText(DDgoalOf(i), today, language) })),
    // Tasks with a due date in a to-do list show next to the deadlines (5.65).
    due = DDdueBetween([...items, ...DDtodoDueItems(DDtodoLists(data))], days[0], DDcalShift(days[6], 14)).map((i) => ({ id: i.id, name: DDdueName(i, language), due: i.due, color: i.type === "section" ? DDsectionTint(items, i.id)?.fill : i.color }));
  return {
    days, planned, done, doneMinutes, light, heavy, moods, goals, due,
    sections: [...sections.values()].sort((a, b) => (b.id ? 1 : 0) - (a.id ? 1 : 0) || b.minutes - a.minutes || b.tasks - a.tasks),
    types,
  };
}

// Month / Week, the same switch on both views.
export function DDCalendarModes({ React: R, mode, onMode, language }) {
  const h = R.createElement, t = (en, fa) => (language === "fa" ? fa : en);
  return h("div", { className: "dd-cal-modes", role: "group", "aria-label": t("Calendar view", "نمای تقویم") },
    [["month", t("Month", "ماه")], ["week", t("Week", "هفته")]].map(([id, label]) =>
      h("button", { key: id, type: "button", "aria-pressed": mode === id, "data-cal-mode": id, onClick: () => onMode(id) }, label)));
}

const check = (h) => h("svg", { viewBox: "0 0 16 16", width: 12, height: 12, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M3.5 8.5l3 3 6-7" }));

export function DDCalendarWeek({ React: R, data, date, today, language, onSelectDay, onOpenPlan, onMoveTask, onToggleTask, mode, onMode }) {
  // To-do tasks with a due date sit on their day with the deadlines (5.65).
  const todoDue = R.useMemo(() => [...DDlifeItems(data.setup), ...DDtodoDueItems(DDtodoLists(data))], [data]);
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en), num = (n) => (fa ? n.toLocaleString("fa-IR") : String(n)),
    items = DDlifeItems(data.setup), types = data.setup.types || [],
    days = DDweekDays(date, language), focus = DDweekFocus(data.setup, date, language),
    [over, setOver] = R.useState(null), drag = R.useRef(null),
    dot = (b) => (b.from && DDsectionTint(items, b.from)?.fill) || types.find((x) => x.id === b.type)?.color || "var(--ink-3)",
    drop = (to, e) => {
      e.preventDefault(); setOver(null);
      let move = drag.current;
      if (!move) try { move = JSON.parse(e.dataTransfer.getData("text/plain")); } catch {}
      drag.current = null;
      if (move?.kind === "block" && move.from !== to) { onMoveTask(move.from, to, move.id); onSelectDay(to); }
    };
  return h("section", { className: "dd-week", "aria-label": t("Week", "هفته") },
    h("div", { className: "dd-week-head" },
      h("div", null,
        h("h2", null, DDweekLabel(date, language)),
        h("p", { dir: "auto", "data-week-focus": focus ? "set" : "" }, focus ? t("This week: ", "این هفته: ") + focus : t("Drag a task to another day to move it.", "یک کار را به روز دیگری بکش تا جابه‌جا شود."))),
      h(DDCalendarModes, { React: R, mode, onMode, language })),
    h("div", { className: "dd-review-month-controls dd-week-controls" },
      h("button", { type: "button", onClick: () => onSelectDay(DDcalShift(date, -7)), "aria-label": t("Previous week", "هفتهٔ قبل") }, fa ? "→" : "←"),
      h("button", { type: "button", onClick: () => onSelectDay(today) }, t("This week", "این هفته")),
      h("button", { type: "button", onClick: () => onSelectDay(DDcalShift(date, 7)), "aria-label": t("Next week", "هفتهٔ بعد") }, fa ? "←" : "→")),
    h("div", { className: "dd-week-grid" }, days.map((key) => {
      const day = data.days?.[key], blocks = (day?.blocks || []).filter((b) => String(b.name || "").trim()), due = DDdueOn(todoDue, key);
      return h("div", {
          key, className: "dd-week-day" + (over === key ? " drag-over" : ""), "data-week-date": key, "aria-current": key === today ? "date" : undefined,
          "data-selected": key === date,
          onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== key) setOver(key); },
          onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); },
          onDrop: (e) => drop(key, e),
        },
        h("button", { type: "button", className: "dd-week-day-head", "aria-pressed": key === date, onClick: () => onSelectDay(key), onDoubleClick: () => onOpenPlan?.(key),
            "aria-label": fmt(language, { weekday: "long", day: "numeric", month: "long" }).format(at(key)) + " · " + num(blocks.length) + t(blocks.length === 1 ? " task" : " tasks", " کار") },
          h("span", null, fmt(language, { weekday: "short" }).format(at(key))),
          h("strong", null, fmt(language, { day: "numeric" }).format(at(key))),
          day?.mood && h("span", { className: "dd-week-mood", "aria-hidden": true }, day.mood)),
        h("ul", { className: "dd-week-tasks" },
          due.map((i) => h("li", { key: "due-" + i.id, className: "dd-week-due", "data-week-due": i.id, dir: "auto", title: t("Deadline: ", "ددلاین: ") + DDdueName(i, language) }, "◆ " + DDdueName(i, language))),
          blocks.map((b) => h("li", {
              key: b.id, className: "dd-week-task", "data-week-task": b.id, "data-done": !!b.done, draggable: true,
              onDragStart: (e) => { drag.current = { kind: "block", id: b.id, from: key }; e.dataTransfer.setData("text/plain", JSON.stringify(drag.current)); e.dataTransfer.effectAllowed = "move"; },
              onDragEnd: () => { drag.current = null; setOver(null); },
            },
            h("button", { type: "button", className: "dd-week-check", "aria-pressed": !!b.done, "aria-label": (b.done ? t("Mark not done: ", "انجام‌نشده: ") : t("Mark done: ", "انجام شد: ")) + b.name, style: { "--dot": dot(b) }, onClick: () => onToggleTask?.(key, b.id) }, b.done && check(h)),
            h("span", { className: "dd-week-name", dir: "auto", title: b.name }, b.name,
              DDenergyOf(b) && h("small", { className: "dd-energy", "data-energy": DDenergyOf(b) }, DDenergyLabel(DDenergyOf(b), language))))),
          !blocks.length && !due.length && h("li", { className: "dd-week-empty", "aria-hidden": true }, "·")));
    })));
}

export function DDWeekReview({ React: R, data, date, today, language, setData }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en), num = (n) => (fa ? n.toLocaleString("fa-IR") : String(n)),
    s = DDweekSummary(data, date, today, language), next = DDcalShift(s.days[0], 7),
    saved = data.setup.reviews?.[next]?.focus || "", [draft, setDraft] = R.useState(saved),
    save = () => { if (draft.trim() !== saved.trim()) setData((old) => DDsetWeekFocus(old, next, draft.trim())); };
  R.useEffect(() => setDraft(saved), [next, saved]);
  const row = (key, color, name, value, extra) => h("li", { key, "data-review-row": key },
    h("i", { style: { background: color || "var(--rule-2)" }, "aria-hidden": true }),
    h("span", { dir: "auto" }, name), h("b", null, value), extra && h("small", null, extra));
  return h("section", { className: "dd-week-review", "aria-label": t("Your week", "هفته‌ات") },
    h("h2", null, t("Your week", "هفته‌ات")),
    h("p", { className: "dd-week-total", "data-week-total": s.done },
      s.planned
        ? t(s.done + " of " + s.planned + " tasks done", num(s.done) + " از " + num(s.planned) + " کار انجام شد") + (s.doneMinutes ? " · " + DDduration(s.doneMinutes, language) : "")
        : t("Nothing planned this week yet.", "این هفته هنوز چیزی برنامه‌ریزی نشده.")),
    (s.light > 0 || s.heavy > 0) && h("p", { className: "dd-week-energy" },
      [s.heavy && t(s.heavy + " heavy", num(s.heavy) + " سنگین"), s.light && t(s.light + " light", num(s.light) + " سبک")].filter(Boolean).join(" · ")),
    s.sections.length > 0 && h("div", { className: "dd-week-block" },
      h("h3", null, t("Where the time went", "وقت کجا رفت")),
      h("ul", { className: "dd-week-rows" }, s.sections.map((r) => row(r.id || "other", r.color, r.name || t("Not from a section", "بدون سکشن"),
        r.minutes ? DDduration(r.minutes, language) : r.tasks ? t(r.tasks + (r.tasks === 1 ? " task" : " tasks"), num(r.tasks) + " کار") : "", r.budget)))),
    s.goals.length > 0 && h("div", { className: "dd-week-block" },
      h("h3", null, t("Goals", "هدف‌ها")),
      h("ul", { className: "dd-week-rows" }, s.goals.map((g) => row("goal-" + g.id, "", g.name, g.text)))),
    s.due.length > 0 && h("div", { className: "dd-week-block" },
      h("h3", null, t("Deadlines", "ددلاین‌ها")),
      h("ul", { className: "dd-week-rows" }, s.due.map((d) => row("due-" + d.id, d.color, d.name, DDdueDate(d.due, language), DDdueText(d.due, today, language))))),
    h("div", { className: "dd-week-moods", "aria-label": t("Moods this week", "حال این هفته") },
      s.moods.map((m) => h("span", { key: m.date, title: fmt(language, { weekday: "long" }).format(at(m.date)) }, m.mood || "·"))),
    h("label", { className: "dd-week-focus" },
      h("span", null, t("Focus for next week", "تمرکز هفتهٔ بعد")),
      h("textarea", { dir: "auto", rows: 2, maxLength: 500, value: draft, placeholder: t("One or two things that matter most", "یکی دو چیز که از همه مهم‌ترن"),
        onChange: (e) => setDraft(e.target.value), onBlur: save })));
}

export const DDcalendarWeekCSS = `
.dd-cal-sections{display:flex;gap:1px;width:calc(100% - 8px);height:3px;margin-top:auto;border-radius:2px;overflow:hidden}
.dd-cal-sections i{display:block;min-width:3px;height:100%}
.dd-cal-sections i[data-done=false]{opacity:.55}
.dd-cal-due{position:absolute;top:4px;inset-inline-end:5px;font-size:9px;line-height:1;color:var(--ink-2)}
.dd-cal-modes{display:inline-flex;gap:2px;padding:2px;border-radius:999px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule)}
.dd-cal-modes button,.dd-review-root .dd-cal-modes button{height:28px;min-height:0;padding:0 12px;border:0;border-radius:999px;background:none;color:var(--ink-2);font:500 12px/1 var(--sans);cursor:pointer}
.dd-cal-modes button[aria-pressed=true],.dd-review-root .dd-cal-modes button[aria-pressed=true]{background:var(--paper);color:var(--ink);box-shadow:0 1px 3px -1px #0003,inset 0 0 0 1px var(--rule-2)}
@media (pointer:coarse){.dd-cal-modes button,.dd-review-root .dd-cal-modes button{height:40px}}
.dd-week-columns>.dd-week{grid-column:1/-1}
.dd-week,.dd-week-review{border:1px solid var(--rule-2);padding:20px;background:var(--paper);border-radius:12px;min-width:0}
.dd-week-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dd-week-head h2,.dd-week-review h2{margin:0;font:600 18px/1.3 var(--sans);color:var(--ink)}
.dd-week-head p{margin:4px 0 0;font-size:13px;color:var(--ink-3)}
.dd-week-head p[data-week-focus=set]{color:var(--ink-2)}
.dd-week-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.dd-week-day{display:flex;flex-direction:column;gap:6px;min-width:0;min-height:160px;padding:8px;border-radius:10px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule)}
.dd-week-day[aria-current=date]{box-shadow:inset 0 0 0 1.5px var(--ink-3)}
.dd-week-day[data-selected=true]{background:var(--paper);box-shadow:inset 0 0 0 1.5px var(--ink)}
.dd-week-day.drag-over{box-shadow:inset 0 0 0 2px var(--ink)}
.dd-week-day-head,.dd-review-root button.dd-week-day-head,.dd-review-root button.dd-week-day-head[aria-pressed=true]{display:flex;align-items:baseline;gap:6px;min-height:0;height:auto;padding:2px 2px;border:0;border-radius:6px;background:none;color:var(--ink-2);font:500 12px/1.2 var(--sans);cursor:pointer;text-align:start}
.dd-review-root button.dd-week-day-head:hover{background:none;color:var(--ink)}
.dd-week-day-head strong{font:600 16px/1 var(--sans);color:var(--ink)}
.dd-week-mood{margin-inline-start:auto;font-size:14px}
.dd-week-tasks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;min-width:0}
.dd-week-task{display:flex;align-items:center;gap:6px;min-width:0;padding:5px 6px;border-radius:8px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--rule);font-size:12px;line-height:1.3;color:var(--ink);cursor:grab}
.dd-week-task[data-done=true] .dd-week-name{color:var(--ink-3);text-decoration:line-through}
.dd-week-task{align-items:flex-start}
.dd-week-name{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.dd-week-check,.dd-review-root button.dd-week-check{flex:none;display:grid;place-items:center;width:16px;height:16px;min-width:0;min-height:0;margin-top:1px;padding:0;border-radius:50%;border:1.5px solid var(--dot);background:none;color:#fff;cursor:pointer}
.dd-week-check[aria-pressed=true],.dd-review-root button.dd-week-check[aria-pressed=true]{background:var(--dot);border-color:var(--dot);color:#fff}
.dd-review-root button.dd-week-check:hover{background:color-mix(in srgb,var(--dot) 25%,transparent)}
.dd-week-name .dd-energy{margin-inline-start:4px;font-size:10px}
.dd-week-due{padding:3px 6px;font-size:11px;line-height:1.3;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-week-empty{color:var(--ink-3);font-size:12px;padding:2px 4px}
.dd-week-review{display:flex;flex-direction:column;gap:12px}
.dd-week-total{margin:0;font:500 14px/1.4 var(--sans);color:var(--ink)}
.dd-week-energy{margin:-6px 0 0;font-size:12px;color:var(--ink-3)}
.dd-week-block h3{margin:0 0 6px;font:600 12px/1.3 var(--sans);color:var(--ink-3);text-transform:none}
.dd-week-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dd-week-rows li{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;column-gap:8px;font-size:13px;line-height:1.35;color:var(--ink-2)}
.dd-week-rows li>i{width:10px;height:10px;border-radius:3px}
.dd-week-rows li>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-week-rows li>b{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.dd-week-rows li>small{grid-column:2/-1;font-size:11px;color:var(--ink-3)}
.dd-week-moods{display:flex;justify-content:space-between;gap:4px;padding:8px 10px;border-radius:10px;background:var(--wash);font-size:16px;color:var(--ink-3)}
.dd-week-focus{display:flex;flex-direction:column;gap:6px;font:600 12px/1.3 var(--sans);color:var(--ink-3)}
.dd-week-focus textarea{min-height:56px;resize:vertical;border-radius:10px;border:1px solid var(--rule-2);background:var(--paper);color:var(--ink);padding:8px 10px;font:400 14px/1.4 var(--sans)}
@media (max-width:760px){
 .dd-week,.dd-week-review{padding:14px}
 .dd-week-head{flex-wrap:wrap}
 .dd-week-grid{grid-template-columns:1fr}
 .dd-week-day{min-height:0;flex-direction:row;flex-wrap:wrap;align-items:flex-start}
 .dd-week-day-head{flex-direction:column;align-items:center;gap:2px;width:44px;flex:none}
 .dd-week-tasks{flex:1}
 .dd-week-mood{margin:0}
}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-calendar-week-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-calendar-week-styles", textContent: DDcalendarWeekCSS }));
