// Time focused on a task (5.88.0): the timer owes a task the time that really
// passed, and the app writes it on the task as `spent` (seconds).
import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
let now = Date.parse("2026-11-21T09:00:00Z");
const realNow = Date.now;
Date.now = () => now;
const { DDtimer, DDtimerRestore } = await import("../public/timer.js");
const { DDaddFocus, DDfocusedTasks, DDspentText, DDspentOf, DDdayFocused, DDfocusRoot } = await import("../public/focus-time.js");
const { DDengineCarryCopy, DDengineCopy } = await import("../public/engine.js");

const task = (id, name, extra = {}) => ({ id, name, min: 0, done: false, subtasks: [], ...extra });

test("the timer owes a task the time that really passed while it ran", () => {
  DDtimer.reset();
  DDtimer.takeOwed();
  DDtimer.link({ date: "2026-11-21", id: "ink", name: "Ink the pages" });
  DDtimer.set(25 * 60);
  DDtimer.start();
  now += 10 * 60e3;
  DDtimer.pause();
  assert.equal(DDtimer.get().task.id, "ink", "a pause keeps the task");
  now += 60 * 60e3; // a long break is not focus
  DDtimer.start();
  now += 5 * 60e3;
  DDtimer.pause();
  const owed = DDtimer.takeOwed();
  assert.deepEqual(owed.map((e) => [e.date, e.id, e.seconds]), [["2026-11-21", "ink", 600], ["2026-11-21", "ink", 300]]);
  assert.deepEqual(DDtimer.takeOwed(), [], "taken once");
  // Running to the end: the time up to the end, then the clock is free.
  DDtimer.start();
  now += 20 * 60e3;
  DDtimer.pause(); // past the end: it finishes
  assert.deepEqual(DDtimer.takeOwed().map((e) => e.seconds), [10 * 60]);
  assert.equal(DDtimer.get().task, null);
  // Without a task, nothing is owed.
  DDtimer.set(60);
  DDtimer.start();
  now += 30e3;
  DDtimer.pause();
  assert.deepEqual(DDtimer.takeOwed(), []);
});

test("switching tasks or resetting settles the time so far", () => {
  DDtimer.reset();
  DDtimer.takeOwed();
  DDtimer.link({ date: "2026-11-21", id: "a", name: "A" });
  DDtimer.set(25 * 60);
  DDtimer.start();
  now += 4 * 60e3;
  DDtimer.link({ date: "2026-11-21", id: "b", name: "B" });
  now += 6 * 60e3;
  DDtimer.reset();
  assert.deepEqual(DDtimer.takeOwed().map((e) => [e.id, e.seconds]), [["a", 240], ["b", 360]]);
  assert.equal(DDtimer.get().task, null);
});

test("a saved clock keeps its task and what it owes", () => {
  const saved = { running: true, deadline: now + 60e3, seconds: 60, total: 1500, base: 1500, task: { date: "2026-11-21", id: "ink", name: "Ink" }, runFrom: now - 30e3, owed: [{ date: "2026-11-21", id: "ink", seconds: 90, key: "k" }, { id: "", seconds: 5 }, { id: "x", seconds: -1 }] };
  const s = DDtimerRestore(saved, 1500, now);
  assert.deepEqual(s.task, { date: "2026-11-21", id: "ink", name: "Ink" });
  assert.equal(s.runFrom, now - 30e3);
  assert.deepEqual(s.owed.map((e) => e.seconds), [90], "only valid entries");
  assert.equal(DDtimerRestore({ ...saved, running: false }, 1500, now).runFrom, 0, "a paused clock is not counting");
});

test("owed time is written on its task, wherever it is now", () => {
  const data = {
    setup: { later: [task("parked", "Parked one")] },
    days: {
      "2026-11-21": { date: "2026-11-21", blocks: [task("ink", "Ink the pages", { spent: 60 })] },
      "2026-11-22": { date: "2026-11-22", blocks: [task("moved", "Moved on")] },
    },
  };
  const next = DDaddFocus(data, [
    { date: "2026-11-21", id: "ink", seconds: 600 },
    { date: "2026-11-21", id: "moved", seconds: 120 },
    { date: "2026-11-21", id: "parked", seconds: 300 },
    { date: "2026-11-21", id: "gone", seconds: 900 },
  ]);
  assert.equal(next.days["2026-11-21"].blocks[0].spent, 660);
  assert.equal(next.days["2026-11-22"].blocks[0].spent, 120, "a task moved to another day");
  assert.equal(next.setup.later[0].spent, 300, "a parked task");
  assert.equal(data.days["2026-11-21"].blocks[0].spent, 60, "the old data is left as it was");
  assert.equal(DDaddFocus(data, []), data);
  assert.equal(DDaddFocus(data, [{ date: "2026-11-21", id: "gone", seconds: 60 }]), data, "time for a task that is gone is let go");
});

test("focused time reads as history, and a copy starts at zero", () => {
  assert.equal(DDspentText(45 * 60, "en"), "45m focused");
  assert.equal(DDspentText(90 * 60, "en"), "1h 30m focused");
  assert.equal(DDspentText(20, "en"), "", "under a minute says nothing");
  assert.equal(DDspentOf({ spent: -5 }), 0);
  assert.equal(DDdayFocused({ blocks: [task("a", "A", { spent: 600 }), task("b", "B"), task("c", "C", { spent: 300 })] }), 900);
  assert.equal(DDfocusRoot("c20261122-c20261121-ink"), "ink");
  // Carried on, the task is one task in the week: Mon 1h + Tue 2h = 3h on it.
  const days = {
    "2026-11-16": { blocks: [task("cover", "Cover", { spent: 3600, carriedTo: "2026-11-17" })] },
    "2026-11-17": { blocks: [task("c20261117-cover", "Cover art", { spent: 7200 }), task("mail", "Mail", { spent: 600 })] },
  };
  assert.deepEqual(DDfocusedTasks(days, ["2026-11-16", "2026-11-17"]).map((r) => [r.id, r.name, r.seconds]), [["cover", "Cover art", 10800], ["mail", "Mail", 600]]);
  const carried = DDengineCarryCopy(task("cover", "Cover", { spent: 3600 }), "2026-11-16", "2026-11-17");
  assert.equal("spent" in carried, false, "the time stays with the day it was spent on");
  assert.equal("spent" in DDengineCopy(task("cover", "Cover", { spent: 3600 }), () => "new"), false);
});

test.after(() => {
  Date.now = realNow;
});
