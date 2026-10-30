import { test } from "node:test";
import assert from "node:assert/strict";
import { DDengineBus, DDengineGroups, DDengineTask, DDEngineOverlay } from "../public/engine.js";
import {
  DDmeasures,
  DDmeasureOf,
  DDplanMinutes,
  DDscoreOf,
  DDsetScore,
  DDsetMeasure,
  DDmeasureText,
  DDMeasureControl,
  DDMeasurePicker,
} from "../public/measure.js";

const lanes = [
  { id: "work", name: "Work" },
  { id: "life", name: "Life" },
];

test("the Engine groups today's tasks by their one lane, parked last", () => {
  const day = {
    blocks: [
      { id: "a", lane: "life" },
      { id: "b", lane: "work" },
      { id: "c", lane: "gone" },
      { id: "d", lane: "" },
    ],
  };
  const groups = DDengineGroups(day, lanes);
  assert.deepEqual(groups.map((g) => g.lane.id), ["work", "life", ""]);
  assert.deepEqual(groups.map((g) => g.blocks.map((b) => b.id)), [["b"], ["a"], ["c", "d"]]);
  assert.equal(groups[2].lane.parked, true);
  assert.deepEqual(DDengineGroups({ blocks: [] }, lanes).map((g) => g.blocks.length), [0, 0], "empty lanes still show");
});

test("a new Engine task has one lane and the usual defaults", () => {
  const task = DDengineTask("  Sketch frames  ", "life", { types: [{ id: "art" }], preferences: { defaultMinutes: 45 } }, "id1");
  assert.deepEqual(task, {
    id: "id1",
    name: "Sketch frames",
    type: "art",
    lane: "life",
    min: 45,
    note: "",
    pri: 0,
    emo: "",
    done: false,
    expanded: true,
    subtasks: [],
  });
});

test("the bus keeps a request until a Board takes it", () => {
  DDengineBus.take();
  DDengineBus.request();
  assert.equal(DDengineBus.take(), true);
  assert.equal(DDengineBus.take(), false);
  let heard = 0;
  const off = DDengineBus.on(() => heard++);
  DDengineBus.request();
  off();
  DDengineBus.request();
  assert.equal(heard, 1);
  DDengineBus.take();
});

test("three task kinds: tick, score and waiting; old counted cards still read", () => {
  assert.deepEqual(DDmeasures, ["time", "score", "wait"]);
  assert.equal(DDmeasureOf({ measure: "score" }), "score");
  assert.equal(DDmeasureOf({ measure: "count" }), "count");
  assert.equal(DDplanMinutes({ measure: "score", min: 60 }), 0);
  assert.equal(DDplanMinutes({ min: 60 }), 60);
});

test("a scored task is done once it has a score, and 0 clears it", () => {
  const task = DDsetMeasure({ id: "a", name: "Color study", done: false }, "score");
  assert.equal(task.measure, "score");
  assert.equal(DDscoreOf(task), 0);
  const scored = DDsetScore(task, 7);
  assert.equal(scored.score, 7);
  assert.equal(scored.done, true);
  assert.equal(DDscoreOf(DDsetScore(task, 42)), 10, "scores stop at 10");
  const cleared = DDsetScore(scored, 0);
  assert.equal(cleared.done, false);
  assert.ok(!("score" in cleared));
  assert.equal(DDmeasureText(scored, "en"), "Score 7/10");
  assert.equal(DDmeasureText(task, "fa"), "بدون نمره");
});

const R = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }) };
const find = (node, match, out = []) => {
  if (node && typeof node === "object") {
    if (match(node)) out.push(node);
    for (const child of node.children || []) find(child, match, out);
  }
  return out;
};

test("score dots set the score and tapping the same dot clears it", () => {
  const block = { id: "a", name: "Study", measure: "score", score: 3 };
  let change;
  const control = DDMeasureControl({ React: R, block, language: "en", onChange: (fn) => (change = fn) });
  const dots = find(control, (n) => n.type === "button");
  assert.equal(dots.length, 10);
  assert.deepEqual(dots.map((d) => d.props["data-on"]).slice(0, 4), [true, true, true, false]);
  dots[5].props.onClick();
  assert.equal(change(block).score, 6);
  dots[2].props.onClick();
  assert.equal(change(block).done, false, "tapping the current score clears it");
});

test("the kind picker offers tick, score and waiting, and keeps an old counted card's choice", () => {
  const kinds = (block) =>
    find(DDMeasurePicker({ React: R, block, language: "fa", onChange() {} }), (n) => n.type === "button").map((b) => b.props["data-measure"]);
  assert.deepEqual(kinds({}), ["time", "score", "wait"]);
  assert.deepEqual(kinds({ measure: "count" }), ["time", "score", "wait", "count"]);
});

test("the overlay is a labelled dialog that closes on E or Escape but not while typing", () => {
  const hooks = { useRef: () => ({ current: null }), useEffect() {}, useState: (v) => [v, () => {}] };
  let closed = 0;
  const overlay = DDEngineOverlay({
    React: { ...R, ...hooks },
    day: { date: "2026-10-30", blocks: [{ id: "a", name: "Ink", lane: "work", done: true }] },
    setup: { lanes },
    language: "fa",
    measure: { DDmeasureOf, DDmeasureText, DDMeasureControl, DDsetMeasure },
    setDone: (b, done) => ({ ...b, done }),
    onChange() {},
    onAdd() {},
    onClose: () => closed++,
  });
  const dialog = find(overlay, (n) => n.props.role === "dialog")[0];
  assert.equal(dialog.props["aria-label"], "انجین");
  const key = (key, target = { closest: () => null }) =>
    overlay.props.onKeyDown({ key, code: "", target, preventDefault() {}, stopPropagation() {} });
  key("e");
  key("Escape");
  key("e", { closest: () => ({}) });
  assert.equal(closed, 2);
});
