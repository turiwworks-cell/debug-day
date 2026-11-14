// Shapes on the Board (5.59), like FigJam.
//
// A shape is a note with a shape: the same sticky in the same lists (a day's
// notes or the Feed), so it moves, connects, syncs, searches and shows in every
// view exactly like any note. Only its look is different, and that look lives in
// the note's style: `shape`, `fillMode`, `stroke` and `strokeStyle`.
// The note's color is the shape's fill color.

const R2 = (n) => Math.round(n * 10) / 10;
const box = (w, h, sw) => ({ x: sw / 2, y: sw / 2, W: Math.max(1, w - sw), H: Math.max(1, h - sw) });
// A unit-square drawing (0..1), stretched to the shape's box.
const unit = (b, list) => list.map((p) => (typeof p === "string" ? p : R2(b.x + p[0] * b.W) + " " + R2(b.y + p[1] * b.H))).join(" ");
const poly = (b, pts) => "M" + unit(b, pts.flatMap((p, i) => (i ? ["L", p] : [p]))) + "Z";
function rrect({ x, y, W, H }, r) {
  r = Math.max(0, Math.min(r, W / 2, H / 2));
  return `M${R2(x + r)} ${R2(y)}H${R2(x + W - r)}A${R2(r)} ${R2(r)} 0 0 1 ${R2(x + W)} ${R2(y + r)}V${R2(y + H - r)}A${R2(r)} ${R2(r)} 0 0 1 ${R2(x + W - r)} ${R2(y + H)}H${R2(x + r)}A${R2(r)} ${R2(r)} 0 0 1 ${R2(x)} ${R2(y + H - r)}V${R2(y + r)}A${R2(r)} ${R2(r)} 0 0 1 ${R2(x + r)} ${R2(y)}Z`;
}
function ellipse({ x, y, W, H }) {
  return `M${R2(x)} ${R2(y + H / 2)}A${R2(W / 2)} ${R2(H / 2)} 0 1 0 ${R2(x + W)} ${R2(y + H / 2)}A${R2(W / 2)} ${R2(H / 2)} 0 1 0 ${R2(x)} ${R2(y + H / 2)}Z`;
}
const rect = ({ x, y, W, H }) => `M${R2(x)} ${R2(y)}H${R2(x + W)}V${R2(y + H)}H${R2(x)}Z`;
function star(b, points = 5, inner = 0.42) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points, r = i % 2 ? inner : 1;
    pts.push([0.5 + 0.5 * r * Math.cos(a), 0.54 + 0.52 * r * Math.sin(a)]);
  }
  return poly(b, pts);
}

// Each shape: its name, words to find it by, a size for a new one, the part of
// the box that holds its text ([left, top, right, bottom] as shares), and how to draw it.
export const DDshapeKinds = [
  { id: "rectangle", name: "Rectangle", words: "square box process step", size: [200, 200], text: [0.08, 0.08, 0.08, 0.08], d: (b) => rect(b) },
  { id: "ellipse", name: "Ellipse", words: "circle oval round start end", size: [200, 200], text: [0.15, 0.15, 0.15, 0.15], d: (b) => ellipse(b) },
  { id: "diamond", name: "Diamond", words: "decision rhombus choice question", size: [200, 200], text: [0.24, 0.24, 0.24, 0.24], d: (b) => poly(b, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) },
  { id: "triangle", name: "Triangle", words: "up extract", size: [200, 180], text: [0.24, 0.42, 0.24, 0.06], d: (b) => poly(b, [[0.5, 0], [1, 1], [0, 1]]) },
  { id: "triangle-down", name: "Triangle down", words: "down merge", size: [200, 180], text: [0.24, 0.06, 0.24, 0.42], d: (b) => poly(b, [[0, 0], [1, 0], [0.5, 1]]) },
  { id: "rounded", name: "Rounded rectangle", words: "round square card soft", size: [200, 200], text: [0.08, 0.08, 0.08, 0.08], d: (b) => rrect(b, Math.min(b.W, b.H) * 0.16) },
  { id: "pill", name: "Pill", words: "terminal capsule stadium start end rounded", size: [240, 100], text: [0.12, 0.1, 0.12, 0.1], d: (b) => rrect(b, Math.min(b.W, b.H) / 2) },
  { id: "chevron", name: "Chevron", words: "step arrow next stage", size: [240, 120], text: [0.2, 0.08, 0.22, 0.08], d: (b) => { const k = Math.min(0.25, (b.H * 0.5) / b.W); return poly(b, [[0, 0], [1 - k, 0], [1, 0.5], [1 - k, 1], [0, 1], [k, 0.5]]); } },
  { id: "predefined", name: "Predefined process", words: "subroutine process bars film", size: [240, 140], text: [0.13, 0.08, 0.13, 0.08], d: (b) => { const k = Math.min(b.W * 0.1, 18); return rect(b) + `M${R2(b.x + k)} ${R2(b.y)}V${R2(b.y + b.H)}M${R2(b.x + b.W - k)} ${R2(b.y)}V${R2(b.y + b.H)}`; } },
  { id: "document", name: "Document", words: "paper page wave file", size: [220, 160], text: [0.08, 0.08, 0.08, 0.2], d: (b) => "M" + unit(b, [[0, 0], "L", [1, 0], "L", [1, 0.84], "Q", [0.75, 0.68], [0.5, 0.84], "T", [0, 0.84]]) + "Z" },
  { id: "documents", name: "Multiple documents", words: "papers pages stack files", size: [220, 170], text: [0.08, 0.16, 0.14, 0.2], d: (b) => { const o = Math.min(b.W, b.H) * 0.06, f = { x: b.x, y: b.y + 2 * o, W: b.W - 2 * o, H: b.H - 2 * o }; return "M" + unit(f, [[0, 0], "L", [1, 0], "L", [1, 0.84], "Q", [0.75, 0.68], [0.5, 0.84], "T", [0, 0.84]]) + "Z" + `M${R2(b.x + o)} ${R2(b.y + 2 * o)}V${R2(b.y + o)}H${R2(b.x + b.W - o)}V${R2(b.y + b.H * 0.72)}M${R2(b.x + 2 * o)} ${R2(b.y + o)}V${R2(b.y)}H${R2(b.x + b.W)}V${R2(b.y + b.H * 0.64)}`; } },
  { id: "manual-input", name: "Manual input", words: "slanted keyboard input", size: [220, 150], text: [0.08, 0.24, 0.08, 0.08], d: (b) => poly(b, [[0, 0.22], [1, 0], [1, 1], [0, 1]]) },
  { id: "hexagon", name: "Hexagon", words: "preparation six", size: [240, 140], text: [0.2, 0.08, 0.2, 0.08], d: (b) => { const k = Math.min(0.22, (b.H * 0.5) / b.W); return poly(b, [[k, 0], [1 - k, 0], [1, 0.5], [1 - k, 1], [k, 1], [0, 0.5]]); } },
  { id: "parallelogram", name: "Parallelogram", words: "data input output slant", size: [240, 140], text: [0.2, 0.08, 0.2, 0.08], d: (b) => { const k = Math.min(0.22, (b.H * 0.6) / b.W); return poly(b, [[k, 0], [1, 0], [1 - k, 1], [0, 1]]); } },
  { id: "parallelogram-left", name: "Parallelogram left", words: "data input output slant reverse", size: [240, 140], text: [0.2, 0.08, 0.2, 0.08], d: (b) => { const k = Math.min(0.22, (b.H * 0.6) / b.W); return poly(b, [[0, 0], [1 - k, 0], [1, 1], [k, 1]]); } },
  { id: "cylinder", name: "Cylinder", words: "database storage data db disk", size: [170, 200], text: [0.08, 0.26, 0.08, 0.12], d: ({ x, y, W, H }) => { const ry = Math.min(H * 0.12, W * 0.25), rx = W / 2; return `M${R2(x)} ${R2(y + ry)}A${R2(rx)} ${R2(ry)} 0 0 1 ${R2(x + W)} ${R2(y + ry)}V${R2(y + H - ry)}A${R2(rx)} ${R2(ry)} 0 0 1 ${R2(x)} ${R2(y + H - ry)}ZM${R2(x)} ${R2(y + ry)}A${R2(rx)} ${R2(ry)} 0 0 0 ${R2(x + W)} ${R2(y + ry)}`; } },
  { id: "cylinder-side", name: "Horizontal cylinder", words: "direct access storage drum queue", size: [240, 130], text: [0.12, 0.08, 0.24, 0.08], d: ({ x, y, W, H }) => { const rx = Math.min(W * 0.12, H * 0.25), ry = H / 2; return `M${R2(x + rx)} ${R2(y)}H${R2(x + W - rx)}A${R2(rx)} ${R2(ry)} 0 0 1 ${R2(x + W - rx)} ${R2(y + H)}H${R2(x + rx)}A${R2(rx)} ${R2(ry)} 0 0 1 ${R2(x + rx)} ${R2(y)}ZM${R2(x + W - rx)} ${R2(y)}A${R2(rx)} ${R2(ry)} 0 0 0 ${R2(x + W - rx)} ${R2(y + H)}`; } },
  { id: "internal-storage", name: "Internal storage", words: "memory window grid", size: [200, 170], text: [0.16, 0.18, 0.06, 0.06], d: (b) => { const k = Math.min(b.W, b.H) * 0.14; return rect(b) + `M${R2(b.x + k)} ${R2(b.y)}V${R2(b.y + b.H)}M${R2(b.x)} ${R2(b.y + k)}H${R2(b.x + b.W)}`; } },
  { id: "trapezoid", name: "Trapezoid", words: "manual operation bucket", size: [240, 140], text: [0.2, 0.08, 0.2, 0.08], d: (b) => { const k = Math.min(0.2, (b.H * 0.6) / b.W); return poly(b, [[0, 0], [1, 0], [1 - k, 1], [k, 1]]); } },
  { id: "or", name: "Or", words: "summing junction cross circle x", size: [160, 160], text: [0.2, 0.2, 0.2, 0.2], d: (b) => { const c = 0.5 - 0.5 * Math.SQRT1_2, e = 1 - c; return ellipse(b) + "M" + unit(b, [[c, c], "L", [e, e], "M", [e, c], "L", [c, e]]); } },
  { id: "junction", name: "Junction", words: "plus circle add crosshair", size: [160, 160], text: [0.2, 0.2, 0.2, 0.2], d: (b) => ellipse(b) + "M" + unit(b, [[0.5, 0], "L", [0.5, 1], "M", [0, 0.5], "L", [1, 0.5]]) },
  { id: "off-page", name: "Off-page connector", words: "shield badge pentagon down label", size: [180, 200], text: [0.08, 0.08, 0.08, 0.36], d: (b) => poly(b, [[0, 0], [1, 0], [1, 0.62], [0.5, 1], [0, 0.62]]) },
  { id: "folder", name: "Folder", words: "tab card directory", size: [220, 170], text: [0.08, 0.2, 0.08, 0.08], d: (b) => { const t = Math.min(0.16, 26 / b.H); return poly(b, [[0, 0], [0.4, 0], [0.48, t], [1, t], [1, 1], [0, 1]]); } },
  { id: "page", name: "Folded corner", words: "note page document corner", size: [200, 220], text: [0.08, 0.16, 0.08, 0.08], d: (b) => { const f = Math.min(b.W, b.H) * 0.22; return `M${R2(b.x)} ${R2(b.y)}H${R2(b.x + b.W - f)}L${R2(b.x + b.W)} ${R2(b.y + f)}V${R2(b.y + b.H)}H${R2(b.x)}ZM${R2(b.x + b.W - f)} ${R2(b.y)}V${R2(b.y + f)}H${R2(b.x + b.W)}`; } },
  { id: "pentagon", name: "Pentagon", words: "five", size: [200, 190], text: [0.2, 0.3, 0.2, 0.1], d: (b) => poly(b, [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]]) },
  { id: "octagon", name: "Octagon", words: "stop eight", size: [200, 200], text: [0.12, 0.12, 0.12, 0.12], d: (b) => { const k = 0.29; return poly(b, [[k, 0], [1 - k, 0], [1, k], [1, 1 - k], [1 - k, 1], [k, 1], [0, 1 - k], [0, k]]); } },
  { id: "cross", name: "Cross", words: "plus add health", size: [200, 200], text: [0.34, 0.34, 0.34, 0.34], d: (b) => { const a = 1 / 3, c = 2 / 3; return poly(b, [[a, 0], [c, 0], [c, a], [1, a], [1, c], [c, c], [c, 1], [a, 1], [a, c], [0, c], [0, a], [a, a]]); } },
  { id: "arrow-left", name: "Arrow left", words: "back previous west", size: [240, 140], text: [0.3, 0.3, 0.06, 0.3], d: (b) => { const h = Math.min(0.45, (b.H * 0.6) / b.W); return poly(b, [[1, 0.28], [h, 0.28], [h, 0], [0, 0.5], [h, 1], [h, 0.72], [1, 0.72]]); } },
  { id: "arrow-right", name: "Arrow right", words: "forward next east", size: [240, 140], text: [0.06, 0.3, 0.3, 0.3], d: (b) => { const h = Math.min(0.45, (b.H * 0.6) / b.W); return poly(b, [[0, 0.28], [1 - h, 0.28], [1 - h, 0], [1, 0.5], [1 - h, 1], [1 - h, 0.72], [0, 0.72]]); } },
  { id: "star", name: "Star", words: "favorite rate best", size: [200, 200], text: [0.3, 0.36, 0.3, 0.26], d: (b) => star(b) },
  { id: "speech", name: "Speech bubble", words: "comment chat talk callout say quote", size: [240, 170], text: [0.08, 0.08, 0.08, 0.26], d: ({ x, y, W, H }) => { const B = H * 0.8, r = Math.min(W, B) * 0.18; return `M${R2(x + r)} ${R2(y)}H${R2(x + W - r)}Q${R2(x + W)} ${R2(y)} ${R2(x + W)} ${R2(y + r)}V${R2(y + B - r)}Q${R2(x + W)} ${R2(y + B)} ${R2(x + W - r)} ${R2(y + B)}H${R2(x + W * 0.38)}L${R2(x + W * 0.18)} ${R2(y + H)}L${R2(x + W * 0.22)} ${R2(y + B)}H${R2(x + r)}Q${R2(x)} ${R2(y + B)} ${R2(x)} ${R2(y + B - r)}V${R2(y + r)}Q${R2(x)} ${R2(y)} ${R2(x + r)} ${R2(y)}Z`; } },
  { id: "cloud", name: "Cloud", words: "thought idea dream sky", size: [240, 160], text: [0.14, 0.3, 0.12, 0.16], d: (b) => "M" + unit(b, [[0.25, 0.92], "C", [0.1, 0.92], [0, 0.8], [0, 0.65], "C", [0, 0.5], [0.11, 0.4], [0.24, 0.4], "C", [0.26, 0.2], [0.4, 0.06], [0.57, 0.08], "C", [0.69, 0.09], [0.78, 0.19], [0.81, 0.31], "C", [0.93, 0.32], [1, 0.45], [1, 0.6], "C", [1, 0.78], [0.88, 0.92], [0.74, 0.92]]) + "Z" },
  { id: "heart", name: "Heart", words: "love like care", size: [200, 180], text: [0.2, 0.18, 0.2, 0.3], d: (b) => "M" + unit(b, [[0.5, 0.95], "C", [0.2, 0.74], [0, 0.54], [0, 0.31], "C", [0, 0.13], [0.14, 0], [0.29, 0], "C", [0.4, 0], [0.48, 0.07], [0.5, 0.17], "C", [0.52, 0.07], [0.6, 0], [0.71, 0], "C", [0.86, 0], [1, 0.13], [1, 0.31], "C", [1, 0.54], [0.8, 0.74], [0.5, 0.95]]) + "Z" },
];
const KIND = new Map(DDshapeKinds.map((k) => [k.id, k]));
// The row above the dock while the shape tool is on (FigJam keeps the common ones there).
export const DDshapeRow = ["rectangle", "ellipse", "diamond", "triangle", "triangle-down", "rounded", "pill", "cylinder", "speech", "star"];
export const DDshapeKind = (id) => KIND.get(id) || null;

export const DDshapeFills = ["fill", "light", "none"];
export const DDshapeStrokes = ["solid", "dashed", "none"];
const HEX = /^#[0-9a-f]{6}$/i;
// FigJam's two rows: strong colors, then their light tints.
export const DDshapePalette = [
  "#1E1E1E", "#757575", "#F24822", "#FFA629", "#FFCD29", "#14AE5C", "#3BC9C1", "#0D99FF", "#9747FF", "#F849C1", "#FFFFFF",
  "#B3B3B3", "#D9D9D9", "#FFC7C2", "#FFE0C2", "#FFF1C2", "#CFF7D3", "#C7F4F1", "#BDE3FF", "#E4CCFF", "#FFC7EE",
];
export const DDshapeDefaults = { fill: "#FFFFFF", fillMode: "fill", stroke: "#757575", strokeStyle: "solid" };

// The shape part of a note's style, cleaned. Anything else is dropped.
export function DDshapeLook(raw) {
  const p = raw && typeof raw === "object" ? raw : {}, out = {};
  if (!KIND.has(p.shape)) return out;
  out.shape = p.shape;
  if (DDshapeFills.includes(p.fillMode) && p.fillMode !== "fill") out.fillMode = p.fillMode;
  if (typeof p.stroke === "string" && HEX.test(p.stroke)) out.stroke = p.stroke.toUpperCase();
  if (DDshapeStrokes.includes(p.strokeStyle)) out.strokeStyle = p.strokeStyle;
  return out;
}
// A see-through or empty shape shows the board behind it, so its words take the board's ink.
export const DDshapeClear = (style) => !!(style && KIND.has(style.shape) && (style.fillMode === "light" || style.fillMode === "none"));

// The part of a shape's box its words may use.
export function DDshapeTextBox(id, w, h) {
  const [l, t, r, b] = KIND.get(id)?.text || [0.08, 0.08, 0.08, 0.08];
  return { left: Math.round(w * l), top: Math.round(h * t), bottom: Math.round(h * b), width: Math.max(24, Math.round(w * (1 - l - r))), share: Math.max(0.2, 1 - t - b) };
}
// A shape is at least the size it was given, and taller when its words need more room.
export function DDshapeHeight(id, savedH, textH) {
  const { share } = DDshapeTextBox(id, 100, 100);
  return Math.max(savedH || 0, Math.ceil((textH || 0) / share), 40);
}
export function DDshapePath(id, w, h, sw = 2) {
  const kind = KIND.get(id) || KIND.get("rectangle");
  return kind.d(box(w, h, sw));
}
export function DDshapeSearch(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return DDshapeKinds;
  const words = q.split(/\s+/);
  return DDshapeKinds.filter((k) => words.every((w) => (k.name + " " + k.words + " " + k.id).toLowerCase().includes(w)));
}

// How a shape paints: fill, its see-through share, stroke and dashes.
export function DDshapePaint(node) {
  const mode = node.fillMode || "fill", strokeStyle = node.strokeStyle || "solid";
  return {
    fill: mode === "none" ? "none" : node.color || DDshapeDefaults.fill,
    fillOpacity: mode === "light" ? 0.32 : node.opacity ?? 1,
    stroke: strokeStyle === "none" ? "none" : node.stroke || DDshapeDefaults.stroke,
    dash: strokeStyle === "dashed" ? "8 6" : undefined,
    width: 2,
  };
}
// The shape drawn under a note's words, stretched with the note while it is resized.
export function DDShapeLayer({ React: R, node }) {
  const p = DDshapePaint(node), w = Math.max(1, node.w), h = Math.max(1, node.h);
  return R.createElement("svg", {
    className: "dd-shape-layer", "aria-hidden": true, "data-shape": node.shape,
    viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", overflow: "visible",
  }, R.createElement("path", {
    d: DDshapePath(node.shape, w, h, p.width), fill: p.fill, fillOpacity: p.fillOpacity,
    stroke: p.stroke, strokeWidth: p.width, strokeDasharray: p.dash, strokeLinejoin: "round", strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke",
  }));
}
// The same shape for the SVG export.
export function DDshapeSVG(node, esc = (s) => String(s)) {
  const p = DDshapePaint(node);
  return `<path transform="translate(${node.x} ${node.y})" d="${DDshapePath(node.shape, node.w, node.h, p.width)}" fill="${esc(p.fill)}" fill-opacity="${p.fillOpacity}" stroke="${esc(p.stroke)}" stroke-width="${p.width}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ""} stroke-linejoin="round"/>`;
}

// A small picture of a shape for the row and the picker.
export function DDShapeIcon({ React: R, id, size = 24 }) {
  const kind = KIND.get(id), [w, h] = kind?.size || [1, 1], s = Math.min((size - 3) / w, (size - 3) / h), iw = w * s, ih = h * s;
  return R.createElement("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, "aria-hidden": true, className: "dd-shape-icon", overflow: "visible", style: { flex: "none", maxWidth: "none" } },
    R.createElement("g", { transform: `translate(${R2((size - iw) / 2)} ${R2((size - ih) / 2)})` },
      R.createElement("path", { d: DDshapePath(id, iw, ih, 1.5), fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" })));
}

// The last shape and look you used, for the next one (per device).
const LAST = "debug-day:shape-last";
export function DDshapeLast() {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) || "{}") || {};
    return {
      shape: KIND.has(v.shape) ? v.shape : "rectangle",
      fill: HEX.test(v.fill || "") ? v.fill : DDshapeDefaults.fill,
      fillMode: DDshapeFills.includes(v.fillMode) ? v.fillMode : DDshapeDefaults.fillMode,
      stroke: HEX.test(v.stroke || "") ? v.stroke : DDshapeDefaults.stroke,
      strokeStyle: DDshapeStrokes.includes(v.strokeStyle) ? v.strokeStyle : DDshapeDefaults.strokeStyle,
    };
  } catch { return { shape: "rectangle", ...DDshapeDefaults }; }
}
export function DDshapeRemember(patch) {
  try { localStorage.setItem(LAST, JSON.stringify({ ...DDshapeLast(), ...patch })); } catch {}
}

// The searchable library ("More shapes").
export function DDShapePicker({ React: R, current, onPick, onClose, title = "Shapes" }) {
  const [query, setQuery] = R.useState(""), list = DDshapeSearch(query), h = R.createElement;
  return h("div", { className: "dd-shape-pop dd-shape-picker", role: "dialog", "aria-label": title, onPointerDown: (e) => e.stopPropagation(), onKeyDown: (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose?.(); } } },
    h("label", { className: "dd-shape-search" },
      h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" }, h("path", { d: "M8.5 3a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM13 13l4 4" })),
      h("input", { type: "search", autoFocus: true, value: query, placeholder: "Search for a shape", "aria-label": "Search for a shape", "data-shape-search": true,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: (e) => { if (e.key === "Enter" && list[0]) { e.preventDefault(); onPick(list[0].id); } } })),
    list.length
      ? h("div", { className: "dd-shape-grid", role: "listbox", "aria-label": title },
          list.map((k) => h("button", { type: "button", key: k.id, role: "option", "aria-selected": current === k.id, "aria-label": k.name, title: k.name, "data-shape-pick": k.id, onClick: () => onPick(k.id) },
            h(DDShapeIcon, { React: R, id: k.id, size: 30 }))))
      : h("p", { className: "dd-shape-empty" }, "No shape called “" + query + "”"));
}

// Fill or stroke: the three ways, then the colors (FigJam).
export function DDShapeColors({ React: R, part, mode, color, onMode, onColor, onDropper }) {
  const h = R.createElement, fill = part === "fill";
  const modes = fill
    ? [["fill", "Fill", "M4 4h12v12H4z", true], ["light", "Transparent", "M4 4h12v12H4zM7 13l6-6M7 9.5l2.5-2.5M10.5 13L13 10.5", false], ["none", "No fill", "M4 4h12v12H4zM6.5 6.5h7v7h-7z", false]]
    : [["solid", "Solid", "M4 16L16 4", false], ["dashed", "Dashed", "M4 16l2.5-2.5M8.75 11.25l2.5-2.5M13.5 6.5L16 4", false], ["none", "None", "M10 3.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM5.4 14.6l9.2-9.2", false]];
  const swatch = (c) => h("button", { type: "button", key: c, role: "radio", "aria-checked": String(color).toUpperCase() === c, "aria-label": (fill ? "Fill " : "Stroke ") + c, "data-shape-color": c, style: { "--swatch": c }, onClick: () => onColor(c) });
  return h("div", { className: "dd-shape-pop dd-shape-colors", role: "dialog", "aria-label": fill ? "Fill" : "Stroke", "data-shape-part": part, onPointerDown: (e) => e.stopPropagation() },
    h("div", { className: "dd-shape-modes", role: "radiogroup", "aria-label": fill ? "Fill style" : "Stroke style" },
      modes.map(([id, label, d, solid]) => h("button", { type: "button", key: id, role: "radio", "aria-checked": mode === id, "data-shape-mode": id, onClick: () => onMode(id) },
        h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" },
          solid && h("path", { d: "M6.5 6.5h7v7h-7z", fill: "currentColor", stroke: "none" }), h("path", { d })),
        label))),
    h("div", { className: "dd-shape-swatches", role: "radiogroup", "aria-label": fill ? "Fill color" : "Stroke color" },
      DDshapePalette.slice(0, 11).map(swatch),
      onDropper && h("button", { type: "button", className: "dd-shape-dropper", "aria-label": "Eyedropper (I)", title: "Take a color from the board (I)", "data-shape-dropper": part, onClick: onDropper },
        h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" },
          h("path", { d: "M13.5 3.2a2 2 0 012.8 2.8l-1.9 1.9.9.9-1.4 1.4-.9-.9-6.1 6.1H4.5v-2.4l6.1-6.1-.9-.9 1.4-1.4.9.9zM8.9 8.7l2.4 2.4" }))),
      DDshapePalette.slice(11).map(swatch),
      h("label", { className: "dd-shape-custom", title: "Any color" },
        h("input", { type: "color", value: HEX.test(color || "") ? color : "#757575", "aria-label": fill ? "Any fill color" : "Any stroke color", onChange: (e) => onColor(e.target.value.toUpperCase()) }))));
}

export const DDshapeCSS = `
.b6 .b4-sticky.b4-shape{background:transparent!important;box-shadow:none!important;border-color:transparent!important;border-radius:0!important;display:flex;flex-direction:column;justify-content:center;overflow:visible;box-sizing:border-box;padding:var(--shape-text-top,0px) 0 var(--shape-text-bottom,0px)!important}
.b6 .b4-shape>.dd-shape-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible}
.b6 .b4-shape .b4-sticky-head,.b6 .b4-shape .dd-sticky-footer{display:none!important}
.b6 .b4-shape>.b4-node-body{position:relative;z-index:1;flex:none!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;margin-inline-start:var(--shape-text-left,8%);width:var(--shape-text-width,84%);background:transparent!important}
.b6 .b4-shape .dd-note-preview,.b6 .b4-shape .dd-note-editor,.b6 .b4-shape .dd-note-editor textarea{background:transparent!important;padding:2px 0!important;text-align:var(--object-align,center);color:var(--node-text)!important;min-height:0!important;height:auto}
.b6 .b4-shape .dd-note-preview:empty::before{content:none}
.b6 .b4-shape:not(.selected) .dd-note-placeholder{visibility:hidden}
.b6 .b4-shape:not(.selected):hover>.dd-shape-layer path{stroke-width:2.5}
.dd-shape-pop{position:absolute;z-index:80;background:#1E1E1E;color:#fff;border:1px solid #ffffff1a;border-radius:16px;box-shadow:0 12px 32px #0005;padding:12px;font:13px/1.3 system-ui,sans-serif}
.dd-shape-anchor>.dd-shape-pop{position:relative}
.dd-shape-pop button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
.dd-shape-pop :focus-visible{outline:2px solid #9747FF;outline-offset:2px}
.dd-shape-picker{width:min(400px,calc(100vw - 32px));display:grid;gap:8px}
.dd-shape-search{display:flex;align-items:center;gap:8px;background:#2C2C2C;border:1px solid transparent;border-radius:9px;padding:0 10px;color:#ffffffa0}
.dd-shape-search:focus-within{border-color:#9747FF}
.dd-shape-search input{flex:1;min-width:0;height:36px;border:0!important;background:none!important;color:#fff;font:inherit;font-size:15px;outline:none!important;box-shadow:none!important;padding:0}
.dd-shape-search input::-webkit-search-cancel-button{filter:invert(1) grayscale(1)}
.dd-shape-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-height:min(330px,50vh);overflow:auto;scrollbar-width:thin}
.dd-shape-grid button{display:grid;place-items:center;aspect-ratio:1;border-radius:10px}
.dd-shape-grid button:hover{background:#ffffff14}
.dd-shape-grid button[aria-selected=true]{background:#9747FF}
.dd-shape-empty{margin:8px 4px;color:#ffffffa0}
.dd-shape-colors{display:grid;gap:12px;width:max-content;max-width:calc(100vw - 32px)}
.dd-shape-modes{display:flex;gap:4px;padding-bottom:12px;border-bottom:1px solid #ffffff1f;flex-wrap:wrap}
.dd-shape-modes button{display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:8px;font-size:14px}
.dd-shape-modes button:hover{background:#ffffff14}
.dd-shape-modes button[aria-checked=true]{background:#9747FF}
.dd-shape-swatches{display:grid;grid-template-columns:repeat(11,28px);gap:8px}
.dd-shape-swatches:has(.dd-shape-dropper){grid-template-columns:repeat(12,28px)}
.dd-shape-swatches button{width:28px;height:28px;border-radius:50%;background:var(--swatch);box-shadow:inset 0 0 0 1px #ffffff2a}
.dd-shape-swatches button[aria-checked=true]{box-shadow:0 0 0 2px #1E1E1E,0 0 0 4px #9747FF}
.dd-shape-custom{position:relative;width:28px;height:28px;border-radius:50%;background:conic-gradient(red,#ff0,lime,cyan,blue,#f0f,red);cursor:pointer}
.dd-shape-custom input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.dd-shape-row{position:absolute;left:50%;transform:translateX(-50%);bottom:76px;z-index:62;display:flex;align-items:center;gap:2px;background:var(--paper,#fff);color:var(--ink,#1e1e1e);border:1px solid color-mix(in srgb,var(--ink,#000) 12%,transparent);border-radius:14px;padding:5px;box-shadow:0 3px 12px #0000000d,0 12px 28px -22px #0004;max-width:calc(100% - 24px);overflow-x:auto;scrollbar-width:none}
.dd-shape-row>button{display:grid;place-items:center;min-width:38px;height:38px;border:0;background:none;border-radius:9px;color:inherit;cursor:pointer}
.dd-shape-row>button:hover{background:color-mix(in srgb,var(--ink,#000) 7%,transparent)}
.dd-shape-row>button[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px #9747FF;color:#9747FF}
.dd-shape-row>.dd-shape-more{padding:0 12px;font:500 13px system-ui,sans-serif;white-space:nowrap;border:1px solid color-mix(in srgb,var(--ink,#000) 14%,transparent);margin-inline-start:6px}
.dd-shape-row-sep{width:1px;align-self:stretch;margin:4px;background:color-mix(in srgb,var(--ink,#000) 12%,transparent)}
.b4-selectionbar .dd-shape-swatch{width:18px;height:18px;border-radius:50%;background:var(--swatch);box-shadow:inset 0 0 0 1px #ffffff55;display:inline-block}
.b4-selectionbar .dd-shape-swatch[data-mode=light]{background:linear-gradient(135deg,var(--swatch) 50%,transparent 50%);box-shadow:inset 0 0 0 1.5px var(--swatch)}
.b4-selectionbar .dd-shape-swatch[data-mode=none]{background:none;box-shadow:inset 0 0 0 1.5px currentColor}
.b4-selectionbar [data-shape-open]{display:inline-flex;align-items:center;gap:3px}
.b4-selectionbar [data-shape-open]::after{content:"";width:5px;height:5px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(45deg) translateY(-2px);opacity:.7;margin-inline-start:2px}
@media (max-width:700px){.dd-shape-row{bottom:70px}.dd-shape-swatches,.dd-shape-swatches:has(.dd-shape-dropper){grid-template-columns:repeat(8,28px)}.dd-shape-grid{grid-template-columns:repeat(5,1fr)}}
`;
