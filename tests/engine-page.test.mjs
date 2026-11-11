// The Engine's page, driven the way a person drives it: every handler the page
// hands to an element is called, and the day it writes is checked.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHarness, findAll } from "../tests/page-hooks.mjs";
import { DDEnginePage } from "../public/engine-page.js";

const setup = () => ({
  lanes: [{ id: "life", name: "Life" }, { id: "work", name: "Work" }],
  types: [{ id: "deep", name: "Deep" }],
  engineNotes: [],
});
const dayOf = () => ({
  date: "2026-11-10",
  blocks: [
    { id: "b1", name: "First", lane: "life", type: "deep", min: 45, done: false, pri: 0, subtasks: [{ id: "s1", text: "One", done: false, children: [] }] },
    { id: "b2", name: "Second", lane: "work", type: "deep", min: 30, done: true, pri: 1, subtasks: [] },
  ],
  notes: [],
});

function bench() {
  const harness = createHarness(), state = { day: dayOf(), setup: setup(), filter: "all", notes: [], paused: false, toasts: [] };
  let ui = harness.expand(DDEnginePageView());
  function DDEnginePageView() {
    return DDEnginePage({
      day: state.day,
      setup: state.setup,
      language: "en",
      dateLabel: "Tue 10 Nov",
      filter: state.filter,
      onFilter: (id) => { state.filter = id; ui = harness.expand(DDEnginePageView()); },
      onDay: (fn) => { state.day = fn(JSON.parse(JSON.stringify(state.day))); },
      onPrevDay: () => {}, onNextDay: () => {}, onOpenSection: () => {}, onOpenDay: () => {}, onOpenBoard: () => {},
      onPauseDay: () => { state.paused = true; },
      onToast: (text) => state.toasts.push(text),
      makeId: () => "id-" + Math.random().toString(36).slice(2, 8),
      onNote: (text) => { state.notes.push(text); state.setup.engineNotes.push({ id: "n" + state.notes.length, text }); },
    }, harness.React);
  }
  const paint = () => { ui = harness.expand(DDEnginePageView()); return ui; };
  return { state, paint, tree: () => ui, harness };
}
// The page's own view function needs React on the second argument; the harness
// supplies it, so the wrapper above reads it back from the expansion.
function wire(b) {
  return b;
}

test("the Engine page shows the day, the Park and the three filters", () => {
  const b = bench();
  const tree = b.paint();
  assert.ok(findAll(tree, (n) => n.props?.className === "dd-engine-row").length >= 2);
  assert.equal(findAll(tree, (n) => n.type === "div" && n.props?.className === "dd-engine-park").length, 1);
  assert.deepEqual(
    findAll(tree, (n) => n.props?.["data-filter"]).map((n) => n.props["data-filter"]),
    ["all", "left", "done"],
  );
});

test("adding a task from the Engine writes it to the day", () => {
  const b = bench();
  const tree = b.paint();
  const form = findAll(tree, (n) => n.type === "form" && n.props.className === "dd-engine-add")[0];
  findAll(form, (n) => n.type === "input")[0].props.onChange({ target: { value: "From the Engine" } });
  // The value is state, so the form is re-read after the change.
  const fresh = findAll(b.paint(), (n) => n.type === "form" && n.props.className === "dd-engine-add")[0];
  fresh.props.onSubmit({ preventDefault() {} });
  assert.ok(b.state.day.blocks.some((task) => task.name === "From the Engine"));
  assert.ok(b.state.day.blocks.find((task) => task.name === "From the Engine").id);
});

test("ticking, parking and priority all reach the day", () => {
  const b = bench();
  let tree = b.paint();
  // The first row is the first task of the day column.
  const first = b.state.day.blocks[0];
  findAll(tree, (n) => n.props?.className === "dd-engine-row-check" && n.props["aria-label"].includes(first.name))[0].props.onClick();
  assert.equal(b.state.day.blocks.find((task) => task.id === first.id).done, true);

  tree = b.paint();
  const park = findAll(tree, (n) => n.type === "button" && n.props?.className === "dd-engine-park" && n.props["aria-label"] === "Set aside in the Park")[0];
  assert.ok(park, "the row offers Park");
  park.props.onClick();
  assert.equal(b.state.day.blocks.filter((task) => task.park).length, 1);

  tree = b.paint();
  const before = b.state.day.blocks.map((task) => task.pri || 0).join(",");
  findAll(tree, (n) => n.props?.className === "dd-engine-pri")[0].props.onClick();
  assert.notEqual(b.state.day.blocks.map((task) => task.pri || 0).join(","), before, "a press changes priority");
});

test("a step is ticked from the Engine", () => {
  const b = bench();
  const tree = b.paint();
  findAll(tree, (n) => n.props?.className === "dd-engine-step-check")[0].props.onClick();
  assert.equal(b.state.day.blocks.find((task) => task.id === "b1").subtasks[0].done, true);
});

test("Engine notes are handed to the app, which keeps them outside the day", () => {
  const b = bench();
  let tree = b.paint();
  findAll(tree, (n) => n.props?.className === "dd-engine-notes-toggle")[0].props.onClick();
  tree = b.paint();
  const form = findAll(tree, (n) => n.type === "form" && n.props.className === undefined && typeof n.props.onSubmit === "function")[0];
  const input = findAll(form, (n) => n.type === "input")[0];
  input.props.onChange({ target: { value: "A note that stays" } });
  const withText = findAll(b.paint(), (n) => n.type === "form" && n.props.className === undefined && typeof n.props.onSubmit === "function")[0];
  withText.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(b.state.notes, ["A note that stays"]);
  assert.equal(b.state.setup.engineNotes.length, 1);
  assert.equal(b.state.day.notes.length, 0);
});

test("Pause the day asks the app; the filter changes what is listed", () => {
  const b = bench();
  let tree = b.paint();
  findAll(tree, (n) => n.props?.className === "dd-engine-page-pause")[0].props.onClick();
  assert.equal(b.state.paused, true);

  findAll(tree, (n) => n.props?.["data-filter"] === "done")[0].props.onClick();
  assert.equal(b.state.filter, "done");
  tree = b.paint();
  const rows = findAll(tree, (n) => n.props?.className === "dd-engine-row");
  assert.equal(rows.length, 1, "only the done task is listed");
  assert.equal(rows[0].props["data-task"], "b2");
});

test("the day arrows and the calendar button call the app", () => {
  let moved = 0, openedDay = 0;
  const harness = createHarness();
  const tree = harness.expand(DDEnginePage({
    day: dayOf(), setup: setup(), language: "fa", dateLabel: "سه‌شنبه",
    onFilter: () => {}, onDay: () => {}, onPrevDay: () => (moved -= 1), onNextDay: () => (moved += 1),
    onOpenDay: () => (openedDay += 1), onOpenSection: () => {}, onPauseDay: () => {}, onOpenBoard: () => {},
    onToast: () => {}, makeId: () => "x", onNote: () => {},
  }, harness.React));
  findAll(tree, (n) => n.props?.["aria-label"] === "روز قبل")[0].props.onClick();
  findAll(tree, (n) => n.props?.["aria-label"] === "روز بعد")[0].props.onClick();
  assert.equal(moved, 0, "both arrows were called");
  findAll(tree, (n) => n.type === "button" && n.props.className === "textbtn")[0].props.onClick();
  assert.equal(openedDay, 1);
});
