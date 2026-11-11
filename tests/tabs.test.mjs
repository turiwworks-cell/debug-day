import assert from "node:assert/strict";
import { test } from "node:test";
import { createHarness, findAll } from "../tests/page-hooks.mjs";
import { DDtabBarFor, DDSectionSheet, DDtabGlyphFor, DDtabs } from "../public/tabs.js";
import { DDThisAppPage, DDchangesFrom } from "../public/this-app.js";

const H = () => createHarness();
const go = (tree, id) => findAll(tree, (n) => n.props?.["data-tab"] === id || n.props?.["data-sheet-tab"] === id)[0];

test("the tab bar lists every tab with its key", () => {
  const h = H();
  const tree = h.expand(DDtabBarFor({ React: h.React, view: "engine", onGo: () => {}, onDown: () => {}, language: "en", keys: {}, sections: [] }));
  const tabs = findAll(tree, (n) => n.props?.role === "tab");
  assert.equal(tabs.length, DDtabs.length);
  assert.deepEqual(tabs.map((t) => t.props["data-tab"]), DDtabs.map((t) => t.id));
  assert.equal(tabs[0].props["aria-selected"], true, "Today is the open tab");
  for (const tab of tabs) assert.ok(findAll(tab, (n) => n.type === "kbd").length === 1, "each tab shows its key");
});

test("a tab is opened by clicking it, and the sheet closes", () => {
  const h = H();
  const opened = [], down = [];
  let tree = h.expand(DDtabBarFor({ React: h.React, view: "engine", onGo: (id) => opened.push(id), onDown: (v) => down.push(v), language: "en", keys: {}, sections: [{ id: "life", name: "Life" }] }));
  go(tree, "capture").props.onClick();
  assert.deepEqual(opened, ["capture"]);
  // The sheet button opens the sheet; a section in it goes to the Board.
  findAll(tree, (n) => n.props?.className === "dd-tabs-more")[0].props.onClick();
  assert.deepEqual(down, [false, true], "opening a tab closes the sheet, the ⌄ opens it");
  tree = h.expand(DDtabBarFor({ React: h.React, view: "engine", down: true, onGo: (id) => opened.push(id), onDown: (v) => down.push(v), language: "en", keys: {}, sections: [{ id: "life", name: "Life", path: "Life", depth: 0 }] }));
  const sheet = findAll(tree, (n) => n.props?.className === "dd-tabs-sheet")[0];
  assert.ok(sheet, "the sheet is there when open");
  assert.equal(findAll(sheet, (n) => n.props?.["data-sheet-tab"]).length, DDtabs.length);
});

test("the sheet shows each section and can give it a key", () => {
  const h = H();
  const saved = [];
  const tree = h.expand(DDSectionSheet({
    React: h.React, language: "en", keys: {}, sections: [{ id: "life", name: "Life" }, { id: "work", name: "Work" }],
    onGo: () => {}, onRoom: () => {}, onKeys: (next) => saved.push(next),
  }));
  const rows = findAll(tree, (n) => n.props?.["data-section"] && n.props.className === "dd-tabs-sheet-sec");
  assert.equal(rows.length, 2, "one row per section");
  assert.equal(findAll(tree, (n) => n.props?.className === "dd-tabs-sheet-room").length, 2, "each row opens its section");
});

test("the This app page lists tabs, sections and the newest changes", () => {
  const h = H();
  const changes = DDchangesFrom("## 5.50.0 — 2026-11-10\n- One thing\n- Another\n\n## 5.49.1 — 2026-11-09\n- Older\n", 5);
  assert.deepEqual(changes.map((c) => c.version), ["5.50.0", "5.49.1"]);
  assert.deepEqual(changes[0].lines, ["One thing", "Another"]);
  const tree = h.expand(DDThisAppPage({
    React: h.React, setup: { lanes: [{ id: "life", name: "Life" }], engineNotes: [] },
    day: { date: "2026-11-10", blocks: [{ id: "b", name: "One", done: false, subtasks: [] }] },
    days: {}, language: "en", keys: {}, onTab: () => {}, onRoom: () => {}, onKeys: () => {}, changes,
  }));
  const card = findAll(tree, (n) => n.type === "section" && n.props?.className === "dd-this-app")[0];
  assert.ok(card, "the page renders");
  assert.equal(findAll(card, (n) => n.props?.["data-tab"]).length, DDtabs.length, "every tab is listed");
  assert.ok(findAll(card, (n) => n.type === "h2").length >= 3, "Tabs, Sections and what changed");
  assert.match(JSON.stringify(card), /5\.50\.0/, "the newest change is shown");
});

test("a section key is saved where the app and the sheet both read it", () => {
  const h = H();
  const stored = {};
  globalThis.localStorage = {
    getItem: (k) => (k in stored ? stored[k] : null),
    setItem: (k, v) => { stored[k] = String(v); },
    removeItem: (k) => { delete stored[k]; },
  };
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.Event = class { constructor(type) { this.type = type; } };
  const tree = h.expand(DDThisAppPage({
    React: h.React, setup: { lanes: [{ id: "life", name: "Life" }], engineNotes: [] },
    day: { date: "2026-11-10", blocks: [] }, days: {}, language: "en", keys: {}, changes: [],
  }));
  const picker = findAll(tree, (n) => n.props?.className === "dd-this-app-keybtn");
  assert.ok(picker.length >= 1, "a section offers a key");
  const page = DDThisAppPage;
  // Two renders: the picker's own state decides whether the field or the key shows.
  picker[0].props.onClick();
  const again = h.expand(page({
    React: h.React, setup: { lanes: [{ id: "life", name: "Life" }], engineNotes: [] },
    day: { date: "2026-11-10", blocks: [] }, days: {}, language: "en", keys: {}, changes: [],
  }));
  const field = findAll(again, (n) => n.props?.className === "dd-this-app-key")[0];
  assert.ok(field, "the picker asks for one key");
  field.props.onKeyDown({ key: "k", stopPropagation() {} });
  const saved = JSON.parse(stored["debug-day:tab-keys"] || "{}");
  assert.equal(Object.values(saved)[0], "k", "the key is written");
  assert.equal(Object.keys(saved).length, 1, "one section now has a key");
});
