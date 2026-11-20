import { test } from "node:test";
import assert from "node:assert/strict";
import { DDroutineOf, DDsetRoutine, DDroutineMorning, DDroutineSettled, DDrepeatId, DDrepeats, DDsetRepeat, DDrepeatList } from "../public/routine.js";

let n = 0;
const id = () => "id" + ++n;
const task = (name, extra = {}) => ({ id: name.toLowerCase().replace(/\W/g, ""), name, type: "other", lane: "work", min: 60, done: false, subtasks: [], ...extra });
const base = (leftovers) => ({
  setup: { preferences: leftovers ? { routine: { leftovers } } : {}, later: [], templates: [{ id: "normal", name: "Default", days: [], blocks: [] }, { id: "fri", name: "Friday", days: [5], blocks: [] }] },
  days: { "2026-11-12": { date: "2026-11-12", blocks: [task("Sketch"), task("Email", { done: true }), task("Ink", { subtasks: [{ id: "s", text: "Lines", done: true, children: [] }] })] } },
});

test("mornings ask by default; the choice syncs in preferences and asking again clears it", () => {
  assert.equal(DDroutineOf({}).leftovers, "ask");
  const set = DDsetRoutine({ preferences: { timerMinutes: 25 } }, { leftovers: "park" });
  assert.deepEqual(set.preferences, { timerMinutes: 25, routine: { leftovers: "park" } });
  assert.deepEqual(DDsetRoutine(set, { leftovers: "ask" }).preferences, { timerMinutes: 25 });
  assert.equal(DDroutineOf({ preferences: { routine: { leftovers: "nope" } } }).leftovers, "ask");
  assert.equal(DDroutineMorning(base(), "2026-11-13"), null, "asking does nothing by itself");
});

test("bring: yesterday's open tasks are carried on into today, once", () => {
  const result = DDroutineMorning(base("bring"), "2026-11-13", undefined, id);
  assert.equal(result.mode, "bring");
  assert.equal(result.from, "2026-11-12");
  assert.deepEqual(result.names, ["Sketch", "Ink"]);
  const today = result.data.days["2026-11-13"].blocks;
  assert.deepEqual(today.map((b) => b.name), ["Sketch", "Ink"]);
  // Carried on, not copied fresh (5.86.2, L3): done steps stay done.
  assert.equal(today[1].subtasks[0].done, true, "a done step stays done");
  assert.deepEqual(today[1].carriedFrom, { date: "2026-11-12", id: "ink" });
  assert.notEqual(today[0].id, "sketch");
  const last = result.data.days["2026-11-12"].blocks;
  assert.equal(last.length, 3, "the last day keeps its record");
  assert.deepEqual(last.map((b) => b.carriedTo), ["2026-11-13", undefined, "2026-11-13"], "and marks what it carried on");
  // Once a day on every device (L4): the day it ran is kept with the routine.
  assert.equal(result.data.setup.preferences.routine.ran, "2026-11-13");
  assert.equal(DDroutineMorning(result.data, "2026-11-13", undefined, id), null, "running again adds nothing");
  // A second device that has not seen the first run yet still adds nothing new.
  const other = structuredClone(result.data);
  delete other.setup.preferences.routine.ran;
  assert.equal(DDroutineMorning(other, "2026-11-13", undefined, id), null, "the same tasks are not carried twice");
});

test("park: yesterday's open tasks wait in Park, once, and today stays as it was", () => {
  const result = DDroutineMorning(base("park"), "2026-11-13", undefined, id);
  assert.deepEqual(result.data.setup.later.map((b) => b.name), ["Sketch", "Ink"]);
  assert.equal(result.data.days["2026-11-13"], undefined);
  assert.deepEqual(result.data.days["2026-11-12"].blocks.map((b) => b.carriedTo), ["park", undefined, "park"]);
  assert.equal(DDroutineMorning(result.data, "2026-11-13", undefined, id), null);
});

test("the routine waits for sync when sync is on", () => {
  assert.equal(DDroutineSettled(undefined), true, "no sync: go ahead");
  assert.equal(DDroutineSettled(() => ({ connected: false })), true);
  assert.equal(DDroutineSettled(() => ({ connected: true, lastSync: "" })), false, "wait for this visit's first sync");
  assert.equal(DDroutineSettled(() => ({ connected: true, lastSync: "2026-11-13T08:00:00Z" })), true);
  assert.equal(DDroutineSettled(() => ({ connected: true, error: "offline" })), true, "a failed sync does not hold it back");
  assert.deepEqual(DDroutineOf({ preferences: { routine: { leftovers: "bring", ran: "2026-11-13" } } }), { leftovers: "bring", ran: "2026-11-13" });
  assert.deepEqual(DDsetRoutine({ preferences: { routine: { leftovers: "bring", ran: "2026-11-13" } } }, { leftovers: "park" }).preferences.routine, { leftovers: "park", ran: "2026-11-13" });
});

test("a task repeats every day through every template, and stops when asked", () => {
  const setup = base().setup, sketch = task("Sketch", { from: "studio", noteRef: "n1", score: 3 });
  assert.equal(DDrepeats(setup, sketch), false);
  const on = DDsetRepeat(setup, sketch, true);
  assert.ok(on.templates.every((tp) => tp.blocks.some((b) => b.id === "rtsketch" && b.name === "Sketch" && b.from === "studio")));
  assert.equal(on.templates[0].blocks[0].noteRef, undefined);
  assert.equal(on.templates[0].blocks[0].score, undefined);
  assert.equal(DDrepeats(on, sketch), true);
  // The copy a new day makes from a template ("v" + its id) repeats too.
  const fromTemplate = { ...sketch, id: "vrtsketch" };
  assert.equal(DDrepeatId(on, fromTemplate), "rtsketch");
  assert.equal(DDrepeats(on, fromTemplate), true);
  assert.deepEqual(DDrepeatList(on).map((b) => b.name), ["Sketch"]);
  assert.ok(DDsetRepeat(on, sketch, true).templates.every((tp) => tp.blocks.length === 1), "one copy per template");
  const off = DDsetRepeat(on, fromTemplate, false);
  assert.equal(DDrepeats(off, sketch), false);
  assert.deepEqual(DDrepeatList(off), []);
});
