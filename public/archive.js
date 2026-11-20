// Archive old months (5.91.0). With sync on, Settings › Your data can move a
// month you are done with to your server (planner_archive, src/worker.js), so
// the planner stays far from the 1.5 MB sync limit. Each archived day keeps its
// light record here (habits, mood, energy), so habit streaks and history stay
// whole. setup.archive lists what is archived, so every device and view knows:
// the Calendar shows an archived day or month with "Bring back". Bringing a
// month back joins it with anything added to those days since.

import { DDaddDays, DDvalidDate, DDcalendarSystem, DDtoday } from "./dates.js";
import { DDcloudConfig, DDcopySize } from "./backups.js";
import { DDstorageBytes, DDsyncLimit } from "./upkeep.js";
import { DDsameSnapshot } from "./sync.js";

// One archive: its first and last day, and when it was made, so a month
// archived again later is a new archive and never writes over another.
const ARCHIVE_ID = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_[a-z0-9]{1,16}$/;
export function DDarchiveClean(list) {
  if (!Array.isArray(list)) return undefined;
  const out = [], seen = new Set();
  for (const e of list.slice(0, 600)) {
    const m = ARCHIVE_ID.exec(typeof e?.id === "string" ? e.id : "");
    if (!m || seen.has(e.id) || !DDvalidDate(m[1]) || !DDvalidDate(m[2]) || m[1] > m[2]) continue;
    seen.add(e.id);
    out.push({
      id: e.id,
      from: m[1],
      to: m[2],
      label: typeof e.label === "string" ? e.label.slice(0, 60) : "",
      days: Math.max(0, Math.min(400, Math.round(Number(e.days)) || 0)),
      bytes: Math.max(0, Math.round(Number(e.bytes)) || 0),
      at: typeof e.at === "string" && Number.isFinite(Date.parse(e.at)) ? e.at.slice(0, 40) : "",
    });
  }
  out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.id < b.id ? -1 : 1));
  return out.length ? out : undefined;
}

// The archives that hold any day from `from` to `to`.
export function DDarchiveOf(setup, from, to = from) {
  return (Array.isArray(setup?.archive) ? setup.archive : []).filter((e) => e && e.from <= to && from <= e.to);
}

const formats = new Map();
function format(language, calendar, options) {
  const key = language + calendar + JSON.stringify(options);
  if (!formats.has(key))
    formats.set(key, new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", { calendar, timeZone: "UTC", ...options }));
  return formats.get(key);
}
function parts(date, calendar) {
  const out = {};
  for (const p of format("en", calendar, { year: "numeric", month: "numeric", day: "numeric", numberingSystem: "latn" }).formatToParts(new Date(date + "T12:00:00Z")))
    if (p.type === "year" || p.type === "month" || p.type === "day") out[p.type] = +p.value;
  return out;
}
// The month a date is in, in the Calendar's system (Gregorian or Persian).
export function DDarchiveMonth(date, calendar = "gregory") {
  const p = parts(date, calendar), from = DDaddDays(date, 1 - p.day);
  let length = 28;
  while (length < 32) {
    const q = parts(DDaddDays(from, length), calendar);
    if (q.month !== p.month || q.year !== p.year) break;
    length++;
  }
  return { from, to: DDaddDays(from, length - 1) };
}
// "August 2026", "Mordad 1405", "مرداد ۱۴۰۵".
export function DDarchiveLabel(from, calendar = "gregory", language = "en") {
  const year = parts(from, calendar).year;
  return format(language, calendar, { month: "long" }).format(new Date(from + "T12:00:00Z")) + " " + (language === "fa" ? year.toLocaleString("fa-IR", { useGrouping: false }) : year);
}
// An archive's name: the one it was given, or its days ("3 Aug – 30 Aug 2026").
export function DDarchiveName(entry, language = "en") {
  if (entry?.label) return entry.label;
  const day = format(language, "gregory", { day: "numeric", month: "short" }), year = format(language, "gregory", { year: "numeric" });
  const at = (d) => new Date(d + "T12:00:00Z");
  return day.format(at(entry.from)) + " – " + day.format(at(entry.to)) + " " + year.format(at(entry.to));
}

// What stays in the planner for an archived day: only what habits, moods and
// energy read, so streaks and habit history stay whole. Nothing else stays.
export function DDarchiveLight(day, date) {
  const keep = {};
  if (typeof day?.mood === "string" && day.mood) keep.mood = day.mood;
  if (Number.isFinite(day?.energy)) keep.energy = day.energy;
  if (day?.habits && typeof day.habits === "object" && Object.keys(day.habits).length) keep.habits = day.habits;
  if (!Object.keys(keep).length) return null;
  return { date, heavy: 0, tpl: "", focus: "", mood: "", journal: "", blocks: [], bugs: [], notes: [], canvas: null, pause: null, ...keep };
}
// A day holds more than its light record: tasks, notes, feelings, words or a board.
export function DDarchiveHolds(day) {
  return !!(day && ((day.blocks || []).length || (day.notes || []).length || (day.bugs || []).length || day.focus || day.journal || (day.canvas && typeof day.canvas === "object" && Object.keys(day.canvas).length)));
}

// Months before last month that still hold more than light records, newest
// first: how many days each holds and how much room it takes.
export function DDarchivePlan(data, { calendar = "gregory", today = DDtoday() } = {}) {
  const current = DDarchiveMonth(today, calendar), last = DDarchiveMonth(DDaddDays(current.from, -1), calendar), days = data?.days || {};
  const months = [];
  let month = null;
  for (const date of Object.keys(days).filter((d) => d < last.from && DDvalidDate(d)).sort()) {
    if (!month || date > month.to) months.push((month = { ...DDarchiveMonth(date, calendar), dates: [] }));
    month.dates.push(date);
  }
  return months
    .filter((m) => !DDarchiveOf(data.setup, m.from, m.to).length && m.dates.some((d) => DDarchiveHolds(days[d])))
    .map((m) => ({
      from: m.from,
      to: m.to,
      days: m.dates.filter((d) => DDarchiveHolds(days[d])).length,
      bytes: DDstorageBytes(Object.fromEntries(m.dates.map((d) => [d, days[d]]))),
    }))
    .reverse();
}

// The planner once a month is safe on the server: its days leave, each keeping
// its light record, and setup.archive lists it. A day changed since it was
// sent stays as it is (bringing the month back joins the two).
export function DDarchiveApply(data, entry, sent) {
  const days = { ...data.days };
  for (const [date, day] of Object.entries(sent || {})) {
    if (!Object.hasOwn(days, date) || !DDsameSnapshot(days[date], day)) continue;
    const light = DDarchiveLight(day, date);
    if (light) days[date] = light;
    else delete days[date];
  }
  return { ...data, setup: { ...data.setup, archive: DDarchiveClean([...(data.setup?.archive || []), entry]) || [] }, days };
}

// Joins an archived day (a) with the same day as it is now (b). Lists of
// things with ids keep both sides, and b's copy of the same thing; b's empty
// fields never wipe a's. Habits, mood and energy are b's: they stayed here.
function join(a, b) {
  if (b === undefined || b === null || b === "" || b === 0 || b === false) return a === undefined || a === null || a === "" ? b : a;
  if (a === undefined || a === null || a === "") return b;
  if (Array.isArray(a) && Array.isArray(b)) {
    const ided = (list) => list.every((x) => x && typeof x === "object" && typeof x.id === "string");
    if (ided(a) && ided(b)) {
      const ids = new Set(b.map((x) => x.id));
      return [...a.filter((x) => !ids.has(x.id)), ...b];
    }
    return b.length ? b : a;
  }
  if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = join(a[k], v);
    return out;
  }
  return b;
}
const LIGHT = ["mood", "energy", "habits"];
export function DDarchiveJoin(archived, now, date) {
  if (!now || typeof now !== "object") return { ...archived, date };
  const out = join(archived, now);
  for (const key of LIGHT) {
    if (now[key] !== undefined && now[key] !== "") out[key] = now[key];
    else if (key === "mood") out.mood = "";
    else delete out[key];
  }
  return { ...out, date };
}
// Several archives of the same days (rare: two devices archived at once), older first.
export function DDarchiveRows(rows) {
  const days = {};
  for (const row of [...rows].sort((a, b) => String(a?.archivedAt || "").localeCompare(String(b?.archivedAt || ""))))
    for (const [date, day] of Object.entries(row?.days || {}))
      if (DDvalidDate(date) && day && typeof day === "object") days[date] = days[date] ? DDarchiveJoin(days[date], day, date) : { ...day, date };
  return days;
}
export function DDbringBackApply(data, ids, archived) {
  const days = { ...data.days };
  for (const [date, day] of Object.entries(archived || {})) days[date] = DDarchiveJoin(day, days[date], date);
  const archive = (data.setup?.archive || []).filter((e) => !ids.includes(e.id)), setup = { ...data.setup };
  if (archive.length) setup.archive = archive;
  else delete setup.archive;
  return { ...data, setup, days };
}

// The server side: /api/archive with the sync key.
async function call(config, method, query = "", body) {
  const res = await fetch(config.url.replace(/\/$/, "") + "/api/archive" + query, {
    method,
    headers: { Authorization: "Bearer " + config.key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let out = null;
  try { out = await res.json(); } catch {}
  if (!res.ok || !out || typeof out !== "object") throw Object.assign(Error(out?.error || "unreachable"), { status: res.status });
  return out;
}
export const DDarchiveList = (config) => call(config);
export const DDarchiveRead = (config, id) => call(config, "GET", "?id=" + encodeURIComponent(id));
export const DDarchiveSend = (config, id, days) => call(config, "PUT", "?id=" + encodeURIComponent(id), { days });

const words = (language) => {
  const fa = language === "fa", t = (en, f) => (fa ? f : en), n = (v) => (fa ? Number(v).toLocaleString("fa-IR") : String(v));
  return { fa, t, n, days: (count) => t(count === 1 ? "1 day" : count + " days", n(count) + " روز") };
};
const mb = (bytes, language) => DDcopySize(bytes, language);

// Brings archives back from the server. Never goes past the sync limit.
// Returns { ok } or { message } for the place that asked to show.
export async function DDbringBack({ data, entries, change, onToast, language = "en", onMissing }) {
  const { t } = words(language), config = DDcloudConfig(), name = entries.map((e) => DDarchiveName(e, language)).join(t(", ", "، "));
  if (!config) return { message: t("Turn sync on to bring " + name + " back from your server.", "برای برگرداندن " + name + " از سرورت، همگام‌سازی را روشن کن.") };
  const settled = await Promise.allSettled(entries.map((e) => DDarchiveRead(config, e.id)));
  const found = [], gone = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? found.push(s.value) : s.reason?.status === 404 ? gone.push(entries[i]) : null));
  if (found.length + gone.length < entries.length) return { message: t("Your server couldn't be reached just now, so nothing changed. Try again in a moment.", "الان به سرورت وصل نشد، پس چیزی عوض نشد. کمی بعد دوباره امتحان کن.") };
  if (gone.length) onMissing?.(gone.map((e) => e.id));
  const missing = gone.length ? t(gone.map((e) => DDarchiveName(e, language)).join(", ") + " isn't on this server any more, so it can't come back from here. A backup file, or a daily copy from before you archived it, still has it.", gone.map((e) => DDarchiveName(e, language)).join("، ") + " دیگر روی این سرور نیست، پس از اینجا برنمی‌گردد. یک فایل پشتیبان یا نسخهٔ روزانهٔ قبل از بایگانی هنوز آن را دارد.") : "";
  if (!found.length) return { message: missing };
  const ids = entries.filter((e) => !gone.includes(e)).map((e) => e.id), days = DDarchiveRows(found), next = DDbringBackApply(data, ids, days), bytes = DDstorageBytes({ setup: next.setup, days: next.days });
  if (bytes > DDsyncLimit)
    return { message: t("Bringing back " + name + " would take your planner over the 1.5 MB sync limit (" + mb(bytes, language) + "), so it stays in your archive. Archive another month first, or delete drawings you no longer need.", "برگرداندن " + name + " برنامه را از سقف ۱٫۵ مگابایت همگام‌سازی بالاتر می‌برد (" + mb(bytes, language) + ")، پس در بایگانی می‌ماند. اول ماه دیگری را بایگانی کن، یا نقاشی‌هایی را که لازم نداری پاک کن.") };
  change((old) => DDbringBackApply(old, ids, days));
  onToast?.(t(entries.filter((e) => !gone.includes(e)).map((e) => DDarchiveName(e, language)).join(", ") + " is back", entries.filter((e) => !gone.includes(e)).map((e) => DDarchiveName(e, language)).join("، ") + " برگشت"));
  return missing ? { ok: true, message: missing } : { ok: true };
}

// Settings › Your data › Archive old months (only with sync on).
export function DDArchive({ React: R, data, onChangeData, onToast, language = "en" }) {
  const h = R.createElement, { fa, t, days: daysText } = words(language);
  const [armed, setArmed] = R.useState(""), [busy, setBusy] = R.useState(""), [note, setNote] = R.useState(""), [missing, setMissing] = R.useState([]);
  const config = DDcloudConfig(), calendar = DDcalendarSystem(language), today = DDtoday(), archived = Array.isArray(data?.setup?.archive) ? data.setup.archive : [];
  const plan = R.useMemo(() => (config ? DDarchivePlan(data, { calendar, today }) : []), [data?.days, data?.setup?.archive, calendar, today, !!config]);
  const known = archived.map((e) => e.id).join(",");
  R.useEffect(() => {
    if (!config || !archived.length) return;
    let live = true;
    DDarchiveList(config).then((out) => {
      const there = new Set((Array.isArray(out.archives) ? out.archives : []).map((a) => a.id));
      if (live) setMissing(archived.filter((e) => !there.has(e.id)).map((e) => e.id));
    }, () => {});
    return () => { live = false; };
  }, [config?.url, known]);
  if (!config || !onChangeData) return null;
  const archive = async (month, name) => {
    const c = DDcloudConfig() || config, sent = Object.fromEntries(Object.entries(data.days).filter(([d]) => d >= month.from && d <= month.to));
    const id = month.from + "_" + month.to + "_" + Date.now().toString(36);
    setBusy(month.from);
    setNote("");
    try {
      const out = await DDarchiveSend(c, id, sent);
      if (out.days !== Object.keys(sent).length) throw Error("count");
    } catch (error) {
      setBusy("");
      setNote(error.status === 413
        ? t(name + " is too big to send in one go, so nothing changed.", name + " بزرگ‌تر از آن است که یک‌جا فرستاده شود، پس چیزی عوض نشد.")
        : t("Your server couldn't be reached just now, so nothing was archived. Try again in a moment.", "الان به سرورت وصل نشد، پس چیزی بایگانی نشد. کمی بعد دوباره امتحان کن."));
      return;
    }
    const entry = { id, from: month.from, to: month.to, label: name, days: month.days, bytes: month.bytes, at: new Date().toISOString() };
    onChangeData((old) => DDarchiveApply(old, entry, sent));
    setBusy("");
    setArmed("");
    onToast?.(t(name + " is in your archive", name + " بایگانی شد"), () => onChangeData((old) => DDbringBackApply(old, [id], sent)));
  };
  const back = async (entry) => {
    setBusy(entry.id);
    setNote("");
    const out = await DDbringBack({ data, entries: [entry], change: onChangeData, onToast, language, onMissing: (ids) => setMissing((old) => [...new Set([...old, ...ids])]) });
    setBusy("");
    if (out.message) setNote(out.message);
  };
  const forget = (entry) => {
    onChangeData((old) => DDbringBackApply(old, [entry.id], {}));
    onToast?.(t(DDarchiveName(entry, language) + " is off the list", DDarchiveName(entry, language) + " از فهرست رفت"), () => onChangeData((old) => ({ ...old, setup: { ...old.setup, archive: DDarchiveClean([...(old.setup?.archive || []), entry]) || [] } })));
  };
  const row = (key, name, info, button, extra) =>
    h("li", { key, "data-archive-month": key },
      h("div", { className: "dd-copy-line" }, h("span", { className: "dd-copy-when" }, name), h("small", null, info), button),
      extra);
  return h("div", { className: "dd-archive", "data-archive": plan.length, dir: fa ? "rtl" : "ltr" },
    h("h3", null, t("Archive old months", "بایگانی ماه‌های قدیمی")),
    h("p", { className: "desc" }, t("Months you're done with can move to your server, so this planner stays light. Habits keep their record, and a month comes back with one tap.",
      "ماه‌هایی که کارشان تمام شده می‌توانند به سرورت بروند تا این برنامه سبک بماند. عادت‌ها سابقه‌شان را نگه می‌دارند و هر ماه با یک ضربه برمی‌گردد.")),
    note && h("p", { className: "desc dd-archive-note", role: "status" }, note),
    plan.length
      ? h("ul", { className: "dd-copy-list", "aria-label": t("Months you can archive", "ماه‌هایی که می‌شود بایگانی کرد") },
          plan.map((month) => {
            const key = month.from, name = DDarchiveLabel(month.from, calendar, language);
            return row(key, name, daysText(month.days) + " · " + mb(month.bytes, language),
              h("button", { type: "button", className: "btn", disabled: !!busy, "aria-expanded": armed === key, "aria-label": t("Archive " + name, "بایگانی " + name), onClick: () => setArmed(armed === key ? "" : key) }, t("Archive", "بایگانی")),
              armed === key && h("div", { className: "dd-copy-confirm", role: "group", "aria-label": t("Archive this month?", "این ماه بایگانی شود؟") },
                h("p", null, t("Archive " + name + "? Its days move to your server and leave this planner, so they won't show in the Calendar, search or the week's look back until you bring them back. Habits keep their record.",
                  name + " بایگانی شود؟ روزهایش به سرورت می‌روند و از این برنامه بیرون می‌آیند، پس تا برشان نگردانی در تقویم، جستجو و مرور هفته دیده نمی‌شوند. عادت‌ها سابقه‌شان را نگه می‌دارند.")),
                h("div", { className: "dd-actions" },
                  h("button", { type: "button", className: "btn solid", disabled: !!busy, onClick: () => archive(month, name) }, busy === key ? t("Archiving…", "در حال بایگانی…") : t("Archive this month", "این ماه بایگانی شود")),
                  h("button", { type: "button", className: "btn", onClick: () => setArmed("") }, t("Cancel", "انصراف")))));
          }))
      : h("p", { className: "desc" }, t("Nothing to archive yet: months before last month can be archived.", "فعلا چیزی برای بایگانی نیست: ماه‌های قبل از ماه گذشته را می‌شود بایگانی کرد.")),
    archived.length > 0 && h(R.Fragment, null,
      h("h4", null, t("In your archive", "در بایگانی")),
      h("ul", { className: "dd-copy-list", "aria-label": t("Archived months", "ماه‌های بایگانی‌شده") },
        [...archived].reverse().map((entry) => {
          const name = DDarchiveName(entry, language), gone = missing.includes(entry.id);
          return row(entry.id, name, gone ? t("Not on this server", "روی این سرور نیست") : daysText(entry.days) + " · " + mb(entry.bytes, language),
            gone
              ? h("button", { type: "button", className: "btn", disabled: !!busy, "aria-label": t("Take " + name + " off the list", "حذف " + name + " از فهرست"), onClick: () => forget(entry) }, t("Take off the list", "حذف از فهرست"))
              : h("button", { type: "button", className: "btn", disabled: !!busy, "aria-label": t("Bring back " + name, "برگرداندن " + name), onClick: () => back(entry) }, busy === entry.id ? t("Bringing back…", "در حال برگرداندن…") : t("Bring back", "برگرداندن")));
        }))));
}

// The Calendar's quiet line on an archived day or month, with Bring back.
export function DDArchivedNote({ React: R, data, from, to = from, setData, onToast, language = "en", scope = "day" }) {
  const h = R.createElement, { t } = words(language);
  const [busy, setBusy] = R.useState(false), [note, setNote] = R.useState("");
  const entries = DDarchiveOf(data?.setup, from, to);
  if (!entries.length || !setData) return null;
  const name = entries.map((e) => DDarchiveName(e, language)).join(t(", ", "، ")), whole = entries.some((e) => e.from <= from && to <= e.to);
  const text = scope === "day"
    ? t("This day is in your archive. Its tasks, notes and board wait on your server with " + name + ".", "این روز در بایگانی است. کارها، یادداشت‌ها و بردش همراه " + name + " روی سرورت منتظرند.")
    : whole
      ? t(name + " is in your archive. Its days wait on your server.", name + " در بایگانی است. روزهایش روی سرورت منتظرند.")
      : t("Some days this month are in your archive, with " + name + ".", "چند روز از این ماه همراه " + name + " در بایگانی است.");
  return h("div", { className: "dd-archived-note", role: "note", "data-archived-note": scope },
    h("p", null, text, note && h("span", { className: "dd-archived-why", role: "status" }, " " + note)),
    h("button", {
      type: "button",
      className: "btn",
      disabled: busy,
      onClick: async () => {
        setBusy(true);
        setNote("");
        const out = await DDbringBack({ data, entries, change: setData, onToast, language });
        setBusy(false);
        if (out.message) setNote(out.message);
      },
    }, busy ? t("Bringing back…", "در حال برگرداندن…") : t("Bring back " + name, "برگرداندن " + name)));
}

export const DDarchiveCSS = `
.dd-archive{display:flex;flex-direction:column;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--rule)}
.dd-archive h3{margin:0;font:600 14px/1.3 var(--sans);color:var(--ink)}
.dd-archive h4{margin:6px 0 0;font:600 13px/1.3 var(--sans);color:var(--ink-2)}
.dd-archive .desc{margin:0}
.dd-archived-note{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:10px 0;padding:10px 12px;border-radius:12px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule)}
.dd-archived-note p{flex:1 1 220px;min-width:0;margin:0;font-size:13px;line-height:1.45;color:var(--ink-2)}
@media (pointer:coarse){.dd-archive .btn,.dd-archived-note .btn{min-height:44px}}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-archive-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-archive-styles", textContent: DDarchiveCSS }));
