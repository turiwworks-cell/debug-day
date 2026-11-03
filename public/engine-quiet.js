// The Engine's own sections: sections drawn on the board inside the Engine's
// frame, outside the Feed (for example soft parts of the day, like "Morning").
// They help the day run but are not the main work, so the Tab flowchart lists
// them last, in one quiet folded row, and the board draws them softer.
// Nothing is stored: it is read from where they sit, so dragging a section out
// of the Engine makes it an ordinary section again, everywhere at once.
import { DDlifeAbs, DDlifeHead } from "./life-board.js";

// Ids of the top-level sections placed outside the Feed whose middle sits inside
// the Engine's frame. `feed` is the Feed frame's corner on the board, `area` the
// Engine frame ({x, y, w, h}); both in board coordinates.
export function DDengineSectionIds(items = [], feed = null, area = null) {
  const out = new Set();
  if (!feed || !area || !Number.isFinite(feed.x) || !Number.isFinite(area.x)) return out;
  for (const it of items) {
    if (it.type !== "section" || it.parent || it.out !== true) continue;
    const a = DDlifeAbs(items, it.id),
      h = it.collapsed ? 38 : Number(it.h) || 0,
      cx = feed.x + a.x + (Number(it.w) || 0) / 2,
      cy = feed.y + DDlifeHead + a.y + h / 2;
    if (cx >= area.x && cx <= area.x + area.w && cy >= area.y && cy <= area.y + area.h) out.add(it.id);
  }
  return out;
}

// On the board an Engine section is a light dashed outline with a small grey
// name, so today's tasks stay the first thing you see. What is inside it (notes,
// other sections) keeps its own look.
export const DDengineQuietCSS = `
.b6 .b4-node.b4-life-section[data-engine-section]{background:transparent!important;border:1px dashed color-mix(in srgb,var(--ink,#121211) 24%,transparent)!important;box-shadow:none!important}
.b6 .b4-node.b4-life-section[data-engine-section]>.b4-node-body,.b6 .b4-node.b4-life-section[data-engine-section]>.b4-node-actions{background:transparent!important;color:var(--ink-3,#7f7c75)!important;box-shadow:none!important;border:0!important}
.b6 .b4-node.b4-life-section[data-engine-section]>.b4-node-body :is(.b4-node-title,.b4-node-subtitle){color:inherit!important;font-weight:500}
.b6 .b4-node.b4-life-section[data-engine-section].selected{border-style:solid!important}
`;

export function DDinstallEngineQuietStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-quiet-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-quiet-css", textContent: DDengineQuietCSS }));
}
