// When a new day starts (5.86.3, L5) and when a week starts (L6).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// A small stand-in for the browser's storage.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
beforeEach(() => store.clear());

const { DDtoday, DDdayStartHour, DDsetDayStartHour, DDcalendarSystem, DDweekStartDay } = await import("../public/dates.js");
const { DDweekStart, DDweekFocus, DDweekFocusAt, DDsetWeekFocus } = await import("../public/calendar-week.js");
const { DDbudgetRange } = await import("../public/budgets.js");

const at = (y, m, d, hh, mm = 0) => new Date(y, m - 1, d, hh, mm);

test("a new day starts at midnight unless an hour up to 6 is chosen", () => {
  assert.equal(DDdayStartHour(), 0);
  assert.equal(DDtoday(at(2026, 11, 21, 1, 30)), "2026-11-21");
  DDsetDayStartHour(4);
  assert.equal(DDdayStartHour(), 4);
  assert.equal(DDtoday(at(2026, 11, 21, 1, 30)), "2026-11-20", "half past one is still the day before");
  assert.equal(DDtoday(at(2026, 11, 21, 3, 59)), "2026-11-20");
  assert.equal(DDtoday(at(2026, 11, 21, 4, 0)), "2026-11-21", "the new day starts at four");
  assert.equal(DDtoday(at(2026, 12, 1, 2)), "2026-11-30", "across a month");
  assert.equal(DDtoday(at(2027, 1, 1, 2)), "2026-12-31", "and a year");
  DDsetDayStartHour(0);
  assert.equal(store.has("debug-day:day-starts"), false, "midnight leaves nothing behind");
  // Anything else falls back to midnight.
  for (const bad of ["9", "-1", "soon"]) {
    store.set("debug-day:day-starts", bad);
    assert.equal(DDdayStartHour(), 0, bad);
  }
  DDsetDayStartHour(12);
  assert.equal(DDdayStartHour(), 0);
});

test("the week starts with the Calendar's choice, not the language", () => {
  assert.equal(DDcalendarSystem("en"), "gregory");
  assert.equal(DDcalendarSystem("fa"), "persian");
  assert.equal(DDweekStartDay("en"), 1);
  assert.equal(DDweekStart("2026-11-21", "en"), "2026-11-16", "Monday");
  store.set("debug-day:review-calendar", JSON.stringify("persian"));
  assert.equal(DDweekStartDay("en"), 6);
  assert.equal(DDweekStart("2026-11-21", "en"), "2026-11-21", "Saturday");
  assert.deepEqual(DDbudgetRange("2026-11-23", "week", "en"), ["2026-11-21", "2026-11-22", "2026-11-23"]);
  store.set("debug-day:review-calendar", JSON.stringify("gregory"));
  assert.equal(DDweekStart("2026-11-21", "fa"), "2026-11-16", "a Gregorian calendar in Persian starts on Monday");
  assert.deepEqual(DDbudgetRange("2026-11-23", "week", "fa"), ["2026-11-23"]);
  store.set("debug-day:review-calendar", "not json");
  assert.equal(DDcalendarSystem("fa"), "persian");
});

test("a week's focus is found when the week starts on another day", () => {
  // Saved while weeks started on Monday 23 November.
  let data = DDsetWeekFocus({ setup: {}, days: {} }, "2026-11-23", "Finish the fox loop");
  assert.equal(DDweekFocusAt(data.setup, "2026-11-23"), "Finish the fox loop");
  // Now the week starts on Saturday 21: the same seven days still find it.
  store.set("debug-day:review-calendar", JSON.stringify("persian"));
  assert.equal(DDweekFocus(data.setup, "2026-11-25", "en"), "Finish the fox loop");
  assert.equal(DDweekFocusAt(data.setup, "2026-11-14"), "", "the week before has its own");
  // Saving again keeps one copy, under the new start.
  data = DDsetWeekFocus(data, "2026-11-21", "Colour the fox loop");
  assert.deepEqual(Object.keys(data.setup.reviews), ["2026-11-21"]);
  assert.equal(DDweekFocus(data.setup, "2026-11-25", "en"), "Colour the fox loop");
  data = DDsetWeekFocus(data, "2026-11-21", "");
  assert.equal("reviews" in data.setup, false);
});

test("summer time never moves the day: only the clock on the wall counts", () => {
  DDsetDayStartHour(4);
  // The morning summer time starts (02:00 jumps to 03:00), 04:30 on the wall is
  // only three hours after midnight, and still a new day.
  const wall = (hour) => ({ getFullYear: () => 2026, getMonth: () => 2, getDate: () => 29, getHours: () => hour });
  assert.equal(DDtoday(wall(4)), "2026-03-29");
  assert.equal(DDtoday(wall(3)), "2026-03-28");
});
