import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDengineBus,
  DDengineGroups,
  DDengineTask,
  DDEngineOverlay,
  DDengineTaskFromNote,
  DDengineEarlierDay,
  DDengineCopy,
  DDengineHas,
  DDengineSources,
  DDengineSourceHistory,
  DDengineStrip,
} from "../public/engine.js";
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
  const hooks = { useMemo: fn => fn(), useRef: () => ({ current: null }), useEffect() {}, useState: (v) => [v, () => {}] };
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

test("a note dropped in the Engine becomes one task: first line is the name, the rest are steps", () => {
  let n = 0;
  const makeId = () => "id" + ++n;
  const task = DDengineTaskFromNote("Find reference films\n- Collect three\n2) Pick one\n\n3 colour tests", "work", {}, makeId);
  assert.equal(task.name, "Find reference films");
  assert.equal(task.lane, "work");
  assert.equal(task.id, "id1");
  assert.deepEqual(task.subtasks.map((s) => s.text), ["Collect three", "Pick one", "3 colour tests"], "list marks go, numbers in words stay");
  assert.ok(task.subtasks.every((s) => s.done === false && s.id));
});

test("the earlier Engine is the latest earlier day with tasks, and can step further back", () => {
  const days = {
    "2026-10-20": { blocks: [{ id: "a" }] },
    "2026-10-25": { blocks: [] },
    "2026-10-27": { blocks: [{ id: "b" }] },
    "2026-10-30": { blocks: [{ id: "today" }] },
    "2026-10-31": { blocks: [{ id: "later" }] },
  };
  assert.equal(DDengineEarlierDay(days, "2026-10-30").date, "2026-10-27", "empty days are skipped");
  assert.equal(DDengineEarlierDay(days, "2026-10-30").more, true);
  const back = DDengineEarlierDay(days, "2026-10-30", 1);
  assert.equal(back.date, "2026-10-20");
  assert.equal(back.more, false);
  assert.equal(DDengineEarlierDay(days, "2026-10-30", 9).date, "2026-10-20", "stepping stops at the oldest");
  assert.equal(DDengineEarlierDay(days, "2026-10-20"), null);
});

test("copying an earlier task gives new ids and a fresh start", () => {
  let n = 0;
  const makeId = () => "new" + ++n;
  const old = {
    id: "old",
    name: "Outreach",
    lane: "work",
    done: true,
    measure: "score",
    score: 8,
    bx: 10,
    by: 20,
    at: "09:00",
    subtasks: [{ id: "s", text: "Email", done: true, children: [{ id: "c", text: "Draft", done: true, children: [] }] }],
  };
  const copy = DDengineCopy(old, makeId);
  assert.equal(copy.id, "new1");
  assert.equal(copy.done, false);
  assert.equal(copy.lane, "work");
  assert.equal(copy.measure, "score");
  assert.equal("score" in copy, false);
  assert.equal("bx" in copy || "by" in copy || "at" in copy, false);
  assert.equal(copy.subtasks[0].done, false);
  assert.equal(copy.subtasks[0].children[0].done, false);
  assert.notEqual(copy.subtasks[0].id, "s");
  assert.notEqual(copy.subtasks[0].children[0].id, "c");
  assert.equal(old.done, true, "the earlier day is not touched");
  assert.equal(old.subtasks[0].id, "s");
  assert.equal(DDengineCopy({ id: "x", measure: "count", times: 3, count: 2 }, makeId).count, 0);
});

test("the Engine knows when a task is already in today", () => {
  const day = { blocks: [{ name: "  Outreach " }] };
  assert.equal(DDengineHas(day, { name: "outreach" }), true);
  assert.equal(DDengineHas(day, { name: "Sketch" }), false);
  assert.equal(DDengineHas({}, { name: "x" }), false);
});

// Phase 4: every task remembers the section it came from.
const life = [
  { id: "art", type: "section", parent: "", x: 0, y: 0, text: "Creative life" },
  { id: "sketch", type: "section", parent: "art", x: 400, y: 80, text: "Sketches" },
  { id: "ink", type: "section", parent: "art", x: 40, y: 80, text: "Ink" },
  { id: "home", type: "section", parent: "", x: 0, y: 900, text: "Home" },
  { id: "note", type: "sticky", parent: "art", x: 0, y: 0, text: "idea" },
];

test("a task keeps the section it came from, and only when there is one", () => {
  assert.equal(DDengineTask("Sketch", "work", {}, "a", "sketch").from, "sketch");
  assert.equal("from" in DDengineTask("Sketch", "work", {}, "a"), false, "main board tasks carry no source");
  let n = 0;
  const task = DDengineTaskFromNote("Ink a page\nscan", "life", {}, () => "id" + ++n, "ink");
  assert.equal(task.from, "ink");
  assert.equal(DDengineCopy(task, () => "c").from, "ink", "a copied task still came from the same section");
});

test("the source picker lists sections top down, small ones under their big one", () => {
  assert.deepEqual(
    DDengineSources(life).map((s) => [s.id, s.depth]),
    [["art", 0], ["ink", 1], ["sketch", 1], ["home", 0]],
  );
  assert.deepEqual(DDengineSources([{ id: "lost", type: "section", parent: "gone", x: 0, y: 0, text: "Lost" }]).map((s) => s.id), ["lost"], "a section whose parent is gone still shows");
  assert.deepEqual(DDengineSources([]), []);
});

test("each section's record lists its own tasks and the ones from sections inside it", () => {
  const days = {
    "2026-10-28": { blocks: [{ id: "a", name: "Sketch hands", from: "sketch", done: true }, { id: "b", name: "Dishes", from: "home" }] },
    "2026-10-29": { blocks: [{ id: "c", name: "No source" }] },
    "2026-10-30": { blocks: [{ id: "d", name: "Ink cover", from: "ink" }, { id: "e", name: "Art plan", from: "art", done: true }, { id: "f", name: "Old", from: "deleted" }] },
    "2026-11-02": { blocks: [{ id: "g", name: "Later", from: "art" }] },
  };
  const record = DDengineSourceHistory(days, life, "2026-10-30");
  const art = record.get("art");
  assert.deepEqual(art.map((e) => [e.date, e.done, e.total]), [["2026-10-30", 1, 2], ["2026-10-28", 1, 1]], "newest first, rolled up, future days left out");
  assert.deepEqual(art[0].tasks.map((t) => [t.name, t.from]), [["Ink cover", "ink"], ["Art plan", "art"]]);
  assert.deepEqual(record.get("sketch").map((e) => e.date), ["2026-10-28"]);
  assert.equal(record.get("ink")[0].tasks[0].done, false);
  assert.deepEqual(record.get("home").map((e) => [e.done, e.total]), [[0, 1]]);
  assert.equal(record.has("deleted"), false, "a deleted section's tasks are not counted");
  assert.equal(record.has("note"), false);
});

test("the 14-day strip marks each day as none, done, some or open", () => {
  const strip = DDengineStrip(
    [
      { date: "2026-10-30", done: 1, total: 2 },
      { date: "2026-10-29", done: 0, total: 1 },
      { date: "2026-10-28", done: 3, total: 3 },
      { date: "2026-10-01", done: 1, total: 1 },
    ],
    "2026-10-30",
    14,
  );
  assert.equal(strip.length, 14);
  assert.equal(strip[0].date, "2026-10-17");
  assert.equal(strip.at(-1).date, "2026-10-30");
  assert.deepEqual(strip.slice(-3).map((d) => d.state), ["done", "open", "some"]);
  assert.equal(strip.filter((d) => d.state === "none").length, 11, "days outside the window are left out");
  assert.deepEqual(DDengineStrip([], "2026-03-01", 3).map((d) => d.date), ["2026-02-27", "2026-02-28", "2026-03-01"], "counts back across months");
});

test("an Engine row shows where the task came from and can change it", () => {
  const hooks = { useMemo: fn => fn(), useRef: () => ({ current: null }), useEffect() {}, useState: (v) => [v, () => {}] };
  let changed;
  const overlay = DDEngineOverlay({
    React: { ...R, ...hooks },
    day: { date: "2026-10-30", blocks: [{ id: "a", name: "Ink", lane: "work", from: "ink" }] },
    setup: { lanes },
    sources: DDengineSources(life),
    language: "en",
    measure: { DDmeasureOf, DDmeasureText, DDMeasureControl, DDsetMeasure },
    setDone: (b, done) => ({ ...b, done }),
    onChange: (fn) => (changed = fn),
    onAdd() {},
    onClose() {},
  });
  const rowNode = find(overlay, (n) => typeof n.type === "function" && n.props.block?.id === "a")[0];
  const row = rowNode.type({ ...rowNode.props, React: { ...R, ...hooks } });
  const picker = find(row, (n) => n.props.className?.split(" ").includes("dd-engine-from"))[0];
  assert.equal(picker.props.value, "ink");
  assert.deepEqual(find(picker, (n) => n.type === "option").map((o) => o.children.join("")), ["↖ Main board", "↖ Creative life", "↖ Creative life › Ink", "↖ Creative life › Sketches", "↖ Home"], "every option shows the whole path");
  assert.equal(picker.props.style.background, DDengineSources(life).find((s) => s.id === "ink").tint.fill, "the picker wears its root's tint");
  const day = { blocks: [{ id: "a", from: "ink" }, { id: "b", from: "ink" }] };
  picker.props.onChange({ target: { value: "sketch" } });
  assert.deepEqual(changed(day).blocks.map((b) => b.from), ["sketch", "ink"], "only this task changes");
  picker.props.onChange({ target: { value: "" } });
  assert.equal("from" in changed(day).blocks[0], false, "back to the main board drops the source");
});
