// The daily routine (5.56): the parts of every morning that repeat, done for
// you only when you ask. Nothing here is on by default and nothing is strict:
// - Each morning, what is still open from the last day can be brought into
//   today, parked, or left for you to choose (the Engine's carry line).
// - A task can repeat every day. It is kept in the day templates (Settings),
//   so each new day starts with it, and stops when you say so.
import { DDengineCarry, DDengineCopy, DDengineParked, DDengineEarlierDay, DDhideEngineCarry } from "./engine.js";

export const DDroutineModes = ["ask", "bring", "park"];
const RAN_KEY = "debug-day:routine-ran";
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// What the person chose, kept in preferences so it syncs. "ask" is the default.
export function DDroutineOf(setup) {
  const r = setup?.preferences?.routine;
  return { leftovers: DDroutineModes.includes(r?.leftovers) ? r.leftovers : "ask" };
}
export function DDroutineClean(routine) {
  return routine && DDroutineModes.includes(routine.leftovers) && routine.leftovers !== "ask" ? { leftovers: routine.leftovers } : null;
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
export function DDroutineMorning(data, today, ensureDay = (date) => ({ date, blocks: [], notes: [], bugs: [] }), makeId = () => crypto.randomUUID()) {
  const { leftovers } = DDroutineOf(data?.setup);
  if (leftovers === "ask" || !data?.days) return null;
  const day = data.days[today] || ensureDay(today),
    carry = DDengineCarry(data.days, day),
    parked = DDengineParked(data.setup),
    list = [...carry.open, ...carry.waiting].filter((b) => leftovers === "bring" || !parked.some((p) => same(p.name, b.name)));
  if (!list.length) return null;
  const copies = list.map((b) => DDengineCopy(b, makeId));
  const next =
    leftovers === "bring"
      ? { ...data, days: { ...data.days, [today]: { ...day, blocks: [...(day.blocks || []), ...copies] } } }
      : { ...data, setup: { ...data.setup, later: [...parked, ...copies.map(({ at: _at, ...b }) => b)] } };
  return { data: next, mode: leftovers, from: carry.date, names: list.map((b) => b.name) };
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

// Mounted once by the app: does the morning routine the first time today is
// seen on this device, and says what it did.
export function DDDailyRoutine({ React: R, data, today, setData, ensureDay, makeId, language, onToast }) {
  const fa = language === "fa", t = (en, f) => (fa ? f : en),
    { leftovers } = DDroutineOf(data?.setup),
    earlier = DDengineEarlierDay(data?.days || {}, today)?.date || "";
  R.useEffect(() => {
    if (leftovers === "ask" || !earlier || ran(today)) return;
    mark(today);
    const result = DDroutineMorning(data, today, ensureDay, makeId);
    if (!result) return;
    setData((old) => DDroutineMorning(old, today, ensureDay, makeId)?.data || old);
    // Parked ones no longer need the carry line today.
    if (result.mode === "park") DDhideEngineCarry(today);
    const n = result.names.length;
    onToast?.(result.mode === "bring"
      ? t(n === 1 ? "Brought 1 open task into today" : `Brought ${n} open tasks into today`, `${n.toLocaleString("fa-IR")} کار باز به امروز آمد`)
      : t(n === 1 ? "Parked 1 open task from the last day" : `Parked ${n} open tasks from the last day`, `${n.toLocaleString("fa-IR")} کار باز روز قبل پارک شد`));
  }, [today, leftovers, earlier]);
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
