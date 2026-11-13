// Shortcut keys for sections (5.52). Tab opens the Sections flowchart; a
// section's key then goes straight into its board (Tab, W for Work), and
// Shift with the key also brings its Engine over the board.
// A section keeps its key on itself (`key: "w"`), so it syncs like its name and
// colour. A section called "This App" has T until another section takes T.
// Keys are single letters. D stays the flowchart's own (it closes it, like Tab),
// and numbers go to the recent boards, so neither can be given away.
// "-" on a section means "no key, please", so This App can let go of its T.

const RESERVED = new Set(["d"]);
const NONE = "-";
const THIS_APP = "this app";
const RECENT_KEY = "debug-day:sections-recent";
const RECENT_MAX = 8;

export const DDsectionKeyFree = (key) => /^[a-z]$/.test(key) && !RESERVED.has(key);
// What a section may keep: one free letter, the "no key" mark, or nothing.
export function DDsectionKeyClean(key) {
  const k = String(key ?? "").toLowerCase();
  return DDsectionKeyFree(k) || k === NONE ? k : "";
}
// The letter a key press asks for, by its physical key so Alt or a Persian
// layout still give the letter printed on it.
export function DDsectionKeyOf(event) {
  const code = /^Key([A-Z])$/.exec(event?.code || "");
  const key = code ? code[1].toLowerCase() : String(event?.key || "").toLowerCase();
  return DDsectionKeyFree(key) ? key : "";
}

const isThisApp = (section) => String(section.text || "").trim().toLowerCase() === THIS_APP;

// Every key in use: { byKey: Map(key → id), byId: Map(id → key) }. The first
// section on the board wins when two share a key (a linked copy, an old backup).
export function DDsectionKeys(items = []) {
  const byKey = new Map(), byId = new Map();
  const sections = items.filter((i) => i?.type === "section");
  for (const s of sections) {
    const key = DDsectionKeyClean(s.key);
    if (key && key !== NONE && !byKey.has(key)) byKey.set(key, s.id), byId.set(s.id, key);
  }
  if (!byKey.has("t")) {
    const app = sections.find((s) => isThisApp(s) && !DDsectionKeyClean(s.key));
    if (app) byKey.set("t", app.id), byId.set(app.id, "t");
  }
  return { byKey, byId };
}

// Gives a section a key (taking it from any other section), or clears it with "".
export function DDsetSectionKey(items, id, key) {
  const k = DDsectionKeyClean(key);
  if (!items.some((i) => i.id === id && i.type === "section")) return items;
  return items.map((i) => {
    if (i.type !== "section") return i;
    if (i.id === id) {
      const { key: _old, ...rest } = i;
      // This App keeps its T unless told otherwise, so clearing it is remembered.
      if (!k || k === NONE) return isThisApp(i) ? { ...rest, key: NONE } : rest;
      return { ...rest, key: k };
    }
    if (k && k !== NONE && DDsectionKeyClean(i.key) === k) {
      const { key: _taken, ...rest } = i;
      return rest;
    }
    return i;
  });
}

// The boards you were on last, newest first ("" is the Main board). They are a
// habit of this device, not part of the plan, so they stay in localStorage.
function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
export function DDsectionsVisit(...ids) {
  let list = readRecent();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    list = [id, ...list.filter((x) => x !== id)].slice(0, RECENT_MAX);
  }
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
  return list;
}
// Up to four boards to go back to, never the one you are on.
export function DDsectionsRecent(items = [], here = "", recent = readRecent()) {
  const ids = new Set(items.filter((i) => i?.type === "section").map((i) => i.id));
  return recent.filter((id) => id !== (here || "") && (id === "" || ids.has(id))).slice(0, 4);
}
