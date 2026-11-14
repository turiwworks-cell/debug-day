// MCP reaches the newer tools (5.79): note looks and deadlines, comments,
// reminders and habits, through the same worker the app syncs with.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";

test("MCP: notes, documents, to-dos, comments, reminders and habits", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  try {
    const env = { SYNC_TOKEN: "s".repeat(64), MCP_WRITE_TOKEN: "w".repeat(64), MCP_READ_TOKEN: "r".repeat(64), DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; }, async run() { sql.prepare(query).run(...args); return { success: true }; } }; } } };
    const date = "2026-11-14";
    const data = {
      setup: { types: [{ id: "work", name: "Work" }], lanes: [{ id: "work", name: "Work" }], templates: [], life: { v: 2, items: [{ id: "feed-n", type: "sticky", parent: "", x: 0, y: 0, w: 240, h: 240, text: "Feed idea", color: "#FFE299" }], links: [], frame: {} } },
      days: { [date]: { date, blocks: [], bugs: [], notes: [], canvas: null } },
    };
    const auth = { Authorization: "Bearer " + env.SYNC_TOKEN, "Content-Type": "application/json" };
    assert.equal((await worker.fetch(new Request("http://localhost/api/sync", { method: "PUT", headers: { ...auth, "If-Match": "0" }, body: JSON.stringify({ data }) }), env)).status, 200);
    const call = async (name, args, token = env.MCP_WRITE_TOKEN) => (await (await worker.fetch(new Request("http://localhost/mcp", { method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), env)).json()).result;
    const ok = async (name, args) => { const r = await call(name, args); assert.equal(r.isError, false, name + ": " + JSON.stringify(r)); return r.structuredContent; };
    let rev = (await ok("get_setup", {})).revision;
    const list = (await (await worker.fetch(new Request("http://localhost/mcp", { method: "POST", headers: { Authorization: "Bearer " + env.MCP_WRITE_TOKEN, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), env)).json()).result.tools.map((t) => t.name);
    for (const name of ["update_note", "delete_note", "set_feed_note", "add_comment", "update_comment", "add_reminder", "update_reminder", "add_habit", "update_habit", "log_habit"]) assert.ok(list.includes(name), name + " is listed");

    // A to-do list note with a deadline, then it becomes a document.
    let r = await ok("add_note", { date, expected_revision: rev, text: "- [ ] ink\n- [ ] colour", look: "todo", due: "2026-12-01", x: 300, y: 200 });
    const noteId = r.id; rev = r.revision;
    let day = (await ok("get_day", { date })).day;
    assert.equal(day.notes[0].due, "2026-12-01");
    assert.deepEqual(day.canvas.board4.styles["sticky:" + noteId], { todo: true });
    r = await ok("update_note", { date, expected_revision: rev, note_id: noteId, look: "document", text: "# Plan\n- [x] ink", due: "" });
    rev = r.revision; assert.equal(r.look, "document");
    day = (await ok("get_day", { date })).day;
    assert.equal(day.notes[0].text, "# Plan\n- [x] ink");
    assert.equal("due" in day.notes[0], false, "an empty due clears it");
    assert.equal(day.canvas.board4.styles["sticky:" + noteId].doc, true);
    assert.equal(day.canvas.board4.styles["sticky:" + noteId].todo, undefined);

    // Comments on the note, a reply, resolve, then delete.
    r = await ok("add_comment", { date, expected_revision: rev, on: "sticky:" + noteId, text: "Looks good" });
    const commentId = r.id; rev = r.revision;
    r = await ok("update_comment", { date, expected_revision: rev, comment_id: commentId, reply: "Thanks", done: true }); rev = r.revision;
    day = (await ok("get_day", { date })).day;
    const c = day.canvas.board4.comments[0];
    assert.equal(c.on, "sticky:" + noteId); assert.equal(c.done, true); assert.deepEqual(c.thread.map((m) => m.text), ["Looks good", "Thanks"]);
    r = await ok("add_comment", { feed: true, expected_revision: rev, on: "life:feed-n", text: "Feed thought" }); rev = r.revision;
    assert.equal((await ok("get_life", {})).life.comments[0].on, "life:feed-n");
    r = await ok("update_comment", { date, expected_revision: rev, comment_id: commentId, delete: true }); rev = r.revision;
    assert.equal((await ok("get_day", { date })).day.canvas.board4.comments, undefined);

    // A Feed note gets a deadline and a look.
    r = await ok("set_feed_note", { expected_revision: rev, item_id: "feed-n", due: "2027-03-01", look: "todo" }); rev = r.revision;
    const feed = (await ok("get_life", {})).life.items.find((i) => i.id === "feed-n");
    assert.equal(feed.due, "2027-03-01"); assert.equal(feed.style.todo, true);

    // Reminders far ahead, repeating ones done one day at a time.
    r = await ok("add_reminder", { expected_revision: rev, date: "2027-06-01", title: "Renew studio", repeat: "weekly" });
    const reminderId = r.id; rev = r.revision;
    r = await call("update_reminder", { expected_revision: rev, reminder_id: reminderId, done: true });
    assert.equal(r.isError, true, "a weekly reminder needs the day it was done");
    r = await ok("update_reminder", { expected_revision: rev, reminder_id: reminderId, done: true, date_done: "2027-06-08" }); rev = r.revision;
    let setup = (await ok("get_setup", {})).setup;
    assert.deepEqual(setup.reminders[0].completedDates, ["2027-06-08"]);
    r = await ok("update_reminder", { expected_revision: rev, reminder_id: reminderId, delete: true }); rev = r.revision;

    // Habits: add, log, rename, remove.
    r = await ok("add_habit", { expected_revision: rev, name: "Drawing", goal_minutes: 45 });
    const habitId = r.id; rev = r.revision;
    r = await ok("log_habit", { date, expected_revision: rev, habit_id: habitId, done: true, minutes: 30 }); rev = r.revision;
    assert.deepEqual((await ok("get_day", { date })).day.habits[habitId], { done: true, min: 30 });
    r = await ok("update_habit", { expected_revision: rev, habit_id: habitId, name: "Sketching" }); rev = r.revision;
    setup = (await ok("get_setup", {})).setup;
    assert.equal(setup.reminders.length, 0);
    assert.deepEqual(setup.habits[0], { id: habitId, name: "Sketching", emo: "", color: setup.habits[0].color, goal: 45 });
    r = await ok("update_habit", { expected_revision: rev, habit_id: habitId, remove: true }); rev = r.revision;

    // A task no longer needs a lane (Lanes are gone, 5.78).
    r = await ok("add_block", { date, expected_revision: rev, name: "Ink", minutes: 30, type_id: "work" }); rev = r.revision;
    assert.equal((await ok("get_day", { date })).day.blocks[0].lane, "work");

    // Deleting the note takes its place and styles with it.
    r = await ok("delete_note", { date, expected_revision: rev, note_id: noteId, confirm: true });
    day = (await ok("get_day", { date })).day;
    assert.equal(day.notes.length, 0);
    assert.equal(day.canvas.board4.styles?.["sticky:" + noteId], undefined);
    // A stale revision is refused.
    assert.equal((await call("add_habit", { expected_revision: 1, name: "Late" })).isError, true);
  } finally { sql.close(); }
});
