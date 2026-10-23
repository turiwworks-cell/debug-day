import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDhabitLevels,
  DDhabitLevel,
  DDsetHabitEntry,
  DDtoggleHabit,
  DDhabitHistory,
  DDhabitStreak,
  DDnormalizeHabits,
  DDnormalizeHabitLog,
  DDhabitForBlock,
} from "../public/habits.js";

test("levels default to 15 / 30 / 60 minutes and stay in order", () => {
  assert.deepEqual(DDhabitLevels(), { good: 15, enough: 30, much: 60 });
  assert.deepEqual(DDhabitLevels({ good: 20, enough: 10, much: 5 }), { good: 20, enough: 21, much: 22 });
  assert.deepEqual(DDhabitLevels({ good: "x" }), { good: 15, enough: 30, much: 60 });
});

test("a tick is level 1; minutes move it up to good, enough and too much", () => {
  assert.equal(DDhabitLevel({ done: false, min: 0 }), 0);
  assert.equal(DDhabitLevel({ done: true, min: 0 }), 1);
  assert.equal(DDhabitLevel({ done: true, min: 15 }), 2);
  assert.equal(DDhabitLevel({ done: true, min: 30 }), 3);
  assert.equal(DDhabitLevel({ done: true, min: 90 }), 4);
  assert.equal(DDhabitLevel({ done: true, min: 12 }, { good: 10, enough: 20, much: 40 }), 2);
});

test("minutes mark a habit done; unticking clears the day", () => {
  let day = { date: "2026-10-23", blocks: [] };
  day = DDsetHabitEntry(day, "w", { min: 25 });
  assert.deepEqual(day.habits, { w: { done: true, min: 25 } });
  day = DDtoggleHabit(day, "w");
  assert.equal(day.habits, undefined);
  day = DDtoggleHabit(day, "w");
  assert.deepEqual(day.habits, { w: { done: true } });
});

test("history and streak read past days", () => {
  const days = {
    "2026-10-21": { habits: { w: { done: true, min: 40 } } },
    "2026-10-22": { habits: { w: { done: true } } },
  };
  const history = DDhabitHistory(days, "w", "2026-10-23", 3);
  assert.deepEqual(history.map((d) => d.level), [3, 1, 0]);
  assert.equal(DDhabitStreak(days, "w", "2026-10-23"), 2);
});

test("saved habits and logs are cleaned up on load", () => {
  assert.deepEqual(
    DDnormalizeHabits([{ id: "a", name: "Write", color: "bad" }, { id: "a", name: "Dup" }, null]),
    [{ id: "a", name: "Write", emo: "", color: "#E2683C" }],
  );
  assert.deepEqual(DDnormalizeHabitLog({ a: { min: "20" }, b: { done: false }, c: { done: true } }), {
    a: { done: true, min: 20 },
    c: { done: true },
  });
});

test("a card becomes a habit, reusing one with the same name", () => {
  const habits = [{ id: "w", name: "Writing", emo: "", color: "#000000" }];
  assert.equal(DDhabitForBlock(habits, { name: "writing" }, "#111111", () => "new").habit.id, "w");
  const made = DDhabitForBlock(habits, { name: "Sketch", emo: "✏️" }, "#123456", () => "s");
  assert.deepEqual(made.habit, { id: "s", name: "Sketch", emo: "✏️", color: "#123456" });
  assert.equal(made.habits.length, 2);
});
