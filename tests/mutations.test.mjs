import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { DDcaptureItem, DDconvertWorry } from "../public/capture.js";
import { DDbuildSearchIndex, DDeditSearchResult } from "../public/search.js";
import { callTool, save, read } from "../src/worker.js";

const date = "2026-10-22";
const ensureDay = (date) => ({ date, blocks: [], bugs: [], notes: [] });
function fixture() {
  const block = {
    id: "task",
    name: "Draft",
    min: 30,
    type: "work",
    lane: "work",
    done: true,
    subtasks: [
      {
        id: "parent",
        text: "Outline",
        done: true,
        children: [{ id: "child", text: "Heading", done: true, children: [] }],
      },
    ],
  };
  return {
    setup: {
      types: [{ id: "work" }],
      lanes: [{ id: "work" }],
      later: [structuredClone(block)],
      worries: [
        { id: "worry", text: "Invoice", closed: false, convertedTo: "" },
      ],
    },
    days: {
      [date]: {
        ...ensureDay(date),
        blocks: [block],
        canvas: {
          board4: {
            hidden: ["b:task", "sub:task:child", "sticky:keep"],
            locked: ["b:task"],
            links: [],
            layouts: {},
            groups: {},
          },
        },
      },
    },
  };
}
async function withCloud(run) {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = {
    DB: {
      prepare(query) {
        let args = [];
        return {
          bind(...values) {
            args = values;
            return this;
          },
          async first() {
            return sql.prepare(query).get(...args) || null;
          },
        };
      },
    },
  };
  try {
    await save(env, fixture(), 0);
    await run(env);
  } finally {
    sql.close();
  }
}

test("capture and worry conversion reject impossible dates without consuming the worry", () => {
  const data = fixture();
  assert.equal(
    DDcaptureItem(
      data,
      { kind: "worry", text: "Invoice", date: "later" },
      ensureDay,
    ),
    data,
  );
  for (const invalid of ["2026-02-30", "1899-12-31", "later-wrong"]) {
    assert.equal(
      DDcaptureItem(
        data,
        { kind: "feeling", text: "Tired", date: invalid },
        ensureDay,
      ),
      data,
    );
    assert.equal(DDconvertWorry(data, "worry", invalid, ensureDay), data);
  }
});
test("search rejects invalid moves and nonnumeric Later durations without changing the source", () => {
  const data = fixture(),
    rows = DDbuildSearchIndex(data, date);
  for (const kind of ["block", "later"]) {
    const row = rows.find((row) => row.kind === kind);
    assert.equal(
      DDeditSearchResult(data, row, "move", "2026-02-30", ensureDay),
      data,
    );
  }
  assert.equal(
    DDeditSearchResult(
      data,
      rows.find((row) => row.kind === "later"),
      "duration",
      "oops",
      ensureDay,
    ),
    data,
  );
});
test("reopening a nested subtask reopens its ancestors while preserving completed siblings", () => {
  const data = fixture();
  data.days[date].blocks[0].subtasks.push({
    id: "sibling",
    text: "Done separately",
    done: true,
    children: [],
  });
  const row = DDbuildSearchIndex(data, date).find(
    (row) => row.kind === "subtask" && row.itemId === "child",
  );
  const next = DDeditSearchResult(data, row, "done", undefined, ensureDay);
  const block = next.days[date].blocks[0];
  assert.equal(block.done, false);
  assert.equal(block.subtasks[0].done, false);
  assert.equal(block.subtasks[0].children[0].done, false);
  assert.equal(block.subtasks[1].done, true);
  assert.equal(data.days[date].blocks[0].done, true);
});
test("MCP rejects an empty category and normalizes an edited task name", () =>
  withCloud(async (env) => {
    await assert.rejects(
      callTool(
        "update_block",
        { date, expected_revision: 1, block_id: "task", type_id: "" },
        env,
        "write",
      ),
      /type_id/,
    );
    await callTool(
      "update_block",
      { date, expected_revision: 1, block_id: "task", name: "  Clean name  " },
      env,
      "write",
    );
    assert.equal(
      (await read(env)).data.days[date].blocks[0].name,
      "Clean name",
    );
  }));
test("repeated MCP task and worry edits do not consume a new revision", () =>
  withCloud(async (env) => {
    for (const [name, args] of [
      ["update_block", { date, block_id: "task", name: "Draft" }],
      ["update_worry", { worry_id: "worry", closed: false }],
    ]) {
      const result = await callTool(
        name,
        { ...args, expected_revision: 1 },
        env,
        "write",
      );
      assert.equal(result.changed, false);
      assert.equal(result.revision, 1);
    }
    assert.equal((await read(env)).revision, 1);
  }));
test("MCP completion updates nested subtasks together with the parent", () =>
  withCloud(async (env) => {
    await callTool(
      "update_block",
      { date, expected_revision: 1, block_id: "task", done: false },
      env,
      "write",
    );
    const block = (await read(env)).data.days[date].blocks[0];
    assert.equal(block.done, false);
    assert.equal(block.subtasks[0].children[0].done, false);
  }));
test("MCP deletion removes hidden references for the task and all its descendants", () =>
  withCloud(async (env) => {
    await callTool(
      "delete_block",
      { date, expected_revision: 1, block_id: "task", confirm: true },
      env,
      "write",
    );
    assert.deepEqual((await read(env)).data.days[date].canvas.board4.hidden, [
      "sticky:keep",
    ]);
  }));
