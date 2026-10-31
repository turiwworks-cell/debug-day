import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { DDsectionTint, DDsectionShade, DDsetSectionColor, DDshortPath, DDsectionPath, DDSectionChip, DDlifeContrast, DDsectionPalette, DDnormalizeLife } from "../public/life-board.js";
import { DDsectionsFlow, DDflowCurve, DDsectionsMarks, DDsectionsBus } from "../public/sections-flow.js";
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

test("the flowchart runs from the main board to every section, in board order", () => {
  const flow = DDsectionsFlow(life), at = (id) => flow.nodes.find((n) => n.id === id);
  assert.deepEqual(flow.nodes.map((n) => [n.id, n.depth]), [["", 0], ["g", 1], ["r", 2], ["l", 2], ["b", 3], ["w", 1]],
    "top to bottom, then left to right, each child after its parent (not the saved order)");
  assert.deepEqual(flow.links.map((l) => l.from + ">" + l.to), [">g", "g>r", "g>l", "l>b", ">w"]);
  assert.equal(at("").name, "Main board");
  assert.equal(at("").notes, 1, "notes on the main board");
  assert.equal(at("l").notes, 2);
  assert.equal(at("l").children, 1);
  assert.equal(at("g").children, 2);
  assert.equal(at("b").parent, "l");
  assert.equal(at("").parent, null);
  for (const link of flow.links) {
    const from = at(link.from), to = at(link.to);
    assert.ok(to.x >= from.x + from.w + 40, link.from + ">" + link.to + ": a section sits to the right of its parent, with room for the line");
  }
  assert.equal(at("g").y, (at("r").y + at("l").y) / 2, "a parent sits in the middle of its children");
  assert.equal(at("l").y, at("b").y, "one child sits level with its parent");
  for (const depth of [0, 1, 2, 3]) {
    const column = flow.nodes.filter((n) => n.depth === depth).sort((a, b) => a.y - b.y);
    column.slice(1).forEach((n, i) => assert.ok(n.y - column[i].y >= n.h, "pills in a column never overlap"));
    assert.equal(new Set(column.map((n) => n.x)).size, 1, "a level is one column");
  }
  for (const n of flow.nodes) {
    assert.ok(n.x >= 0 && n.x + n.w <= flow.width, n.id + " fits across");
    assert.ok(n.y >= 0 && n.y + n.h <= flow.height, n.id + " fits down");
  }
  assert.deepEqual(DDsectionsFlow([]).nodes.map((n) => n.id), [""], "an empty Life area still shows the main board");
});

test("a folded section hides what is inside it and says how many", () => {
  const folded = DDsectionsFlow(life, { folded: ["g"] });
  assert.deepEqual(folded.nodes.map((n) => n.id), ["", "g", "w"]);
  assert.deepEqual(folded.links.map((l) => l.to), ["g", "w"]);
  const g = folded.nodes[1];
  assert.deepEqual([g.folded, g.hidden, g.children], [true, 3, 2]);
  assert.deepEqual(DDsectionsFlow(life, { folded: ["b", "w", "gone"] }).nodes.map((n) => n.id), ["", "g", "r", "l", "b", "w"], "an empty section has nothing to fold");
  assert.equal(DDsectionsFlow(life, { folded: ["b"] }).nodes.find((n) => n.id === "b").folded, false);
});

test("the board you are in is blue, and so is the way to it", () => {
  const flow = DDsectionsFlow(life, { room: "b" }), at = (id) => flow.nodes.find((n) => n.id === id);
  assert.deepEqual(flow.nodes.filter((n) => n.here).map((n) => n.id), ["b"]);
  assert.deepEqual(flow.nodes.filter((n) => n.trail).map((n) => n.id), ["", "g", "l", "b"]);
  assert.deepEqual(flow.links.filter((l) => l.trail).map((l) => l.from + ">" + l.to), [">g", "g>l", "l>b"]);
  assert.equal(at("r").trail, false);
  const main = DDsectionsFlow(life, { room: "gone" });
  assert.deepEqual(main.nodes.filter((n) => n.trail).map((n) => n.id), [""], "on the main board only the main board is lit");
  assert.deepEqual(main.nodes.filter((n) => n.here).map((n) => n.id), [""], "and it is the board you are in");
});

test("finding a section lights it, dims the rest and opens the folds on the way", () => {
  const book = DDsectionsFlow(life, { query: "book", folded: ["g", "l"] });
  assert.deepEqual(book.nodes.map((n) => n.id), ["", "g", "r", "l", "b", "w"], "a search opens the folds it needs");
  assert.deepEqual(book.nodes.filter((n) => n.found).map((n) => n.id), ["b"]);
  assert.deepEqual(book.nodes.filter((n) => n.dim).map((n) => n.id), ["", "g", "r", "l", "w"]);
  assert.deepEqual(DDsectionsFlow(life, { query: "growth" }).nodes.filter((n) => n.found).map((n) => n.id), ["g", "r", "l", "b"], "a match on a parent finds what is inside it");
  assert.deepEqual(DDsectionsFlow(life, { query: "growth books" }).nodes.filter((n) => n.found).map((n) => n.id), ["b"], "words can come from different levels");
  assert.deepEqual(DDsectionsFlow(life, { query: "nothing here" }).nodes.filter((n) => n.found), []);
  assert.deepEqual(DDsectionsFlow(life, { query: "book", folded: ["w"] }).nodes.filter((n) => n.folded).map((n) => n.id), [], "a leaf has nothing to fold");
  const fa = [sec("p", "", "علاقه و دانش", 0, 0), sec("q", "p", "يادگيري", 0, 10)];
  assert.deepEqual(DDsectionsFlow(fa, { query: "یادگیری" }).nodes.filter((n) => n.found).map((n) => n.id), ["q"], "Arabic and Persian letters match");
});

test("in Persian the flowchart runs right to left, and on a phone the pills are bigger", () => {
  const ltr = DDsectionsFlow(life, { mainLabel: "برد اصلی" }), rtl = DDsectionsFlow(life, { rtl: true, mainLabel: "برد اصلی" });
  assert.equal(rtl.width, ltr.width);
  rtl.nodes.forEach((n, i) => {
    assert.equal(n.x + n.w, ltr.width - ltr.nodes[i].x, n.id + " is mirrored");
    assert.equal(n.y, ltr.nodes[i].y);
  });
  assert.equal(rtl.nodes[0].name, "برد اصلی");
  const phone = DDsectionsFlow(life, { phone: true });
  assert.ok(phone.nodes.every((n) => n.h >= 44), "44px tap targets");
  const long = DDsectionsFlow([sec("x", "", "A very very very long name for a section that goes on", 0, 0)], { measure: (text) => text.length * 8 });
  assert.equal(long.nodes[1].w, 240, "a long name is cut, not stretched across the screen");
  assert.equal(DDsectionsFlow([sec("x", "", "A", 0, 0)], { measure: () => 5 }).nodes[1].w, 84, "a short name still makes a pill you can hit");
});

test("a line leaves the parent's end and its arrow points back at the parent", () => {
  const from = { x: 20, y: 100, w: 120, h: 30 }, to = { x: 240, y: 20, w: 100, h: 30 };
  const curve = DDflowCurve(from, to);
  assert.deepEqual(curve.start, { x: 158, y: 115 });
  assert.deepEqual(curve.end, { x: 240, y: 35 });
  assert.match(curve.d, /^M158,115 C/);
  assert.ok(curve.point.x < 0, "the arrow points left, towards the parent");
  assert.ok(curve.point.y > 0, "and down, since the parent is lower");
  assert.ok(Math.abs(Math.hypot(curve.point.x, curve.point.y) - 1) < 1e-9);
  assert.deepEqual(DDflowCurve({ x: 0, y: 0, w: 50, h: 30 }, { x: 150, y: 0, w: 50, h: 30 }).point, { x: -1, y: -0 }, "a level line points straight back");
  const rtl = DDflowCurve({ x: 300, y: 100, w: 100, h: 30 }, { x: 100, y: 20, w: 100, h: 30 }, { rtl: true });
  assert.deepEqual([rtl.start.x, rtl.end.x], [282, 200], "in Persian lines run from the parent's left to the child's right");
  assert.ok(rtl.point.x > 0, "and the arrow points right, back at the parent");
  assert.ok(rtl.mid.x < rtl.start.x && rtl.mid.x > rtl.end.x);
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
