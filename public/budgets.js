// Soft budgets and goal counters (5.44). A section can carry a gentle budget
// ("6h a week", "3 times a week"); the app adds up the done tasks that came
// from it (block.from), so nothing new is stored on the days. A goal note can
// count up toward a number by a date. No red, no warnings: just the numbers.
import { DDplanMinutes, DDduration } from "./measure.js";
// life-board.js reads DDbudgetOf and DDgoalClean, so this file does not import it.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const whole = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

// Choices offered on a section's menu.
export const DDbudgetPresets = [
  { n: 1, unit: "h", per: "day" }, { n: 2, unit: "h", per: "day" }, { n: 4, unit: "h", per: "day" }, { n: 6, unit: "h", per: "day" }, { n: 8, unit: "h", per: "day" },
  { n: 2, unit: "h", per: "week" }, { n: 5, unit: "h", per: "week" }, { n: 10, unit: "h", per: "week" }, { n: 20, unit: "h", per: "week" }, { n: 40, unit: "h", per: "week" },
  { n: 1, unit: "tasks", per: "week" }, { n: 3, unit: "tasks", per: "week" }, { n: 5, unit: "tasks", per: "week" },
];

export function DDbudgetOf(item) {
  const b = item?.budget;
  if (!b || typeof b !== "object" || !["h", "tasks"].includes(b.unit) || !["day", "week"].includes(b.per)) return null;
  const n = whole(b.n, 0, 999);
  return n > 0 ? { n, unit: b.unit, per: b.per } : null;
}

export const DDbudgetSame = (a, b) => !!a && !!b && a.n === b.n && a.unit === b.unit && a.per === b.per;

// The week starts on Saturday in Persian and on Monday in English, like the Calendar.
export function DDbudgetRange(date, per, language) {
  if (!DAY.test(date || "")) return [];
  if (per === "day") return [date];
  const start = language === "fa" ? 6 : 1, at = new Date(date + "T12:00:00Z"),
    back = (at.getUTCDay() - start + 7) % 7, out = [];
  for (let i = back; i >= 0; i--) out.push(new Date(at.getTime() - i * 864e5).toISOString().slice(0, 10));
  return out;
}

// Done tasks from the section (or a section inside it) on the budget's days:
// minutes for an hours budget, a count for a times budget.
export function DDbudgetUsed(days, items, sectionId, date, budget, language) {
  if (!budget || !sectionId) return 0;
  const inside = new Set([sectionId]), list = items || [];
  for (let grew = true; grew; ) {
    grew = false;
    for (const it of list) if (!inside.has(it.id) && inside.has(it.parent)) (inside.add(it.id), (grew = true));
  }
  let used = 0;
  for (const key of DDbudgetRange(date, budget.per, language))
    for (const block of days?.[key]?.blocks || [])
      if (block?.done && inside.has(block.from)) used += budget.unit === "h" ? DDplanMinutes(block) : 1;
  return used;
}

export function DDbudgetLabel(budget, language) {
  if (!budget) return "";
  const fa = language === "fa", n = fa ? budget.n.toLocaleString("fa-IR") : String(budget.n);
  if (budget.unit === "tasks")
    return fa ? (budget.per === "day" ? "روزی " : "هفته‌ای ") + n + " بار" : budget.n === 1 ? "Once a " + budget.per : n + " times a " + budget.per;
  return fa ? (budget.per === "day" ? "روزی " : "هفته‌ای ") + n + " ساعت" : n + "h a " + budget.per;
}

// Short text beside a section's name: "1h 30m / 6h week", "2 / 3 week".
export function DDbudgetText(budget, used, language) {
  if (!budget) return "";
  const fa = language === "fa", num = (v) => (fa ? v.toLocaleString("fa-IR") : String(v));
  const done = budget.unit === "h" ? DDduration(used, language) : num(used),
    goal = budget.unit === "h" ? DDduration(budget.n * 60, language) : num(budget.n),
    when = budget.per === "day" ? (fa ? "امروز" : "today") : fa ? "این هفته" : "week";
  return done + " / " + goal + " · " + when;
}

// A goal note's counter: { n, of, until }.
export function DDgoalOf(note) {
  const g = note?.goal;
  if (!g || typeof g !== "object") return { n: 0, of: 0 };
  return { n: whole(g.n, 0, 9999), of: whole(g.of, 0, 9999), ...(DAY.test(g.until || "") ? { until: g.until } : {}) };
}

export function DDgoalClean(goal) {
  const g = DDgoalOf({ goal });
  return g.n || g.of || g.until ? g : undefined;
}

export function DDgoalDaysLeft(goal, today) {
  if (!goal?.until || !DAY.test(today || "")) return null;
  return Math.round((Date.parse(goal.until + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5);
}

export function DDgoalText(goal, today, language) {
  const fa = language === "fa", num = (v) => (fa ? v.toLocaleString("fa-IR") : String(v)),
    left = DDgoalDaysLeft(goal, today);
  const count = goal.of ? num(goal.n) + (fa ? " از " : " of ") + num(goal.of) : num(goal.n);
  if (left === null) return count;
  const when = left > 1 ? (fa ? num(left) + " روز مانده" : left + " days left") : left === 1 ? (fa ? "۱ روز مانده" : "1 day left") : left === 0 ? (fa ? "امروز" : "today") : fa ? "تاریخش گذشت" : "date passed";
  return count + " · " + when;
}

// The counter row under a goal in the Goals rail.
export function DDGoalCounter({ React: R, note, today, language, onChange }) {
  const h = R.createElement, t = (en, fa) => (language === "fa" ? fa : en),
    goal = DDgoalOf(note), [editing, setEditing] = R.useState(false),
    set = (patch) => onChange(DDgoalClean({ ...goal, ...patch }));
  return h("div", { className: "dd-goal-counter", "data-goal-counter": note.id, dir: language === "fa" ? "rtl" : "ltr" },
    h("button", { type: "button", "aria-label": t("One less", "یکی کمتر"), disabled: !goal.n, onClick: () => set({ n: goal.n - 1 }) }, "−"),
    h("b", { "aria-live": "polite" }, DDgoalText(goal, today, language)),
    h("button", { type: "button", "aria-label": t("One more", "یکی بیشتر"), onClick: () => set({ n: goal.n + 1 }) }, "+"),
    h("button", { type: "button", className: "dd-goal-edit", "aria-expanded": editing, "aria-label": t("Target and date", "هدف و تاریخ"), onClick: () => setEditing(!editing) }, "✎"),
    editing && h("div", { className: "dd-goal-fields" },
      h("label", null, h("span", null, t("Target", "هدف")),
        h("input", { type: "number", min: 0, max: 9999, value: goal.of || "", placeholder: "35", "aria-label": t("Target", "هدف"), onChange: (e) => set({ of: e.target.value }) })),
      h("label", null, h("span", null, t("Until", "تا")),
        h("input", { type: "date", value: goal.until || "", "aria-label": t("Until", "تا"), onChange: (e) => set({ until: e.target.value }) }))));
}

export const DDbudgetCSS = `
.dd-goal-counter{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0 2px;font:500 12px/1.3 var(--sans);color:var(--ink-2)}
.dd-goal-counter>b{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.dd-goal-counter>button{min-width:24px;height:24px;border-radius:999px;border:0;background:var(--wash);color:var(--ink-2);box-shadow:inset 0 0 0 1px var(--rule-2);cursor:pointer;font:inherit}
.dd-goal-counter>button:hover:not(:disabled){color:var(--ink)}
.dd-goal-counter>button:disabled{opacity:.4;cursor:default}
.dd-goal-fields{flex-basis:100%;display:flex;gap:8px;flex-wrap:wrap}
.dd-goal-fields label{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--ink-3)}
.dd-goal-fields input{height:28px;border-radius:8px;border:1px solid var(--rule-2);background:var(--paper);color:var(--ink);padding:0 8px;font:inherit;min-width:0;width:120px}
.b6 .b4-life-section>.dd-sec-history .dd-sec-today,.b6 .b4-life-section>.dd-sec-history .dd-sec-budget{font-weight:500;color:var(--ink-2,#4a4843);white-space:nowrap}
.b6 .b4-life-section>.dd-sec-history .dd-sec-budget[data-reached=true]{color:var(--ok,#2BA672)}
`;
