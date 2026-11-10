import { DDarenaPicker, DDarenaCSS, DDarenaInput, DDarenaRequest, DDarenaMedia } from "./arena.js";
// Photos straight on the Board, like a mood board (5.38).
// Drop image files on the canvas, paste one (Ctrl/Cmd+V), or pick one from the
// canvas menu: each becomes a photo card where it landed. The file goes to the
// person's own Google Drive (media.js); the card is a normal note that keeps
// only the Drive link in `media`, so search, the Day review, undo, copy and
// every view read the same note. Until the upload is done the card is only a
// preview here and nothing is saved, so a failed upload never leaves a blank note.

import { DDmediaList, DDmediaKind, DDmediaConnected, DDmediaConnect, DDmediaUpload, DDmediaThumb, DDmediaViewUrl, DDmediaMessage } from "./media.js";

const MAX_FILES = 12;
const GAP = 24;

// Images and videos only, a dozen at a time.
export function DDphotoFiles(list) {
  return [...(list || [])].filter((f) => f && /^(image|video)\//.test(f.type || "")).slice(0, MAX_FILES);
}
// The first picture or video kept on a note, or null.
export function DDnotePhoto(note) {
  return DDmediaList(note?.media).find((m) => DDmediaKind(m) !== "file") || null;
}
// Card width from the picture's shape: wide pictures get a wider card.
export function DDphotoWidth(dims) {
  const ratio = dims?.w > 0 && dims?.h > 0 ? dims.h / dims.w : 0.75;
  return ratio < 0.8 ? 360 : 240;
}
// The picture's height on a card of width w (never a sliver, never a tower).
export function DDphotoImageHeight(w, photo) {
  const ratio = photo?.w > 0 && photo?.h > 0 ? photo.h / photo.w : 0.75;
  return Math.round(w * Math.min(2, Math.max(0.3, ratio)));
}
// The words under a photo, if any: a short caption strip.
export function DDphotoCaptionHeight(w, text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  const perLine = Math.max(12, Math.floor((w - 24) / 8));
  const lines = t.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  return 20 + Math.min(12, lines) * 21;
}
export function DDphotoHeight(w, photo, text) {
  return DDphotoImageHeight(w, photo) + DDphotoCaptionHeight(w, text);
}
// Several photos dropped together sit side by side from the drop point, three
// to a row, the first one centred under the pointer.
export function DDphotoSpots(point, sizes) {
  const out = [];
  let x = point.x - (sizes[0]?.w || 240) / 2, y = point.y - (sizes[0]?.h || 180) / 2, rowH = 0;
  const left = x;
  sizes.forEach((s, i) => {
    if (i && i % 3 === 0) { x = left; y += rowH + GAP; rowH = 0; }
    out.push({ x: x + s.w / 2, y: y + s.h / 2 });
    x += s.w + GAP;
    rowH = Math.max(rowH, s.h);
  });
  return out;
}

// The picture's own size, read in the browser before upload.
function readDims(file, url) {
  return new Promise((resolve) => {
    const done = (w, h) => resolve(w > 0 && h > 0 ? { w: Math.round(w), h: Math.round(h) } : null);
    const timer = setTimeout(() => done(0, 0), 4000);
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata"; v.muted = true;
      v.onloadedmetadata = () => { clearTimeout(timer); done(v.videoWidth, v.videoHeight); };
      v.onerror = () => { clearTimeout(timer); done(0, 0); };
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => { clearTimeout(timer); done(img.naturalWidth, img.naturalHeight); };
      img.onerror = () => { clearTimeout(timer); done(0, 0); };
      img.src = url;
    }
  });
}

// Pictures uploaded in this tab show from the file itself, without asking Drive.
const local = new Map();
let pendingKey = 0;

function PhotoFace({ React: R, item, imageH, connected, language, onConnect }) {
  const h = R.createElement, fa = language === "fa", kind = DDmediaKind(item);
  const [src, setSrc] = R.useState(() => local.get(item.id) || "");
  R.useEffect(() => {
    let live = true;
    if (item.provider === "arena") setSrc(item.src);
    else if (local.has(item.id)) setSrc(local.get(item.id));
    else if (connected) DDmediaThumb(item.id, 800).then((s) => live && setSrc(s));
    return () => { live = false; };
  }, [item.id, item.src, connected]);
  const [refreshing, setRefreshing] = R.useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await DDarenaRequest({ op: "block", id: item.blockId });
      const current = DDarenaMedia(result.data?.[0]);
      if (current) setSrc(current.src);
    } catch {} finally { setRefreshing(false); }
  };
  const isLocal = local.has(item.id) && src === local.get(item.id);
  return h("div", { className: "dd-photo-face", "data-kind": kind, "data-provider": item.provider || "drive", style: { height: imageH } },
    src
      ? kind === "video" && isLocal
        ? h("video", { src, muted: true, playsInline: true, preload: "metadata", draggable: false })
        : h("img", { src, alt: item.name, draggable: false, referrerPolicy: "no-referrer", onError: () => setSrc("") })
      : h("span", { className: "dd-photo-wait" },
          h("span", { "aria-hidden": true }, kind === "video" ? "🎬" : "🖼️"),
          h("small", { dir: "auto" }, item.name),
          item.provider === "arena" && h("button", { type: "button", className: "dd-photo-show", disabled: refreshing, onClick: (e) => { e.stopPropagation(); refresh(); } }, refreshing ? (fa ? "در حال دریافت…" : "Loading…") : (fa ? "دوباره دریافت کن" : "Reload image")),
          !connected && item.provider !== "arena" && h("button", { type: "button", className: "dd-photo-show", onClick: (e) => { e.stopPropagation(); onConnect(); } }, fa ? "نمایش عکس" : "Show photo")),
    kind === "video" && h("span", { className: "dd-photo-play", "aria-hidden": true }, "▶"),
    h("button", {
      type: "button", className: "dd-photo-open", "data-photo-open": true,
      title: item.provider === "arena" ? "Are.na" : (fa ? "باز کردن در گوگل درایو" : "Open in Google Drive"),
      "aria-label": (item.provider === "arena" ? "Are.na: " : (fa ? "باز کردن در گوگل درایو: " : "Open in Google Drive: ")) + item.name,
      onClick: (e) => { e.stopPropagation(); window.open(DDmediaViewUrl(item), "_blank", "noopener,noreferrer"); },
    }, "↗"));
}

// A photo still on its way to Drive: a preview at the spot, nothing saved yet.
function PendingCard({ React: R, p, language, onSave, onCancel }) {
  const h = R.createElement, fa = language === "fa";
  const label = p.state === "up"
    ? (fa ? "در حال فرستادن به درایو " : "Saving to Drive ") + Math.round(p.part * 100) + "%"
    : p.state === "need"
      ? p.note || (fa ? "برای نگه داشتن، به گوگل درایو وصل شو" : "Connect Google Drive to keep it")
      : p.note || (fa ? "آماده…" : "Getting ready…");
  return h("div", {
    className: "dd-photo-pending", "data-state": p.state, role: "group",
    "aria-label": (fa ? "عکس در راه: " : "Photo on its way: ") + p.file.name,
    style: { left: p.x - p.w / 2, top: p.y - p.h / 2, width: p.w, height: p.h },
    onPointerDown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation(),
  },
    p.file.type.startsWith("video/")
      ? h("video", { src: p.url, muted: true, playsInline: true, preload: "metadata" })
      : h("img", { src: p.url, alt: p.file.name, draggable: false }),
    h("div", { className: "dd-photo-pending-bar" },
      p.state === "up" && h("i", { style: { width: Math.round(p.part * 100) + "%" } }),
      h("small", { dir: "auto" }, label),
      (p.state === "need" || p.state === "error") && h("button", { type: "button", className: "dd-photo-save", onClick: onSave }, p.state === "error" ? (fa ? "دوباره" : "Try again") : (fa ? "ذخیره در درایو" : "Save to Drive")),
      p.state !== "up" && h("button", { type: "button", className: "dd-photo-cancel", "aria-label": fa ? "کنار گذاشتن این عکس" : "Leave this photo out", onClick: onCancel }, "×")));
}

// ctx: React, root, viewport, toWorld, language, day, items, setStatus,
// addPhoto(point, { media, w, h }) -> places a note holding the link.
export function DDuseBoardPhotos(ctx) {
  const R = ctx.React, h = R.createElement, fa = ctx.language === "fa";
  const ctxRef = R.useRef(ctx);
  ctxRef.current = ctx;
  const [pending, setPending] = R.useState([]), pendingRef = R.useRef(pending);
  pendingRef.current = pending;
  const [connected, setConnected] = R.useState(DDmediaConnected);
  const [arena, setArena] = R.useState(null);
  const [over, setOver] = R.useState(false);
  const lastPoint = R.useRef(null), input = R.useRef(null), pickAt = R.useRef(null);
  const patch = (key, change) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  const drop = (key) => setPending((list) => list.filter((p) => {
    if (p.key === key && !p.kept) URL.revokeObjectURL(p.url);
    return p.key !== key;
  }));

  // Note media, by board ref, for every note that holds a picture.
  const photos = R.useMemo(() => {
    const m = new Map();
    for (const n of ctx.day.notes || []) { const p = n.kind !== "emoji" && DDnotePhoto(n); if (p) m.set("sticky:" + n.id, p); }
    for (const i of ctx.items || []) { const p = i.type === "sticky" && DDnotePhoto(i); if (p) m.set("life:" + i.id, p); }
    return m;
  }, [ctx.day.notes, ctx.items]);

  async function upload(keys) {
    const list = pendingRef.current.filter((p) => keys.includes(p.key));
    if (!list.length) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      for (const p of list) patch(p.key, { state: "error", note: DDmediaMessage("offline", ctxRef.current.language) });
      return;
    }
    try {
      await DDmediaConnect();
      setConnected(true);
    } catch (e) {
      for (const p of list) patch(p.key, { state: "need", note: e.message === "denied" || e.message === "popup_closed" ? "" : DDmediaMessage(e.message, ctxRef.current.language) });
      return;
    }
    for (const p of list) {
      patch(p.key, { state: "up", part: 0, note: "" });
      try {
        const item = await DDmediaUpload(p.file, (part) => patch(p.key, { part }));
        if (!item) throw Error("drive-upload");
        const media = DDmediaList([{ ...item, ...(p.dims || {}) }]);
        local.set(item.id, p.url);
        setPending((all) => all.map((x) => (x.key === p.key ? { ...x, kept: true } : x)));
        ctxRef.current.addPhoto({ x: p.x, y: p.y }, { media, w: p.w, h: p.h });
        drop(p.key);
      } catch (e) {
        if (e.message === "not-connected") setConnected(false);
        patch(p.key, { state: e.message === "not-connected" ? "need" : "error", note: e.message === "not-connected" ? "" : DDmediaMessage(e.message, ctxRef.current.language) });
      }
    }
  }

  // Files arrive (drop, paste or picker) at a spot on the board.
  async function begin(files, point) {
    const list = DDphotoFiles(files);
    if (!list.length) return false;
    const c = ctxRef.current;
    const at = point || center();
    const made = await Promise.all(list.map(async (file) => {
      const url = URL.createObjectURL(file), dims = await readDims(file, url), w = DDphotoWidth(dims);
      return { key: "ph" + ++pendingKey, file, url, dims, w, h: DDphotoImageHeight(w, dims), state: "wait", part: 0, note: "" };
    }));
    const spots = DDphotoSpots(at, made);
    made.forEach((p, i) => Object.assign(p, spots[i]));
    setPending((all) => [...all, ...made]);
    pendingRef.current = [...pendingRef.current, ...made];
    if (DDmediaConnected()) upload(made.map((p) => p.key));
    else {
      // A drop is not a click, so Google's window would be blocked: ask for one tap.
      for (const p of made) patch(p.key, { state: "need" });
      c.setStatus?.(fa ? "برای نگه داشتن عکس، «ذخیره در درایو» را بزن" : "Tap “Save to Drive” to keep the photo");
    }
    return true;
  }
  function center() {
    const c = ctxRef.current, el = c.viewport.current, r = el?.getBoundingClientRect();
    return r ? c.toWorld(r.left + el.clientWidth / 2, r.top + el.clientHeight / 2) : { x: 0, y: 0 };
  }
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const onBoard = (e) => !!ctxRef.current.viewport.current?.contains(e.target);

  R.useEffect(() => {
    let leaveTimer = 0;
    const dragOver = (e) => {
      if (!hasFiles(e) || !onBoard(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      clearTimeout(leaveTimer);
      setOver(true);
    };
    const dragLeave = () => { clearTimeout(leaveTimer); leaveTimer = setTimeout(() => setOver(false), 80); };
    const dropFiles = (e) => {
      if (!hasFiles(e) || !onBoard(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(false);
      const files = DDphotoFiles(e.dataTransfer.files);
      if (!files.length) return ctxRef.current.setStatus?.(fa ? "فقط عکس و ویدیو روی برد می‌نشیند" : "Only photos and videos go on the board");
      begin(files, ctxRef.current.toWorld(e.clientX, e.clientY));
    };
    const paste = (e) => {
      const root = ctxRef.current.root.current;
      if (!root?.contains(e.target) || e.target.closest?.("input,textarea,select,[contenteditable=true]")) return;
      const files = DDphotoFiles(e.clipboardData?.files);
      if (!files.length) {
        const text = e.clipboardData?.getData("text/plain");
        try {
          if (DDarenaInput(text).op === "search") return;
          e.preventDefault(); e.stopImmediatePropagation();
          setArena({ initial: text, point: lastPoint.current || center(), date: ctxRef.current.day.date, room: ctxRef.current.layout.room });
        } catch {}
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      begin(files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], "pasted-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + (i ? "-" + i : "") + "." + (f.type.split("/")[1] || "png"), { type: f.type }))), lastPoint.current);
    };
    const move = (e) => { if (onBoard(e)) lastPoint.current = ctxRef.current.toWorld(e.clientX, e.clientY); };
    document.addEventListener("dragover", dragOver);
    document.addEventListener("dragleave", dragLeave);
    document.addEventListener("drop", dropFiles);
    document.addEventListener("paste", paste, true);
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      clearTimeout(leaveTimer);
      document.removeEventListener("dragover", dragOver);
      document.removeEventListener("dragleave", dragLeave);
      document.removeEventListener("drop", dropFiles);
      document.removeEventListener("paste", paste, true);
      document.removeEventListener("pointermove", move);
    };
  }, []);

  const showPhotos = () => DDmediaConnect().then(() => setConnected(true)).catch((e) => ctxRef.current.setStatus?.(DDmediaMessage(e.message, ctxRef.current.language)));

  return {
    photos,
    arena: (point) => setArena({ initial: "", point: point || center(), date: ctxRef.current.day.date, room: ctxRef.current.layout.room }),
    pending,
    connected,
    photoOf: (ref) => photos.get(ref) || null,
    // From a menu: pick files, they land at the spot (or the middle of the view).
    pick: (point) => { pickAt.current = point || null; input.current?.click(); },
    attrs: (node) => (node.photo ? { "data-photo": DDmediaKind(node.photo) } : {}),
    // The picture on a photo note, above its caption.
    layer: (node) => node.photo && h(PhotoFace, {
      key: "photo", React: R, item: node.photo, imageH: DDphotoImageHeight(node.w, node.photo), connected, language: ctx.language, onConnect: showPhotos,
    }),
    // Previews of photos still uploading, in board space.
    world: () => pending.length > 0 && h("div", { className: "dd-photo-pending-layer" },
      pending.map((p) => h(PendingCard, { key: p.key, React: R, p, language: ctx.language, onSave: () => upload([p.key]), onCancel: () => drop(p.key) }))),
    // The drop hint and the hidden file picker, on the screen.
    screen: () => h(R.Fragment, null,
      arena && h(DDarenaPicker, { React: R, language: ctx.language, initial: arena.initial, onClose: () => setArena(null), onAdd: (list) => {
        const c = ctxRef.current;
        if (c.day.date !== arena.date || c.layout.room !== arena.room) { c.setStatus?.(fa ? "برد عوض شده؛ دوباره عکس‌ها را انتخاب کن" : "The board changed. Pick the images again."); return; }
        const sizes = list.map((m) => { const w = DDphotoWidth(m); return { w, h: DDphotoImageHeight(w, m) }; });
        const spots = DDphotoSpots(arena.point, sizes);
        list.forEach((m, i) => c.addPhoto(spots[i], { media: [m], ...sizes[i] }));
      } }),
      over && h("div", { className: "dd-photo-drop-hint", "aria-hidden": true }, h("span", null, fa ? "عکس را اینجا رها کن" : "Drop photos here")),
      h("input", {
        ref: input, type: "file", accept: "image/*,video/*", multiple: true, hidden: true, "data-board-photo-input": true,
        onChange: (e) => { const files = [...(e.target.files || [])]; e.target.value = ""; begin(files, pickAt.current); },
      })),
  };
}

export const DDboardPhotosCSS = DDarenaCSS + `
.b6 .b4-sticky[data-photo]{flex-direction:column;background:var(--paper,#fff)!important;color:var(--ink,#141414)!important;border-radius:8px}
.b6 .b4-sticky[data-photo]>.b4-node-body{flex:0 0 auto!important;background:var(--paper,#fff);border-radius:0 0 8px 8px}
.b6 .b4-sticky[data-photo] .dd-photo-face{border-radius:8px 8px 0 0}
.b6 .b4-sticky[data-photo] .dd-note-preview{padding:8px 12px 10px!important;font-size:calc(var(--object-size,16px) * .9);font-weight:500;color:var(--ink,#141414)}
.b6 .b4-sticky[data-photo] .dd-note-editor{padding:8px 12px 10px!important}
.b6 .b4-sticky[data-photo] .dd-note-editor textarea{font-size:calc(var(--object-size,16px) * .9);color:var(--ink,#141414)}
.b6 .b4-sticky[data-photo] .dd-sticky-footer{display:none}
.b6 .b4-sticky[data-photo] .dd-note-preview:has(>.dd-note-placeholder:only-child){display:none}
.dd-photo-face{position:relative;flex:0 0 auto;width:100%;overflow:hidden;background:var(--wash,#8882);pointer-events:none}
.dd-photo-face img,.dd-photo-face video{display:block;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none;user-select:none}
.dd-photo-wait{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:100%;padding:8px;box-sizing:border-box;text-align:center;font-size:28px;color:var(--ink-3,#777)}
.dd-photo-wait small{font:500 11px/1.3 var(--sans,system-ui);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-photo-show{pointer-events:auto;border:0;border-radius:999px;padding:4px 10px;background:var(--board-accent,#0D99FF);color:#fff;font:600 11px var(--sans,system-ui);cursor:pointer}
.dd-photo-play{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:26px;text-shadow:0 1px 6px #0009}
.dd-photo-open{position:absolute;top:6px;inset-inline-end:6px;width:28px;height:28px;border:0;border-radius:14px;background:#000a;color:#fff;font:600 14px/1 var(--sans,system-ui);cursor:pointer;pointer-events:auto;opacity:0;transition:opacity .12s}
.b4-node.selected .dd-photo-open,.b4-node:hover .dd-photo-open,.dd-photo-open:focus-visible{opacity:1}
.dd-photo-pending-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:950}
.dd-photo-pending{position:absolute;border-radius:8px;overflow:hidden;background:var(--paper,#fff);box-shadow:0 10px 24px -14px #0008,inset 0 0 0 1px #0002;pointer-events:auto}
.dd-photo-pending img,.dd-photo-pending video{display:block;width:100%;height:100%;object-fit:cover;opacity:.75}
.dd-photo-pending[data-state=up] img{opacity:.9}
.dd-photo-pending-bar{position:absolute;inset:auto 6px 6px 6px;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;background:var(--paper,#fff);color:var(--ink,#141414);box-shadow:0 2px 8px #0003;overflow:hidden;transform:scale(clamp(1,var(--b4-inverse,1),2.5));transform-origin:50% 100%}
.dd-photo-pending-bar i{position:absolute;left:0;bottom:0;height:3px;background:var(--board-accent,#0D99FF)}
.dd-photo-pending-bar small{flex:1;min-width:0;font:500 11px/1.3 var(--sans,system-ui);overflow:hidden;text-overflow:ellipsis}
.dd-photo-save{border:0;border-radius:999px;padding:4px 10px;background:var(--board-accent,#0D99FF);color:#fff;font:600 11px var(--sans,system-ui);cursor:pointer;white-space:nowrap}
.dd-photo-cancel{border:0;background:none;color:inherit;font:600 16px/1 var(--sans,system-ui);cursor:pointer;padding:2px 4px;opacity:.7}
.dd-photo-drop-hint{position:absolute;inset:10px;z-index:120;display:grid;place-items:center;border:2px dashed var(--board-accent,#0D99FF);border-radius:18px;background:color-mix(in srgb,var(--board-accent,#0D99FF) 7%,transparent);pointer-events:none}
.dd-photo-drop-hint span{padding:8px 16px;border-radius:999px;background:var(--paper,#fff);color:var(--ink,#141414);font:600 14px var(--sans,system-ui);box-shadow:0 6px 20px -8px #0006}
@media(pointer:coarse){.dd-photo-open{opacity:1;width:36px;height:36px;border-radius:18px}.dd-photo-save,.dd-photo-cancel{min-height:36px}}
`;
