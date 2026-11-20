import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDmeasureOf,
  DDplanMinutes,
  DDcountOf,
  DDsetMeasure,
  DDsetCount,
  DDsetTimes,
  DDmeasureText,
  DDtimeText,
  DDstepMinutes,
  DDdefaultMinutes,
  DDcleanMinutes,
  DDtaskLengths,
} from "../public/measure.js";
import { DDsetTaskDone } from "../public/search.js";
import { DDreviewSummary } from "../public/day-review.js";

const card = { id: "b1", name: "Stretch", min: 45, done: false, subtasks: [] };

test("cards are measured by time unless set to times or waiting", () => {
  assert.equal(DDmeasureOf(card), "time");
  assert.equal(DDmeasureOf({ ...card, measure: "count" }), "count");
  assert.equal(DDmeasureOf({ ...card, measure: "wait" }), "wait");
  assert.equal(DDmeasureOf({ ...card, measure: "odd" }), "time");
});

test("counted and waiting cards take no minutes from the day", () => {
  assert.equal(DDplanMinutes(card), 45);
  assert.equal(DDplanMinutes({ ...card, measure: "count" }), 0);
  assert.equal(DDplanMinutes({ ...card, measure: "wait" }), 0);
  const summary = DDreviewSummary({
    blocks: [
      { ...card, lane: "work" },
      { ...card, id: "b2", lane: "work", measure: "wait" },
    ],
  }, { lanes: [{ id: "work" }] });
  assert.equal(summary.plannedMinutes, 45);
});

test("a tally counts up to its times and marks the card done", () => {
  const counted = DDsetMeasure(card, "count");
  assert.deepEqual(DDcountOf(counted), { count: 0, times: 1 });
  const three = DDsetTimes(counted, 3);
  assert.equal(three.times, 3);
  const two = DDsetCount(three, 2);
  assert.equal(two.done, false);
  const full = DDsetCount(two, 9);
  assert.equal(full.count, 3);
  assert.equal(full.done, true);
  assert.equal(DDmeasureText(two, "en"), "2/3 times");
  assert.equal(DDmeasureText(two, "fa"), "2/3 بار");
  assert.equal(DDsetTimes(full, 2).count, 2);
});

test("ticking a counted card fills its tally; unticking opens one back up", () => {
  const counted = { ...card, measure: "count", times: 3, count: 1 };
  const done = DDsetTaskDone(counted, true);
  assert.equal(done.count, 3);
  const open = DDsetTaskDone(done, false);
  assert.equal(open.count, 2);
  assert.equal(open.done, false);
});

test("waiting cards remember when the wait started and drop it when back to time", () => {
  const now = new Date("2026-10-20T09:00:00Z");
  const waiting = DDsetMeasure(card, "wait", now);
  assert.equal(waiting.waitSince, now.toISOString());
  assert.match(DDmeasureText(waiting, "en"), /^Waiting · \d+ days?$/);
  const back = DDsetMeasure(waiting, "time");
  assert.equal(back.measure, undefined);
  assert.equal(DDplanMinutes(back), 45);
});

// Time is optional (5.86.0).
test("a task can have no time: it says nothing about time and takes none from the day", () => {
  assert.equal(DDmeasureText({ min: 0 }, "en"), "");
  assert.equal(DDmeasureText({ min: 45 }, "en"), "45m");
  assert.equal(DDtimeText(0, "en"), "");
  assert.equal(DDtimeText(90, "en"), "1h 30m");
});

test("the Engine's − and + step through No time", () => {
  assert.equal(DDstepMinutes(15, -1), 0, "− from 15 minutes is no time");
  assert.equal(DDstepMinutes(0, -1), 0);
  assert.equal(DDstepMinutes(0, 1), 15, "+ from no time is 15 minutes");
  assert.equal(DDstepMinutes(5, -1), 0);
  assert.equal(DDstepMinutes(20, -1), 15);
  assert.equal(DDstepMinutes(60, 1), 75);
  assert.equal(DDstepMinutes(720, 1), 720);
});

test("new tasks take no time by default; a length someone picked stays", () => {
  assert.equal(DDtaskLengths[0], 0, "No time comes first");
  assert.equal(DDdefaultMinutes(undefined), 0);
  assert.equal(DDdefaultMinutes({}), 0);
  assert.equal(DDdefaultMinutes({ defaultMinutes: 60 }), 0, "the old untouched 60 becomes no time");
  assert.equal(DDdefaultMinutes({ defaultMinutes: 60, timeOptional: true }), 60, "60 picked after the change stays");
  assert.equal(DDdefaultMinutes({ defaultMinutes: 45 }), 45);
  assert.equal(DDdefaultMinutes({ defaultMinutes: 0, timeOptional: true }), 0);
  assert.equal(DDdefaultMinutes({ defaultMinutes: 37 }), 0, "a length the menu does not offer is no time");
});

test("a typed length: 0 is no time, the rest is 5 to 720 in steps of 5", () => {
  assert.equal(DDcleanMinutes(0), 0);
  assert.equal(DDcleanMinutes("0"), 0);
  assert.equal(DDcleanMinutes(47), 45);
  assert.equal(DDcleanMinutes(2), 5);
  assert.equal(DDcleanMinutes(900), 720);
  assert.ok(Number.isNaN(DDcleanMinutes("")));
  assert.ok(Number.isNaN(DDcleanMinutes("soon")));
  assert.ok(Number.isNaN(DDcleanMinutes(-5)));
});
