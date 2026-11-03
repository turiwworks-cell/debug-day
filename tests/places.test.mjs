import test from "node:test";
import assert from "node:assert/strict";
import { DDplaceKey, DDplaceName } from "../public/places.js";

test("Alt+arrows: left/right walk the trail, up/down step through the tabs", () => {
  assert.equal(DDplaceKey({ altKey: true, key: "ArrowLeft" }), "back");
  assert.equal(DDplaceKey({ altKey: true, key: "ArrowRight" }), "forward");
  assert.equal(DDplaceKey({ altKey: true, key: "ArrowUp" }), "previous-tab");
  assert.equal(DDplaceKey({ altKey: true, key: "ArrowDown" }), "next-tab");
  // Plain arrows stay with Plan (days) and the board (nudge); other combos are not ours.
  assert.equal(DDplaceKey({ key: "ArrowLeft" }), null);
  assert.equal(DDplaceKey({ altKey: true, shiftKey: true, key: "ArrowLeft" }), null);
  assert.equal(DDplaceKey({ altKey: true, ctrlKey: true, key: "ArrowLeft" }), null);
  assert.equal(DDplaceKey({ altKey: true, metaKey: true, key: "ArrowLeft" }), null);
  assert.equal(DDplaceKey({ altKey: true, key: "a" }), null);
});

test("a place is named by its tab and, on the board, its section", () => {
  assert.equal(DDplaceName({ view: "plan" }), "Plan");
  assert.equal(DDplaceName({ view: "board", room: null }), "Board");
  assert.equal(DDplaceName({ view: "board", room: "a", roomName: "Creative life" }), "Board · Creative life");
  assert.equal(DDplaceName({ view: "setup" }), "Settings");
  assert.equal(DDplaceName({ view: "nowhere" }), "");
  assert.equal(DDplaceName(null), "");
});
