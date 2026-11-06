import test from "node:test";
import assert from "node:assert/strict";
import { DDengineShift } from "../public/board-layout.js";

const placed = (x, y, extra = {}) => ({ canvas: { board4: { layouts: { mindmap: { "section:engine": { x, y, ...extra } } } } } });

test("the Engine stays where it was moved today", () => {
  assert.deepEqual(DDengineShift({ "section:engine": { x: 40, y: 60, w: 500 } }, {}, "2026-11-06"), { x: 40, y: 60, w: 500 });
});

test("a new day starts the Engine where the last earlier day left it", () => {
  const allDays = {
    "2026-11-02": placed(10, 10),
    "2026-11-04": placed(300, 120, { h: 400 }),
    "2026-11-09": placed(900, 900),
  };
  assert.deepEqual(DDengineShift({}, allDays, "2026-11-06"), { x: 300, y: 120, h: 400 });
});

test("with no earlier day the Engine starts at the corner", () => {
  assert.deepEqual(DDengineShift(undefined, { "2026-11-09": placed(900, 900) }, "2026-11-06"), { x: 0, y: 0 });
});
