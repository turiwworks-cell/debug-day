import test from "node:test";
import assert from "node:assert/strict";
import { DDtimer, DDtimerDefault, DDtimerFormat, DDtimerLeft, DDtimerFeel, DDtimerRemaining, DDtimerRestore } from "../public/timer.js";

test("a saved clock comes back after a reload", () => {
  const now = 1_000_000;
  const running = DDtimerRestore({ running: true, deadline: now + 90_500, total: 1500, view: "bar", sound: false }, 1500, now);
  assert.equal(running.running, true);
  assert.equal(running.seconds, 91);
  assert.equal(running.view, "bar");
  assert.equal(running.sound, false);
  const paused = DDtimerRestore({ running: false, seconds: 412, total: 1500 }, 1500, now);
  assert.deepEqual([paused.running, paused.seconds, paused.total], [false, 412, 1500]);
  // A deadline that passed while the app was closed still counts as running, so it finishes on open.
  const passed = DDtimerRestore({ running: true, deadline: now - 60_000, total: 600 }, 1500, now);
  assert.deepEqual([passed.running, passed.seconds], [true, 0]);
});

test("nothing saved, or broken data, falls back to the length from Settings", () => {
  for (const saved of [null, "x", { seconds: "abc", total: -4, view: "huge" }]) {
    const s = DDtimerRestore(saved, 2700, 0);
    assert.equal(s.total, 2700);
    assert.equal(s.view, "numbers");
    assert.equal(s.sound, true);
    assert.equal(s.running, false);
  }
  assert.equal(DDtimerRestore(null, 2700, 0).seconds, 2700);
  assert.equal(DDtimerRestore({ seconds: 99999 }, 2700, 0).seconds, 5999);
});

test("format, bar fill and words for the bar", () => {
  assert.equal(DDtimerFormat(0), "00:00");
  assert.equal(DDtimerFormat(1499), "24:59");
  assert.equal(DDtimerRemaining(20_000, 19_001), 1);
  assert.equal(DDtimerLeft({ seconds: 750, total: 1500 }), 0.5);
  assert.equal(DDtimerLeft({ seconds: 10, total: 0 }), 0);
  assert.equal(DDtimerFeel({ running: true, seconds: 1400, total: 1500 }), "Most of the time left");
  assert.equal(DDtimerFeel({ running: true, seconds: 700, total: 1500 }), "About half left");
  assert.equal(DDtimerFeel({ running: false, seconds: 0, total: 1500 }), "Time is up");
});

test("one clock: set, start, pause, add, reset and the Settings length", () => {
  DDtimerDefault(1500);
  DDtimer.reset();
  assert.equal(DDtimer.get().seconds, 1500);
  DDtimer.set(600);
  assert.deepEqual([DDtimer.get().seconds, DDtimer.get().total], [600, 600]);
  DDtimer.start();
  assert.equal(DDtimer.get().running, true);
  assert.ok(DDtimer.get().deadline > Date.now() + 599_000);
  DDtimer.add(300);
  assert.equal(DDtimer.get().total, 900);
  DDtimer.pause();
  assert.equal(DDtimer.get().running, false);
  assert.ok(DDtimer.get().seconds >= 899);
  DDtimer.setRunning((on) => !on);
  assert.equal(DDtimer.get().running, true);
  DDtimer.setRunning(false);
  // Settings changes only move an idle, untouched clock.
  DDtimerDefault(1800);
  assert.notEqual(DDtimer.get().seconds, 1800);
  DDtimer.reset();
  assert.equal(DDtimer.get().seconds, 1800);
  DDtimerDefault(3000);
  assert.equal(DDtimer.get().seconds, 3000);
  // After the end, +5 min starts a fresh five minutes.
  DDtimer.set(0);
  DDtimer.add(300);
  assert.deepEqual([DDtimer.get().seconds, DDtimer.get().total], [300, 300]);
  DDtimer.preset(45);
  assert.deepEqual([DDtimer.get().running, DDtimer.get().total], [true, 2700]);
  DDtimer.view("bar");
  assert.equal(DDtimer.get().view, "bar");
  DDtimer.reset();
});
