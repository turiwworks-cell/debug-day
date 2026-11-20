// Gentle nudges at the top of the Engine (5.45). Each one is a single calm line with
// one button and a way to say "not today". Nothing is red and nothing moves on
// its own; the person decides.
import { DDengineCarry, DDcarryCopies, DDengineCarryHidden, DDhideEngineCarry } from "./engine.js";
import { DDplanMinutes, DDduration } from "./measure.js";
import { DDlowDay, DDlightTasks, DDlightFirst } from "./energy.js";
import { DDaddDays } from "./dates.js";
import { DDpriorityWeight } from "./planner.js";
import { DDroomPart, DDroomNear } from "./upkeep.js";

// A day this full is a lot for one person: more than 10 hours, or 12 open tasks.
export const DDfullMinutes = 600, DDfullCount = 12;
const FULL_KEY = "debug-day:full-day-ok", LOW_KEY = "debug-day:low-day-ok", ROOM_KEY = "debug-day:room-ok";

export function DDdayLoad(day) {
  const open = (day?.blocks || []).filter((b) => !b.done && !b.carriedTo && String(b.name || "").trim());
  return { open, minutes: open.reduce((sum, b) => sum + DDplanMinutes(b), 0) };
}

export function DDdayFull(day) {
  const load = DDdayLoad(day);
  return load.minutes > DDfullMinutes || load.open.length >= DDfullCount;
}

// The task that is easiest to move to another day (5.86.1, L2): the least
// important first (a normal task, then P3, P2, and P1 last), then one not
// started yet, then the longest (it frees the most room), then the first in
// the list. A task set for a time (09:00) is a promise and stays where it is.
const started = (b) =>
  (function any(items) { return (items || []).some((s) => s?.done || any(s?.children)); })(b.subtasks) ||
  (b.measure === "count" && Number(b.count) > 0) ||
  Number(b.spent) > 0;
export function DDmoveCandidate(day) {
  const free = DDdayLoad(day).open.filter((b) => !b.at);
  const rank = (b, i) => [DDpriorityWeight(b), started(b) ? 1 : 0, -DDplanMinutes(b), i];
  const before = (x, y) => { for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k]; return false; };
  let best = null, bestRank = null;
  free.forEach((b, i) => { const r = rank(b, i); if (!best || before(r, bestRank)) (best = b), (bestRank = r); });
  return best;
}

// Move one task to another day (the same task, so every view follows).
export function DDmoveToDay(data, from, to, id, ensureDay = (date) => ({ date, blocks: [], notes: [], bugs: [] })) {
  const source = data.days[from] || ensureDay(from), block = source.blocks.find((b) => b.id === id);
  if (!block || from === to) return data;
  const target = data.days[to] || ensureDay(to);
  return { ...data, days: { ...data.days, [from]: { ...source, blocks: source.blocks.filter((b) => b.id !== id) }, [to]: { ...target, blocks: [...target.blocks.filter((b) => b.id !== id), structuredClone(block)] } } };
}
export const DDnextDay = (date) => DDaddDays(date, 1);
const shortDate = (date, language) => { try { return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z")); } catch { return date; } };

// Line icons, like the rest of the app (DESIGN.md › Icons).
const icon = (h, d) => h("svg", { className: "dd-nudge-icon", viewBox: "0 0 16 16", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d }));
const hidden = (key, date) => { try { return localStorage.getItem(key) === date; } catch { return false; } };
const hide = (key, date) => { try { localStorage.setItem(key, date); } catch {} };

export function DDPlanNudges({ React: R, day, days, date, today, language, makeId, onUpdateDay, onCarry, onMove, dateLabel, without = [] }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en),
    num = (n) => (fa ? n.toLocaleString("fa-IR") : String(n)),
    [, redraw] = R.useState(0);
  if (!day || !date || date < today) return null;
  const lines = [];
  // 1. Yesterday's leftovers, first thing on today's Plan.
  // The Engine shows its own carry line (with "Choose…"), so it passes without: ["carry"].
  const carry = date === today && days && !without.includes("carry") ? DDengineCarry(days, day) : null;
  if (carry?.count > 0 && !DDengineCarryHidden(date)) {
    const all = [...carry.open, ...carry.waiting], when = carry.date ? (dateLabel ? dateLabel(carry.date) : shortDate(carry.date, language)) : "";
    lines.push(h("div", { key: "carry", className: "dd-nudge", "data-nudge": "carry", role: "group", "aria-label": t("Still open", "هنوز باز") },
      icon(h, "M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5"),
      h("div", { className: "dd-nudge-text" },
        h("b", null, carry.count === 1 ? t("1 left from " + when, "۱ کار از " + when + " مانده") : t(carry.count + " left from " + when, num(carry.count) + " کار از " + when + " مانده")),
        h("small", { dir: "auto", title: all.map((b) => b.name).join(" · ") }, all.map((b) => b.name).join(" · "))),
      h("button", { type: "button", className: "dd-nudge-go", onClick: () => (onCarry ? onCarry(carry.items) : onUpdateDay((d) => ({ ...d, blocks: [...d.blocks, ...DDcarryCopies(carry.items, d)] }))) },
        carry.count === 1 ? t("Bring it", "بیارش") : t("Bring them", "بیارشون")),
      h("button", { type: "button", className: "dd-nudge-later", onClick: () => { DDhideEngineCarry(date); redraw((n) => n + 1); } }, t("Not today", "امروز نه"))));
  }
  // 2. A very full day: offer to move one task to tomorrow.
  const load = DDdayLoad(day), pick = DDmoveCandidate(day);
  if (onMove && DDdayFull(day) && pick && !hidden(FULL_KEY, date)) {
    const size = load.minutes > DDfullMinutes ? DDduration(load.minutes, language) : t(load.open.length + " tasks", num(load.open.length) + " کار");
    lines.push(h("div", { key: "full", className: "dd-nudge", "data-nudge": "full", role: "group", "aria-label": t("A full day", "روز پر") },
      icon(h, "M2.5 4.5h11M2.5 8h11M2.5 11.5h7"),
      h("div", { className: "dd-nudge-text" },
        h("b", null, t("This day is very full (" + size + ")", "این روز خیلی پره (" + size + ")")),
        h("small", { dir: "auto" }, t("Move one thing to tomorrow?", "یه چیزش رو ببریم فردا؟"))),
      h("button", { type: "button", className: "dd-nudge-go", dir: "auto", onClick: () => onMove(pick.id) }, t("Move “" + pick.name + "”", "بردن «" + pick.name + "»")),
      h("button", { type: "button", className: "dd-nudge-later", onClick: () => { hide(FULL_KEY, date); redraw((n) => n + 1); } }, t("It’s fine", "اشکالی نداره"))));
  }
  // 3. A tired day (😫 or 😕): point to the tasks marked light (energy.js).
  const light = DDlightTasks(day);
  if (DDlowDay(day) && light.length && !hidden(LOW_KEY, date)) {
    lines.push(h("div", { key: "low", className: "dd-nudge", "data-nudge": "low", role: "group", "aria-label": t("A tired day", "روز خسته") },
      icon(h, "M12.5 3.5c-4.5 0-7.5 3-7.5 7.5v1.5M5 12.5l-2 2M5 10h4.5M7 7h4.5"),
      h("div", { className: "dd-nudge-text" },
        h("b", null, t("A tired day. Start with something light?", "روز خسته‌ایه. با یه کار سبک شروع کنی؟")),
        h("small", { dir: "auto", title: light.map((b) => b.name).join(" · ") }, light.map((b) => b.name).join(" · "))),
      h("button", { type: "button", className: "dd-nudge-go", onClick: () => { onUpdateDay((d) => DDlightFirst(d)); hide(LOW_KEY, date); redraw((n) => n + 1); } }, t("Light ones first", "سبک‌ها اول")),
      h("button", { type: "button", className: "dd-nudge-later", onClick: () => { hide(LOW_KEY, date); redraw((n) => n + 1); } }, t("Not today", "امروز نه"))));
  }
  // 4. The planner nears the 1.5 MB sync limit (5.92.0): once a day, on today.
  const room = date === today ? DDroomPart() : 0;
  if (room >= DDroomNear && !hidden(ROOM_KEY, date)) {
    const pct = Math.min(100, Math.round(room * 100));
    lines.push(h("div", { key: "room", className: "dd-nudge", "data-nudge": "room", role: "group", "aria-label": t("Room in your planner", "جای برنامه") },
      icon(h, "M2.5 4.5h11v8h-11zM2.5 7h11M6 9.5h4"),
      h("div", { className: "dd-nudge-text" },
        h("b", null, t("Your planner is " + pct + "% full", "برنامه‌ات " + num(pct) + "٪ پر است")),
        h("small", null, t("Archiving old months makes room.", "بایگانی ماه‌های قدیمی جا باز می‌کند."))),
      h("button", { type: "button", className: "dd-nudge-go", onClick: () => { hide(ROOM_KEY, date); window.dispatchEvent(new CustomEvent("debug-day-open-settings", { detail: "room" })); } }, t("See what takes room", "ببین چه چیزی جا گرفته")),
      h("button", { type: "button", className: "dd-nudge-later", onClick: () => { hide(ROOM_KEY, date); redraw((n) => n + 1); } }, t("Not today", "امروز نه"))));
  }
  return lines.length ? h("div", { className: "dd-nudges", dir: fa ? "rtl" : "ltr" }, lines) : null;
}

export const DDnudgesCSS = `
.dd-nudges{display:flex;flex-direction:column;gap:6px;margin:4px 0 10px}
.dd-nudge{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;border-radius:12px;background:var(--wash,#f1efe9);box-shadow:inset 0 0 0 1px var(--rule,#e6e3da);min-width:0}
.dd-nudge-icon{width:16px;height:16px;color:var(--ink-3,#77746b);flex:none}
.dd-nudge-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dd-nudge-text b{font:600 13px/1.3 var(--sans);color:var(--ink,#121211)}
.dd-nudge-text small{font-size:12px;color:var(--ink-3,#77746b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-nudge button{flex:none;height:30px;padding:0 12px;border-radius:999px;border:0;font:500 12px/1 var(--sans);cursor:pointer;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-nudge-go{background:var(--ink,#121211);color:var(--paper,#fff)}
.dd-nudge-later{background:none;color:var(--ink-2,#4a4843)}
.dd-nudge-later:hover{color:var(--ink,#121211)}
@media (pointer:coarse){.dd-nudge button{height:44px}}
body:not(.dd-phone-today) .dd-today-card .dd-nudges{display:none}
@media (max-width:520px){.dd-nudge{flex-wrap:wrap}.dd-nudge-text{flex-basis:calc(100% - 30px)}.dd-nudge button{max-width:none}}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-nudges-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-nudges-styles", textContent: DDnudgesCSS }));
