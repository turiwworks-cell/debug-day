import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { DDengineSectionIds } from "../public/engine-quiet.js";
import { DDengineCarry, DDengineCopy } from "../public/engine.js";
import { DDsectionsFlow } from "../public/sections-flow.js";
import { DDnormalizeLife, DDlifeHead } from "../public/life-board.js";
import { DDsameSnapshot } from "../public/sync.js";
import { save, read } from "../src/worker.js";

// Made-up data only.
const sec = (id, text, x, y, extra = {}) => ({ id, type: "section", parent: "", text, x, y, w: 400, h: 240, collapsed: false, ...extra });
const feed = { x: 2000, y: -100 };
const area = { x: 0, y: 0, w: 1600, h: 1000 };
// A section whose middle sits at board point (bx, by).
const at = (id, text, bx, by, extra = {}) => sec(id, text, bx - feed.x - 200, by - feed.y - DDlifeHead - 120, { out: true, ...extra });

test("Engine sections are the sections drawn outside the Feed, inside the Engine's frame", () => {
  const items = [
    at("morning", "Morning", 1300, 200),
    at("evening", "Evening", 1300, 800),
    at("far", "Far away", -800, 200),
    sec("studio", "Studio", 40, 60), // inside the Feed
    { ...at("inner", "Inner", 10, 10), parent: "morning", out: undefined },
    at("edge", "On the edge", 1600, 1000),
  ];
  assert.deepEqual([...DDengineSectionIds(items, feed, area)].sort(), ["edge", "evening", "morning"]);
  // A section in the Feed is never one, even if the Feed overlaps the Engine.
  assert.equal(DDengineSectionIds([{ ...items[0], out: undefined }], feed, area).size, 0);
  // Folded, it counts by its folded bar.
  const folded = { ...at("f", "Folded", 1300, 200), collapsed: true };
  folded.y = 1000 - feed.y - DDlifeHead - 19 + 1; // its bar's middle just below the frame
  assert.equal(DDengineSectionIds([folded], feed, area).size, 0);
  // No Engine or no Feed on screen: none.
  assert.equal(DDengineSectionIds(items, null, area).size, 0);
  assert.equal(DDengineSectionIds(items, feed, null).size, 0);
});

const task = (id, name, extra = {}) => ({ id, name, type: "work", lane: "work", min: 60, done: false, subtasks: [], ...extra });
const day = (date, blocks) => ({ date, blocks, notes: [], bugs: [] });

test("the carry line offers yesterday's open tasks and waiting tasks left behind", () => {
  const since = "2026-10-20T10:00:00.000Z";
  const days = {
    "2026-10-20": day("2026-10-20", [task("w0", "Reply from the gallery", { measure: "wait", waitSince: since })]),
    "2026-10-21": day("2026-10-21", [task("w1", "Reply from the gallery", { measure: "wait", waitSince: since }), task("w2", "Print proofs", { measure: "wait", done: true })]),
    "2026-10-22": day("2026-10-22", [task("c1", "Answer from Sam", { measure: "wait" })]),
    "2026-10-23": day("2026-10-23", [task("c2", "Answer from Sam", { measure: "wait", done: true })]),
    "2026-10-25": day("2026-10-25", [task("y1", "Ink the keyframes"), task("y2", "Colour pass", { done: true }), task("y3", "Walk"), task("y4", "  ")]),
  };
  const today = day("2026-10-26", [task("t1", "walk")]);
  const carry = DDengineCarry(days, today);
  assert.equal(carry.date, "2026-10-25", "the last day that had tasks");
  assert.deepEqual(carry.open.map((b) => b.id), ["y1"], "not done, not already here (any case), not nameless");
  assert.deepEqual(carry.waiting.map((b) => b.id), ["w1"], "the latest copy of a waiting task that never arrived");
  assert.equal(carry.count, 2);
  // Brought in, a waiting task keeps waiting since the same moment.
  const copy = DDengineCopy(carry.waiting[0], () => "new");
  assert.deepEqual([copy.id, copy.measure, copy.waitSince, copy.done], ["new", "wait", since, false]);
  // Once here, nothing is offered again.
  const after = DDengineCarry(days, day("2026-10-26", [task("a", "Ink the keyframes"), task("b", "Reply from the gallery"), task("t1", "walk")]));
  assert.equal(after.count, 0);
  // A waiting task already on yesterday's list is offered once, as open.
  const both = DDengineCarry({ "2026-10-25": day("2026-10-25", [task("w", "Hear back", { measure: "wait" })]) }, day("2026-10-26", []));
  assert.deepEqual([both.open.length, both.waiting.length], [1, 0]);
  // Nothing earlier: nothing to offer.
  assert.equal(DDengineCarry({}, day("2026-10-26", [])).count, 0);
  // Only the last 60 days are looked at.
  assert.equal(DDengineCarry({ "2026-01-01": day("2026-01-01", [task("old", "Old wait", { measure: "wait" })]), ...Object.fromEntries(Array.from({ length: 61 }, (_, i) => { const d = new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10); return [d, day(d, [task("x" + i, "Done " + i, { done: true })])]; })) }, day("2026-10-26", [])).count, 0);
});

test("Tab lists the Engine's sections last, in one folded row", () => {
  const items = [
    sec("studio", "Studio", 40, 60),
    { ...sec("clients", "Clients", 20, 60), parent: "studio" },
    sec("morning", "Morning", -900, 0, { out: true }),
    { ...sec("plan", "Plan", 20, 60), parent: "morning" },
    sec("evening", "Evening", -900, 300, { out: true }),
    sec("ideas", "Ideas", 40, 600),
  ];
  const quiet = ["morning", "evening", "clients"]; // a section inside another is never quiet
  const closed = DDsectionsFlow(items, { quiet });
  assert.deepEqual(closed.nodes.map((n) => n.id), ["", "studio", "clients", "ideas"]);
  assert.equal(closed.nodes.find((n) => n.id === "").children, 2, "the Main board does not count them");
  assert.deepEqual([closed.group.count, closed.group.open, closed.group.names], [2, false, ["Morning", "Evening"]]);
  assert.ok(closed.group.y > Math.max(...closed.nodes.map((n) => n.y)), "the row comes after every section");
  assert.ok(closed.height >= closed.group.y + closed.group.h, "the stage makes room for it");
  const open = DDsectionsFlow(items, { quiet, quietOpen: true });
  assert.deepEqual(open.nodes.map((n) => n.id), ["", "studio", "clients", "ideas", "morning", "plan", "evening"]);
  assert.deepEqual(open.nodes.filter((n) => n.quiet).map((n) => n.id), ["morning", "plan", "evening"]);
  assert.equal(open.nodes.find((n) => n.id === "morning").depth, 1);
  assert.ok(open.links.some((l) => l.from === "morning" && l.to === "plan"), "what is inside keeps its line");
  assert.ok(!open.links.some((l) => l.from === "" && l.to === "morning"), "no line from the Main board");
  // A search that finds one opens the row; so does being inside one.
  assert.equal(DDsectionsFlow(items, { quiet, query: "plan" }).group.open, true);
  assert.equal(DDsectionsFlow(items, { quiet, room: "plan" }).group.open, true);
  // Without Engine sections nothing changes.
  const plain = DDsectionsFlow(items);
  assert.equal(plain.group, null);
  assert.deepEqual(plain.nodes.map((n) => n.id), ["", "morning", "plan", "studio", "clients", "evening", "ideas"], "in board order, as before");
});

// Engine sections are read from where a section sits, so the place and the
// "outside the Feed" mark must come back the same after saving and syncing.
test("an Engine section's place and mark survive normalize, save and a three-way sync", async () => {
  const items = [at("morning", "Morning", 1300, 200), sec("studio", "Studio", 40, 60)];
  const life = DDnormalizeLife({ v: 2, items, links: [], frame: { ...feed } });
  assert.deepEqual([...DDengineSectionIds(life.items, life.frame, area)], ["morning"]);
  assert.deepEqual(DDnormalizeLife(life), life, "a second pass changes nothing");

  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; }, async run() { return sql.prepare(query).run(...args); } }; } } };
  try {
    await save(env, { setup: { life, types: [], lanes: [] }, days: {} }, 0);
    const back = (await read(env)).data.setup.life;
    assert.deepEqual([...DDengineSectionIds(back.items, back.frame, area)], ["morning"]);
  } finally {
    sql.close();
  }

  // One device drags Morning out of the Engine while another renames it.
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const merge = runInNewContext(html.slice(html.indexOf("function DDmerge("), html.indexOf("function DDreadBoardView(")) + ";DDmerge", { DDsameSnapshot });
  const base = { setup: { life }, days: {} };
  const moved = structuredClone(base), renamed = structuredClone(base);
  Object.assign(moved.setup.life.items[0], { x: -2800 });
  renamed.setup.life.items[0].text = "Slow morning";
  const merged = JSON.parse(JSON.stringify(merge(base, moved, renamed, "local").data));
  const morning = merged.setup.life.items.find((i) => i.id === "morning");
  assert.deepEqual([morning.text, morning.x, morning.out], ["Slow morning", -2800, true]);
  assert.equal(DDengineSectionIds(merged.setup.life.items, merged.setup.life.frame, area).size, 0, "every device agrees it left the Engine");
});
