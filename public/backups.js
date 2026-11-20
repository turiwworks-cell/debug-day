// Copies on your server (5.90.0). With sync on, the server keeps the planner as
// it was at the end of each of the last 30 days it changed, and its last 20
// saves (src/worker.js, GET /api/backups). Settings › Your data lists them:
// download one as a backup file, or restore it. Restoring works like importing
// a backup: your setup and the days in that copy come back, days added since
// stay, and a recovery copy of how things are now is saved in this browser first.

const CONFIG = "debug-day:cloud-config";

export function DDcloudConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG) || "null");
    return c?.url && c?.key ? c : null;
  } catch {
    return null;
  }
}

async function ask(config, query = "") {
  const res = await fetch(config.url.replace(/\/$/, "") + "/api/backups" + query, { headers: { Authorization: "Bearer " + config.key }, cache: "no-store" });
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok || !body || typeof body !== "object") throw Error(body?.error || "unreachable");
  return body;
}
export const DDlistServerCopies = (config) => ask(config);
export const DDreadServerCopy = (config, copy) => ask(config, copy.day ? "?day=" + encodeURIComponent(copy.day) : "?revision=" + copy.revision);

// "1.2 MB", "412 KB".
export function DDcopySize(bytes, language = "en") {
  const fa = language === "fa", kb = Math.max(1, Math.round((Number(bytes) || 0) / 1000));
  const text = kb >= 1000 ? (kb / 1000).toFixed(1).replace(/\.0$/, "") + " MB" : kb + " KB";
  return fa ? text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]).replace(".", "٫") : text;
}

// When a copy is from, in this device's time: "Today, 14:05", "Yesterday, 22:10",
// "Wed 19 Nov, 23:40".
export function DDcopyWhen(iso, language = "en", now = new Date()) {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "";
  const fa = language === "fa", locale = fa ? "fa-IR" : "en-GB";
  const time = at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  const dayOf = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = dayOf(at) === dayOf(now) ? (fa ? "امروز" : "Today") : dayOf(at) === dayOf(yesterday) ? (fa ? "دیروز" : "Yesterday")
    : at.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  return day + (fa ? "، " : ", ") + time;
}

// A copy as a backup file, in the same shape as "Download a backup".
export function DDcopyFile(copy, body) {
  const name = "debug-day-server-" + (copy.day ? copy.day : "save-" + copy.revision) + ".json";
  const text = JSON.stringify({ app: "debug-day", format: 6, exportedAt: new Date().toISOString(), copyOf: body.updatedAt, setup: body.data?.setup, days: body.data?.days }, null, 2);
  return { name, text };
}

export function DDServerCopies({ React: R, language = "en", onRestore, onDownload, onToast }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en);
  const [list, setList] = R.useState(null), [armed, setArmed] = R.useState(""), [busy, setBusy] = R.useState(""), [failed, setFailed] = R.useState(false);
  const config = DDcloudConfig();
  const load = () => {
    const c = DDcloudConfig();
    if (!c) return;
    setFailed(false);
    DDlistServerCopies(c).then((body) => setList({ daily: Array.isArray(body.daily) ? body.daily : [], recent: Array.isArray(body.recent) ? body.recent : [] }), () => setFailed(true));
  };
  R.useEffect(load, [config?.url]);
  if (!config) return null;
  const keyOf = (copy) => (copy.day ? "day-" + copy.day : "save-" + copy.revision);
  const fetchCopy = async (copy) => {
    setBusy(keyOf(copy));
    try {
      return await DDreadServerCopy(DDcloudConfig() || config, copy);
    } catch {
      onToast?.(t("That copy couldn't be fetched just now. Try again in a moment.", "الان این نسخه دریافت نشد. کمی بعد دوباره امتحان کن."));
      return null;
    } finally {
      setBusy("");
    }
  };
  const download = async (copy) => {
    const body = await fetchCopy(copy);
    if (!body) return;
    const file = DDcopyFile(copy, body);
    onDownload?.(file.text, file.name);
  };
  const restore = async (copy) => {
    const body = await fetchCopy(copy);
    if (!body) return;
    setArmed("");
    if (onRestore?.(body.data)) {
      onToast?.(t("Copy restored", "نسخه برگشت"));
      setTimeout(load, 1500);
    } else onToast?.(t("No recovery copy could be saved on this device (storage is full), so nothing was replaced.", "نسخهٔ بازیابی روی این دستگاه ذخیره نشد (حافظه پر است)، پس چیزی جایگزین نشد."));
  };
  const row = (copy) => {
    const key = keyOf(copy), when = DDcopyWhen(copy.updatedAt, language);
    return h("li", { key, "data-server-copy": key },
      h("div", { className: "dd-copy-line" },
        h("span", { className: "dd-copy-when" }, when),
        h("small", null, DDcopySize(copy.bytes, language)),
        h("button", { type: "button", className: "btn", disabled: !!busy, onClick: () => download(copy), "aria-label": t("Download the copy from " + when, "دانلود نسخهٔ " + when) }, t("Download", "دانلود")),
        h("button", { type: "button", className: "btn", disabled: !!busy, "aria-expanded": armed === key, onClick: () => setArmed(armed === key ? "" : key), "aria-label": t("Restore the copy from " + when, "برگرداندن نسخهٔ " + when) }, t("Restore", "برگرداندن"))),
      armed === key && h("div", { className: "dd-copy-confirm", role: "group", "aria-label": t("Restore this copy?", "این نسخه برگردد؟") },
        h("p", null, t("Restore the copy from " + when + "? Your setup and the days in it come back; days added since then stay. A recovery copy of how things are now is saved in this browser first.",
          "نسخهٔ " + when + " برگردد؟ تنظیمات و روزهای داخلش برمی‌گردند و روزهایی که بعد از آن اضافه شده‌اند می‌مانند. اول یک نسخهٔ بازیابی از وضع فعلی در همین مرورگر ذخیره می‌شود.")),
        h("div", { className: "dd-actions" },
          h("button", { type: "button", className: "btn solid", disabled: !!busy, onClick: () => restore(copy) }, busy === key ? t("Restoring…", "در حال برگرداندن…") : t("Restore this copy", "این نسخه برگردد")),
          h("button", { type: "button", className: "btn", onClick: () => setArmed("") }, t("Cancel", "انصراف")))));
  };
  return h("div", { className: "dd-server-copies", "data-server-copies": list ? list.daily.length : "", dir: fa ? "rtl" : "ltr" },
    h("h3", null, t("Copies on your server", "نسخه‌های روی سرورت")),
    h("p", { className: "desc" }, t("Your server keeps your planner as it was at the end of each of the last 30 days you changed it, and your last 20 saves.",
      "سرورت برنامه‌ات را همان‌طور که در پایان هر کدام از ۳۰ روز آخرِ تغییر بود نگه می‌دارد، و ۲۰ ذخیرهٔ آخر را هم.")),
    failed ? h("p", { className: "desc", role: "status" }, t("Your server couldn't be reached just now. ", "الان به سرورت وصل نشد. "),
      h("button", { type: "button", className: "textbtn", onClick: load }, t("Try again", "دوباره امتحان کن")))
    : !list ? h("p", { className: "desc", role: "status" }, t("Looking for copies…", "در حال پیدا کردن نسخه‌ها…"))
    : h(R.Fragment, null,
        list.daily.length ? h("ul", { className: "dd-copy-list", "aria-label": t("Daily copies", "نسخه‌های روزانه") }, list.daily.map(row))
          : h("p", { className: "desc" }, t("The first daily copy is made with the first change of a new day.", "اولین نسخهٔ روزانه با اولین تغییرِ یک روز تازه ساخته می‌شود.")),
        list.recent.length > 0 && h("details", { className: "dd-copy-recent" },
          h("summary", null, list.recent.length === 1 ? t("Last save", "ذخیرهٔ آخر") : t("Last " + list.recent.length + " saves", list.recent.length.toLocaleString("fa-IR") + " ذخیرهٔ آخر")),
          h("ul", { className: "dd-copy-list" }, list.recent.map(row)))));
}

export const DDbackupsCSS = `
.dd-server-copies{display:flex;flex-direction:column;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--rule)}
.dd-server-copies h3{margin:0;font:600 14px/1.3 var(--sans);color:var(--ink)}
.dd-server-copies .desc{margin:0}
.dd-copy-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dd-copy-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
.dd-copy-when{flex:1;min-width:120px;font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}
.dd-copy-line small{font-size:12px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.dd-copy-confirm{margin:6px 0 4px;padding:10px 12px;border-radius:10px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule)}
.dd-copy-confirm p{margin:0 0 8px;font-size:13px;line-height:1.45;color:var(--ink-2)}
.dd-copy-recent summary{cursor:pointer;font-size:13px;color:var(--ink-2);padding:6px 0}
.dd-copy-recent .dd-copy-list{margin-top:6px}
@media (pointer:coarse){.dd-copy-line .btn,.dd-copy-confirm .btn,.dd-server-copies .textbtn{min-height:44px}.dd-copy-recent summary{min-height:44px;display:flex;align-items:center}}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-backups-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-backups-styles", textContent: DDbackupsCSS }));
