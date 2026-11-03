// Geometry in world coordinates. Endpoints are recomputed from live node
// bounds on every drag frame, rather than remembering the original ports.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const normals = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segment(rect, side) {
  const ix = Math.min(12, rect.w / 4),
    iy = Math.min(12, rect.h / 4);
  if (side === "left" || side === "right")
    return {
      vertical: true,
      fixed: rect.x + (side === "right" ? rect.w : 0),
      a: rect.y + iy,
      b: rect.y + rect.h - iy,
    };
  return {
    vertical: false,
    fixed: rect.y + (side === "bottom" ? rect.h : 0),
    a: rect.x + ix,
    b: rect.x + rect.w - ix,
  };
}
function closest(a, b) {
  if (a.vertical !== b.vertical) {
    const v = a.vertical ? a : b,
      h = a.vertical ? b : a;
    const vp = { x: v.fixed, y: clamp(h.fixed, v.a, v.b) },
      hp = { x: clamp(v.fixed, h.a, h.b), y: h.fixed };
    return a.vertical ? [vp, hp] : [hp, vp];
  }
  const lo = Math.max(a.a, b.a),
    hi = Math.min(a.b, b.b);
  const av = lo <= hi ? (lo + hi) / 2 : a.b < b.a ? a.b : a.a;
  const bv = clamp(av, b.a, b.b);
  return a.vertical
    ? [
        { x: a.fixed, y: av },
        { x: b.fixed, y: bv },
      ]
    : [
        { x: av, y: a.fixed },
        { x: bv, y: b.fixed },
      ];
}
const point = (r, side) =>
  side === "left"
    ? { x: r.x, y: r.y + r.h / 2 }
    : side === "right"
      ? { x: r.x + r.w, y: r.y + r.h / 2 }
      : side === "top"
        ? { x: r.x + r.w / 2, y: r.y }
        : { x: r.x + r.w / 2, y: r.y + r.h };
export function DDnearestEndpoints(a, b, fixed = {}) {
  let best;
  for (const from of fixed.fromPort ? [fixed.fromPort] : Object.keys(normals))
    for (const to of fixed.toPort ? [fixed.toPort] : Object.keys(normals)) {
      if (!normals[from] || !normals[to]) continue;
      let [p, q] = closest(segment(a, from), segment(b, to));
      if (fixed.fromPort) p = point(a, from);
      if (fixed.toPort) q = point(b, to);
      const [fx, fy] = normals[from],
        [tx, ty] = normals[to],
        dx = q.x - p.x,
        dy = q.y - p.y;
      const cost =
        distance(p, q) +
        (dx * fx + dy * fy < -0.1 ? 100000 : 0) +
        (-dx * tx - dy * ty < -0.1 ? 100000 : 0);
      if (!best || cost < best.cost - 0.01) best = { p, q, from, to, cost };
    }
  return best;
}
function crosses(a, b, r) {
  // Liang–Barsky, with a tiny inset so running along an edge is allowed.
  const x = r.x + 0.2,
    y = r.y + 0.2,
    w = r.w - 0.4,
    h = r.h - 0.4;
  let lo = 0,
    hi = 1;
  for (const [p, q] of [
    [a.x - b.x, a.x - x],
    [b.x - a.x, x + w - a.x],
    [a.y - b.y, a.y - y],
    [b.y - a.y, y + h - a.y],
  ]) {
    if (!p) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return false;
  }
  return true;
}
function tidy(points) {
  const out = [];
  for (const p of points) {
    if (out.length && distance(out.at(-1), p) < 0.01) continue;
    if (out.length >= 2) {
      const a = out.at(-2),
        b = out.at(-1);
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
        out.pop();
    }
    out.push(p);
  }
  return out;
}
function rounded(points, radius) {
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const b = points[i],
      a = points[i - 1],
      c = points[i + 1];
    // No corner to round at the ends, or where two points sit on each other.
    if (!c || !radius || distance(a, b) < 0.01 || distance(b, c) < 0.01) {
      d += `L${b.x} ${b.y}`;
      continue;
    }
    const r = Math.min(radius, distance(a, b) / 2, distance(b, c) / 2),
      before = {
        x: b.x + ((a.x - b.x) * r) / distance(a, b),
        y: b.y + ((a.y - b.y) * r) / distance(a, b),
      },
      after = {
        x: b.x + ((c.x - b.x) * r) / distance(b, c),
        y: b.y + ((c.y - b.y) * r) / distance(b, c),
      };
    d += `L${before.x} ${before.y}Q${b.x} ${b.y} ${after.x} ${after.y}`;
  }
  return d;
}
function middle(points) {
  const lengths = points.slice(1).map((p, i) => distance(points[i], p));
  let left = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const t = lengths[i] ? left / lengths[i] : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    left -= lengths[i];
  }
  return points[0];
}
export function DDconnectionGeometry(a, b, wire = {}, obstacles = []) {
  const ends = DDnearestEndpoints(a, b, wire.routing === "fixed" ? wire : {});
  if (!ends) return null;
  const { p, q, from, to } = ends;
  if (wire.style === "straight")
    return {
      d: `M${p.x} ${p.y}L${q.x} ${q.y}`,
      p,
      q,
      mid: middle([p, q]),
      from,
      to,
    };
  if (wire.bend) {
    if (wire.style === "elbow") {
      // An elbow's middle run moves one way only: sideways when the line leaves
      // from a left or right side, up and down when it leaves from the top or
      // bottom. The handle stays on that run, so it never leaves the line.
      // When the ends line up, that run would have no length: use the other way.
      let across = from === "top" || from === "bottom";
      if (across && Math.abs(p.x - q.x) < 1) across = false;
      else if (!across && Math.abs(p.y - q.y) < 1) across = true;
      const points = across
          ? [p, { x: p.x, y: wire.bend.y }, { x: q.x, y: wire.bend.y }, q]
          : [p, { x: wire.bend.x, y: p.y }, { x: wire.bend.x, y: q.y }, q];
      const mid = across ? { x: (p.x + q.x) / 2, y: wire.bend.y } : { x: wire.bend.x, y: (p.y + q.y) / 2 };
      return { d: rounded(tidy(points), 12), p, q, mid, from, to, axis: across ? "y" : "x" };
    }
    const mid = wire.bend;
    return {
      d: `M${p.x} ${p.y}Q${2 * mid.x - (p.x + q.x) / 2} ${2 * mid.y - (p.y + q.y) / 2} ${q.x} ${q.y}`,
      p,
      q,
      mid,
      from,
      to,
    };
  }
  const fx = normals[from][0],
    fy = normals[from][1],
    tx = normals[to][0],
    ty = normals[to][1];
  const span = distance(p, q),
    handle = Math.min(120, Math.max(18, span * 0.35));
  const c = { x: p.x + fx * handle, y: p.y + fy * handle },
    e = { x: q.x + tx * handle, y: q.y + ty * handle };
  const blockers = obstacles
    .filter(
      (r) =>
        r.id !== a.id &&
        r.id !== b.id &&
        !["frame", "section"].includes(r.kind) &&
        r.x + r.w >= Math.min(p.x, q.x) - 150 &&
        r.x <= Math.max(p.x, q.x) + 150 &&
        r.y + r.h >= Math.min(p.y, q.y) - 150 &&
        r.y <= Math.max(p.y, q.y) + 150,
    )
    .slice(0, 24);
  const samples = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12,
      u = 1 - t;
    return {
      x:
        u ** 3 * p.x + 3 * u * u * t * c.x + 3 * u * t * t * e.x + t ** 3 * q.x,
      y:
        u ** 3 * p.y + 3 * u * u * t * c.y + 3 * u * t * t * e.y + t ** 3 * q.y,
    };
  });
  if (
    wire.style !== "elbow" &&
    !blockers.some((r) =>
      samples.slice(1).some((pt, i) => crosses(samples[i], pt, r)),
    )
  )
    return {
      d: `M${p.x} ${p.y}C${c.x} ${c.y},${e.x} ${e.y},${q.x} ${q.y}`,
      p,
      q,
      mid: samples[6],
      from,
      to,
    };
  const gap = Math.min(22, Math.max(6, span / 5)),
    s = { x: p.x + fx * gap, y: p.y + fy * gap },
    t = { x: q.x + tx * gap, y: q.y + ty * gap };
  const xs = [(s.x + t.x) / 2, s.x, t.x],
    ys = [(s.y + t.y) / 2, s.y, t.y];
  for (const r of [...blockers, a, b]) {
    xs.push(r.x - 18, r.x + r.w + 18);
    ys.push(r.y - 18, r.y + r.h + 18);
  }
  const candidates = [
    ...xs.map((x) => [p, s, { x, y: s.y }, { x, y: t.y }, t, q]),
    ...ys.map((y) => [p, s, { x: s.x, y }, { x: t.x, y }, t, q]),
  ];
  const areas = [...blockers, a, b];
  let best;
  for (const path of candidates) {
    const points = tidy(path);
    let cost = points.length * 2;
    for (let i = 1; i < points.length; i++)
      cost +=
        distance(points[i - 1], points[i]) +
        areas.filter((r) => crosses(points[i - 1], points[i], r)).length *
          1000000;
    if (!best || cost < best.cost) best = { points, cost };
  }
  return {
    d: rounded(best.points, 12),
    p,
    q,
    mid: middle(best.points),
    from,
    to,
    points: best.points,
  };
}
