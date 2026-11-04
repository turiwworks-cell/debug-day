// Recently deleted (5.45). When notes or sections are deleted from the Feed,
// a copy waits here for 30 days and can be put back where it was. It lives in
// the Feed (setup.life.trash), so every device sees the same list, and Undo of
// the delete also takes the entry away. life-board.js passes in its own item
// cleaner, so this file does not import it.

export const DDtrashDays = 30;
const MAX_ENTRIES = 50, MAX_BYTES = 150000, DAY = 864e5;

const words = (text) => String(text || "").split("\n").map((l) => l.replace(/^\s*(?:- \[[ xX]\]|[-*•])\s*/, "").trim()).find(Boolean) || "";

// Keep entries younger than 30 days, newest first, and small enough to sync.
export function DDtrashClean(list, cleanItems, now = Date.now()) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== "object" || typeof e.id !== "string" || !/^[\w-]{1,40}$/.test(e.id)) continue;
    const at = Date.parse(e.at);
    if (!Number.isFinite(at) || now - at > DDtrashDays * DAY || out.some((o) => o.id === e.id)) continue;
    const items = cleanItems(Array.isArray(e.items) ? e.items : []);
    if (!items.length) continue;
    const ids = new Set(items.map((i) => i.id)), home = {}, abs = {};
    for (const it of items) {
      if (ids.has(it.parent)) continue;
      if (typeof e.home?.[it.id] === "string") home[it.id] = e.home[it.id].slice(0, 80);
      const p = e.abs?.[it.id];
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) abs[it.id] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
    const refs = new Set(items.map((i) => "life:" + i.id)),
      links = (Array.isArray(e.links) ? e.links : []).filter((l) => l && typeof l.id === "string" && typeof l.from === "string" && typeof l.to === "string" && (refs.has(l.from) || refs.has(l.to))).slice(0, 200);
    out.push({ id: e.id, at: new Date(at).toISOString(), items, home, abs, ...(links.length ? { links } : {}) });
  }
  out.sort((a, b) => b.at.localeCompare(a.at));
  out.length = Math.min(out.length, MAX_ENTRIES);
  while (out.length > 1 && JSON.stringify(out).length > MAX_BYTES) out.pop();
  return out;
}

// The Feed items that a change took away, as one entry. `absOf(id)` gives an
// item's place on the whole Feed, so it can come back even if its section went.
export function DDtrashAdd(before, after, absOf = () => null, now = Date.now(), makeId = () => "t" + now.toString(36) + Math.random().toString(36).slice(2, 6)) {
  const kept = new Set((after?.items || []).map((i) => i.id)),
    gone = (before?.items || []).filter((i) => !kept.has(i.id));
  if (!gone.length) return after;
  const ids = new Set(gone.map((i) => i.id)), home = {}, abs = {};
  for (const it of gone) if (!ids.has(it.parent)) { home[it.id] = it.parent || ""; const p = absOf(it.id); if (p) abs[it.id] = { x: p.x, y: p.y }; }
  const refs = new Set(gone.map((i) => "life:" + i.id)),
    links = (before.links || []).filter((l) => refs.has(l.from) || refs.has(l.to)),
    entry = { id: makeId(), at: new Date(now).toISOString(), items: structuredClone(gone), home, abs, ...(links.length ? { links: structuredClone(links) } : {}) };
  return { ...after, trash: [entry, ...(after.trash || [])] };
}

// Put an entry back: inside its old section when that section is still there,
// otherwise at the same place on the Feed. Items that came back another way stay.
export function DDtrashRestore(life, id) {
  const entry = (life?.trash || []).find((e) => e.id === id);
  if (!entry) return life;
  const present = new Set((life.items || []).map((i) => i.id)),
    sections = new Set((life.items || []).filter((i) => i.type === "section").map((i) => i.id)),
    back = entry.items.filter((i) => !present.has(i.id)).map((i) => {
      if (!(i.id in entry.home) && !(i.id in entry.abs)) return i;
      const parent = entry.home[i.id] || "";
      if (!parent || sections.has(parent)) return { ...i, parent };
      const p = entry.abs[i.id];
      return { ...i, parent: "", ...(p ? { x: p.x, y: p.y } : {}) };
    }),
    refs = new Set([...present, ...back.map((i) => i.id)].map((x) => "life:" + x)),
    known = new Set((life.links || []).map((l) => l.id)),
    links = (entry.links || []).filter((l) => !known.has(l.id) && refs.has(l.from) && refs.has(l.to));
  const { trash: _old, ...rest } = life, left = life.trash.filter((e) => e !== entry);
  return { ...rest, items: [...life.items, ...back], links: [...(life.links || []), ...links], ...(left.length ? { trash: left } : {}) };
}

// "Ideas + 4 more · 3 days ago"
export function DDtrashLabel(entry, now = Date.now(), language = "en") {
  const fa = language === "fa", num = (n) => (fa ? n.toLocaleString("fa-IR") : String(n)),
    ids = new Set(entry.items.map((i) => i.id)),
    top = entry.items.find((i) => !ids.has(i.parent)) || entry.items[0],
    name = (words(top.text) || (top.type === "section" ? (fa ? "سکشن" : "Section") : fa ? "نوت" : "Note")).slice(0, 40),
    more = entry.items.length - 1,
    days = Math.floor((now - Date.parse(entry.at)) / DAY),
    mins = Math.floor((now - Date.parse(entry.at)) / 6e4),
    ago = mins < 2 ? (fa ? "همین الان" : "just now") : mins < 60 ? (fa ? num(mins) + " دقیقه پیش" : mins + " min ago") : days < 1 ? (fa ? "امروز" : "today") : days === 1 ? (fa ? "دیروز" : "yesterday") : fa ? num(days) + " روز پیش" : days + " days ago";
  return name + (more > 0 ? (fa ? " + " + num(more) + " تای دیگر" : " + " + more + " more") : "") + " · " + ago;
}
