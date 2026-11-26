import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";
import { DDshapeKind } from "../public/shapes.js";
import { DDlifeState } from "../public/life-board.js";

const day = "2026-11-20", tomorrow = "2026-11-21";
async function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { SYNC_TOKEN: "s".repeat(64), MCP_WRITE_TOKEN: "w".repeat(64), MCP_READ_TOKEN: "r".repeat(64), DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; }, async run() { sql.prepare(query).run(...args); return { success: true }; } }; } } };
  const make = date => ({ date, blocks: [], bugs: [], notes: [], canvas: null });
  const data = { setup: { types: [{ id: "work", name: "Work" }], lanes: [{ id: "work", name: "Work" }], templates: [{ id: "default", name: "Default", blocks: [], days: [] }], defaultTpl: "default", life: { v: 2, items: [{ id: "collection", type: "section", parent: "", x: 0, y: 0, w: 1800, h: 1200, text: "Collection" }, { id: "old", type: "sticky", parent: "collection", x: 1800, y: 50, text: "Keep me", w: 240, h: 240 }], links: [], frame: {} }, preferences: {}, later: [] }, days: { [day]: make(day), [tomorrow]: make(tomorrow) } };
  const auth = { Authorization: "Bearer " + env.SYNC_TOKEN, "Content-Type": "application/json" };
  assert.equal((await worker.fetch(new Request("http://localhost/api/sync", { method: "PUT", headers: { ...auth, "If-Match": "0" }, body: JSON.stringify({ data }) }), env)).status, 200);
  const rpc = async (method, params = {}, token = env.MCP_WRITE_TOKEN) => (await (await worker.fetch(new Request("http://localhost/mcp", { method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }), env)).json()).result;
  const call = (name, args, token) => rpc("tools/call", { name, arguments: args }, token);
  const ok = async (name, args, token) => { const r = await call(name, args, token); assert.equal(r.isError, false, name + ": " + JSON.stringify(r)); return r.structuredContent; };
  const bad = async (name, args, token) => { const r = await call(name, args, token); assert.equal(r.isError, true, name + ": " + JSON.stringify(r)); return r.content[0].text; };
  const read = () => ok("get_setup", {});
  let rev = (await read()).revision;
  const write = async (name, args) => { const r = await ok(name, { expected_revision: rev, ...args }); rev = r.revision; return r; };
  return { sql, env, rpc, ok, bad, write, read, rev: () => rev };
}

test("MCP board access: real nested diagram, native shapes and connected data", async () => {
  const f = await fixture();
  try {
    const readTools = (await f.rpc("tools/list", {}, f.env.MCP_READ_TOKEN)).tools;
    const writeTools = (await f.rpc("tools/list")).tools;
    assert.ok(readTools.some(t => t.name === "get_section"));
    assert.ok(!readTools.some(t => t.name === "create_section_diagram"));
    assert.ok(writeTools.some(t => t.name === "create_section_diagram" && !t.annotations.readOnlyHint && !t.annotations.idempotentHint));
    const list = await f.ok("list_sections", { query: "collection" }, f.env.MCP_READ_TOKEN);
    assert.equal(list.sections[0].id, "collection");
    const initial = await f.ok("get_section", { section_id: "collection" });
    const nodes = [
      { key: "map", type: "section", text: "Week 1", x: 100, y: 100, w: 1300, h: 900 },
      { key: "design", parent_key: "map", type: "sticky", shape: "rounded", text: "Design", x: 40, y: 80, w: 230, h: 80, color: "#D3BDFF", text_size: 18, text_align: "center" },
      { key: "goal", parent_key: "map", type: "sticky", shape: "rectangle", text: "Communication", x: 400, y: 80, w: 240, h: 100, fill_mode: "none", stroke: "#874FFF" },
    ];
    const request = { section_id: "collection", nodes, connections: [{ from: "design", to: "goal", style: "elbow", arrow: true, dashed: false }] };
    await f.bad("create_section_diagram", { expected_revision: f.rev(), ...request }, f.env.MCP_READ_TOKEN);
    await f.bad("create_section_diagram", { expected_revision: f.rev() - 1, ...request });
    await f.bad("create_section_diagram", { expected_revision: f.rev(), ...request, connections: [{ from: "design", to: "missing" }] });
    await f.bad("create_section_diagram", { expected_revision: f.rev(), ...request, nodes: [{ ...nodes[0], invalid: "field" }] });
    assert.deepEqual(await f.ok("get_section", { section_id: "collection" }), initial, "failed batches change nothing");
    const created = await f.write("create_section_diagram", request);
    let sect = await f.ok("get_section", { section_id: "collection" });
    const map = sect.items.find(i => i.id === created.nodes.map), design = sect.items.find(i => i.id === created.nodes.design), goal = sect.items.find(i => i.id === created.nodes.goal);
    assert.equal(map.parent, "collection"); assert.equal(design.parent, map.id); assert.equal(goal.parent, map.id);
    assert.equal(design.w, 230); assert.equal(design.h, 80); assert.equal(design.style.shape, "rounded"); assert.ok(DDshapeKind(design.style.shape));
    assert.equal(goal.style.fillMode, "none"); assert.equal(goal.style.stroke, "#874FFF");
    assert.equal(sect.links[0].from, "life:" + design.id); assert.equal(sect.links[0].to, "life:" + goal.id);
    assert.deepEqual(sect.items.find(i => i.id === "old"), initial.items.find(i => i.id === "old"));
    assert.equal(DDlifeState((await f.read()).setup).items.find(i => i.id === design.id).style.shape, "rounded");
    await f.write("update_board_item", { feed: true, item_id: design.id, shape: "pill", color: "#FFFFFF", stroke_style: "dashed", w: 300 });
    await f.write("update_connection", { feed: true, connection_id: created.connections[0], label: "goal", color: "#123456", dashed: true });
    await f.bad("update_board_item", { expected_revision: f.rev(), feed: true, item_id: map.id, parent: map.id });
    sect = await f.ok("get_section", { section_id: "collection" });
    assert.equal(sect.items.find(i => i.id === design.id).style.shape, "pill");
    assert.equal(sect.links[0].label, "goal"); assert.equal(sect.links[0].pattern, "dashed");
    await f.bad("delete_connection", { expected_revision: f.rev(), feed: true, connection_id: created.connections[0] });
    await f.write("delete_connection", { feed: true, connection_id: created.connections[0], confirm: true });
    assert.equal((await f.ok("get_section", { section_id: "collection" })).items.length, initial.items.length + nodes.length);
    const ink = await f.write("add_drawing", { feed: true, parent: map.id, points: [{ x: 10, y: 40 }, { x: 400, y: 80 }], color: "#FF0000", width: 4 });
    assert.equal((await f.ok("get_section", { section_id: map.id })).strokes[0].id, ink.id);
    await f.write("delete_drawing", { feed: true, drawing_id: ink.id, confirm: true });
    const daily = await f.write("add_board_item", { date: day, type: "sticky", shape: "diamond", text: "Design", x: 200, y: 100, w: 300, h: 100 });
    const dailyBoard = await f.ok("get_board", { date: day });
    assert.equal(dailyBoard.day.canvas.board4.styles[daily.ref].shape, "diamond");
    await f.write("link_notes", { source: { kind: "life", id: design.id }, copies: [{ kind: "day", date: day, id: daily.id }] });
    const linked = (await f.ok("get_day", { date: day })).day.notes.find(n => n.id === daily.id);
    assert.ok(linked.syncId);
    await f.write("update_board_item", { feed: true, item_id: design.id, text: "Design — solving a problem" });
    assert.equal((await f.ok("get_day", { date: day })).day.notes.find(n => n.id === daily.id).text, "Design — solving a problem");
    const found = await f.ok("search_workspace", { query: "Communication" });
    assert.ok(found.results.some(x => x.itemId === goal.id));
  } finally { f.sql.close(); }
});

test("placing day notes inside a shared section keeps their positions and links across dates", async () => {
  const f = await fixture();
  try {
    const text = "Reference ".repeat(450);
    const created = await f.write("add_note", { date: day, text, x: 2450, y: 210 });
    assert.equal(created.ref, "life:" + created.id);
    const loose = await f.write("add_board_item", { date: day, type: "sticky", text: "Sketch", x: 80, y: 30, w: 300, h: 180, text_color: "#123456" });
    assert.equal(loose.ref, "sticky:" + loose.id);
    const wire = await f.write("add_connection", { date: day, from: loose.ref, to: created.ref });
    const moved = await f.write("set_board_card", { date: day, card_ref: loose.ref, x: 2700, y: 470 });
    assert.equal(moved.ref, "life:" + loose.id);
    const second = await f.write("add_board_item", { date: tomorrow, type: "sticky", x: 2600, y: 300 });
    const daily = await f.write("add_note", { date: tomorrow, text: "Day only" });
    const edited = await f.write("update_note", { date: tomorrow, note_id: daily.id, x: 2660, y: 420 });
    assert.equal(edited.ref, "life:" + daily.id);
    const shared = await f.ok("get_section", { section_id: "collection" });
    assert.equal(shared.items.find(n => n.id === created.id).text, text);
    for (const id of [created.id, loose.id, second.id, daily.id]) assert.equal(shared.items.filter(n => n.id === id).length, 1);
    const item = shared.items.find(n => n.id === loose.id);
    assert.deepEqual([item.x, item.y, item.w, item.h, item.style.textColor], [300, 300, 300, 180, "#123456"]);
    assert.ok(shared.links.some(l => l.id === wire.id && l.from === moved.ref && l.to === created.ref));
    for (const date of [day, tomorrow]) assert.equal((await f.ok("get_day", { date })).day.notes.length, 0);
  } finally { f.sql.close(); }
});

test("MCP Planner access: task tree, orders, measures, templates, routine and settings", async () => {
  const f = await fixture();
  try {
    const a = await f.write("add_block", { date: day, name: "Sketch" });
    const b = await f.write("add_block", { date: day, name: "Ink" });
    const s = await f.write("add_step", { date: day, block_id: a.id, text: "Brainstorm", minutes: 20 });
    const child = await f.write("add_step", { date: day, block_id: a.id, parent_step_id: s.id, text: "Thumbnail" });
    await f.write("update_step", { date: day, block_id: a.id, step_id: child.id, done: true });
    let data = (await f.ok("get_day", { date: day })).day;
    assert.equal(data.blocks[0].done, true); assert.equal(data.blocks[0].subtasks[0].done, true);
    await f.write("set_task_order", { date: day, task_ref: "b:" + b.id, after: ["b:" + a.id] });
    await f.bad("set_task_order", { date: day, expected_revision: f.rev(), task_ref: "b:" + a.id, after: ["b:" + b.id] });
    await f.write("edit_task_details", { date: day, block_id: b.id, measure: "score", score: 8, section_id: "collection", energy: "light" });
    data = (await f.ok("get_day", { date: day })).day;
    assert.equal(data.blocks[1].score, 8); assert.equal(data.blocks[1].done, true); assert.equal(data.blocks[1].from, "collection");
    await f.write("set_board_card", { date: day, card_ref: "b:" + a.id, x: 350, y: 100, w: 240, color: "#D3BDFF" });
    await f.write("set_task_repeat", { date: day, block_id: b.id, repeat: true });
    assert.ok((await f.read()).setup.templates[0].blocks.some(t => t.name === "Ink"));
    await f.write("set_daily_routine", { leftovers: "park" });
    await f.write("set_planner_preferences", { default_minutes: 30, reduced_motion: true });
    await f.write("set_planner_look", { theme: "dark", density: "compact" });
    await f.write("set_week_focus", { week_start: "2026-11-16", focus: "Experiment" });
    await f.write("set_day_journal", { date: day, journal: "Progress log" });
    const feeling = await f.write("add_feeling", { date: day, text: "A quiet morning", category: "inner", block_id: a.id });
    await f.write("update_feeling", { date: day, feeling_id: feeling.id, fixed: true });
    await f.write("log_focus_time", { date: day, block_id: a.id, seconds: 1200 });
    await f.write("move_step", { date: day, block_id: a.id, step_id: s.id, target_block_id: b.id });
    data = (await f.ok("get_day", { date: day })).day;
    assert.equal(data.blocks[0].spent, 1200); assert.equal(data.blocks[1].subtasks[0].children[0].id, child.id);
    assert.equal(data.journal, "Progress log"); assert.equal(data.bugs[0].fixed, true);
    await f.write("park_task", { date: day, block_id: b.id });
    await f.write("edit_task_details", { park: true, block_id: b.id, name: "Ink pass" });
    await f.write("schedule_later", { date: tomorrow, block_id: b.id });
    assert.equal((await f.ok("get_day", { date: tomorrow })).day.blocks[0].name, "Ink pass");
    await f.write("move_task", { date: day, to_date: tomorrow, block_id: a.id });
    assert.equal((await f.ok("get_day", { date: tomorrow })).day.blocks.length, 2);
    const template = await f.write("add_template", { name: "Art day", copy_from_date: tomorrow });
    await f.write("add_template_task", { template_id: template.id, name: "Draw" });
    const setup = (await f.read()).setup;
    assert.equal(setup.preferences.defaultMinutes, 30); assert.equal(setup.preferences.routine.leftovers, "park");
    assert.equal(setup.look.theme, "dark"); assert.equal(setup.reviews["2026-11-16"].focus, "Experiment");
    assert.equal(setup.templates.find(t => t.id === template.id).blocks.length, 3);
  } finally { f.sql.close(); }
});
