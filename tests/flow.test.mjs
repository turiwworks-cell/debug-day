import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDflowItems,
  DDflowCanAdd,
  DDflowAdd,
  DDflowRemove,
  DDflowWaitingOn,
  DDflowWaves,
  DDflowEdges,
  DDflowClean,
  DDflowKeep,
  DDflowParse,
} from "../public/flow.js";
import { DDcanonicalEdges, DDconnectRelation, DDdisconnectRelation, DDrelation, DDreconcileDay, DDremoveOrder, DDmoveOrder } from "../public/relations.js";
import { DDengineNextStep } from "../public/engine.js";

const step = (id, text, extra = {}) => ({ id, text, done: false, children: [], ...extra });
const task = (id, name, extra = {}) => ({ id, name, lane: "work", done: false, subtasks: [], ...extra });
const setup = { lanes: [{ id: "work", name: "Work" }] };
function day() {
  return {
    date: "2026-11-13",
    blocks: [
      task("sk", "Sketch", { subtasks: [step("th", "Thumbnails", { done: true }), step("li", "Lines", { children: [step("in", "Ink")] })] }),
      task("co", "Colour"),
      task("pr", "Print"),
      task("em", "Emails"),
    ],
    notes: [],
    bugs: [],
    canvas: { board4: { links: [], layouts: {}, overrides: {} } },
  };
}

test("refs name tasks and steps the way the Board does", () => {
  assert.deepEqual(DDflowParse("b:sk"), { blockId: "sk", stepId: null });
  assert.deepEqual(DDflowParse("sub:sk:li"), { blockId: "sk", stepId: "li" });
  assert.equal(DDflowParse("sticky:n1"), null);
  const items = DDflowItems(day());
  assert.equal(items.get("sub:sk:in").name, "Ink");
  assert.deepEqual(items.get("sub:sk:in").parents, ["b:sk", "sub:sk:li"]);
});

test("an order is written on the task or step itself, and loops are refused", () => {
  let d = DDflowAdd(day(), "b:co", "sub:sk:li");
  assert.deepEqual(d.blocks[1].after, ["sub:sk:li"]);
  d = DDflowAdd(d, "b:pr", "b:co");
  const items = DDflowItems(d);
  assert.equal(DDflowCanAdd(items, "b:sk", "b:pr"), false, "Sketch after Print would go round in a circle");
  assert.equal(DDflowCanAdd(items, "sub:sk:li", "b:pr"), false, "so would its step");
  assert.equal(DDflowCanAdd(items, "b:co", "sub:sk:li"), false, "already there");
  assert.equal(DDflowCanAdd(items, "sub:sk:in", "sub:sk:li"), false, "never after its own parent");
  assert.equal(DDflowCanAdd(items, "b:sk", "sub:sk:li"), false, "a task is not after its own step");
  assert.equal(DDflowCanAdd(items, "b:em", "b:co"), true);
  assert.equal(DDflowAdd(d, "b:sk", "b:pr"), d, "a refused order changes nothing");
  // A step of one task can wait for a step of another.
  d = DDflowAdd(d, "sub:sk:in", "b:em");
  assert.deepEqual(d.blocks[0].subtasks[1].children[0].after, ["b:em"]);
  d = DDflowRemove(d, "b:pr", "b:co");
  assert.equal("after" in d.blocks[2], false, "an empty order leaves no trace");
});

test("waiting follows what is still open, including a step's order in another task", () => {
  let d = DDflowAdd(day(), "b:co", "sub:sk:li");
  let items = DDflowItems(d);
  assert.deepEqual(DDflowWaitingOn(items, "b:co").map((i) => i.ref), ["sub:sk:li"]);
  d.blocks[0].subtasks[1].done = true;
  items = DDflowItems(d);
  assert.deepEqual(DDflowWaitingOn(items, "b:co"), [], "done, so Colour can start");
  d = DDflowAdd(day(), "sub:sk:in", "b:em");
  items = DDflowItems(d);
  assert.deepEqual(DDflowWaitingOn(items, "b:sk").map((i) => i.ref), ["b:em"], "the task waits for what its step waits for");
  // The next step skips one that is waiting.
  const waiting = (s) => DDflowWaitingOn(items, "sub:sk:" + s.id).length > 0;
  assert.equal(DDengineNextStep(d.blocks[0].subtasks, waiting).id, "in", "every open step waits, so the first one stays");
});

test("waves: side by side now, then what follows", () => {
  let d = DDflowAdd(day(), "b:co", "b:sk");
  d = DDflowAdd(d, "b:pr", "b:co");
  assert.deepEqual(DDflowWaves(d).map((w) => w.map((b) => b.id)), [["sk", "em"], ["co"], ["pr"]]);
  d.blocks[0].done = true;
  assert.deepEqual(DDflowWaves(d).map((w) => w.map((b) => b.id)), [["co", "em"], ["pr"]], "done tasks leave; Colour can start");
  assert.deepEqual(DDflowWaves(day()).map((w) => w.length), [4], "no order, one plain list");
});

test("orders to tasks that left the day are cleaned, and kept clean on load", () => {
  let d = DDflowAdd(day(), "b:co", "b:pr");
  d.blocks = d.blocks.filter((b) => b.id !== "pr");
  const clean = DDflowClean(d);
  assert.equal("after" in clean.blocks[1], false);
  assert.equal(DDflowClean(clean), clean, "nothing to clean returns the same day");
  assert.deepEqual(DDflowKeep(["b:a", "b:a", 4, "sticky:x", "sub:a:b"]), ["b:a", "sub:a:b"]);
  assert.equal(DDflowKeep([]), undefined);
  assert.equal("after" in DDreconcileDay(d, d, setup).blocks[1], false, "every board edit tidies too");
});

test("the Board draws orders as lines and a task-to-task line sets an order", () => {
  let d = DDflowAdd(day(), "b:co", "sub:sk:li");
  assert.deepEqual(DDflowEdges(d), [{ from: "sub:sk:li", to: "b:co" }]);
  const edge = DDcanonicalEdges(d, ["work"]).find((e) => e.after);
  assert.equal(edge.id, "auto:after:sub:sk:li->b:co");
  assert.deepEqual(DDrelation("b:sk", "b:pr", ["work"]), { kind: "after", before: "b:sk", after: "b:pr" });
  // Drawing Print -> Emails: Emails comes after Print.
  d = DDconnectRelation(d, "b:pr", "b:em", setup);
  assert.deepEqual(d.blocks[3].after, ["b:pr"]);
  // A line that would loop changes nothing.
  assert.deepEqual(DDconnectRelation(d, "b:em", "b:pr", setup), DDreconcileDay(d, d, setup));
  d = DDdisconnectRelation(d, "b:pr", "b:em", setup);
  assert.equal("after" in d.blocks[3], false);
  // Removing or moving an order line (steps included) changes only the order.
  d = DDflowAdd(day(), "sub:sk:in", "b:em");
  assert.equal("after" in DDremoveOrder(d, "b:em", "sub:sk:in", setup).blocks[0].subtasks[1].children[0], false);
  const moved = DDmoveOrder(d, { from: "b:em", to: "sub:sk:in" }, "sub:sk:in", "b:em", setup);
  assert.deepEqual(moved.blocks[3].after, ["sub:sk:in"], "reversed: Emails after Ink");
  assert.equal(DDmoveOrder(d, { from: "b:em", to: "sub:sk:in" }, "sub:sk:li", "sub:sk:in", setup), d, "never after its own parent");
});

test("Claude can set the order over MCP, with the same rules", async () => {
  const { callTool, save, read } = await import("../src/worker.js");
  const { DatabaseSync } = await import("node:sqlite");
  const { readFileSync } = await import("node:fs");
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; } }; } } };
  try {
    const d = day();
    await save(env, { setup: { types: [{ id: "work" }], lanes: setup.lanes, later: [], worries: [] }, days: { [d.date]: d } }, 0);
    await callTool("update_block", { expected_revision: 1, date: d.date, block_id: "co", after_block_ids: ["sk"] }, env, "write");
    assert.deepEqual((await read(env)).data.days[d.date].blocks[1].after, ["b:sk"]);
    await assert.rejects(callTool("update_block", { expected_revision: 2, date: d.date, block_id: "sk", after_block_ids: ["co"] }, env, "write"), /loop/);
    await assert.rejects(callTool("update_block", { expected_revision: 2, date: d.date, block_id: "sk", after_block_ids: ["gone"] }, env, "write"), /missing/);
    await callTool("update_block", { expected_revision: 2, date: d.date, block_id: "co", after_block_ids: [] }, env, "write");
    assert.equal("after" in (await read(env)).data.days[d.date].blocks[1], false);
  } finally {
    sql.close();
  }
});
