// Copies on the server (5.90.0): one copy a day, as the planner stood at the
// end of each of the last 30 days it changed, beside the last 20 saves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { save, read } from "../src/worker.js";

const KEY = "s".repeat(64);
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
const planner = (note) => ({ setup: { types: [], lanes: [], templates: [] }, days: { "2026-11-18": { date: "2026-11-18", blocks: [], notes: [{ id: "n", kind: "sticky", text: note }], bugs: [] } } });
const call = (env, query = "", { key = KEY, method = "GET", origin } = {}) =>
  worker.fetch(new Request("https://dd.test/api/backups" + query, { method, headers: { Authorization: "Bearer " + key, ...(origin ? { Origin: origin } : {}) } }), env);
const back = (sql, day) => sql.prepare("UPDATE planner SET updated_at = ? WHERE id = 1").run(day + "T21:00:00.000Z");

test("the first save of a new day keeps the day before, once", async () => {
  const { sql, env } = fixture();
  try {
    await save(env, planner("Monday"), 0);
    back(sql, "2026-11-17");
    await save(env, planner("Tuesday"), 1); // a new day: Monday's planner is kept
    await save(env, planner("Tuesday, later"), 2); // the same day: nothing more
    const list = await (await call(env)).json();
    assert.deepEqual(list.daily.map((c) => [c.day, c.revision]), [["2026-11-17", 1]]);
    assert.ok(list.daily[0].bytes > 50, "its size is known");
    assert.deepEqual(list.recent.map((c) => c.revision), [2, 1], "the last saves, newest first");
    const copy = await (await call(env, "?day=2026-11-17")).json();
    assert.equal(copy.data.days["2026-11-18"].notes[0].text, "Monday");
    assert.equal(copy.revision, 1);
    const saved = await (await call(env, "?revision=2")).json();
    assert.equal(saved.data.days["2026-11-18"].notes[0].text, "Tuesday");
    assert.equal((await read(env)).data.days["2026-11-18"].notes[0].text, "Tuesday, later", "the planner itself is untouched");
  } finally {
    sql.close();
  }
});

test("30 daily copies are kept, the oldest go", async () => {
  const { sql, env } = fixture();
  try {
    await save(env, planner("start"), 0);
    for (let i = 0; i < 34; i++) {
      const day = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
      back(sql, day);
      await save(env, planner("day " + i), i + 1);
    }
    const list = await (await call(env)).json();
    assert.equal(list.daily.length, 30);
    assert.equal(list.daily[0].day, "2026-10-04");
    assert.equal(list.daily.at(-1).day, "2026-09-05");
  } finally {
    sql.close();
  }
});

test("a server set up before 5.90.0 makes the table itself", async () => {
  const { sql, env } = fixture({ schema: false });
  try {
    sql.prepare("INSERT INTO planner (id, data, revision, updated_at) VALUES (1, ?, 3, '2026-11-01T10:00:00.000Z')").run(JSON.stringify(planner("old")));
    assert.deepEqual(await (await call(env)).json(), { daily: [], recent: [] });
    await save(env, planner("new"), 3);
    assert.deepEqual((await (await call(env)).json()).daily.map((c) => c.day), ["2026-11-01"]);
  } finally {
    sql.close();
  }
});

test("copies are as private as the planner, and asked for carefully", async () => {
  const { sql, env } = fixture();
  try {
    await save(env, planner("x"), 0);
    assert.equal((await call(env, "", { key: "w".repeat(64) })).status, 401);
    assert.equal((await call(env, "", { origin: "https://evil.test" })).status, 403);
    assert.equal((await call(env, "", { method: "PUT" })).status, 405);
    assert.equal((await call(env, "?day=yesterday")).status, 400);
    assert.equal((await call(env, "?revision=-2")).status, 400);
    const missing = await call(env, "?day=2020-01-01");
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /no longer on the server/);
    assert.equal((await call(env)).headers.get("Cache-Control"), "no-store");
  } finally {
    sql.close();
  }
});

test("a save still works when a copy can't be made", async () => {
  const { sql, env } = fixture();
  try {
    await save(env, planner("a"), 0);
    const prepare = env.DB.prepare;
    env.DB.prepare = (query) => (/planner_daily/.test(query) ? { bind() { return this; }, run: async () => { throw Error("disk full"); } } : prepare(query));
    back(sql, "2026-11-01");
    assert.equal((await save(env, planner("b"), 1)).revision, 2);
  } finally {
    sql.close();
  }
});
