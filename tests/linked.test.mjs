import test from "node:test";
import assert from "node:assert/strict";
import { DDsyncCopies, DDsyncForget, DDsyncItemId, DDsyncJoin, DDsyncMarkLife, DDsyncPlaces, DDsyncSameNotes, DDsyncValid } from "../public/linked.js";
import { DDnormalizeLife, DDlifeAdd } from "../public/life-board.js";

const day = (notes, styles = {}) => ({ blocks: [], notes, canvas: { board4: { styles } } });
const note = (id, text, extra = {}) => ({ id, kind: "sticky", x: 0, y: 0, text, color: "#FFE299", ...extra });
const sticky = (id, text, extra = {}) => ({ id, type: "sticky", parent: "", x: 0, y: 0, w: 240, h: 240, text, collapsed: false, color: "#FFE299", ...extra });
const section = (id, text, extra = {}) => ({ id, type: "section", parent: "", x: 0, y: 0, w: 480, h: 320, text, collapsed: false, color: "#A8DAFF", ...extra });
const snapshot = (days, items = [], links = []) => ({ setup: { life: { v: 2, items, links, frame: {} } }, days });
const edit = (snap, fn) => { const next = structuredClone(snap); fn(next); return next; };

test("a synced note follows its copy across days and the Feed", () => {
  const before = snapshot(
    {
      "2026-11-03": day([note("a", "Sketch the fox", { syncId: "s-1" }), note("x", "Other")], { "sticky:a": { width: 300, fill: "#FFE299" } }),
      "2026-11-05": day([note("b", "Sketch the fox", { syncId: "s-1" })]),
    },
    [sticky("lf-c", "Sketch the fox", { syncId: "s-1", w: 320 })],
  );
  const changed = edit(before, (s) => {
    s.days["2026-11-03"].notes[0].text = "Sketch the fox, 3 poses";
    s.days["2026-11-03"].canvas.board4.styles["sticky:a"].fill = "#C5F1D2";
    s.days["2026-11-03"].canvas.board4.styles["sticky:a"].textAlign = "center";
  });
  const out = DDsyncCopies(changed, before);
  assert.equal(out.days["2026-11-05"].notes[0].text, "Sketch the fox, 3 poses");
  assert.equal(out.days["2026-11-05"].notes[0].color, "#C5F1D2");
  assert.equal(out.days["2026-11-05"].canvas.board4.styles["sticky:b"].textAlign, "center");
  const feed = out.setup.life.items[0];
  assert.equal(feed.text, "Sketch the fox, 3 poses");
  assert.equal(feed.color, "#C5F1D2");
  assert.equal(feed.style.textAlign, "center");
  // Each copy keeps its own place and size.
  assert.equal(feed.w, 320);
  assert.equal(out.days["2026-11-03"].canvas.board4.styles["sticky:a"].width, 300);
  // A note that is not synced is left alone.
  assert.equal(out.days["2026-11-03"].notes[1].text, "Other");
});

test("an edit in the Feed reaches the day copies", () => {
  const before = snapshot({ "2026-11-03": day([note("a", "Call mom", { syncId: "s-2" })]) }, [sticky("lf-c", "Call mom", { syncId: "s-2" })]);
  const out = DDsyncCopies(edit(before, (s) => { s.setup.life.items[0].text = "Call mom tonight"; }), before);
  assert.equal(out.days["2026-11-03"].notes[0].text, "Call mom tonight");
});

test("nothing changes when no synced copy changed", () => {
  const before = snapshot({ "2026-11-03": day([note("a", "One", { syncId: "s-3" }), note("b", "Two")]) });
  const next = edit(before, (s) => { s.days["2026-11-03"].notes[1].text = "Two!"; });
  assert.equal(DDsyncCopies(next, before), next);
  assert.equal(DDsyncCopies(before, before), before);
});

test("a synced section rebuilds its twin: insides, lines, name and size", () => {
  const items = [
    section("A", "Ideas", { syncId: "s-sec" }),
    sticky("a1", "Fox", { parent: "A", x: 20, y: 40, syncKey: "k1" }),
    sticky("a2", "Owl", { parent: "A", x: 280, y: 40, syncKey: "k2" }),
    section("B", "Ideas", { syncId: "s-sec", x: 900, collapsed: true }),
    sticky("b1", "Fox", { parent: "B", x: 20, y: 40, syncKey: "k1" }),
    sticky("b2", "Owl", { parent: "B", x: 280, y: 40, syncKey: "k2" }),
  ];
  const before = snapshot({}, items, [
    { id: "l1", from: "life:a1", to: "life:a2" },
    { id: "l1~x", from: "life:b1", to: "life:b2" },
  ]);
  // Rename, edit a note, move a note and add a new one in copy A.
  const next = edit(before, (s) => {
    const by = (id) => s.setup.life.items.find((i) => i.id === id);
    by("A").text = "Ideas (fall)";
    by("A").w = 640;
    by("a1").text = "Fox, running";
    by("a2").x = 300;
    s.setup.life.items.push(sticky("a3", "Bear", { parent: "A", x: 20, y: 300 }));
  });
  const out = DDsyncCopies(next, before), list = out.setup.life.items, by = (id) => list.find((i) => i.id === id);
  assert.equal(by("B").text, "Ideas (fall)");
  assert.equal(by("B").w, 640);
  assert.equal(by("B").x, 900, "a copy keeps its own place");
  assert.equal(by("B").collapsed, true, "and its own fold");
  assert.equal(by("b1").text, "Fox, running");
  assert.equal(by("b2").x, 300);
  const bear = list.filter((i) => i.parent === "B" && i.text === "Bear");
  assert.equal(bear.length, 1);
  assert.equal(bear[0].id, DDsyncItemId("B", "a3"), "the twin's id is stable on every device");
  assert.equal(by("a3").syncKey, "a3");
  // Lines inside stay one per copy.
  const inB = out.setup.life.links.filter((l) => l.from.startsWith("life:b") && l.to.startsWith("life:b"));
  assert.equal(inB.length, 1);
  // Running it again changes nothing.
  assert.equal(DDsyncCopies(out, out), out);
  const again = DDsyncCopies(structuredClone(out), out);
  assert.deepEqual(again.setup.life.items, out.setup.life.items);
});

test("deleting inside one copy deletes the twin; deleting a copy keeps the other", () => {
  const items = [
    section("A", "Week", { syncId: "s-w" }),
    sticky("a1", "Gym", { parent: "A", syncKey: "k1" }),
    sticky("a2", "Draw", { parent: "A", syncKey: "k2" }),
    section("B", "Week", { syncId: "s-w", x: 700 }),
    sticky("b1", "Gym", { parent: "B", syncKey: "k1" }),
    sticky("b2", "Draw", { parent: "B", syncKey: "k2" }),
  ];
  const before = snapshot({}, items);
  const one = DDsyncCopies(edit(before, (s) => { s.setup.life.items = s.setup.life.items.filter((i) => i.id !== "b2"); }), before);
  assert.deepEqual(one.setup.life.items.map((i) => i.id).sort(), ["A", "B", "a1", "b1"]);
  const gone = DDsyncCopies(edit(before, (s) => { s.setup.life.items = s.setup.life.items.filter((i) => !["B", "b1", "b2"].includes(i.id)); }), before);
  assert.deepEqual(gone.setup.life.items.map((i) => i.id).sort(), ["A", "a1", "a2"]);
});

test("a copy put inside another copy of itself leaves the group", () => {
  const items = [
    section("A", "Loop", { syncId: "s-l" }),
    sticky("a1", "x", { parent: "A", syncKey: "k1" }),
    section("B", "Loop", { syncId: "s-l", x: 900 }),
    sticky("b1", "x", { parent: "B", syncKey: "k1" }),
  ];
  const before = snapshot({}, items);
  const out = DDsyncCopies(edit(before, (s) => { s.setup.life.items.find((i) => i.id === "B").parent = "A"; }), before);
  const B = out.setup.life.items.find((i) => i.id === "B");
  assert.equal(B.syncId, undefined);
  assert.equal(B.parent, "A");
  assert.equal(out.setup.life.items.filter((i) => i.id === "b1").length, 1);
});

test("the fields survive the Feed normalizer and DDlifeAdd", () => {
  const life = DDnormalizeLife({ items: [sticky("n", "x", { syncId: "s-ok", syncKey: "k-1" }), sticky("m", "y", { syncId: "bad id!", syncKey: 5 })] });
  assert.equal(life.items[0].syncId, "s-ok");
  assert.equal(life.items[0].syncKey, "k-1");
  assert.equal(life.items[1].syncId, undefined);
  assert.equal(life.items[1].syncKey, undefined);
  const added = DDlifeAdd([], { id: "z", type: "sticky", text: "z", syncId: "s-z", syncKey: "kz" });
  assert.equal(added[0].syncId, "s-z");
  assert.equal(added[0].syncKey, "kz");
});

test("helpers: places, same words, forget", () => {
  const snap = snapshot(
    { "2026-11-03": day([note("a", " Fox ", { syncId: "s-f" }), note("b", "Fox")]) },
    [sticky("c", "Fox"), sticky("d", "Owl", { syncId: "s-f" })],
  );
  assert.deepEqual(DDsyncPlaces(snap, "s-f").map((p) => p.id).sort(), ["a", "d"]);
  assert.deepEqual(DDsyncSameNotes(snap, "Fox", { date: "2026-11-03", note: "a" }).map((p) => p.id).sort(), ["b", "c"]);
  assert.deepEqual(DDsyncForget({ id: "q", syncId: "s", syncKey: "k", text: "t" }), { id: "q", text: "t" });
  assert.equal(DDsyncValid("s-abc_1"), true);
  assert.equal(DDsyncValid("no spaces"), false);
});

test("a broken snapshot never loses the change", () => {
  const before = snapshot({});
  const next = { ...before, days: { "2026-11-03": { notes: null } } };
  assert.equal(DDsyncCopies(next, before), next);
});

test("an MCP edit to one copy reaches the others on the server", async () => {
  const { callTool, save, read } = await import("../src/worker.js");
  const { DatabaseSync } = await import("node:sqlite");
  const { readFileSync } = await import("node:fs");
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; } }; } } };
  try {
    const data = snapshot(
      { "2026-11-03": { date: "2026-11-03", blocks: [], bugs: [], notes: [note("a", "Fox", { syncId: "s-m" })], canvas: null } },
      [sticky("lf-1", "Fox", { syncId: "s-m" })],
    );
    data.setup = { types: [{ id: "work" }], lanes: [{ id: "work" }], later: [], worries: [], life: data.setup.life };
    await save(env, data, 0);
    const result = await callTool("update_life_item", { expected_revision: 1, item_id: "lf-1", text: "Fox and owl" }, env, "write");
    assert.equal(result.item.text, "Fox and owl");
    const saved = (await read(env)).data;
    assert.equal(saved.days["2026-11-03"].notes[0].text, "Fox and owl");
    assert.equal(saved.setup.life.items[0].syncId, "s-m");
  } finally {
    sql.close();
  }
});

test("a copy pasted later takes what its group says now", () => {
  const before = snapshot({ "2026-11-03": day([note("a", "New words", { syncId: "s-p" })]), "2026-11-05": day([]) });
  const next = edit(before, (s) => { s.days["2026-11-05"].notes.push(note("b", "Old words", { syncId: "s-p" })); });
  const out = DDsyncCopies(next, before);
  assert.equal(out.days["2026-11-05"].notes[0].text, "New words");
  assert.equal(out.days["2026-11-03"].notes[0].text, "New words");
});

test("Sync same words: notes become one group with the source's look", () => {
  const snap = snapshot(
    {
      "2026-11-03": day([note("a", "Fox", { color: "#C5F1D2" }), note("o", "Owl")], { "sticky:a": { fill: "#C5F1D2", textAlign: "center" } }),
      "2026-11-05": day([note("b", "Fox"), note("c", "Elsewhere", { syncId: "s-old" })]),
    },
    [sticky("lf", "Fox", { syncId: "s-old" })],
  );
  const matches = DDsyncSameNotes(snap, "Fox", { date: "2026-11-03", note: "a" });
  const out = DDsyncJoin(snap, { kind: "day", date: "2026-11-03", id: "a" }, matches, "s-new");
  const ids = DDsyncPlaces(out, "s-new").map((p) => p.id).sort();
  // The Feed note was linked to "Elsewhere", so that one comes along too.
  assert.deepEqual(ids, ["a", "b", "c", "lf"]);
  assert.equal(out.days["2026-11-05"].notes[0].color, "#C5F1D2");
  assert.equal(out.setup.life.items[0].style.textAlign, "center");
  assert.equal(out.days["2026-11-03"].notes[1].syncId, undefined);
});

test("marking a section for a synced copy keys everything inside it", () => {
  const items = [section("A", "S"), sticky("a1", "x", { parent: "A" }), section("A2", "in", { parent: "A" }), sticky("a3", "y", { parent: "A2" }), sticky("z", "out")];
  const marked = DDsyncMarkLife(items, "A");
  assert.ok(DDsyncValid(marked[0].syncId));
  assert.deepEqual(marked.slice(1, 4).map((i) => i.syncKey), ["a1", "A2", "a3"]);
  assert.equal(marked[4].syncKey, undefined);
  assert.equal(DDsyncMarkLife(marked, "A")[0].syncId, marked[0].syncId, "marking twice keeps the link");
});
