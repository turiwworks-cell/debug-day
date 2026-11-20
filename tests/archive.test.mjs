// Archive old months (5.91.0): a month you are done with moves to the server,
// keeps its light record (habits, mood, energy) here, and comes back whole.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { save, read, callTool } from "../src/worker.js";
import {
  DDarchiveClean, DDarchiveOf, DDarchiveMonth, DDarchiveLabel, DDarchiveName, DDarchiveLight,
  DDarchivePlan, DDarchiveApply, DDarchiveJoin, DDarchiveRows, DDbringBackApply,
} from "../public/archive.js";

const KEY = "s".repeat(64);
const day = (date, extra = {}) => ({ date, heavy: 0, tpl: "", focus: "", mood: "", journal: "", blocks: [], bugs: [], notes: [], canvas: null, pause: null, ...extra });
const task = (id, name, done = false) => ({ id, name, done, subtasks: [] });

test("the archive list keeps only well-formed archives, in order", () => {
  assert.equal(DDarchiveClean(undefined), undefined);
  assert.equal(DDarchiveClean([]), undefined);
  const list = DDarchiveClean([
    { id: "2026-08-01_2026-08-31_m1", label: "August 2026", days: 4, bytes: 900, at: "2026-11-20T10:00:00.000Z" },
    { id: "2026-07-01_2026-07-31_m0", label: "July 2026", days: "3", bytes: 12.4 },
    { id: "2026-07-01_2026-07-31_m0" },
    { id: "2026-09-31_2026-10-02_x" },
    { id: "2026-10-05_2026-10-01_x" },
    { id: "nonsense" },
    null,
  ]);
  assert.deepEqual(list.map((e) => [e.id, e.from, e.to, e.days, e.bytes]), [
    ["2026-07-01_2026-07-31_m0", "2026-07-01", "2026-07-31", 3, 12],
    ["2026-08-01_2026-08-31_m1", "2026-08-01", "2026-08-31", 4, 900],
  ]);
  assert.equal(DDarchiveOf({ archive: list }, "2026-08-12").length, 1);
  assert.equal(DDarchiveOf({ archive: list }, "2026-09-01").length, 0);
  assert.equal(DDarchiveOf({ archive: list }, "2026-07-20", "2026-08-05").length, 2);
});

test("months follow the Calendar: Gregorian or Persian", () => {
  assert.deepEqual(DDarchiveMonth("2026-08-17"), { from: "2026-08-01", to: "2026-08-31" });
  assert.deepEqual(DDarchiveMonth("2026-02-10"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(DDarchiveMonth("2026-08-10", "persian"), { from: "2026-07-23", to: "2026-08-22" });
  assert.equal(DDarchiveLabel("2026-08-01"), "August 2026");
  assert.equal(DDarchiveLabel("2026-07-23", "persian"), "Mordad 1405");
  assert.equal(DDarchiveLabel("2026-07-23", "persian", "fa"), "مرداد ۱۴۰۵");
  assert.equal(DDarchiveName({ from: "2026-08-03", to: "2026-08-30" }), "3 Aug – 30 Aug 2026");
});

test("an archived day keeps only its light record", () => {
  assert.equal(DDarchiveLight(day("2026-08-02", { blocks: [task("a", "Ink")] }), "2026-08-02"), null);
  const light = DDarchiveLight(day("2026-08-03", { mood: "🙂", energy: 2, habits: { walk: { done: true } }, blocks: [task("b", "Wash")], journal: "words" }), "2026-08-03");
  assert.deepEqual(light, day("2026-08-03", { mood: "🙂", energy: 2, habits: { walk: { done: true } } }));
});

test("only months before last month that hold more than light records are offered", () => {
  const data = {
    setup: { archive: [{ id: "2026-07-01_2026-07-31_a", from: "2026-07-01", to: "2026-07-31" }] },
    days: {
      "2026-06-04": day("2026-06-04", { habits: { walk: { done: true } } }), // light only
      "2026-07-09": day("2026-07-09", { blocks: [task("j", "July")] }), // archived already
      "2026-08-02": day("2026-08-02", { blocks: [task("a", "Ink")] }),
      "2026-08-20": day("2026-08-20", { notes: [{ id: "n", text: "idea" }] }),
      "2026-08-21": day("2026-08-21", { mood: "🙂" }),
      "2026-09-05": day("2026-09-05", { journal: "September" }),
      "2026-10-10": day("2026-10-10", { blocks: [task("o", "Last month")] }),
      "2026-11-19": day("2026-11-19", { blocks: [task("t", "This month")] }),
    },
  };
  const plan = DDarchivePlan(data, { today: "2026-11-20" });
  assert.deepEqual(plan.map((m) => [m.from, m.to, m.days]), [["2026-09-01", "2026-09-30", 1], ["2026-08-01", "2026-08-31", 2]]);
  assert.ok(plan[1].bytes > plan[0].bytes, "the room each month takes");
  // Persian: Aban is this month and Mehr last month, so Shahrivar (23 Aug – 22 Sep)
  // is offered; Mordad (23 Jul – 22 Aug) is not, as part of it is archived.
  assert.deepEqual(DDarchivePlan(data, { calendar: "persian", today: "2026-11-20" }).map((m) => m.from), ["2026-08-23"]);
});

test("archiving leaves light records, keeps a day changed since, and comes back whole", () => {
  const august = {
    "2026-08-02": day("2026-08-02", { blocks: [task("a", "Ink", true)], canvas: { board4: { strokes: [{ id: "s1", d: "M0 0" }] } } }),
    "2026-08-03": day("2026-08-03", { mood: "🙂", habits: { walk: { done: true } }, notes: [{ id: "n", text: "idea" }] }),
    "2026-08-04": day("2026-08-04", { journal: "changed later" }),
  };
  const data = { setup: { types: [] }, days: { ...august, "2026-11-19": day("2026-11-19") } };
  const sent = { ...august, "2026-08-04": day("2026-08-04", { journal: "as it was sent" }) };
  const entry = { id: "2026-08-01_2026-08-31_abc", from: "2026-08-01", to: "2026-08-31", label: "August 2026", days: 3, bytes: 500, at: "2026-11-20T10:00:00.000Z" };
  const archived = DDarchiveApply(data, entry, sent);
  assert.equal(archived.days["2026-08-02"], undefined, "a day with nothing light leaves");
  assert.deepEqual(archived.days["2026-08-03"], day("2026-08-03", { mood: "🙂", habits: { walk: { done: true } } }));
  assert.equal(archived.days["2026-08-04"].journal, "changed later", "a day changed since it was sent stays");
  assert.deepEqual(archived.setup.archive.map((e) => e.id), [entry.id]);

  // Since then: a habit ticked on the archived day, and a task added to it.
  archived.days["2026-08-03"] = { ...archived.days["2026-08-03"], habits: { walk: { done: true }, read: { done: true } }, blocks: [task("late", "Added later")] };
  const back = DDbringBackApply(archived, [entry.id], DDarchiveRows([{ days: sent, archivedAt: entry.at }]));
  assert.equal(back.setup.archive, undefined, "nothing left in the archive list");
  assert.deepEqual(back.days["2026-08-02"], august["2026-08-02"]);
  assert.deepEqual(back.days["2026-08-03"].notes, [{ id: "n", text: "idea" }]);
  assert.deepEqual(back.days["2026-08-03"].blocks.map((b) => b.id), ["late"]);
  assert.deepEqual(Object.keys(back.days["2026-08-03"].habits), ["walk", "read"], "habits are as they are now");
  assert.equal(back.days["2026-08-03"].mood, "🙂");
  assert.equal(back.days["2026-08-04"].journal, "changed later");
});

test("joining keeps both sides of lists and never lets an empty field wipe one", () => {
  const joined = DDarchiveJoin(
    day("2026-08-05", { focus: "Cover", blocks: [task("a", "Old"), task("b", "Kept")], canvas: { board4: { strokes: [{ id: "s1" }], layouts: { mindmap: { a: { x: 1 } } } } }, energy: 3 }),
    day("2026-08-05", { blocks: [task("a", "Renamed")], canvas: { board4: { strokes: [{ id: "s2" }], layouts: { mindmap: { c: { x: 2 } } } } } }),
    "2026-08-05",
  );
  assert.equal(joined.focus, "Cover");
  assert.deepEqual(joined.blocks.map((b) => b.name), ["Kept", "Renamed"]);
  assert.deepEqual(joined.canvas.board4.strokes.map((s) => s.id), ["s1", "s2"]);
  assert.deepEqual(Object.keys(joined.canvas.board4.layouts.mindmap), ["a", "c"]);
  assert.equal(joined.energy, undefined, "energy is as it is now");
});

function fixture({ schema = true } = {}) {
  const sql = new DatabaseSync(":memory:");
  if (schema) sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  else sql.exec("CREATE TABLE planner (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE planner_history (revision INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);");
  const env = {
    SYNC_TOKEN: KEY,
    DB: {
      prepare(query) {
        let args = [];
        return {
          bind(...values) { args = values; return this; },
          async first() { return sql.prepare(query).get(...args) || null; },
          async run() { return sql.prepare(query).run(...args); },
          async all() { return { results: sql.prepare(query).all(...args) }; },
        };
      },
    },
  };
  return { sql, env };
}
const call = (env, query = "", { key = KEY, method = "GET", body } = {}) =>
  worker.fetch(new Request("https://dd.test/api/archive" + query, { method, headers: { Authorization: "Bearer " + key, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
const ID = "2026-08-01_2026-08-31_k1";

test("the server keeps an archive, lists it and gives it back", async () => {
  const { sql, env } = fixture({ schema: false });
  try {
    assert.deepEqual(await (await call(env)).json(), { archives: [] }, "an old server makes the table itself");
    const days = { "2026-08-02": day("2026-08-02", { blocks: [task("a", "Ink")] }), "2026-08-09": day("2026-08-09", { notes: [{ id: "n", text: "idea" }] }) };
    const put = await (await call(env, "?id=" + ID, { method: "PUT", body: { days } })).json();
    assert.equal(put.days, 2);
    assert.ok(put.bytes > 100);
    const again = await call(env, "?id=" + ID, { method: "PUT", body: { days } });
    assert.equal(again.status, 200, "a retry of the same archive replaces only itself");
    const list = await (await call(env)).json();
    assert.deepEqual(list.archives.map((a) => [a.id, a.from, a.to, a.days]), [[ID, "2026-08-01", "2026-08-31", 2]]);
    const got = await call(env, "?id=" + ID);
    assert.equal(got.headers.get("Cache-Control"), "no-store");
    assert.deepEqual((await got.json()).days, days);
  } finally {
    sql.close();
  }
});

test("archives are as private as the planner, and checked", async () => {
  const { sql, env } = fixture();
  try {
    const ok = { days: { "2026-08-02": day("2026-08-02") } };
    assert.equal((await call(env, "", { key: "w".repeat(64) })).status, 401);
    assert.equal((await call(env, "?id=" + ID, { method: "POST", body: ok })).status, 405);
    assert.equal((await call(env, "?id=nonsense")).status, 400);
    assert.equal((await call(env, "?id=2026-01-01_2026-06-30_x", { method: "PUT", body: ok })).status, 400, "at most two months");
    assert.equal((await call(env, "?id=" + ID, { method: "PUT", body: { days: { "2026-09-02": day("2026-09-02") } } })).status, 400, "a day outside the archive");
    assert.equal((await call(env, "?id=" + ID, { method: "PUT", body: { days: { "2026-08-02": { blocks: "no" } } } })).status, 400);
    const missing = await call(env, "?id=2026-05-01_2026-05-31_z");
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /not in the archive/);
  } finally {
    sql.close();
  }
});

test("MCP reads an archived day from the archive and lists archived months", async () => {
  const { sql, env } = fixture();
  try {
    const entry = { id: ID, from: "2026-08-01", to: "2026-08-31", label: "August 2026", days: 1, bytes: 300, at: "2026-11-20T10:00:00.000Z" };
    await call(env, "?id=" + ID, { method: "PUT", body: { days: { "2026-08-02": day("2026-08-02", { mood: "🙂", blocks: [task("a", "Ink")] }) } } });
    await save(env, { setup: { types: [], lanes: [], templates: [], archive: [entry] }, days: { "2026-08-02": day("2026-08-02", { mood: "😌" }), "2026-11-19": day("2026-11-19") } }, 0);
    const got = await callTool("get_day", { date: "2026-08-02" }, env, "read");
    assert.deepEqual(got.day.blocks.map((b) => b.name), ["Ink"]);
    assert.equal(got.day.mood, "😌", "what stayed in the planner is newer");
    assert.equal(got.archived.name, "August 2026");
    const list = await callTool("list_days", {}, env, "read");
    assert.deepEqual(list.archived, [{ from: "2026-08-01", to: "2026-08-31", name: "August 2026", days: 1 }]);
    assert.equal((await read(env)).revision, 1, "reading changed nothing");
  } finally {
    sql.close();
  }
});
