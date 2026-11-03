import test from "node:test";
import assert from "node:assert/strict";
import { DDundoRevert } from "../public/board-history.js";

const day = (notes, extra = {}) => ({ date: "2026-11-03", blocks: [], notes, ...extra });
const note = (id, x, text = id) => ({ id, kind: "sticky", text, x, y: 0 });

test("undoing a move keeps a note that arrived from the phone since", () => {
  const before = day([note("a", 10)]);
  const after = day([note("a", 300)]);
  const now = day([note("a", 300), note("phone", 50, "From the phone")]);
  const undone = DDundoRevert(now, after, before);
  assert.deepEqual(undone.notes, [note("a", 10), note("phone", 50, "From the phone")]);
});

test("undo removes what the action added and brings back what it removed", () => {
  const before = day([note("a", 0), note("b", 1), note("c", 2)]);
  const after = day([note("a", 0), note("c", 2), note("new", 9)]);
  const now = day([note("a", 0), note("c", 2), note("new", 9), note("phone", 5)]);
  assert.deepEqual(DDundoRevert(now, after, before).notes.map((n) => n.id), ["a", "b", "c", "phone"]);
});

test("undo does not bring back what was deleted later elsewhere", () => {
  const before = day([note("a", 0), note("b", 1)]);
  const after = day([note("a", 5), note("b", 1)]);
  const now = day([note("a", 5)]);
  assert.deepEqual(DDundoRevert(now, after, before).notes, [note("a", 0)]);
});

test("undo keeps other fields changed since on the same object", () => {
  const before = day([note("a", 0, "Old")]);
  const after = day([note("a", 40, "Old")]);
  const now = day([note("a", 40, "Edited on the phone")]);
  assert.deepEqual(DDundoRevert(now, after, before).notes, [note("a", 0, "Edited on the phone")]);
});

test("undo restores order the action changed, and keys it added are removed", () => {
  const before = day([note("a", 0), note("b", 0)], { canvas: { board4: { styles: {} } } });
  const after = day([note("b", 0), note("a", 0)], { canvas: { board4: { styles: { "sticky:a": { fontSize: 20 } } } } });
  const now = structuredClone(after);
  const undone = DDundoRevert(now, after, before);
  assert.deepEqual(undone.notes.map((n) => n.id), ["a", "b"]);
  assert.deepEqual(undone.canvas.board4.styles, {});
});

test("redo is the same step the other way", () => {
  const before = day([note("a", 10)]);
  const after = day([note("a", 300)]);
  const now = day([note("a", 300), note("phone", 50)]);
  const undone = DDundoRevert(now, after, before);
  const withLater = { ...undone, focus: "Typed after undo" };
  const redone = DDundoRevert(withLater, undone, now);
  assert.deepEqual(redone.notes, [note("a", 300), note("phone", 50)]);
  assert.equal(redone.focus, "Typed after undo");
});
