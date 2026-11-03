import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { DDrailGroups, DDrailConnections, DDsetRailRole, DDrailPreferences } from "../public/rails.js";
import { DDnormalizeLife, DDlifeAdd } from "../public/life-board.js";
import { DDtags } from "../public/planner.js";
import {DDmediaList} from "../public/media.js";
import { DDboardCore as core } from "../public/board-core.js";
import { DatabaseSync } from "node:sqlite";
import { callTool, save, read } from "../src/worker.js";

const items = [
  { id: "a", type: "section", parent: "", text: "Art" },
  { id: "b", type: "section", parent: "a", text: "Sketches" },
  { id: "c", type: "section", parent: "", text: "Elsewhere" },
  ...[["small", "b"], ["other", "c"], ["big", "a"], ["root", ""]].map(([id, parent]) => ({ id, parent, type: "sticky", text: id, role: "goal" })),
  { id: "memo", type: "sticky", parent: "b", text: "Remember", role: "note" },
];
const day = { date: "2026-10-31", blocks: [{ id: "task", name: "Draw", subtasks: [] }], notes: [{ id: "day", kind: "sticky", text: "Main", role: "goal" }], canvas: { board4: { links: [{ id: "cross", from: "b:task", to: "life:small" }] } } };

test("rails follow main board → outer section → inner section, without sibling goals or duplicates", () => {
  const groups = DDrailGroups(day, items, "b");
  assert.deepEqual(groups.goal.map((r) => r.id), ["sticky:day", "life:root", "life:big", "life:small"]);
  assert.deepEqual(groups.note.map((r) => r.id), ["life:memo"]);
  assert.deepEqual(DDrailGroups(day, items, null).goal.map((r) => r.id), ["sticky:day", "life:root"]);
  assert.deepEqual(DDrailGroups(day, items, "a").goal.map((r) => r.id), ["sticky:day", "life:root", "life:big"]);
});

test("connections combine day and shared links, in either direction, without stale or duplicate endpoints", () => {
  const groups = DDrailGroups(day, items, "b", [
    { from: "life:small", to: "life:memo" }, { from: "life:memo", to: "life:small" },
    { from: "life:small", to: "life:missing" }, { from: "life:small", to: "life:small" },
    { from: "life:memo", to: "life:big" },
  ]);
  assert.deepEqual(groups.goal.at(-1).rows.map((r) => r.id), ["b:task", "life:memo"]);
  assert.equal(groups.goal.at(-1).rows[0].blockId, "task");
  assert.deepEqual(DDrailConnections("missing", [], new Map()), []);
  const renamed = structuredClone(day); renamed.blocks[0].name = "Paint";
  assert.equal(DDrailGroups(renamed, items, "b").goal.at(-1).rows[0].title, "Paint");
});

test("connected habits remain reachable when a section hides their board frame", () => {
  const d = structuredClone(day);
  d.canvas.board4.links.push({ id: "habit", from: "sticky:day", to: "habit:draw" });
  const groups = DDrailGroups(d, items, "b", [], [], [{ id: "draw", name: "Drawing" }]);
  assert.deepEqual(groups.goal[0].rows.map((r) => [r.id, r.title]), [["habit:draw", "Drawing"]]);
});

test("roles are exclusive fields on canonical notes, support undo snapshots, and survive normalization and copying", () => {
  const original = { ...day, __life: { items } }, next = DDsetRailRole(original, "life:small", "note");
  assert.equal(original.__life.items.find((i) => i.id === "small").role, "goal");
  assert.equal(next.__life.items.find((i) => i.id === "small").role, "note");
  assert.equal(DDsetRailRole(next, "life:small", null).__life.items.find((i) => i.id === "small").role, undefined);
  const normalized = DDnormalizeLife(next.__life);
  assert.equal(normalized.items.find((i) => i.id === "small").role, "note");
  assert.equal(DDnormalizeLife({ items: [{ id: "bad", type: "sticky", role: "admin" }] }).items[0].role, undefined);
  assert.equal(DDlifeAdd([], { id: "added", type: "sticky", role: "goal" })[0].role, "goal");
  const d = DDsetRailRole(day, "sticky:day", "note"), node = { id: "sticky:day", noteId: "day", kind: "sticky", x: 0, y: 0 };
  const payload = core.copy(d, [node], [], new Set([node.id]));
  assert.equal(core.paste(d, payload, { x: 50, y: 50 }, "mindmap", () => "copy").day.notes.at(-1).role, "note");
});

test("legacy day-note and preference normalizers preserve only supported roles and boolean rail toggles", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8"),
    ve = html.match(/function Ve\(at\).*?(?=var He=)/s)[0],
    prefs = html.match(/function DDprefs\(at\).*?(?=function DDdownload)/s)[0],
    context = { L: (v) => typeof v === "string" ? v : "", C: () => "id", Ie: Number.isFinite, Le: /^#[a-f0-9]{6}$/i, we: ["#FFE299"], DDhabitLevels: (v) => v, DDtags, DDmediaList };
  runInNewContext(ve + prefs + ';this.note=Ve;this.prefs=DDprefs;', context);
  assert.equal(context.note({ role: "goal" }).role, "goal");
  assert.equal(context.note({ kind: "emoji", role: "goal" }).role, undefined);
  assert.equal(context.note({ role: "invalid" }).role, undefined);
  const p = context.prefs({ boardRailGoal: false, boardRailNote: true, boardRailHabits: "true" });
  assert.equal(p.boardRailGoal, false); assert.equal(p.boardRailNote, true);
  assert.equal(p.boardRailHabits, undefined);
  assert.deepEqual(DDrailPreferences({}, true), { goal: false, note: false, habits: false });
  assert.deepEqual(DDrailPreferences({}), { goal: false, note: false, habits: true });
  assert.deepEqual(DDrailPreferences(p), { goal: false, note: true, habits: true });
  assert.equal(Object.values(DDrailPreferences({ boardRailGoal: true, boardRailNote: true, boardRailHabits: true }, true)).filter(Boolean).length, 1);
});

test("MCP writes preserve note roles and unrelated edits do not strip shared goals", async () => {
  const db = new DatabaseSync(":memory:"); db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return db.prepare(query).get(...args) || null; } }; } } };
  try {
    await save(env, { setup: { life: { items }, types: [], lanes: [] }, days: { [day.date]: day } }, 0);
    const added = await callTool("add_note", { date: day.date, expected_revision: 1, text: "A day goal", role: "goal" }, env, "write");
    assert.equal((await read(env)).data.days[day.date].notes.find((n) => n.id === added.id).role, "goal");
    const shared = await callTool("add_life_item", { expected_revision: 2, type: "sticky", parent: "a", text: "Shared goal", role: "goal" }, env, "write");
    assert.equal(shared.item.role, "goal");
    const updated = await callTool("update_life_item", { expected_revision: 3, item_id: shared.item.id, text: "Still a goal" }, env, "write");
    assert.equal(updated.item.role, "goal");
    const cleared = await callTool("update_life_item", { expected_revision: 4, item_id: shared.item.id, role: "" }, env, "write");
    assert.equal(cleared.item.role, undefined);
    await assert.rejects(callTool("update_life_item", { expected_revision: 5, item_id: shared.item.id, role: "invalid" }, env, "write"), /Invalid role/);
  } finally { db.close(); }
});
