// The phone opens on Today (5.87.0): once a day, only on a phone, unless turned off.
import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
let narrow = true;
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.matchMedia = () => ({ matches: narrow });
const { DDphoneTodayDue } = await import("../public/engine.js");

test("a phone opens on Today the first time each day", () => {
  store.clear();
  narrow = true;
  assert.equal(DDphoneTodayDue("2026-11-21", {}), true, "the first open of the day");
  assert.equal(DDphoneTodayDue("2026-11-21", {}), false, "not again the same day");
  assert.equal(DDphoneTodayDue("2026-11-22", {}), true, "the next day again");
  assert.equal(DDphoneTodayDue("", {}), false);
});

test("never on a desktop, and never when turned off", () => {
  store.clear();
  narrow = false;
  assert.equal(DDphoneTodayDue("2026-11-21", {}), false);
  assert.equal(store.size, 0, "a desktop remembers nothing");
  narrow = true;
  assert.equal(DDphoneTodayDue("2026-11-21", { phoneToday: false }), false);
  assert.equal(DDphoneTodayDue("2026-11-21", { phoneToday: true }), true);
});
