import { test } from "node:test";
import assert from "node:assert/strict";
import { DDgraphiteCSS } from "../public/graphite.js";
import { DDreconcileDay } from "../public/relations.js";

test("the Graphite look never styles sticky notes", () => {
  // Notes are named only inside the exclusion of the shared corner rule.
  const named = DDgraphiteCSS.split("\n").filter((line) => /b4-sticky|dd-plan-life-note|dd-sticky/.test(line));
  assert.equal(named.length, 1);
  assert.match(named[0], /:where\(:not\(\.b4-sticky \*,\.dd-plan-life-note \*/);
});

test("the Graphite look defines both themes and keeps one accent token", () => {
  assert.match(DDgraphiteCSS, /:root\{\s*--paper/);
  assert.match(DDgraphiteCSS, /:root\[data-theme=dark\]\{/);
  assert.match(DDgraphiteCSS, /prefers-color-scheme:dark/);
  assert.match(DDgraphiteCSS, /--now:#e8561d/, "light accent");
  assert.match(DDgraphiteCSS, /--now:#e3eb5a/, "dark accent");
});

test("a moved Engine keeps its spot when the day is reconciled", () => {
  const day = { date: "2026-10-31", blocks: [], notes: [], bugs: [], canvas: { board4: { layouts: { mindmap: { "section:engine": { x: 200, y: 120 }, "nope:x": { x: 1, y: 1 } } } } } };
  const next = DDreconcileDay(day, day, { lanes: [] });
  assert.deepEqual(next.canvas.board4.layouts.mindmap["section:engine"], { x: 200, y: 120 });
  assert.equal(next.canvas.board4.layouts.mindmap["nope:x"], undefined);
});
