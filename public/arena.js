// Are.na references contain links only. Image bytes stay on Are.na's CDN.
export function DDarenaImageURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return "";
    if (u.hostname !== "d2w9rnfcy7mm78.cloudfront.net" && u.hostname !== "images.are.na" && u.hostname !== "attachments.are.na") return "";
    return u.href;
  } catch { return ""; }
}
export function DDarenaMedia(block) {
  if (block?.type !== "Image" || !Number.isSafeInteger(block.id) || block.id < 1) return null;
  const image = block.image || {}, src = DDarenaImageURL(image.medium?.src || image.large?.src || image.src);
  if (!src) return null;
  const w = Number(image.width), h = Number(image.height);
  return {
    id: "arena_" + block.id, provider: "arena", blockId: block.id,
    name: String(block.title || image.filename || "Are.na").slice(0, 200), mime: "image/jpeg", size: 0,
    src, original: DDarenaImageURL(image.src || image.large?.src) || src,
    ...(Number.isSafeInteger(w) && w > 0 && w <= 100000 && Number.isSafeInteger(h) && h > 0 && h <= 100000 ? { w, h } : {}),
  };
}
export function DDarenaInput(value) {
  const s = String(value || "").trim();
  if (!s || s.length > 500) throw Error("input");
  if (!/^https?:/i.test(s)) return { op: "search", query: s };
  let u;
  try { u = new URL(s); } catch { throw Error("input"); }
  if (!["are.na", "www.are.na"].includes(u.hostname) || u.username || u.password || u.port) throw Error("input");
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "block" && /^[1-9]\d*$/.test(parts[1])) return { op: "block", id: parts[1] };
  if (parts.length === 2 && !["settings", "developers", "block"].includes(parts[0]) && /^[\w-]+$/.test(parts[1])) return { op: "channel", id: parts[1] };
  throw Error("input");
}
export function DDarenaError(code, fa) {
  const errors = {
    input: ["Paste an Are.na block or channel link, or enter a search.", "لینک بلاک یا کانال Are.na را وارد کن یا عبارتی برای جست‌وجو بنویس."],
    sync: ["Connect this device to Debug Day in Settings first.", "اول این دستگاه را از تنظیمات به Debug Day وصل کن."],
    401: ["Check the Debug Day connection and the Are.na token in Cloudflare.", "اتصال Debug Day و توکن Are.na در Cloudflare را بررسی کن."],
    403: ["This content needs permission. Search requires a Premium account token.", "این محتوا به مجوز نیاز دارد. جست‌وجو به توکن حساب Premium نیاز دارد."],
    404: ["This Are.na item is unavailable or private.", "این مورد در Are.na در دسترس نیست یا خصوصی است."],
    429: ["Are.na is receiving too many requests. Wait a little before trying again.", "درخواست‌ها به Are.na زیاد شده. کمی صبر کن و دوباره امتحان کن."],
    503: ["Add the read-only ARENA_ACCESS_TOKEN secret in Cloudflare to enable search.", "برای فعال‌شدن جست‌وجو، توکن فقط‌خواندنی ARENA_ACCESS_TOKEN را در Cloudflare ثبت کن."],
  };
  return (errors[code] || ["Couldn't reach Are.na. Try again.", "اتصال به Are.na برقرار نشد. دوباره امتحان کن."])[fa ? 1 : 0];
}
export async function DDarenaRequest(params, signal) {
  let c;
  try { c = JSON.parse(localStorage.getItem("debug-day:cloud-config") || "null"); } catch {}
  if (!c?.url || !c?.key) throw Error("sync");
  const base = new URL(c.url);
  const url = new URL("/api/arena", base);
  url.search = new URLSearchParams(params).toString();
  const r = await fetch(url, { signal, headers: { Authorization: "Bearer " + c.key } });
  if (!r.ok) throw Error(String(r.status));
  return r.json();
}

export function DDarenaPicker({ React: R, onClose, onAdd, initial = "", language }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => fa ? f : en;
  const [input, setInput] = R.useState(initial), [kind, setKind] = R.useState("Image"), [request, setRequest] = R.useState(null);
  const [result, setResult] = R.useState(null), [selected, setSelected] = R.useState(new Set()), [busy, setBusy] = R.useState(false), [error, setError] = R.useState("");
  const dialog = R.useRef(null), field = R.useRef(null), active = R.useRef(null);
  R.useEffect(() => {
    const previous = document.activeElement;
    field.current?.focus();
    document.addEventListener("keydown", keys, true);
    return () => { document.removeEventListener("keydown", keys, true); active.current?.abort(); if (previous?.isConnected) previous.focus(); else document.querySelector(".b2-viewport")?.focus({ preventScroll: true }); };
  }, []);
  async function load(spec) {
    active.current?.abort();
    const a = new AbortController(); active.current = a;
    setBusy(true); setError(""); setSelected(new Set()); setResult(null); setRequest(spec);
    try {
      const data = await DDarenaRequest(spec, a.signal);
      if (!a.signal.aborted) setResult(data);
    } catch (e) { if (!a.signal.aborted) setError(DDarenaError(e.message, fa)); }
    finally { if (!a.signal.aborted) setBusy(false); }
  }
  function submit(e) {
    e.preventDefault();
    try { load({ ...DDarenaInput(input), type: kind, page: 1 }); }
    catch (e) { setError(DDarenaError(e.message, fa)); }
  }
  const rows = result?.data || [], chosen = rows.filter((b) => selected.has(b.id)).map(DDarenaMedia).filter(Boolean);
  function keys(e) {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key === "Tab") {
      const list = [...dialog.current.querySelectorAll('button:not([disabled]),input,select,a[href]')];
      const first = list[0], last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  return h("div", { className: "dd-arena-backdrop", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { if (e.target === e.currentTarget) onClose(); }, },
    h("section", { ref: dialog, role: "dialog", "aria-modal": true, "aria-label": "Are.na", className: "dd-arena-dialog", dir: fa ? "rtl" : "ltr" },
      h("header", null, h("h2", null, "Are.na"), h("button", { type: "button", className: "btn", onClick: onClose, "aria-label": t("Close", "بستن") }, "×")),
      h("form", { onSubmit: submit },
        h("label", null, t("Search or paste an Are.na link", "جست‌وجو یا لینک Are.na"), h("input", { ref: field, value: input, dir: "auto", maxLength: 500, onChange: (e) => setInput(e.target.value) })),
        h("select", { value: kind, "aria-label": t("Search type", "نوع جست‌وجو"), onChange: (e) => setKind(e.target.value) }, h("option", { value: "Image" }, t("Images", "عکس‌ها")), h("option", { value: "Channel" }, t("Channels", "کانال‌ها"))),
        h("button", { type: "submit", className: "btn solid", disabled: busy || !input.trim() }, t("Find", "پیدا کن"))),
      h("p", { className: "dd-arena-help" }, t("Images load online from Are.na. Only links and positions are saved on your board.", "عکس‌ها آنلاین از Are.na نمایش داده می‌شوند. فقط لینک و جای آن‌ها روی برد ذخیره می‌شود.")),
      h("div", { role: "status", "aria-live": "polite" }, busy ? t("Loading…", "در حال دریافت…") : error),
      result && !rows.length && h("p", null, t("No images or channels on this page.", "در این صفحه عکس یا کانالی نیست.")),
      h("div", { className: "dd-arena-results", "aria-busy": busy }, rows.map((b) => {
        if (b.base_type === "Channel") return h("button", { key: "c" + b.id, type: "button", className: "dd-arena-channel", onClick: () => load({ op: "channel", id: b.slug || b.id, page: 1 }) }, b.title || b.slug);
        const m = DDarenaMedia(b); if (!m) return null;
        return h("button", { key: b.id, type: "button", className: "dd-arena-result", "aria-pressed": selected.has(b.id), "aria-label": m.name, onClick: () => setSelected((old) => { const n = new Set(old); if (n.has(b.id)) n.delete(b.id); else if (n.size < 12) n.add(b.id); return n; }) },
          h("img", { src: m.src, alt: "", loading: "lazy", referrerPolicy: "no-referrer" }), h("span", { dir: "auto" }, m.name));
      })),
      h("footer", null,
        request && result && h("div", null,
          h("button", { type: "button", className: "btn", disabled: busy || Number(request.page || 1) <= 1, onClick: () => load({ ...request, page: Number(request.page) - 1 }) }, t("Previous", "قبلی")),
          h("button", { type: "button", className: "btn", disabled: busy || !result.meta?.has_more_pages, onClick: () => load({ ...request, page: Number(request.page || 1) + 1 }) }, t("Next", "بعدی"))),
        h("button", { type: "button", className: "btn solid", disabled: !chosen.length || busy, onClick: () => { onAdd(chosen); onClose(); } }, t("Add selected", "افزودن انتخاب‌ها") + (chosen.length ? " · " + chosen.length : "")))));
}
export const DDarenaCSS = `
.dd-arena-backdrop{position:fixed;inset:0;z-index:12000;background:#0005;display:flex;align-items:center;justify-content:center;padding:20px;cursor:default}
.dd-arena-dialog{background:var(--paper);color:var(--ink);border:1px solid var(--rule);border-radius:16px;width:min(760px,100%);max-height:85dvh;padding:20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;overflow:auto;user-select:text}
.dd-arena-dialog header,.dd-arena-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.dd-arena-dialog h2{font-size:18px;margin:0}.dd-arena-dialog form{display:flex;align-items:end;gap:8px;flex-wrap:wrap}.dd-arena-dialog label{display:grid;gap:6px;flex:1;min-width:180px;font-size:13px}.dd-arena-dialog input,.dd-arena-dialog select{box-sizing:border-box;min-width:0;max-width:100%;padding:8px;background:var(--panel);color:var(--ink);border:1px solid var(--rule-2);border-radius:8px;font:inherit}.dd-arena-help{font-size:12px;color:var(--ink-3);margin:0;line-height:1.7}
.dd-arena-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;overflow:auto;min-height:100px}.dd-arena-result,.dd-arena-channel{background:var(--panel);border:2px solid var(--rule);border-radius:8px;overflow:hidden;padding:0;color:var(--ink);cursor:pointer;text-align:start}.dd-arena-result[aria-pressed=true]{border-color:var(--now)}.dd-arena-result img{display:block;width:100%;height:130px;object-fit:contain}.dd-arena-result span{display:block;padding:8px;font:12px var(--sans);overflow-wrap:anywhere}.dd-arena-channel{padding:16px;font:inherit}
.b4-sticky[data-photo] .dd-photo-face[data-provider=arena] img{object-fit:contain}
@media(max-width:700px){.dd-arena-backdrop{padding:0;align-items:end}.dd-arena-dialog{border-radius:16px 16px 0 0;max-height:90dvh;padding:16px}.dd-arena-dialog button,.dd-arena-dialog input,.dd-arena-dialog select{min-height:44px}.dd-arena-dialog footer{position:sticky;bottom:0;background:var(--paper);padding-top:8px}}
`;
