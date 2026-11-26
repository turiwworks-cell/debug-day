import { DDlifeAbs, DDlifeAdd, DDlifeHead, DDlifeParentAt } from "./life-board.js";
import { DDcommentsTransfer } from "./comments.js";

export function DDfeedFrame(setup, days) {
  const saved = setup.life?.frame;
  if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
  const legacy = Object.keys(days || {}).sort().map(date => {
    const layouts = days[date].canvas?.board4?.layouts;
    return layouts?.mindmap?.["section:life"] || layouts?.lanes?.["section:life"];
  }).find(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  return { x: legacy?.x ?? 2400, y: legacy?.y ?? 80, ...saved };
}

// Day coordinates are world coordinates. Shared notes use their parent's origin.
export function DDplaceSectionNote(day, life, note, frame, options = {}) {
  if (!frame || !note || note.kind === "emoji") return null;
  const from = "sticky:" + note.id, board = day.canvas?.board4;
  const { width, height, fill, ...style } = board?.styles?.[from] || {};
  const { x = note.x, y = note.y, w = width || 240, h = height || (style.plain ? 40 : 160), room = "" } = options;
  const px = x - frame.x, py = y - frame.y - DDlifeHead;
  const target = options.target || DDlifeParentAt(life.items, px + (options.hitWidth ?? w) / 2, py + h / 2, undefined, room)
    || (room && life.items.find(i => i.id === room));
  if (!target) return null;
  const origin = DDlifeAbs(life.items, target.id);
  const id = life.items.some(i => i.id === note.id) ? crypto.randomUUID() : note.id;
  const ref = "life:" + id;
  life.items = DDlifeAdd(life.items, { ...note, id, type: "sticky", parent: target.id,
    x: px - origin.x, y: py - origin.y, w, h, color: fill || note.color, style, at: note.at || day.date });
  day.notes = day.notes.filter(n => n !== note);
  if (board) {
    const rename = value => value === from ? ref : value;
    const shared = [];
    if (board.links) board.links = board.links.flatMap(link => {
      if (link.from !== from && link.to !== from) return [link];
      const next = { ...link, from: rename(link.from), to: rename(link.to) };
      if (!next.from.startsWith("life:") || !next.to.startsWith("life:")) return [next];
      // Day-specific wire styling travels with the shared connector.
      shared.push({ ...next, ...board.overrides?.[link.id], from: next.from, to: next.to });
      if (board.overrides) delete board.overrides[link.id];
      return [];
    });
    if (shared.length) life.links = [...new Map([...(life.links || []), ...shared].map(l => [l.id, l])).values()];
    for (const layout of Object.values(board.layouts || {})) delete layout[from];
    if (board.styles) delete board.styles[from];
    for (const key of ["stack", "locked", "hidden"]) if (board[key]) board[key] = board[key].map(rename);
    for (const [key, members] of Object.entries(board.groups || {})) board.groups[key] = members.map(rename);
    const draft = { canvas: day.canvas, __life: life };
    DDcommentsTransfer(draft, from, ref);
    day.canvas = draft.canvas;
  }
  return ref;
}
