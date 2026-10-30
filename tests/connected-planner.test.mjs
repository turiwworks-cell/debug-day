import { test } from "node:test";
import assert from "node:assert/strict";
import { DDcompletion, DDpriorityWeight, DDtags } from "../public/planner.js";
import {
  DDreconcileDay,
  DDconnectRelation,
  DDdisconnectRelation,
  DDcanonicalEdges,
  DDtaskRefs,
  DDrewireRelation,
  DDreconcileSnapshot,
} from "../public/relations.js";
import {
  DDnearestEndpoints,
  DDconnectionGeometry,
} from "../public/connections.js";
import {
  DDbuildSearchIndex,
  DDparseSearch,
  DDmatchSearch,
} from "../public/search.js";
const setup = { lanes: [{ id: "work" }, { id: "life" }], habits: [] };
const block = (id, lane = "work") => ({
  id,
  name: id,
  lane,
  min: 60,
  pri: 0,
  done: false,
  subtasks: [],
});
const fixture = () => ({
  date: "2026-10-24",
  blocks: [
    {
      ...block("a"),
      subtasks: [
        {
          id: "branch",
          text: "First step",
          done: false,
          children: [{ id: "leaf", text: "Leaf", done: false, children: [] }],
        },
      ],
    },
    block("b", "life"),
  ],
  bugs: [{ id: "feeling", text: "Thought", blockId: "a" }],
  notes: [{ id: "note", text: "Keep this", x: 10, y: 20 }],
  canvas: {
    board4: {
      layouts: {
        mindmap: {
          "b:a": { x: 420, y: 140 },
          "sub:a:branch": { x: 700, y: 140 },
          "sub:a:leaf": { x: 1000, y: 140 },
        },
        lanes: {
          "b:a": { x: 100, y: 100 },
          "sub:a:branch": { x: 120, y: 160 },
        },
      },
      links: [],
      overrides: {},
      hidden: [],
      locked: [],
      styles: { "b:a": { opacity: 0.6 } },
      groups: {},
      stack: [],
    },
  },
});

test("Life frame metadata survives reconciliation and snapshot sync", () => {
  const day = fixture(), board = day.canvas.board4;
  board.layouts.mindmap["section:life"] = { x: 900, y: 1200 };
  board.layouts.lanes["section:life"] = { x: 150, y: 800 };
  board.styles["section:life"] = { fill: "#9DD6FF" };
  board.locked.push("section:life");
  board.links.push({ id: "life-link", from: "section:life", to: "b:a" });
  const next = DDreconcileDay(day, structuredClone(day), setup);
  assert.deepEqual(next.canvas.board4, board);
  const snapshot = { setup, days: { [day.date]: day } };
  const synced = DDreconcileSnapshot(structuredClone(snapshot), snapshot);
  assert.deepEqual(synced.days[day.date].canvas.board4, board);
});
test("priority-weighted daily completion is independent of duration and consistent for all task measures", () => {
  const day = {
    blocks: [
      { ...block("urgent"), pri: 1, min: 15, done: true },
      { ...block("long"), min: 720 },
      { ...block("tally"), measure: "count", pri: 2, done: true },
      { ...block("waiting"), measure: "wait", pri: 3 },
      { ...block("parked", ""), pri: 1, done: true },
    ],
  };
  assert.deepEqual(
    [0, 1, 2, 3].map((pri) => DDpriorityWeight({ pri })),
    [1, 4, 3, 2],
  );
  const progress = DDcompletion(day, ["work", "life"]);
  assert.equal(progress.percent, 70);
  assert.equal(progress.total, 4);
  assert.equal(progress.done, 2);
  assert.equal(
    DDcompletion({ blocks: day.blocks.filter((b) => b.done) }, ["work", "life"])
      .percent,
    100,
  );
  assert.equal(DDcompletion({ blocks: [] }, ["work"]).percent, 0);
});
test("tags are bounded, deduplicated across Persian/Arabic variants and found through category search", () => {
  assert.deepEqual(
    DDtags(["#Client work", "client_work", "پروژه", "پروژه", "كتاب", "کتاب"]),
    ["Client_work", "پروژه", "كتاب"],
  );
  assert.equal(
    DDtags(Array.from({ length: 30 }, (_, i) => "tag" + i)).length,
    12,
  );
  const rows = DDbuildSearchIndex(
    {
      setup,
      days: {
        today: {
          blocks: [{ ...block("a"), tags: ["Design", "پروژه"] }],
          bugs: [],
          notes: [],
        },
      },
    },
    "today",
  );
  assert.equal(DDmatchSearch(rows[0], DDparseSearch("#design", "today")), true);
  assert.equal(DDmatchSearch(rows[0], DDparseSearch("#پروژه", "today")), true);
});
test("Plan membership edits clear stale positions in both Board modes and retain independent styles and steps", () => {
  const day = fixture(),
    next = structuredClone(day);
  next.blocks[0].lane = "life";
  const actual = DDreconcileDay(next, day, setup);
  for (const layout of Object.values(actual.canvas.board4.layouts))
    for (const ref of DDtaskRefs(day.blocks[0]))
      assert.equal(layout[ref], undefined);
  assert.equal(actual.canvas.board4.styles["b:a"].opacity, 0.6);
  assert.equal(actual.blocks[0].subtasks[0].children[0].text, "Leaf");
  assert.equal(day.blocks[0].lane, "work");
});
test("a Board drop preserves its new current-mode position while invalidating the other mode", () => {
  const day = fixture(),
    next = structuredClone(day);
  next.blocks[0].lane = "life";
  next.canvas.board4.layouts.lanes["b:a"] = { x: 500, y: 600 };
  const actual = DDreconcileDay(next, day, setup);
  assert.deepEqual(actual.canvas.board4.layouts.lanes["b:a"], {
    x: 500,
    y: 600,
  });
  assert.equal(actual.canvas.board4.layouts.mindmap["b:a"], undefined);
});
test("connecting either end of a lane/task relation changes real membership and detaching parks without deleting", () => {
  for (const [from, to] of [
    ["lane:life", "b:a"],
    ["b:a", "lane:life"],
  ]) {
    const day = fixture(),
      connected = DDconnectRelation(day, from, to, setup);
    assert.equal(connected.blocks[0].lane, "life");
    assert.equal(connected.canvas.board4.links.length, 0);
    assert.ok(
      DDcanonicalEdges(connected, ["work", "life"]).some(
        (e) => e.from === "lane:life" && e.to === "b:a",
      ),
    );
    const detached = DDdisconnectRelation(connected, "lane:life", "b:a", setup);
    assert.equal(detached.blocks[0].lane, "");
    assert.equal(detached.blocks.length, 2);
    assert.equal(detached.blocks[0].subtasks[0].children.length, 1);
  }
});
test("old decorative membership lines and automatic overrides cannot disagree with Plan", () => {
  const day = fixture();
  day.canvas.board4.links = [
    { id: "fake", from: "lane:life", to: "b:a" },
    { id: "real", from: "sticky:note", to: "b:a" },
    { id: "duplicate", from: "b:b", to: "sticky:note" },
  ];
  day.canvas.board4.hidden = ["auto:lane:work->b:a"];
  day.canvas.board4.overrides = {
    "auto:lane:work->b:a": { to: "b:b", from: "lane:life", color: "#abc" },
  };
  const fixed = DDreconcileDay(day, null, setup);
  assert.equal(fixed.blocks[0].lane, "work");
  assert.deepEqual(
    fixed.canvas.board4.links.map((l) => l.id),
    ["real"],
  );
  assert.deepEqual(fixed.canvas.board4.hidden, []);
  assert.deepEqual(fixed.canvas.board4.overrides["auto:lane:work->b:a"], {
    color: "#abc",
  });
  assert.deepEqual(
    DDreconcileDay(fixed, null, setup),
    fixed,
    "repair is idempotent",
  );
});
test("moving a step between cards preserves descendants, remaps links and prevents cycles", () => {
  const day = fixture();
  day.canvas.board4.links = [
    { id: "line", from: "sub:a:leaf", to: "sticky:note" },
  ];
  day.canvas.board4.styles["sub:a:leaf"] = { opacity: 0.4 };
  assert.equal(
    DDconnectRelation(day, "sub:a:leaf", "sub:a:branch", setup),
    day,
  );
  assert.equal(
    DDconnectRelation(day, "b:a", "sub:a:branch", setup),
    day,
    "existing parent is a no-op",
  );
  const moved = DDconnectRelation(day, "b:b", "sub:a:branch", setup);
  assert.equal(moved.blocks[0].subtasks.length, 0);
  assert.equal(moved.blocks[1].subtasks[0].children[0].id, "leaf");
  assert.equal(moved.canvas.board4.links[0].from, "sub:b:leaf");
  assert.equal(moved.canvas.board4.styles["sub:b:leaf"].opacity, 0.4);
  assert.equal(moved.canvas.board4.layouts.mindmap["sub:a:leaf"], undefined);
});
test("locked memberships cannot be edited through connector creation", () => {
  const day = fixture();
  day.canvas.board4.locked = ["b:a"];
  assert.equal(DDconnectRelation(day, "lane:life", "b:a", setup), day);
  assert.equal(DDdisconnectRelation(day, "lane:work", "b:a", setup), day);
});
test("hundreds of alternating Plan and Board edits maintain exactly one real lane parent per task", () => {
  let day = fixture();
  for (let i = 0; i < 400; i++) {
    const lane = ["work", "life", ""][i % 3];
    if (i % 2)
      day = DDconnectRelation(day, "lane:" + (lane || "parked"), "b:a", setup);
    else {
      const next = structuredClone(day);
      next.blocks[0].lane = lane;
      day = DDreconcileDay(next, day, setup);
    }
    const parents = DDcanonicalEdges(day, ["work", "life"]).filter(
      (e) => e.to === "b:a",
    );
    assert.equal(parents.length, 1);
    assert.equal(parents[0].from, "lane:" + (lane || "parked"));
    assert.equal(day.blocks[0].subtasks[0].children[0].id, "leaf");
  }
});
test("smart endpoints change to the closest facing sides as nodes cross in both axes", () => {
  const a = { id: "a", x: 0, y: 0, w: 200, h: 64 };
  const right = DDnearestEndpoints(a, { id: "b", x: 400, y: 0, w: 200, h: 64 });
  assert.equal(right.from, "right");
  assert.equal(right.to, "left");
  assert.equal(right.p.x, 200);
  assert.equal(right.q.x, 400);
  const left = DDnearestEndpoints(a, { id: "b", x: -400, y: 0, w: 200, h: 64 });
  assert.equal(left.from, "left");
  assert.equal(left.to, "right");
  const above = DDnearestEndpoints(a, {
    id: "b",
    x: 0,
    y: -300,
    w: 200,
    h: 64,
  });
  assert.equal(above.from, "top");
  assert.equal(above.to, "bottom");
  const below = DDconnectionGeometry(
    a,
    { id: "b", x: 0, y: 300, w: 200, h: 64 },
    { fromPort: "right", toPort: "left" },
  );
  assert.equal(below.from, "bottom");
  assert.equal(
    below.to,
    "top",
    "legacy ports do not freeze automatic connections",
  );
  const fixed = DDconnectionGeometry(
    a,
    { id: "b", x: 0, y: 300, w: 200, h: 64 },
    { routing: "fixed", fromPort: "right", toPort: "left" },
  );
  assert.equal(fixed.from, "right");
  assert.equal(fixed.to, "left");
});
test("a smart route goes around an intervening task and keeps finite geometry across a dense sweep", () => {
  const a = { id: "a", x: 0, y: 0, w: 200, h: 64 },
    b = { id: "b", x: 600, y: 0, w: 200, h: 64 },
    obstacle = { id: "c", kind: "block", x: 280, y: -40, w: 220, h: 160 };
  const route = DDconnectionGeometry(a, b, {}, [a, b, obstacle]);
  assert.ok(route.points?.length >= 4);
  assert.ok(route.points.some((p) => p.y < -40 || p.y > 120));
  for (let i = 0; i < 1000; i++) {
    const target = {
      ...b,
      x: Math.sin(i * 0.07) * 800,
      y: Math.cos(i * 0.09) * 600,
    };
    for (const style of ["curve", "elbow", "straight"]) {
      const g = DDconnectionGeometry(a, target, { style }, [obstacle]);
      assert.ok(!/NaN|Infinity/.test(g.d));
      assert.ok(Number.isFinite(g.mid.x));
      assert.ok(
        g.p.x === a.x ||
          g.p.x === a.x + a.w ||
          g.p.y === a.y ||
          g.p.y === a.y + a.h,
      );
    }
  }
});
test("replacing the task end of an automatic lane edge updates both real memberships atomically", () => {
  const day = fixture(),
    edge = { automatic: true, from: "lane:work", to: "b:a" };
  const next = DDrewireRelation(day, edge, "lane:work", "b:b", setup);
  assert.equal(next.blocks[0].lane, "");
  assert.equal(next.blocks[1].lane, "work");
  day.canvas.board4.locked = ["b:b"];
  assert.equal(DDrewireRelation(day, edge, "lane:work", "b:b", setup), day);
  assert.equal(DDrewireRelation(day, edge, "sticky:note", "b:a", setup), day);
});
test("a step edge can change parent without silently replacing the identity of its child", () => {
  const day = fixture(),
    edge = { automatic: true, from: "b:a", to: "sub:a:branch" };
  assert.equal(DDrewireRelation(day, edge, "b:a", "sub:a:leaf", setup), day);
  const next = DDrewireRelation(day, edge, "b:b", "sub:a:branch", setup);
  assert.equal(next.blocks[1].subtasks[0].id, "branch");
});
test("the shared state boundary reconciles settings lane removal and device/MCP snapshots too", () => {
  const original = { setup, days: { today: fixture() } },
    next = { ...original, setup: { ...setup, lanes: [{ id: "life" }] } };
  const actual = DDreconcileSnapshot(next, original);
  assert.equal(actual.days.today.canvas.board4.layouts.lanes["b:a"], undefined);
  assert.equal(
    actual.days.today.canvas.board4.layouts.mindmap["b:a"],
    undefined,
  );
  assert.deepEqual(
    actual.days.today.blocks[0].subtasks,
    original.days.today.blocks[0].subtasks,
  );
  assert.equal(
    DDreconcileSnapshot(original, original),
    original,
    "unchanged data has no artificial sync edit",
  );
});
test("old relationship labels are preserved on the real edge and unrelated feeling effects are kept", () => {
  const day = fixture();
  day.canvas.board4.links = [
    {
      id: "owned",
      from: "bug:feeling",
      to: "b:a",
      label: "made starting harder",
      color: "#123456",
    },
    { id: "effect", from: "bug:feeling", to: "b:b", label: "also affected" },
  ];
  const fixed = DDreconcileDay(day, day, setup);
  assert.equal(
    fixed.canvas.board4.overrides["auto:b:a->bug:feeling"].label,
    "made starting harder",
  );
  assert.equal(fixed.canvas.board4.links[0].label, "also affected");
});
test("unrelated day edits do not manufacture board defaults or remove custom layouts", () => {
  const day = fixture();
  delete day.canvas.board4.hidden;
  const next = structuredClone(day);
  next.journal = "A new thought";
  const actual = DDreconcileDay(next, day, setup);
  assert.deepEqual(actual.canvas, day.canvas);
});
test("lane moves and step reparenting preserve the appearance and label of their structural line", () => {
  const day = fixture();
  day.canvas.board4.overrides = {
    "auto:lane:work->b:a": { label: "Important project", color: "#abcdef" },
    "auto:b:a->sub:a:branch": { label: "Start here", width: 3 },
  };
  const moved = DDconnectRelation(day, "lane:life", "b:a", setup);
  assert.equal(
    moved.canvas.board4.overrides["auto:lane:life->b:a"].label,
    "Important project",
  );
  const reparented = DDconnectRelation(day, "b:b", "sub:a:branch", setup);
  assert.equal(
    reparented.canvas.board4.overrides["auto:b:b->sub:b:branch"].label,
    "Start here",
  );
});
test("resolving and reopening a feeling retains its labelled relationship", () => {
  const day = fixture();
  day.canvas.board4.overrides = {
    "auto:b:a->bug:feeling": { label: "Affects this" },
  };
  const next = structuredClone(day);
  next.bugs[0].fixed = true;
  const actual = DDreconcileDay(next, day, setup);
  assert.equal(
    actual.canvas.board4.overrides["auto:b:a->bug:feeling"].label,
    "Affects this",
  );
});
test("malformed legacy canvas fields cannot prevent editing the actual planner tasks", () => {
  for (const board4 of [
    "invalid",
    42,
    [],
    {
      links: { bad: true },
      layouts: { lanes: null },
      overrides: { broken: null },
      groups: { bad: "text" },
    },
  ]) {
    const day = fixture();
    day.canvas.board4 = board4;
    const next = structuredClone(day);
    next.blocks[0].lane = "life";
    const fixed = DDreconcileDay(next, day, setup);
    assert.equal(fixed.blocks[0].lane, "life");
    assert.equal(fixed.blocks[0].subtasks[0].children[0].text, "Leaf");
  }
});
test("rewiring a decorative connection into a real membership removes the obsolete line", () => {
  const day = fixture(),
    edge = { id: "manual", from: "b:a", to: "b:b", automatic: false };
  day.canvas.board4.links.push(edge);
  const actual = DDrewireRelation(day, edge, "lane:life", "b:a", setup);
  assert.equal(actual.blocks[0].lane, "life");
  assert.equal(
    actual.canvas.board4.links.some((e) => e.id === "manual"),
    false,
  );
  assert.equal(
    DDcanonicalEdges(actual, ["work", "life"]).filter((e) => e.to === "b:a")
      .length,
    1,
  );
});
