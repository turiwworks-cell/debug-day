// The eyedropper (5.60): press I, then click anything on the Board to take its
// color. With things picked, they take that color; with nothing picked, the next
// notes and shapes do. Like FigJam, a small loupe shows the color under the pointer.
//
// The color comes from the thing itself (a note's paper, a shape's fill or
// stroke, a section, a task, a line, a pen stroke), so it is exactly the color
// the board stores. Where the browser has a screen eyedropper, the palettes'
// dropper button can also take a color from anywhere, photos included.

const HEX = /^#[0-9a-f]{6}$/i;
function toHex(value) {
  const v = String(value || "").trim();
  if (HEX.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ("#" + [...v.slice(1)].map((c) => c + c).join("")).toUpperCase();
  const m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  if (alpha < 0.05) return null;
  return "#" + [m[1], m[2], m[3]].map((n) => Math.round(Math.min(255, +n)).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export const DDdropperHex = toHex;

// What color a board object shows: a shape's fill (or its stroke when it has no
// fill), a note's or section's color, a text object's words.
export function DDdropperNodeColor(node) {
  if (!node) return null;
  if (node.shape) return toHex(node.fillMode === "none" ? node.stroke || "#757575" : node.color);
  if (node.plain) return toHex(node.textColor);
  return toHex(node.color);
}

// The color at a point on the screen, read from what is drawn there.
export function DDdropperColorAt(x, y, nodeOf) {
  if (typeof document === "undefined") return null;
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest?.(".dd-dropper-loupe,.b4-selectionbar,.b2-dock,.dd-shape-pop")) return null;
    // A line, a pen stroke or a drawn mark: the paint of the stroke itself.
    if (el instanceof SVGElement && el.tagName !== "svg" && !el.closest(".dd-shape-layer")) {
      const cs = getComputedStyle(el), stroke = toHex(cs.stroke), fill = toHex(cs.fill);
      if (stroke && cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0) return stroke;
      if (fill && cs.fill !== "none") return fill;
      continue;
    }
    const card = el.closest?.("[data-board-id]");
    if (card) {
      const color = DDdropperNodeColor(nodeOf?.(card.dataset.boardId));
      if (color) return color;
    }
    if (el.classList?.contains("b2-viewport")) return null;
  }
  return null;
}

// The board hands over what it needs; the hook keeps the mode, the loupe and
// the clicks while the eyedropper is on.
export function DDuseEyedropper({ React: R, viewport, active, nodeOf, onPick, onCancel }) {
  const [hover, setHover] = R.useState(null);
  const latest = R.useRef({});
  latest.current = { nodeOf, onPick, onCancel };
  R.useEffect(() => {
    const el = viewport.current;
    if (!active || !el) { setHover(null); return; }
    const move = (e) => setHover({ x: e.clientX, y: e.clientY, color: DDdropperColorAt(e.clientX, e.clientY, latest.current.nodeOf) });
    const down = (e) => {
      if (e.button === 2) { e.preventDefault(); e.stopPropagation(); latest.current.onCancel?.(); return; }
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const color = DDdropperColorAt(e.clientX, e.clientY, latest.current.nodeOf);
      latest.current.onPick?.(color);
    };
    const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("click", swallow, true);
    el.addEventListener("dblclick", swallow, true);
    return () => {
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("click", swallow, true);
      el.removeEventListener("dblclick", swallow, true);
    };
  }, [active]);
  const loupe = active && hover
    ? R.createElement("div", { className: "dd-dropper-loupe", "aria-hidden": true, "data-empty": !hover.color || undefined, style: { left: hover.x, top: hover.y, "--picked": hover.color || "transparent" } },
        R.createElement("i"), R.createElement("span", null, hover.color || "—"))
    : null;
  return { loupe, hover };
}

// The browser's own screen eyedropper (Chrome, Edge): any pixel, photos included.
export const DDdropperScreen = () => typeof window !== "undefined" && typeof window.EyeDropper === "function";
export async function DDdropperScreenPick() {
  try { const r = await new window.EyeDropper().open(); return toHex(r?.sRGBHex); } catch { return null; }
}


export const DDdropperCSS = `
.b2-viewport[data-tool=dropper],.b2-viewport[data-tool=dropper] *{cursor:crosshair!important}
.dd-dropper-loupe{position:fixed;z-index:9999;pointer-events:none;transform:translate(14px,14px);display:flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;border-radius:999px;background:#1E1E1E;color:#fff;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 6px 18px #0004}
.dd-dropper-loupe i{width:22px;height:22px;border-radius:50%;background:var(--picked);box-shadow:inset 0 0 0 1.5px #ffffff66}
.dd-dropper-loupe[data-empty] i{background:repeating-conic-gradient(#666 0 25%,#999 0 50%) 0/8px 8px}
.dd-shape-swatches .dd-shape-dropper,.dd-dropper-button{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff2a;color:inherit}
.dd-shape-swatches .dd-shape-dropper:hover{background:#ffffff14}
`;
