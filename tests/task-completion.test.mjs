import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDsetTaskDone,
  DDtoggleSubtask,
  DDbuildSearchIndex,
  DDeditSearchResult,
} from "../public/search.js";
const task = () => ({
  id: "task",
  done: false,
  subtasks: [
    {
      id: "branch",
      done: false,
      children: [{ id: "leaf", done: false, children: [] }],
    },
    { id: "sibling", done: true, children: [] },
  ],
});
test("whole-task completion and reopening cascade through all descendants without mutating the source", () => {
  const original = task(),
    done = DDsetTaskDone(original, true),
    open = DDsetTaskDone(done, false);
  assert.equal(done.subtasks[0].children[0].done, true);
  assert.equal(open.subtasks[1].done, false);
  assert.equal(original.done, false);
});
test("the last completed subtask completes its ancestors and reopening it reopens the task", () => {
  const original = task(),
    done = DDtoggleSubtask(original, "leaf"),
    open = DDtoggleSubtask(done, "leaf");
  assert.equal(done.done, true);
  assert.equal(done.subtasks[0].done, true);
  assert.equal(open.done, false);
  assert.equal(open.subtasks[0].done, false);
  assert.equal(open.subtasks[1].done, true);
  assert.equal(original.subtasks[0].children[0].done, false);
});
test("unknown subtasks are no-ops and unrelated pending siblings keep their task open", () => {
  const original = task();
  original.subtasks[1].done = false;
  assert.equal(DDtoggleSubtask(original, "missing"), original);
  assert.equal(DDtoggleSubtask(original, "leaf").done, false);
});
test("search uses the same completion rules as the board and plan", () => {
  const date = "2026-10-22",
    original = {
      setup: {},
      days: { [date]: { blocks: [task()], notes: [], bugs: [] } },
    };
  const row = DDbuildSearchIndex(original, date).find(
    (r) => r.itemId === "leaf",
  );
  const done = DDeditSearchResult(original, row, "done");
  assert.equal(done.days[date].blocks[0].done, true);
  const open = DDeditSearchResult(done, row, "done");
  assert.equal(open.days[date].blocks[0].done, false);
});
