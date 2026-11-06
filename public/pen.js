// Pen (5.36): draw freehand on the board with a mouse, a pen or a finger.
// A stroke is a board object: select it, move it, delete it, undo it.
// Where a stroke lives:
//   - drawn inside a section, it belongs to that section (setup.life.strokes,
//     with `parent` and points relative to the section), so it moves with the
//     section and shows on every day, like the section's notes;
//   - anywhere else it belongs to the day (day.canvas.board4.strokes, board points).
// Points are saved simplified, as one short text of tenths ("x,y dx,dy dx,dy"),
// so a drawing stays small and sync stays light.

export const DDpenColors = ["#1E1E1E", "#F24822", "#FFA629", "#14AE5C", "#0D99FF", "#9747FF"];
export const DDpenWidths = [2, 4, 8];
const MAX_POINTS = 1500, MAX_STROKES = 600;
const num = (v, d = 0) => (Number.isFinite(v) ? Math.max(-1e5, Math.min(1e5, v)) : d);

// [x0, y0, x1, y1, ...] → "x0,y0 dx,dy …" in tenths, exact both ways.
export function DDstrokeEncode(points) {
  const out = [];
  let px = 0, py = 0;
  for (let i = 0; i + 1 < points.length && out.length < MAX_POINTS; i += 2) {
    const x = Math.round(num(points[i]) * 10), y = Math.round(num(points[i + 1]) * 10);
    out.push(out.length ? (x - px) / 10 + "," + (y - py) / 10 : x / 10 + "," + y / 10);
    px = x; py = y;
  }
  return out.join(" ");
}
export function DDstrokeDecode(text) {
  if (typeof text !== "string" || !text) return [];
  const out = [];
  let x = 0, y = 0;
  for (const pair of text.trim().split(/\s+/).slice(0, MAX_POINTS)) {
    const [a, b] = pair.split(",").map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    x += Math.round(a * 10); y += Math.round(b * 10);
    if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return [];
    out.push(x / 10, y / 10);
  }
  return out;
}

// Keep only valid strokes. In the Feed (`life`), each stroke names its section.
export function DDnormalizeStrokes(list, { life = false } = {}) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const s of list) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || !s.id || s.id.length > 80 || seen.has(s.id)) continue;
    const points = DDstrokeDecode(s.pts);
    if (points.length < 2) continue;
    seen.add(s.id);
    out.push({
      id: s.id,
      ...(life ? { parent: typeof s.parent === "string" ? s.parent.slice(0, 80) : "" } : {}),
      pts: DDstrokeEncode(points),
      color: typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : DDpenColors[0],
      width: DDpenWidths.includes(s.width) ? s.width : DDpenWidths.reduce((a, b) => (Math.abs(b - (s.width || 4)) < Math.abs(a - (s.width || 4)) ? b : a)),
    });
    if (out.length >= MAX_STROKES) break;
  }
  return out;
}

// Fewer points, same line (Ramer–Douglas–Peucker). `tolerance` is in board units.
export function DDsimplifyStroke(points, tolerance = 0.6) {
  const n = points.length / 2;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]], t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = points[a * 2], ay = points[a * 2 + 1], bx = points[b * 2], by = points[b * 2 + 1];
    let far = -1, best = t2;
    for (let i = a + 1; i < b; i++) {
      const d = segment2(points[i * 2], points[i * 2 + 1], ax, ay, bx, by);
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  return out;
}
function segment2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return x * x + y * y;
}
// How close a point comes to a stroke.
export function DDstrokeDistance(points, x, y) {
  if (points.length < 4) return Math.hypot(points[0] - x, points[1] - y);
  let best = Infinity;
  for (let i = 2; i < points.length; i += 2) best = Math.min(best, segment2(x, y, points[i - 2], points[i - 1], points[i], points[i + 1]));
  return Math.sqrt(best);
}
// A still stroke keeps its path while its points stay the same (a click on the
// board no longer rebuilds every drawing).
const paths = new WeakMap();
function pathOf(points) {
  let d = paths.get(points);
  if (d === undefined) paths.set(points, (d = DDstrokePath(points)));
  return d;
}
// A smooth path through the points (curves through the midpoints). Vector, so it
// stays sharp at any zoom.
export function DDstrokePath(points, dx = 0, dy = 0) {
  const r = (v) => Math.round(v * 10) / 10;
  const n = points.length / 2;
  if (!n) return "";
  const x = (i) => r(points[i * 2] + dx), y = (i) => r(points[i * 2 + 1] + dy);
  if (n === 1 || (n === 2 && points[0] === points[2] && points[1] === points[3])) return `M${x(0)} ${y(0)}h0.01`;
  if (n === 2) return `M${x(0)} ${y(0)}L${x(1)} ${y(1)}`;
  let d = `M${x(0)} ${y(0)}`;
  for (let i = 1; i < n - 1; i++) d += `Q${x(i)} ${y(i)} ${r((points[i * 2] + points[i * 2 + 2]) / 2 + dx)} ${r((points[i * 2 + 1] + points[i * 2 + 3]) / 2 + dy)}`;
  return d + `L${x(n - 1)} ${y(n - 1)}`;
}
export function DDstrokeBox(points) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    x1 = Math.min(x1, points[i]); x2 = Math.max(x2, points[i]);
    y1 = Math.min(y1, points[i + 1]); y2 = Math.max(y2, points[i + 1]);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// Who owns a spot on the board: the deepest open section under it, the open
// section's own board, or the day (Mind map only; Lanes places day things itself).
// Returns { life, parent, x, y } (x, y: the owner's corner) or null.
export function DDmarkOwner(layout, point, mode = "mindmap") {
  let best = null;
  for (const n of layout?.nodes || [])
    if (n.lifeSection && !n.collapsed && point.x >= n.x && point.x <= n.x + n.w && point.y >= n.y && point.y <= n.y + n.h && (!best || n.stack > best.stack)) best = n;
  if (best) return { life: true, parent: best.lifeId, x: best.x, y: best.y };
  if (layout?.room) {
    const room = layout.map.get("life:" + layout.room);
    return room ? { life: true, parent: layout.room, x: room.x, y: room.y } : null;
  }
  return mode === "mindmap" ? { life: false, parent: "", x: 0, y: 0 } : null;
}
// Where a Feed thing's coordinates start on this board, or null when it is not
// drawn here (its section is folded, hidden, or the thing sits outside the
// section's frame on a board that is not that section's own).
export function DDmarkOrigin(layout, parent, lifeHead, center) {
  if (parent) {
    const n = layout?.map.get("life:" + parent);
    if (!n || n.collapsed) return null;
    if (center && layout.room !== parent && (center.x < 0 || center.y < 0 || center.x > n.w || center.y > n.h)) return null;
    return { x: n.x, y: n.y };
  }
  if (layout?.room) return null;
  const lf = layout?.map.get("section:life");
  return lf ? { x: lf.x, y: lf.y + lifeHead } : null;
}

// A section went away. If its contents stayed (Remove section, keep contents),
// its strokes and comments stay too, in the same place on the board, under the
// nearest section that is left. If its contents were deleted with it, they go too.
export function DDmarksRebase(before, after) {
  if (!before?.items || !after?.items || (!after.strokes?.length && !after.comments?.length)) return after;
  const old = new Map(before.items.map((i) => [i.id, i])), now = new Set(after.items.map((i) => i.id));
  if ([...old.keys()].every((id) => now.has(id))) return after;
  const kept = (s) => !before.items.some((i) => i.parent === s.id) || before.items.some((i) => i.parent === s.id && now.has(i.id));
  const lift = (mark) => {
    let p = mark.parent || "", dx = 0, dy = 0, hops = 0;
    if (!p || now.has(p)) return mark;
    while (p && !now.has(p) && hops++ < 60) {
      const s = old.get(p);
      if (!s) return { ...mark, parent: "" };
      if (!kept(s)) return null;
      dx += s.x; dy += s.y; p = s.parent || "";
    }
    if (mark.pts !== undefined) {
      const pts = DDstrokeDecode(mark.pts);
      for (let i = 0; i < pts.length; i += 2) { pts[i] += dx; pts[i + 1] += dy; }
      return { ...mark, parent: p, pts: DDstrokeEncode(pts) };
    }
    return { ...mark, parent: p, x: (mark.x || 0) + dx, y: (mark.y || 0) + dy };
  };
  const next = { ...after };
  if (after.strokes?.length) next.strokes = after.strokes.map(lift).filter(Boolean);
  if (after.comments?.length) next.comments = after.comments.map((c) => (c.on ? c : lift(c))).filter(Boolean);
  return next;
}

// Read and write the two homes of strokes inside a board commit.
function dayList(d) {
  return DDnormalizeStrokes(d.canvas?.board4?.strokes);
}
function setDayList(d, list) {
  const board = { ...(d.canvas?.board4 || {}) };
  if (list.length) board.strokes = list;
  else delete board.strokes;
  d.canvas = { ...(d.canvas || {}), board4: board };
}
function setLifeList(d, list) {
  if (list.length) d.__life.strokes = list;
  else delete d.__life.strokes;
}
const keyOf = (s) => (s.life ? "L:" : "D:") + s.id;
const prefsKey = "debug-day:pen";
function readPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(prefsKey) || "null");
    return { color: DDpenColors.includes(v?.color) ? v.color : DDpenColors[0], width: DDpenWidths.includes(v?.width) ? v.width : 4 };
  } catch { return { color: DDpenColors[0], width: 4 }; }
}
// The darkest ink follows the theme, so it reads on a dark board too.
const inkColor = (c) => (c === DDpenColors[0] ? "var(--ink,#1E1E1E)" : c);
const colorNames = { "#1E1E1E": "Ink", "#F24822": "Red", "#FFA629": "Orange", "#14AE5C": "Green", "#0D99FF": "Blue", "#9747FF": "Violet" };

// The pen on a board. `ctx` comes from the board: data, layout, the camera and commit.
export function DDusePen(ctx) {
  const R = ctx.React, h = R.createElement;
  const [opts, setOpts] = R.useState(readPrefs),
    [eraser, setEraser] = R.useState(false),
    [sel, setSel] = R.useState(() => new Set()),
    [erasing, setErasing] = R.useState(() => new Set()),
    [drag, setDrag] = R.useState(null),
    draft = R.useRef(null), drawing = R.useRef(null), raf = R.useRef(0), shownRef = R.useRef([]), ctxRef = R.useRef(ctx);
  ctxRef.current = ctx;
  const active = ctx.tool === "pen";
  R.useEffect(() => { if (!active) setEraser(false); }, [active]);
  R.useEffect(() => { try { localStorage.setItem(prefsKey, JSON.stringify(opts)); } catch {} }, [opts]);
  // A card or line picked on the board takes over the selection.
  R.useEffect(() => { if (ctx.selected.size && sel.size) setSel(new Set()); }, [ctx.selected]);
  const board4 = ctx.day.canvas?.board4, lifeStrokes = ctx.setup.life?.strokes;
  const shown = R.useMemo(() => {
    const out = [];
    if (ctx.mode === "mindmap" && !ctx.layout.room)
      for (const s of DDnormalizeStrokes(board4?.strokes)) {
        const points = DDstrokeDecode(s.pts);
        out.push({ ...s, life: false, points, box: DDstrokeBox(points) });
      }
    for (const s of DDnormalizeStrokes(lifeStrokes, { life: true })) {
      const rel = DDstrokeDecode(s.pts), b = DDstrokeBox(rel),
        origin = DDmarkOrigin(ctx.layout, s.parent, ctx.lifeHead, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
      if (!origin) continue;
      const points = rel.map((v, i) => v + (i % 2 ? origin.y : origin.x));
      out.push({ ...s, life: true, points, box: DDstrokeBox(points), origin });
    }
    return out;
  }, [board4?.strokes, lifeStrokes, ctx.layout, ctx.mode]);
  shownRef.current = shown;
  // Strokes that vanish (undo, another device) leave the selection.
  R.useEffect(() => {
    const keys = new Set(shown.map(keyOf));
    if ([...sel].some((k) => !keys.has(k))) setSel(new Set([...sel].filter((k) => keys.has(k))));
  }, [shown]);

  // Write strokes: `change(day, life)` returns the new lists.
  function write(change, message) {
    ctxRef.current.commit((d) => {
      const [nextDay, nextLife] = change(dayList(d), DDnormalizeStrokes(d.__life.strokes, { life: true }));
      setDayList(d, nextDay);
      setLifeList(d, nextLife);
      return d;
    }, message);
  }
  // A stroke in board points, placed with its new owner.
  function home(points, extra) {
    const c = ctxRef.current, b = DDstrokeBox(points), owner = DDmarkOwner(c.layout, { x: b.x + b.w / 2, y: b.y + b.h / 2 }, c.mode);
    if (!owner) return null;
    const pts = DDstrokeEncode(owner.life ? points.map((v, i) => v - (i % 2 ? owner.y : owner.x)) : points);
    return { life: owner.life, stroke: { ...extra, ...(owner.life ? { parent: owner.parent } : {}), pts } };
  }
  function addStroke(points) {
    const c = ctxRef.current, placed = home(points, { id: "ink-" + Math.random().toString(36).slice(2, 10), color: opts.color, width: opts.width });
    if (!placed) {
      c.setStatus("In Lanes, draw inside a section, or switch to the Mind map");
      return;
    }
    write((day, life) => (placed.life ? [day, [...life, placed.stroke]] : [[...day, placed.stroke], life]), null);
  }
  function removeKeys(keys, message) {
    if (!keys.size) return;
    write((day, life) => [day.filter((s) => !keys.has("D:" + s.id)), life.filter((s) => !keys.has("L:" + s.id))], message);
  }
  function moveKeys(keys, dx, dy) {
    const moved = shownRef.current.filter((s) => keys.has(keyOf(s))).map((s) => ({ s, placed: home(s.points.map((v, i) => v + (i % 2 ? dy : dx)), { id: s.id, color: s.color, width: s.width }) })).filter((m) => m.placed);
    if (!moved.length) return;
    write((day, life) => {
      const gone = new Set(moved.map((m) => keyOf(m.s)));
      day = day.filter((s) => !gone.has("D:" + s.id));
      life = life.filter((s) => !gone.has("L:" + s.id));
      for (const m of moved) (m.placed.life ? life : day).push(m.placed.stroke);
      return [day, life];
    }, "Drawing moved");
    setSel(new Set(moved.map((m) => (m.placed.life ? "L:" : "D:") + m.s.id)));
  }
  function restyle(patch) {
    write((day, life) => [day.map((s) => (sel.has("D:" + s.id) ? { ...s, ...patch } : s)), life.map((s) => (sel.has("L:" + s.id) ? { ...s, ...patch } : s))], null);
  }
  function pick(patch) {
    setOpts((o) => ({ ...o, ...patch }));
    setEraser(false);
    if (sel.size) restyle(patch);
  }

  // Delete / Backspace remove the picked strokes; Esc lets go.
  R.useEffect(() => {
    if (!sel.size) return;
    const key = (e) => {
      if (e.isComposing || e.target?.closest?.("input,textarea,select,[contenteditable=true]")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); e.stopImmediatePropagation();
        removeKeys(sel, sel.size > 1 ? "Drawings deleted · Undo to restore" : "Drawing deleted · Undo to restore");
        setSel(new Set());
      } else if (e.key === "Escape") setSel(new Set());
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [sel, shown]);
  // A click on empty board lets go of the picked strokes.
  R.useEffect(() => {
    const el = ctx.viewport.current;
    if (!el || !sel.size) return;
    const down = (e) => { if (!e.target.closest?.("[data-stroke-id],.dd-pen-bar")) setSel(new Set()); };
    el.addEventListener("pointerdown", down, true);
    return () => el.removeEventListener("pointerdown", down, true);
  }, [sel]);

  function paintDraft() {
    raf.current = 0;
    const g = drawing.current;
    if (!g || !draft.current) return;
    if (g.erase) return;
    draft.current.setAttribute("d", DDstrokePath(g.points));
  }
  function erasePoint(p, last) {
    const z = ctxRef.current.getCamera().z, r = 9 / z, hit = new Set(drawing.current.hit);
    const steps = last ? Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / (r / 2))) : 1;
    for (let k = 1; k <= steps; k++) {
      const x = last ? last.x + ((p.x - last.x) * k) / steps : p.x, y = last ? last.y + ((p.y - last.y) * k) / steps : p.y;
      for (const s of shownRef.current) {
        const key = keyOf(s), pad = r + s.width / 2;
        if (hit.has(key) || x < s.box.x - pad || x > s.box.x + s.box.w + pad || y < s.box.y - pad || y > s.box.y + s.box.h + pad) continue;
        if (DDstrokeDistance(s.points, x, y) <= pad) hit.add(key);
      }
    }
    if (hit.size !== drawing.current.hit.size) { drawing.current.hit = hit; setErasing(new Set(hit)); }
  }
  // The pen's own layer over the board: it takes the pointer while the pen is on.
  // A second finger hands the gesture to the board (pinch and two-finger pan).
  function down(e) {
    const c = ctxRef.current;
    if (c.pinching() || c.panKey() || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault(); e.stopPropagation();
    c.finishEdit?.(); c.setMenu?.(null);
    const p = c.toWorld(e.clientX, e.clientY);
    drawing.current = { id: e.pointerId, erase: eraser, points: [p.x, p.y], last: p, hit: new Set() };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (eraser) erasePoint(p);
    else if (draft.current) {
      draft.current.style.display = "";
      draft.current.setAttribute("stroke", inkColor(opts.color));
      draft.current.setAttribute("stroke-width", opts.width);
      paintDraft();
    }
  }
  function move(e) {
    const g = drawing.current, c = ctxRef.current;
    if (!g || g.id !== e.pointerId) return;
    if (c.pinching()) return cancel();
    const z = c.getCamera().z;
    for (const ev of e.nativeEvent.getCoalescedEvents?.() || [e]) {
      const raw = c.toWorld(ev.clientX, ev.clientY);
      if (g.erase) { erasePoint(raw, g.last); g.last = raw; continue; }
      if (Math.hypot(raw.x - g.last.x, raw.y - g.last.y) < 0.75 / z) continue;
      // A little steadiness for a shaky mouse, without lagging behind the hand.
      const p = { x: g.last.x + (raw.x - g.last.x) * 0.65, y: g.last.y + (raw.y - g.last.y) * 0.65 };
      g.points.push(p.x, p.y); g.last = p; g.raw = raw;
    }
    if (!g.erase && !raf.current) raf.current = requestAnimationFrame(paintDraft);
  }
  function cancel() {
    drawing.current = null;
    if (draft.current) draft.current.style.display = "none";
    setErasing(new Set());
  }
  function up(e) {
    const g = drawing.current;
    if (!g || g.id !== e.pointerId) return;
    e.stopPropagation();
    drawing.current = null;
    if (draft.current) { draft.current.style.display = "none"; draft.current.removeAttribute("d"); }
    if (g.erase) {
      removeKeys(g.hit, g.hit.size ? (g.hit.size > 1 ? g.hit.size + " drawings erased" : "Drawing erased") : null);
      setErasing(new Set());
      return;
    }
    if (g.raw) g.points.push(g.raw.x, g.raw.y);
    if (g.points.length === 2) g.points.push(g.points[0], g.points[1]);
    addStroke(DDsimplifyStroke(g.points, 0.7 / ctxRef.current.getCamera().z));
  }

  // Select tool: press a stroke to pick it, drag to move it.
  function strokeDown(e, s) {
    const c = ctxRef.current;
    if (c.tool !== "select" || c.pinching() || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation(); e.preventDefault();
    c.finishEdit?.(); c.setMenu?.(null);
    const key = keyOf(s), next = e.shiftKey ? new Set(sel) : sel.has(key) ? new Set(sel) : new Set([key]);
    if (e.shiftKey && sel.has(key)) next.delete(key); else next.add(key);
    c.clearBoardSelection();
    setSel(next);
    c.viewport.current?.focus({ preventScroll: true });
    if (e.shiftKey && !next.has(key)) return;
    const start = { x: e.clientX, y: e.clientY }, id = e.pointerId;
    let moved = false, last = null;
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      if (ctxRef.current.pinching()) { stop(); setDrag(null); return; }
      const z = ctxRef.current.getCamera().z, dx = (ev.clientX - start.x) / z, dy = (ev.clientY - start.y) / z;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      moved = true; last = { dx, dy };
      setDrag({ keys: next, dx, dy });
    };
    const stop = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); };
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      stop(); setDrag(null);
      if (moved && last && ev.type !== "pointercancel") moveKeys(next, last.dx, last.dy);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  const z = ctx.getCamera().z, selectable = ctx.tool === "select";
  const picked = shown.filter((s) => sel.has(keyOf(s)));
  return {
    selection: picked,
    hasSelection: picked.length > 0,
    clear: () => setSel(new Set()),
    deleteSelection: () => { removeKeys(sel, "Drawing deleted · Undo to restore"); setSel(new Set()); },
    // Inside the board's world: the strokes, the picked boxes and the stroke being drawn.
    world: () => h("svg", { className: "dd-ink", "data-ink-select": selectable || undefined, "aria-label": "Drawings" },
      shown.map((s) => {
        const key = keyOf(s), d = drag?.keys.has(key) ? drag : null;
        if (erasing.has(key)) return null;
        const path = d ? DDstrokePath(s.points, d.dx, d.dy) : pathOf(s.points);
        return h("g", { key, "data-stroke-id": s.id, "data-stroke-home": s.life ? "feed" : "day", className: sel.has(key) ? "selected" : undefined },
          h("path", { d: path, className: "dd-ink-hit", onPointerDown: (e) => strokeDown(e, s), onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); if (!sel.has(key)) { ctxRef.current.clearBoardSelection(); setSel(new Set([key])); } } }),
          h("path", { d: path, className: "dd-ink-line", stroke: inkColor(s.color), strokeWidth: s.width }));
      }),
      picked.length > 0 && (() => {
        const b = picked.map((s) => s.box).reduce((a, c) => ({ x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), x2: Math.max(a.x2, c.x + c.w), y2: Math.max(a.y2, c.y + c.h) }), { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity }),
          pad = 6 / z + Math.max(...picked.map((s) => s.width)) / 2;
        return h("rect", { className: "dd-ink-box", x: b.x - pad + (drag?.dx || 0), y: b.y - pad + (drag?.dy || 0), width: b.x2 - b.x + pad * 2, height: b.y2 - b.y + pad * 2 });
      })(),
      h("path", { ref: draft, className: "dd-ink-line dd-ink-draft", style: { display: "none" } })),
    // Over the board while the pen is on: it takes the pointer for drawing.
    capture: () => active && h("div", { className: "dd-ink-capture", "data-eraser": eraser || undefined, "aria-hidden": true,
      onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: cancel, onLostPointerCapture: (e) => { if (drawing.current?.id === e.pointerId) up(e); },
      onContextMenu: (e) => e.preventDefault() }),
    // Colors, widths and the eraser while drawing; colors, widths and Delete for picked strokes.
    bar: () => (active || picked.length > 0) && h("div", { className: "dd-pen-bar", role: "toolbar", "aria-label": active ? "Pen" : "Drawing", onPointerDown: (e) => e.stopPropagation() },
      DDpenColors.map((c) => h("button", { type: "button", key: c, className: "dd-pen-color", style: { "--pen": inkColor(c) }, "aria-label": (colorNames[c] || c) + " pen", title: colorNames[c] || c,
        "aria-pressed": !eraser && (picked.length ? picked.every((s) => s.color === c) : opts.color === c), onClick: () => pick({ color: c }) })),
      h("span", { className: "dd-pen-sep" }),
      DDpenWidths.map((w, i) => h("button", { type: "button", key: w, className: "dd-pen-width", "aria-label": ["Thin", "Medium", "Thick"][i] + " line", title: ["Thin", "Medium", "Thick"][i],
        "aria-pressed": !eraser && (picked.length ? picked.every((s) => s.width === w) : opts.width === w), onClick: () => pick({ width: w }) }, h("span", { style: { height: Math.max(2, w * 0.9) + "px" } }))),
      active && h("span", { className: "dd-pen-sep" }),
      active && h("button", { type: "button", className: "dd-pen-eraser", "aria-label": "Eraser · removes a whole stroke", title: "Eraser · removes a whole stroke", "aria-pressed": eraser, onClick: () => setEraser((v) => !v) },
        h("svg", { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M7.5 16.5h9M3.8 12.2l7.7-7.7a1.8 1.8 0 012.5 0l2 2a1.8 1.8 0 010 2.5L9.5 15.5h-2z M7 9l4 4" }))),
      !active && picked.length > 0 && h("span", { className: "dd-pen-sep" }),
      !active && picked.length > 0 && h("button", { type: "button", className: "dd-pen-delete", "aria-label": "Delete drawing", title: "Delete · Delete key", onClick: () => { removeKeys(sel, "Drawing deleted · Undo to restore"); setSel(new Set()); } }, "Delete"),
      active && h("button", { type: "button", className: "dd-pen-done", onClick: () => ctxRef.current.setTool("select") }, "Done")),
  };
}

export const DDpenCSS = `
.dd-ink{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:800}
.dd-ink .dd-ink-line{fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.dd-ink .dd-ink-hit{fill:none;stroke:transparent;stroke-width:calc(16px * var(--b4-inverse,1));stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.dd-ink[data-ink-select] .dd-ink-hit{pointer-events:stroke;cursor:move}
.dd-ink g.selected .dd-ink-line{filter:drop-shadow(0 0 calc(1.5px * var(--b4-inverse,1)) var(--board-accent,#0D99FF))}
.dd-ink .dd-ink-box{fill:none;stroke:var(--board-accent,#0D99FF);stroke-width:1.2;stroke-dasharray:4 3;vector-effect:non-scaling-stroke;pointer-events:none}
.dd-ink-capture{position:absolute;inset:0;z-index:40;cursor:crosshair;touch-action:none}
.dd-ink-capture[data-eraser]{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='11' cy='11' r='9' fill='%23ffffff99' stroke='%23444' stroke-width='1.5'/%3E%3C/svg%3E") 11 11,cell}
.dd-pen-bar{position:absolute;z-index:66;left:50%;bottom:78px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:14px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);box-shadow:0 6px 24px #0002;max-width:calc(100% - 24px);overflow-x:auto;scrollbar-width:none}
.dd-pen-bar button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;place-items:center;min-width:30px;height:30px;border-radius:9px;color:var(--ink)}
.dd-pen-bar button:hover,.dd-pen-bar button:focus-visible{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.dd-pen-bar button[aria-pressed=true]{background:color-mix(in srgb,var(--board-accent,#0D99FF) 16%,var(--paper));box-shadow:inset 0 0 0 1.5px var(--board-accent,#0D99FF)}
.dd-pen-color::before{content:"";width:16px;height:16px;border-radius:50%;background:var(--pen);box-shadow:inset 0 0 0 1px #0002}
.dd-pen-width span{display:block;width:16px;border-radius:9px;background:currentColor}
.dd-pen-sep{width:1px;height:20px;background:var(--rule-2,#0002);margin:0 2px;flex:none}
.dd-pen-done,.dd-pen-delete{padding:0 10px!important;font:500 12px var(--sans)}
@media(max-width:700px){.dd-pen-bar{left:8px;right:8px;transform:none;bottom:70px;max-width:none;flex-wrap:wrap;justify-content:center;overflow:visible;row-gap:6px}.dd-pen-bar>.dd-pen-sep:first-of-type{flex-basis:100%;width:auto;height:0;margin:0}}
@media(pointer:coarse){.dd-pen-bar button{min-width:38px;height:38px}}
/* Pen and Comment joined the tools dock: on a phone it still fits in one row. */
@media(max-width:700px){.b6 .b2-dock[data-dock=tools]>.b2-icon{min-width:31px;padding:6px 4px}.b6 .b2-dock[data-dock=tools]>.b2-sep{display:none}}
`;
