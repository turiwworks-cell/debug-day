import { test } from "node:test";
import assert from "node:assert/strict";
import { DDsectionChoices, DDsectionGo } from "../public/section-tag.js";
import { DDnoteOnEngine } from "../public/board-layout.js";

const items = [
  { id: "a", type: "section", parent: "", text: "Studio" },
  { id: "c", type: "section", parent: "a", text: "Sketches" },
  { id: "b", type: "section", parent: "", text: "Clients" },
  { id: "n", type: "sticky", parent: "c", text: "Sketch notes" },
];

test("the section picker searches whole paths, the section you are in first", () => {
  assert.deepEqual(DDsectionChoices(items).map((c) => c.id), ["b", "a", "c"]);
  assert.deepEqual(DDsectionChoices(items, { query: "studio sket" }).map((c) => c.path), ["Studio › Sketches"]);
  assert.deepEqual(DDsectionChoices(items, { query: "sket" }).map((c) => c.id), ["c"], "notes are never sections");
  assert.equal(DDsectionChoices(items, { here: "c" })[0].id, "c");
});

test("a section asked for before the Board is on screen waits for it", () => {
  let heard = 0;
  const off = DDsectionGo.on(() => heard++);
  DDsectionGo.request("c");
  assert.equal(heard, 1);
  assert.equal(DDsectionGo.take(), "c");
  assert.equal(DDsectionGo.take(), null, "taken once");
  off();
  DDsectionGo.request("");
  assert.equal(DDsectionGo.take(), "", "the Main board is a place too");
});

test("a note on the Engine is judged by its middle", () => {
  const engine = { x: 0, y: 0, w: 600, h: 400 };
  assert.equal(DDnoteOnEngine(engine, { x: 100, y: 100 }), true);
  assert.equal(DDnoteOnEngine(engine, { x: 450, y: 100 }), true, "hanging over the edge still counts");
  assert.equal(DDnoteOnEngine(engine, { x: 700, y: 100 }), false);
  assert.equal(DDnoteOnEngine(null, { x: 100, y: 100 }), false);
});
