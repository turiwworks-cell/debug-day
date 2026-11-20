// Reminders in the Calendar (5.84): every day names its reminders, and a tap opens one.
// Two kinds of reminder live in the app:
//   - the Calendar's own reminders (setup.reminders): a day, and maybe a repeat;
//   - to-do tasks with a time (📅 day + time in a to-do note): they ping when the time comes.
// A deadline without a time stays a deadline (◆).
import { DDdueName } from "./deadlines.js";
import { DDvalidDate } from "./dates.js";

// How a reminder repeats (5.93.0 adds every day, every month and every year).
// A monthly or yearly one counts months in the calendar it was made with
// (reminder.cal: Persian or Gregorian), and on a month too short for its day
// (the 31st, or Esfand 30 in a common year) it comes on the month's last day.
export const DDrepeatKinds = ["once", "daily", "weekly", "alternate", "monthly", "yearly"];
export const DDrepeats = (reminder) => DDrepeatKinds.includes(reminder?.repeat) && reminder.repeat !== "once";
export function DDrepeatName(value, language = "en") {
  const fa = language === "fa";
  return ({
    daily: fa ? "هر روز" : "Every day",
    weekly: fa ? "هر هفته" : "Every week",
    alternate: fa ? "یک روز در میان" : "Every other day",
    monthly: fa ? "هر ماه" : "Every month",
    yearly: fa ? "هر سال" : "Every year",
  })[value] || (fa ? "فقط این روز" : "This day only");
}
const partsSeen = new Map(), formats = {};
function parts(date, cal) {
  const key = cal + date;
  if (!partsSeen.has(key)) {
    if (partsSeen.size > 5000) partsSeen.clear();
    formats[cal] ||= new Intl.DateTimeFormat("en", { calendar: cal, timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric", numberingSystem: "latn" });
    const out = {};
    for (const p of formats[cal].formatToParts(new Date(date + "T12:00:00Z"))) if (p.type === "year" || p.type === "month" || p.type === "day") out[p.type] = +p.value;
    partsSeen.set(key, out);
  }
  return partsSeen.get(key);
}
const next = (date) => new Date(Date.parse(date + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
export function DDrepeatHits(reminder, date) {
  if (!DDvalidDate(reminder?.date) || !DDvalidDate(date) || reminder.date > date) return false;
  const repeat = reminder.repeat, days = Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(reminder.date + "T12:00:00Z")) / 86400000);
  if (repeat === "daily") return true;
  if (repeat === "weekly") return days % 7 === 0;
  if (repeat === "alternate") return days % 2 === 0;
  if (repeat === "monthly" || repeat === "yearly") {
    const cal = reminder.cal === "persian" ? "persian" : "gregory", start = parts(reminder.date, cal), here = parts(date, cal);
    if (repeat === "yearly" && here.month !== start.month) return false;
    return here.day === start.day || (here.day < start.day && parts(next(date), cal).day === 1);
  }
  return reminder.date === date;
}
// The next day a reminder comes on, from `from` on ("" when it has passed).
export function DDrepeatNext(reminder, from) {
  if (!DDvalidDate(reminder?.date) || !DDvalidDate(from)) return "";
  if (reminder.date >= from) return reminder.date;
  if (!DDrepeats(reminder)) return "";
  if (reminder.repeat === "daily") return from;
  if (reminder.repeat === "weekly" || reminder.repeat === "alternate") {
    const step = reminder.repeat === "weekly" ? 7 : 2, days = Math.round((Date.parse(from + "T12:00:00Z") - Date.parse(reminder.date + "T12:00:00Z")) / 86400000);
    return new Date(Date.parse(reminder.date + "T12:00:00Z") + Math.ceil(days / step) * step * 864e5).toISOString().slice(0, 10);
  }
  let date = from;
  for (let i = 0; i < 400; i++, date = next(date)) if (DDrepeatHits(reminder, date)) return date;
  return "";
}

// The Calendar's reminders that come on `date` (a repeating one is done one day at a time).
export function DDremindersOn(reminders = [], date) {
  return (reminders || [])
    .filter((reminder) => DDrepeatHits(reminder, date))
    .map((reminder) => (reminder.repeat !== "once" && reminder.completedDates?.includes(date) ? { ...reminder, done: true } : reminder));
}

// One day's rows: the Calendar's reminders first (all day), then to-do tasks with a time, by time.
// `due` is that day's deadlines; the ones without a time come back as `deadlines`.
export function DDcalDayRows(reminders = [], due = [], language) {
  const timed = (due || []).filter((i) => i.time).sort((a, b) => a.time.localeCompare(b.time));
  return {
    rows: [
      ...(reminders || []).map((r) => ({ kind: "reminder", id: r.id, title: r.title, done: !!r.done, repeat: r.repeat || "once", ...(r.time ? { time: r.time } : {}) })),
      ...timed.map((i) => ({ kind: "timed", id: i.id, title: DDdueName(i, language), time: i.time, item: i })),
    ],
    deadlines: (due || []).filter((i) => !i.time),
  };
}

// Asking the day panel to open a reminder: it opens there, and its day is picked.
export const DDremOpenEvent = "debug-day-open-reminder";
export function DDopenReminder(id, date) {
  try { window.dispatchEvent(new CustomEvent(DDremOpenEvent, { detail: { id, date } })); } catch {}
}
// A to-do task (todo:<list>:<n>) or a Feed note with a deadline opens where it lives, on the Board.
export function DDremBoardTarget(item) {
  const id = String(item?.id || "");
  if (!id) return null;
  if (!id.startsWith("todo:")) return { life: id };
  const list = id.slice(5).replace(/:\d+$/, "");
  if (list.startsWith("life:")) return { life: list.slice(5) };
  const m = /^(\d{4}-\d{2}-\d{2}):(.+)$/.exec(list);
  return m ? { date: m[1], id: m[2] } : null;
}
export function DDopenOnBoard(item) {
  const detail = DDremBoardTarget(item);
  if (detail) try { window.dispatchEvent(new CustomEvent("debug-day-open-note", { detail })); } catch {}
  return !!detail;
}

// Small pictures: a ring like Reminders (filled with a check when done), a bell for a time, a diamond for a deadline.
export function DDremIcon(h, kind, done, size = 11) {
  const svg = (children) => h("svg", { viewBox: "0 0 12 12", width: size, height: size, "aria-hidden": true, className: "dd-rem-icon" }, ...children);
  if (kind === "timed")
    return svg([h("path", { key: "b", d: "M3 8.6V5.4a3 3 0 0 1 6 0v3.2l.9 1H2.1z", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" }), h("path", { key: "c", d: "M5 10.9a1.1 1.1 0 0 0 2 0", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" })]);
  if (kind === "due") return svg([h("path", { key: "d", d: "M6 1.6 10.4 6 6 10.4 1.6 6z", fill: "currentColor" })]);
  return done
    ? svg([h("circle", { key: "f", cx: 6, cy: 6, r: 5.4, fill: "currentColor" }), h("path", { key: "k", d: "M3.6 6.1l1.6 1.6 3.2-3.4", fill: "none", stroke: "#fff", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })])
    : svg([h("circle", { key: "r", cx: 6, cy: 6, r: 4.8, fill: "none", stroke: "currentColor", strokeWidth: 1.5 })]);
}

// The lines inside a day of the month (or a day of the week): each reminder by name.
// A click on a line is handled by the day (see DDcalOpenFrom), so the day stays one button.
export function DDcalRemLines(h, { rows = [], deadlines = [], date, language, max = 3 }) {
  const t = (en, fa) => (language === "fa" ? fa : en);
  const all = [...rows, ...deadlines.map((i) => ({ kind: "due", id: i.id, title: DDdueName(i, language) }))];
  if (!all.length) return null;
  const shown = all.length > max ? all.slice(0, max - 1) : all, rest = all.length - shown.length, marks = rows.slice(0, 4);
  return h("span", { className: "dd-cal-rems", "data-cal-remind": date, "aria-hidden": true },
    shown.map((r) => h("span", {
        key: r.kind + ":" + r.id,
        className: r.kind === "due" ? "dd-cal-due-line" : "dd-cal-rem",
        "data-cal-open": r.kind, "data-cal-open-id": r.id,
        "data-done": r.done || undefined, "data-timed": r.time ? true : undefined,
        title: (r.time ? r.time + " · " : "") + r.title,
      },
      DDremIcon(h, r.kind, r.done),
      r.time && h("time", null, r.time),
      h("span", { dir: "auto" }, r.title))),
    rest > 0 && h("span", { className: "dd-cal-more" }, t("+" + rest + " more", "+" + rest + " دیگر")),
    // A phone's small day shows a dot for each reminder instead.
    marks.length > 0 && h("span", { className: "dd-cal-rem-dots" }, marks.map((r) => h("i", { key: r.kind + ":" + r.id, "data-done": r.done || undefined }))));
}

// A click inside a day: when it landed on a reminder line, open that reminder.
// Returns true when it opened something.
export function DDcalOpenFrom(target, date, due = []) {
  const line = target?.closest?.("[data-cal-open]");
  if (!line) return false;
  const kind = line.getAttribute("data-cal-open"), id = line.getAttribute("data-cal-open-id");
  if (kind === "reminder") { DDopenReminder(id, date); return true; }
  const item = (due || []).find((i) => i.id === id);
  return item ? DDopenOnBoard(item) : false;
}

export const DDcalRemindersCSS = `
.dd-cal-rems{display:flex;flex-direction:column;gap:1px;min-width:0}
.dd-cal-rem,.dd-cal-due-line{display:flex;align-items:flex-start;gap:5px;min-width:0;margin-inline:-4px;padding:1px 4px;border-radius:6px;font-size:11.5px;font-weight:500;line-height:1.3;color:var(--ink);cursor:pointer}
.dd-cal-rem .dd-rem-icon,.dd-cal-due-line .dd-rem-icon{margin-top:2px}
.dd-cal-rem:hover,.dd-cal-due-line:hover{background:color-mix(in srgb,var(--rem) 14%,transparent)}
.dd-cal-rem .dd-rem-icon{flex:none;color:var(--rem)}
.dd-cal-rem time{flex:none;font-weight:650;color:var(--rem-ink);font-variant-numeric:tabular-nums}
.dd-cal-rem>span,.dd-cal-due-line>span{min-width:0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.dd-cal-rem[data-done]{color:var(--muted)}
.dd-cal-rem[data-done]>span{text-decoration:line-through}
.dd-cal-due-line{color:var(--ink-2,var(--ink))}
.dd-cal-due-line .dd-rem-icon{flex:none;color:#FF3B30;width:9px;height:9px;margin-inline:1px}
.dd-cal-more{padding-inline-start:16px;font-size:11px;font-weight:600;color:var(--muted)}
.dd-cal-rem-dots{display:none}
@media (min-width:701px){.dd-review-root .dd-cal-marks .dd-cal-due{display:none}}
@media (max-width:700px){
 .dd-cal-rem,.dd-cal-due-line,.dd-cal-more{display:none}
 .dd-cal-rem-dots{display:flex;justify-content:center;gap:3px}
 .dd-cal-rem-dots i{width:5px;height:5px;border-radius:50%;background:var(--rem)}
 .dd-cal-rem-dots i[data-done]{opacity:.35}
}
/* the list beside the month: a day, then its reminders, each one opens */
.dd-review-root .dd-cal-reminders ol>li{display:flex;flex-direction:column;gap:1px;padding:4px 0}
.dd-review-root .dd-cal-reminders li>button[data-cal-reminder-day]{min-height:0;padding:4px 8px 2px;border-radius:8px}
.dd-review-root .dd-cal-reminders li>button[data-cal-reminder-day][aria-pressed=true]{background:none}
.dd-review-root .dd-cal-reminders li>button[data-cal-reminder-day][aria-pressed=true] time{color:var(--rem-ink)}
.dd-cal-reminders ul{display:flex;flex-direction:column;gap:1px;margin:0;padding:0;list-style:none}
.dd-review-root .dd-cal-reminders ul button{display:flex;flex-direction:row;align-items:center;gap:8px;width:100%;min-height:34px;padding:6px 8px;border:0;border-radius:10px;background:none;color:var(--ink);text-align:start;font-size:13.5px;font-weight:500;line-height:1.3;white-space:normal}
.dd-review-root .dd-cal-reminders ul button:hover{background:var(--wash)}
.dd-review-root .dd-cal-reminders ul button[data-open]{background:color-mix(in srgb,var(--rem) 13%,transparent)}
.dd-cal-reminders ul .dd-rem-icon{flex:none;color:var(--rem)}
.dd-cal-reminders ul .dd-cal-deadline .dd-rem-icon{color:#FF3B30;width:10px;height:10px;margin-inline:2px}
.dd-cal-reminders ul button>span{flex:1;min-width:0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.dd-cal-reminders ul time{flex:none;font-size:12px;font-weight:650;color:var(--rem-ink);font-variant-numeric:tabular-nums;letter-spacing:0}
.dd-cal-reminders ul i{flex:none;font-style:normal;color:var(--muted);font-weight:400}
.dd-cal-reminders ul .dd-rem-go{flex:none;width:7px;height:7px;border-block-start:1.5px solid var(--ink-4,var(--muted));border-inline-end:1.5px solid var(--ink-4,var(--muted));transform:rotate(45deg);opacity:0;transition:opacity .12s}
[dir=rtl] .dd-cal-reminders ul .dd-rem-go{transform:rotate(-45deg)}
.dd-cal-reminders ul button:hover .dd-rem-go,.dd-cal-reminders ul button:focus-visible .dd-rem-go{opacity:1}
.dd-cal-reminders ul [data-done]>span{text-decoration:line-through;color:var(--muted)}
/* the day's reminders: rows like Reminders, a tap opens one; first under the day's name when it has any */
.dd-review-root .dd-review-day>.dd-review-day-heading{order:-2}
.dd-review-root .dd-review-day>.dd-review-reminders[data-first]{order:-1}
.dd-review-root .dd-review-reminders>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}
.dd-review-root .dd-review-reminders>header h2{display:flex;align-items:center;gap:7px;margin:0}
.dd-review-root .dd-review-reminders>header h2 .dd-rem-icon{color:var(--rem)}
.dd-rem-count{min-width:22px;padding:0 7px;border-radius:999px;background:color-mix(in srgb,var(--rem) 16%,transparent);color:var(--rem-ink);font-size:12px;font-weight:600;text-align:center;line-height:20px}
.dd-review-root .dd-review-reminder{display:grid;grid-template-columns:24px minmax(0,1fr);column-gap:10px;align-items:start;margin:0;padding:10px 0;border:0;border-block-start:1px solid var(--rule,var(--rule-2));border-radius:0}
.dd-review-root .dd-review-reminder:first-of-type{border-block-start:0}
.dd-review-root .dd-rem-check{display:grid;place-items:center;width:22px;height:22px;min-height:0;margin-top:1px;padding:0;border:1.6px solid var(--rem);border-radius:50%;background:none;color:#fff;cursor:pointer}
.dd-review-root .dd-rem-check[aria-pressed=true]{background:var(--rem)}
.dd-review-root .dd-rem-check svg{opacity:0}
.dd-review-root .dd-rem-check[aria-pressed=true] svg{opacity:1}
.dd-review-root .dd-rem-bell{display:grid;place-items:center;width:22px;height:22px;margin-top:1px;border-radius:50%;background:color-mix(in srgb,var(--rem) 16%,transparent);color:var(--rem)}
.dd-review-root .dd-rem-open{display:flex;align-items:center;gap:8px;width:100%;min-height:24px;padding:0;border:0;background:none;color:var(--ink);text-align:start;cursor:pointer}
.dd-review-root .dd-rem-open:hover{background:none}
.dd-rem-open>span{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.dd-review-root .dd-review-reminder .dd-rem-open strong{font-size:15px;font-weight:500;line-height:1.3;overflow-wrap:anywhere}
.dd-review-root .dd-review-reminder .dd-rem-open small{font-size:12.5px;color:var(--ink-3,var(--muted))}
.dd-rem-open time{font-weight:650;color:var(--rem-ink)}
.dd-review-reminder[data-done] .dd-rem-open strong{text-decoration:line-through;color:var(--muted)}
.dd-rem-open .dd-rem-go{flex:none;width:8px;height:8px;margin-inline-end:4px;border-block-start:1.6px solid var(--ink-4,var(--muted));border-inline-end:1.6px solid var(--ink-4,var(--muted));transform:rotate(45deg);transition:transform .15s}
[dir=rtl] .dd-rem-open .dd-rem-go{transform:rotate(-45deg)}
.dd-rem-open[aria-expanded=true] .dd-rem-go{transform:rotate(135deg)}
.dd-review-root .dd-review-reminder .dd-review-item-actions{grid-column:2;margin-top:6px}
.dd-review-root .dd-review-reminder[data-open]{animation:dd-rem-flash 1.2s ease-out}
@keyframes dd-rem-flash{0%{background:color-mix(in srgb,var(--rem) 18%,transparent)}100%{background:transparent}}
.dd-review-root .dd-review-reminder[data-open] .dd-review-item-actions{grid-row:3}
.dd-rem-detail{grid-row:2;grid-column:1/-1;display:grid;gap:10px;margin-top:10px;padding:12px;border-radius:16px;background:var(--wash)}
.dd-rem-detail label{display:grid;gap:4px;font-size:12px;font-weight:500;color:var(--ink-2,var(--muted))}
.dd-review-root .dd-rem-detail input,.dd-review-root .dd-rem-detail textarea{width:100%;min-height:38px;padding:8px 12px;border:0;border-radius:10px;background:var(--panel,var(--paper));color:var(--ink);font:inherit;font-size:14px;box-sizing:border-box}
.dd-review-root .dd-rem-detail textarea{min-height:64px;resize:vertical}
.dd-rem-repeat{display:flex;flex-wrap:wrap;padding:2px;border-radius:10px;background:color-mix(in srgb,var(--ink) 7%,transparent)}
.dd-review-root .dd-rem-repeat button{flex:1 1 30%;min-height:32px;padding:0 6px;white-space:nowrap;border:0;border-radius:8px;background:none;color:var(--ink-2,var(--muted));font-size:12.5px;font-weight:500;box-shadow:none}
.dd-review-root .dd-rem-repeat button[aria-checked=true]{background:var(--panel,var(--paper));color:var(--ink);box-shadow:0 1px 3px #0002}
.dd-rem-detail-actions{display:flex;justify-content:flex-end;gap:6px}
.dd-review-root .dd-rem-detail-actions button{min-height:34px;padding:0 16px;border-radius:999px;font-weight:600}
@media (pointer:coarse){.dd-review-root .dd-rem-check{width:28px;height:28px}.dd-review-root .dd-review-reminder{grid-template-columns:30px minmax(0,1fr)}.dd-review-root .dd-cal-reminders ul button{min-height:44px}}
@media (prefers-reduced-motion:reduce){.dd-review-root .dd-review-reminder[data-open]{animation:none}}
/* the week: reminders above the tasks */
.dd-week-rems{display:flex;flex-direction:column;gap:1px;margin:0 0 4px;padding:0;list-style:none}
.dd-week-rems button{display:flex;align-items:center;gap:5px;width:100%;min-height:24px;padding:2px 6px;border:0;border-radius:8px;background:color-mix(in srgb,var(--rem) 12%,transparent);color:var(--ink);font-size:12px;font-weight:500;text-align:start;cursor:pointer}
.dd-week-rems button:hover{background:color-mix(in srgb,var(--rem) 20%,transparent)}
.dd-week-rems .dd-rem-icon{flex:none;color:var(--rem)}
.dd-week-rems time{flex:none;font-weight:650;color:var(--rem-ink);font-variant-numeric:tabular-nums}
.dd-week-rems button>span{min-width:0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;line-height:1.3}
.dd-week-rems [data-done]>span{text-decoration:line-through;color:var(--muted)}
`;
export function DDinstallCalReminders() {
  if (typeof document === "undefined" || document.getElementById("dd-cal-reminders")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-cal-reminders", textContent: DDcalRemindersCSS }));
}
