import{DDBoardIcon}from"./board-icons.js";
import{DDlifePath}from"./life-board.js";
import{DDboardSearchRows}from"./board-experience.js";
import{DDHabitControls,DDHabitStats,DDhabitEntry,DDhabitLevels,DDhabitLevelsFor}from"./habits.js";
import { DDtagText } from "./note-tags.js";

export const DDrailRole = (value) => value === "goal" || value === "note" ? value : undefined;

// A note belongs to its nearest section. This keeps a nested goal from appearing
// twice while walking from the main board down to the current section.
export function DDrailScope(note, items) {
  const byId = new Map(items.map((i) => [i.id, i])), seen = new Set([note.id]);
  let parent = note.parent;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const item = byId.get(parent);
    if (!item) break;
    if (item.type === "section") return item.id;
    parent = item.parent;
  }
  return null;
}

// Only actual, immediate board connections count, in either direction.
// Ignore stale endpoints and duplicate wires; never copy their task state.
export function DDrailConnections(ref, links, rows) {
  const found = new Set(), out = [];
  for (const link of links) {
    const other = link.from === ref ? link.to : link.to === ref ? link.from : null;
    if (!other || other === ref || found.has(other) || !rows.has(other)) continue;
    found.add(other);
    out.push(rows.get(other));
  }
  return out;
}

export function DDrailGroups(day, items, room, sharedLinks = [], nodes = [], habits = []) {
  const rows = new Map([
      ...DDboardSearchRows(day, items, nodes).map((r) => [r.id, r]),
      // A section hides the board's Habits frame, but its connected habits
      // still exist and must remain reachable from an ancestor goal.
      ...habits.map((habit) => ["habit:" + habit.id, { id: "habit:" + habit.id, title: habit.name, habitId: habit.id, kind: "habit" }]),
    ]),
    links = [...(day.canvas?.board4?.links || []), ...sharedLinks],
    scopes = [null, ...DDlifePath(items, room).map((i) => i.id)],
    notes = [
      ...(day.notes || []).filter((n) => n.kind !== "emoji").map((n) => ({ ...n, ref: "sticky:" + n.id, scope: null })),
      ...items.filter((i) => i.type === "sticky").map((i) => ({ ...i, ref: "life:" + i.id, scope: DDrailScope(i, items) })),
    ], result = { goal: [], note: [] };
  for (const scope of scopes) for (const note of notes) {
    const role = DDrailRole(note.role);
    if (!role || note.scope !== scope) continue;
    const row = rows.get(note.ref);
    if (row) result[role].push({ ...row, scope, scopeTitle: items.find((i) => i.id === scope)?.text || "", rows: DDrailConnections(note.ref, links, rows) });
  }
  return result;
}

export function DDsetRailRole(day, ref, role) {
  const life = ref.startsWith("life:"), id = ref.slice(life ? 5 : 7),
    list = life ? day.__life?.items : day.notes;
  if (!list) return day;
  const next = list.map((note) => {
    if (note.id !== id || (life ? note.type !== "sticky" : note.kind === "emoji")) return note;
    const { role: oldRole, ...rest } = note;
    return DDrailRole(role) ? { ...rest, role } : rest;
  });
  return life ? { ...day, __life: { ...day.__life, items: next } } : { ...day, notes: next };
}

export function DDrailPreferences(preferences, mobile = false) {
  const open = Object.fromEntries(["goal", "note", "habits"].map((key) => [key,
    typeof preferences?.["boardRail" + key[0].toUpperCase() + key.slice(1)] === "boolean"
      ? preferences["boardRail" + key[0].toUpperCase() + key.slice(1)] : !mobile && key === "habits"]));
  if (mobile) { const active = Object.keys(open).find((key) => open[key]); for (const key of Object.keys(open)) open[key] = key === active; }
  return open;
}

export function DDBoardRails({ React: R, day, items, room, sharedLinks, nodes, preferences, language, onToggle, onReveal, habitDay, days, habits = [], onHabitChange }) {
  const h = R.createElement, t = (en, fa) => language === "fa" ? fa : en,
    root = R.useRef(null), [mobile, setMobile] = R.useState(() => matchMedia("(max-width:700px)").matches),
    [stats, setStats] = R.useState(null), open = DDrailPreferences(preferences, mobile),
    groups = DDrailGroups(day, items, room, sharedLinks, nodes, habits), levels = DDhabitLevels(preferences?.habitLevels),
    names = { goal: t("Goals", "هدف‌ها"), note: t("Notes", "نوت‌ها"), habits: t("Today's habits", "عادت‌های امروز") },
    keys = { goal: "G", note: "Shift+G", habits: "Shift+H" };
  R.useLayoutEffect(() => {
    const board = root.current.closest(".b2"), header = board.querySelector(".b2-top"),
      update = () => {
        if (!root.current) return;
        const bounds = board.getBoundingClientRect(), style = root.current.style;
        style.setProperty("--rails-top", Math.ceil(Math.max(header.getBoundingClientRect().bottom, ...[...header.children].map((el) => el.getBoundingClientRect().bottom)) - bounds.top + 8) + "px");
        // The app reserves a scrollbar gutter on the left in Persian. The
        // fullscreen board can start outside the viewport; keep the rails inside.
        style.setProperty("--rails-left", Math.max(8, 8 - bounds.left) + "px");
        style.setProperty("--rails-right", Math.max(8, 8 + bounds.right - innerWidth) + "px");
      },
      observer = new ResizeObserver(update), media = matchMedia("(max-width:700px)"), change = () => setMobile(media.matches);
    observer.observe(header); for (const child of header.children) observer.observe(child); update(); media.addEventListener("change", change);
    return () => { observer.disconnect(); media.removeEventListener("change", change); };
  }, [language, room]);
  const toggle = (key) => onToggle(key, mobile),
    button = (key) => h("button", { type: "button", className: "dd-rail-toggle", "data-rail-toggle": key,
      "aria-expanded": open[key], "aria-controls": "dd-rail-" + key, title: names[key] + " · " + keys[key],
      onClick: () => toggle(key) }, h(DDBoardIcon, { React: R, name: key === "goal" ? "goal" : key === "note" ? "lines" : "habit", size: 15 }), names[key]),
    reveal = (row) => { if (mobile) onToggle(row.rail, true); onReveal(row); },
    notePanel = (key) => open[key] && h("aside", { id: "dd-rail-" + key, className: "dd-rail-panel", "aria-label": names[key], dir: language === "fa" ? "rtl" : "ltr" },
      !groups[key].length && h("p", { className: "dd-rail-empty" }, key === "goal" ? t('Choose “Make it the goal” on a note.', 'روی یک یادداشت «هدف کن» را بزن.') : t('Choose “Make it a note” on a note.', 'روی یک یادداشت «نوت کن» را بزن.')),
      groups[key].map((group) => h("section", { key: group.id, className: "dd-rail-group", "data-rail-group": group.id },
        h("small", null, group.scopeTitle || t("Main board", "برد اصلی")),
        h("button", { type: "button", className: "dd-rail-heading", dir: "auto", onClick: () => reveal({ ...group, rail: key }), "data-rail-ref": group.id }, group.title || t("Untitled note", "یادداشت بی‌عنوان")),
        group.tags?.length > 0 && h("small", { className: "dd-rail-tags", dir: "auto" }, DDtagText(group.tags)),
        group.rows.length ? h("ul", null, group.rows.map((row) => h("li", { key: row.id }, h("button", { type: "button", dir: "auto", "data-rail-ref": row.id, onClick: () => reveal({ ...row, rail: key }) }, row.title || t("Untitled", "بی‌عنوان"))))) :
          h("p", { className: "dd-rail-empty" }, t("Connect something to this note on the board.", "روی برد چیزی به این یادداشت وصل کن.")))));
  return h("div", { ref: root, className: "dd-board-rails", "data-mobile": mobile,
    onPointerDown: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation(),
    onKeyDown: (e) => {
      const editing = e.target.closest("input,textarea,select,[contenteditable=true]");
      if (!editing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && ["KeyG", "KeyH"].includes(e.code) && (e.code === "KeyG" || e.shiftKey)) {
        e.preventDefault(); e.stopPropagation(); toggle(e.code === "KeyH" ? "habits" : e.shiftKey ? "note" : "goal"); return;
      }
      if (e.key === "Escape") { const key = e.target.closest("[data-rail-slot]")?.dataset.railSlot; if (key && open[key]) { e.stopPropagation(); onToggle(key, mobile); root.current.querySelector(`[data-rail-toggle="${key}"]`)?.focus(); } } } },
    h("div", { className: "dd-rails-left" }, ["goal", "note"].map((key) => h("div", { key, "data-rail-slot": key }, button(key), notePanel(key)))),
    h("div", { className: "dd-rails-right", "data-rail-slot": "habits" }, button("habits"),
      open.habits && h("aside", { id: "dd-rail-habits", className: "dd-rail-panel", "aria-label": names.habits, dir: language === "fa" ? "rtl" : "ltr" },
        !habits.length && h("p", { className: "dd-rail-empty" }, t("Add a habit in Habits when you feel like it.", "هر وقت خواستی، در بخش عادت‌ها یک عادت اضافه کن.")),
        habits.map((habit) => h("section", { key: habit.id, className: "dd-rail-habit", "data-rail-habit": habit.id, style: { "--hc": habit.color } },
          h("button", { type: "button", className: "dd-rail-heading", dir: "auto", "aria-expanded": stats === habit.id, onClick: () => setStats(stats === habit.id ? null : habit.id) }, habit.name),
          h(DDHabitControls, { React: R, habit, entry: DDhabitEntry(habitDay, habit.id), levels: DDhabitLevelsFor(habit, levels), language, onChange: (patch) => onHabitChange(habit.id, patch) }),
          stats === habit.id && h(DDHabitStats, { React: R, habit, days: { ...days, [habitDay.date]: habitDay }, date: habitDay.date, levels: DDhabitLevelsFor(habit, levels), language }))))));
}

export function DDinstallRailStyles() {
  if (document.getElementById("dd-rail-styles")) return;
  const style = document.createElement("style"); style.id = "dd-rail-styles";
  style.textContent = `
.dd-board-rails{position:absolute;top:var(--rails-top,110px);left:var(--rails-left,8px);right:var(--rails-right,8px);bottom:110px;z-index:41;pointer-events:none;font-size:12px;color:var(--pi);direction:ltr}
.b2:not(.focus-mode):has(.b2-viewport.dd-board-locked) .dd-board-rails,.b2:has(.b2-viewport:is([data-tool=sticky],[data-tool=section],[data-tool=block],[data-tool=connector])) .dd-board-rails{visibility:hidden}
.dd-rails-left,.dd-rails-right{position:absolute;top:0;max-height:100%;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.dd-rails-left{left:0;width:224px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}.dd-rails-right{right:0;width:280px}.dd-rails-right>.dd-rail-toggle{align-self:flex-end}
.dd-rails-left:not(:has(.dd-rail-panel)){flex-direction:row}
.dd-rails-left>[data-rail-slot]{min-height:36px;flex-shrink:0}.dd-rail-toggle,.dd-rail-panel{pointer-events:auto;background:var(--panel);border:1px solid var(--line);box-shadow:0 3px 12px #00000009;border-radius:12px}
.dd-rail-toggle{min-height:36px;max-width:100%;padding:7px 10px;display:flex;align-items:center;gap:7px;font:inherit;color:inherit;cursor:pointer}.dd-rail-toggle[aria-expanded=true]{background:var(--wash)}
.dd-rail-panel{box-sizing:border-box;width:100%;margin-top:5px;padding:10px;overflow:auto;overscroll-behavior:contain;max-height: min(34vh,320px)}.dd-rails-right .dd-rail-panel{max-height:none;min-height:0}
.dd-rail-heading,.dd-rail-group li button{font:inherit;color:inherit;text-align:start;display:block;width:100%;border:0;background:transparent;cursor:pointer;overflow-wrap:anywhere;padding:7px 4px;border-radius:6px;line-height:1.5}
.dd-rail-heading{font-weight:650}.dd-rail-group small{opacity:.65}.dd-rail-group+.dd-rail-group,.dd-rail-habit+.dd-rail-habit{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}.dd-rail-group ul{padding-inline-start:16px;margin:0}.dd-rail-empty{opacity:.65;line-height:1.6;margin:4px 0;font-size:11px}
.dd-board-rails button:hover{background:var(--wash)}.dd-board-rails button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.dd-board-rails .dd-habit-controls{flex-wrap:wrap;gap:5px}.dd-board-rails .dd-habit-min input{width:44px;min-width:0}.dd-board-rails .dd-habit-stats{margin-top:8px}.dd-board-rails .dd-habit-grid{max-width:100%}
@media(max-width:700px){.dd-board-rails{bottom:142px}.dd-rails-left{width:calc(100% - 136px);display:flex;flex-direction:row;gap:4px;overflow:visible}.dd-rails-left>[data-rail-slot]{min-width:0}.dd-rails-right{width:132px}.dd-rail-toggle{min-height:44px;padding:7px;font-size:11px;white-space:nowrap}.dd-rail-panel{position:absolute;top:44px;left:0;width:min(300px,calc(100vw - 36px));max-height:calc(100% - 50px);box-sizing:border-box}.dd-rails-left,.dd-rails-right{height:100%;max-height:100%}.dd-rails-right .dd-rail-panel{left:auto;right:0;max-height:calc(100% - 50px)}.dd-board-rails .dd-habit-tick,.dd-board-rails .dd-habit-plus,.dd-board-rails .dd-rail-heading,.dd-board-rails li button{min-height:44px}}
`;
  document.head.append(style);
}
