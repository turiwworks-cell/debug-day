import { test } from "node:test";
import assert from "node:assert/strict";
import { DDsectionKeys, DDsetSectionKey, DDsectionKeyClean, DDsectionKeyOf, DDsectionsVisit, DDsectionsRecent } from "../public/section-keys.js";
import { DDnormalizeLife } from "../public/life-board.js";

const section = (id, text, extra = {}) => ({ id, type: "section", parent: "", x: 0, y: 0, w: 480, h: 320, text, ...extra });
const items = () => [section("app", "This App"), section("work", "Work", { key: "w" }), section("home", "Home"), { id: "n", type: "sticky", parent: "", text: "note", key: "q" }];

test("This App has T, keys live on sections, and only sections", () => {
  const { byKey, byId } = DDsectionKeys(items());
  assert.equal(byKey.get("t"), "app");
  assert.equal(byKey.get("w"), "work");
  assert.equal(byId.has("n"), false, "a note never has a key");
  assert.equal(DDsectionKeys([section("x", "  this APP ")]).byKey.get("t"), "x", "the name is matched loosely");
});

test("a key moves to the section that takes it; clearing This App is remembered", () => {
  let list = DDsetSectionKey(items(), "home", "W");
  let keys = DDsectionKeys(list);
  assert.equal(keys.byKey.get("w"), "home");
  assert.equal("key" in list.find((i) => i.id === "work"), false, "Work let go of W");
  list = DDsetSectionKey(list, "work", "t");
  keys = DDsectionKeys(list);
  assert.equal(keys.byKey.get("t"), "work", "Work takes T from This App");
  assert.equal(keys.byId.has("app"), false);
  list = DDsetSectionKey(list, "work", "");
  assert.equal(DDsectionKeys(list).byKey.get("t"), "app", "T goes back to This App");
  list = DDsetSectionKey(list, "app", "");
  assert.equal(list.find((i) => i.id === "app").key, "-");
  assert.equal(DDsectionKeys(list).byKey.has("t"), false, "This App asked for no key");
  assert.equal(DDsetSectionKey(list, "n", "q"), list, "notes are left alone");
});

test("D, numbers and symbols are never keys", () => {
  assert.equal(DDsectionKeyClean("d"), "");
  assert.equal(DDsectionKeyClean("1"), "");
  assert.equal(DDsectionKeyClean("ab"), "");
  assert.equal(DDsectionKeyClean("K"), "k");
  assert.equal(DDsectionKeyOf({ code: "KeyW", key: "ص" }), "w", "a Persian layout gives the printed letter");
  assert.equal(DDsectionKeyOf({ code: "KeyD", key: "d" }), "");
  assert.equal(DDsectionKeyOf({ code: "Digit1", key: "1" }), "");
});

test("keys survive the planner's own clean-up", () => {
  const life = DDnormalizeLife({ items: [section("a", "Work", { key: "W" }), section("b", "Bad", { key: "dd" }), section("c", "This App", { key: "-" })] });
  assert.equal(life.items[0].key, "w");
  assert.equal("key" in life.items[1], false);
  assert.equal(life.items[2].key, "-");
});

test("recent boards: newest first, never the one you are on", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    DDsectionsVisit("", "work");
    DDsectionsVisit("work", "home");
    assert.deepEqual(DDsectionsRecent(items(), "home"), ["work", ""]);
    assert.deepEqual(DDsectionsRecent(items(), ""), ["home", "work"]);
    assert.deepEqual(DDsectionsRecent([section("home", "Home")], "home"), [""], "a deleted section leaves the list");
  } finally {
    delete globalThis.localStorage;
  }
});
