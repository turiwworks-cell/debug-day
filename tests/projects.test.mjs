import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { DDprojectRole, DDprojectChoose, DDprojectOwner, DDprojectRecord, DDprojectCards, DDProjectsPanel } from "../public/projects.js";
import { DDnormalizeLife, DDlifeCleanProjectRefs, DDlifeUpdate } from "../public/life-board.js";
import { DDengineFeedTask, DDengineAddFeedTask, DDengineFeedTaskId } from "../public/engine.js";
import { DDsyncCopies } from "../public/linked.js";
import { DDbuildSearchIndex, DDsetTaskDone } from "../public/search.js";
import { DDboardCore } from "../public/board-core.js";
import { callTool, save, read } from "../src/worker.js";

const date = "2026-11-22";
const section = (id, text, parent = "", extra = {}) =>
  ({ id, type: "section", text, parent, x: 40, y: 40, w: 600, h: 480, color: "#9DD6FF", ...extra });
const note = (id, text, parent, extra = {}) =>
  ({ id, type: "sticky", text, parent, x: 24, y: 80, w: 240, h: 240, color: "#FFE299", ...extra });
const items = () => [
  section("a", "The Way", "", { due: "2026-12-01" }),
  section("job", "Job", "", { due: "2026-12-20" }),
  section("b", "Outreach", "job"),
  section("sub", "Research", "b"),
  section("refs", "References", "b"),
  note("goal", "Read and reflect", "a", { role: "goal" }),
  note("step", "Read some pages", "a"),
  note("goal-b", "Find good teams", "b", { role: "goal" }),
  note("subgoal", "Not the main goal", "sub", { role: "goal" }),
  note("lead", "Review leads\n- [ ] Read their site", "sub"),
  section("old", "projects"),
  section("old2", "Projects"),
];
function marked() {
  let list = items();
  list = DDprojectRole(list, "a", "project");
  list = DDprojectRole(list, "b", "project");
  list = DDprojectRole(list, "sub", "subproject");
  return DDprojectChoose(list, "b", "lead");
}
const setup = (list) => ({ lanes: [{ id: "work" }], life: { v: 2, items: list, links: [{ id: "link", from: "life:goal", to: "life:step" }], frame: {} } });
const taskDay = () => ({ date, blocks: [], bugs: [], notes: [] });
const find = (list, id) => list.find((i) => i.id === id);

test("only the explicitly selected IDs are projects, with their original geometry and hierarchy", () => {
  const original = items(), list = marked();
  assert.equal(DDprojectCards(original).length, 0, "names are not roles");
  assert.deepEqual(list.map(({ projectKind, nextNoteId, ...i }) => i), original);
  assert.deepEqual(DDprojectCards(list).map((c) => c.project.id), ["a", "b"]);
  const card = DDprojectCards(list)[1];
  assert.deepEqual(card.subprojects.map((c) => c.item.id), ["sub"]);
  assert.equal(card.goal.id, "goal-b");
  assert.equal(card.project.due, undefined, "parent deadline is not inherited");
  assert.equal(card.next.id, "lead");
  assert.equal(DDprojectOwner(list, "lead").id, "b");
  assert.equal(DDprojectRole(original, "refs", "subproject"), original);
  const unmarked = DDprojectRole(list, "b", null);
  assert.deepEqual(find(unmarked, "b"), find(original, "b"));
  assert.equal(find(unmarked, "sub").parent, "b");
  assert.deepEqual(DDprojectCards(unmarked).map((c) => c.project.id), ["a"]);
  const unsub = DDprojectRole(list, "sub", null);
  assert.equal(DDprojectCards(unsub)[1].subprojects.length, 0);
  assert.equal(DDprojectCards(unsub)[1].next.id, "lead", "ordinary sections can still contain the next note");
});

test("the selection is a live reference, with invalid references cleared after moving or deleting", () => {
  let list = marked();
  assert.equal(DDprojectChoose(list, "b", "step"), list, "cannot choose a note of another project");
  list = DDlifeUpdate(list, "lead", { text: "New next step" });
  assert.equal(DDprojectCards(list)[1].next.text, "New next step");
  const moved = DDlifeUpdate(list, "lead", { parent: "a" });
  assert.equal(DDprojectCards(moved)[1].next, null);
  assert.equal(find(DDlifeCleanProjectRefs(moved), "b").nextNoteId, undefined);
  const before = { setup: setup(list), days: {} };
  const after = DDsyncCopies({ ...before, setup: setup(moved) }, before);
  assert.equal(find(after.setup.life.items, "b").nextNoteId, undefined, "cleared on save, not just hidden");
  assert.equal(DDprojectCards(DDnormalizeLife({ items: list.filter((i) => i.id !== "lead") }).items)[1].next, null);
  const index = DDbuildSearchIndex({ setup: setup(list), days: {} }, date);
  assert.equal(index.filter((r) => r.id === "life:b").length, 1);
  assert.equal(index.find((r) => r.id === "life:lead").title, "New next step");
});

test("recording uses a real dated note and never changes existing positions, links or dimensions", () => {
  const list = marked(), recorded = DDprojectRecord(list, "b", "  First reply  ", date, "log");
  assert.deepEqual(recorded.slice(0, -1), list);
  assert.equal(recorded.at(-1).parent, "b");
  assert.equal(recorded.at(-1).at, date);
  assert.equal(recorded.at(-1).projectLog, true);
  assert.equal(recorded.at(-1).text, "First reply");
  assert.equal(DDprojectRecord(recorded, "b", "same", date, "log"), recorded, "repeat of the same ID is a no-op");
  const roundTrip = DDnormalizeLife(JSON.parse(JSON.stringify(setup(recorded).life)));
  assert.equal(find(roundTrip.items, "log").projectLog, true);
  assert.deepEqual(roundTrip.links, setup(recorded).life.links);
  const edited = DDlifeUpdate(roundTrip.items, "log", { text: "Reply received and reviewed" });
  const card = DDprojectCards(edited)[1];
  assert.equal(card.lastEntry.at, date);
  assert.deepEqual(card.history, [{ kind: "log", id: "log", text: "Reply received and reviewed", date }]);
  assert.equal(DDprojectCards(list)[1].lastEntry, null, "ordinary note dates are not work history");
});

test("the existing Engine task parser sends the same note only once, and completing it never changes the note", () => {
  const list = marked(), s = setup(list), source = find(list, "lead");
  const task = DDengineFeedTask(source, date, s, () => "step-id", { projectRef: "b" });
  assert.equal(task.id, DDengineFeedTaskId(date, "lead"));
  assert.equal(task.from, "sub");
  assert.equal(task.projectRef, "b");
  assert.equal(task.noteRef, "lead");
  assert.equal(task.subtasks[0].text, "Read their site");
  const day = DDengineAddFeedTask(taskDay(), task);
  const retry = DDengineFeedTask(source, date, s, () => "different-id", { projectRef: "b" });
  assert.equal(DDengineAddFeedTask(day, retry), day);
  const older = { ...task, id: "old-random-id" }; delete older.projectRef;
  const found = DDengineAddFeedTask({ ...day, blocks: [older] }, task);
  assert.deepEqual(found.blocks.map((b) => [b.id,b.projectRef]), [["old-random-id","b"]], "existing task is upgraded, not copied");
  const completed = { ...day, blocks: day.blocks.map((b) => DDsetTaskDone(b, true)) };
  const card = DDprojectCards(list, { [date]: completed })[1];
  assert.equal(card.history[0].kind, "done");
  assert.equal(card.history[0].noteId, "lead");
  assert.equal(card.lastEntry, null, "a completed task is not a dated log note");
  assert.equal(source.text, "Review leads\n- [ ] Read their site");
});

test("explicit project choices are local to an ID, even in linked copies and duplication", () => {
  const pair = [
    section("one", "Folder", "", { syncId: "s-pair" }),
    section("two", "Folder", "", { syncId: "s-pair" }),
    section("first", "A project", "one", { syncKey: "p" }),
    section("second", "A project", "two", { syncKey: "p" }),
    note("n1", "Next", "first", { syncKey: "n" }),
    note("n2", "Next", "second", { syncKey: "n" }),
  ];
  const before = { setup: setup(pair), days: {} };
  let list = DDprojectChoose(DDprojectRole(pair, "first", "project"), "first", "n1");
  list = DDprojectRecord(list, "first", "A log", date, "log");
  const out = DDsyncCopies({ ...before, setup: setup(list) }, before), all = out.setup.life.items;
  assert.equal(find(all, "first").projectKind, "project");
  assert.equal(find(all, "second").projectKind, undefined);
  assert.equal(all.filter((i) => i.projectLog).length, 1);
  const day = { ...taskDay(), __life: setup(list).life, __lifeFrame: { x: 0, y: 0 } };
  const payload = DDboardCore.copy(day, [{ id: "life:first", lifeId: "first", kind: "life-section", x: 24, y: 24 }], [], new Set(["life:first"]), "mindmap");
  let id = 0;
  const pasted = DDboardCore.paste(day, payload, { x: 0, y: 0 }, "mindmap", () => "copy-" + ++id);
  assert.equal(pasted.day.__life.items.filter((i) => i.projectKind === "project").length, 1);
  assert.equal(pasted.day.__life.items.filter((i) => i.projectLog).length, 1);
});

test("sync storage and MCP read the same Feed IDs, task provenance and history", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; }, async run() { return sql.prepare(query).run(...args); }, async all() { return { results: sql.prepare(query).all(...args) }; } }; } } };
  try {
    const list = DDprojectRecord(marked(), "b", "Contact saved", date, "log");
    const s = setup(list), task = DDengineFeedTask(find(list, "lead"), date, s, () => "step-id", { projectRef: "b" });
    await save(env, { setup: s, days: { [date]: DDengineAddFeedTask(taskDay(), task) } }, 0);
    const feed = await callTool("get_life", {}, env, "read");
    assert.equal(find(feed.life.items, "b").nextNoteId, "lead");
    assert.equal(find(feed.life.items, "log").projectLog, true);
    const day = await callTool("get_day", { date }, env, "read");
    assert.equal(day.day.blocks[0].noteRef, "lead");
    assert.equal(day.day.blocks[0].projectRef, "b");
    await callTool("update_life_item", { expected_revision: 1, item_id: "lead", text: "Revised from MCP" }, env, "write");
    const stored = (await read(env)).data;
    assert.equal(DDprojectCards(stored.setup.life.items, stored.days)[1].next.text, "Revised from MCP");
    await callTool("update_life_item", { expected_revision: 2, item_id: "lead", parent: "a" }, env, "write");
    const changed = await callTool("get_life", {}, env, "read");
    assert.equal(find(changed.life.items, "b").nextNoteId, undefined);
    assert.equal(find(changed.life.items, "lead").parent, "a");
  } finally { sql.close(); }
});

test("Projects also renders the Persian interface when given the Persian locale", () => {
  const R = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
    useMemo: (fn) => fn(),
    useState: (initial) => [initial, () => {}],
    useRef: () => ({ current: null }),
  };
  const panel = DDProjectsPanel({ React: R, setup: setup(marked()), days: {}, today: date, language: "fa" });
  assert.equal(panel.props.dir, "rtl");
  const card = panel.children[1].children[1];
  const tree = card.type(card.props);
  const words = JSON.stringify(tree);
  assert.match(words, /Outreach/);
  assert.match(words, /ادامه از اینجا/);
  assert.match(words, /ثبت اتفاق/);
  assert.match(words, /بفرست به امروز/);
  assert.match(words, /"dir":"auto"/);
});
