import test from "node:test";
import assert from "node:assert/strict";
import { DDboardCore as core } from "../public/board-core.js";
const day = () => ({
  date: "2026-10-23",
  blocks: [
    {
      id: "a",
      name: "Task",
      done: true,
      type: "work",
      lane: "work",
      min: 30,
      subtasks: [
        {
          id: "s",
          text: "Step",
          done: true,
          children: [{ id: "nested", text: "Nested", children: [] }],
        },
      ],
    },
  ],
  notes: [
    { id: "n", kind: "sticky", text: "Hello", color: "#FFE299", x: 20, y: 30 },
  ],
  bugs: [{ id: "f", text: "Feeling", blockId: "a" }],
  canvas: {
    board4: {
      styles: {
        "b:a": { opacity: 0.7 },
        "sub:a:s": { textSize: 18 },
        "sticky:n": { width: 300 },
      },
      layouts: { mindmap: { "b:a": { x: 100, y: 100 } } },
      links: [
        {
          id: "link:1",
          from: "b:a",
          to: "sticky:n",
          bend: { x: 110, y: 120 },
          arrow: true,
        },
      ],
      overrides: { "auto:b:a->sub:a:s": { color: "#FFFFFF" } },
      locked: [],
      hidden: ["auto:b:a->sub:a:s"],
      stack: ["b:a", "sticky:n"],
      groups: { group: ["b:a", "sticky:n"] },
    },
  },
});
const nodes = () => [
  {
    id: "sub:a:nested",
    kind: "subtask",
    blockId: "a",
    subId: "nested",
    parentId: "sub:a:s",
    x: 180,
    y: 130,
    w: 90,
    h: 40,
  },
  {
    id: "sub:a:s",
    kind: "subtask",
    blockId: "a",
    subId: "s",
    parentId: "b:a",
    x: 160,
    y: 110,
    w: 100,
    h: 40,
  },
  { id: "b:a", kind: "block", blockId: "a", x: 100, y: 100, w: 100, h: 50 },
  { id: "sticky:n", kind: "sticky", noteId: "n", x: 20, y: 30, w: 220, h: 160 },
  { id: "bug:f", kind: "bug", bugId: "f", x: 140, y: 250, w: 120, h: 50 },
];
test("numeric zoom accepts Persian digits and exact steps clamp without drift", () => {
  assert.equal(core.zoomInput("۱۲۵٪"), 1.25);
  assert.equal(core.zoomInput("١٢٫٥%"), 0.125);
  assert.equal(core.zoomInput("bad"), null);
  assert.equal(core.zoomInput("900"), 8);
  assert.equal(core.zoomStep(0.8, 1), 1);
  assert.equal(core.zoomStep(1, -1), 0.75);
  assert.equal(core.zoomStep(0.05, -1), 0.05);
});
test("zoom preserves its world anchor and a zoom round trip preserves the camera", () => {
  const camera = { x: 13, y: -97, z: 0.8 },
    point = { x: 319, y: 450 };
  const next = core.zoomAt(camera, 1.25, point);
  const back = core.zoomAt(next, 0.8, point);
  assert.ok(
    Math.abs((point.x - next.x) / next.z - (point.x - camera.x) / camera.z) <
      1e-9,
  );
  assert.ok(Math.abs(back.x - camera.x) < 1e-9);
  assert.ok(Math.abs(back.y - camera.y) < 1e-9);
});
test("fit includes large boards on phones instead of imposing a minimum desktop zoom", () => {
  const n = [{ x: -300, y: 200, w: 2000, h: 1000 }];
  const c = core.fit(n, 390, 550);
  assert.ok(c.z < 0.2);
  assert.ok(c.x + n[0].x * c.z >= 39);
  assert.ok(c.x + (n[0].x + n[0].w) * c.z <= 351);
});
test("hex alpha, RGB and HSV survive conversion without corrupt color values", () => {
  assert.deepEqual(core.color("#abc8"), { hex: "#AABBCC", alpha: 136 / 255 });
  assert.equal(core.color("transparent"), null);
  assert.equal(core.fromRGB([256, -4, 128]), "#FF0080");
  for (const c of [
    "#FF0000",
    "#FFE299",
    "#874FFF",
    "#123456",
    "#FFFFFF",
    "#000000",
  ])
    assert.equal(core.fromHSV(core.hsv(c)), c);
});
test("appearance changes preserve native colors, other metadata and locked objects", () => {
  const d = day();
  d.canvas.board4.locked = ["b:a"];
  const next = core.setStyle(d, nodes(), { fill: "#23456780", opacity: 0.3 });
  assert.equal(next.blocks[0].color, undefined);
  assert.equal(next.notes[0].color, "#234567");
  assert.equal(next.canvas.board4.styles["sticky:n"].width, 300);
  assert.equal(next.canvas.board4.styles["sticky:n"].opacity, 128 / 255);
  assert.equal(d.notes[0].color, "#FFE299");
  assert.equal(core.setStyle(d, [nodes()[3]], { fill: "invalid" }), d);
});
test("appearance reset clears persisted overrides but keeps dimensions and connections", () => {
  const d = day();
  const next = core.setStyle(d, [nodes()[3]], { fill: null, opacity: null });
  assert.equal(next.notes[0].color, "#FFE299");
  assert.equal(next.canvas.board4.styles["sticky:n"].width, 300);
  assert.deepEqual(next.canvas.board4.links, d.canvas.board4.links);
});
test("alignment and distribution use object bounds and equal gaps", () => {
  const n = [
    { id: "a", x: 0, y: 0, w: 20, h: 30 },
    { id: "b", x: 40, y: 40, w: 40, h: 10 },
    { id: "c", x: 200, y: 80, w: 60, h: 20 },
  ];
  assert.deepEqual(
    Object.values(core.arrange(n, "right")).map((p) => p.x),
    [240, 220, 200],
  );
  const p = core.arrange(n, "distribute-x");
  assert.equal(p.b.x - (p.a.x + 20), p.c.x - (p.b.x + 40));
  assert.deepEqual(core.arrange(n.slice(0, 2), "distribute-x"), {});
});
test("smart guides use a fixed screen-space threshold across zoom levels", () => {
  const n = [
    { id: "a", x: 0, y: 0, w: 20, h: 20 },
    { id: "b", x: 100, y: 100, w: 20, h: 20 },
  ];
  const a = core.guides(n, ["a"], { a: { x: 0, y: 0 } }, { x: 77, y: 40 }, 1);
  assert.equal(a.x, 80);
  assert.ok(a.lines.some((l) => l.axis === "x"));
  assert.equal(
    core.guides(n, ["a"], { a: { x: 0, y: 0 } }, { x: 77, y: 40 }, 2).x,
    77,
  );
});
test("one-step layer order preserves relative order of multiple selected objects", () => {
  const d = day();
  d.canvas.board4.stack = ["a", "b", "c", "d"];
  assert.deepEqual(
    core.reorder(d, ["a", "b", "c", "d"], new Set(["b", "c"]), "forward").canvas
      .board4.stack,
    ["a", "d", "b", "c"],
  );
  assert.deepEqual(
    core.reorder(d, ["a", "b", "c", "d"], new Set(["b", "c"]), "back").canvas
      .board4.stack,
    ["b", "c", "a", "d"],
  );
});
test("copy skips selected descendants even when traversal lists children before parents", () => {
  const d = day(),
    n = nodes();
  const payload = core.copy(d, n, [], new Set(["sub:a:s", "sub:a:nested"]));
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].data.name, "Step");
  assert.equal(payload.items[0].data.subtasks.length, 1);
  assert.equal(
    core.copy(d, n, [], new Set(["b:a", "sub:a:s", "sub:a:nested"])).items
      .length,
    1,
  );
});
test("paste generates independent recursive IDs and keeps styles, links, position and completion", () => {
  const d = day(),
    n = nodes();
  const payload = core.copy(
    d,
    n,
    d.canvas.board4.links,
    new Set(["b:a", "sticky:n", "bug:f"]),
  );
  let id = 0;
  const pasted = core.paste(d, payload, { x: 500, y: 600 }, "mindmap", () =>
    String(++id),
  );
  assert.equal(pasted.refs.length, 3);
  assert.equal(d.blocks.length, 1);
  assert.equal(pasted.day.blocks.length, 2);
  assert.equal(pasted.day.blocks[1].done, true);
  assert.notEqual(pasted.day.blocks[1].subtasks[0].id, "s");
  assert.equal(pasted.day.canvas.board4.styles["sub:1:2"].textSize, 18);
  assert.equal(pasted.day.notes[1].x, 500);
  assert.equal(pasted.day.canvas.board4.links[1].from, "b:1");
  assert.equal(pasted.day.bugs[1].blockId, "1");
  assert.equal(pasted.day.canvas.board4.links[1].bend.x, 590);
  assert.equal(pasted.day.canvas.board4.layouts.mindmap["sub:1:2"].x, 640);
  assert.ok(
    Object.values(pasted.day.canvas.board4.groups).some(
      (refs) => refs.includes("b:1") && refs.includes("sticky:4"),
    ),
  );
});
test("malformed clipboard payloads are no-ops", () => {
  const d = day();
  for (const payload of [
    null,
    {},
    {
      version: 1,
      items: [{ kind: "block", ref: "__proto__", data: {}, x: 0, y: 0 }],
    },
    {
      version: 1,
      items: [
        {
          kind: "block",
          ref: "b:a",
          data: { id: "a", name: "A", subtasks: "oops" },
          x: 0,
          y: 0,
        },
      ],
    },
  ])
    assert.equal(core.paste(d, payload, { x: 0, y: 0 }, "mindmap").day, d);
});
test("deleting a parent clears descendant metadata and leaves linked feelings intact", () => {
  const d = day(),
    next = core.remove(d, [nodes()[2]]);
  assert.equal(next.blocks.length, 0);
  assert.equal(next.bugs.length, 1);
  assert.deepEqual(next.canvas.board4.links, []);
  assert.equal(next.canvas.board4.styles["b:a"], undefined);
  assert.equal(next.canvas.board4.styles["sub:a:s"], undefined);
  assert.deepEqual(next.canvas.board4.hidden, []);
  assert.deepEqual(next.canvas.board4.overrides, {});
  assert.equal(d.blocks.length, 1);
});
test("locked object removal and placement are no-ops", () => {
  const d = day();
  d.canvas.board4.locked = ["sticky:n"];
  assert.equal(core.remove(d, [nodes()[3]]), d);
  assert.equal(
    core.place(d, [nodes()[3]], { "sticky:n": { x: 50, y: 50 } }, "mindmap"),
    d,
  );
});
