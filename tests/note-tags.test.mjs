import test from "node:test";
import assert from "node:assert/strict";
import { DDtagCounts, DDallTags, DDtagSwap, DDtagSwapItem, DDtagSwapList, DDtagSwapDay } from "../public/note-tags.js";

// Note tags like Milanote's labels (5.62): counts, rename and delete everywhere.
test("tags are counted across days, Later and the Feed, most used first", () => {
  const days = { a: { blocks: [{ tags: ["idea"] }], notes: [{ tags: ["Idea", "sketch"] }] }, b: { notes: [{ tags: ["sketch"] }, { tags: ["sketch"] }] } };
  const setup = { later: [{ tags: ["idea"] }], life: { items: [{ tags: ["ink"] }] } };
  assert.deepEqual(DDtagCounts(days, setup), [{ tag: "idea", n: 3 }, { tag: "sketch", n: 3 }, { tag: "ink", n: 1 }]);
  assert.deepEqual(DDallTags(days, setup), ["idea", "sketch", "ink"]);
});

test("a rename keeps the order and joins a tag already there; no name deletes", () => {
  assert.deepEqual(DDtagSwap(["a", "B", "c"], "b", "d"), ["a", "d", "c"]);
  assert.deepEqual(DDtagSwap(["a", "B", "c"], "b", "A"), ["a", "c"]);
  assert.deepEqual(DDtagSwap(["a", "b"], "A", null), ["b"]);
  assert.deepEqual(DDtagSwap(["a"], "a", "Sketch book"), ["Sketch_book"]);
});

test("things without the tag come back as they were", () => {
  const item = { id: 1, tags: ["x"] }, list = [item], day = { blocks: list, notes: [] };
  assert.equal(DDtagSwapItem(item, "y", "z"), item);
  assert.equal(DDtagSwapList(list, "y", "z"), list);
  assert.equal(DDtagSwapDay(day, "y", "z"), day);
  const gone = DDtagSwapItem(item, "x", null);
  assert.notEqual(gone, item);
  assert.equal("tags" in gone, false, "no tags means no tags field");
  assert.deepEqual(item.tags, ["x"], "the old item is not changed");
  assert.deepEqual(DDtagSwapDay(day, "x", "w").blocks[0].tags, ["w"]);
});
