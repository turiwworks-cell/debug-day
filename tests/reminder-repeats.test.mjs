// Reminders that repeat every day, month or year, with an optional time (5.93.0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { DDrepeatHits, DDrepeatNext, DDremindersOn, DDrepeatName, DDrepeats } from "../public/cal-reminders.js";
import { DDtodoRemindersDue } from "../public/todos.js";
import { callTool, save, read } from "../src/worker.js";

const hits = (r, from, to) => {
  const out = [];
  for (let d = from; d <= to; d = new Date(Date.parse(d + "T12:00:00Z") + 864e5).toISOString().slice(0, 10)) if (DDrepeatHits(r, d)) out.push(d);
  return out;
};

test("every day, and the old repeats still work", () => {
  assert.deepEqual(hits({ date: "2026-11-20", repeat: "daily" }, "2026-11-18", "2026-11-23"), ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
  assert.deepEqual(hits({ date: "2026-11-02", repeat: "weekly" }, "2026-11-01", "2026-11-30"), ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  assert.deepEqual(hits({ date: "2026-11-02", repeat: "alternate" }, "2026-11-01", "2026-11-07"), ["2026-11-02", "2026-11-04", "2026-11-06"]);
  assert.deepEqual(hits({ date: "2026-11-02", repeat: "once" }, "2026-11-01", "2026-11-30"), ["2026-11-02"]);
  assert.equal(DDrepeats({ repeat: "monthly" }), true);
  assert.equal(DDrepeats({ repeat: "once" }), false);
  assert.equal(DDrepeatName("yearly"), "Every year");
  assert.equal(DDrepeatName("monthly", "fa"), "هر ماه");
});

test("every month: the same day, or the last day of a shorter month", () => {
  const rent = { date: "2026-01-31", repeat: "monthly" };
  assert.deepEqual(hits(rent, "2026-01-01", "2026-05-31"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  assert.deepEqual(hits({ date: "2026-01-15", repeat: "monthly" }, "2026-01-01", "2026-03-31"), ["2026-01-15", "2026-02-15", "2026-03-15"]);
  // Persian: Shahrivar 31 (22 Sep 2026), then Mehr 30 (its last day), then Aban 30.
  const persian = { date: "2026-09-22", repeat: "monthly", cal: "persian" };
  assert.deepEqual(hits(persian, "2026-09-01", "2026-11-25"), ["2026-09-22", "2026-10-22", "2026-11-21"]);
  assert.equal(DDrepeatNext(rent, "2026-06-01"), "2026-06-30");
  assert.equal(DDrepeatNext(persian, "2026-10-01"), "2026-10-22");
});

test("every year: the same day, and a leap day falls on the month's last day", () => {
  assert.deepEqual(hits({ date: "2028-02-29", repeat: "yearly" }, "2028-01-01", "2030-12-31"), ["2028-02-29", "2029-02-28", "2030-02-28"]);
  // Esfand 30 in the leap year 1403 (20 Mar 2025): Esfand 29 in 1404 (20 Mar 2026).
  assert.deepEqual(hits({ date: "2025-03-20", repeat: "yearly", cal: "persian" }, "2025-03-01", "2026-03-31"), ["2025-03-20", "2026-03-20"]);
  assert.equal(DDrepeatNext({ date: "2026-05-04", repeat: "yearly" }, "2026-11-20"), "2027-05-04");
  assert.equal(DDrepeatNext({ date: "2026-05-04", repeat: "once" }, "2026-11-20"), "");
  const done = DDremindersOn([{ id: "b", date: "2026-05-04", repeat: "yearly", completedDates: ["2027-05-04"] }], "2027-05-04");
  assert.equal(done[0].done, true, "done one year at a time");
});

test("a Calendar reminder with a time says so when it comes, once", () => {
  const data = { setup: { reminders: [
    { id: "r", date: "2026-11-01", repeat: "daily", time: "09:30", title: "Stretch" },
    { id: "s", date: "2026-11-20", repeat: "once", time: "09:00", title: "Done already", done: true },
    { id: "u", date: "2026-11-20", repeat: "once", title: "No time" },
  ] }, days: {} };
  const at = new Date(2026, 10, 20, 9, 31);
  const due = DDtodoRemindersDue(data, at);
  assert.deepEqual(due.map((r) => [r.text, r.at, r.bell]), [["Stretch", "2026-11-20T09:30", true]]);
  assert.deepEqual(DDtodoRemindersDue(data, at, new Set([due[0].key])), [], "told once");
  assert.deepEqual(DDtodoRemindersDue(data, new Date(2026, 10, 20, 9, 29)).map((r) => r.at), ["2026-11-19T09:30"], "yesterday's, within the last day");
});

test("MCP adds monthly and yearly reminders with a time, and clears a time", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...v) { args = v; return this; }, async first() { return sql.prepare(query).get(...args) || null; }, async run() { return sql.prepare(query).run(...args); }, async all() { return { results: sql.prepare(query).all(...args) }; } }; } } };
  try {
    await save(env, { setup: { types: [], lanes: [], templates: [], reminders: [] }, days: {} }, 0);
    const added = await callTool("add_reminder", { expected_revision: 1, date: "2026-09-22", title: "Rent", repeat: "monthly", calendar: "persian", time: "10:00" }, env, "write");
    let item = (await read(env)).data.setup.reminders[0];
    assert.deepEqual([item.repeat, item.cal, item.time], ["monthly", "persian", "10:00"]);
    await callTool("update_reminder", { expected_revision: 2, reminder_id: added.id, time: "" }, env, "write");
    item = (await read(env)).data.setup.reminders[0];
    assert.equal(item.time, undefined);
    await assert.rejects(callTool("add_reminder", { expected_revision: 3, date: "2026-09-22", title: "x", repeat: "hourly" }, env, "write"));
    await assert.rejects(callTool("add_reminder", { expected_revision: 3, date: "2026-09-22", title: "x", time: "25:00" }, env, "write"));
  } finally {
    sql.close();
  }
});
