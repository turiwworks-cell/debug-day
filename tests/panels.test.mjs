import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDpanelList,
  DDpanelOf,
  DDpanelName,
  DDpanelCSS,
  DDpanelCounts,
  DDpanelCommands,
  DDPanelMap,
} from "../public/panels.js";

test("each panel has its own id, color and icon", () => {
  for (const key of ["id", "color", "icon"])
    assert.equal(new Set(DDpanelList.map((panel) => panel[key])).size, DDpanelList.length, key);
  for (const panel of DDpanelList) {
    assert.match(panel.color, /^#[0-9A-F]{6}$/i);
    assert.equal(panel.name.length, 2);
    assert.ok(DDpanelCSS.includes(`--panel-${panel.id}:${panel.color}`));
    assert.ok(DDpanelCSS.includes(`[data-panel="${panel.id}"]{--pc:var(--panel-${panel.id})}`));
  }
  assert.equal(DDpanelOf("nope"), null);
  assert.equal(DDpanelName("habits", "fa"), "عادت‌ها");
  assert.equal(DDpanelName("habits", "en"), "Habits");
});

test("Ctrl+Space rows isolate a panel, or open the pages that have no isolate", () => {
  const calls = [],
    rows = DDpanelCommands("en", (id, isolate) => calls.push([id, isolate]));
  const order = DDpanelList.map((panel) => panel.id);
  order.splice(1, 0, "sections");
  assert.deepEqual(rows.map((row) => row.id), order.map((id) => "cmd-panel-" + id), "Sections sits right after the Engine");
  for (const row of rows) {
    assert.ok(row.id.startsWith("cmd-"), "the app only passes cmd- rows to the palette");
    row.action();
  }
  assert.deepEqual(calls, order.map((id) => [id, id === "sections" ? false : DDpanelList.find((panel) => panel.id === id).isolate]));
  calls.length = 0;
  rows.find((row) => row.panel.id === "habits").showWithRest();
  assert.deepEqual(calls, [["habits", false]]);
  assert.equal(rows.find((row) => row.panel.id === "calendar").showWithRest, null);
  assert.equal(DDpanelCommands("fa", () => {})[0].title, "انجین", "the Engine comes first in Ctrl+Space");
  assert.equal(DDpanelCommands("fa", () => {})[1].title, "سکشن‌ها", "then the Section Drawer");
  assert.equal(DDpanelCommands("fa", () => {})[2].title, "برد", "Plan is part of the Engine now (5.50)");
  assert.equal(DDpanelOf("plan"), null);
});

test("map counts read the day without changing it", () => {
  const day = {
      blocks: [{ id: "a" }, { id: "b" }],
      bugs: [{ id: "x", fixed: false }, { id: "y", fixed: true }],
      habits: { write: { done: true } },
    },
    setup = { habits: [{ id: "write" }, { id: "walk" }], feedbacks: [{ done: false }, { done: true }] },
    before = JSON.stringify({ day, setup });
  assert.deepEqual(DDpanelCounts(day, setup, "en"), {
    engine: "2 tasks",
    habits: "1 of 2 today",
  });
  assert.equal(DDpanelCounts(day, setup, "fa").engine, "۲ کار");
  assert.deepEqual(DDpanelCounts({}, {}, "en"), { engine: "0 tasks", habits: null });
  assert.equal(JSON.stringify({ day, setup }), before);
});

test("Stats lives inside Calendar and Feelings is gone, so the app map shows one Calendar card", () => {
  const R = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }) },
    map = DDPanelMap({ React: R, language: "en", counts: { feelings: "2 open" }, onPick() {} }),
    cards = map.children.map((card) => card.props["data-panel"]);
  for (const panel of DDpanelList.filter((panel) => panel.partOf)) {
    assert.ok(DDpanelOf(panel.partOf), panel.id);
    assert.ok(!cards.includes(panel.id), panel.id);
  }
  assert.deepEqual(cards, ["engine", "board", "habits", "calendar"]);
  assert.equal(DDpanelOf("lab"), null, "App changes was removed (5.28)");
  assert.equal(DDpanelOf("feelings"), null, "the Feelings panel was removed");
  const calendar = map.children[cards.indexOf("calendar")],
    count = calendar.children[0].children.find((child) => child && child.type === "small");
  assert.ok(!count, "no feelings count on the Calendar card");
});
