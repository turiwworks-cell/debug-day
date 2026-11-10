// Pen (5.36, upgraded in 5.49): draw freehand or straight lines (Shift) on the
// board with a mouse, a pen or a finger.
// A stroke is a board object: select one or many (click, Shift+click, marquee,
// Ctrl+A), move or resize via its bounding box, recolor/restyle from the toolbar
// or the side Properties panel, erase point-by-point, delete, duplicate, undo.
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
    const opacity = Number.isFinite(s.opacity) ? Math.round(Math.max(0.05, Math.min(1, s.opacity)) * 100) / 100 : 1;
    out.push({
      id: s.id,
      ...(life ? { parent: typeof s.parent === "string" ? s.parent.slice(0, 80) : "" } : {}),
      pts: DDstrokeEncode(points),
      color: typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : DDpenColors[0],
      width: DDpenWidths.includes(s.width) ? s.width : DDpenWidths.reduce((a, b) => (Math.abs(b - (s.width || 4)) < Math.abs(a - (s.width || 4)) ? b : a)),
      ...(opacity < 1 ? { opacity } : {}),
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

// Does a stroke touch or sit inside a rectangle `{ x, y, w, h }`?
export function DDstrokeInBox(points, box) {
  if (!box || points.length < 2) return false;
  const x1 = box.x, y1 = box.y, x2 = box.x + box.w, y2 = box.y + box.h;
  const sb = DDstrokeBox(points);
  if (sb.x + sb.w < x1 || sb.x > x2 || sb.y + sb.h < y1 || sb.y > y2) return false;
  for (let i = 0; i + 1 < points.length; i += 2) {
    if (points[i] >= x1 && points[i] <= x2 && points[i + 1] >= y1 && points[i + 1] <= y2) return true;
  }
  for (let i = 2; i + 1 < points.length; i += 2) {
    if (segmentHitsRect(points[i - 2], points[i - 1], points[i], points[i + 1], x1, y1, x2, y2)) return true;
  }
  return false;
}
function segmentHitsRect(ax, ay, bx, by, x1, y1, x2, y2) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const checks = [[-dx, ax - x1], [dx, x2 - ax], [-dy, ay - y1], [dy, y2 - ay]];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-8) { if (q < 0) return false; }
    else {
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return t0 <= t1;
}

// Point / partial eraser: removes only the portion of `points` inside circle `(cx, cy, r)`,
// splitting a stroke into two pieces when the eraser cuts through the middle.
export function DDeraseStrokeCircle(points, cx, cy, r) {
  if (!points || points.length < 2 || !(r > 0)) return [points];
  const b = DDstrokeBox(points);
  if (cx < b.x - r || cx > b.x + b.w + r || cy < b.y - r || cy > b.y + b.h + r) return [points];
  const r2 = r * r;
  const inside = (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2;
  const n = Math.floor(points.length / 2);
  if (n === 1 || (n === 2 && Math.hypot(points[2] - points[0], points[3] - points[1]) < 0.5)) {
    return inside(points[0], points[1]) ? [] : [points];
  }
  const pieces = [];
  let cur = [];
  if (!inside(points[0], points[1])) cur.push(points[0], points[1]);
  for (let i = 1; i < n; i++) {
    const ax = points[(i - 1) * 2], ay = points[(i - 1) * 2 + 1];
    const bx = points[i * 2], by = points[i * 2 + 1];
    const inA = inside(ax, ay), inB = inside(bx, by);
    const dx = bx - ax, dy = by - ay, a = dx * dx + dy * dy;
    if (a < 1e-6) {
      if (!inB && !cur.length) cur.push(bx, by);
      else if (inB && cur.length >= 4) { pieces.push(cur); cur = []; }
      else if (inB) cur = [];
      continue;
    }
    const fx = ax - cx, fy = ay - cy;
    const bq = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r2;
    const disc = bq * bq - 4 * a * c;
    if (!inA && !inB) {
      if (disc > 0) {
        const sq = Math.sqrt(disc), t1 = (-bq - sq) / (2 * a), t2 = (-bq + sq) / (2 * a);
        if (t1 > 0 && t2 < 1 && t1 < t2) {
          if (!cur.length) cur.push(ax, ay);
          cur.push(ax + t1 * dx, ay + t1 * dy);
          if (cur.length >= 4) pieces.push(cur);
          cur = [ax + t2 * dx, ay + t2 * dy, bx, by];
          continue;
        }
      }
      if (!cur.length) cur.push(ax, ay);
      cur.push(bx, by);
    } else if (!inA && inB) {
      const sq = Math.sqrt(Math.max(0, disc)), t1 = Math.max(0, Math.min(1, (-bq - sq) / (2 * a)));
      const px = ax + t1 * dx, py = ay + t1 * dy;
      if (!cur.length) cur.push(ax, ay);
      if (Math.hypot(px - cur[cur.length - 2], py - cur[cur.length - 1]) > 0.15) cur.push(px, py);
      if (cur.length >= 4) pieces.push(cur);
      cur = [];
    } else if (inA && !inB) {
      const sq = Math.sqrt(Math.max(0, disc)), t2 = Math.max(0, Math.min(1, (-bq + sq) / (2 * a)));
      const px = ax + t2 * dx, py = ay + t2 * dy;
      cur = Math.hypot(bx - px, by - py) > 0.15 ? [px, py, bx, by] : [bx, by];
    } else {
      if (cur.length >= 4) pieces.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 4) pieces.push(cur);
  return pieces.filter((pts) => {
    let len = 0;
    for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    return len >= 1.2;
  });
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

export function DDtransformPoints(points, tx) {
  if (!tx) return points;
  if (tx.scale) {
    const { ox, oy, sx, sy } = tx.scale;
    return points.map((v, i) => (i % 2 ? oy + (v - oy) * sy : ox + (v - ox) * sx));
  }
  const dx = tx.dx || 0, dy = tx.dy || 0;
  return dx || dy ? points.map((v, i) => v + (i % 2 ? dy : dx)) : points;
}

// Lock the initial direction, then project the pointer onto that ray.
export function DDlockedStrokeEnd(gesture, point, threshold = 6) {
  const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
  const length = Math.hypot(dx, dy);
  if (!gesture.direction && length >= threshold && length > 0)
    gesture.direction = { x: dx / length, y: dy / length };
  if (!gesture.direction) return gesture.start;
  const distance = Math.max(0, dx * gesture.direction.x + dy * gesture.direction.y);
  return { x: gesture.start.x + distance * gesture.direction.x, y: gesture.start.y + distance * gesture.direction.y };
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
    return {
      color: typeof v?.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : DDpenColors[0],
      width: DDpenWidths.includes(v?.width) ? v.width : 4,
      opacity: Number.isFinite(v?.opacity) ? Math.max(0.1, Math.min(1, v.opacity)) : 1,
      straight: !!v?.straight,
      eraserSize: Number.isFinite(v?.eraserSize) ? Math.max(4, Math.min(36, v.eraserSize)) : 11,
    };
  } catch { return { color: DDpenColors[0], width: 4, opacity: 1, straight: false, eraserSize: 11 }; }
}
// The darkest ink follows the theme, so it reads on a dark board too.
const inkColor = (c) => (c === DDpenColors[0] ? "var(--ink,#1E1E1E)" : c);
const colorNames = { "#1E1E1E": "Ink", "#F24822": "Red", "#FFA629": "Orange", "#14AE5C": "Green", "#0D99FF": "Blue", "#9747FF": "Violet" };
const HANDLE_DIRS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// The pen on a board. `ctx` comes from the board: data, layout, the camera and commit.
export function DDusePen(ctx) {
  const R = ctx.React, h = R.createElement;
  const [opts, setOpts] = R.useState(readPrefs),
    [eraser, setEraser] = R.useState(false),
    [sel, setSel] = R.useState(() => new Set()),
    [erasePreview, setErasePreview] = R.useState(null),
    [eraseCursor, setEraseCursor] = R.useState(null),
    [stylePreview, setStylePreview] = R.useState(null),
    [drag, setDrag] = R.useState(null),
    draft = R.useRef(null), drawing = R.useRef(null), raf = R.useRef(0), shownRef = R.useRef([]), selRef = R.useRef(sel), ctxRef = R.useRef(ctx);
  ctxRef.current = ctx;
  selRef.current = sel;
  const active = ctx.tool === "pen";
  const fa = ctx.language === "fa", t = (en, fa2) => (fa ? fa2 : en);
  R.useEffect(() => { if (!active) { setEraser(false); setEraseCursor(null); } }, [active]);
  R.useEffect(() => { try { localStorage.setItem(prefsKey, JSON.stringify(opts)); } catch {} }, [opts]);

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

  // While drawing with the pen, pressing or releasing Shift toggles straight-line preview immediately.
  R.useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key !== "Shift") return;
      const g = drawing.current;
      if (!g || g.erase) return;
      const nextShift = !!(e.type === "keydown" || opts.straight);
      if (g.shift !== nextShift) {
        g.shift = nextShift;
        const end = g.raw || g.last || g.start;
        g.direction = null;
        const locked = nextShift ? DDlockedStrokeEnd(g, end, 6 / ctxRef.current.getCamera().z) : end;
        g.points = nextShift ? [g.start.x, g.start.y, locked.x, locked.y] : g.rawPoints.slice();
        paintDraft();
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [active, opts.straight]);

  // Write strokes: `change(day, life)` returns the new lists.
  function write(change, message) {
    ctxRef.current.commit((d) => {
      const [nextDay, nextLife] = change(dayList(d), DDnormalizeStrokes(d.__life.strokes, { life: true }));
      if (nextDay.length > MAX_STROKES || nextLife.length > MAX_STROKES) {
        ctxRef.current.setStatus(t("Drawing limit reached. Delete a drawing, then try again.", "ظرفیت طراحی پر است. یک خط را حذف کن و دوباره امتحان کن."));
        return d;
      }
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
    const opacity = Number.isFinite(extra.opacity) && extra.opacity < 1 ? Math.round(Math.max(0.05, extra.opacity) * 100) / 100 : undefined;
    const cleaned = { id: extra.id, color: extra.color, width: extra.width, ...(opacity ? { opacity } : {}) };
    return { life: owner.life, stroke: { ...cleaned, ...(owner.life ? { parent: owner.parent } : {}), pts } };
  }
  function addStroke(points) {
    const c = ctxRef.current, placed = home(points, { id: "ink-" + Math.random().toString(36).slice(2, 10), color: opts.color, width: opts.width, opacity: opts.opacity });
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
  function applyTransformKeys(keys, tx, message = "Drawing moved") {
    const moved = shownRef.current
      .filter((s) => keys.has(keyOf(s)))
      .map((s) => ({
        s,
        placed: home(DDtransformPoints(s.points, tx), { id: s.id, color: s.color, width: s.width, opacity: s.opacity }),
      }))
      .filter((m) => m.placed);
    if (!moved.length) return;
    write((day, life) => {
      const gone = new Set(moved.map((m) => keyOf(m.s)));
      day = day.filter((s) => !gone.has("D:" + s.id));
      life = life.filter((s) => !gone.has("L:" + s.id));
      for (const m of moved) (m.placed.life ? life : day).push(m.placed.stroke);
      return [day, life];
    }, message);
    setSel(new Set(moved.map((m) => (m.placed.life ? "L:" : "D:") + m.s.id)));
  }
  function moveKeys(keys, dx, dy) {
    if (ctxRef.current.selected.size && ctxRef.current.moveDrawingGroup) {
      ctxRef.current.moveDrawingGroup(dx, dy);
      return;
    }
    applyTransformKeys(keys, { dx, dy }, "Drawing moved");
  }
  function duplicateSelected() {
    const pickedNow = shownRef.current.filter((s) => selRef.current.has(keyOf(s)));
    if (!pickedNow.length) return;
    const copies = pickedNow
      .map((s) => home(s.points.map((v) => v + 24), { id: "ink-" + Math.random().toString(36).slice(2, 10), color: s.color, width: s.width, opacity: s.opacity }))
      .filter(Boolean);
    if (!copies.length) return;
    write((day, life) => {
      const nextDay = [...day], nextLife = [...life];
      for (const c of copies) (c.life ? nextLife : nextDay).push(c.stroke);
      return [nextDay, nextLife];
    }, t("Drawing duplicated", "کپی خط ساخته شد"));
    setSel(new Set(copies.map((c) => (c.life ? "L:" : "D:") + c.stroke.id)));
  }
  function restyle(patch, message = null) {
    setStylePreview(null);
    const normPatch = { ...patch };
    if (normPatch.fill) { normPatch.color = normPatch.fill; delete normPatch.fill; }
    if (normPatch.width !== undefined) {
      normPatch.width = DDpenWidths.includes(normPatch.width)
        ? normPatch.width
        : DDpenWidths.reduce((a, b) => (Math.abs(b - normPatch.width) < Math.abs(a - normPatch.width) ? b : a));
    }
    const cleanStroke = (s) => {
      const next = { ...s, ...normPatch };
      if (next.opacity === null || next.opacity === undefined || next.opacity >= 1) delete next.opacity;
      else next.opacity = Math.round(Math.max(0.05, Math.min(1, next.opacity)) * 100) / 100;
      return next;
    };
    write(
      (day, life) => [
        day.map((s) => (selRef.current.has("D:" + s.id) ? cleanStroke(s) : s)),
        life.map((s) => (selRef.current.has("L:" + s.id) ? cleanStroke(s) : s)),
      ],
      message,
    );
  }
  function pick(patch) {
    const norm = { ...patch };
    if (norm.fill) { norm.color = norm.fill; delete norm.fill; }
    if (norm.width !== undefined) {
      norm.width = DDpenWidths.includes(norm.width)
        ? norm.width
        : DDpenWidths.reduce((a, b) => (Math.abs(b - norm.width) < Math.abs(a - norm.width) ? b : a));
    }
    if (norm.opacity === null) norm.opacity = 1;
    setOpts((o) => ({ ...o, ...norm }));
    setEraser(false);
    if (selRef.current.size) restyle(norm);
  }

  // Delete / Backspace remove the picked strokes (when no board cards own the Delete); Esc lets go.
  R.useEffect(() => {
    if (!sel.size) return;
    const key = (e) => {
      if (e.isComposing || e.target?.closest?.("input,textarea,select,[contenteditable=true],.b6-properties,.b6-context")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !ctxRef.current.selected.size) {
        e.preventDefault(); e.stopImmediatePropagation();
        duplicateSelected();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) && !ctxRef.current.selected.size) {
        e.preventDefault(); e.stopImmediatePropagation();
        const step = e.shiftKey ? 10 : 1;
        moveKeys(selRef.current, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // If board nodes are also selected, board.js deleteNodes() will delete both together.
        if (ctxRef.current.selected.size) return;
        e.preventDefault(); e.stopImmediatePropagation();
        removeKeys(sel, sel.size > 1 ? "Drawings deleted · Undo to restore" : "Drawing deleted · Undo to restore");
        setSel(new Set());
      } else if (e.key === "Escape") setSel(new Set());
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [sel, shown]);

  // A click on empty board (outside strokes, bounding box, pen bar, or side panels) lets go of picked strokes.
  R.useEffect(() => {
    const el = ctx.viewport.current;
    if (!el || !sel.size) return;
    const down = (e) => {
      if (e.shiftKey) return;
      const card = e.target.closest?.("[data-board-id]");
      if (card && ctxRef.current.selected.has(card.dataset.boardId)) return;
      if (!e.target.closest?.("[data-stroke-id],[data-ink-bbox],.dd-pen-bar,.b6-properties,.b6-context,.b4-selectionbar")) setSel(new Set());
    };
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

  // Partial / point-by-point eraser along the pointer path.
  function eraseAtPoint(p, last) {
    const g = drawing.current;
    if (!g || !g.live) return;
    const z = ctxRef.current.getCamera().z;
    const baseR = (opts.eraserSize || 11) / z;
    const steps = last ? Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, baseR / 2.5))) : 1;
    let list = g.live;
    let changed = false;
    for (let k = 1; k <= steps; k++) {
      const x = last ? last.x + ((p.x - last.x) * k) / steps : p.x;
      const y = last ? last.y + ((p.y - last.y) * k) / steps : p.y;
      const nextList = [];
      for (const s of list) {
        const pad = baseR + s.width / 2;
        if (x < s.box.x - pad || x > s.box.x + s.box.w + pad || y < s.box.y - pad || y > s.box.y + s.box.h + pad) {
          nextList.push(s);
          continue;
        }
        const pieces = DDeraseStrokeCircle(s.points, x, y, pad);
        if (pieces.length === 1 && pieces[0] === s.points) {
          nextList.push(s);
        } else {
          changed = true;
          g.erasedCount = (g.erasedCount || 0) + 1;
          pieces.forEach((pts, idx) => {
            nextList.push({
              ...s,
              id: idx === 0 && !nextList.some((x2) => x2.id === s.id) ? s.id : "ink-" + Math.random().toString(36).slice(2, 10),
              points: pts,
              box: DDstrokeBox(pts),
            });
          });
        }
      }
      list = nextList;
    }
    if (changed) {
      g.live = list;
      g.changed = true;
      setErasePreview(list);
    }
    setEraseCursor({ x: p.x, y: p.y, r: baseR });
  }

  // The pen's own layer over the board: it takes the pointer while the pen is on.
  // A second finger hands the gesture to the board (pinch and two-finger pan).
  function down(e) {
    const c = ctxRef.current;
    if (c.pinching() || c.panKey() || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault(); e.stopPropagation();
    c.finishEdit?.(); c.setMenu?.(null);
    const p = c.toWorld(e.clientX, e.clientY);
    const isShift = !!(e.shiftKey || opts.straight);
    drawing.current = {
      id: e.pointerId,
      erase: eraser,
      start: p,
      rawPoints: [p.x, p.y],
      points: [p.x, p.y],
      last: p,
      raw: p,
      shift: isShift,
      live: eraser ? shownRef.current.slice() : null,
      changed: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (eraser) eraseAtPoint(p, null);
    else if (draft.current) {
      draft.current.style.display = "";
      draft.current.setAttribute("stroke", inkColor(opts.color));
      draft.current.setAttribute("stroke-width", opts.width);
      draft.current.setAttribute("stroke-opacity", opts.opacity ?? 1);
      paintDraft();
    }
  }
  function move(e) {
    const g = drawing.current, c = ctxRef.current;
    if (!g) {
      if (eraser && e.pointerType === "mouse") {
        const p = c.toWorld(e.clientX, e.clientY);
        setEraseCursor({ x: p.x, y: p.y, r: (opts.eraserSize || 11) / c.getCamera().z });
      }
      return;
    }
    if (g.id !== e.pointerId) return;
    if (c.pinching()) return cancel();
    const z = c.getCamera().z;
    const isShift = !!(e.shiftKey || opts.straight);
    if (!isShift) g.direction = null;
    g.shift = isShift;
    for (const ev of e.nativeEvent.getCoalescedEvents?.() || [e]) {
      const raw = c.toWorld(ev.clientX, ev.clientY);
      if (g.erase) { eraseAtPoint(raw, g.last); g.last = raw; continue; }
      g.raw = raw;
      if (Math.hypot(raw.x - g.last.x, raw.y - g.last.y) >= 0.75 / z) {
        // A little steadiness for a shaky mouse, without lagging behind the hand.
        const p = { x: g.last.x + (raw.x - g.last.x) * 0.65, y: g.last.y + (raw.y - g.last.y) * 0.65 };
        g.rawPoints.push(p.x, p.y);
        g.last = p;
      }
      const end = isShift ? DDlockedStrokeEnd(g, raw, 6 / z) : raw;
      g.points = isShift ? [g.start.x, g.start.y, end.x, end.y] : g.rawPoints;
    }
    if (!g.erase && !raf.current) raf.current = requestAnimationFrame(paintDraft);
  }
  function cancel() {
    drawing.current = null;
    if (draft.current) draft.current.style.display = "none";
    setErasePreview(null);
    setEraseCursor(null);
  }
  function up(e) {
    const g = drawing.current;
    if (!g || g.id !== e.pointerId) return;
    e.stopPropagation();
    drawing.current = null;
    if (draft.current) { draft.current.style.display = "none"; draft.current.removeAttribute("d"); }
    if (g.erase) {
      setErasePreview(null);
      if (e.pointerType !== "mouse") setEraseCursor(null);
      if (g.changed && g.live) {
        const nextDay = [], nextLife = [];
        for (const s of g.live) {
          const placed = s.life
            ? {
                id: s.id,
                parent: s.parent || "",
                pts: DDstrokeEncode(s.origin ? s.points.map((v, i) => v - (i % 2 ? s.origin.y : s.origin.x)) : s.points),
                color: s.color,
                width: s.width,
                ...(s.opacity && s.opacity < 1 ? { opacity: s.opacity } : {}),
              }
            : {
                id: s.id,
                pts: DDstrokeEncode(s.points),
                color: s.color,
                width: s.width,
                ...(s.opacity && s.opacity < 1 ? { opacity: s.opacity } : {}),
              };
          if (s.life) nextLife.push(placed);
          else nextDay.push(placed);
        }
        write((day, life) => {
          // Preserve Feed strokes in folded/other sections that weren't in `shownRef.current`.
          const shownLifeIds = new Set(shownRef.current.filter((s) => s.life).map((s) => s.id));
          const hiddenLife = life.filter((s) => !shownLifeIds.has(s.id));
          return [
            ctxRef.current.mode === "mindmap" && !ctxRef.current.layout.room ? nextDay : day,
            [...hiddenLife, ...nextLife],
          ];
        }, "Drawing erased");
      }
      return;
    }
    const isShift = !!(e.shiftKey || g.shift || opts.straight);
    if (isShift) {
      const end = DDlockedStrokeEnd(g, g.raw || g.last || g.start, 0);
      const pts = Math.hypot(end.x - g.start.x, end.y - g.start.y) < 0.5
        ? [g.start.x, g.start.y, g.start.x, g.start.y]
        : [g.start.x, g.start.y, end.x, end.y];
      addStroke(pts);
      return;
    }
    if (g.raw) g.rawPoints.push(g.raw.x, g.raw.y);
    if (g.rawPoints.length === 2) g.rawPoints.push(g.rawPoints[0], g.rawPoints[1]);
    addStroke(DDsimplifyStroke(g.rawPoints, 0.7 / ctxRef.current.getCamera().z));
  }

  // Start dragging the currently selected strokes (either by grabbing a stroke or its bounding box).
  function startMoveDrag(e, targetKeys) {
    const start = { x: e.clientX, y: e.clientY }, id = e.pointerId;
    let moved = false, last = null;
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      if (ctxRef.current.pinching()) { stop(); setDrag(null); return; }
      const z = ctxRef.current.getCamera().z, dx = (ev.clientX - start.x) / z, dy = (ev.clientY - start.y) / z;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      moved = true; last = { dx, dy };
      setDrag({ keys: targetKeys, dx, dy });
    };
    const stop = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      stop(); setDrag(null);
      if (moved && last && ev.type !== "pointercancel") moveKeys(targetKeys, last.dx, last.dy);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  // Select tool: press a stroke to pick it, drag to move it.
  function strokeDown(e, s) {
    const c = ctxRef.current;
    if (c.tool !== "select" || c.panKey() || c.pinching() || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation(); e.preventDefault();
    c.finishEdit?.(); c.setMenu?.(null);
    const key = keyOf(s), next = e.shiftKey ? new Set(sel) : sel.has(key) ? new Set(sel) : new Set([key]);
    if (e.shiftKey && sel.has(key)) next.delete(key); else next.add(key);
    if (!e.shiftKey) c.clearBoardSelection();
    setSel(next);
    c.viewport.current?.focus({ preventScroll: true });
    if (e.shiftKey && !next.has(key)) return;
    startMoveDrag(e, next);
  }

  // Dragging inside the selection bounding box moves all selected strokes together.
  function boxDown(e) {
    const c = ctxRef.current;
    if (e.shiftKey) {
      const p = c.toWorld(e.clientX, e.clientY), radius = 8 / c.getCamera().z;
      const hit = [...shownRef.current].reverse().find(s => {
        const group = [...c.viewport.current.querySelectorAll("[data-stroke-id]")].find(el => el.dataset.strokeId === s.id && el.dataset.strokeHome === (s.life ? "feed" : "day"));
        const path = group?.querySelector(".dd-ink-hit");
        if (path?.isPointInStroke) return path.isPointInStroke(new DOMPoint(p.x, p.y));
        return DDstrokeDistance(s.points, p.x, p.y) <= radius + s.width / 2;
      });
      if (hit) return strokeDown(e, hit);
    }
    if (c.tool !== "select" || c.panKey() || c.pinching() || (e.pointerType === "mouse" && e.button !== 0) || !sel.size) return;
    e.stopPropagation(); e.preventDefault();
    c.finishEdit?.(); c.setMenu?.(null);
    c.viewport.current?.focus({ preventScroll: true });
    startMoveDrag(e, new Set(sel));
  }

  // Dragging any of the 8 bounding-box handles scales the selected strokes.
  function handleDown(e, dir, rawBox) {
    const c = ctxRef.current;
    if (c.tool !== "select" || c.panKey() || c.pinching() || (e.pointerType === "mouse" && e.button !== 0) || !sel.size) return;
    e.stopPropagation(); e.preventDefault();
    c.finishEdit?.(); c.setMenu?.(null);
    const start = { x: e.clientX, y: e.clientY }, id = e.pointerId, keys = new Set(sel);
    const w0 = Math.max(8, rawBox.w), h0 = Math.max(8, rawBox.h);
    const cx = rawBox.x + rawBox.w / 2, cy = rawBox.y + rawBox.h / 2;
    let moved = false, lastTx = null;
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      if (ctxRef.current.pinching()) { stop(); setDrag(null); return; }
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
      moved = true;
      const z = ctxRef.current.getCamera().z;
      const dx = (ev.clientX - start.x) / z, dy = (ev.clientY - start.y) / z;
      const centered = ev.altKey;
      const factor = centered ? 2 : 1;
      let sx = dir.includes("e") ? (w0 + dx * factor) / w0 : dir.includes("w") ? (w0 - dx * factor) / w0 : 1;
      let sy = dir.includes("s") ? (h0 + dy * factor) / h0 : dir.includes("n") ? (h0 - dy * factor) / h0 : 1;
      sx = Math.max(0.1, Math.min(20, sx));
      sy = Math.max(0.1, Math.min(20, sy));
      if (ev.shiftKey && dir.length === 2) {
        const s = Math.max(sx, sy);
        sx = s; sy = s;
      }
      const ox = centered ? cx : dir.includes("w") ? rawBox.x + rawBox.w : rawBox.x;
      const oy = centered ? cy : dir.includes("n") ? rawBox.y + rawBox.h : rawBox.y;
      lastTx = { keys, scale: { ox, oy, sx, sy } };
      setDrag(lastTx);
    };
    const stop = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      stop(); setDrag(null);
      if (moved && lastTx && ev.type !== "pointercancel") {
        applyTransformKeys(keys, lastTx, t("Drawing resized", "اندازهٔ خط تغییر کرد"));
      }
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function openStrokeContext(e, s) {
    e.preventDefault();
    e.stopPropagation();
    const c = ctxRef.current;
    if (s) {
      const key = keyOf(s);
      if (!selRef.current.has(key)) {
        c.clearBoardSelection();
        const next = new Set([key]);
        selRef.current = next;
        setSel(next);
      }
    }
    c.openPenContext?.(e);
  }

  const z = ctx.getCamera().z, selectable = ctx.tool === "select";
  const displayList = erasePreview || shown;
  const picked = displayList.filter((s) => sel.has(keyOf(s)));

  // Compute raw & transformed bounding box for picked strokes.
  const rawBounds = picked.length > 0
    ? (() => {
        const b = picked.map((s) => s.box).reduce(
          (a, c) => ({ x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), x2: Math.max(a.x2, c.x + c.w), y2: Math.max(a.y2, c.y + c.h) }),
          { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity },
        );
        return { x: b.x, y: b.y, w: b.x2 - b.x, h: b.y2 - b.y };
      })()
    : null;

  return {
    styleDraft: (d, patch) => {
      const change = list => list.map(s => selRef.current.has((list === d.__life.strokes ? "L:" : "D:") + s.id)
        ? { ...s, ...(patch.fill ? { color: patch.fill } : {}), ...(patch.opacity !== undefined ? { opacity: patch.opacity ?? 1 } : {}) } : s);
      setDayList(d, change(dayList(d)));
      if (d.__life.strokes) d.__life.strokes = change(d.__life.strokes);
      return d;
    },
    moveDraft: (d, dx, dy) => {
      const followsSection = s => {
        let parent = s.parent;
        while (parent) {
          if (ctxRef.current.selected.has("life:" + parent)) return true;
          parent = ctxRef.current.items.find(i => i.id === parent)?.parent;
        }
        return false;
      };
      const shift = (list, life) => list.map(s => selRef.current.has((life ? "L:" : "D:") + s.id) && !(life && followsSection(s))
        ? { ...s, pts: DDstrokeEncode(DDtransformPoints(DDstrokeDecode(s.pts), { dx, dy })) } : s);
      setDayList(d, shift(dayList(d), false));
      if (d.__life.strokes) d.__life.strokes = shift(d.__life.strokes, true);
      return d;
    },
    selection: picked,
    hasSelection: picked.length > 0,
    opts,
    eraser,
    setEraser,
    pick,
    duplicateSelected,
    clear: () => { if (selRef.current.size) setSel(new Set()); },
    selectAll: () => {
      const next = new Set(shownRef.current.map(keyOf));
      setSel(next);
      return next.size;
    },
    selectInBox: (box, additive = false) => {
      const hits = shownRef.current.filter((s) => DDstrokeInBox(s.points, box)).map(keyOf);
      const next = additive ? new Set([...selRef.current, ...hits]) : new Set(hits);
      if (next.size !== selRef.current.size || [...next].some((k) => !selRef.current.has(k))) setSel(next);
      return next.size;
    },
    moveSelection: (dx, dy) => {
      if (selRef.current.size) moveKeys(selRef.current, dx, dy);
    },
    deleteSelection: () => {
      if (!selRef.current.size) return;
      removeKeys(selRef.current, selRef.current.size > 1 ? "Drawings deleted · Undo to restore" : "Drawing deleted · Undo to restore");
      setSel(new Set());
    },
    deleteFromDraft: (d) => {
      const keys = selRef.current;
      if (!keys.size) return d;
      setDayList(d, dayList(d).filter((s) => !keys.has("D:" + s.id)));
      setLifeList(d, DDnormalizeStrokes(d.__life?.strokes, { life: true }).filter((s) => !keys.has("L:" + s.id)));
      setTimeout(() => setSel(new Set()), 0);
      return d;
    },
    // Properties panel integration so `.b6-properties` works for Pen & Drawings just like Notes.
    panelProps: () => {
      const color = picked.length
        ? (picked.every((s) => s.color === picked[0].color) ? picked[0].color : opts.color)
        : opts.color;
      const width = picked.length
        ? (picked.every((s) => s.width === picked[0].width) ? picked[0].width : opts.width)
        : opts.width;
      const opacity = picked.length
        ? (picked.every((s) => (s.opacity ?? 1) === (picked[0].opacity ?? 1)) ? (picked[0].opacity ?? 1) : 1)
        : (opts.opacity ?? 1);
      return {
        active,
        count: picked.length,
        color,
        width,
        opacity,
        straight: !!opts.straight,
        eraser: !!eraser,
        eraserSize: opts.eraserSize || 11,
        box: rawBounds ? { x: Math.round(rawBounds.x), y: Math.round(rawBounds.y), w: Math.max(1, Math.round(rawBounds.w)), h: Math.max(1, Math.round(rawBounds.h)) } : null,
        onPreview: (patch) => setStylePreview(patch),
        onStyle: (patch) => {
          setStylePreview(null);
          pick(patch);
        },
        onStraight: (v) => setOpts((o) => ({ ...o, straight: v })),
        onEraser: (v) => setEraser(v),
        onEraserSize: (v) => setOpts((o) => ({ ...o, eraserSize: Math.max(4, Math.min(36, v)) })),
        onPosition: (pos) => {
          if (!rawBounds || !selRef.current.size) return;
          const dx = pos.x !== undefined ? pos.x - rawBounds.x : 0;
          const dy = pos.y !== undefined ? pos.y - rawBounds.y : 0;
          if (dx || dy) moveKeys(selRef.current, dx, dy);
        },
        onResize: (size) => {
          if (!rawBounds || !selRef.current.size) return;
          const w0 = Math.max(8, rawBounds.w), h0 = Math.max(8, rawBounds.h);
          const sx = size.width !== undefined ? Math.max(0.1, Math.min(20, size.width / w0)) : 1;
          const sy = size.height !== undefined ? Math.max(0.1, Math.min(20, size.height / h0)) : 1;
          applyTransformKeys(selRef.current, { scale: { ox: rawBounds.x, oy: rawBounds.y, sx, sy } }, t("Drawing resized", "اندازهٔ خط تغییر کرد"));
        },
        onSelectAll: () => {
          ctxRef.current.setTool("select");
          const next = new Set(shownRef.current.map(keyOf));
          setSel(next);
        },
        onDelete: () => {
          if (selRef.current.size) {
            removeKeys(selRef.current, selRef.current.size > 1 ? "Drawings deleted · Undo to restore" : "Drawing deleted · Undo to restore");
            setSel(new Set());
          }
        },
      };
    },
    // Inside the board's world: the strokes, the interactive bounding box with 8 handles, and the stroke being drawn.
    world: () => h("svg", { className: "dd-ink", "data-ink-select": selectable || undefined, "aria-label": "Drawings" },
      displayList.map((s) => {
        const key = keyOf(s), isPicked = sel.has(key), d = drag?.keys.has(key) ? drag : null;
        const pts = d ? DDtransformPoints(s.points, d) : s.points;
        const path = d ? DDstrokePath(pts) : pathOf(s.points);
        const col = isPicked && stylePreview?.color ? stylePreview.color : isPicked && stylePreview?.fill ? stylePreview.fill : s.color;
        const op = isPicked && stylePreview?.opacity !== undefined ? stylePreview.opacity : (s.opacity ?? 1);
        return h("g", { key, "data-stroke-id": s.id, "data-stroke-home": s.life ? "feed" : "day", className: isPicked ? "selected" : undefined },
          h("path", {
            d: path,
            className: "dd-ink-hit",
            onPointerDown: (e) => strokeDown(e, s),
            onDoubleClick: (e) => { e.stopPropagation(); ctxRef.current.openPenProperties?.(); },
            onContextMenu: (e) => openStrokeContext(e, s),
          }),
          h("path", { d: path, className: "dd-ink-line", stroke: inkColor(col), strokeWidth: s.width, strokeOpacity: op < 1 ? op : undefined }));
      }),
      picked.length > 0 && rawBounds && (() => {
        const pad = 6 / z + Math.max(...picked.map((s) => s.width)) / 2;
        const txPts = (pts) => (drag ? DDtransformPoints(pts, drag) : pts);
        const allPts = picked.flatMap((s) => txPts(s.points));
        const tb = DDstrokeBox(allPts);
        const bx = tb.x - pad, by = tb.y - pad, bw = Math.max(12 / z, tb.w + pad * 2), bh = Math.max(12 / z, tb.h + pad * 2);
        const hs = 8 / z, hitS = 18 / z;
        const handleCoords = {
          nw: [bx, by],
          n: [bx + bw / 2, by],
          ne: [bx + bw, by],
          e: [bx + bw, by + bh / 2],
          se: [bx + bw, by + bh],
          s: [bx + bw / 2, by + bh],
          sw: [bx, by + bh],
          w: [bx, by + bh / 2],
        };
        return h("g", { className: "dd-ink-bbox", "data-ink-bbox": picked.length },
          picked.length > 1 && picked.map((s) => {
            const sb = DDstrokeBox(txPts(s.points)), sp = 3 / z + s.width / 2;
            return h("rect", {
              key: "sub-" + keyOf(s),
              className: "dd-ink-subbox",
              x: sb.x - sp,
              y: sb.y - sp,
              width: Math.max(4 / z, sb.w + sp * 2),
              height: Math.max(4 / z, sb.h + sp * 2),
            });
          }),
          h("rect", {
            className: "dd-ink-box-hit",
            x: bx,
            y: by,
            width: bw,
            height: bh,
            onPointerDown: boxDown,
            onDoubleClick: (e) => { e.stopPropagation(); ctxRef.current.openPenProperties?.(); },
            onContextMenu: (e) => openStrokeContext(e, null),
          }),
          h("rect", {
            className: "dd-ink-box",
            x: bx,
            y: by,
            width: bw,
            height: bh,
          }),
          selectable && HANDLE_DIRS.map((dir) => {
            const [hx, hy] = handleCoords[dir];
            return h("g", {
              key: dir,
              className: "dd-ink-handle-g",
              "data-ink-handle": dir,
              onPointerDown: (e) => handleDown(e, dir, rawBounds),
              onContextMenu: (e) => openStrokeContext(e, null),
            },
            h("rect", {
              className: "dd-ink-handle-hit",
              x: hx - hitS / 2,
              y: hy - hitS / 2,
              width: hitS,
              height: hitS,
              "data-edge": dir,
            }),
            h("rect", {
              className: "dd-ink-handle",
              x: hx - hs / 2,
              y: hy - hs / 2,
              width: hs,
              height: hs,
              rx: 1.5 / z,
              "data-edge": dir,
            }));
          }),
        );
      })(),
      eraseCursor && active && eraser && h("circle", {
        className: "dd-ink-eraser-ring",
        cx: eraseCursor.x,
        cy: eraseCursor.y,
        r: eraseCursor.r,
      }),
      h("path", { ref: draft, className: "dd-ink-line dd-ink-draft", style: { display: "none" } })),
    // Over the board while the pen is on: it takes the pointer for drawing.
    capture: () => active && h("div", { className: "dd-ink-capture", "data-eraser": eraser || undefined, "aria-hidden": true,
      onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: cancel, onLostPointerCapture: (e) => { if (drawing.current?.id === e.pointerId) up(e); },
      onPointerLeave: () => setEraseCursor(null),
      onContextMenu: (e) => { e.preventDefault(); ctxRef.current.openPenContext?.(e); } }),
    // Colors, widths, straight-line, eraser and side Properties toggle while drawing; colors, widths, Properties, Select all and Delete for picked strokes.
    bar: () => (active || picked.length > 0) && h("div", { className: "dd-pen-bar", role: "toolbar", "aria-label": active ? "Pen" : "Drawing", onPointerDown: (e) => e.stopPropagation() },
      !active && picked.length > 1 && h("strong", { className: "dd-pen-count" }, picked.length + t(" drawings", " خط")),
      DDpenColors.map((c) => h("button", { type: "button", key: c, className: "dd-pen-color", style: { "--pen": inkColor(c) }, "aria-label": (colorNames[c] || c) + " pen", title: colorNames[c] || c,
        "aria-pressed": !eraser && (picked.length ? picked.every((s) => s.color.toUpperCase() === c.toUpperCase()) : opts.color.toUpperCase() === c.toUpperCase()), onClick: () => pick({ color: c }) })),
      // If a custom color from the side Properties panel is active, show its swatch too.
      (() => {
        const cur = picked.length && picked.every((s) => s.color === picked[0].color) ? picked[0].color : opts.color;
        if (!cur || DDpenColors.some((c) => c.toUpperCase() === cur.toUpperCase())) return null;
        return h("button", {
          type: "button",
          key: cur,
          className: "dd-pen-color",
          style: { "--pen": cur },
          "aria-label": "Custom pen " + cur,
          title: cur,
          "aria-pressed": !eraser,
          onClick: () => pick({ color: cur }),
        });
      })(),
      h("button", {
        type: "button",
        className: "dd-pen-props",
        "data-pen-properties": true,
        "aria-label": t("Color & properties", "رنگ و ویژگی‌ها"),
        title: t("Color & properties · opens side panel", "رنگ و ویژگی‌ها · باز کردن پنل کناری"),
        "aria-pressed": !!ctx.properties,
        onClick: () => ctxRef.current.togglePenProperties?.(),
      }, ctx.Icon ? h(ctx.Icon, { React: R, name: "palette" }) : "🎨"),
      h("span", { className: "dd-pen-sep" }),
      DDpenWidths.map((w, i) => h("button", { type: "button", key: w, className: "dd-pen-width", "aria-label": ["Thin", "Medium", "Thick"][i] + " line", title: ["Thin", "Medium", "Thick"][i],
        "aria-pressed": !eraser && (picked.length ? picked.every((s) => s.width === w) : opts.width === w), onClick: () => pick({ width: w }) }, h("span", { style: { height: Math.max(2, w * 0.9) + "px" } }))),
      active && h("span", { className: "dd-pen-sep" }),
      active && h("button", {
        type: "button",
        className: "dd-pen-straight",
        "data-pen-straight": true,
        "aria-label": t("Straight line · or hold Shift", "خط صاف · یا نگه‌داشتن Shift"),
        title: t("Straight line (or hold Shift while drawing)", "رسم خط صاف (یا نگه‌داشتن Shift هنگام کشیدن)"),
        "aria-pressed": !eraser && !!opts.straight,
        onClick: () => { setEraser(false); setOpts((o) => ({ ...o, straight: !o.straight })); },
      }, h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", "aria-hidden": true }, h("path", { d: "M4 16L16 4" }), h("circle", { cx: 4, cy: 16, r: 1.6, fill: "currentColor" }), h("circle", { cx: 16, cy: 4, r: 1.6, fill: "currentColor" }))),
      active && h("button", { type: "button", className: "dd-pen-eraser", "aria-label": "Eraser · erases where you rub", title: t("Point eraser · erases only where applied", "پاک‌کن نقطه‌ای · فقط جای کشیده‌شده را پاک می‌کند"), "aria-pressed": eraser, onClick: () => setEraser((v) => !v) },
        h("svg", { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M7.5 16.5h9M3.8 12.2l7.7-7.7a1.8 1.8 0 012.5 0l2 2a1.8 1.8 0 010 2.5L9.5 15.5h-2z M7 9l4 4" }))),
      shown.length > 1 && (active || picked.length < shown.length) && h("button", {
        type: "button",
        className: "dd-pen-select-all",
        "data-pen-select-all": true,
        "aria-label": t("Select all drawings", "انتخاب همهٔ خط‌ها"),
        title: t("Select all drawings (Ctrl+A)", "انتخاب همهٔ خط‌ها (Ctrl+A)"),
        onClick: () => {
          ctxRef.current.clearBoardSelection();
          ctxRef.current.setTool("select");
          setSel(new Set(shownRef.current.map(keyOf)));
        },
      }, t("All", "همه")),
      !active && picked.length > 0 && h("span", { className: "dd-pen-sep" }),
      !active && picked.length > 0 && h("button", { type: "button", className: "dd-pen-delete", "aria-label": "Delete drawing", title: "Delete · Delete key", onClick: () => { removeKeys(sel, sel.size > 1 ? "Drawings deleted · Undo to restore" : "Drawing deleted · Undo to restore"); setSel(new Set()); } }, "Delete"),
      !active && picked.length > 0 && h("button", {
        type: "button",
        className: "dd-pen-more",
        "data-dock-more": "pen",
        "aria-label": t("More actions", "گزینه‌های بیشتر"),
        title: t("More actions", "گزینه‌های بیشتر"),
        onClick: (e) => openStrokeContext(e, null),
      }, "⋯"),
      active && h("button", { type: "button", className: "dd-pen-done", onClick: () => ctxRef.current.setTool("select") }, "Done")),
  };
}

export const DDpenCSS = `
.dd-ink{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:800}
.dd-ink .dd-ink-line{fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.dd-ink .dd-ink-hit{fill:none;stroke:transparent;stroke-width:calc(16px * var(--b4-inverse,1));stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.dd-ink[data-ink-select] .dd-ink-hit{pointer-events:stroke;cursor:move}
.dd-ink g.selected .dd-ink-line{filter:drop-shadow(0 0 calc(1.5px * var(--b4-inverse,1)) var(--board-accent,#0D99FF))}
.dd-ink .dd-ink-subbox{fill:none;stroke:var(--board-accent,#0D99FF);stroke-width:1;stroke-dasharray:3 3;opacity:.55;vector-effect:non-scaling-stroke;pointer-events:none}
.dd-ink .dd-ink-box{fill:none;stroke:var(--board-accent,#0D99FF);stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none}
.dd-ink .dd-ink-box-hit{fill:color-mix(in srgb,var(--board-accent,#0D99FF) 4%,transparent);stroke:transparent;stroke-width:calc(8px * var(--b4-inverse,1));pointer-events:all;cursor:move}
.dd-ink .dd-ink-handle{fill:var(--paper,#fff);stroke:var(--board-accent,#0D99FF);stroke-width:calc(1.6px * var(--b4-inverse,1));pointer-events:none}
.dd-ink .dd-ink-handle-hit{fill:transparent;pointer-events:all}
.dd-ink .dd-ink-handle-hit[data-edge=nw],.dd-ink .dd-ink-handle-hit[data-edge=se]{cursor:nwse-resize}
.dd-ink .dd-ink-handle-hit[data-edge=ne],.dd-ink .dd-ink-handle-hit[data-edge=sw]{cursor:nesw-resize}
.dd-ink .dd-ink-handle-hit[data-edge=n],.dd-ink .dd-ink-handle-hit[data-edge=s]{cursor:ns-resize}
.dd-ink .dd-ink-handle-hit[data-edge=e],.dd-ink .dd-ink-handle-hit[data-edge=w]{cursor:ew-resize}
.dd-ink .dd-ink-eraser-ring{fill:#ffffff44;stroke:var(--ink,#222);stroke-width:1.3;vector-effect:non-scaling-stroke;pointer-events:none}
.dd-ink-capture{position:absolute;inset:0;z-index:40;cursor:crosshair;touch-action:none}
.dd-ink-capture[data-eraser]{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='11' cy='11' r='9' fill='%23ffffff99' stroke='%23444' stroke-width='1.5'/%3E%3C/svg%3E") 11 11,cell}
.dd-pen-bar{position:absolute;z-index:66;left:50%;bottom:78px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:14px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);box-shadow:0 6px 24px #0002;max-width:calc(100% - 24px);overflow-x:auto;scrollbar-width:none}
.dd-pen-bar button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;place-items:center;min-width:30px;height:30px;border-radius:9px;color:var(--ink)}
.dd-pen-bar button:hover,.dd-pen-bar button:focus-visible{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.dd-pen-bar button[aria-pressed=true]{background:color-mix(in srgb,var(--board-accent,#0D99FF) 16%,var(--paper));box-shadow:inset 0 0 0 1.5px var(--board-accent,#0D99FF)}
.dd-pen-color::before{content:"";width:16px;height:16px;border-radius:50%;background:var(--pen);box-shadow:inset 0 0 0 1px #0002}
.dd-pen-width span{display:block;width:16px;border-radius:9px;background:currentColor}
.dd-pen-sep{width:1px;height:20px;background:var(--rule-2,#0002);margin:0 2px;flex:none}
.dd-pen-done,.dd-pen-delete,.dd-pen-select-all{padding:0 10px!important;font:500 12px var(--sans)}
.dd-pen-count{font:600 11px var(--sans);color:var(--ink-2);padding:0 6px;white-space:nowrap}
@media(max-width:700px){.dd-pen-bar{left:8px;right:8px;transform:none;bottom:70px;max-width:none;flex-wrap:wrap;justify-content:center;overflow:visible;row-gap:6px}.dd-pen-bar>.dd-pen-sep:first-of-type{flex-basis:100%;width:auto;height:0;margin:0}}
@media(pointer:coarse){.dd-pen-bar button{min-width:38px;height:38px}}
/* Pen and Comment joined the tools dock: on a phone it still fits in one row. */
@media(max-width:700px){.b6 .b2-dock[data-dock=tools]>.b2-icon{min-width:31px;padding:6px 4px}.b6 .b2-dock[data-dock=tools]>.b2-sep{display:none}}
`;
