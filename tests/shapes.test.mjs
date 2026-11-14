import test from "node:test";
import assert from "node:assert/strict";
import { DDshapeKinds, DDshapeLook, DDshapeSearch, DDshapePath, DDshapeHeight, DDshapeClear, DDshapeRow, DDshapeKind, DDshapeSVG } from "../public/shapes.js";
import { DDboardCore } from "../public/board-core.js";
import { DDnormalizeLife } from "../public/life-board.js";

test("every shape draws a clean path at any size", () => {
  assert.ok(DDshapeKinds.length >= 30);
  assert.equal(new Set(DDshapeKinds.map((k) => k.id)).size, DDshapeKinds.length);
  for (const k of DDshapeKinds) for (const [w, h] of [[200, 200], [40, 300], [600, 40]]) {
    const d = DDshapePath(k.id, w, h);
    assert.match(d, /^M/, k.id);
    assert.doesNotMatch(d, /NaN|undefined|Infinity/, k.id);
  }
  for (const id of DDshapeRow) assert.ok(DDshapeKind(id), id);
});

test("only a known shape and its fill and stroke are kept", () => {
  assert.deepEqual(DDshapeLook({ shape: "star", fillMode: "light", stroke: "#0d99ff", strokeStyle: "dashed", x: 1 }), { shape: "star", fillMode: "light", stroke: "#0D99FF", strokeStyle: "dashed" });
  assert.deepEqual(DDshapeLook({ shape: "blob", fillMode: "none" }), {});
  assert.deepEqual(DDshapeLook({ shape: "ellipse", fillMode: "fill", stroke: "red", strokeStyle: "wavy" }), { shape: "ellipse" }, "Fill is the default and is not stored");
  assert.equal(DDshapeClear({ shape: "ellipse", fillMode: "none" }), true);
  assert.equal(DDshapeClear({ fillMode: "none" }), false);
});

test("search finds shapes by name and by what they are for", () => {
  assert.deepEqual(DDshapeSearch("database").map((k) => k.id), ["cylinder"]);
  assert.ok(DDshapeSearch("decision").some((k) => k.id === "diamond"));
  assert.ok(DDshapeSearch("arrow").length >= 3);
  assert.equal(DDshapeSearch("").length, DDshapeKinds.length);
  assert.equal(DDshapeSearch("zzz").length, 0);
});

test("a shape keeps its size and grows only for its words", () => {
  assert.equal(DDshapeHeight("rectangle", 200, 0), 200);
  assert.equal(DDshapeHeight("rectangle", 200, 120), 200);
  assert.ok(DDshapeHeight("rectangle", 200, 300) > 300);
  assert.ok(DDshapeHeight("diamond", 200, 150) > DDshapeHeight("rectangle", 200, 150), "a diamond needs more room for the same words");
});

test("board styles and the Feed keep a shape's look", () => {
  const style = DDboardCore.style({ shape: "pill", strokeStyle: "none", width: 30, height: 50, textAlign: "center" });
  assert.deepEqual(style, { width: 40, height: 50, textAlign: "center", shape: "pill", strokeStyle: "none" });
  const life = DDnormalizeLife({ v: 2, items: [{ id: "a", type: "sticky", text: "x", style: { shape: "cloud", fillMode: "none", textSize: 18 } }] });
  assert.deepEqual(life.items[0].style, { textSize: 18, shape: "cloud", fillMode: "none" });
  const svg = DDshapeSVG({ shape: "star", x: 10, y: 20, w: 100, h: 100, color: "#FFCD29", strokeStyle: "dashed" });
  assert.match(svg, /translate\(10 20\)/);
  assert.match(svg, /stroke-dasharray="8 6"/);
});
