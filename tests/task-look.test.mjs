import { test } from "node:test";
import assert from "node:assert/strict";
import { DDtaskLook } from "../public/task-look.js";
import { DDsectionTint } from "../public/life-board.js";

const setup = {
  types: [{ id: "writing", name: "Create", color: "#E5A53B", icon: "pen", emo: "✍️" }],
  life: { v: 2, items: [{ id: "a", type: "section", parent: "", text: "Studio", color: "#9DD6FF" }, { id: "c", type: "section", parent: "a", text: "Sketches" }] },
};

test("a task wears its section's colour, the same tint as its tag", () => {
  const look = DDtaskLook({ id: "t", type: "writing", from: "c" }, setup);
  assert.equal(look.color, DDsectionTint(setup.life.items, "c").fill);
  assert.equal(look.name, "Studio › Sketches");
  assert.equal(look.icon, "dot", "no category icon");
  assert.equal(look.emo, "");
});

test("an own colour still wins; old tasks without a section keep their category's look", () => {
  assert.equal(DDtaskLook({ type: "writing", from: "c", color: "#123456" }, setup).color, "#123456");
  const old = DDtaskLook({ type: "writing" }, setup);
  assert.equal(old.color, "#E5A53B");
  assert.equal(old.icon, "pen");
  assert.equal(DDtaskLook({ type: "writing", from: "gone" }, setup).color, "#E5A53B", "a deleted section falls back");
  assert.equal(DDtaskLook({ type: "nope" }, setup).color, "#8E8A80");
});
