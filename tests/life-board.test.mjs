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
  DDlifePath,
  DDlifeKeepIn,
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

test("FigJam sections: drawing around things takes them in; Delete takes the contents", async () => {
  const { DDlifeAdopt, DDlifeRemoveTree } = await import("../public/life-board.js");
  let items = [
    { id: "old", type: "section", parent: "", x: 100, y: 100, w: 300, h: 200, text: "Section 1" },
    { id: "n", type: "sticky", parent: "old", x: 20, y: 20, w: 100, h: 100, text: "inside" },
    { id: "loose", type: "sticky", parent: "", x: 450, y: 120, w: 100, h: 100, text: "beside" },
    { id: "far", type: "sticky", parent: "", x: 900, y: 900, w: 100, h: 100, text: "far" },
  ];
  // Placed by hand: hanging over the edge does not grow the section.
  items = DDlifeAdd(items, { id: "edge", type: "sticky", parent: "old", x: 250, y: 150, w: 100, h: 100 });
  assert.deepEqual([items[0].w, items[0].h], [300, 200]);
  items = DDlifeAdopt(DDlifeAdd(items, { id: "big", type: "section", parent: "", x: 60, y: 40, w: 560, h: 340 }), "big");
  const by = (id) => items.find((i) => i.id === id);
  assert.equal(by("old").parent, "big");
  assert.equal(by("loose").parent, "big");
  assert.equal(by("far").parent, "");
  assert.equal(by("n").parent, "old", "grandchildren keep their own section");
  assert.deepEqual(DDlifeAbs(items, "loose"), { x: 450, y: 120 }, "adopted items do not move");
  // Moving the outer section carries everything nested in it.
  const moved = DDlifeMoveBy(items, "big", 1000, 0);
  assert.deepEqual(DDlifeAbs(moved, "n"), { x: 1120, y: 120 });
  const left = DDlifeRemoveTree(items, "big");
  assert.deepEqual(left.map((i) => i.id), ["far"]);
  const kept = DDlifeRemoveTree(items, "big", new Set(["n"]));
  assert.deepEqual(kept.map((i) => [i.id, i.parent]), [["n", ""], ["far", ""]]);
  assert.deepEqual(DDlifeAbs(kept, "n"), { x: 120, y: 120 });
});

test("sections moved together never drop into each other", () => {
  const items = [
    { id: "a", type: "section", parent: "", x: 0, y: 0, w: 200, h: 200 },
    { id: "b", type: "section", parent: "", x: 300, y: 0, w: 400, h: 400 },
  ];
  // Alone, "a" moved over "b" joins it; moved together with "b" it stays top level.
  assert.equal(DDlifeMoveBy(items, "a", 350, 50).find((i) => i.id === "a").parent, "b");
  assert.equal(DDlifeMoveBy(items, "a", 350, 50, ["b"]).find((i) => i.id === "a").parent, "");
});

const room = [
  { id: "top", type: "section", parent: "", x: 100, y: 100, w: 900, h: 700 },
  { id: "inner", type: "section", parent: "top", x: 20, y: 40, w: 400, h: 300 },
  { id: "note", type: "sticky", parent: "inner", x: 10, y: 50, w: 200, h: 150 },
  { id: "away", type: "sticky", parent: "", x: 2000, y: 2000, w: 200, h: 150 },
];

test("a section's path runs from the top section down to it", () => {
  assert.deepEqual(DDlifePath(room, "note").map((i) => i.id), ["top", "inner", "note"]);
  assert.deepEqual(DDlifePath(room, "top").map((i) => i.id), ["top"]);
  assert.deepEqual(DDlifePath(room, "missing"), []);
});

test("inside a section's board, things made or moved there stay in it", () => {
  // The note was dragged out of "inner" onto empty canvas (it lost its parent).
  const moved = room.map((i) => (i.id === "note" ? { ...i, parent: "", x: 1300, y: 900 } : i));
  const made = { id: "new", type: "sticky", parent: "", x: 50, y: 60, w: 100, h: 100 };
  const kept = DDlifeKeepIn([...moved, made], "inner", room);
  const at = (id) => kept.find((i) => i.id === id);
  assert.equal(at("note").parent, "inner");
  assert.deepEqual(DDlifeAbs(kept, "note"), { x: 1300, y: 900 }, "it stays where it was dropped");
  assert.equal(at("new").parent, "inner");
  assert.deepEqual(DDlifeAbs(kept, "new"), { x: 50, y: 60 });
  assert.equal(at("away").parent, "", "things that were never inside are left alone");
  assert.equal(at("top").parent, "", "the sections around it are left alone");
  assert.equal(DDlifeKeepIn(room, "inner", room), room, "nothing to do, same list");
  assert.equal(DDlifeKeepIn(room, "gone", room), room);
});

test("a branch that drifts out comes back whole", () => {
  const before = [...room, { id: "kid", type: "section", parent: "inner", x: 0, y: 0, w: 100, h: 100 }, { id: "deep", type: "sticky", parent: "kid", x: 5, y: 5, w: 50, h: 50 }];
  const after = before.map((i) => (i.id === "kid" ? { ...i, parent: "", x: 3000, y: 10 } : i));
  const kept = DDlifeKeepIn(after, "inner", before);
  assert.equal(kept.find((i) => i.id === "kid").parent, "inner");
  assert.equal(kept.find((i) => i.id === "deep").parent, "kid", "what is inside it comes along");
});
