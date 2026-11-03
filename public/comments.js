// Comments (5.36): a small pin on the board or on a card that opens a short
// thread. Write, reply, edit, resolve (hide) or delete.
// Where a comment lives:
//   - on a card: it follows the card. A day note, a task, a step or a feeling
//     keeps it in the day (day.canvas.board4.comments, `on` + where on the card);
//     a Feed note keeps it in the Feed (setup.life.comments).
//   - free inside a section: it belongs to the section (setup.life.comments,
//     `parent` + a spot relative to the section), the same on every day.
//   - free anywhere else: it belongs to that day's board (board points).
// Both homes are saved data, so comments reach the other devices with sync.

import { DDmarkOwner, DDmarkOrigin } from "./pen.js";

const CARD = /^(sticky|b|sub|bug|life):/;
const frac = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)) : 1);
const num = (v) => (Number.isFinite(v) ? Math.max(-1e5, Math.min(1e5, Math.round(v * 10) / 10)) : 0);
const stamp = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) && v.length <= 40 ? v : "");

// Keep only valid comments and messages. A comment with no message left is gone.
export function DDnormalizeComments(list, { life = false } = {}) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const c of list) {
    if (!c || typeof c !== "object" || typeof c.id !== "string" || !c.id || c.id.length > 80 || seen.has(c.id)) continue;
    const thread = [], ids = new Set();
    for (const m of Array.isArray(c.thread) ? c.thread : []) {
      if (!m || typeof m !== "object" || typeof m.id !== "string" || !m.id || m.id.length > 80 || ids.has(m.id)) continue;
      const text = typeof m.text === "string" ? m.text.slice(0, 2000) : "";
      if (!text.trim()) continue;
      ids.add(m.id);
      thread.push({ id: m.id, text, at: stamp(m.at), ...(stamp(m.edited) ? { edited: stamp(m.edited) } : {}) });
      if (thread.length >= 200) break;
    }
    if (!thread.length) continue;
    const on = typeof c.on === "string" && c.on.length <= 200 && CARD.test(c.on) && (!life || c.on.startsWith("life:")) ? c.on : "";
    seen.add(c.id);
    out.push({
      id: c.id,
      ...(on ? { on, fx: frac(c.fx), fy: frac(c.fy) } : { ...(life ? { parent: typeof c.parent === "string" ? c.parent.slice(0, 80) : "" } : {}), x: num(c.x), y: num(c.y) }),
      ...(c.done === true ? { done: true } : {}),
      thread,
    });
    if (out.length >= 500) break;
  }
  return out;
}

// A card moved between the day and the Feed (dropped into a section, or taken
// out): its comments move with it and point at its new name.
export function DDcommentsTransfer(d, from, to) {
  if (!d?.__life || from === to) return d;
  const toLife = to.startsWith("life:"), fromLife = from.startsWith("life:");
  const source = fromLife ? d.__life.comments || [] : d.canvas?.board4?.comments || [];
  const moving = source.filter((c) => c?.on === from);
  if (!moving.length) return d;
  const keep = source.filter((c) => c?.on !== from), moved = moving.map((c) => ({ ...c, on: to }));
  const put = (life, list) => {
    if (life) { if (list.length) d.__life.comments = list; else delete d.__life.comments; return; }
    const board = { ...(d.canvas?.board4 || {}) };
    if (list.length) board.comments = list; else delete board.comments;
    d.canvas = { ...(d.canvas || {}), board4: board };
  };
  if (fromLife === toLife) put(fromLife, [...keep, ...moved]);
  else {
    put(fromLife, keep);
    put(toLife, [...((toLife ? d.__life.comments : d.canvas?.board4?.comments) || []), ...moved]);
  }
  return d;
}

// Soft times: "just now", "12 min ago", "today", "yesterday", "Tue 3 Nov".
export function DDcommentTime(at, now = Date.now()) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return "";
  const s = (now - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  const a = new Date(t), b = new Date(now), day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(b) - day(a)) / 864e5);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return a.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(a.getFullYear() !== b.getFullYear() ? { year: "numeric" } : {}) }).replace(",", "");
}

const newId = (p) => p + Math.random().toString(36).slice(2, 10);
const nowStamp = () => new Date().toISOString();
const keyOf = (c) => (c.life ? "L:" : "D:") + c.id;
const commentable = (n) => n && ["sticky", "block", "subtask", "bug"].includes(n.kind) && !n.lifeSection;
// The card a spot on the board belongs to (in Lanes a task's section is the task).
function cardRef(n) {
  if (!n) return null;
  if (n.kind === "section" && n.blockId) return "b:" + n.blockId;
  return commentable(n) ? n.id : null;
}
function readList(d, life) {
  return DDnormalizeComments(life ? d.__life.comments : d.canvas?.board4?.comments, { life });
}
function writeList(d, life, list) {
  if (life) { if (list.length) d.__life.comments = list; else delete d.__life.comments; return; }
  const board = { ...(d.canvas?.board4 || {}) };
  if (list.length) board.comments = list; else delete board.comments;
  d.canvas = { ...(d.canvas || {}), board4: board };
}

function Thread({ React: R, comment, place, sheet, side, drop, onPost, onEdit, onRemove, onResolve, onDelete, onClose }) {
  const h = R.createElement, [text, setText] = R.useState(""), [edit, setEdit] = R.useState(null), box = R.useRef(null), list = R.useRef(null);
  const fresh = !comment.thread.length;
  R.useEffect(() => { box.current?.focus({ preventScroll: true }); }, [comment.id]);
  R.useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [comment.thread.length]);
  const post = () => { if (!text.trim()) return; onPost(text.trim()); setText(""); };
  const keys = (e, send) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    else if (e.key === "Escape") { e.preventDefault(); if (edit) setEdit(null); else onClose(); }
  };
  return h("section", { className: "dd-thread" + (sheet ? " dd-thread-sheet" : ""), "data-side": side, "data-drop": drop || undefined, role: "dialog", "aria-label": fresh ? "New comment" : "Comment",
    "data-comment-thread": comment.id, onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation() },
    h("header", null,
      h("small", { dir: "auto" }, place),
      !fresh && h("button", { type: "button", className: "dd-thread-icon", "data-resolve": true, "aria-pressed": !!comment.done, title: comment.done ? "Reopen" : "Resolve · hides it from the board", "aria-label": comment.done ? "Reopen comment" : "Resolve comment", onClick: onResolve },
        h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M4 10.5l4 4 8-9" }))),
      !fresh && h("button", { type: "button", className: "dd-thread-icon", "data-delete-thread": true, title: "Delete comment", "aria-label": "Delete comment", onClick: onDelete },
        h("svg", { width: 16, height: 16, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M3.5 5.5h13M8 5.5V3h4v2.5M5.5 5.5l1 12h7l1-12" }))),
      h("button", { type: "button", className: "dd-thread-icon", title: "Close", "aria-label": "Close comment", onClick: onClose }, "×")),
    comment.thread.length > 0 && h("ol", { ref: list },
      comment.thread.map((m) => h("li", { key: m.id, "data-message-id": m.id },
        edit?.id === m.id
          ? h("form", { className: "dd-thread-edit", onSubmit: (e) => { e.preventDefault(); if (edit.text.trim()) onEdit(m.id, edit.text.trim()); setEdit(null); } },
              h("textarea", { autoFocus: true, dir: "auto", value: edit.text, rows: 2, maxLength: 2000, "aria-label": "Edit message", onChange: (e) => setEdit({ ...edit, text: e.target.value }),
                onKeyDown: (e) => keys(e, () => { if (edit.text.trim()) onEdit(m.id, edit.text.trim()); setEdit(null); }) }),
              h("span", null, h("button", { type: "button", onClick: () => setEdit(null) }, "Cancel"), h("button", { type: "submit", className: "solid" }, "Save")))
          : h(R.Fragment, null,
              h("p", { dir: "auto" }, m.text),
              h("footer", null,
                h("time", { dateTime: m.at, title: m.at ? new Date(m.at).toLocaleString() : undefined }, DDcommentTime(m.at) + (m.edited ? " · edited" : "")),
                h("button", { type: "button", "aria-label": "Edit message", onClick: () => setEdit({ id: m.id, text: m.text }) }, "Edit"),
                h("button", { type: "button", "aria-label": "Delete message", onClick: () => onRemove(m.id) }, "Delete")))))),
    h("form", { className: "dd-thread-new", onSubmit: (e) => { e.preventDefault(); post(); } },
      h("textarea", { ref: box, dir: "auto", rows: fresh ? 2 : 1, value: text, maxLength: 2000, placeholder: fresh ? "Write a comment…" : "Reply…", "aria-label": fresh ? "Write a comment" : "Reply",
        onChange: (e) => setText(e.target.value), onKeyDown: (e) => keys(e, post) }),
      h("button", { type: "submit", className: "solid", disabled: !text.trim() }, fresh ? "Post" : "Reply")));
}

// The comments on a board. `ctx` comes from the board.
export function DDuseComments(ctx) {
  const R = ctx.React, h = R.createElement;
  const [open, setOpen] = R.useState(null), // { key } of a saved comment, or { draft }
    [listOpen, setListOpen] = R.useState(false),
    [resolvedTab, setResolvedTab] = R.useState(false),
    [drag, setDrag] = R.useState(null),
    pending = R.useRef(null), ctxRef = R.useRef(ctx);
  ctxRef.current = ctx;
  const active = ctx.tool === "comment";
  const dayRaw = ctx.day.canvas?.board4?.comments, lifeRaw = ctx.setup.life?.comments, items = ctx.items;
  const all = R.useMemo(() => [
    ...DDnormalizeComments(dayRaw).map((c) => ({ ...c, life: false })),
    ...DDnormalizeComments(lifeRaw, { life: true }).map((c) => ({ ...c, life: true })),
  ], [dayRaw, lifeRaw]);
  const titleOf = (ref) => {
    if (ref.startsWith("life:")) { const it = items.find((i) => "life:" + i.id === ref); return it?.text || ""; }
    const n = ctx.layout.map.get(ref);
    if (n) return n.title || "";
    if (ref.startsWith("sticky:")) return ctx.day.notes?.find((x) => "sticky:" + x.id === ref)?.text || "";
    const b = ref.match(/^b:(.+)$/);
    return b ? ctx.day.blocks?.find((x) => x.id === b[1])?.name || "" : "";
  };
  const short = (s, n = 34) => { s = String(s || "").replace(/\*\*|~~/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const sectionName = (id) => items.find((i) => i.id === id)?.text || "Section";
  function placeOf(c) {
    if (c.on) return "On “" + (short(titleOf(c.on)) || "a card") + "”";
    if (c.life) return c.parent ? "In " + short(sectionName(c.parent)) : "In the Feed";
    return "On this day's board";
  }
  // Where each pin sits on this board (board points), or nothing when its home is not here.
  function spot(c) {
    if (c.on) {
      const n = ctx.layout.map.get(c.on);
      return n ? { x: n.x + c.fx * n.w, y: n.y + c.fy * n.h } : null;
    }
    if (!c.life) return ctx.mode === "mindmap" && !ctx.layout.room ? { x: c.x, y: c.y } : null;
    const o = DDmarkOrigin(ctx.layout, c.parent, ctx.lifeHead, { x: c.x, y: c.y });
    return o ? { x: o.x + c.x, y: o.y + c.y } : null;
  }
  const openKey = open?.key, openComment = open?.draft || all.find((c) => keyOf(c) === openKey) || null;
  // A comment that vanished (deleted elsewhere, undone) closes.
  R.useEffect(() => { if (open?.key && !openComment) setOpen(null); }, [open, openComment]);
  // A jump waits until its board has drawn, then comes to the pin and opens it.
  R.useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const c = all.find((x) => keyOf(x) === p.key), at = c && spot(c);
    if (!c) { pending.current = null; return; }
    if (!at) { if (Date.now() - p.since > 2500) pending.current = null; return; }
    pending.current = null;
    ctx.glide(at);
    setOpen({ key: p.key });
  });

  function write(life, change, message) {
    ctxRef.current.commit((d) => { writeList(d, life, change(readList(d, life))); return d; }, message);
  }
  const patchComment = (c, fn, message) => write(c.life, (list) => list.map((x) => (x.id === c.id ? fn(x) : x)), message);
  function post(text) {
    const c = openComment;
    if (!c) return;
    const message = { id: newId("m-"), text, at: nowStamp() };
    if (open.draft) {
      const { draft, life, ...anchor } = c;
      write(life, (list) => [...list, { ...anchor, thread: [message] }], "Comment added");
      setOpen({ key: (life ? "L:" : "D:") + c.id });
      ctxRef.current.setTool("select");
    } else patchComment(c, (x) => ({ ...x, thread: [...x.thread, message] }), null);
  }
  function removeComment(c, message = "Comment deleted · Undo to restore") {
    write(c.life, (list) => list.filter((x) => x.id !== c.id), message);
    setOpen(null);
  }
  // The anchor for a spot: a card under it, the section it is in, or the day.
  function anchorAt(clientX, clientY, point) {
    const c = ctxRef.current, under = document.elementsFromPoint(clientX, clientY);
    for (const el of under) {
      if (el.closest?.(".dd-pin,.dd-thread,.dd-ink-capture,.dd-comment-capture")) continue;
      const host = el.closest?.("[data-board-id]");
      if (!host) continue;
      const n = c.layout.map.get(host.dataset.boardId), ref = cardRef(n);
      if (ref) {
        const box = c.layout.map.get(ref) || n;
        return { life: ref.startsWith("life:"), on: ref, fx: frac((point.x - box.x) / box.w), fy: frac((point.y - box.y) / box.h) };
      }
      break;
    }
    const owner = DDmarkOwner(c.layout, point, c.mode);
    if (!owner) return null;
    return owner.life ? { life: true, parent: owner.parent, x: num(point.x - owner.x), y: num(point.y - owner.y) } : { life: false, x: num(point.x), y: num(point.y) };
  }
  function startAt(clientX, clientY) {
    const c = ctxRef.current, point = c.toWorld(clientX, clientY), anchor = anchorAt(clientX, clientY, point);
    if (!anchor) { c.setStatus("In Lanes, comment on a card or inside a section, or switch to the Mind map"); return; }
    c.clearBoardSelection();
    setOpen({ draft: { id: newId("c-"), thread: [], draft: true, ...anchor } });
  }
  // Right-click "Add comment": on a card, at its top corner; on the canvas, at the spot.
  function addOn(ref) {
    const c = ctxRef.current, n = c.layout.map.get(ref), card = cardRef(n);
    if (!n) return;
    if (card) setOpen({ draft: { id: newId("c-"), thread: [], draft: true, life: card.startsWith("life:"), on: card, fx: 1, fy: 0 } });
    else {
      const p = { x: n.x + n.w / 2, y: n.y + Math.min(n.h, 60) / 2 }, owner = DDmarkOwner(c.layout, p, c.mode);
      if (owner) setOpen({ draft: { id: newId("c-"), thread: [], draft: true, ...(owner.life ? { life: true, parent: owner.parent, x: num(p.x - owner.x), y: num(p.y - owner.y) } : { life: false, x: num(p.x), y: num(p.y) }) } });
    }
  }
  function addAt(point) {
    const c = ctxRef.current, owner = DDmarkOwner(c.layout, point, c.mode);
    if (!owner) { c.setStatus("In Lanes, comment on a card or inside a section, or switch to the Mind map"); return; }
    setOpen({ draft: { id: newId("c-"), thread: [], draft: true, ...(owner.life ? { life: true, parent: owner.parent, x: num(point.x - owner.x), y: num(point.y - owner.y) } : { life: false, x: num(point.x), y: num(point.y) }) } });
  }
  // From the Comments list: go where the comment is, then open it. Back (Alt+←) returns.
  function jump(c) {
    const x = ctxRef.current;
    x.mark();
    x.finishEdit?.();
    const key = keyOf(c);
    if (spot(c)) { x.glide(spot(c)); setOpen({ key }); return; }
    pending.current = { key, since: Date.now() };
    if (c.on) {
      const lifeId = c.on.startsWith("life:") ? c.on.slice(5) : undefined, block = c.on.match(/^(?:b|sub):([^:]+)/)?.[1];
      if (!lifeId && x.layout.room) x.enterRoom(null, true);
      if (!lifeId && x.mode === "lanes" && c.on.startsWith("sticky:")) x.setMode("mindmap");
      x.reveal({ id: c.on, lifeId, blockId: block, kind: lifeId || c.on.startsWith("sticky:") ? "sticky" : "block", title: titleOf(c.on) });
    } else if (!c.life) {
      if (x.layout.room) x.enterRoom(null, true);
      if (x.mode !== "mindmap") x.setMode("mindmap");
    } else if (c.parent) {
      // The section's own board when the comment sits outside its frame, else the board that shows the section.
      const s = items.find((i) => i.id === c.parent), outside = s && (c.x < 0 || c.y < 0 || c.x > s.w || c.y > s.h);
      const room = outside ? c.parent : x.lifeHome(items, c.parent) || null;
      if ((x.layout.room || null) !== room) x.enterRoom(room, true);
      if (s?.collapsed) x.unfold(c.parent);
    } else if (x.layout.room) x.enterRoom(null, true);
  }
  // Drag a pin to move it: onto a card, it follows that card; elsewhere it stays put.
  // A tap opens a thread on lift; on a phone the click that follows would land
  // on the sheet that just opened (Delete, Close…). Let that one click go.
  function swallowClick() {
    const eat = (ev) => { ev.preventDefault(); ev.stopPropagation(); drop(); };
    const drop = () => window.removeEventListener("click", eat, true);
    window.addEventListener("click", eat, true);
    setTimeout(drop, 450);
  }
  function pinDown(e, c) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const start = { x: e.clientX, y: e.clientY }, id = e.pointerId, key = keyOf(c);
    let moved = false;
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      moved = true;
      setDrag({ key, at: ctxRef.current.toWorld(ev.clientX, ev.clientY) });
    };
    const stop = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); };
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      stop(); setDrag(null);
      if (ev.type === "pointercancel") return;
      if (ev.pointerType !== "mouse") swallowClick();
      if (!moved) { setOpen(openKey === key ? null : { key }); return; }
      const point = ctxRef.current.toWorld(ev.clientX, ev.clientY), anchor = anchorAt(ev.clientX, ev.clientY, point);
      if (!anchor) return;
      const { life, ...where } = anchor, { id: cid, done, thread } = c;
      const next = { id: cid, ...where, ...(done ? { done } : {}), thread };
      ctxRef.current.commit((d) => {
        writeList(d, c.life, readList(d, c.life).filter((x) => x.id !== cid));
        writeList(d, life, [...readList(d, life), next]);
        return d;
      }, "Comment moved");
      setOpen(null);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  R.useEffect(() => {
    if (!open && !listOpen) return;
    const key = (e) => {
      if (e.key !== "Escape" || e.target?.closest?.("input,textarea")) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (open) setOpen(null); else setListOpen(false);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open, listOpen]);

  const phone = typeof matchMedia === "function" && matchMedia("(max-width:700px)").matches;
  const thread = (c, sheet, side, drop) => h(Thread, {
    React: R, key: keyOf(c), comment: c, place: placeOf(c), sheet, side, drop,
    onPost: post,
    onEdit: (mid, text) => patchComment(c, (x) => ({ ...x, thread: x.thread.map((m) => (m.id === mid ? { ...m, text, edited: nowStamp() } : m)) }), null),
    onRemove: (mid) => (c.thread.length <= 1 ? removeComment(c) : patchComment(c, (x) => ({ ...x, thread: x.thread.filter((m) => m.id !== mid) }), "Message deleted")),
    onResolve: () => { patchComment(c, (x) => { const { done, ...rest } = x; return done ? rest : { ...rest, done: true }; }, c.done ? "Comment reopened" : "Comment resolved · find it in Comments"); if (!c.done) setOpen(null); },
    onDelete: () => removeComment(c),
    onClose: () => setOpen(null),
  });
  const shownPins = all.filter((c) => !c.done || keyOf(c) === openKey).map((c) => ({ c, at: drag?.key === keyOf(c) ? drag.at : spot(c) })).filter((p) => p.at);
  if (open?.draft) { const at = spot(open.draft); if (at) shownPins.push({ c: open.draft, at }); }
  const sideOf = (at) => {
    const cam = ctx.getCamera(), view = ctx.viewport.current, w = view?.clientWidth || 1200;
    // Open away from the right edge and from an open side panel (Today's habits…).
    const vr = view?.getBoundingClientRect?.(), x = cam.x + at.x * cam.z;
    const rails = vr ? [...(view.closest?.(".b2") || document).querySelectorAll(".dd-rail-panel")].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.left - vr.left > w / 2).map((r) => r.left - vr.left) : [];
    return x > Math.min(w, ...rails) - 360 ? "start" : "end";
  };
  // A pin near the top opens its thread downward, so it never hides under the top bar.
  const dropOf = (at) => {
    const cam = ctx.getCamera(), hgt = ctx.viewport.current?.clientHeight || 800;
    return cam.y + at.y * cam.z < hgt * 0.45;
  };
  const counts = { open: all.filter((c) => !c.done).length, done: all.filter((c) => c.done).length };
  const listed = all.filter((c) => !!c.done === resolvedTab);
  const groups = [
    ["day", "This day", listed.filter((c) => !c.life)],
    ["feed", "Feed · every day", listed.filter((c) => c.life)],
  ];
  return {
    count: counts.open,
    isOpen: !!open,
    openList: () => setListOpen(true),
    toggleList: () => setListOpen((v) => !v),
    addOn, addAt,
    close: () => setOpen(null),
    // Inside the board's world: the pins, each with its thread when open (desktop).
    world: () => h("div", { className: "dd-pins", "aria-label": "Comments" },
      shownPins.map(({ c, at }) => {
        const key = keyOf(c), isOpen = open?.draft ? c === open.draft : open?.key === key;
        return h("div", { key, className: "dd-pin", "data-comment-id": c.id, "data-comment-home": c.life ? "feed" : "day", "data-open": isOpen || undefined, "data-done": c.done || undefined, style: { left: at.x, top: at.y } },
          h("button", { type: "button", className: "dd-pin-dot", "aria-label": c.draft ? "New comment" : "Comment: " + short(c.thread[0]?.text, 60) + (c.thread.length > 1 ? " · " + c.thread.length + " messages" : ""), "aria-expanded": isOpen,
            title: c.draft ? "" : short(c.thread[0]?.text, 80), onPointerDown: (e) => (c.draft ? e.stopPropagation() : pinDown(e, c)), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : { key }); } }, onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); } },
            c.thread.length > 1 ? h("b", null, c.thread.length) : h("svg", { width: 14, height: 14, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: "M5 6h10M5 10h6" }))),
          isOpen && !phone && thread(openComment, false, sideOf(at), dropOf(at)));
      })),
    // Over the board while the comment tool is on: a click places a comment.
    capture: () => active && h("div", { className: "dd-comment-capture", "aria-hidden": true,
      onPointerDown: (e) => {
        const c = ctxRef.current;
        if (c.pinching() || c.panKey() || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault(); e.stopPropagation();
        c.finishEdit?.(); c.setMenu?.(null);
        if (e.pointerType !== "mouse") swallowClick();
        startAt(e.clientX, e.clientY);
      },
      onContextMenu: (e) => e.preventDefault() }),
    // Phone: the open thread is a sheet at the bottom. Everywhere: the Comments list.
    screen: () => h(R.Fragment, null,
      phone && openComment && thread(openComment, true, "end"),
      listOpen && h("aside", { className: "dd-comments-panel", role: "dialog", "aria-label": "Comments", onPointerDown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() },
        h("header", null, h("strong", null, "Comments"), h("button", { type: "button", "aria-label": "Close comments", onClick: () => { setListOpen(false); ctx.viewport.current?.focus({ preventScroll: true }); } }, "×")),
        h("div", { className: "dd-comments-tabs", role: "group", "aria-label": "Show" },
          h("button", { type: "button", "aria-pressed": !resolvedTab, onClick: () => setResolvedTab(false) }, "Open · " + counts.open),
          h("button", { type: "button", "aria-pressed": resolvedTab, onClick: () => setResolvedTab(true) }, "Resolved · " + counts.done)),
        !listed.length && h("p", { className: "dd-comments-empty" }, resolvedTab ? "Nothing resolved yet." : "No comments yet. Press M, then click a card or a spot on the board."),
        groups.filter(([, , list]) => list.length).map(([id, name, list]) => h("section", { key: id, "data-comment-group": id },
          h("small", null, name),
          list.map((c) => h("button", { type: "button", key: keyOf(c), className: "dd-comment-row", "data-comment-row": c.id, onClick: () => { setListOpen(phone ? false : true); jump(c); } },
            h("span", { dir: "auto" }, short(c.thread[0]?.text, 90)),
            h("small", { dir: "auto" }, placeOf(c) + (c.thread.length > 1 ? " · " + (c.thread.length - 1) + (c.thread.length > 2 ? " replies" : " reply") : "") + " · " + DDcommentTime(c.thread.at(-1)?.at)))))))),
  };
}

export const DDcommentsCSS = `
.dd-pins{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;z-index:950;pointer-events:none}
.dd-pin{position:absolute;width:0;height:0;transform:scale(var(--b4-inverse,1));transform-origin:0 0;pointer-events:none}
.dd-pin[data-open]{z-index:2}
.dd-pin-dot{all:unset;box-sizing:border-box;position:absolute;left:0;bottom:0;display:grid;place-items:center;min-width:28px;height:28px;padding:0 6px;border-radius:14px 14px 14px 3px;background:var(--paper);color:var(--ink);border:1.5px solid var(--board-accent,#0D99FF);box-shadow:0 3px 10px -3px #0006;cursor:pointer;pointer-events:auto;font:600 12px/1 var(--sans);touch-action:none}
.dd-pin-dot:hover,.dd-pin-dot:focus-visible,.dd-pin[data-open] .dd-pin-dot{background:var(--board-accent,#0D99FF);color:#fff}
.dd-pin[data-done] .dd-pin-dot{opacity:.6;border-style:dashed}
.dd-thread{position:absolute;bottom:0;left:36px;width:300px;max-height:420px;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);border-radius:14px;box-shadow:0 14px 40px -12px #0007;pointer-events:auto;font:13px/1.45 var(--sans);overflow:hidden;cursor:auto}
.dd-thread[data-side=start]{left:auto;right:8px}
.dd-thread[data-drop]{bottom:auto;top:-28px}
.dd-thread header{display:flex;align-items:center;gap:2px;padding:6px 6px 6px 12px;border-bottom:1px solid var(--rule,#0001)}
.dd-thread header small{flex:1;min-width:0;color:var(--ink-3,#777);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-thread button{font:inherit;color:inherit}
.dd-thread-icon{all:unset;box-sizing:border-box;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:18px;color:var(--ink-2,var(--ink))}
.dd-thread-icon:hover,.dd-thread-icon:focus-visible{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.dd-thread-icon[aria-pressed=true]{color:#14AE5C}
.dd-thread ol{list-style:none;margin:0;padding:4px 0;overflow:auto;flex:1;min-height:0}
.dd-thread li{padding:8px 12px}
.dd-thread li+li{border-top:1px solid var(--rule,#0001)}
.dd-thread li p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.dd-thread li footer{display:flex;align-items:center;gap:8px;margin-top:2px;color:var(--ink-3,#777);font-size:11px}
.dd-thread li footer time{flex:1}
.dd-thread li footer button{all:unset;cursor:pointer;opacity:0;font-size:11px;color:var(--ink-2,var(--ink))}
.dd-thread li:hover footer button,.dd-thread li:focus-within footer button,.dd-thread-sheet li footer button{opacity:.8}
.dd-thread li footer button:hover,.dd-thread li footer button:focus-visible{opacity:1;text-decoration:underline}
.dd-thread form{display:flex;gap:6px;align-items:flex-end;padding:8px}
.dd-thread-new{border-top:1px solid var(--rule,#0001)}
.dd-thread-edit{flex-direction:column;align-items:stretch!important;padding:0!important}
.dd-thread-edit span{display:flex;justify-content:flex-end;gap:6px}
.dd-thread textarea{flex:1;min-width:0;resize:none;border:1px solid var(--rule-2,#0002);border-radius:9px;padding:6px 9px;background:var(--wash,var(--paper));color:var(--ink);font:13px/1.45 var(--sans);max-height:140px}
.dd-thread form button{border:1px solid var(--rule-2,#0002);border-radius:9px;background:var(--paper);padding:6px 12px;cursor:pointer}
.dd-thread form button.solid{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.dd-thread form button:disabled{opacity:.4;cursor:default}
.dd-thread-sheet{position:absolute;left:8px;right:8px;bottom:70px;top:auto;width:auto;max-height:min(60%,460px);z-index:110}
.dd-comment-capture{position:absolute;inset:0;z-index:40;cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26'%3E%3Cpath d='M3 3h18a2 2 0 012 2v11a2 2 0 01-2 2H9l-6 5z' fill='%23fff' stroke='%230D99FF' stroke-width='2'/%3E%3C/svg%3E") 3 23,crosshair;touch-action:none}
.dd-comments-panel{position:absolute;z-index:105;top:72px;right:16px;width:340px;max-width:calc(100% - 32px);max-height:calc(100% - 170px);display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--paper);color:var(--ink);border:1px solid var(--rule-2,#0002);border-radius:14px;box-shadow:0 6px 24px #0002;overflow:auto;overscroll-behavior:contain;font:13px/1.45 var(--sans)}
.dd-comments-panel header{display:flex;align-items:center;justify-content:space-between}
.dd-comments-panel header button{all:unset;cursor:pointer;width:28px;height:28px;display:grid;place-items:center;border-radius:8px;font-size:18px}
.dd-comments-tabs{display:flex;gap:4px}
.dd-comments-tabs button{flex:1;border:1px solid var(--rule-2,#0002);background:var(--paper);color:var(--ink);border-radius:9px;padding:5px 8px;font:12px var(--sans);cursor:pointer}
.dd-comments-tabs button[aria-pressed=true]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.dd-comments-panel section{display:flex;flex-direction:column;gap:2px}
.dd-comments-panel section>small{color:var(--ink-3,#777);font-size:11px;margin:4px 2px}
.dd-comment-row{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:1px;padding:8px 10px;border-radius:9px;min-height:44px}
.dd-comment-row:hover,.dd-comment-row:focus-visible{background:color-mix(in srgb,var(--board-accent,#0D99FF) 10%,var(--paper))}
.dd-comment-row span{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.dd-comment-row small{color:var(--ink-3,#777);font-size:11px}
.dd-comments-empty{margin:4px 2px;color:var(--ink-3,#777)}
@media(max-width:700px){.dd-comments-panel{top:122px;right:8px;max-width:calc(100% - 16px);max-height:calc(100% - 200px)}}
@media(pointer:coarse){.dd-pin-dot{min-width:34px;height:34px;border-radius:17px 17px 17px 4px}.dd-thread-icon{width:40px;height:40px}.dd-thread form button{min-height:40px}}
`;
