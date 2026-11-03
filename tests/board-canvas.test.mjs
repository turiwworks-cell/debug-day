import { test } from "node:test";
import assert from "node:assert/strict";
import { DDzoomKey, DDinstallZoomLock } from "../public/board-experience.js";
import { DDconnectionGeometry } from "../public/connections.js";

const key = (k, extra = {}) => ({ key: k, code: "", ctrlKey: true, ...extra });

test("Ctrl/Cmd with + = - 0 is the Board's zoom; other keys pass through", () => {
  assert.equal(DDzoomKey(key("=")), 1);
  assert.equal(DDzoomKey(key("+", { shiftKey: true })), 1);
  assert.equal(DDzoomKey(key("-")), -1);
  assert.equal(DDzoomKey(key("0")), 0);
  assert.equal(DDzoomKey({ key: "=", metaKey: true }), 1, "Cmd on a Mac");
  // A Persian keyboard still sends the physical keys.
  assert.equal(DDzoomKey(key("۰", { code: "Digit0" })), 0);
  assert.equal(DDzoomKey(key("+", { code: "NumpadAdd" })), 1);
  assert.equal(DDzoomKey(key("-", { code: "NumpadSubtract" })), -1);
  assert.equal(DDzoomKey({ key: "=", ctrlKey: false }), null, "no modifier, no zoom");
  assert.equal(DDzoomKey(key("=", { altKey: true })), null);
  assert.equal(DDzoomKey(key("b")), null, "Ctrl+B stays bold");
  assert.equal(DDzoomKey(key("9", { shiftKey: true, code: "Digit9" })), null, "Ctrl+Shift+9 stays the to-do");
});

test("the zoom lock blocks the browser's zoom and tells the Board once", () => {
  const listeners = {}, sent = [];
  const target = {
    addEventListener: (type, fn) => (listeners[type] = (listeners[type] || []).concat(fn)),
    dispatchEvent: (event) => sent.push(event),
  };
  DDinstallZoomLock(target);
  DDinstallZoomLock(target);
  assert.equal(listeners.keydown.length, 1, "installed once");
  let prevented = false;
  listeners.keydown[0]({ ...key("="), preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  assert.equal(sent.at(-1).detail, 1);
  prevented = false;
  listeners.keydown[0]({ ...key("b"), preventDefault: () => (prevented = true) });
  assert.equal(prevented, false, "other shortcuts are left alone");
  let wheel = false;
  listeners.wheel[0]({ ctrlKey: true, preventDefault: () => (wheel = true) });
  assert.equal(wheel, true, "Ctrl+wheel never zooms the page");
  wheel = false;
  listeners.wheel[0]({ ctrlKey: false, preventDefault: () => (wheel = true) });
  assert.equal(wheel, false, "a plain wheel still scrolls");
});

test("elbow connectors have rounded corners and stay finite", () => {
  const a = { id: "a", x: 0, y: 0, w: 200, h: 120 },
    b = { id: "b", x: 500, y: 300, w: 200, h: 120 };
  const g = DDconnectionGeometry(a, b, { style: "elbow" });
  assert.match(g.d, /Q/, "each bend is a soft curve");
  assert.ok(g.points.every((p, i) => !i || p.x === g.points[i - 1].x || p.y === g.points[i - 1].y), "every run is straight across or down");
  const bent = DDconnectionGeometry(a, b, { style: "elbow", bend: { x: 350, y: 200 } });
  assert.match(bent.d, /Q/, "a dragged bend is rounded too");
  assert.ok(!/NaN|Infinity/.test(bent.d));
  // Lined-up cards get a straight line, with nothing to round.
  const level = DDconnectionGeometry(a, { ...b, y: 0 }, { style: "elbow" });
  assert.doesNotMatch(level.d, /Q/);
  // Points that land on each other never make a broken path.
  for (let i = 0; i < 400; i++) {
    const g2 = DDconnectionGeometry(a, { ...b, x: Math.sin(i * 0.07) * 800, y: Math.cos(i * 0.09) * 600 }, { style: "elbow", bend: i % 3 ? undefined : { x: i, y: -i } });
    assert.ok(!/NaN|Infinity/.test(g2.d), "finite at " + i);
  }
});

test("an elbow's handle sits on its middle run and moves it only along the free way", () => {
  const a = { id: "a", x: 0, y: 0, w: 100, h: 100 }, b = { id: "b", x: 400, y: 300, w: 100, h: 100 };
  const g = DDconnectionGeometry(a, b, { style: "elbow", bend: { x: 250, y: -500 } });
  assert.equal(g.axis, "x", "left/right ends: the middle run moves sideways");
  assert.deepEqual(g.mid, { x: 250, y: (g.p.y + g.q.y) / 2 }, "the handle is on the run, not where the pointer let go");
  const same = DDconnectionGeometry(a, b, { style: "elbow", bend: { x: 250, y: 900 } });
  assert.equal(same.d, g.d, "dragging across the run changes nothing");
  // Ends lined up one above the other: the run would have no length, so it moves sideways.
  const lined = DDconnectionGeometry(a, { ...b, x: 0 }, { style: "elbow", bend: { x: 300, y: 200 } });
  assert.equal(lined.axis, "x");
  assert.match(lined.d, /300/, "the line goes round through the handle");
});

test("an elbow line between two notes inside sections stays inside them", () => {
  const outer = { id: "o", kind: "life-section", x: 0, y: 0, w: 1400, h: 1100 },
    studio = { id: "s", kind: "life-section", x: 100, y: 200, w: 700, h: 500 },
    one = { id: "n", kind: "sticky", x: 400, y: 260, w: 120, h: 110 },
    two = { id: "m", kind: "sticky", x: 200, y: 400, w: 120, h: 110 };
  const g = DDconnectionGeometry(one, two, { style: "elbow" }, [outer, studio, one, two]);
  for (const p of g.points) {
    assert.ok(p.x >= studio.x && p.x <= studio.x + studio.w && p.y >= studio.y && p.y <= studio.y + studio.h, "inside the section: " + JSON.stringify(p));
  }
  // Even if the frames came in with another kind, a frame that holds a note is never in the way.
  const plain = DDconnectionGeometry(one, two, { style: "elbow" }, [{ ...outer, kind: "box" }, { ...studio, kind: "box" }, one, two]);
  assert.equal(plain.d, g.d);
});
