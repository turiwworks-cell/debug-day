// Parent notes and sub-notes (5.34). Nothing new is saved: they come from the
// arrows already on the board. An arrow A → B makes B a sub-note of A.
// A line with no arrowhead, or arrows at both ends, says nothing about family.
// A parent note looks a little special without touching its paper: a soft stack
// of sheets behind it and a small count of its sub-notes under it.

import { DDTagChips, DDTagEditor, DDnoteTags, DDsetNoteTags, DDallTags } from "./note-tags.js";

// Which end an arrow points at (older links keep one arrow flipped by arrowReverse).
export function DDarrowEnds(wire) {
  return {
    start: !!(wire?.arrowStart || (wire?.arrow && wire?.arrowReverse)),
    end: !!(wire?.arrow && !wire?.arrowReverse),
  };
}
// The parent and the child a line makes, or null.
export function DDarrowFamily(wire) {
  if (!wire || wire.automatic || !wire.from || !wire.to || wire.from === wire.to) return null;
  const { start, end } = DDarrowEnds(wire);
  if (end && !start) return { parent: wire.from, child: wire.to };
  if (start && !end) return { parent: wire.to, child: wire.from };
  return null;
}
// Every note's parents and sub-notes, from the lines between notes.
export function DDnoteFamily(edges = [], isNote = () => true) {
  const family = new Map();
  const get = (ref) => family.get(ref) || (family.set(ref, { parents: [], children: [] }), family.get(ref));
  for (const wire of edges) {
    const f = DDarrowFamily(wire);
    if (!f || !isNote(f.parent) || !isNote(f.child)) continue;
    const p = get(f.parent), c = get(f.child);
    if (!p.children.includes(f.child)) p.children.push(f.child);
    if (!c.parents.includes(f.parent)) c.parents.push(f.parent);
  }
  return family;
}
// Everything under a note: its sub-notes, theirs, and so on.
export function DDnoteBranch(family, ref) {
  const out = new Set([ref]), queue = [ref];
  while (queue.length) for (const child of family.get(queue.shift())?.children || []) if (!out.has(child)) (out.add(child), queue.push(child));
  return out;
}

// The look of a parent note. All of them stay outside the paper.
export const DDparentLooks = [
  ["stack", "Soft stack", "Two sheets peek out behind it"],
  ["pages", "Page edges", "Thin page edges under it"],
  ["halo", "Soft ring", "A soft ring of its own color"],
];
const LOOK = "debug-day:parent-look";
export function DDparentLook() {
  try { const v = localStorage.getItem(LOOK); return DDparentLooks.some(([id]) => id === v) ? v : "stack"; } catch { return "stack"; }
}
export function DDsetParentLook(value) {
  try { localStorage.setItem(LOOK, value); } catch {}
}

// Under a note: its tags, how many sub-notes it holds and, while it is picked,
// its parent and sub-notes (a click goes there). The paper itself stays as it is.
export function DDNoteUnder({ React: R, node, tags, family, titleOf, selected, editing, suggestions, onJump, onTags, onTagsDone, onPick }) {
  const h = R.createElement, kids = family?.children || [], parents = family?.parents || [];
  if (!tags.length && !kids.length && !(selected && parents.length) && !editing) return null;
  const name = (ref) => {
    const s = String(titleOf(ref) || "").replace(/\*\*|~~/g, "").replace(/^\s*- \[[ xX]\]\s*/gm, "").replace(/\s+/g, " ").trim();
    return s.length > 22 ? s.slice(0, 21) + "…" : s || "Untitled note";
  };
  const chip = (ref, mark) => h("button", { type: "button", key: ref, className: "dd-family-chip", dir: "auto", "data-family-ref": ref, title: "Go to " + name(ref),
    onClick: (e) => { e.stopPropagation(); onJump(ref); } }, mark + " " + name(ref));
  return h("div", { className: "dd-note-under", "data-note-under": node.id, onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation() },
    h("div", { className: "dd-note-under-row" },
      editing
        ? h(DDTagEditor, { React: R, tags, suggestions, onChange: onTags, onClose: onTagsDone })
        : h(DDTagChips, { React: R, tags, onPick }),
      kids.length > 0 && !editing && h("span", { className: "dd-subnote-count", title: kids.length === 1 ? "Holds 1 sub-note" : "Holds " + kids.length + " sub-notes", "aria-label": kids.length === 1 ? "1 sub-note" : kids.length + " sub-notes" },
        h("svg", { width: 12, height: 12, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M5 3v8a3 3 0 003 3h8M13 10.5l3.5 3.5-3.5 3.5" })),
        kids.length)),
    selected && !editing && (parents.length > 0 || kids.length > 0) && h("div", { className: "dd-note-family", role: "group", "aria-label": "Note family" },
      parents.length > 0 && h("span", null, h("small", null, "Part of"), parents.slice(0, 3).map((ref) => chip(ref, "↑"))),
      kids.length > 0 && h("span", null, h("small", null, kids.length === 1 ? "Sub-note" : "Sub-notes"), kids.slice(0, 6).map((ref) => chip(ref, "↳")), kids.length > 6 && h("small", null, "+" + (kids.length - 6)))));
}

// Tags and family for the notes on a board. `ctx` comes from the board.
export function DDuseNoteTools(ctx) {
  const R = ctx.React, h = R.createElement;
  const [editing, setEditing] = R.useState(null), [look, setLook] = R.useState(DDparentLook), ctxRef = R.useRef(ctx);
  ctxRef.current = ctx;
  const lifeItems = ctx.items;
  const tags = R.useMemo(() => {
    const m = new Map();
    for (const n of ctx.day.notes || []) if (n.kind !== "emoji") { const t = DDnoteTags(n); if (t.length) m.set("sticky:" + n.id, t); }
    for (const i of lifeItems) if (i.type === "sticky") { const t = DDnoteTags(i); if (t.length) m.set("life:" + i.id, t); }
    return m;
  }, [ctx.day.notes, lifeItems]);
  const family = R.useMemo(() => DDnoteFamily(ctx.layout.edges, (ref) => ctx.layout.map.get(ref)?.kind === "sticky"), [ctx.layout]);
  const suggestions = R.useMemo(() => (editing ? DDallTags({ ...(ctx.days || {}), [ctx.day.date]: ctx.day }, ctx.setup) : []), [editing]);
  // A note that went away stops being edited.
  R.useEffect(() => { if (editing && !ctx.layout.map.has(editing)) setEditing(null); }, [ctx.layout, editing]);
  const titleOf = (ref) => ctx.layout.map.get(ref)?.title || "";
  // On a phone the tag field opens as a sheet at the bottom, big enough to type in.
  const phone = typeof matchMedia === "function" && matchMedia("(max-width:700px)").matches;
  const doneTags = () => { setEditing(null); ctxRef.current.viewport.current?.focus({ preventScroll: true }); };
  function setTags(ref, next) {
    ctxRef.current.commit((d) => {
      const life = ref.startsWith("life:"), id = ref.slice(life ? 5 : 7), list = life ? d.__life.items : d.notes;
      const note = (list || []).find((n) => n.id === id);
      if (note) DDsetNoteTags(note, next);
      return d;
    }, null);
  }
  function jump(ref) {
    const c = ctxRef.current, lifeId = ref.startsWith("life:") ? ref.slice(5) : undefined;
    c.mark();
    c.reveal({ id: ref, lifeId, kind: "sticky", title: titleOf(ref) });
  }
  return {
    tags, family, look,
    setLook: (value) => { DDsetParentLook(value); setLook(value); },
    editing,
    editTags: (ref) => { ctxRef.current.finishEdit?.(); setEditing(ref); },
    stopTags: () => setEditing(null),
    tagsOf: (ref) => tags.get(ref) || [],
    setTags,
    // On the note's own element: the parent look (outside its paper).
    attrs: (node) => (family.get(node.id)?.children.length ? { "data-parent-look": look } : {}),
    // Under the note: tags, sub-note count and (when picked) its family.
    under: (node, selected) => h(DDNoteUnder, {
      React: R, node, tags: tags.get(node.id) || [], family: family.get(node.id), titleOf, selected, editing: editing === node.id && !phone, suggestions,
      onJump: jump, onTags: (next) => setTags(node.id, next), onTagsDone: doneTags,
      onPick: (tag) => ctxRef.current.search("#" + tag),
    }),
    // Phone: the tag sheet.
    screen: () => phone && editing && ctx.layout.map.has(editing) && h("section", { className: "dd-note-tag-sheet", role: "dialog", "aria-label": "Note tags",
      onPointerDown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() },
      h("header", null, h("small", null, "Tags"), h("b", { dir: "auto" }, String(titleOf(editing) || "Note").replace(/\*\*|~~/g, "").replace(/\s+/g, " ").trim().slice(0, 40))),
      h(DDTagEditor, { React: R, key: editing, tags: tags.get(editing) || [], suggestions, onChange: (next) => setTags(editing, next), onClose: doneTags })),
  };
}

export const DDnoteFamilyCSS = `
.b6 .b4-sticky[data-parent-look=stack]:not(.b4-plain){box-shadow:0 3px 6px #0002,4px 4px 0 -1px color-mix(in srgb,var(--node-color) 84%,#fff),4px 4px 0 0 #00000026,8px 8px 0 -2px color-mix(in srgb,var(--node-color) 66%,#fff),8px 8px 0 -1px #0000001f!important}
.b6 .b4-sticky[data-parent-look=pages]:not(.b4-plain){box-shadow:0 3px 6px #0002,0 4px 0 -1px color-mix(in srgb,var(--node-color) 82%,#fff),0 4px 0 0 #00000028,0 8px 0 -2px color-mix(in srgb,var(--node-color) 64%,#fff),0 8px 0 -1px #0000001f!important}
.b6 .b4-sticky[data-parent-look=halo]:not(.b4-plain){box-shadow:0 3px 6px #0002,0 0 0 5px color-mix(in srgb,var(--node-color) 34%,transparent),0 0 0 6px color-mix(in srgb,var(--node-color) 60%,#0002)!important}
.dd-note-under{position:absolute;left:0;top:calc(100% + 14px);width:100%;display:flex;flex-direction:column;gap:6px;transform:scale(clamp(1,var(--b4-inverse,1),1.8));transform-origin:0 0;z-index:4;pointer-events:none;color:var(--ink)}
.dd-note-under-row{display:flex;align-items:flex-start;gap:6px;min-width:0}
.dd-note-under-row>.dd-note-tags{flex:1;pointer-events:auto}
.dd-note-under .dd-note-tag-editor{pointer-events:auto}
.dd-subnote-count{margin-inline-start:auto;display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--node-color) 45%,var(--paper));color:var(--ink);font:600 11px/18px var(--sans);box-shadow:inset 0 0 0 1px #0000001a;pointer-events:auto;white-space:nowrap}
.dd-note-family{display:flex;flex-direction:column;gap:4px;pointer-events:auto}
.dd-note-family>span{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.dd-note-family small{font:500 10px/18px var(--sans);color:var(--ink-3,#777);margin-inline-end:2px}
.dd-family-chip{all:unset;box-sizing:border-box;cursor:pointer;max-width:100%;padding:2px 8px;border-radius:8px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);font:500 11px/18px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-family-chip:hover,.dd-family-chip:focus-visible{border-color:var(--board-accent,#0D99FF);color:var(--board-accent,#0D99FF)}
.b4-node[data-member]:not(.selected) .dd-note-under{display:none}
.dd-note-tag-sheet{position:absolute;left:8px;right:8px;bottom:70px;z-index:110;display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:16px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);box-shadow:0 14px 40px -12px #0007}
.dd-note-tag-sheet header{display:flex;align-items:baseline;gap:8px;padding:0 4px;min-width:0}
.dd-note-tag-sheet header small{color:var(--ink-3,#777);font:500 11px var(--sans)}
.dd-note-tag-sheet header b{font:600 13px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-note-tag-sheet .dd-note-tag-editor{max-width:none;min-width:0;border:0;box-shadow:none;padding:0;background:none}
.dd-note-tag-sheet .dd-note-tag-editor input{font-size:16px;height:40px}
@media(pointer:coarse){.dd-family-chip{padding:8px 10px}}
`;
