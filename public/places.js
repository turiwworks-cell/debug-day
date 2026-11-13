// Back to where you were (5.33).
// The app keeps a trail of places: the tab, the section board that was open and
// where the board's camera was looking. A jump (another tab, into or out of a
// section, a search result, the Sections list) starts a new place. Panning and
// zooming only update the place you are in, so the trail stays short.
// The trail lives in the browser's own history, so the Back button, Alt+arrows,
// the mouse's side buttons and a trackpad swipe all walk the same trail.
// The day you are looking at is not part of a place: going back never changes the date.

const LIST = "debug-day:places", ROOM = "debug-day:board-room", VIEW = "debug-day:board-view:";
const VIEWS = ["engine", "plan", "board", "calendar", "stats", "insights", "capture", "this-app", "setup"];
// A jump right after arriving (a section opening, then its note coming into view)
// is one move, not two places.
const SETTLE = 600, SEAL = 1500, KEEP = 300;
// Engine and Plan are one page now (5.50), and Capture and This app are pages of
// their own; the old names still find their place in the trail.
const NAMES = { engine: "Today", plan: "Today", board: "Board", calendar: "Calendar", stats: "Stats", insights: "Insights", capture: "Capture", "this-app": "This app", setup: "Settings" };
// Section shortcuts (5.50): a section's own key opens its board. The tabs list
// keeps the keys; this only checks the shape, so storage can never add an odd key.
function keys() {
  try { const v = JSON.parse(localStorage.getItem("debug-day:tab-keys") || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

let list = [], index = 0, started = false, setView = null, board = null, sealedAt = 0, arrivedAt = 0;
const watchers = new Set();

// Which way an Alt+arrow goes: left/right walk the trail, up/down step through the tabs.
export function DDplaceKey(event) {
  if (!event?.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  return { ArrowLeft: "back", ArrowRight: "forward", ArrowUp: "previous-tab", ArrowDown: "next-tab" }[event.key] || null;
}

export function DDplaceName(place) {
  if (!place || !VIEWS.includes(place.view)) return "";
  const name = NAMES[place.view];
  return place.view === "board" && place.room && place.roomName ? name + " · " + place.roomName : name;
}

// Only what a place needs, checked, so nothing odd from storage reaches the board.
function pick(patch = {}) {
  const out = {};
  if ("room" in patch) out.room = typeof patch.room === "string" && patch.room ? patch.room : null;
  if ("roomName" in patch) out.roomName = typeof patch.roomName === "string" ? patch.roomName.slice(0, 80) : "";
  if ("cam" in patch) out.cam = patch.cam && [patch.cam.x, patch.cam.y, patch.cam.z].every(Number.isFinite) && patch.cam.z > 0 ? { x: patch.cam.x, y: patch.cam.y, z: patch.cam.z } : null;
  if ("date" in patch) out.date = typeof patch.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.date) ? patch.date : null;
  return out;
}
function same(a, b) {
  if ((a.room || null) !== (b.room || null)) return false;
  if (!a.cam || !b.cam) return !a.cam === !b.cam;
  return Math.abs(a.cam.x - b.cam.x) < 2 && Math.abs(a.cam.y - b.cam.y) < 2 && Math.abs(a.cam.z - b.cam.z) < 0.005;
}
function load() {
  try { const v = JSON.parse(sessionStorage.getItem(LIST) || "null"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function save() {
  try { sessionStorage.setItem(LIST, JSON.stringify(list)); } catch {}
}
function tell() {
  for (const fn of watchers) try { fn(); } catch {}
}
function storedRoom() {
  try { return sessionStorage.getItem(ROOM) || null; } catch { return null; }
}
function fresh(view) {
  return { view, room: view === "board" ? storedRoom() : null, roomName: "", cam: null, date: null };
}
// The board writes its own place into the one you are leaving.
function catchUp() {
  const here = list[index];
  if (here?.view === "board" && board) try { Object.assign(here, pick(board.place())); } catch {}
}
function push(place) {
  list = list.slice(0, index + 1);
  list.push(place);
  index = list.length - 1;
  if (index >= KEEP) list[index - KEEP] = null;
  try { history.pushState({ dd: 1, i: index }, ""); } catch {}
  save(); arrivedAt = Date.now(); sealedAt = 0; tell();
}
function restore(place) {
  if (!place || !VIEWS.includes(place.view)) return;
  if (place.view === "board") {
    if (board) { board.restore(place); return; }
    // The board opens fresh: leave its section and camera where it reads them.
    try { place.room ? sessionStorage.setItem(ROOM, place.room) : sessionStorage.removeItem(ROOM); } catch {}
    if (place.cam && place.date) try {
      const old = JSON.parse(localStorage.getItem(VIEW + place.date) || "null");
      localStorage.setItem(VIEW + place.date, JSON.stringify({ ...(old && typeof old === "object" ? old : {}), camera: place.cam }));
    } catch {}
  }
  setView?.(place.view);
}
function onPop(event) {
  const s = event.state;
  if (!s || s.dd !== 1 || !Number.isInteger(s.i) || s.i < 0) return;
  catchUp();
  index = s.i;
  save(); arrivedAt = Date.now(); sealedAt = 0; tell();
  restore(list[index]);
}
function stepTab(direction) {
  // The tab bar (5.50) lives in the header, not in `.views`: read it first and
  // fall back to the old in-view tabs so older saved documents still step.
  const bar = [...document.querySelectorAll('.dd-tabbar [role="tab"]')];
  const tabs = (bar.length ? bar : [...document.querySelectorAll('.views [role="tab"]')]).filter((b) => !b.disabled && b.getClientRects().length);
  if (!tabs.length) return;
  const at = tabs.findIndex((b) => b.getAttribute("aria-selected") === "true");
  const next = at < 0 ? (direction > 0 ? 0 : tabs.length - 1) : (at + direction + tabs.length) % tabs.length;
  tabs[next].click();
}
function onKey(event) {
  const move = DDplaceKey(event);
  if (!move) return;
  const target = event.target;
  // Inside text, Alt+arrows move the caret by words (macOS).
  if (target?.isContentEditable || target?.closest?.("input,textarea,select")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (move === "back") DDplaces.back();
  else if (move === "forward") DDplaces.forward();
  else stepTab(move === "next-tab" ? 1 : -1);
}

// A section's own shortcut (5.50). It opens the section's board from anywhere,
// exactly like picking it in the Tabs sheet. Typing in a field never counts, and
// a plain key with no modifier only, so browser and app shortcuts stay whole.
function sectionKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const key = String(event.key || "").toLowerCase();
  if (!/^[a-z0-9]$/.test(key)) return null;
  const table = keys(), id = Object.keys(table).find((section) => table[section] === key);
  if (!id) return null;
  return id;
}
function onSectionKey(event) {
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.("input,textarea,select,[contenteditable=true]")) return;
  if (document.querySelector('[role=dialog][aria-modal=true], .dd-engine-backdrop, .dd-tabs-sheet')) return;
  const id = sectionKey(event);
  if (!id) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!setView) return;
  // The board tab, then that section: one place, like the Sections flowchart.
  setView("board");
  setTimeout(() => DDsectionsRoom.open(id), 60);
}

// Ask the Board to open one section's own board (5.50). The tag pill on a task,
// the Tabs sheet and a section's shortcut all use this; a request made before a
// Board is on screen waits for one, exactly like the Engine's bus.
export const DDsectionsRoom = {
  pending: "",
  request(id) {
    this.pending = String(id || "");
    for (const listener of [...this.listeners]) listener(this.pending);
  },
  open(id) {
    this.request(id);
  },
  take() {
    const pending = this.pending;
    this.pending = "";
    return pending;
  },
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  listeners: new Set(),
};

export const DDplaces = {
  // The app starts the trail with the tab it opened on.
  start(view, setter) {
    setView = setter;
    if (started || typeof window === "undefined") return;
    started = true;
    list = load();
    const s = history.state;
    if (s && s.dd === 1 && Number.isInteger(s.i) && list[s.i]) {
      // A reload keeps the trail; the tab the app opened on wins.
      index = s.i;
      if (list[index].view !== view) list[index] = fresh(view);
    } else {
      index = 0;
      list = [fresh(view)];
      try { history.replaceState({ dd: 1, i: 0 }, ""); } catch {}
    }
    save(); arrivedAt = Date.now(); tell();
    if (!document.getElementById("dd-places-css")) {
      const style = document.createElement("style");
      style.id = "dd-places-css"; style.textContent = DDplacesCSS;
      document.head.appendChild(style);
    }
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", onSectionKey, true);
  },
  // Another tab is another place (unless it is the place you just went back to).
  view(view) {
    if (!started || !VIEWS.includes(view) || list[index]?.view === view) return;
    catchUp();
    push(fresh(view));
  },
  // The board is about to jump: the next change starts a new place.
  mark() {
    if (!started || Date.now() - arrivedAt < SETTLE || list[index]?.view !== "board") return;
    catchUp();
    sealedAt = Date.now();
    save();
  },
  // The board tells where it is now: the section, its name, the camera and its day.
  note(patch) {
    const here = list[index];
    if (!started || here?.view !== "board") return;
    const next = { ...here, ...pick(patch) };
    if (sealedAt && Date.now() - sealedAt > SEAL) sealedAt = 0;
    if (sealedAt && !same(here, next)) return push(next);
    list[index] = next;
    save();
    if (here.roomName !== next.roomName || here.room !== next.room) tell();
  },
  // The open board answers where it is and goes back to a place.
  connect(api) {
    board = api;
    return () => { if (board === api) { catchUp(); board = null; } };
  },
  back() {
    if (started && index > 0) history.back();
  },
  forward() {
    if (started && index < list.length - 1) history.forward();
  },
  state() {
    return { back: index > 0, forward: index < list.length - 1, previous: index > 0 ? list[index - 1] : null, next: list[index + 1] || null };
  },
  watch(fn) {
    watchers.add(fn);
    return () => watchers.delete(fn);
  },
};

// The app: one call keeps the tab in the trail.
export function DDusePlaces(React, view, setter) {
  const set = React.useRef(setter);
  set.current = setter;
  React.useEffect(() => { DDplaces.start(view, (v) => set.current(v)); }, []);
  React.useEffect(() => { DDplaces.view(view); }, [view]);
}

// One click back to where you came from. Alt+→ (or the mouse's forward button) goes forward again.
export function DDPlacesBack({ React }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => DDplaces.watch(() => setTick((n) => n + 1)), []);
  const { back, previous } = DDplaces.state();
  const where = DDplaceName(previous);
  const label = back ? "Back to " + (where || "where you were") : "Back (nothing yet)";
  return React.createElement("button", {
    type: "button", className: "dd-back", "data-places-back": "", disabled: !back,
    "aria-label": label, title: label + " · Alt+←",
    onClick: () => DDplaces.back(),
  }, React.createElement("svg", { viewBox: "0 0 16 16", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
    // A dotted tail: the way you came (the solid ← in a section's path means one level up).
    React.createElement("path", { d: "M13.5 8H5", strokeDasharray: "1.6 2.2" }),
    React.createElement("path", { d: "M7.5 4 3.5 8l4 4M3.5 8H6" })));
}

const DDplacesCSS = `.dd-back{width:max(34px,var(--tmin));height:max(34px,var(--tmin));box-shadow:inset 0 0 0 1px var(--rule-2);color:var(--ink-2);display:grid;place-items:center;flex:none}
.dd-back:hover:not(:disabled){box-shadow:inset 0 0 0 1px var(--ink);color:var(--ink)}
.dd-back:disabled{opacity:.35;cursor:default}
.b2-brandbar .dd-back{width:34px;height:34px;border-radius:9px;margin-inline-end:2px}
.dd-tabs{display:contents}
@media (width<=700px){.dd-tabs{display:flex;order:3;width:100%;gap:8px;align-items:center}.dd-tabs .views{flex:1;width:auto;min-width:0}}`;
