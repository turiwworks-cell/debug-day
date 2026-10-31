import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { DDsectionTint, DDsectionShade, DDsetSectionColor, DDshortPath, DDsectionPath, DDSectionChip, DDlifeContrast, DDsectionPalette, DDnormalizeLife } from "../public/life-board.js";
import { DDsectionsRows, DDsectionsMarks, DDsectionsBus } from "../public/sections-list.js";
import { DDboardCore as core } from "../public/board-core.js";
import { callTool, save, read } from "../src/worker.js";

const sec = (id, parent, text, x, y, color, extra = {}) => ({ id, type: "section", parent, text, x, y, w: 300, h: 200, ...(color ? { color } : {}), ...extra });
const note = (id, parent) => ({ id, type: "sticky", parent, text: "a note", x: 0, y: 0, w: 200, h: 200 });
// Growth › (Reading, Learning › Books), Work & play, and notes here and there.
const life = [
  sec("g", "", "Growth", 0, 0, "#9DD6FF"),
  sec("l", "g", "Learning", 20, 300, "#FFA799"),
  sec("r", "g", "Reading", 20, 40),
  sec("b", "l", "Books", 10, 10),
  sec("w", "", "Work & play", 400, 0, "#121211"),
  note("n", "l"),
  note("n2", "l"),
  note("loose", ""),
];
const differ = (a, b) => [1, 3, 5].some((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) >= 8);

test("a subsection gets its own shade of the family color, never the same as its parent", () => {
  const root = DDsectionTint(life, "g"), child = DDsectionTint(life, "l"), grand = DDsectionTint(life, "b");
  assert.equal(root.fill, "#9DD6FF");
  assert.equal(root.own, true);
  assert.equal(child.root, "g", "a child still belongs to its root");
  assert.equal(child.depth, 1);
  assert.equal(grand.depth, 2);
  assert.notEqual(child.fill, "#FFA799", "an old color saved on a child before it had its own stays unused");
  assert.equal(child.own, false);
  assert.ok(differ(root.fill, child.fill), "the child looks a little different from its parent");
  assert.ok(differ(child.fill, grand.fill), "and so does the grandchild");
  assert.equal(child.fill, DDsectionShade(root.fill, "l"));
  assert.equal(grand.fill, DDsectionShade(child.fill, "b"), "a grandchild is a shade of its own parent");
  assert.equal(DDsectionTint(life, "n"), null, "a sticky has no section tint");
  assert.equal(DDsectionTint(life, "gone"), null);
});

test("a shade stays put when a section moves or is renamed", () => {
  const moved = life.map((i) => (i.id === "l" ? { ...i, x: 900, y: -40, text: "Study" } : i));
  assert.equal(DDsectionTint(moved, "l").fill, DDsectionTint(life, "l").fill);
  // Siblings spread over a few turns of the hue, so a family is not one flat color.
  const many = [sec("top", "", "Top", 0, 0, "#A8E6B8"), ...Array.from({ length: 12 }, (_, i) => sec("k" + i, "top", "K" + i, i * 10, 0))];
  assert.ok(new Set(many.slice(1).map((s) => DDsectionTint(many, s.id).fill)).size >= 3);
  // Greys have no hue to turn: they only get lighter or darker.
  for (const grey of ["#121211", "#FFFFFF", "#E6E6E6"]) {
    const shade = DDsectionShade(grey, "x");
    assert.ok(differ(grey, shade), grey + " → " + shade);
    assert.equal(shade.slice(1, 3), shade.slice(3, 5), "still a grey");
  }
});

test("anyone can give a subsection its own color, and take it back", () => {
  let items = DDsetSectionColor(life, "l", "#C8E6A0");
  const l = items.find((i) => i.id === "l");
  assert.deepEqual([l.color, l.ownColor], ["#C8E6A0", true]);
  assert.equal(DDsectionTint(items, "l").fill, "#C8E6A0");
  assert.equal(DDsectionTint(items, "l").own, true);
  assert.equal(DDsectionTint(items, "b").fill, DDsectionShade("#C8E6A0", "b"), "its children take shades of the new color");
  items = DDsetSectionColor(items, "l", null);
  assert.equal(items.find((i) => i.id === "l").ownColor, undefined);
  assert.equal(items.find((i) => i.id === "l").color, undefined);
  assert.equal(DDsectionTint(items, "l").fill, DDsectionTint(life, "l").fill, "back to the family shade");
  // A top section just takes the color; it has no family shade to go back to.
  items = DDsetSectionColor(life, "g", "#FFE08A");
  assert.deepEqual([items[0].color, items[0].ownColor], ["#FFE08A", undefined]);
  assert.equal(DDsetSectionColor(life, "g", null)[0].color, "#9DD6FF");
  assert.equal(DDsetSectionColor(life, "n", "#FFE08A")[5].color, undefined, "only sections");
  // The choice survives the trip through storage, custom colors included.
  const kept = DDnormalizeLife({ items: DDsetSectionColor(life, "r", "#7A5FF5") }).items.find((i) => i.id === "r");
  assert.deepEqual([kept.color, kept.ownColor], ["#7A5FF5", true]);
  assert.equal(DDnormalizeLife({ items: [{ ...life[0], ownColor: "yes" }] }).items[0].ownColor, undefined);
});

test("the tint's ink stays readable, on paper white and ink black too", () => {
  const black = DDsectionTint(life, "w");
  assert.equal(black.fill, "#121211");
  assert.equal(black.ink, "#FFFFFF");
  for (const color of DDsectionPalette) {
    const items = [sec("x", "", "X", 0, 0, color), sec("y", "x", "Y", 0, 0), sec("z", "y", "Z", 0, 0)];
    for (const id of ["x", "y", "z"]) {
      const tint = DDsectionTint(items, id);
      assert.equal(tint.ink, DDlifeContrast(tint.fill), color + " " + id);
      assert.notEqual(tint.line, tint.fill, "the outline differs from the fill");
      assert.match(tint.fill, /^#[0-9A-F]{6}$/);
    }
  }
  assert.equal(DDsectionPalette.length, 10, "eight soft colors plus ink black and paper white");
  // An old board without colors still gets one stable family tint.
  const plain = [sec("p", "", "Plain", 0, 0), sec("q", "p", "Inner", 0, 0)];
  assert.match(DDsectionTint(plain, "p").fill, /^#[0-9A-F]{6}$/);
  assert.equal(DDsectionTint(plain, "p").fill, DDsectionTint(plain, "p").fill);
});

test("a task's tag shows the whole path, shortened in the middle when long", () => {
  assert.deepEqual(DDshortPath(["Growth"]), { parts: ["Growth"], full: "Growth", short: "Growth" });
  assert.equal(DDshortPath(["Growth", "Learning"]).short, "Growth › Learning");
  assert.equal(DDshortPath(["Growth", "Learning", "Books"]).short, "Growth › Learning › Books", "short enough stays whole");
  assert.equal(DDshortPath(["Creative life", "Sketches", "Hands"]).short, "Creative life › … › Hands");
  const five = DDshortPath(["Growth", "Learning", "Books", "Philosophy", "Stoics"]);
  assert.equal(five.full, "Growth › Learning › Books › Philosophy › Stoics");
  assert.equal(five.short, "Growth › … › Stoics", "first and last parts are kept");
  assert.equal(DDshortPath(["A very long top section name", "Another long one"]).short, "A very long top section name › Another long one", "two parts are never cut in the middle");
  assert.equal(DDsectionPath(life, "b").full, "Growth › Learning › Books");
  assert.equal(DDsectionPath([sec("u", "", "  ", 0, 0)], "u", 28, "Section").full, "Section", "an unnamed section still has a label");
});

test("the chip reads the path live and wears the section's tint", () => {
  const R = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
  const chip = DDSectionChip({ React: R, items: life, id: "b", language: "en" });
  assert.equal(chip.children.join(""), "↖ Growth › Learning › Books");
  assert.equal(chip.props["aria-label"], "Came from Growth › Learning › Books");
  assert.equal(chip.props.style.background, DDsectionTint(life, "b").fill);
  const renamed = life.map((i) => (i.id === "g" ? { ...i, text: "Grow" } : i));
  assert.equal(DDSectionChip({ React: R, items: renamed, id: "b", language: "fa" }).children.join(""), "↖ Grow › Learning › Books", "a rename shows at once");
  assert.equal(DDSectionChip({ React: R, items: life, id: "", language: "en" }), null);
  assert.equal(DDSectionChip({ React: R, items: life, id: "n", language: "en" }), null);
});

test("the list shows every section under its parent, in board order", () => {
  const rows = DDsectionsRows(life);
  assert.deepEqual(rows.map((r) => [r.kind, r.id, r.depth]), [["main", "", 0], ["section", "g", 0], ["section", "r", 1], ["section", "l", 1], ["section", "b", 2], ["section", "w", 0]],
    "top to bottom, then left to right, each child right under its parent (not the saved order)");
  assert.equal(rows[0].notes, 1, "notes on the main board");
  assert.equal(rows.find((r) => r.id === "l").notes, 2);
  assert.equal(rows.find((r) => r.id === "l").children, 1);
  assert.equal(rows.find((r) => r.id === "g").children, 2);
  assert.equal(rows.find((r) => r.id === "b").parent, "l");
  const folded = DDsectionsRows(life, { folded: ["g"] });
  assert.deepEqual(folded.map((r) => r.id), ["", "g", "w"], "a folded section hides what is inside");
  assert.equal(folded[1].folded, true);
  assert.equal(folded[1].hidden, 3, "and says how many are folded away");
  assert.deepEqual(DDsectionsRows(life, { folded: ["b", "w"] }).map((r) => r.id), ["", "g", "r", "l", "b", "w"], "an empty section has nothing to fold");
  assert.deepEqual(DDsectionsRows([]).map((r) => r.kind), ["main"]);
});

test("finding a section looks through every level and keeps the sections above it", () => {
  const book = DDsectionsRows(life, { query: "book" });
  assert.deepEqual(book.map((r) => [r.id, r.found, r.context]), [["g", false, true], ["l", false, true], ["b", true, false]], "parents stay, dimmed");
  assert.deepEqual(DDsectionsRows(life, { query: "growth" }).map((r) => r.id), ["g", "r", "l", "b"], "a match on a parent finds what is inside it");
  assert.deepEqual(DDsectionsRows(life, { query: "growth books" }).filter((r) => r.found).map((r) => r.id), ["b"], "words can come from different levels");
  assert.deepEqual(DDsectionsRows(life, { query: "book", folded: ["g", "l"] }).map((r) => r.id), ["g", "l", "b"], "a search opens every fold");
  assert.deepEqual(DDsectionsRows(life, { query: "nothing here" }), []);
  const fa = [sec("p", "", "علاقه و دانش", 0, 0), sec("q", "p", "يادگيري", 0, 10)];
  assert.deepEqual(DDsectionsRows(fa, { query: "یادگیری" }).filter((r) => r.found).map((r) => r.id), ["q"], "Arabic and Persian letters match");
});

test("search marks sit on the right letters of the name", () => {
  assert.deepEqual(DDsectionsMarks("Work & play", "PLAY"), [[7, 11]]);
  assert.deepEqual(DDsectionsMarks("Growth", "row"), [[1, 4]]);
  assert.deepEqual(DDsectionsMarks("Growth", "x"), []);
  assert.deepEqual(DDsectionsMarks("يادگيري", "دگی"), [[2, 5]]);
  assert.deepEqual(DDsectionsMarks("Work & play", "work play"), [[0, 4], [7, 11]]);
  assert.deepEqual(DDsectionsMarks("Work", ""), []);
});

test("the sections bus waits for a board", () => {
  let heard = 0;
  const off = DDsectionsBus.on(() => heard++);
  DDsectionsBus.request();
  assert.equal(heard, 1);
  assert.equal(DDsectionsBus.take(), true);
  assert.equal(DDsectionsBus.take(), false);
  off();
});

test("a color picked on the board belongs to the section it was picked for", () => {
  const day = { __life: { items: structuredClone(life) } },
    next = core.setStyle(day, [{ id: "life:g", lifeId: "g" }, { id: "life:l", lifeId: "l" }], { fill: "#FFE08A" }),
    l = next.__life.items.find((i) => i.id === "l");
  assert.equal(next.__life.items.find((i) => i.id === "g").color, "#FFE08A");
  assert.deepEqual([l.color, l.ownColor], ["#FFE08A", true], "a subsection keeps the color it was given");
  const back = core.setStyle(next, [{ id: "life:l", lifeId: "l" }], { fill: null }).__life.items.find((i) => i.id === "l");
  assert.deepEqual([back.color, back.ownColor], [undefined, undefined], "no fill gives back the family shade");
});

test("Claude's color for a subsection is its own color too", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(query) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sql.prepare(query).get(...args) || null; } }; } } };
  try {
    await save(env, { setup: { life: { items: [sec("a", "", "Top", 0, 0, "#9DD6FF"), sec("c", "a", "Inner", 10, 10, "#FFA799")] }, types: [], lanes: [] }, days: {} }, 0);
    await callTool("update_life_item", { expected_revision: 1, item_id: "c", color: "#C8E6A0" }, env, "write");
    await callTool("update_life_item", { expected_revision: 2, item_id: "a", color: "#FFE08A" }, env, "write");
    const added = await callTool("add_life_item", { expected_revision: 3, type: "section", text: "New", parent: "a", color: "#FFA6D9" }, env, "write");
    const items = (await read(env)).data.setup.life.items;
    assert.deepEqual([items.find((i) => i.id === "c").color, items.find((i) => i.id === "c").ownColor], ["#C8E6A0", true]);
    assert.equal(items.find((i) => i.id === "a").ownColor, undefined, "a top section needs no flag");
    assert.equal(items.find((i) => i.id === added.item.id).ownColor, true);
    assert.equal(DDsectionTint(items, "c").fill, "#C8E6A0");
  } finally {
    sql.close();
  }
});
