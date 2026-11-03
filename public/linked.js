// Linked copies (5.34): one note or one section, seen in many places.
//
// A synced note keeps the same words, color, look and tags in every copy, on any
// day and in the Feed. Each copy keeps its own place and size.
// A synced section is the same section in two places: its name, color, size and
// everything inside it (notes, sections, their places and the lines between them)
// match in every copy. Each copy keeps its own place, parent and fold.
//
// Every copy is ordinary data, so Plan, Lanes, search, sync, export and MCP read
// it as it is. DDsyncCopies runs after each change and makes the other copies
// match the one that changed. Nothing here touches how a note looks.
import { DDlifeFit } from "./life-board.js";

const ID = /^[\w-]{1,64}$/;
// What a note's copies share. Size and text size stay with each copy (a resized
// note scales its words), and so does where it sits.
const LOOK = ["textAlign", "plain", "textColor", "opacity"];

export function DDsyncNewId() {
  return "s-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
export const DDsyncValid = (value) => typeof value === "string" && ID.test(value);

// A short, stable id for a copy's own item: the same copy and key always get the
// same id, so two devices filling the same copy never make doubles.
function hash(text) {
  let a = 5381, b = 52711;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = (a * 33) ^ c;
    b = (b * 31) ^ c;
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
export function DDsyncItemId(copyId, key) {
  return "lf-s" + hash(copyId + "|" + key);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pickLook = (style) => {
  const out = {};
  for (const k of LOOK) if (style && style[k] !== undefined && style[k] !== null) out[k] = style[k];
  return out;
};

// ---- Notes ---------------------------------------------------------------

function dayStyle(day, id) {
  return day?.canvas?.board4?.styles?.["sticky:" + id] || {};
}
function noteContent(day, note) {
  const style = dayStyle(day, note.id);
  return { text: note.text || "", color: style.fill || note.color || "", look: pickLook(style), tags: Array.isArray(note.tags) ? note.tags : [] };
}
function lifeContent(item) {
  return { text: item.text || "", color: item.color || "", look: pickLook(item.style), tags: Array.isArray(item.tags) ? item.tags : [] };
}
function withLook(style, look) {
  const next = { ...(style || {}) };
  for (const k of LOOK) delete next[k];
  return { ...next, ...look };
}
function writeDayNote(day, id, content) {
  const notes = day.notes.map((n) => {
    if (n.id !== id) return n;
    const next = { ...n, text: content.text, color: content.color || n.color };
    if (content.tags.length) next.tags = [...content.tags];
    else delete next.tags;
    return next;
  });
  const board = day.canvas?.board4, ref = "sticky:" + id, old = board?.styles?.[ref] || {};
  let style = withLook(old, content.look);
  if (old.fill) style.fill = content.color || old.fill;
  if (!Object.keys(style).length && !board?.styles?.[ref]) return { ...day, notes };
  return { ...day, notes, canvas: { ...(day.canvas || {}), board4: { ...(board || {}), styles: { ...(board?.styles || {}), [ref]: style } } } };
}
function writeLifeNote(item, content) {
  const next = { ...item, text: content.text, color: content.color || item.color };
  const style = withLook(item.style, content.look);
  if (Object.keys(style).length) next.style = style;
  else delete next.style;
  if (content.tags.length) next.tags = [...content.tags];
  else delete next.tags;
  return next;
}

// Which synced notes changed in this step, and what they say now. A copy that
// just arrived (pasted later, on another day) takes what its group says now.
function changedNotes(next, before) {
  const leaders = new Map(), fresh = new Set();
  const life = next.setup?.life, lifeBefore = before?.setup?.life;
  if (life && life !== lifeBefore) {
    const old = new Map((lifeBefore?.items || []).map((i) => [i.id, i]));
    for (const it of life.items || []) {
      if (it.type !== "sticky" || !DDsyncValid(it.syncId) || leaders.has(it.syncId)) continue;
      const was = old.get(it.id);
      if (!was) fresh.add(it.syncId);
      else if (was.syncId === it.syncId && !same(lifeContent(was), lifeContent(it))) leaders.set(it.syncId, lifeContent(it));
    }
  }
  for (const [date, day] of Object.entries(next.days || {})) {
    const prev = before?.days?.[date];
    if (!day || day === prev || !Array.isArray(day.notes)) continue;
    const old = new Map((prev?.notes || []).map((n) => [n.id, n]));
    for (const note of day.notes) {
      if (!DDsyncValid(note.syncId) || leaders.has(note.syncId)) continue;
      const was = old.get(note.id);
      if (!was) fresh.add(note.syncId);
      else if (was.syncId === note.syncId && !same(noteContent(prev, was), noteContent(day, note))) leaders.set(note.syncId, noteContent(day, note));
    }
  }
  for (const syncId of fresh) {
    if (leaders.has(syncId)) continue;
    const elder = elderContent(next, before, syncId);
    if (elder) leaders.set(syncId, elder);
  }
  return leaders;
}
// What a group said before this step: the words of a copy that was already there.
function elderContent(next, before, syncId) {
  const lifeBefore = new Set((before?.setup?.life?.items || []).map((i) => i.id));
  for (const it of next.setup?.life?.items || []) if (it.type === "sticky" && it.syncId === syncId && lifeBefore.has(it.id)) return lifeContent(it);
  for (const [date, day] of Object.entries(next.days || {})) {
    const had = new Set((before?.days?.[date]?.notes || []).map((n) => n.id));
    for (const note of day?.notes || []) if (note.syncId === syncId && had.has(note.id)) return noteContent(day, note);
  }
  return null;
}

function syncNotes(next, before) {
  const leaders = changedNotes(next, before);
  if (!leaders.size) return next;
  let days = null, items = null;
  for (const [date, day] of Object.entries(next.days || {})) {
    let fixed = day;
    for (const note of day?.notes || []) {
      const content = leaders.get(note.syncId);
      if (content && !same(noteContent(fixed, note), content)) fixed = writeDayNote(fixed, note.id, content);
    }
    if (fixed !== day) (days ||= { ...next.days })[date] = fixed;
  }
  const life = next.setup?.life;
  if (life?.items) {
    const list = life.items.map((it) => {
      const content = it.type === "sticky" && leaders.get(it.syncId);
      return content && !same(lifeContent(it), content) ? writeLifeNote(it, content) : it;
    });
    if (list.some((it, i) => it !== life.items[i])) items = list;
  }
  if (!days && !items) return next;
  return {
    ...next,
    ...(days ? { days } : {}),
    ...(items ? { setup: { ...next.setup, life: { ...life, items } } } : {}),
  };
}

// ---- Sections --------------------------------------------------------------

function subtree(items, rootId) {
  const out = [], inside = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const it of items) if (!inside.has(it.id) && inside.has(it.parent)) { inside.add(it.id); out.push(it); grew = true; }
  }
  return out;
}
function ancestors(items, id) {
  const byId = new Map(items.map((i) => [i.id, i])), out = [];
  let p = byId.get(id)?.parent, hops = 0;
  while (p && hops++ < 60) { const it = byId.get(p); if (!it) break; out.push(it); p = it.parent; }
  return out;
}
const rootPart = (r) => ({ text: r.text || "", color: r.color || "", ownColor: !!r.ownColor, w: r.w, h: r.h, style: r.style || null, tags: r.tags || null });
// A copy's own fold is its own, so it is not part of what the copies share.
const itemPart = (it, parentKey) => {
  const { id, parent, syncKey, out, collapsed, ...rest } = it;
  return { ...rest, parentKey };
};
// Everything that makes two copies "the same section", by key.
function signature(life, root) {
  const items = life.items, kids = subtree(items, root.id), keyOf = new Map(kids.map((k) => [k.id, k.syncKey]));
  keyOf.set(root.id, "^");
  const rows = kids.map((k) => [k.syncKey, itemPart(k, keyOf.get(k.parent))]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const refs = new Map([...keyOf].map(([id, key]) => ["life:" + id, key]));
  const links = (life.links || []).filter((l) => refs.has(l.from) && refs.has(l.to))
    .map((l) => { const { id, from, to, ...rest } = l; return [refs.get(from), refs.get(to), rest]; })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify([rootPart(root), rows, links]);
}
// Every item inside a synced section has a key its copies share. New items get one.
function keyed(items, roots, beforeIds) {
  let list = items;
  for (const root of roots) {
    const seen = new Set();
    // An item that was already here keeps its key; a newcomer with a taken key gets its own.
    const kids = subtree(list, root.id).sort((a, b) => (beforeIds.has(b.id) ? 1 : 0) - (beforeIds.has(a.id) ? 1 : 0));
    const fix = new Map();
    for (const k of kids) {
      let key = DDsyncValid(k.syncKey) ? k.syncKey : "";
      if (!key || seen.has(key)) { key = DDsyncValid(k.id) ? k.id : "k" + hash(k.id); if (seen.has(key)) key = "k" + hash(k.id + root.id); fix.set(k.id, key); }
      seen.add(key);
    }
    if (fix.size) list = list.map((i) => (fix.has(i.id) ? { ...i, syncKey: fix.get(i.id) } : i));
  }
  return list;
}
// Make one copy match another: same name, size and insides, its own place.
function rebuild(life, from, to) {
  const items = life.items, source = subtree(items, from.id), current = subtree(items, to.id);
  const keys = new Set(source.map((k) => k.syncKey)), mine = new Map(current.map((k) => [k.syncKey, k]));
  const idFor = new Map([[from.id, to.id]]);
  for (const k of source) idFor.set(k.id, mine.get(k.syncKey)?.id || DDsyncItemId(to.id, k.syncKey));
  const gone = new Set(current.filter((k) => !keys.has(k.syncKey)).map((k) => k.id));
  const made = new Map(source.map((k) => {
    const { id, parent, out, ...rest } = k, old = mine.get(k.syncKey);
    return [idFor.get(k.id), { ...rest, id: idFor.get(k.id), parent: idFor.get(parent), ...(old?.collapsed !== undefined && k.type === "section" ? { collapsed: old.collapsed } : {}) }];
  }));
  const { text, color, ownColor, w, h, style, tags } = from;
  const root = { ...to, text, color, w, h };
  if (ownColor) root.ownColor = true; else delete root.ownColor;
  if (style) root.style = style; else delete root.style;
  if (tags) root.tags = tags; else delete root.tags;
  let next = items.filter((i) => !gone.has(i.id)).map((i) => (i.id === to.id ? root : made.has(i.id) ? made.get(i.id) : i));
  for (const [id, it] of made) if (!next.some((i) => i.id === id)) next.push(it);
  // Lines inside the section come along; lines to the world outside stay per copy.
  const inside = new Set([to.id, ...current.map((k) => k.id), ...made.keys()].map((id) => "life:" + id));
  const sourceRefs = new Set([from.id, ...source.map((k) => k.id)].map((id) => "life:" + id));
  const links = (life.links || []).filter((l) => !(inside.has(l.from) && inside.has(l.to)) && !gone.has(l.from.slice(5)) && !gone.has(l.to.slice(5)));
  for (const l of life.links || []) if (sourceRefs.has(l.from) && sourceRefs.has(l.to))
    links.push({ ...l, id: l.id + "~" + hash(to.id), from: "life:" + idFor.get(l.from.slice(5)), to: "life:" + idFor.get(l.to.slice(5)) });
  next = to.parent ? DDlifeFit(next, to.parent) : next;
  return { ...life, items: next, links };
}

function syncSections(next, before) {
  const life = next.setup?.life, lifeBefore = before?.setup?.life;
  if (!life?.items || life === lifeBefore) return next;
  let items = life.items;
  const groups = new Map();
  for (const it of items) if (it.type === "section" && DDsyncValid(it.syncId)) (groups.get(it.syncId) || groups.set(it.syncId, []).get(it.syncId)).push(it.id);
  if (![...groups.values()].some((g) => g.length > 1)) return next;
  // A copy placed inside another copy of itself would repeat forever: it leaves the group.
  const loose = new Set();
  for (const ids of groups.values()) for (const id of ids) if (ancestors(items, id).some((a) => a.syncId && a.syncId === items.find((i) => i.id === id).syncId)) loose.add(id);
  if (loose.size) items = items.map((i) => { if (!loose.has(i.id)) return i; const { syncId, ...rest } = i; return rest; });
  const beforeItems = lifeBefore?.items || [], beforeIds = new Set(beforeItems.map((i) => i.id));
  let state = { ...life, items };
  for (const [syncId, ids] of groups) {
    const roots = () => state.items.filter((i) => i.type === "section" && i.syncId === syncId);
    if (roots().length < 2) continue;
    state = { ...state, items: keyed(state.items, roots(), beforeIds) };
    const now = roots(), sigs = new Map(now.map((r) => [r.id, signature(state, r)]));
    if (new Set(sigs.values()).size < 2) continue;
    const old = lifeBefore ? new Map(beforeItems.filter((i) => i.syncId === syncId && i.type === "section").map((r) => [r.id, signature(lifeBefore, r)])) : new Map();
    // The copy that changed leads; if none did (a new copy, a fresh link), the oldest one does.
    const leader = now.find((r) => old.has(r.id) && old.get(r.id) !== sigs.get(r.id)) || now.find((r) => old.has(r.id)) || now[0];
    for (const r of now) if (r.id !== leader.id && sigs.get(r.id) !== sigs.get(leader.id)) {
      const lead = state.items.find((i) => i.id === leader.id), copy = state.items.find((i) => i.id === r.id);
      state = rebuild(state, lead, copy);
    }
  }
  if (state.items === life.items && state.links === life.links) return next;
  return { ...next, setup: { ...next.setup, life: state } };
}

// After every change: the copies of what changed match it again.
export function DDsyncCopies(next, before) {
  if (!next || !before || next === before) return next;
  try {
    return syncNotes(syncSections(next, before), before);
  } catch (error) {
    // Never lose a change because a copy could not follow it.
    console.warn("Debug Day: linked copies could not update", error);
    return next;
  }
}

// ---- Helpers for the board -------------------------------------------------

// Where the copies of one synced note or section are.
export function DDsyncPlaces(snapshot, syncId) {
  const out = [];
  if (!DDsyncValid(syncId)) return out;
  for (const it of snapshot?.setup?.life?.items || []) if (it.syncId === syncId) out.push({ kind: "life", id: it.id, type: it.type, parent: it.parent || "" });
  for (const [date, day] of Object.entries(snapshot?.days || {}))
    for (const n of day?.notes || []) if (n.syncId === syncId) out.push({ kind: "day", date, id: n.id });
  return out;
}

// Notes that already say the same words (made with Copy and Paste before), ready to link.
export function DDsyncSameNotes(snapshot, text, except = {}) {
  const words = String(text || "").trim(), out = [];
  if (!words) return out;
  for (const it of snapshot?.setup?.life?.items || [])
    if (it.type === "sticky" && it.id !== except.life && String(it.text || "").trim() === words) out.push({ kind: "life", id: it.id, syncId: it.syncId || "" });
  for (const [date, day] of Object.entries(snapshot?.days || {}))
    for (const n of day?.notes || [])
      if (n.kind !== "emoji" && !(date === except.date && n.id === except.note) && String(n.text || "").trim() === words) out.push({ kind: "day", date, id: n.id, syncId: n.syncId || "" });
  return out;
}

// Before a synced copy is made from a Feed note or section: it gets its link, and
// everything inside a section gets a key its twin will share.
export function DDsyncMarkLife(items, id) {
  const root = items.find((i) => i.id === id);
  if (!root) return items;
  const syncId = DDsyncValid(root.syncId) ? root.syncId : DDsyncNewId();
  const kids = new Set(root.type === "section" ? subtree(items, id).map((k) => k.id) : []), seen = new Set();
  return items.map((i) => {
    if (i.id === id) return i.syncId === syncId ? i : { ...i, syncId };
    if (!kids.has(i.id)) return i;
    const key = DDsyncValid(i.syncKey) && !seen.has(i.syncKey) ? i.syncKey : DDsyncValid(i.id) ? i.id : "k" + hash(i.id);
    seen.add(key);
    return key === i.syncKey ? i : { ...i, syncKey: key };
  });
}

// "Sync": notes that say the same words become copies of one note, and take its
// look. Notes already linked to any of them come along, so no group is split.
export function DDsyncJoin(snapshot, source, places, syncId = DDsyncNewId()) {
  const key = (p) => (p.kind === "life" ? "life:" + p.id : "day:" + p.date + ":" + p.id);
  const all = [source, ...places], chosen = new Set(all.map(key));
  const groups = new Set(all.map((p) => p.syncId).filter((g) => DDsyncValid(g) && g !== syncId));
  const life = snapshot.setup?.life, items = life?.items || [];
  let content = null;
  if (source.kind === "life") {
    const it = items.find((i) => i.id === source.id);
    content = it && lifeContent(it);
  } else {
    const day = snapshot.days?.[source.date], note = day?.notes?.find((n) => n.id === source.id);
    content = note && noteContent(day, note);
  }
  if (!content) return snapshot;
  const joins = (ref, current) => chosen.has(ref) || groups.has(current);
  let days = snapshot.days;
  for (const [date, day] of Object.entries(snapshot.days || {})) {
    let fixed = day;
    for (const note of day?.notes || []) {
      if (note.kind === "emoji" || !joins("day:" + date + ":" + note.id, note.syncId)) continue;
      fixed = { ...fixed, notes: fixed.notes.map((n) => (n.id === note.id ? { ...n, syncId } : n)) };
      if (!same(noteContent(fixed, note), content)) fixed = writeDayNote(fixed, note.id, content);
    }
    if (fixed !== day) days = { ...days, [date]: fixed };
  }
  const list = items.map((it) => (it.type === "sticky" && joins("life:" + it.id, it.syncId) ? writeLifeNote({ ...it, syncId }, content) : it));
  const changed = list.some((it, i) => it !== items[i]);
  return { ...snapshot, days, ...(changed ? { setup: { ...snapshot.setup, life: { ...life, items: list } } } : {}) };
}

// A copy that should stand on its own (Duplicate, Alt+drag) forgets its links.
export function DDsyncForget(data) {
  if (!data || typeof data !== "object") return data;
  const { syncId, syncKey, ...rest } = data;
  return rest;
}

// The small mark on a synced copy. It sits just outside the paper, above its
// top-right corner, so the note itself looks exactly the same.
const CSS = `.b6 .dd-sync-badge{--k:clamp(.9,var(--b4-inverse,1),3);position:absolute;right:2px;bottom:100%;margin:0 0 5px;display:inline-flex;align-items:center;gap:3px;height:20px;min-width:0;min-height:0;padding:0 7px 0 5px;border:1px solid color-mix(in srgb,var(--ink,#121211) 14%,transparent);border-radius:999px;background:var(--paper,#fff);color:color-mix(in srgb,var(--ink,#121211) 70%,transparent);font:600 11px/1 var(--sans,system-ui);box-shadow:0 2px 8px -5px #0005;transform:scale(var(--k));transform-origin:100% 100%;cursor:pointer;z-index:8}
.b6 .dd-sync-badge:hover,.b6 .dd-sync-badge:focus-visible{color:var(--ink,#121211);border-color:color-mix(in srgb,var(--ink,#121211) 30%,transparent)}
.b6 .dd-sync-badge svg{flex:none}
.b6 .dd-sync-badge b{font-weight:600;font-variant-numeric:tabular-nums}`;
export function DDinstallLinkedStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-linked-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-linked-css", textContent: CSS }));
}
