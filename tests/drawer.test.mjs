import { test } from "node:test";
import assert from "node:assert/strict";
import { DDsectionTint, DDshortPath, DDsectionPath, DDSectionChip, DDlifeContrast, DDsectionPalette } from "../public/life-board.js";
import { DDdrawerFile, DDdrawerShape, DDroman, DDinitials, DDdrawerBus } from "../public/drawer.js";
import { DDboardCore as core } from "../public/board-core.js";

const sec = (id, parent, text, x, y, color) => ({ id, type: "section", parent, text, x, y, w: 300, h: 200, ...(color ? { color } : {}) });
// Growth › Learning › Books, plus a second top section and a sticky.
const life = [
  sec("g", "", "Growth", 0, 0, "#9DD6FF"),
  sec("l", "g", "Learning", 20, 300, "#FFA799"),
  sec("r", "g", "Reading", 20, 40),
  sec("b", "l", "Books", 10, 10),
  sec("w", "", "Work & play", 400, 0, "#121211"),
  { id: "n", type: "sticky", parent: "l", text: "a note", x: 0, y: 0, w: 200, h: 200 },
];

test("one tint per section: the root's color, lighter for each level down", () => {
  const root = DDsectionTint(life, "g"), child = DDsectionTint(life, "l"), grand = DDsectionTint(life, "b");
  assert.equal(root.fill, "#9DD6FF");
  assert.equal(root.depth, 0);
  assert.equal(child.root, "g", "a child takes its root's color");
  assert.notEqual(child.fill, "#FFA799", "an old color saved on a child is not shown");
  assert.equal(DDsectionTint(life, "r").fill, child.fill, "siblings at one depth look the same");
  const light = (hex) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
  assert.ok(light(root.fill) < light(child.fill) && light(child.fill) < light(grand.fill), "each level is a little lighter");
  assert.equal(grand.depth, 2);
  assert.equal(DDsectionTint(life, "n"), null, "a sticky has no section tint");
  assert.equal(DDsectionTint(life, "gone"), null);
});

test("the tint's ink stays readable, on paper white and ink black too", () => {
  const black = DDsectionTint(life, "w");
  assert.equal(black.fill, "#121211");
  assert.equal(black.ink, "#FFFFFF");
  for (const color of DDsectionPalette) {
    const items = [sec("x", "", "X", 0, 0, color), sec("y", "x", "Y", 0, 0)];
    for (const id of ["x", "y"]) {
      const tint = DDsectionTint(items, id);
      assert.equal(tint.ink, DDlifeContrast(tint.fill), color + " " + id);
      assert.notEqual(tint.line, tint.fill, "the outline differs from the fill");
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

test("the chip reads the path live and wears the root's tint", () => {
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

test("the drawer files dividers with their children behind, Main board first", () => {
  const cards = DDdrawerFile(life);
  assert.deepEqual(cards.map((c) => [c.kind, c.id]), [["main", ""], ["divider", "g"], ["card", "r"], ["card", "l"], ["divider", "w"]], "board order: top to bottom, then left to right");
  assert.deepEqual(cards.map((c) => c.column), [0, 1, 2, 0, 1], "tabs cycle through three columns");
  assert.deepEqual(cards.map((c) => c.row), [0, 1, 2, 3, 4]);
  const g = cards[1];
  assert.equal(g.initials, "GR");
  assert.equal(g.roman, "II");
  assert.equal(cards[4].initials, "WP");
  assert.equal(cards[4].roman, "·", "no subsections");
  assert.deepEqual(cards.filter((c) => c.kind === "card").map((c) => c.index), [1, 2]);
  assert.equal(cards.find((c) => c.id === "l").children, 1, "a card with children is a folder");
  const folder = DDdrawerFile(life, "l");
  assert.deepEqual(folder.map((c) => [c.kind, c.id, c.index]), [["main", "", 0], ["card", "b", 1]], "inside a folder only its children show");
  assert.deepEqual(DDdrawerFile(life, "missing").map((c) => c.id), cards.map((c) => c.id), "a lost folder falls back to the top");
  const many = Array.from({ length: 7 }, (_, i) => sec("s" + i, "", "S" + i, i * 10, 0));
  assert.deepEqual(DDdrawerFile(many).map((c) => c.column), [0, 1, 2, 0, 1, 2, 0, 1]);
});

test("finding a section looks through every level, path included", () => {
  assert.deepEqual(DDdrawerFile(life, "", "book").map((c) => c.id), ["", "b"]);
  assert.deepEqual(DDdrawerFile(life, "", "growth").map((c) => c.id), ["", "g", "r", "l", "b"], "a match on a parent finds what is inside it");
  assert.ok(DDdrawerFile(life, "", "book").every((c) => c.kind === "main" || c.found));
  assert.deepEqual(DDdrawerFile(life, "", "nothing here").map((c) => c.kind), ["main"]);
});

test("tabs sit side by side and mirror in Persian", () => {
  const cols = [0, 1, 2].map((c) => DDdrawerShape(900, c));
  for (let i = 1; i < 3; i++) assert.ok(cols[i].a >= cols[i - 1].b, "no overlap");
  assert.ok(cols[2].b <= 900);
  const rtl = DDdrawerShape(900, 0, { rtl: true });
  assert.equal(Math.round(rtl.a), Math.round(cols[2].a), "the first column is on the right in Persian");
  assert.equal(Math.round(DDdrawerShape(900, 2).next.x), Math.round(DDdrawerShape(900, 0).own.x - 2), "the strip beside the third column wraps to the first");
});

test("roman numerals and initials", () => {
  assert.deepEqual([1, 3, 4, 9, 14, 40, 2024].map(DDroman), ["I", "III", "IV", "IX", "XIV", "XL", "MMXXIV"]);
  assert.equal(DDinitials("Creative life"), "CL");
  assert.equal(DDinitials("Job"), "JO");
  assert.equal(DDinitials("LIFE/CREATIVITY"), "LC");
  assert.equal(DDinitials("🎨 art"), "AR");
  assert.equal(DDinitials("یادگیری"), "یا");
  assert.equal(DDinitials("کار و بازی"), "کب", "joining words are skipped");
  assert.equal(DDinitials("Work and play"), "WP");
  assert.equal(DDinitials(""), "··");
});

test("the drawer bus waits for a board", () => {
  let heard = 0;
  const off = DDdrawerBus.on(() => heard++);
  DDdrawerBus.request();
  assert.equal(heard, 1);
  assert.equal(DDdrawerBus.take(), true);
  assert.equal(DDdrawerBus.take(), false);
  off();
});

test("only a top-level section takes a color from the board", () => {
  const day = { __life: { items: structuredClone(life) } },
    next = core.setStyle(day, [{ id: "life:g", lifeId: "g" }, { id: "life:l", lifeId: "l" }], { fill: "#FFE08A" });
  assert.equal(next.__life.items.find((i) => i.id === "g").color, "#FFE08A");
  assert.equal(next.__life.items.find((i) => i.id === "l").color, "#FFA799", "a child keeps its stored color and shows its root's");
});
