// Parent notes and sub-notes (5.36). Nothing new is saved: they come from the
// arrows already on the board. An arrow A → B makes B a sub-note of A.
// A line with no arrowhead, or arrows at both ends, says nothing about family.
// A parent note carries a small badge on its corner with the count of its
// sub-notes (5.39); a click on it shows the family. Nothing sits under a note:
// its tags sit above it, in their own colours.

import { DDTagChips, DDTagEditor, DDnoteTags, DDsetNoteTags, DDtagCounts, DDtagList, DDtagKey, DDtagSwapDay, DDtagSwapList } from "./note-tags.js";

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
  ["badge", "Badge only", "A small count on its corner"],
  ["stack", "Soft stack", "Two sheets peek out behind it"],
  ["pages", "Page edges", "Thin page edges under it"],
  ["halo", "Soft ring", "A soft ring of its own color"],
];
const LOOK = "debug-day:parent-look";
export function DDparentLook() {
  try { const v = localStorage.getItem(LOOK); return DDparentLooks.some(([id]) => id === v) ? v : "badge"; } catch { return "badge"; }
}
export function DDsetParentLook(value) {
  try { localStorage.setItem(LOOK, value); } catch {}
}

// On a note: its tags above it, and a badge on its corner when it holds
// sub-notes (or, while picked, belongs to a parent). A click on the badge
// shows the family; a click there goes to that note. The paper stays as it is.
export function DDNoteUnder({ React: R, node, tags, family, titleOf, selected, editing, suggestions, counts, colors, onColor, onJump, onTags, onTagsDone, onPick, everywhere }) {
  const h = R.createElement, kids = family?.children || [], parents = family?.parents || [], [open, setOpen] = R.useState(false);
  const edit = R.useRef(null), [place, setPlace] = R.useState(null);
  R.useEffect(() => { if (!selected) setOpen(false); }, [selected]);
  // The tag menu opens under the note; where the screen ends (or the dock
  // sits) it opens beside the note instead, so all of it can be reached.
  R.useLayoutEffect(() => {
    if (!editing) { setPlace(null); return; }
    const el = edit.current, view = el?.closest(".b2-viewport");
    if (!el || !view) return;
    const box = el.getBoundingClientRect(), v = view.getBoundingClientRect(), note = el.parentElement.getBoundingClientRect();
    if (box.bottom <= v.bottom - 84) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const after = rtl ? note.left - box.width - 12 >= v.left : note.right + box.width + 12 <= v.right;
    setPlace(after ? "side" : "other-side");
  }, [editing]);
  const badge = kids.length > 0 || (selected && parents.length > 0);
  if (!tags.length && !badge && !editing) return null;
  const name = (ref) => {
    const s = String(titleOf(ref) || "").replace(/\*\*|~~/g, "").replace(/^\s*- \[[ xX]\]\s*/gm, "").replace(/\s+/g, " ").trim();
    return s.length > 22 ? s.slice(0, 21) + "…" : s || "Untitled note";
  };
  const stop = (e) => e.stopPropagation();
  const chip = (ref, mark) => h("button", { type: "button", key: ref, className: "dd-family-chip", dir: "auto", "data-family-ref": ref, title: "Go to " + name(ref),
    onClick: (e) => { e.stopPropagation(); setOpen(false); onJump(ref); } }, mark + " " + name(ref));
  const label = kids.length ? (kids.length === 1 ? "Holds 1 sub-note" : "Holds " + kids.length + " sub-notes") : "Part of " + name(parents[0]);
  return h(R.Fragment, null,
    tags.length > 0 && !editing && h("div", { className: "dd-note-above", "data-note-under": node.id, onPointerDown: stop, onDoubleClick: stop },
      // A picked note's tags have a × (and Delete on a focused tag), as on Milanote.
      h(DDTagChips, { React: R, tags, onPick, colors, onColor, dot: false, onRemove: selected ? (tag) => onTags(tags.filter((t) => DDtagKey(t) !== DDtagKey(tag))) : undefined })),
    // While you add tags the field opens just under the note, so it is never
    // hidden behind the top bar; it goes away when you are done.
    editing && h("div", { ref: edit, className: "dd-note-tag-edit", "data-place": place || undefined, "data-note-under": node.id, onPointerDown: stop, onDoubleClick: stop },
      h(DDTagEditor, { React: R, tags, suggestions, counts, colors, onColor, ...everywhere, onChange: onTags, onClose: onTagsDone })),
    badge && h("button", { type: "button", className: "dd-subnote-count dd-family-badge", "data-family-badge": node.id, "aria-expanded": open, title: label, "aria-label": label,
      onPointerDown: stop, onDoubleClick: stop, onClick: (e) => { e.stopPropagation(); setOpen(!open); } },
      kids.length
        ? [h("svg", { key: "i", width: 11, height: 11, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M5 3v8a3 3 0 003 3h8M13 10.5l3.5 3.5-3.5 3.5" })), kids.length]
        : "↑"),
    badge && open && h("div", { className: "dd-note-family", role: "group", "aria-label": "Note family", onPointerDown: stop, onDoubleClick: stop },
      parents.length > 0 && h("span", null, h("small", null, "Part of"), parents.slice(0, 3).map((ref) => chip(ref, "↑"))),
      kids.length > 0 && h("span", null, h("small", null, kids.length === 1 ? "Sub-note" : "Sub-notes"), kids.slice(0, 6).map((ref) => chip(ref, "↳")), kids.length > 6 && h("small", null, "+" + (kids.length - 6)))));
}

// Tags and family for the notes on a board. `ctx` comes from the board.
export function DDuseNoteTools(ctx) {
  const R = ctx.React, h = R.createElement;
  const [editing, setEditing] = R.useState(null), [group, setGroup] = R.useState(null), [look, setLook] = R.useState(DDparentLook), ctxRef = R.useRef(ctx);
  ctxRef.current = ctx;
  const lifeItems = ctx.items;
  const tags = R.useMemo(() => {
    const m = new Map();
    for (const n of ctx.day.notes || []) if (n.kind !== "emoji") { const t = DDnoteTags(n); if (t.length) m.set("sticky:" + n.id, t); }
    for (const i of lifeItems) if (i.type === "sticky") { const t = DDnoteTags(i); if (t.length) m.set("life:" + i.id, t); }
    return m;
  }, [ctx.day.notes, lifeItems]);
  const family = R.useMemo(() => DDnoteFamily(ctx.layout.edges, (ref) => ctx.layout.map.get(ref)?.kind === "sticky"), [ctx.layout]);
  // Every tag and how often it is used, kept fresh while the tag menu is open.
  const open = !!(editing || group);
  const counts = R.useMemo(() => (open ? DDtagCounts({ ...(ctx.days || {}), [ctx.day.date]: ctx.day }, ctx.setup) : []), [open, ctx.days, ctx.day, ctx.setup]);
  const suggestions = R.useMemo(() => counts.map((t) => t.tag), [counts]);
  const colors = ctx.setup?.life?.tagColors || {};
  // A note that went away stops being edited.
  R.useEffect(() => { if (editing && !ctx.layout.map.has(editing)) setEditing(null); }, [ctx.layout, editing]);
  R.useEffect(() => { if (group && group.filter((ref) => ctx.layout.map.has(ref)).length < 2) setGroup(null); }, [ctx.layout, group]);
  const titleOf = (ref) => ctx.layout.map.get(ref)?.title || "";
  // On a phone the tag field opens as a sheet at the bottom, big enough to type in.
  const phone = typeof matchMedia === "function" && matchMedia("(max-width:700px)").matches;
  const doneTags = () => { setEditing(null); setGroup(null); ctxRef.current.viewport.current?.focus({ preventScroll: true }); };
  const find = (d, ref) => {
    const life = ref.startsWith("life:"), id = ref.slice(life ? 5 : 7);
    return ((life ? d.__life.items : d.notes) || []).find((n) => n.id === id);
  };
  function setTags(ref, next) {
    ctxRef.current.commit((d) => {
      const note = find(d, ref);
      if (note) DDsetNoteTags(note, next);
      return d;
    }, null);
  }
  // Several notes at once: every tag on any of them shows; adding a tag adds it
  // to all, removing one takes it off all. One step to undo.
  const groupTags = (refs) => DDtagList(refs.flatMap((ref) => tags.get(ref) || []));
  function setGroupTags(refs, next) {
    const before = groupTags(refs), keys = new Set(DDtagList(next).map(DDtagKey));
    const added = DDtagList(next).filter((t) => !before.some((b) => DDtagKey(b) === DDtagKey(t)));
    const removed = new Set(before.filter((b) => !keys.has(DDtagKey(b))).map(DDtagKey));
    ctxRef.current.commit((d) => {
      for (const ref of refs) {
        const note = find(d, ref);
        if (note) DDsetNoteTags(note, [...DDnoteTags(note).filter((t) => !removed.has(DDtagKey(t))), ...added]);
      }
      return d;
    }, null);
  }
  // A tag's colour, for the whole planner (null gives it back its own colour).
  function setColor(tag, color) {
    ctxRef.current.commit((d) => {
      const next = { ...(d.__life.tagColors || {}) }, key = DDtagKey(tag);
      if (color) next[key] = color; else delete next[key];
      d.__life.tagColors = next;
      return d;
    }, null);
  }
  // Rename a tag (or, with no name, delete it) everywhere: this day and the
  // Feed in one step you can undo, then every other day and Later.
  function retag(from, to) {
    const c = ctxRef.current, name = to ? DDtagList([to])[0] : null, key = DDtagKey(from);
    if (to && (!name || name === from)) return;
    const n = counts.find((t) => DDtagKey(t.tag) === key)?.n || 0;
    c.commit((d) => {
      const day = DDtagSwapDay(d, from, name);
      d.blocks = day.blocks; d.notes = day.notes;
      d.__life.items = DDtagSwapList(d.__life.items || [], from, name);
      const colors = { ...(d.__life.tagColors || {}) }, own = colors[key];
      delete colors[key];
      if (name && own && !colors[DDtagKey(name)]) colors[DDtagKey(name)] = own;
      d.__life.tagColors = colors;
      return d;
    }, name ? "Renamed #" + from + " to #" + name : n > 1 ? "#" + from + " taken off " + n + " things" : "Deleted #" + from);
    for (const [date, day] of Object.entries(c.days || {})) {
      if (date !== c.day.date && DDtagSwapDay(day, from, name) !== day) c.onUpdateDayOnDate?.(date, (now) => DDtagSwapDay(now, from, name));
    }
    if (DDtagSwapList(c.setup?.later, from, name) !== c.setup?.later) c.onUpdateSetup?.((s) => ({ ...s, later: DDtagSwapList(s.later, from, name) }));
  }
  const everywhere = {
    onRename: (from, to) => retag(from, to),
    onDelete: (tag) => retag(tag, null),
    onFind: (tag) => { const c = ctxRef.current; setEditing(null); setGroup(null); c.search("#" + tag); },
  };
  function jump(ref) {
    const c = ctxRef.current, lifeId = ref.startsWith("life:") ? ref.slice(5) : undefined;
    c.mark();
    c.reveal({ id: ref, lifeId, kind: "sticky", title: titleOf(ref) });
  }
  return {
    tags, family, look,
    setLook: (value) => { DDsetParentLook(value); setLook(value); },
    editing,
    editTags: (ref) => { ctxRef.current.finishEdit?.(); if (Array.isArray(ref) && ref.length > 1) { setEditing(null); setGroup(ref); } else { setGroup(null); setEditing(Array.isArray(ref) ? ref[0] : ref); } },
    stopTags: () => { setEditing(null); setGroup(null); },
    group,
    setColor,
    tagsOf: (ref) => tags.get(ref) || [],
    setTags,
    // On the note's own element: the parent look (outside its paper).
    attrs: (node) => (family.get(node.id)?.children.length && look !== "badge" ? { "data-parent-look": look } : {}),
    // On the note: tags above it, the family badge on its corner.
    under: (node, selected) => h(DDNoteUnder, {
      React: R, node, tags: tags.get(node.id) || [], family: family.get(node.id), titleOf, selected, editing: editing === node.id && !phone, suggestions, counts, everywhere, colors, onColor: setColor,
      onJump: jump, onTags: (next) => setTags(node.id, next), onTagsDone: doneTags,
      onPick: (tag) => ctxRef.current.search("#" + tag),
    }),
    // Several notes picked: one tag panel for all of them (a sheet on a phone).
    screen: () => group ? h("section", { className: phone ? "dd-note-tag-sheet" : "dd-note-tag-group", "data-tag-group": group.length, role: "dialog", "aria-label": "Tags for " + group.length + " notes",
      onPointerDown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() },
      h("header", null, h("small", null, "Tags"), h("b", null, group.length + " notes")),
      h(DDTagEditor, { React: R, key: group.join("|"), label: "Tags for these notes", tags: groupTags(group), suggestions, counts, ...everywhere, colors, onColor: setColor, onChange: (next) => setGroupTags(group, next), onClose: doneTags }))
    : phone && editing && ctx.layout.map.has(editing) && h("section", { className: "dd-note-tag-sheet", role: "dialog", "aria-label": "Note tags",
      onPointerDown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() },
      h("header", null, h("small", null, "Tags"), h("b", { dir: "auto" }, String(titleOf(editing) || "Note").replace(/\*\*|~~/g, "").replace(/\s+/g, " ").trim().slice(0, 40))),
      h(DDTagEditor, { React: R, key: editing, tags: tags.get(editing) || [], suggestions, counts, ...everywhere, colors, onColor: setColor, onChange: (next) => setTags(editing, next), onClose: doneTags })),
  };
}

export const DDnoteFamilyCSS = `
.b6 .b4-sticky[data-parent-look=stack]:not(.b4-plain){box-shadow:0 3px 6px #0002,4px 4px 0 -1px color-mix(in srgb,var(--node-color) 84%,#fff),4px 4px 0 0 #00000026,8px 8px 0 -2px color-mix(in srgb,var(--node-color) 66%,#fff),8px 8px 0 -1px #0000001f!important}
.b6 .b4-sticky[data-parent-look=pages]:not(.b4-plain){box-shadow:0 3px 6px #0002,0 4px 0 -1px color-mix(in srgb,var(--node-color) 82%,#fff),0 4px 0 0 #00000028,0 8px 0 -2px color-mix(in srgb,var(--node-color) 64%,#fff),0 8px 0 -1px #0000001f!important}
.b6 .b4-sticky[data-parent-look=halo]:not(.b4-plain){box-shadow:0 3px 6px #0002,0 0 0 5px color-mix(in srgb,var(--node-color) 34%,transparent),0 0 0 6px color-mix(in srgb,var(--node-color) 60%,#0002)!important}
.dd-note-above{position:absolute;inset-inline-start:0;bottom:calc(100% + 8px);width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;transform:scale(clamp(1,var(--b4-inverse,1),1.8));transform-origin:0 100%;z-index:4;pointer-events:none;color:var(--ink)}
[dir=rtl] .dd-note-above{transform-origin:100% 100%}
.dd-note-above>.dd-note-tags{pointer-events:auto}
.dd-note-above .dd-tag-remove{display:none}
.dd-note-above .dd-tag:hover .dd-tag-remove,.dd-note-above .dd-tag:focus-within .dd-tag-remove{display:inline}
.dd-note-tag-edit{position:absolute;inset-inline-start:0;top:calc(100% + 12px);z-index:6;transform:scale(clamp(1,var(--b4-inverse,1),1.8));transform-origin:0 0}
[dir=rtl] .dd-note-tag-edit{transform-origin:100% 0}
.dd-note-tag-edit[data-place]{top:auto;bottom:0;transform-origin:0 100%}
.dd-note-tag-edit[data-place=side]{inset-inline-start:calc(100% + 12px)}
.dd-note-tag-edit[data-place=other-side]{inset-inline-start:auto;inset-inline-end:calc(100% + 12px);transform-origin:100% 100%}
.dd-note-tag-edit .dd-tag-colors{margin-top:6px}
.dd-note-above .dd-tag-colors{position:absolute;bottom:calc(100% + 4px);inset-inline-start:0}
.dd-family-badge{all:unset;box-sizing:border-box;position:absolute;top:-10px;inset-inline-end:12px;z-index:6;cursor:pointer;display:inline-flex;align-items:center;gap:3px;min-width:22px;height:20px;padding:0 7px;justify-content:center;border-radius:999px;background:#242326;color:#fff;font:700 11px/20px var(--sans);box-shadow:0 2px 6px #0004,0 0 0 2px var(--node-color,#fff);transform:scale(clamp(1,var(--b4-inverse,1),1.8));transform-origin:100% 50%;white-space:nowrap}
.dd-family-badge:hover,.dd-family-badge:focus-visible,.dd-family-badge[aria-expanded=true]{background:var(--board-selection,#0D99FF)}
.dd-note-family{position:absolute;top:16px;inset-inline-start:8px;z-index:7;width:max-content;max-width:280px;padding:8px;border-radius:10px;background:var(--wash,var(--paper));border:1px solid var(--rule-2,#0002);box-shadow:0 10px 24px -10px #0006;display:flex;flex-direction:column;gap:4px;pointer-events:auto;color:var(--ink);transform:scale(clamp(1,var(--b4-inverse,1),1.8));transform-origin:0 0}
[dir=rtl] .dd-note-family{transform-origin:100% 0}
.dd-note-tag-group{position:absolute;z-index:66;top:128px;left:50%;transform:translateX(-50%);width:min(360px,calc(100% - 24px));display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:var(--wash,var(--paper));color:var(--ink);border:1px solid var(--rule-2,#0002);box-shadow:0 12px 30px -14px #0006}
.dd-note-tag-group header{display:flex;gap:8px;align-items:baseline}
.dd-note-tag-group .dd-note-tag-editor{border:0;box-shadow:none;padding:0;max-width:none;background:none}
.dd-note-family>span{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.dd-note-family small{font:500 10px/18px var(--sans);color:var(--ink-3,#777);margin-inline-end:2px}
.dd-family-chip{all:unset;box-sizing:border-box;cursor:pointer;max-width:100%;padding:2px 8px;border-radius:8px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);font:500 11px/18px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-family-chip:hover,.dd-family-chip:focus-visible{border-color:var(--board-accent,#0D99FF);color:var(--board-accent,#0D99FF)}
.dd-note-tag-sheet{position:absolute;left:8px;right:8px;bottom:70px;z-index:110;display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:16px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);box-shadow:0 14px 40px -12px #0007}
.dd-note-tag-sheet header{display:flex;align-items:baseline;gap:8px;padding:0 4px;min-width:0}
.dd-note-tag-sheet header small{color:var(--ink-3,#777);font:500 11px var(--sans)}
.dd-note-tag-sheet header b{font:600 13px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-note-tag-sheet .dd-note-tag-editor{max-width:none;min-width:0;border:0;box-shadow:none;padding:0;background:none}
.dd-note-tag-sheet .dd-note-tag-editor input{font-size:16px;height:40px}
@media(pointer:coarse){.dd-family-chip{padding:8px 10px}}
`;
