// The Calendar's month (5.57): how full each day was and how much of it got
// done, readable at a glance. Nothing here is a score or a target. "Full" is
// measured against your own usual day, not against a fixed number of hours.
import { DDplanMinutes } from "./measure.js";
import { DDenergyOf } from "./energy.js";

const named = (b) => b && String(b.name || "").trim();
// A heavy task weighs a little more than its minutes; a task with no time
// still counts for something.
const weight = (b) => (DDplanMinutes(b) || 30) + (DDenergyOf(b) === "heavy" ? 45 : 0);

// The middle of how much you usually plan on a day that has tasks (last 60
// days before `today`). Falls back to 5 hours until there are a few days.
export function DDusualMinutes(days = {}, today = "") {
  const list = Object.values(days || {})
    .filter((d) => d?.date && (!today || (d.date < today && d.date >= shift(today, -60))))
    .map((d) => (d.blocks || []).filter(named).reduce((sum, b) => sum + weight(b), 0))
    .filter((m) => m > 0)
    .sort((a, b) => a - b);
  if (list.length < 5) return 300;
  const middle = list[Math.floor(list.length / 2)];
  return Math.max(120, middle);
}
function shift(date, amount) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

// One day: how full (level 0 = nothing, 1 light, 2 steady, 3 full, 4 packed)
// and how much is done (tasks and planned time).
export function DDdayLoad(day, usual = 300) {
  const blocks = (day?.blocks || []).filter(named),
    minutes = blocks.reduce((sum, b) => sum + weight(b), 0),
    done = blocks.filter((b) => b.done),
    doneMinutes = done.reduce((sum, b) => sum + weight(b), 0),
    ratio = usual > 0 ? minutes / usual : 0;
  return {
    tasks: blocks.length,
    done: done.length,
    minutes,
    planned: blocks.reduce((sum, b) => sum + (DDplanMinutes(b) || 0), 0),
    share: minutes ? Math.round((doneMinutes / minutes) * 100) : 0,
    allDone: blocks.length > 0 && done.length === blocks.length,
    level: !blocks.length ? 0 : ratio < 0.5 ? 1 : ratio < 1.05 ? 2 : ratio < 1.4 ? 3 : 4,
  };
}

export function DDloadName(level, language) {
  const fa = language === "fa";
  return [
    fa ? "خالی" : "Empty",
    fa ? "سبک" : "Light",
    fa ? "معمولی" : "Steady",
    fa ? "پر" : "Full",
    fa ? "خیلی پر" : "Packed",
  ][level] || "";
}

// The month in a line: tasks done, full days and the fullest day so far.
export function DDmonthLoad(days = {}, dates = [], usual = 300, today = "") {
  let tasks = 0, done = 0, full = 0, finished = 0, top = null;
  for (const date of dates) {
    const load = DDdayLoad(days[date], usual);
    if (!load.tasks) continue;
    tasks += load.tasks;
    done += load.done;
    if (load.level >= 3) full += 1;
    if (load.allDone && (!today || date <= today)) finished += 1;
    if (!top || load.minutes > top.minutes) top = { date, minutes: load.minutes, level: load.level };
  }
  return { tasks, done, full, finished, top };
}

// The other calendar's day number, shown small beside the main one.
const altFormats = new Map();
export function DDaltDay(date, system, language) {
  const other = system === "persian" ? "gregory" : "persian",
    key = other + language;
  if (!altFormats.has(key))
    altFormats.set(key, new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", { calendar: other, day: "numeric", timeZone: "UTC" }));
  try { return altFormats.get(key).format(new Date(date + "T12:00:00Z")); } catch { return ""; }
}
export function DDaltMonth(date, system, language) {
  const other = system === "persian" ? "gregory" : "persian";
  try {
    return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", { calendar: other, month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
  } catch { return ""; }
}

// Short time for a small space: "45m", "3h", "3.5h" (Persian: "۴۵د"، "۳٫۵س").
export function DDshortTime(minutes, language) {
  const fa = language === "fa", m = Math.max(0, Math.round(minutes || 0));
  if (!m) return "";
  if (m < 60) return fa ? m.toLocaleString("fa-IR") + "د" : m + "m";
  const hours = Math.round(m / 30) / 2;
  return fa ? hours.toLocaleString("fa-IR") + "س" : hours + "h";
}

export const DDcalendarLookCSS = `
.dd-review-root{max-width:1240px}
.dd-review-root .dd-review-columns{grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:20px}
.dd-review-root .dd-review-columns>.dd-review-calendar{position:static}
.dd-review-root .dd-review-columns>.dd-review-day{position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;scrollbar-width:thin}
.dd-review-root .dd-review-calendar{padding:22px 22px 18px;border-radius:16px;border-color:var(--rule-2);box-shadow:0 1px 2px #0000000d}
.dd-review-root .dd-review-calendar-head{align-items:center;margin-bottom:6px;gap:12px 16px}
.dd-review-root .dd-review-calendar-head h2{font-size:28px;font-weight:650;letter-spacing:-.01em;line-height:1.2}
.dd-review-root .dd-review-calendar-head p{margin:2px 0 0;font-size:13px}
.dd-cal-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dd-review-root .dd-cal-tools button{min-height:36px;padding:0 12px;border-radius:9px;font-size:13px}
.dd-review-root .dd-review-month-controls{display:flex;gap:4px;margin:0}
.dd-review-root .dd-review-month-controls button{min-height:36px;padding:0 12px;border-radius:9px}
.dd-review-root .dd-review-month-controls button:first-child,.dd-review-root .dd-review-month-controls button:last-child{width:36px;padding:0;font-size:16px}
.dd-cal-seg,.dd-review-root .dd-cal-modes{display:inline-flex;padding:3px;border-radius:10px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule-2)}
.dd-review-root .dd-cal-seg button,.dd-review-root .dd-cal-modes button{min-height:30px;padding:0 10px;border:0;border-radius:7px;color:var(--ink-2,var(--muted));background:none;font-weight:500}
.dd-review-root .dd-cal-seg button[aria-checked=true],.dd-review-root .dd-cal-modes button[aria-pressed=true]{background:var(--paper);color:var(--ink);box-shadow:0 1px 2px #0002}
.dd-review-root .dd-cal-tools .dd-week-modes{margin:0}
.dd-cal-summary{display:flex;flex-wrap:wrap;gap:6px 18px;margin:14px 0 16px;padding:0;list-style:none;font-size:13px;color:var(--muted)}
.dd-cal-summary b{color:var(--ink);font-weight:600;font-size:15px;margin-inline-end:4px}
.dd-review-root .dd-review-month-grid{gap:6px}
.dd-review-root .dd-review-weekday{font:600 11px/2 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding:0 0 4px}
.dd-review-root .dd-review-month-grid button.dd-review-date{display:grid;grid-template-rows:auto 1fr auto;align-items:start;justify-items:stretch;min-height:104px;padding:9px 10px 8px;gap:4px;border:1px solid var(--rule-2);border-radius:12px;background:color-mix(in srgb,var(--load,transparent) 100%,var(--paper));color:var(--ink);text-align:start;line-height:1.3;transition:border-color .12s,box-shadow .12s}
.dd-review-root .dd-review-month-grid button.dd-review-date:hover{border-color:var(--ink-3,var(--muted));background:color-mix(in srgb,var(--load,transparent) 100%,var(--paper))}
.dd-review-root [data-load="1"]{--load:color-mix(in srgb,var(--panel-calendar,#1E9BB3) 7%,transparent)}
.dd-review-root [data-load="2"]{--load:color-mix(in srgb,var(--panel-calendar,#1E9BB3) 15%,transparent)}
.dd-review-root [data-load="3"]{--load:color-mix(in srgb,var(--panel-calendar,#1E9BB3) 27%,transparent)}
.dd-review-root [data-load="4"]{--load:color-mix(in srgb,#E8833A 30%,transparent)}
.dd-review-root .dd-review-month-grid .dd-review-date.outside{opacity:.38}
.dd-review-root .dd-review-month-grid .dd-review-date[aria-pressed=true]{background:color-mix(in srgb,var(--load,transparent) 100%,var(--paper));color:var(--ink);border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.dd-review-root .dd-review-month-grid .dd-review-date.today{box-shadow:none}
.dd-review-root .dd-review-month-grid .dd-review-date.today[aria-pressed=true]{box-shadow:inset 0 0 0 1px var(--ink)}
.dd-review-root .dd-review-date-top{display:flex;align-items:center;justify-content:space-between;gap:4px}
.dd-cal-num{display:inline-flex;align-items:baseline;gap:5px;min-width:0}
.dd-review-root .dd-review-date strong{font-size:17px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.dd-review-root .dd-review-date.today strong{display:inline-grid;place-items:center;min-width:28px;height:28px;margin:-5px 0 -5px -5px;padding:0 5px;border-radius:999px;background:var(--panel-calendar,#1E9BB3);color:#fff;text-decoration:none}
[dir=rtl] .dd-review-root .dd-review-date.today strong{margin:-5px -5px -5px 0}
.dd-cal-alt{font-size:10.5px;font-style:normal;color:var(--muted);white-space:nowrap}
.dd-review-root .dd-review-date-mood{font-size:15px;line-height:1}
.dd-cal-marks{display:inline-flex;gap:3px;align-items:center}
.dd-review-root .dd-cal-due{position:static;font-size:10px;color:#D9534F;line-height:1}
.dd-cal-remind{width:6px;height:6px;border-radius:50%;background:var(--panel-calendar,#1E9BB3)}
.dd-cal-body{display:flex;flex-direction:column;justify-content:flex-end;gap:5px;min-height:0}
.dd-cal-meter{position:relative;display:block;height:6px;border-radius:999px;background:color-mix(in srgb,var(--ink) 12%,transparent);overflow:hidden}
.dd-cal-meter i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:inherit;background:var(--ink)}
.dd-review-date[data-all-done=true] .dd-cal-meter i{background:#2BA672}
.dd-cal-meta{display:flex;justify-content:space-between;gap:4px;font-size:11.5px;line-height:1.2;color:var(--ink-2,var(--muted));font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden}
.dd-cal-meta b{font-weight:600;color:var(--ink)}
.dd-cal-check{color:#2BA672;font-weight:700}
.dd-cal-word{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-review-root .dd-review-date .dd-cal-sections{position:static;height:3px;margin:0;border-radius:999px;overflow:hidden}
.dd-review-root .dd-review-date small{display:none}
.dd-cal-legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:16px;padding-top:12px;border-top:1px solid var(--rule-2);font-size:12px;color:var(--muted)}
.dd-cal-legend span{display:inline-flex;align-items:center;gap:6px}
.dd-cal-legend i[data-load]{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid var(--rule-2);background:color-mix(in srgb,var(--load,transparent) 100%,var(--paper))}
.dd-cal-legend .dd-cal-meter{width:28px;display:inline-block}
.dd-review-root .dd-review-calendar-key{display:none}
/* the day beside it */
.dd-review-root .dd-review-day-heading{padding-bottom:12px;align-items:center}
.dd-review-root .dd-review-day-heading h2{font-size:20px;line-height:1.3}
.dd-review-root .dd-review-day-heading small{display:inline-block;margin:0 0 4px;padding:0 8px;border-radius:999px;background:var(--wash);color:var(--ink-2,var(--muted));font-size:11.5px}
.dd-review-root .dd-review-day-heading time{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.dd-review-root .dd-review-overview{padding:16px 18px;border-radius:14px;background:color-mix(in srgb,var(--load,transparent) 100%,var(--paper))}
.dd-review-root .dd-review-overview h2{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px}
.dd-cal-load-word{padding:2px 10px;border-radius:999px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--rule-2);font-size:12px;font-weight:500;color:var(--ink)}
.dd-review-root .dd-review-overview .dd-cal-meter{height:8px;margin:12px 0 0}
.dd-review-root .dd-review-overview dl{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0 0}
.dd-review-root .dd-review-overview dd{font-size:20px;line-height:1.3;margin:2px 0 0;font-weight:600;font-variant-numeric:tabular-nums}
.dd-review-root .dd-review-overview .dd-review-focus{grid-column:1/-1}
.dd-review-root .dd-review-overview .dd-review-focus dd{font-size:15px;font-weight:500}
.dd-cal-hint{margin:10px 0 0!important;font-size:12.5px;color:var(--ink-2,var(--muted))}
@media (max-width:1100px){.dd-review-root .dd-review-columns{grid-template-columns:minmax(0,1fr) minmax(280px,330px)}.dd-review-root .dd-review-month-grid button.dd-review-date{min-height:92px;padding:8px}}
@media (max-width:900px){
 .dd-review-root .dd-review-columns{display:flex;flex-direction:column}
 .dd-review-root .dd-review-columns>.dd-review-day{position:static;max-height:none;overflow:visible}
}
@media (min-width:701px){.dd-review-root .dd-review-day-heading .dd-review-text-button{display:none}}
@media (max-width:700px){
 .dd-review-root .dd-review-calendar{padding:14px 10px 12px;border-radius:14px}
 .dd-review-root .dd-review-calendar-head{padding-inline:4px;flex-direction:column;align-items:stretch;gap:10px}
 .dd-review-root .dd-review-calendar-head>div{flex:none}
 .dd-cal-tools{gap:6px}
 .dd-cal-tools>.dd-review-month-controls{flex:1 1 100%}
 .dd-cal-tools>.dd-review-month-controls button:nth-child(2){flex:1}
 .dd-cal-tools>.dd-cal-seg,.dd-cal-tools>.dd-cal-modes{flex:1 1 0}
 .dd-review-root .dd-cal-tools .dd-cal-seg button,.dd-review-root .dd-cal-tools .dd-cal-modes button{flex:1;padding:0 6px;height:auto;min-height:34px}
 .dd-review-root .dd-review-calendar-head h2{font-size:22px}
 .dd-cal-summary{margin:10px 4px 12px;gap:4px 12px;font-size:12px}
 .dd-cal-summary b{font-size:14px}
 .dd-review-root .dd-review-month-grid{gap:3px}
 .dd-review-root .dd-review-weekday{font-size:10px;letter-spacing:0}
 .dd-review-root .dd-review-month-grid button.dd-review-date{min-height:64px;padding:6px 4px 5px;border-radius:9px;gap:3px}
 .dd-review-root .dd-review-date strong{font-size:14px}
 .dd-review-root .dd-review-month-grid .dd-review-date.today strong{min-width:22px;height:22px;margin:-3px 0;padding:0 3px}
 .dd-cal-alt,.dd-cal-meta,.dd-cal-word{display:none}
 .dd-review-root .dd-review-date-mood{font-size:11px}
 .dd-review-root .dd-review-date-top{flex-direction:column;align-items:center;gap:2px}
 .dd-cal-marks{min-height:12px}
 .dd-cal-meter{height:4px}
 .dd-cal-legend{gap:6px 12px;font-size:11px;padding-inline:4px}
}
`;
export function DDinstallCalendarLook() {
  if (typeof document === "undefined" || document.getElementById("dd-calendar-look")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-calendar-look", textContent: DDcalendarLookCSS }));
}
