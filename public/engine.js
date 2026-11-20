// The Engine's data: today's tasks and the Park shelf, ticked, scored or waited on.
// It is not a copy: it reads and writes day.blocks and setup.later, the same data
// the Board and its Lanes view show, so a change here is the same change
// everywhere. The Engine's screen is in engine-panel.js.
import { DDsectionTint, DDlifePath, DDlifeItems } from "./life-board.js";
import { DDcaptureId } from "./section-keys.js";
import { DDcleanBoard } from "./search.js";
import { DDdefaultMinutes } from "./measure.js";

// Ask the Board to bring the Engine up. The request waits until a Board is
// on screen (Ctrl+Space can ask from Plan or Calendar before the Board opens).
// Ctrl+Space's first two rows (5.69): glide to the Engine of the board you are
// in ("here"), or of the Main board ("main"). It waits until the Board takes it.
export const DDengineGoBus = {
  pending: "",
  listeners: new Set(),
  request(where) {
    this.pending = where === "main" ? "main" : "here";
    for (const listener of [...this.listeners]) listener();
  },
  take() {
    const pending = this.pending;
    this.pending = "";
    return pending;
  },
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};

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

// Today and Park (5.50). Today is every task of the day in one list. A task
// still keeps its lane for the Board's Lanes view, but lanes no longer split the
// Engine. Park is the shelf that stays from day to day: setup.later, the same
// list Capture's "Park" fills, so a parked task is never lost on an old day.
export const DDengineParked = (setup) => (Array.isArray(setup?.later) ? setup.later : []);

// The order the Engine shows: open tasks first, the most important first
// (P1, P2, P3, then the rest), waiting tasks after the work you can do now,
// and done tasks at the end. Ties keep the order the person gave.
const PRI_RANK = { 1: 0, 2: 1, 3: 2 };
export function DDengineRank(block) {
  if (block?.done) return 9;
  return (PRI_RANK[block?.pri] ?? 3) + (block?.measure === "wait" ? 4 : 0);
}
export function DDengineOrder(blocks = []) {
  return blocks
    .map((block, index) => ({ block, index, rank: DDengineRank(block) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.block);
}

// The first open step of a task, depth first: what to do next on it. A step
// still waiting for another (flow.js) gives way to one that can start now,
// unless every open step is waiting.
export function DDengineNextStep(items = [], waiting = () => false) {
  const open = [];
  const walk = (list) => {
    for (const item of list || []) {
      if (item.done) continue;
      const before = open.length;
      walk(item.children);
      if (open.length === before) open.push(item);
    }
  };
  walk(items);
  return open.find((item) => !waiting(item)) || open[0] || null;
}
export function DDengineStepCount(items = []) {
  let done = 0, total = 0;
  const walk = (list) => (list || []).forEach((item) => { total++; if (item.done) done++; walk(item.children); });
  walk(items);
  return { done, total };
}

// All, Left and Done, plus a find that also looks in notes, tags and steps.
// Persian and Arabic letters and digits are matched as the same thing.
const fold = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .trim();
export function DDengineShows(block, show = "all", query = "") {
  if (show === "left" && block?.done) return false;
  if (show === "done" && !block?.done) return false;
  const words = fold(query);
  if (!words) return true;
  const steps = [];
  const walk = (items) => (items || []).forEach((item) => { steps.push(item.text); walk(item.children); });
  walk(block?.subtasks);
  const text = fold([block?.name, block?.note, ...(block?.tags || []), ...steps].join(" "));
  return words.split(/\s+/).every((word) => text.includes(word));
}

// The lane a task goes back to: the one it had before it was parked if that
// lane still exists, then its own, then the first lane.
export function DDengineLaneFor(block, lanes = []) {
  const ids = lanes.map((lane) => lane.id);
  if (block?.parkedLane && ids.includes(block.parkedLane)) return block.parkedLane;
  if (ids.includes(block?.lane)) return block.lane;
  return ids[0] || "";
}

// Today -> Park: the same task leaves the day and waits on the shelf. Its place
// on the day's board goes with it; it remembers its lane for the way back.
export function DDenginePark(data, date, id) {
  const block = data?.days?.[date]?.blocks?.find((b) => b.id === id);
  if (!block) return data;
  const next = structuredClone(data),
    day = next.days[date],
    parked = structuredClone(block);
  parked.parkedLane = block.lane || "";
  delete parked.bx;
  delete parked.by;
  day.blocks = day.blocks.filter((b) => b.id !== id);
  DDcleanBoard(day, ["b:" + id, ...stepRefs(block.subtasks, id)]);
  next.setup.later = [...DDengineParked(next.setup).filter((b) => b.id !== id), parked];
  return next;
}
function stepRefs(items, blockId) {
  return (items || []).flatMap((item) => ["sub:" + blockId + ":" + item.id, ...stepRefs(item.children, blockId)]);
}

// Park -> Today (or any day): the task joins that day in its old lane.
export function DDengineUnpark(data, id, date, ensureDay = (d) => ({ date: d, blocks: [], notes: [], bugs: [] })) {
  const block = DDengineParked(data?.setup).find((b) => b.id === id);
  if (!block || !date) return data;
  const next = structuredClone(data),
    day = next.days[date] || (next.days[date] = structuredClone(ensureDay(date))),
    task = structuredClone(block);
  task.lane = DDengineLaneFor(block, next.setup.lanes || []);
  delete task.parkedLane;
  if (day.blocks.some((b) => b.id === task.id)) task.id = crypto.randomUUID();
  day.blocks.push(task);
  next.setup.later = DDengineParked(next.setup).filter((b) => b.id !== id);
  return next;
}

// A new task for the Engine, with the same defaults as the Board's "+ task".
// `from` is the Life section it came from, if any (see DDengineSourceHistory).
// No category (5.85.3): section tags replaced categories, so a new task gets
// none and wears the plain look until it has a section (see task-look.js).
export const DDnoType = "";
export function DDengineTask(name, lane, setup = {}, id = crypto.randomUUID(), from = "") {
  return {
    id,
    name: String(name || "").trim().slice(0, 300),
    type: DDnoType,
    lane: lane || "",
    // Time is optional (5.86.0): Settings › New tasks take, "No time" (0) by default.
    min: DDdefaultMinutes(setup.preferences),
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
  const lines = String(text || "").split("\n").map(line=>({done:/^\s*- \[x\]/i.test(line),text:line.replace(/\*\*|~~/g,"").replace(/^\s*(?:- \[[ xX]\]|[-*•]|\d+[.)]|\[[ xX]?\])\s*/,"").trim()})).filter(line=>line.text);
  const task = DDengineTask(lines[0]?.text || "", lane, setup, makeId(), from);
  task.subtasks = lines.slice(1).map(line=>({id:makeId(),text:line.text,done:line.done,expanded:true,children:[]}));
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

// Carrying a task on (5.86.2, L3): the same task, brought to a later day, not
// a fresh copy. Its steps keep what is done and it remembers where it came
// from; the earlier day's task is marked carried on (carriedTo), so that day no
// longer counts it as left undone. The new id comes from the task's own id and
// the day it goes to, so bringing it twice, or on two devices, adds it once.
export function DDcarryId(id, to) {
  const root = String(id || "").replace(/^c\d{8}-/, "").replace(/^cpark-/, "");
  return "c" + (to === "park" ? "park" : String(to || "").replace(/-/g, "")) + "-" + root;
}
export function DDengineCarryCopy(block, from, to) {
  const copy = { ...structuredClone(block), id: DDcarryId(block.id, to), done: false, carriedFrom: { date: from || "", id: block.id } };
  for (const key of ["carriedTo", "score", "bx", "by", "at"]) delete copy[key];
  return copy;
}
// The earlier day after its tasks `ids` were carried on to `to` (a date or "park").
export function DDmarkCarried(day, ids, to) {
  const set = new Set(ids);
  if (!day?.blocks?.some((b) => set.has(b.id) && b.carriedTo !== to)) return day;
  return { ...day, blocks: day.blocks.map((b) => (set.has(b.id) ? { ...b, carriedTo: to } : b)) };
}
// The copies `list` ({ date, block } pairs) adds to `day`: the ones not there yet.
export function DDcarryCopies(list, day) {
  const here = new Set((day?.blocks || []).map((b) => b.id));
  return (list || []).filter(({ block }) => !here.has(DDcarryId(block.id, day.date))).map(({ date, block }) => DDengineCarryCopy(block, date, day.date));
}
// Carry `list` on to the day `to`, or to Park when `to` is "park", in one change.
export function DDcarryOn(data, list, to, ensureDay = (date) => ({ date, blocks: [], notes: [], bugs: [] })) {
  if (!list?.length) return data;
  const days = { ...data.days };
  let setup = data.setup;
  if (to === "park") {
    const parked = DDengineParked(setup), here = new Set(parked.map((b) => b.id));
    const copies = list.filter(({ block }) => !here.has(DDcarryId(block.id, "park"))).map(({ date, block }) => DDengineCarryCopy(block, date, "park"));
    setup = { ...setup, later: [...parked, ...copies] };
  } else {
    const day = days[to] || ensureDay(to);
    days[to] = { ...day, blocks: [...(day.blocks || []), ...DDcarryCopies(list, { ...day, date: to })] };
  }
  const byDate = new Map();
  for (const { date, block } of list) byDate.set(date, [...(byDate.get(date) || []), block.id]);
  for (const [date, ids] of byDate) if (days[date]) days[date] = DDmarkCarried(days[date], ids, to);
  return { ...data, setup, days };
}

// "→ Fri 21 Nov" or "→ Park" for a task carried on (5.86.2), in the calendar
// the Calendar uses on this device.
export function DDcarriedText(block, language) {
  const to = block?.carriedTo, fa = language === "fa";
  if (!to) return "";
  if (to === "park") return fa ? "→ پارک" : "→ Park";
  let calendar = fa ? "persian" : "gregory";
  try { const saved = JSON.parse(localStorage.getItem("debug-day:review-calendar")); if (["persian", "gregory"].includes(saved)) calendar = saved; } catch {}
  try { return "→ " + new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { calendar, weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(to + "T12:00:00Z")); } catch { return "→ " + to; }
}

// Is this task already in today's Engine? The task carried on from it is (by
// its id), and so is one with the same name (older days have no ids to go by).
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
export function DDengineHas(day, block) {
  const id = block?.id, carried = id && day?.date ? DDcarryId(id, day.date) : "";
  return (day?.blocks || []).some((b) => (id && (b.id === carried || b.carriedFrom?.id === id)) || sameName(b.name, block?.name));
}

// What is still open to bring into today (5.37), read from the days, nothing
// stored. `open`: the tasks of the latest earlier day with tasks that are not
// done and not already here. `waiting`: waiting tasks left on an older day
// (never arrived, never carried on to a later day), newest first, so a reply
// you are waiting for does not stay behind on the day you started waiting.
export function DDengineCarry(days = {}, day = {}, lookback = 60) {
  const date = day?.date || "",
    named = (b) => String(b?.name || "").trim() !== "",
    earlier = DDengineEarlierDay(days, date),
    // A task already carried on (to another day or to Park) is not offered
    // again. One carried to this day comes back only if its copy was taken off.
    gone = (b) => !!b.carriedTo && b.carriedTo !== date,
    open = earlier ? (earlier.day.blocks || []).filter((b) => named(b) && !b.done && !gone(b) && !DDengineHas(day, b)) : [],
    taken = new Set(open.map((b) => String(b.name).trim().toLowerCase())),
    dates = Object.keys(days).filter((key) => key < date).sort().reverse().slice(0, lookback),
    waiting = [],
    from = new Map();
  for (const key of dates)
    for (const block of days[key]?.blocks || []) {
      const name = String(block.name || "").trim().toLowerCase();
      if (block.measure !== "wait" || block.done || gone(block) || !named(block) || taken.has(name) || DDengineHas(day, block)) continue;
      if (dates.some((later) => later > key && DDengineHas(days[later], block))) continue;
      taken.add(name);
      waiting.push(block);
      from.set(block.id, key);
    }
  // `items`: each task with the day it is on, for DDcarryOn.
  const items = [...open.map((block) => ({ date: earlier.date, block })), ...waiting.map((block) => ({ date: from.get(block.id), block }))];
  return { date: earlier?.date || "", open, waiting, items, count: open.length + waiting.length };
}

// "Not today" on the carry line is remembered for that day on this device only.
const CARRY_KEY = "debug-day:engine-carry-hidden";
export function DDengineCarryHidden(date) {
  try { return localStorage.getItem(CARRY_KEY) === date; } catch { return false; }
}
export function DDhideEngineCarry(date) {
  try { localStorage.setItem(CARRY_KEY, date); } catch {}
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

export const DDengineCSS = `
.dd-history-strip{display:inline-flex;align-items:center;gap:3px}
.dd-history-strip i{display:block;width:8px;height:8px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink,#121211) 22%,transparent)}
.dd-history-strip i[data-state=done]{background:#2E8B3A;box-shadow:none}
.dd-history-strip i[data-state=some]{background:linear-gradient(90deg,#2E8B3A 50%,color-mix(in srgb,#D9434A 30%,transparent) 50%);box-shadow:none}
.dd-history-strip i[data-state=open]{box-shadow:inset 0 0 0 1.5px #D9434A}
.b6 .b4-life-section>.dd-sec-history{--k:var(--dd-sec-k,1);position:absolute;top:calc(10px * var(--k));right:calc(10px * var(--k));z-index:30;display:flex;align-items:center;gap:calc(6px * var(--k));height:calc(28px * var(--k));max-width:calc(100% - 20px * var(--k));padding:0 calc(8px * var(--k));border-radius:calc(6px * var(--k));border:calc(1px * var(--k)) solid color-mix(in srgb,var(--node-color) 60%,#1e1e1e 20%);background:var(--paper,#fff);color:var(--ink,#121211);font:600 calc(11px * var(--k))/1 var(--mono,ui-monospace,monospace);overflow:hidden;cursor:pointer;min-width:0;min-height:0}
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
button.dd-task-from{font-family:inherit;font-weight:500;cursor:pointer}button.dd-task-from:hover{filter:brightness(.96);box-shadow:0 1px 4px #0002}
.dd-engine-area{position:absolute;border:2px dashed color-mix(in srgb,var(--panel-engine,#F05A28) 55%,transparent);background:color-mix(in srgb,var(--panel-engine,#F05A28) 5%,transparent);border-radius:28px;box-sizing:border-box}
.dd-engine-area-title{position:absolute;left:18px;bottom:calc(100% - 16px);transform:scale(clamp(1,var(--b4-inverse,1),4));display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:var(--panel-engine,#F05A28);color:#fff;font:600 15px/1.2 var(--sans,system-ui);white-space:nowrap;transform-origin:0 100%;box-shadow:0 2px 8px #0002}
.dd-engine-area-title small{font-weight:500;opacity:.85}
.dd-engine-area-title button{padding:2px 8px;border-radius:999px;background:#fff3;color:#fff;font-size:12px}
@media (pointer:coarse){.dd-engine-area-title button{position:relative;padding:6px 12px;font-size:13px}.dd-engine-area-title button::before{content:"";position:absolute;inset:-10px -6px}}
`;

export function DDinstallEngineStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-css", textContent: DDengineCSS }));
}

// Capture (5.55): the ideas still waiting there, oldest first. One that went to
// a day or to Park (a task remembers its note as noteRef) is sorted already.
export function DDcaptureWaiting(setup = {}, days = {}, day = null) {
  const sent = new Set();
  const look = (list) => { for (const b of list || []) if (b?.noteRef) sent.add(b.noteRef); };
  look(setup.later);
  for (const d of Object.values(days || {})) look(d?.blocks);
  look(day?.blocks);
  return DDlifeItems(setup)
    .filter((i) => i.type === "sticky" && i.parent === DDcaptureId && !sent.has(i.id) && String(i.text || "").trim())
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}
