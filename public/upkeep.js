// Upkeep (5.45): small things that keep the planner light and easy to trust.

// "Synced · 2 min ago" beside the logo, so you know the phone and laptop agree.
export function DDsyncAgo(iso, now = Date.now(), language = "en") {
  const at = Date.parse(iso || ""), fa = language === "fa", num = (n) => (fa ? n.toLocaleString("fa-IR") : String(n));
  if (!Number.isFinite(at)) return fa ? "همگام شد" : "Synced";
  const mins = Math.max(0, Math.floor((now - at) / 6e4)), hours = Math.floor(mins / 60);
  const ago = mins < 1 ? (fa ? "همین الان" : "just now") : mins < 60 ? (fa ? num(mins) + " دقیقه پیش" : mins + " min ago") : hours < 24 ? (fa ? num(hours) + " ساعت پیش" : hours + "h ago") : fa ? "دیروز یا قبل‌تر" : "a day ago or more";
  return (fa ? "همگام شد · " : "Synced · ") + ago;
}

// A day's board used to keep its own copy of every Feed note's place, but the
// Feed's places live in setup.life. Those copies are dropped; nothing reads them.
export function DDcanvasTidy(canvas) {
  const layouts = canvas?.board4?.layouts;
  if (!layouts || typeof layouts !== "object") return canvas || null;
  let changed = false;
  const next = {};
  for (const [mode, places] of Object.entries(layouts)) {
    if (!places || typeof places !== "object") { next[mode] = places; continue; }
    const kept = {};
    for (const [ref, place] of Object.entries(places)) {
      if (ref.startsWith("life:")) changed = true;
      else kept[ref] = place;
    }
    next[mode] = kept;
  }
  return changed ? { ...canvas, board4: { ...canvas.board4, layouts: next } } : canvas;
}

// How much of the 1.5 MB sync limit the planner uses.
export const DDsyncLimit = 1500000;
export function DDstorageBytes(data) {
  try { return new TextEncoder().encode(JSON.stringify(data)).byteLength; } catch { return 0; }
}
export function DDstorageText(bytes, language = "en") {
  const fa = language === "fa", kb = Math.max(1, Math.round(bytes / 1000)),
    used = kb >= 1000 ? (bytes / 1e6).toFixed(2).replace(/0$/, "") + " MB" : kb + " KB",
    part = Math.min(100, Math.round((bytes / DDsyncLimit) * 100)),
    n = (v) => (fa ? String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]).replace(".", "٫") : String(v));
  return fa ? "فضای استفاده‌شده: " + n(used) + " از ۱٫۵ MB (" + n(part) + "٪)" : "Space used: " + used + " of 1.5 MB (" + part + "%)";
}
export function DDStorageUse({ React: R, data, language }) {
  const bytes = DDstorageBytes(data), part = bytes / DDsyncLimit;
  return R.createElement("p", { className: "desc dd-storage-use", "data-storage-part": Math.round(part * 100), dir: language === "fa" ? "rtl" : "ltr" },
    R.createElement("span", { className: "dd-storage-bar", "aria-hidden": true }, R.createElement("i", { style: { width: Math.min(100, Math.max(2, part * 100)) + "%" } })),
    DDstorageText(bytes, language));
}

export const DDupkeepCSS = `
.dd-cloud-mini::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;margin-inline-end:6px;vertical-align:1px;background:var(--ink-4,#b7b4ab)}
.dd-cloud-mini[data-status=synced]::before{background:var(--ok,#2BA672)}
.dd-cloud-mini:is([data-status=syncing],[data-status=pending],[data-status=connecting],[data-status=offline])::before{background:var(--now,#F05A28)}
.dd-cloud-mini:is([data-status=error],[data-status=conflict])::before{background:currentColor}
.dd-storage-use{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dd-storage-bar{display:inline-block;width:96px;height:6px;border-radius:999px;background:var(--wash,#f1efe9);box-shadow:inset 0 0 0 1px var(--rule-2,#ddd9cf);overflow:hidden}
.dd-storage-bar>i{display:block;height:100%;background:var(--ink-3,#77746b)}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-upkeep-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-upkeep-styles", textContent: DDupkeepCSS }));
