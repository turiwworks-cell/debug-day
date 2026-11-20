// The daily routine (5.56): the parts of every morning that repeat, done for
// you only when you ask. Nothing here is on by default and nothing is strict:
// - Each morning, what is still open from the last day can be brought into
//   today, parked, or left for you to choose (the Engine's carry line).
// - A task can repeat every day. It is kept in the day templates (Settings),
//   so each new day starts with it, and stops when you say so.
import { DDengineCarry, DDcarryOn, DDengineParked, DDengineEarlierDay, DDhideEngineCarry } from "./engine.js";

export const DDroutineModes = ["ask", "bring", "park"];
const RAN_KEY = "debug-day:routine-ran";
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// What the person chose, kept in preferences so it syncs. "ask" is the default.
// `ran` is the last day the routine ran, kept with it so every device knows
// (5.86.2, L4): the routine runs once a day, not once per device.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function DDroutineOf(setup) {
  const r = setup?.preferences?.routine;
  return { leftovers: DDroutineModes.includes(r?.leftovers) ? r.leftovers : "ask", ran: DAY.test(r?.ran || "") ? r.ran : "" };
}
export function DDroutineClean(routine) {
  if (!routine || !DDroutineModes.includes(routine.leftovers) || routine.leftovers === "ask") return null;
  return DAY.test(routine.ran || "") ? { leftovers: routine.leftovers, ran: routine.ran } : { leftovers: routine.leftovers };
}
export function DDsetRoutine(setup, patch) {
  const next = DDroutineClean({ ...DDroutineOf(setup), ...patch }), preferences = { ...(setup.preferences || {}) };
  if (next) preferences.routine = next;
  else delete preferences.routine;
  return { ...setup, preferences };
}

// This morning's leftovers, done the chosen way. Returns null when there is
// nothing to do, or { data, mode, from, names }. Running it again does nothing
// new: tasks already in today (or already parked) are left alone.
// Since 5.86.2 (L3) the tasks are carried on, not copied fresh: their done
// steps stay, and the last day marks them carried on so it no longer counts
// them as left undone. The day it ran is kept in the synced routine (L4).
export function DDroutineMorning(data, today, ensureDay = (date) => ({ date, blocks: [], notes: [], bugs: [] })) {
  const { leftovers, ran } = DDroutineOf(data?.setup);
  if (leftovers === "ask" || !data?.days || ran === today) return null;
  const day = data.days[today] || ensureDay(today),
    carry = DDengineCarry(data.days, day),
    parked = DDengineParked(data.setup),
    items = carry.items.filter(({ block }) => leftovers === "bring" || !parked.some((p) => same(p.name, block.name) || p.carriedFrom?.id === block.id));
  if (!items.length) return null;
  const next = DDcarryOn(data, items, leftovers === "bring" ? today : "park", ensureDay);
  return { data: { ...next, setup: DDsetRoutine(next.setup, { ran: today }) }, mode: leftovers, from: carry.date, names: items.map(({ block }) => block.name) };
}

// Repeat every day: a copy of the task in every day template (each day uses
// one template, so every day gets it). A task that came from a template has
// the id "v" + the template task's id.
const templates = (setup) => (Array.isArray(setup?.templates) ? setup.templates : []);
export function DDrepeatId(setup, block) {
  const id = String(block?.id || "");
  if (id.startsWith("v") && templates(setup).some((tp) => (tp.blocks || []).some((b) => b.id === id.slice(1)))) return id.slice(1);
  return "rt" + id;
}
export function DDrepeats(setup, block) {
  const id = DDrepeatId(setup, block);
  return templates(setup).some((tp) => (tp.blocks || []).some((b) => b.id === id));
}
export function DDsetRepeat(setup, block, on) {
  const id = DDrepeatId(setup, block), list = templates(setup);
  if (!list.length || !block) return setup;
  if (!on) return { ...setup, templates: list.map((tp) => ({ ...tp, blocks: (tp.blocks || []).filter((b) => b.id !== id) })) };
  const steps = (items) => (items || []).map((s) => ({ ...s, done: false, children: steps(s.children) }));
  const copy = { ...structuredClone(block), id, done: false, subtasks: steps(block.subtasks) };
  for (const key of ["score", "bx", "by", "noteRef", "after", "count"]) delete copy[key];
  return { ...setup, templates: list.map((tp) => ((tp.blocks || []).some((b) => b.id === id) ? tp : { ...tp, blocks: [...(tp.blocks || []), copy] })) };
}
// Every task that repeats every day, once each (the ones in all templates).
export function DDrepeatList(setup) {
  const list = templates(setup);
  if (!list.length) return [];
  return (list[0].blocks || []).filter((b) => list.every((tp) => (tp.blocks || []).some((x) => x.id === b.id)));
}

const ran = (date) => { try { return localStorage.getItem(RAN_KEY) === date; } catch { return false; } };
const mark = (date) => { try { localStorage.setItem(RAN_KEY, date); } catch {} };

// With sync on, the routine waits for this visit's first sync (5.86.2, L4), so
// it sees what the other devices already did; with no answer it goes ahead
// after 20 seconds. `cloud` reads the sync state.
export function DDroutineSettled(cloud) {
  let state = null;
  try { state = typeof cloud === "function" ? cloud() : null; } catch {}
  return !state || !state.connected || !!state.lastSync || !!state.error;
}
// Mounted once by the app: does the morning routine the first time today is
// seen, once a day across devices, and says what it did.
export function DDDailyRoutine({ React: R, data, today, setData, ensureDay, makeId, language, onToast, cloud }) {
  const fa = language === "fa", t = (en, f) => (fa ? f : en),
    { leftovers, ran: ranOn } = DDroutineOf(data?.setup),
    earlier = DDengineEarlierDay(data?.days || {}, today)?.date || "",
    [settled, setSettled] = R.useState(() => DDroutineSettled(cloud)),
    latest = R.useRef(data);
  latest.current = data;
  R.useEffect(() => {
    if (settled) return;
    const check = () => DDroutineSettled(cloud) && setSettled(true),
      timer = setTimeout(() => setSettled(true), 20000);
    window.addEventListener("debug-day-cloud-status", check);
    check();
    return () => (window.removeEventListener("debug-day-cloud-status", check), clearTimeout(timer));
  }, [settled]);
  R.useEffect(() => {
    if (!settled || leftovers === "ask" || !earlier || ranOn === today || ran(today)) return;
    const result = DDroutineMorning(latest.current, today, ensureDay, makeId);
    if (!result) return;
    mark(today);
    setData((old) => DDroutineMorning(old, today, ensureDay, makeId)?.data || old);
    // Parked ones no longer need the carry line today.
    if (result.mode === "park") DDhideEngineCarry(today);
    const n = result.names.length;
    onToast?.(result.mode === "bring"
      ? t(n === 1 ? "Brought 1 open task into today" : `Brought ${n} open tasks into today`, `${n.toLocaleString("fa-IR")} کار باز به امروز آمد`)
      : t(n === 1 ? "Parked 1 open task from the last day" : `Parked ${n} open tasks from the last day`, `${n.toLocaleString("fa-IR")} کار باز روز قبل پارک شد`));
  }, [settled, today, leftovers, earlier, ranOn]);
  return null;
}

// The Engine's "Routine" panel: how mornings start, and what repeats.
export function DDRoutinePanel({ React: R, setup, language, onSetup, onClose }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en),
    { leftovers } = DDroutineOf(setup),
    repeating = DDrepeatList(setup),
    options = [
      ["ask", t("Ask me", "از من بپرس"), t("The Engine offers them; you choose", "انجین پیشنهاد می‌دهد؛ تو انتخاب می‌کنی")],
      ["bring", t("Bring them to Today", "بیارشون به امروز"), t("They are added to today by themselves", "خودشان به امروز اضافه می‌شوند")],
      ["park", t("Park them", "پارکشون کن"), t("They wait in Park until you want them", "در پارک می‌مانند تا هر وقت خواستی")],
    ];
  return h("div", { className: "dd-routine", role: "dialog", "aria-label": t("Daily routine", "روال روزانه"), dir: fa ? "rtl" : "ltr",
      onKeyDown: (event) => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } } },
    h("header", null, h("strong", null, t("Daily routine", "روال روزانه")), h("button", { type: "button", className: "dd-routine-close", "aria-label": t("Close", "بستن"), onClick: onClose }, "×")),
    h("p", { className: "dd-routine-label" }, t("Each morning, tasks still open from the last day:", "هر صبح، کارهایی که از روز قبل باز مانده‌اند:")),
    h("div", { className: "dd-routine-modes", role: "radiogroup", "aria-label": t("Open tasks from the last day", "کارهای باز روز قبل") },
      options.map(([id, label, hint]) => h("button", { key: id, type: "button", role: "radio", "aria-checked": leftovers === id, "data-routine-mode": id, title: hint, onClick: () => onSetup((s) => DDsetRoutine(s, { leftovers: id })) }, label))),
    h("p", { className: "dd-routine-label" }, t("Every day:", "هر روز:")),
    repeating.length
      ? h("ul", { className: "dd-routine-list" }, repeating.map((b) => h("li", { key: b.id, "data-routine-repeat": b.id },
          h("bdi", null, b.name || t("Task", "کار")),
          h("button", { type: "button", "aria-label": t("Stop repeating ", "دیگر تکرار نشود: ") + (b.name || ""), onClick: () => onSetup((s) => DDsetRepeat(s, { id: "v" + b.id }, false)) }, t("Stop", "توقف")))))
      : h("p", { className: "dd-routine-empty" }, t("Nothing repeats yet. Open a task's ⋯ and choose Repeat every day.", "هنوز چیزی تکرار نمی‌شود. ⋯ یک کار را باز کن و «هر روز تکرار شود» را بزن.")));
}

export const DDroutineCSS = `
.dd-engine-routine-toggle{min-height:30px;padding:0 12px;border:0;border-radius:8px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002);background:none;color:var(--ink-2,#4a4843);font:500 12.5px var(--sans);cursor:pointer}
.dd-engine-routine-toggle[aria-expanded=true],.dd-engine-routine-toggle:hover{background:var(--wash,#0000000d);color:var(--ink,#121211)}
.dd-engine-head:has(>.dd-routine){position:relative}
.dd-routine{position:absolute;z-index:20;inset-inline-end:18px;top:calc(100% + 4px);width:min(360px,calc(100% - 36px));display:flex;flex-direction:column;gap:8px;padding:12px 14px 14px;border:1px solid var(--rule-2,#0002);border-radius:12px;background:var(--raise,var(--paper,#fff));box-shadow:0 12px 32px #00000030}
.dd-routine header{display:flex;align-items:center;justify-content:space-between}
.dd-routine-close{width:28px;height:28px;border:0;border-radius:50%;background:none;color:var(--ink-3,#77746b);font-size:18px;cursor:pointer}
.dd-routine-label{margin:4px 0 0;font-size:12.5px;color:var(--ink-2,#4a4843)}
.dd-routine-modes{display:flex;flex-wrap:wrap;gap:6px}
.dd-routine-modes button{min-height:30px;padding:0 12px;border:0;border-radius:999px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002);background:none;color:var(--ink,#121211);font:500 12.5px var(--sans);cursor:pointer}
.dd-routine-modes button[aria-checked=true]{background:var(--ink,#121211);color:var(--paper,#fff);box-shadow:none}
.dd-routine-list{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.dd-routine-list li{display:flex;align-items:center;gap:8px;min-height:30px;font-size:13px}
.dd-routine-list bdi{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-routine-list button{border:0;background:none;color:var(--ink-3,#77746b);font-size:12px;cursor:pointer}
.dd-routine-list button:hover{color:var(--ink,#121211)}
.dd-routine-empty{margin:0;font-size:12px;color:var(--ink-3,#77746b)}
@media (pointer:coarse){.dd-routine-modes button,.dd-routine-list li{min-height:44px}}
`;
export function DDinstallRoutineStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-routine-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-routine-css", textContent: DDroutineCSS }));
}
