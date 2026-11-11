import { test } from "node:test";
import assert from "node:assert/strict";
import { DDengineColumns, DDengineStepGraph, DDengineSetDependency, DDengineSetFlow, DDengineEditStep, DDengineToggleStep } from "../public/engine-intelligence.js";
import { DDengineCopy, DDengineCopyMany } from "../public/engine.js";
import { DDtoggleSubtask } from "../public/search.js";
import { DDreadSectionShortcuts, DDassignSectionShortcut, DDfindThisApp, DDsectionForShortcut } from "../public/section-shortcuts.js";
import { DDcaptureSummary } from "../public/capture-hub.js";
import { readFileSync } from "node:fs";

const day = () => ({ date: "2026-11-11", blocks: [
  { id: "a", name: "Make", lane: "work", pri: 2, subtasks: [
    { id: "a1", text: "Sketch", done: false, children: [] },
    { id: "a2", text: "Animate", done: false, children: [] },
  ] },
  { id: "b", name: "Ship", lane: "life", pri: 1, subtasks: [{ id: "b1", text: "Export", done: false, children: [] }] },
  { id: "c", name: "Someday", lane: "", pri: 1, subtasks: [] },
] });

test("Today and Park preserve the original lane membership and prioritize open P1", () => {
  const data = day(), before = structuredClone(data);
  const columns = DDengineColumns(data, [{ id: "life" }, { id: "work" }]);
  assert.deepEqual(columns.map((column) => column.id), ["today", "park"]);
  assert.deepEqual(columns[0].blocks.map((block) => block.id), ["b", "a"]);
  assert.deepEqual(columns[1].blocks.map((block) => block.id), ["c"]);
  assert.deepEqual(data, before);
});

test("steps can run in sequence or parallel without drawing positional connectors", () => {
  const original = day(), parallel = DDengineStepGraph(original);
  assert.equal(parallel.status("a2").ready, true);
  const sequential = DDengineSetFlow(original, "a2", "after");
  assert.deepEqual(DDengineStepGraph(sequential).deps.get("a2"), ["a1"]);
  assert.equal(DDengineStepGraph(sequential).status("a2").ready, false);
  assert.notEqual(sequential, original);
  assert.equal(original.blocks[0].subtasks[1].flow, undefined);
  const toggled = DDengineToggleStep(sequential, "a", "a2", DDtoggleSubtask);
  assert.equal(toggled, sequential, "a blocked step cannot be ticked by the Engine");
  const ready = DDengineToggleStep(sequential, "a", "a1", DDtoggleSubtask);
  assert.equal(DDengineStepGraph(ready).status("a2").ready, true);
  assert.equal(DDengineSetFlow(ready, "a2", "parallel").blocks[0].subtasks[1].flow, "parallel");
});

test("cross-task step dependencies are saved in the step, remove safely and reject cycles", () => {
  const original = day(), next = DDengineSetDependency(original, "b1", "a2");
  assert.deepEqual(next.blocks[1].subtasks[0].dependsOn, ["a2"]);
  assert.equal(DDengineStepGraph(next).status("b1").ready, false);
  assert.equal(DDengineSetDependency(next, "a2", "b1"), next, "cycle rejected");
  assert.equal(DDengineSetDependency(next, "b1", "missing"), next);
  assert.equal(DDengineSetDependency(next, "b1", "b1"), next);
  const removed = DDengineSetDependency(next, "b1", "a2", false);
  assert.equal(DDengineStepGraph(removed).status("b1").ready, true);
  assert.deepEqual(original, day());
  assert.equal(DDengineEditStep(removed, "a1", (s) => ({ ...s, text: "Frames" })).blocks[0].subtasks[0].text, "Frames");
});

test("copying earlier tasks remaps own prerequisites, dropping references to missing tasks", () => {
  let n = 0;
  const makeId = () => "id-" + ++n;
  const source = { id: "x", subtasks: [
    { id: "s1", text: "One", done: true },
    { id: "s2", text: "Two", done: true, dependsOn: ["s1", "other-task-step"] },
  ] };
  const copied = DDengineCopy(source, makeId);
  assert.equal(copied.id, "id-1");
  assert.deepEqual(copied.subtasks[1].dependsOn, [copied.subtasks[0].id]);
  assert.equal(copied.subtasks[0].done, false);
  assert.deepEqual(source.subtasks[1].dependsOn, ["s1", "other-task-step"]);
});

test("carrying two related tasks keeps their cross-task prerequisite on the new ids", () => {
  let n = 0;
  const tasks = day().blocks.slice(0, 2);
  tasks[1].subtasks[0].dependsOn = ["a2"];
  const copies = DDengineCopyMany(tasks, () => "copy-" + ++n);
  assert.equal(copies[1].subtasks[0].dependsOn[0], copies[0].subtasks[1].id);
  assert.notEqual(copies[1].subtasks[0].dependsOn[0], "a2");
});

test("T resolves This App; Alt+1–9 assignments are unique and survive corrupt preferences", () => {
  const items = [{ id: "s1", type: "section", text: "This App" }, { id: "s2", type: "section", text: "Work" }];
  assert.equal(DDfindThisApp(items).id, "s1");
  const choices = DDassignSectionShortcut({ "1": "s1", "2": "s2" }, "s2", "1");
  assert.deepEqual(choices, { "1": "s2" });
  assert.equal(DDsectionForShortcut(items, { key: "t", code: "KeyT", altKey: false }, choices).id, "s1");
  assert.equal(DDsectionForShortcut(items, { code: "Digit1", altKey: true }, choices).id, "s2");
  const store = { getItem() { return '{"1":"s1","0":"invalid","2":42}'; } };
  assert.deepEqual(DDreadSectionShortcuts(store), { "1": "s1" });
});

test("Capture's independent inbox shows the same Feed, Later and worry data", () => {
  const setup = { life: { items: [
    { id: "lf-inbox", type: "section", text: "Ideas", parent: "" },
    { id: "idea", type: "sticky", parent: "lf-inbox", text: "Opening concept" },
  ] }, later: [{ id: "a", name: "Call" }], worries: [{ id: "w", text: "Timing", closed: false }] };
  const summary = DDcaptureSummary(setup);
  assert.equal(summary.ideas[0].text, "Opening concept");
  assert.equal(summary.later[0], setup.later[0]);
  assert.equal(summary.worries[0], setup.worries[0]);
});

test("the bundled entry keeps Plan compatibility without leaving it as an independent tab", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /state\.view === "plan"/);
  assert.match(html, /onClick:\(\)=>ddOpenPanel\("engine"\)/);
  assert.match(html, /<script type="module">import/);
});

test("parking remembers the original lane and handles a deleted lane", async () => {
  const { DDengineMoveTask } = await import("../public/engine-intelligence.js");
  const lanes = [{id:"life"}, {id:"work"}], original = day().blocks[0];
  const parked = DDengineMoveTask(original, lanes);
  assert.equal(parked.lane, "");
  assert.deepEqual(DDengineMoveTask(parked, lanes), original);
  assert.equal(DDengineMoveTask(parked, lanes.slice(0, 1)).lane, "life");
});

test("Capture schedules Later once, preserving step progress for both destinations", async () => {
  const { DDscheduleLater } = await import("../public/life.js");
  for (const zone of ["today", "park"]) {
    const task = day().blocks[0];
    task.subtasks[0].done = true;
    const snapshot = {setup:{later:[task],lanes:[{id:"work"}]},days:{}};
    const date = "2026-11-11";
    const next = DDscheduleLater(snapshot, task.id, date, () => ({blocks:[]}), zone);
    assert.equal(next.days[date].blocks[0].lane, zone === "today" ? "work" : "");
    assert.deepEqual(next.days[date].blocks[0].subtasks, task.subtasks);
    assert.equal(next.setup.later.length, 0);
    assert.equal(DDscheduleLater(next, task.id, date, () => ({}), zone), next);
    assert.equal(snapshot.setup.later.length, 1);
  }
});

test("a parent checkbox respects its children's external prerequisites", () => {
  const data = day();
  data.blocks[0].subtasks[0].children.push({ id:"nested", dependsOn:["b1"], children:[] });
  assert.equal(DDengineToggleStep(data, "a", "a1", DDtoggleSubtask), data);
  const ready = DDengineToggleStep(data, "b", "b1", DDtoggleSubtask);
  assert.equal(DDengineToggleStep(ready, "a", "a1", DDtoggleSubtask).blocks[0].subtasks[0].children[0].done, true);
});
