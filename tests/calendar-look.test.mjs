import { test } from "node:test";
import assert from "node:assert/strict";
import { DDusualMinutes, DDdayLoad, DDloadName, DDmonthLoad, DDaltDay, DDshortTime } from "../public/calendar-look.js";

const task = (min, extra = {}) => ({ id: "t" + Math.random(), name: "Task", min, done: false, ...extra });
const day = (date, ...blocks) => ({ date, blocks });

test("a day's fullness is measured against your own usual day, not fixed hours", () => {
  assert.equal(DDusualMinutes({}, "2026-11-14"), 300, "five hours until there are enough days");
  const days = {};
  for (let i = 1; i <= 7; i++) days["2026-11-0" + i] = day("2026-11-0" + i, task(120), task(60));
  assert.equal(DDusualMinutes(days, "2026-11-14"), 180);
  assert.equal(DDdayLoad(undefined, 180).level, 0);
  assert.equal(DDdayLoad(day("x", task(60)), 180).level, 1);
  assert.equal(DDdayLoad(day("x", task(180)), 180).level, 2);
  assert.equal(DDdayLoad(day("x", task(220)), 180).level, 3);
  assert.equal(DDdayLoad(day("x", task(400)), 180).level, 4);
  assert.equal(DDdayLoad(day("x", task(150, { energy: "heavy" })), 180).level, 3, "a heavy task weighs more");
  assert.equal(DDdayLoad(day("x", { name: "  ", min: 900 }), 180).level, 0, "empty rows do not count");
  assert.equal(DDloadName(4, "en"), "Packed");
  assert.equal(DDloadName(3, "fa"), "پر");
});

test("done share, all done and the month line", () => {
  const a = day("2026-11-02", task(60, { done: true }), task(180)), b = day("2026-11-03", task(60, { done: true }));
  const load = DDdayLoad(a, 180);
  assert.deepEqual([load.tasks, load.done, load.share, load.allDone, load.planned], [2, 1, 25, false, 240]);
  assert.equal(DDdayLoad(b, 180).allDone, true);
  const month = DDmonthLoad({ [a.date]: a, [b.date]: b }, [a.date, b.date, "2026-11-04"], 180, "2026-11-14");
  assert.deepEqual([month.tasks, month.done, month.finished, month.full, month.top.date], [3, 2, 1, 1, a.date]);
});

test("the other calendar's day and a short time for small cells", () => {
  assert.equal(DDaltDay("2026-11-14", "gregory", "en"), "23");
  assert.equal(DDaltDay("2026-11-14", "persian", "en"), "14");
  assert.equal(DDshortTime(0, "en"), "");
  assert.equal(DDshortTime(45, "en"), "45m");
  assert.equal(DDshortTime(195, "en"), "3.5h");
  assert.equal(DDshortTime(120, "fa"), "۲س");
});
