import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDlifeDefault,
  DDlifeItems,
  DDnormalizeLife,
  DDlifeAdd,
  DDlifeRemove,
  DDlifeMoveBy,
  DDlifeAbs,
  DDlifeBounds,
  DDlifeColor,
  DDlifeContrast,
} from "../public/life-board.js";

test("every day starts with the same planning content", () => {
  const items = DDlifeItems({});
  assert.equal(items.length, 49);
  assert.equal(items.filter((i) => i.type === "section").length, 17);
  assert.deepEqual(DDlifeItems({ life: { items: [] } }), []);
  const texts = items.map((i) => i.text);
  for (const text of ["state of mind", "routine", "LIFE/CREATIVITY", "Job", "Doing", "getting clients", "daily routin", "Part Part", "tests", "job board"])
    assert.ok(texts.includes(text), text);
  assert.ok(texts.includes("1- اولویت 2- علاقه 3- سختی 4- احتمال 5- انجام دادن 6- پایداری"));
});

test("section overlaps do not silently nest or enlarge their neighbours", () => {
  const items = [
    { id: "a", type: "section", parent: "", x: 0, y: 0, w: 400, h: 400 },
    { id: "b", type: "section", parent: "", x: 500, y: 0, w: 400, h: 400 },
    { id: "n", type: "sticky", parent: "a", x: 20, y: 50, w: 100, h: 100 },
  ];
  const moved = DDlifeMoveBy(items, "a", 350, 40);
  assert.equal(moved.find((i) => i.id === "a").parent, "");
  assert.deepEqual(moved.find((i) => i.id === "b"), items[1]);
  assert.deepEqual(DDlifeAbs(moved, "n"), { x: 370, y: 90 });
  assert.equal(DDlifeMoveBy(items, "a", 0, 0), items, "a click never changes stacking or membership");
  const smaller = items.map((i) => i.id === "a" ? { ...i, w: 200, h: 200 } : i);
  const nested = DDlifeMoveBy(smaller, "a", 550, 100);
  assert.equal(nested.find((i) => i.id === "a").parent, "b", "fully contained sections can still nest");
  assert.deepEqual(DDlifeAbs(nested, "n"), { x: 570, y: 150 });
});

test("legacy sections get stable family colors; saved colors and contrast survive reload", () => {
  const items = DDlifeDefault(), parent = items.find((i) => i.id === "lf-257-529"),
    child = items.find((i) => i.id === "lf-257-544");
  assert.equal(DDlifeColor(items, parent), DDlifeColor(items, child));
  assert.equal(DDlifeColor([...items].reverse(), parent), DDlifeColor(items, parent));
  const saved = DDnormalizeLife({ items: [{ ...parent, color: "#9DD6FF" }] }).items[0];
  assert.equal(DDlifeColor([saved], saved), "#9DD6FF");
  assert.equal(DDlifeContrast("#9DD6FF"), "#121211");
  assert.equal(DDlifeContrast("#222222"), "#FFFFFF");
});

test("normalizing drops broken items and parent loops", () => {
  const out = DDnormalizeLife({
    items: [
      { id: "a", type: "section", parent: "b", x: 1, y: 2, w: 300, h: 200 },
      { id: "b", type: "section", parent: "a", x: 1, y: 2, w: 300, h: 200 },
      { id: "s", type: "sticky", parent: "nope", x: "x", y: 5, text: "hi", color: "red" },
      { id: "s", type: "sticky" },
      { id: "z", type: "other" },
      null,
    ],
  });
  assert.deepEqual(out.items.map((i) => [i.id, i.parent]), [["a", ""], ["b", "a"], ["s", ""]]);
  assert.equal(out.items[2].x, 0);
  assert.equal("color" in out.items[2], false);
});

test("adding inside a section grows it; deleting a section keeps what was inside", () => {
  let items = [{ id: "sec", type: "section", parent: "", x: 100, y: 100, w: 200, h: 150, text: "S" }];
  items = DDlifeAdd(items, { id: "n", type: "sticky", parent: "sec", text: "note" });
  const sec = items.find((i) => i.id === "sec");
  assert.ok(sec.w >= 240 + 24 && sec.h >= 240 + 48);
  const n = items.find((i) => i.id === "n");
  assert.deepEqual(DDlifeAbs(items, "n"), { x: 100 + n.x, y: 100 + n.y });
  const left = DDlifeRemove(items, "sec");
  assert.equal(left.length, 1);
  assert.deepEqual([left[0].parent, left[0].x, left[0].y], ["", 100 + n.x, 100 + n.y]);
});

test("dropping on a section joins it; dropping on empty space leaves it", () => {
  const base = [
    { id: "a", type: "section", parent: "", x: 0, y: 0, w: 400, h: 400, text: "A" },
    { id: "b", type: "section", parent: "", x: 600, y: 0, w: 400, h: 400, text: "B" },
    { id: "s", type: "sticky", parent: "a", x: 50, y: 50, w: 100, h: 100, text: "" },
  ];
  const inB = DDlifeMoveBy(base, "s", 620, 0);
  const s = inB.find((i) => i.id === "s");
  assert.equal(s.parent, "b");
  assert.deepEqual(DDlifeAbs(inB, "s"), { x: 670, y: 50 });
  const out = DDlifeMoveBy(base, "s", 0, 1000);
  assert.equal(out.find((i) => i.id === "s").parent, "");
  // A section cannot be dropped into itself or what it holds.
  const self = DDlifeMoveBy(base, "a", 10, 10);
  assert.equal(self.find((i) => i.id === "a").parent, "");
  assert.ok(DDlifeBounds(base).w >= 1000);
});
