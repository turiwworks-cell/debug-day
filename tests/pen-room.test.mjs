// How much you can draw (5.88.1): measured in room, not in a count of lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DDinkCheck, DDinkStopText, DDinkRoomLine, DDnormalizeStrokes, DDstrokeDecode } from "../public/pen.js";

const line = (id, extra = {}) => ({ id, pts: "10,10 4,3 5,-2 6,1", color: "#1E1E1E", width: 4, ...extra });
const many = (n, prefix = "s", extra) => Array.from({ length: n }, (_, i) => line(prefix + i, extra));

test("a board keeps far more than 600 drawings, and reads every one back", () => {
  const list = many(1200);
  assert.equal(DDnormalizeStrokes(list).length, 1200, "no longer cut at 600");
  assert.equal(DDnormalizeStrokes(many(2400, "f", { parent: "sec" }), { life: true }).length, 2400, "the whole Feed too");
  assert.equal(DDnormalizeStrokes(many(6000)).length, 5000, "a hard top far above what can be drawn");
});

test("the text of a line is still checked and written the one exact way", () => {
  const out = DDnormalizeStrokes([{ id: "a", pts: "0,0 1.04,1" }, { id: "b", pts: "x" }, { id: "c", pts: "" }, { id: "d", pts: 5 }, { id: "a", pts: "1,1" }]);
  assert.deepEqual(out.map((s) => [s.id, s.pts]), [["a", "0,0 1,1"]]);
  // Remembered by the text: asking again gives the same answer.
  assert.equal(DDnormalizeStrokes([{ id: "a", pts: "0,0 1.04,1" }])[0].pts, "0,0 1,1");
  // Decoding still gives a fresh copy that can be changed in place.
  const a = DDstrokeDecode("0,0 1,1"), b = DDstrokeDecode("0,0 1,1");
  a[0] = 99;
  assert.deepEqual(b, [0, 0, 1, 1]);
});

test("deleting, erasing, moving and restyling always go through", () => {
  const day = many(3000), life = many(3000, "f", { parent: "sec" });
  assert.equal(DDinkCheck([day, life], [day.slice(1), life], { plannerBytes: 2e6 }).stop, "", "delete at a full planner");
  const split = [...day.slice(1), line("s0a"), line("s0b")];
  assert.equal(DDinkCheck([day, life], [split, life], { plannerBytes: 2e6 }).stop, "", "the eraser may split a line in two");
  const moved = day.map((s) => ({ ...s, pts: "20,20 4,3 5,-2 6,1" }));
  assert.equal(DDinkCheck([day, life], [moved, life], { plannerBytes: 2e6 }).stop, "", "moving");
});

test("a new drawing stops only when the board is very full or the planner nears the limit", () => {
  const day = many(10), life = many(10, "f", { parent: "sec" });
  const added = [...day, line("new")];
  const ok = DDinkCheck([day, life], [added, life], { adds: true, plannerBytes: 500000 });
  assert.equal(ok.stop, "");
  assert.equal(ok.grows, JSON.stringify(line("new")).length + 1, "it knows how much room the drawing takes");
  assert.equal(DDinkCheck([day, life], [added, life], { adds: true, plannerBytes: DDinkRoomLine - 10 }).stop, "room", "near the 1.5 MB sync limit");
  assert.equal(DDinkCheck([many(3000), life], [[...many(3000), line("new")], life], { adds: true }).stop, "board");
  const feed = many(3000, "f", { parent: "sec" });
  assert.equal(DDinkCheck([day, feed], [day, [...feed, line("new", { parent: "sec" })]], { adds: true }).stop, "feed");
  assert.equal(DDinkCheck([many(2999), life], [[...many(2999), line("new")], life], { adds: true, plannerBytes: 0 }).stop, "", "up to 3000 on a board");
});

test("the words say why, calmly, in both languages", () => {
  assert.match(DDinkStopText("room", "en"), /1\.5 MB sync limit/);
  assert.match(DDinkStopText("room", "fa"), /۱٫۵ مگ/);
  assert.match(DDinkStopText("board", "en"), /^This board holds as many drawings as it can show smoothly/);
  assert.match(DDinkStopText("feed", "en"), /^The Feed/);
  assert.match(DDinkStopText("feed", "fa"), /^فید/);
  for (const why of ["room", "board", "feed"]) assert.doesNotMatch(DDinkStopText(why, "en"), /!|limit reached|error/i);
});
