import { test } from "node:test";
import assert from "node:assert/strict";
import { DDsectionsFlow } from "../public/sections-flow.js";
import { DDsectionKeys, DDsetSectionKey, DDcaptureId } from "../public/section-keys.js";
import { DDcaptureEnsure, DDnormalizeLife } from "../public/life-board.js";
import { DDcaptureWaiting } from "../public/engine.js";

const section = (id, text, extra = {}) => ({ id, type: "section", parent: "", x: 0, y: 0, w: 400, h: 300, text, ...extra });
const note = (id, parent, text, at = "2026-11-13") => ({ id, type: "sticky", parent, x: 0, y: 0, w: 240, h: 200, text, at });

test("Capture sits on its own row above the Main board, apart from the other sections", () => {
  const items = [section("a", "Studio", { y: 10 }), section(DDcaptureId, "Capture", { y: 0 }), note("n", DDcaptureId, "Idea")];
  const flow = DDsectionsFlow(items, { measure: () => 40 });
  const cap = flow.nodes.find((n) => n.id === DDcaptureId), main = flow.nodes.find((n) => n.id === ""), studio = flow.nodes.find((n) => n.id === "a");
  assert.equal(cap.capture, true);
  assert.equal(cap.depth, 0);
  assert.ok(cap.y < main.y);
  assert.equal(cap.notes, 1);
  assert.equal(studio.capture, false);
  assert.equal(flow.links.some((l) => l.to === DDcaptureId), false, "not a branch of the Main board");
});

test("before the first idea Capture is a dashed space only when the board asks for it", () => {
  const items = [section("a", "Studio")];
  assert.equal(DDsectionsFlow(items).nodes.some((n) => n.id === DDcaptureId), false);
  const ghost = DDsectionsFlow(items, { capture: true }).nodes.find((n) => n.id === DDcaptureId);
  assert.equal(ghost.ghost, true);
  assert.equal(DDsectionsFlow(items, { capture: true, query: "stud" }).nodes.find((n) => n.id === DDcaptureId).dim, true);
});

test("Capture has C until another section takes it, and can let it go", () => {
  const items = [section(DDcaptureId, "Capture"), section("w", "Work", { key: "w" })];
  assert.equal(DDsectionKeys(items).byKey.get("c"), DDcaptureId);
  const taken = DDsetSectionKey(items, "w", "c");
  assert.equal(DDsectionKeys(taken).byKey.get("c"), "w");
  const none = DDsetSectionKey(items, DDcaptureId, "");
  assert.equal(none.find((i) => i.id === DDcaptureId).key, "-");
  assert.equal(DDsectionKeys(none).byKey.has("c"), false);
});

test("the old Inbox is called Capture, a name you gave it stays, and it is made once", () => {
  const life = DDnormalizeLife({ items: [section(DDcaptureId, "Inbox")] });
  assert.equal(life.items[0].text, "Capture");
  assert.equal(DDnormalizeLife({ items: [section(DDcaptureId, "Ideas")] }).items[0].text, "Ideas");
  const once = DDcaptureEnsure([]);
  assert.equal(once.length, 1);
  assert.equal(once[0].text, "Capture");
  assert.equal(DDcaptureEnsure(once), once);
});

test("ideas wait in Capture until one goes to a day or to Park", () => {
  const items = [section(DDcaptureId, "Capture"), note("i1", DDcaptureId, "Poster", "2026-11-12"), note("i2", DDcaptureId, "Printer"), note("i3", DDcaptureId, "  "), note("x", "", "Elsewhere")];
  const setup = { life: { v: 2, items, links: [] }, later: [] };
  assert.deepEqual(DDcaptureWaiting(setup, {}).map((i) => i.id), ["i1", "i2"]);
  const parked = { ...setup, later: [{ id: "p", name: "Poster", noteRef: "i1" }] };
  assert.deepEqual(DDcaptureWaiting(parked, {}).map((i) => i.id), ["i2"]);
  const days = { "2026-11-13": { blocks: [{ id: "b", name: "Printer", noteRef: "i2" }] } };
  assert.deepEqual(DDcaptureWaiting(parked, days), []);
});
