// Life board: one shared set of sections and sticky notes that shows on the board of
// every day. It lives in setup (setup.life), so a change made on one day's board
// is the same change on all days. Sections can hold sections and stickies, like FigJam.
//
// Data: a flat list. Each item is { id, type: "section" | "sticky", parent, x, y, w, h,
// text, color }. x and y are relative to the parent section (or to the Life area).

import { DDstickyColors } from "./board-core.js";
import { DDtagList, DDtagColors } from "./note-tags.js";
import { DDmediaList } from "./media.js";
import { DDnormalizeComments } from "./comments.js";
import { DDnormalizeStrokes } from "./pen.js";
import { DDbudgetOf, DDgoalClean } from "./budgets.js";
import { DDtrashClean } from "./trash.js";
import { DDdueClean } from "./deadlines.js";
import { DDsectionKeyClean } from "./section-keys.js";
export const DDlifeHead = 90;
export const DDlifeColors = DDstickyColors;
const legacyFamilyColors = ["#FFE08A", "#9DD6FF", "#D3B8FF", "#FFA799", "#FFA6D9", "#E6E6E6", "#A8E6B8"];
const BLUE = "#9DD6FF", VIOLET = "#D3B8FF", RED = "#FFA799", YELLOW = "#FFE08A", GRAY = "#E6E6E6", PINK = "#FFA6D9";
const limit = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

// The starting content, copied from the planning board (FigJam "Life").
const sec = (id, text, x, y, w, h, kids = []) => ({ type: "section", id, text, x, y, w, h, kids });
const note = (id, text, color, x, y, w = 240, h = 240) => ({ type: "sticky", id, text, color, x, y, w, h });
const OFFSET = { x: 3568, y: 1184 };
const learn = (id, nid, x, y) =>
  sec(id, "یادگیری", x, y, 640, 304, [note(nid, "تمرین تکنیک های جدید انیمیشن دوره ها", VIOLET, 248, 32)]);
const research = (id, a, b, x, y) =>
  sec(id, "تحقیقاتی", x, y, 640, 432, [note(a, "watch works", RED, 32, 128), note(b, "collect things", RED, 320, 128)]);
const smart = (id, a, b, x, y) =>
  sec(id, "هوشمندی و تجربه", x, y, 640, 384, [
    note(a, "باهوش تر شدن برای انجام ندادن کارهای بیهوده و وقت کشی", BLUE, 56, 80),
    note(b, "خسته نکردن بیهوده خودت با قفل مغزی و سگ کاری", BLUE, 328, 80),
  ]);
const DEFAULT_TREE = [
  sec("lf-258-643", "state of mind", -3568, 2448, 848, 336, [
    note("lf-257-576", "free life", BLUE, 32, 48),
    note("lf-257-577", "meditate", VIOLET, 304, 48),
  ]),
  sec("lf-258-639", "routine", -2608, 2448, 864, 336, [
    note("lf-257-573", "english", BLUE, 320, 64),
    note("lf-257-574", "body", RED, 608, 64),
  ]),
  sec("lf-257-529", "LIFE/CREATIVITY", -272, -1184, 1392, 2016, [
    note("lf-254-304", "english", BLUE, 32, 208),
    note("lf-254-308", "body", RED, 96, 336),
    sec("lf-257-544", "free", 96, 624, 896, 672, [
      note("lf-257-545", "free life", BLUE, 176, 48),
      note("lf-257-546", "meditate", VIOLET, 480, 48),
      note("lf-257-554", "writing", GRAY, 192, 368),
      note("lf-257-565", "daily routin", GRAY, 480, 368),
    ]),
    sec("lf-257-531", "knowledge and interest", 160, 1344, 768, 416, [
      note("lf-257-532", "books and falsafe", VIOLET, 512, 112),
      note("lf-257-540", "movies art", GRAY, 160, 112),
    ]),
  ]),
  sec("lf-257-572", "LIFE/CREATIVITY", -272, 2432, 1392, 2016, [
    sec("lf-257-580", "knowledge and interest", 80, 368, 768, 416, [
      note("lf-257-581", "books and falsafe", VIOLET, 416, 112),
      note("lf-257-582", "movies art", GRAY, 80, 112),
    ]),
  ]),
  note("lf-257-579", "daily routin", GRAY, -2800, 2112),
  sec("lf-257-510", "Job", 1216, -1184, 1152, 2016, [
    learn("lf-257-522", "lf-257-371", 104, 1600),
    research("lf-257-515", "lf-257-360", "lf-257-483", 104, 1104),
    smart("lf-257-514", "lf-257-364", "lf-257-442", 104, 656),
    note("lf-257-438", "tests", YELLOW, 672, 0),
    note("lf-257-558", "clients and money", GRAY, 104, 176),
  ]),
  sec("lf-257-583", "Job", 2432, 2704, 2336, 1232, [
    research("lf-257-586", "lf-257-587", "lf-257-588", 128, 400),
    sec("lf-258-684", "Doing", 816, 32, 688, 1200, [
      note("lf-257-592", "tests", YELLOW, 224, 96),
      learn("lf-257-584", "lf-257-585", 24, 832),
      smart("lf-257-589", "lf-257-590", "lf-257-591", 24, 400),
    ]),
    sec("lf-258-662", "getting clients", 1568, 432, 608, 384, [note("lf-257-593", "job board", GRAY, 144, 72)]),
  ]),
  note("lf-257-578", "writing", PINK, -2800, 2496),
  note("lf-258-688", "Part Part", PINK, 2432, 2448),
  note("lf-258-692", "1- اولویت 2- علاقه 3- سختی 4- احتمال 5- انجام دادن 6- پایداری", YELLOW, 320, 1520, 416, 336),
];

function flatten(list, parent, out, root) {
  for (const it of list) {
    const { kids, ...rest } = it;
    out.push({
      ...rest,
      parent,
      x: rest.x + (root ? OFFSET.x : 0),
      y: rest.y + (root ? OFFSET.y : 0),
    });
    if (kids) flatten(kids, it.id, out, false);
  }
  return out;
}

export const DDlifeDefault = () => flatten(DEFAULT_TREE, "", [], true);

// One list of Feed items, cleaned (also used for Recently deleted).
function lifeItems(raw) {
  const seen = new Set(),
    items = [];
  for (const r of raw) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.id || seen.has(r.id)) continue;
    const section = r.type === "section";
    if (!section && r.type !== "sticky") continue;
    seen.add(r.id);
    items.push({
      id: r.id.slice(0, 80),
      type: r.type,
      parent: typeof r.parent === "string" ? r.parent : "",
      x: limit(r.x, -1e5, 1e5, 0),
      y: limit(r.y, -1e5, 1e5, 0),
      w: limit(r.w, 60, 2e4, section ? 480 : 240),
      h: limit(r.h, 40, 2e4, section ? 320 : 240),
      text: typeof r.text === "string" ? r.text.slice(0, 4000) : "",
      collapsed: section && !!r.collapsed,
      ...(!section && /^\d{4}-\d{2}-\d{2}$/.test(r.at||"") ? {at:r.at} : {}),
      ...(!section && Number.isFinite(r.baseW) ? {baseW:Math.max(160,r.baseW)} : {}),
      ...(!section && ["goal", "note"].includes(r.role) ? { role: r.role } : {}),
      // A soft budget on a section, a counter on a goal note (budgets.js).
      ...(section && DDbudgetOf(r) ? { budget: DDbudgetOf(r) } : {}),
      ...(!section && DDgoalClean(r.goal) ? { goal: DDgoalClean(r.goal) } : {}),
      // A deadline on a note or a section (deadlines.js).
      ...(DDdueClean(r.due) ? { due: DDdueClean(r.due) } : {}),
      // Tags on a Feed note: the same tags as tasks (note-tags.js).
      ...(!section && DDtagList(r.tags).length ? { tags: DDtagList(r.tags) } : {}),
      // A photo note keeps only links to files in the person's Drive (board-photos.js).
      ...(!section && DDmediaList(r.media).length ? { media: DDmediaList(r.media) } : {}),
      ...(r.style && typeof r.style === "object" ? { style: Object.fromEntries(Object.entries(r.style).filter(([k,v]) => (["textSize","opacity"].includes(k) && Number.isFinite(v)) || (k==="textAlign"&&["start","center","end"].includes(v)) || (k==="plain"&&v===true) || (k==="textColor"&&typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)))) } : {}),
      ...(typeof r.color === "string" && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r.color) ? { color: r.color, ...(section && r.ownColor === true ? { ownColor: true } : {}) } : {}),
      // A shortcut key for the Tab flowchart (section-keys.js).
      ...(section && DDsectionKeyClean(r.key) ? { key: DDsectionKeyClean(r.key) } : {}),
      // A top section placed on the board outside the Feed.
      ...(section && r.out === true ? { out: true } : {}),
      // Linked copies: the copies of one note or section share a syncId; the
      // things inside a synced section share a syncKey with their twins.
      ...(typeof r.syncId === "string" && /^[\w-]{1,64}$/.test(r.syncId) ? { syncId: r.syncId } : {}),
      ...(typeof r.syncKey === "string" && /^[\w-]{1,64}$/.test(r.syncKey) ? { syncKey: r.syncKey } : {}),
    });
  }
  const sections = new Map(items.filter((i) => i.type === "section").map((i) => [i.id, i]));
  for (const it of items) {
    let p = it.parent,
      hops = 0;
    // A parent must be a section; walking up must end at the top without a loop.
    while (p && sections.has(p) && sections.get(p) !== it && hops++ < 50) p = sections.get(p).parent;
    if (!sections.has(it.parent) || it.parent === it.id || p) it.parent = "";
    if (it.parent) delete it.out;
  }
  return items;
}

// Keep only valid items: known parents, no loops, sane numbers. Order is the stacking order.
export function DDnormalizeLife(life) {
  const items = lifeItems(Array.isArray(life?.items) ? life.items : []), sections = new Map(items.filter((i) => i.type === "section").map((i) => [i.id, i]));
  const refs = new Set(items.map((i) => "life:" + i.id));
  const links = (Array.isArray(life?.links) ? life.links : []).filter((l) => l && typeof l.id === "string" && refs.has(l.from) && refs.has(l.to) && l.from !== l.to).slice(0, 2000);
  const frame = {};
  for (const k of ["x", "y", "w", "h"]) if (Number.isFinite(life?.frame?.[k])) frame[k] = limit(life.frame[k], k === "w" || k === "h" ? 240 : -1e5, 1e5, 0);
  // Comments and drawings that belong to the Feed (5.36): a comment on a Feed
  // note follows the note; a free comment or a stroke belongs to its section.
  const ids = new Set(items.map((i) => i.id));
  const comments = DDnormalizeComments(life?.comments, { life: true })
    .filter((c) => !c.on || ids.has(c.on.slice(5)))
    .map((c) => (c.on || !c.parent || sections.has(c.parent) ? c : { ...c, parent: "" }));
  const strokes = DDnormalizeStrokes(life?.strokes, { life: true }).map((s) => (!s.parent || sections.has(s.parent) ? s : { ...s, parent: "" }));
  // Tag colours you picked, for the whole planner (note-tags.js).
  const tagColors = DDtagColors(life?.tagColors);
  // Notes and sections deleted in the last 30 days (trash.js).
  const trash = DDtrashClean(life?.trash, lifeItems);
  return { v: 2, items, links, frame, ...(comments.length ? { comments } : {}), ...(strokes.length ? { strokes } : {}), ...(Object.keys(tagColors).length ? { tagColors } : {}), ...(trash.length ? { trash } : {}) };
}

// Session history is shared by Plan and all day boards. It never enters backups.
export const DDlifeHistory = { past: [], future: [] };
export function DDLifePanel({ React:R, setup, days, onUpdateDayOnDate, onUpdateSetup, onOpen, language }) {
  const h=R.createElement, fa=language==="fa", t=(en,fa2)=>fa?fa2:en;
  const [,redraw]=R.useState(0), state=DDlifeState(setup);
  function change(fn) {
    const next=fn(structuredClone(state));
    if (JSON.stringify(next)===JSON.stringify(state)) return;
    DDlifeHistory.past.push({day:null,life:structuredClone(state),bytes:JSON.stringify(state).length});
    DDlifeHistory.past=DDlifeHistory.past.slice(-50); DDlifeHistory.future=[];
    onUpdateSetup((s)=>({...s,life:next})); redraw((n)=>n+1);
  }
  function undo(redo=false) {
    const source=redo?DDlifeHistory.future:DDlifeHistory.past, dest=redo?DDlifeHistory.past:DDlifeHistory.future;
    const entry=source.pop(); if (!entry) return;
    const currentDay=entry.day?days?.[entry.day.date]:null;
    dest.push({day:currentDay||null,life:state,bytes:JSON.stringify([currentDay,state]).length});
    if(entry.day)onUpdateDayOnDate?.(entry.day.date,()=>structuredClone(entry.day));
    onUpdateSetup((s)=>({...s,life:entry.life})); redraw((n)=>n+1);
  }
  function render(it) {
    const update=(text)=>change((s)=>({...s,items:s.items.map((i)=>i.id===it.id?{...i,text}:i)}));
    if (it.type==="sticky") return h("article",{key:it.id,className:"dd-plan-life-note",style:{background:it.color||DDlifeColors[0],color:DDlifeContrast(it.color||DDlifeColors[0])}},
      h("textarea",{key:it.text,defaultValue:it.text,dir:"auto","aria-label":t("Feed note","یادداشت فید"),onBlur:(e)=>update(e.target.value)}),
      h("button",{type:"button",onClick:()=>onOpen(it.id)},t("Show on board","نمایش روی برد")));
    return h("div",{key:it.id,className:"dd-plan-life-section"},h("div",{className:"dd-plan-life-heading"},
      h("button",{type:"button","aria-expanded":!it.collapsed,onClick:()=>change((s)=>({...s,items:s.items.map((i)=>i.id===it.id?{...i,collapsed:!i.collapsed}:i)}))},it.collapsed?"▸":"▾"),
      h("input",{key:it.text,dir:"auto",defaultValue:it.text,"aria-label":t("Feed section name","نام سکشن فید"),onBlur:(e)=>update(e.target.value)}),
      h("button",{type:"button",onClick:()=>onOpen(it.id)},t("Board","برد"))),
      !it.collapsed&&h("div",{className:"dd-plan-life-children"},state.items.filter((i)=>i.parent===it.id).map(render)));
  }
  return h("section",{className:"dd-plan-life","data-section-id":"life",onKeyDown:(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!e.target.matches("input,textarea")){e.preventDefault();undo();}}},
    h("header",null,h("h2",null,t("Feed · shared across days","فید · مشترک بین روزها")),h("button",{type:"button",onClick:()=>undo()},t("Undo Feed edit","واگرد تغییر فید")),h("button",{type:"button",onClick:()=>undo(true)},t("Redo Life edit","انجام دوبارهٔ تغییر زندگی"))),
    state.items.filter((i)=>!i.parent).map(render));
}
export const DDlifeState = (setup) => DDnormalizeLife({ ...setup?.life, items: DDlifeItems(setup) });
export function DDlifeVisible(items, it) {
  let parent = it.parent, hops = 0;
  while (parent && hops++ < 60) {
    const p = items.find((i) => i.id === parent);
    if (!p || p.collapsed) return false;
    parent = p.parent;
  }
  return true;
}
// A section's own board is all of it: what sits outside the section's frame
// there belongs to the section but stays on its board. The main board (or an
// outer section's board) shows only what sits inside the frame, judged by the
// middle of each thing, so a note hanging over the edge still shows.
export function DDlifeInFrame(items, it) {
  const p = it?.parent && items.find((i) => i.id === it.parent);
  if (!p) return true;
  const cx = it.x + (it.w || 240) / 2, cy = it.y + (it.collapsed ? 38 : it.h || 240) / 2;
  return cx >= 0 && cx <= p.w && cy >= 0 && cy <= p.h;
}
// Is this thing drawn on the board of `room` ("" is the main board)?
export function DDlifeShown(items, it, room = "") {
  let c = it, hops = 0;
  while (c?.parent && c.id !== room && hops++ < 60) {
    if (c.parent !== room && !DDlifeInFrame(items, c)) return false;
    c = items.find((i) => i.id === c.parent);
  }
  return true;
}
// The board a thing lives on: the section whose own board shows it, or "" for
// the main board.
export function DDlifeHome(items, id) {
  let c = items.find((i) => i.id === id), hops = 0;
  while (c?.parent && hops++ < 60) {
    if (!DDlifeInFrame(items, c)) return c.parent;
    c = items.find((i) => i.id === c.parent);
  }
  return "";
}
// When a section gets smaller, what ends up outside it drops to the board it
// sits on, so nothing disappears from view.
export function DDlifeRelease(items, sectionId) {
  const sec = items.find((i) => i.id === sectionId);
  if (!sec || sec.type !== "section") return items;
  const out = new Set(items.filter((i) => i.parent === sectionId && !DDlifeInFrame(items, i)).map((i) => i.id));
  if (!out.size) return items;
  // Out of a section that sits outside the Feed, it stays outside the Feed too.
  return items.map((i) => (out.has(i.id) ? { ...i, parent: sec.parent || "", x: Math.round(sec.x + i.x), y: Math.round(sec.y + i.y), ...(!sec.parent && sec.out ? { out: true } : {}) } : i));
}
export function DDlifeCompact(items) {
  let next = items.map((i) => ({ ...i }));
  function arrange(parent, width) {
    const kids = next.filter((i) => i.parent === parent && !(parent === "" && i.out)).sort((a,b) => a.y - b.y || a.x - b.x);
    for (const k of kids) if (k.type === "section" && !k.collapsed) arrange(k.id, Math.min(1000, Math.max(520, k.w)));
    let x = 24, y = 64, row = 0, right = 240;
    for (const k of kids) {
      const hh = k.collapsed ? 44 : k.h;
      if (x > 24 && x + k.w > width) { x = 24; y += row + 64; row = 0; }
      k.x = x; k.y = y; x += k.w + 32; row = Math.max(row, hh); right = Math.max(right, x);
    }
    if (parent) { const p = next.find((i) => i.id === parent); p.w = right; p.h = Math.max(180, y + row + 24); }
  }
  arrange("", 1800);
  return next;
}

// What every day shows: the saved list, or the starting content until someone edits it.
export const DDlifeItems = (setup) =>
  setup?.life && Array.isArray(setup.life.items) ? setup.life.items : DDlifeDefault();

const find = (items, id) => items.find((i) => i.id === id);
export function DDlifeColor(items, it) {
  if (it.color) return it.color;
  // Older boards have no section colors. Give each family a stable, soft tint.
  let root = it, hops = 0;
  while (root.parent && hops++ < 60) root = find(items, root.parent) || { ...root, parent: "" };
  const hash = [...root.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return legacyFamilyColors[hash % legacyFamilyColors.length];
}
export function DDlifeContrast(hex) {
  let value = hex.slice(1);
  if (value.length <= 4) value = [...value].map((c) => c + c).join("");
  const rgb = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#121211" : "#FFFFFF";
}
export function DDlifeAbs(items, id) {
  let x = 0,
    y = 0,
    cur = find(items, id),
    hops = 0;
  while (cur && hops++ < 60) {
    x += cur.x;
    y += cur.y;
    cur = cur.parent ? find(items, cur.parent) : null;
  }
  return { x, y };
}
export function DDlifeDescendants(items, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const it of items) if (!out.has(it.id) && out.has(it.parent)) (out.add(it.id), (grew = true));
  }
  return out;
}
export function DDlifeBounds(items) {
  let w = 0,
    h = 0;
  // A section placed on the board outside the Feed (`out`) never stretches it.
  for (const it of items) if (!it.parent && !it.out) ((w = Math.max(w, it.x + it.w)), (h = Math.max(h, it.y + (it.collapsed ? 38 : it.h))));
  return { w: Math.max(720, w + 48), h: Math.max(320, h + 48) };
}

// Grow a section (and the sections around it) so everything inside it fits.
export function DDlifeFit(items, parentId) {
  let next = items,
    id = parentId,
    hops = 0;
  while (id && hops++ < 60) {
    const sec = find(next, id);
    if (!sec) break;
    const kids = next.filter((i) => i.parent === id),
      w = Math.max(sec.w, ...kids.map((k) => k.x + k.w + 24)),
      h = Math.max(sec.h, ...kids.map((k) => k.y + k.h + 24));
    if (w !== sec.w || h !== sec.h) next = next.map((i) => (i.id === id ? { ...i, w, h } : i));
    id = sec.parent;
  }
  return next;
}

function freeSpot(items, parentId, w, h) {
  const sibs = items.filter((i) => i.parent === parentId),
    parent = parentId ? find(items, parentId) : null,
    maxW = parent ? parent.w : 1600,
    clash = (x, y) => sibs.some((s) => x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y);
  for (let y = parentId ? 48 : 0; y < 4000; y += 40)
    for (let x = parentId ? 24 : 0; x + w <= maxW || x === (parentId ? 24 : 0); x += 40)
      if (!clash(x, y)) return { x, y };
  return { x: 24, y: 48 };
}

export function DDlifeAdd(items, spec) {
  const section = spec.type === "section",
    w = spec.w || (section ? 480 : 240),
    h = spec.h || (section ? 320 : 240),
    placed = Number.isFinite(spec.x) && Number.isFinite(spec.y),
    pos = placed ? { x: spec.x, y: spec.y } : freeSpot(items, spec.parent || "", w, h),
    item = {
      id: spec.id,
      type: spec.type,
      parent: spec.parent || "",
      x: pos.x,
      y: pos.y,
      w,
      h,
      text: spec.text || "",
      ...(!section ? {at:spec.at || new Date().toLocaleDateString("en-CA"),...(spec.baseW?{baseW:spec.baseW}:{})} : {}),
      ...(!section && ["goal", "note"].includes(spec.role) ? { role: spec.role } : {}),
      ...(!section && DDgoalClean(spec.goal) ? { goal: DDgoalClean(spec.goal) } : {}),
      ...(DDdueClean(spec.due) ? { due: DDdueClean(spec.due) } : {}),
      ...(!section && DDmediaList(spec.media).length ? { media: DDmediaList(spec.media) } : {}),
      ...(spec.style ? { style: { ...spec.style } } : {}),
      color: spec.color || (section ? "#A8DAFF" : "#FFE299"),
      ...(section && spec.ownColor && spec.color ? { ownColor: true } : {}),
      ...(spec.syncId ? { syncId: spec.syncId } : {}),
      ...(spec.syncKey ? { syncKey: spec.syncKey } : {}),
    };
  // Like FigJam, something placed by hand may hang over its section's edge;
  // only an automatically chosen spot grows the section around it.
  return placed ? [...items, item] : DDlifeFit([...items, item], item.parent);
}

// "Send to section…": things go into a section at a free spot inside it, with
// their size and look, and the section grows to fit. A section never goes into
// itself or into a section inside it.
export function DDlifeSendTo(items, ids, targetId) {
  const target = find(items, targetId);
  if (!target || target.type !== "section") return items;
  let next = items;
  for (const id of ids) {
    const it = find(next, id);
    if (!it || it.parent === targetId || DDlifeDescendants(next, id).has(targetId)) continue;
    const rest = next.filter((i) => i.id !== id), { out, ...moved } = it,
      pos = freeSpot(rest, targetId, it.w, it.collapsed ? 38 : it.h);
    next = DDlifeFit([...rest, { ...moved, parent: targetId, x: pos.x, y: pos.y }], targetId);
  }
  return next;
}
// Out of its section: one level up, at a free spot there, so it never looks
// like it is still inside.
export function DDlifeTakeOut(items, ids) {
  let next = items;
  for (const id of ids) {
    const it = find(next, id), sec = it?.parent && find(next, it.parent);
    if (!sec) continue;
    const up = sec.parent || "", rest = next.filter((i) => i.id !== id),
      pos = freeSpot(rest, up, it.w, it.collapsed ? 38 : it.h);
    next = [...rest, { ...it, parent: up, x: pos.x, y: pos.y, ...(!up && sec.out ? { out: true } : {}) }];
    if (up) next = DDlifeFit(next, up);
  }
  return next;
}
// FigJam: a section drawn or resized around things takes them in. Only siblings
// that sit wholly inside it join; nothing already inside is pushed out.
export function DDlifeAdopt(items, sectionId) {
  const sec = find(items, sectionId);
  if (!sec || sec.type !== "section" || sec.collapsed) return items;
  const inside = (i) => i.id !== sec.id && i.parent === sec.parent &&
    i.x >= sec.x && i.y >= sec.y && i.x + i.w <= sec.x + sec.w && i.y + (i.collapsed ? 38 : i.h) <= sec.y + sec.h;
  if (!items.some(inside)) return items;
  return items.map((i) => (inside(i) ? { ...i, parent: sec.id, x: i.x - sec.x, y: i.y - sec.y } : i));
}

// Deleting a section deletes what is inside it (FigJam). Anything in `keep`
// (locked items) stays where it is and moves up to the nearest remaining parent.
export function DDlifeRemoveTree(items, id, keep = new Set()) {
  if (!find(items, id)) return items;
  const gone = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const it of items) if (!gone.has(it.id) && gone.has(it.parent) && !keep.has(it.id)) (gone.add(it.id), (grew = true));
  }
  return items.filter((i) => !gone.has(i.id)).map((i) => {
    if (!gone.has(i.parent)) return i;
    let x = i.x, y = i.y, p = find(items, i.parent), hops = 0;
    while (p && gone.has(p.id) && hops++ < 60) ((x += p.x), (y += p.y), (p = p.parent ? find(items, p.parent) : null));
    return { ...i, parent: p && !gone.has(p.id) ? p.id : "", x, y };
  });
}

export function DDlifeUpdate(items, id, patch) {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

// A section goes away; what was inside it stays and moves up one level.
export function DDlifeRemove(items, id) {
  const it = find(items, id);
  if (!it) return items;
  return items
    .filter((i) => i.id !== id)
    .map((i) => (i.parent === id ? { ...i, parent: it.parent, x: i.x + it.x, y: i.y + it.y } : i));
}

// Move by a screen offset (already divided by zoom). Dropping on a section joins it;
// dropping on empty space leaves the section it was in.
// `moving` lists other items dragged together; they never become the target.
// Where a section takes a drop. A folded section is only its name bar, and a
// section inside a folded one is hidden, so it takes nothing: empty space stays
// empty. The open section board (`room`) always counts as open.
function dropArea(items, s, room = "") {
  const folded = (it) => it.collapsed && it.id !== room;
  let p = s.parent, hops = 0;
  while (p && p !== room && hops++ < 60) {
    const it = find(items, p);
    if (!it) break;
    if (folded(it)) return null;
    p = it.parent;
  }
  const a = DDlifeAbs(items, s.id);
  return { x: a.x, y: a.y, w: s.w, h: folded(s) ? 38 : s.h, folded: folded(s) };
}
export function DDlifeDropTarget(items, id, dx, dy, moving = [], room = "") {
  const it = find(items, id);
  if (!it) return null;
  const abs = DDlifeAbs(items, id),
    ax = abs.x + dx,
    ay = abs.y + dy,
    cx = ax + it.w / 2,
    cy = ay + it.h / 2,
    skip = new Set([...DDlifeDescendants(items, id), ...moving]);
  let target = null,
    area = Infinity;
  for (const s of items) {
    if (s.type !== "section" || skip.has(s.id)) continue;
    const a = dropArea(items, s, room);
    if (!a) continue;
    // Sections join only when fully inside. Merely overlapping a neighbour must
    // not silently reparent it or grow that neighbour into a huge white box.
    // A folded section takes a section only when its name bar is under the middle.
    const inside = it.type === "section" && !a.folded
      ? ax >= a.x && ay >= a.y && ax + it.w <= a.x + a.w && ay + it.h <= a.y + a.h
      : cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h;
    if (inside && a.w * a.h < area) ((target = s), (area = a.w * a.h));
  }
  return target;
}
export function DDlifeMoveBy(items, id, dx, dy, moving = [], room = "") {
  const it = find(items, id);
  if (!it || (!dx && !dy)) return items;
  const abs = DDlifeAbs(items, id), ax = abs.x + dx, ay = abs.y + dy,
    target = DDlifeDropTarget(items, id, dx, dy, moving, room);
  const base = target ? DDlifeAbs(items, target.id) : { x: 0, y: 0 },
    moved = { ...it, parent: target ? target.id : "", x: Math.round(ax - base.x), y: Math.round(ay - base.y) };
  if (target) delete moved.out;
  // Dropped last so it sits on top of its new neighbours.
  return [...items.filter((i) => i.id !== id), moved];
}

// The sections from the top down to `id`, `id` included: the path shown above
// a section's own board.
export function DDlifePath(items, id) {
  const out = [];
  let cur = find(items, id),
    hops = 0;
  while (cur && hops++ < 60) {
    out.unshift(cur);
    cur = cur.parent ? find(items, cur.parent) : null;
  }
  return out;
}

// One color rule for every place a section shows: the board frame and its name,
// the Sections list, task chips, the Engine, the record and Plan. A top section
// has its color. A section inside it gets its own shade of that color: the hue
// turned a little and a touch lighter, so it belongs to the family without
// looking the same as its parent. Anyone can give a subsection a color of its
// own (saved as `ownColor`); its children then take shades of that color.
const hex6 = (hex) => {
  let v = String(hex || "").slice(1);
  if (v.length <= 4) v = [...v.slice(0, 3)].map((c) => c + c).join("");
  return /^[0-9a-f]{6}/i.test(v) ? v.slice(0, 6) : "e6e6e6";
};
export function DDmixColor(a, b, amount) {
  const x = hex6(a), y = hex6(b), k = Math.max(0, Math.min(1, amount));
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(x.slice(i, i + 2), 16) * (1 - k) + parseInt(y.slice(i, i + 2), 16) * k)
    .toString(16).padStart(2, "0")).join("").toUpperCase();
}
// Eight soft colors, then ink black and paper white.
export const DDsectionPalette = ["#FFE08A", "#FFC48A", "#FFA799", "#FFA6D9", "#D3B8FF", "#9DD6FF", "#A8E6D5", "#C8E6A0", "#121211", "#FFFFFF"];
function toHSL(hex) {
  const v = hex6(hex), [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255),
    max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1)),
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
function fromHSL({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2,
    [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
// A subsection's shade of its parent's color. The turn comes from the section's
// id, so moving or renaming it never changes its color. Greys only get lighter
// or darker, because they have no hue to turn.
const SHADE_TURNS = [12, -12, 20, -20];
export function DDsectionShade(color, id = "") {
  const { h, s, l } = toHSL(color);
  if (s < 0.12) return fromHSL({ h, s, l: l > 0.5 ? l - 0.07 : l + 0.16 });
  let hash = [...String(id)].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261);
  hash = Math.imul(hash ^ (hash >>> 16), 73244475);
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return fromHSL({ h: (h + SHADE_TURNS[hash % SHADE_TURNS.length] + 360) % 360, s, l: l < 0.3 ? l + 0.12 : l + (1 - l) * 0.25 });
}
export function DDsectionTint(items, id) {
  const path = DDlifePath(items, id);
  if (!path.length || path.at(-1).type !== "section") return null;
  const sections = path.filter((i) => i.type === "section"), root = sections[0], depth = sections.length - 1;
  let fill = DDlifeColor(items, root), own = !!root.color;
  for (const s of sections.slice(1)) {
    own = !!(s.ownColor && s.color);
    fill = own ? s.color : DDsectionShade(fill, s.id);
  }
  const ink = DDlifeContrast(fill);
  return { fill, ink, line: DDmixColor(fill, ink === "#FFFFFF" ? "#FFFFFF" : "#121211", 0.4), root: root.id, depth, own };
}
// Give a section a color, or (with no color) give a subsection back its family
// shade. An old color saved on a subsection before it had its own stays unused.
export function DDsetSectionColor(items, id, color) {
  return items.map((i) => {
    if (i.id !== id || i.type !== "section") return i;
    const { ownColor, ...rest } = i;
    if (color) return { ...rest, color, ...(i.parent ? { ownColor: true } : {}) };
    if (!i.parent) return i;
    const { color: old, ...plain } = rest;
    return plain;
  });
}

// A section's name with everything above it: "Growth › Learning". When it is
// too long for a chip, keep the first and last parts: "Growth › … › Learning".
export function DDshortPath(parts, max = 28) {
  const full = parts.join(" › ");
  return { parts, full, short: full.length > max && parts.length > 2 ? parts[0] + " › … › " + parts.at(-1) : full };
}
export function DDsectionPath(items, id, max = 28, fallback = "Section") {
  return DDshortPath(DDlifePath(items, id).filter((i) => i.type === "section").map((i) => String(i.text || "").trim() || fallback), max);
}
// The chip that says where a task came from. Only the section id is stored on
// the task, so a rename, a move or a new color shows here at once.
const chipCSS = `.dd-plan-from,.dd-room-history-from,.dd-search-from{display:inline-block;flex:none;max-width:min(240px,60%);vertical-align:middle;padding:0 7px;border:1px solid;border-radius:999px;font-size:11px;font-weight:500;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-plan-from{margin-inline-start:6px}.dd-room-history-from{margin-inline-start:auto}.dd-search-from{margin-top:3px;max-width:100%}`;
// With `onGo` it is a button that goes into that section (5.53).
export function DDSectionChip({ React: R, items, id, language, className = "dd-task-from", prefix = "↖ ", max = 28, onGo }) {
  const tint = id ? DDsectionTint(items, id) : null;
  if (!tint) return null;
  if (typeof document !== "undefined" && !document.getElementById("dd-chip-css"))
    document.head.append(Object.assign(document.createElement("style"), { id: "dd-chip-css", textContent: chipCSS }));
  const fa = language === "fa", path = DDsectionPath(items, id, max, fa ? "سکشن" : "Section"),
    label = (onGo ? (fa ? "رفتن به " : "Go to ") : fa ? "آمده از " : "Came from ") + path.full;
  return R.createElement(onGo ? "button" : "span", {
    ...(onGo ? { type: "button", "data-go-section": id, onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); onGo(id); } } : {}),
    className, dir: "auto", title: label, "aria-label": label, "data-from": id, "data-root": tint.root,
    style: { background: tint.fill, color: tint.ink, borderColor: tint.line },
  }, prefix + path.short);
}

// Inside a section's own board everything made or moved stays in that section.
// Anything new, or anything that was inside and ended up outside, joins the
// section again at the same place on the canvas (it may hang over the edge).
export function DDlifeKeepIn(items, roomId, before = []) {
  if (!find(items, roomId)) return items;
  const inRoom = DDlifeDescendants(items, roomId),
    was = DDlifeDescendants(before, roomId),
    known = new Set(before.map((i) => i.id)),
    above = new Set(DDlifePath(items, roomId).map((i) => i.id)),
    stray = new Set(items.filter((i) => !inRoom.has(i.id) && !above.has(i.id) && (was.has(i.id) || !known.has(i.id))).map((i) => i.id));
  if (!stray.size) return items;
  const base = DDlifeAbs(items, roomId);
  return items.map((i) => {
    // Only the top of a stray branch moves; what is inside it comes along.
    if (!stray.has(i.id) || stray.has(i.parent)) return i;
    const a = DDlifeAbs(items, i.id), { out, ...rest } = i;
    return { ...rest, parent: roomId, x: Math.round(a.x - base.x), y: Math.round(a.y - base.y) };
  });
}

// Where a new top-level section goes when the click was at (x, y) in Life coordinates:
// inside the section under the click if there is one.
export function DDlifeParentAt(items, x, y, skip = new Set(), room = "") {
  let target = null,
    area = Infinity;
  for (const s of items) {
    if (s.type !== "section" || skip.has(s.id)) continue;
    const a = dropArea(items, s, room);
    if (a && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h && a.w * a.h < area) ((target = s), (area = a.w * a.h));
  }
  return target;
}

export const DDlifeCSS = `
.dd-life{position:absolute;left:0;pointer-events:none;color:var(--ink,#121211)}
.dd-life *{box-sizing:border-box}
.dd-life-sec,.dd-life-note{position:absolute;pointer-events:auto;border-radius:10px}
.dd-life-sec{background:color-mix(in srgb,var(--section-color) 24%,var(--panel,#fff));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--section-color) 70%,#121211);isolation:isolate}
.dd-life-sec.is-nested{background:color-mix(in srgb,var(--section-color) 38%,var(--panel,#fff))}
.dd-life-sec-head{position:absolute;left:0;top:-38px;max-width:100%;height:32px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;cursor:grab;touch-action:none;border-radius:7px;background:var(--section-color);color:var(--section-text);box-shadow:0 1px 3px #0002;z-index:2}
.dd-life-sec-head strong{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-life-sec-head input{flex:1;min-width:80px;font:inherit;font-size:14px;font-weight:700;border:1px solid currentColor;border-radius:6px;padding:2px 6px;background:transparent;color:inherit}
.dd-life-note{padding:30px 14px 14px;font-size:17px;line-height:1.45;color:#121211;background:var(--note,#FFE08A);box-shadow:0 2px 6px #0002,inset 0 0 0 1px #12121122;cursor:grab;touch-action:none;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
.dd-life-note textarea{position:absolute;inset:28px 6px 6px;width:calc(100% - 12px);height:calc(100% - 34px);font:inherit;font-size:17px;line-height:1.45;border:0;outline:2px solid #12121155;border-radius:6px;padding:6px 8px;background:#fff9;color:#121211;resize:none}
.dd-life-tools{position:absolute;top:3px;display:flex;gap:2px;inset-inline-end:4px;opacity:.35;transition:opacity .15s}
.dd-life-sec-head .dd-life-tools{position:static;opacity:.8;flex:none}
.dd-life-sec:hover>.dd-life-sec-head .dd-life-tools,.dd-life-note:hover>.dd-life-tools,.dd-life-tools:focus-within{opacity:1}
@media (hover:none){.dd-life-tools,.dd-life-sec-head .dd-life-tools{opacity:.9}}
.dd-life-tools button{min-width:24px;height:24px;padding:0 5px;border:0;border-radius:6px;background:#ffffffb8;color:#121211;font-size:13px;line-height:1;cursor:pointer}
.dd-life-sec-head .dd-life-tools button{background:color-mix(in srgb,var(--ink,#121211) 9%,transparent);color:inherit}
.dd-life-tools button:hover,.dd-life-tools button:focus-visible{background:var(--now,#7A5FF5);color:#fff}
.dd-life-tools button[data-armed]{background:#D9434A;color:#fff}
.dd-life-grip{position:absolute;inset-inline-end:0;bottom:0;width:22px;height:22px;border:0;padding:0;background:none;cursor:nwse-resize;touch-action:none;opacity:.4}
.dd-life-grip::after{content:"";position:absolute;right:5px;bottom:5px;width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor}
.dd-life-sec:hover>.dd-life-grip{opacity:1}
.dd-life-dragging{z-index:50;box-shadow:0 10px 26px #0003!important;will-change:transform;cursor:grabbing}
.dd-life-drop{outline:3px solid var(--now,#7A5FF5);outline-offset:4px}
.dd-life-palette{position:absolute;top:100%;inset-inline-end:0;display:flex;gap:5px;padding:8px;margin-top:6px;background:var(--panel,#fff);border:1px solid var(--rule,#aaa);border-radius:10px;box-shadow:0 5px 20px #0003;z-index:60}
.dd-life-palette button{width:28px;height:28px;border:1px solid #12121166;border-radius:50%;cursor:pointer}
.dd-life-palette button[aria-pressed=true]{outline:2px solid var(--now,#7A5FF5);outline-offset:2px}
.dd-life:focus,.dd-life-sec:focus,.dd-life-note:focus{outline:none}
.dd-life-sec:focus-visible,.dd-life-note:focus-visible{outline:2px solid var(--now,#7A5FF5);outline-offset:4px}
/* Frame fills used to be overridden by !important, so saved colors never showed. */
.b4-frame{background:color-mix(in srgb,var(--node-color) 14%,var(--wash))!important;border-color:color-mix(in srgb,var(--node-color) 60%,var(--rule-2))}
.b4-frame>.b4-node-body,.b4-frame>.b4-node-actions{background:var(--node-color);color:var(--node-text);border-bottom:0}
.b4-frame>.b4-node-body{border-radius:8px 0 0 0}
.b4-frame>.b4-node-actions{border-radius:0 8px 0 0}
.b4-frame>.b4-node-body .b4-node-title,.b4-frame>.b4-node-body .b4-node-subtitle{color:inherit}
.b4-frame[data-section]{background:color-mix(in srgb,var(--node-color) 14%,var(--wash))!important}
.b4-frame[data-section=life]{background:transparent!important;border-style:dashed;box-shadow:none}
.dd-life-frame{border:1px dashed var(--rule-2,#aaa);border-radius:14px;pointer-events:auto;z-index:0;touch-action:none;background:transparent}
.dd-life-area-title{position:absolute;left:18px;bottom:calc(100% - 16px);transform:scale(clamp(1,var(--b4-inverse,1),4));transform-origin:0 100%;display:flex;align-items:baseline;gap:8px;padding:6px 14px;border-radius:999px;background:var(--ink,#171717);color:var(--paper,#fff);font:600 15px/1.2 var(--sans,system-ui);white-space:nowrap;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 4px 14px -6px #0006;z-index:2}\n.dd-life-area-title:active{cursor:grabbing}\n.dd-life-area-title small{font-weight:500;font-size:12px;opacity:.7}\n/* The Engine and the Feed grow from a corner grip that shows on hover. */\n.dd-area-resize{--k:clamp(1,var(--b4-inverse,1),4);position:absolute;right:calc(-6px * var(--k));bottom:calc(-6px * var(--k));width:calc(26px * var(--k));height:calc(26px * var(--k));padding:0;margin:0;border:0;border-radius:0;background:transparent;cursor:nwse-resize;z-index:6;opacity:.35;transition:opacity .12s;color:var(--ink-2,#555);min-width:0;min-height:0;box-shadow:none}\n.dd-engine-area>.dd-area-resize{color:var(--panel-engine,#F05A28)}\n:is(.dd-engine-area,.dd-life-frame):hover>.dd-area-resize,.dd-area-resize:focus-visible,.dd-area-resize:active{opacity:1}\n.dd-area-resize:after{content:"";position:absolute;left:22%;top:22%;width:42%;height:42%;border-right:calc(2.5px * var(--k)) solid currentColor;border-bottom:calc(2.5px * var(--k)) solid currentColor;border-bottom-right-radius:calc(6px * var(--k))}
.b4-life-section{background:color-mix(in srgb,var(--node-color) 24%,var(--panel))!important;border:2px solid color-mix(in srgb,var(--node-color) 65%,#292526);box-shadow:none}
.b4-life-section>.b4-node-body{position:absolute;top:-40px;left:0;height:34px;width:auto;max-width:calc(100% - 180px);border-radius:7px;background:var(--node-color);color:var(--node-text);padding:0 12px}
.b4-life-section>.b4-node-actions{position:absolute;top:-40px;right:0;height:34px;border-radius:7px;background:var(--node-color);color:var(--node-text)}
.b4-life-section[data-collapsed=true]>.b4-node-body,.b4-life-section[data-collapsed=true]>.b4-node-actions{top:0}
.b4-node[aria-selected=true]{outline:3px solid #3478F6!important;outline-offset:4px;box-shadow:0 0 0 7px #3478f625!important}
.dd-native-colors{position:absolute;top:35px;left:0;display:flex;gap:6px;padding:8px;background:var(--panel);border:1px solid var(--rule-2);border-radius:10px;box-shadow:0 4px 16px #0003;z-index:100}
.dd-native-colors button{width:28px;height:28px;border:1px solid #2225;border-radius:50%;padding:0;cursor:pointer}
.b4-life-section .b4-node-title .dd-room-enter{flex:none;display:inline-flex;align-items:center;justify-content:center;margin-inline-start:.45em;padding:0 .4em;min-width:1.6em;height:1.4em;border-radius:.3em;border:0;background:color-mix(in srgb,var(--node-text,#121211) 12%,transparent);color:inherit;font:inherit;font-size:.85em;line-height:1;cursor:pointer;vertical-align:middle}
.b4-life-section .b4-node-title .dd-room-enter:hover{background:color-mix(in srgb,var(--node-text,#121211) 22%,transparent)}
.dd-room-break{flex-basis:100%;height:0;order:8}
.dd-room-bar{flex:0 0 auto;order:9;pointer-events:auto;display:flex;align-items:center;flex-wrap:wrap;gap:2px;width:max-content;max-width:100%;padding:4px;border-radius:12px;background:var(--paper,#fff);color:var(--ink,#121211);border:1px solid color-mix(in srgb,var(--ink,#121211) 10%,transparent);box-shadow:0 4px 14px #0000001a;font:500 13px/1.2 var(--sans,system-ui);box-sizing:border-box}
.dd-room-bar button{min-height:32px;padding:4px 10px;border-radius:8px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-room-bar button:hover{background:var(--wash,#0000000d)}
.dd-room-bar .dd-room-back{background:var(--panel-engine,#F05A28);color:#fff;font-weight:600;min-width:32px}
.dd-room-bar .dd-room-back:hover{background:color-mix(in srgb,var(--panel-engine,#F05A28) 85%,#000)}
.dd-room-bar [aria-current=page]{font-weight:650;cursor:default}
.dd-room-bar [aria-current=page]:hover{background:transparent}
.dd-room-sep{opacity:.45;padding:0 1px}
.dd-room-note{opacity:.55;font-size:11.5px;font-weight:450;padding:0 10px 0 8px;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(pointer:coarse){.dd-room-bar button{min-height:40px}}
@media(max-width:700px){.dd-room-bar{margin-top:56px}.dd-room-bar button{max-width:150px}.dd-room-note{display:none}}
.dd-life-dimensions{display:flex;gap:8px;padding:8px 0}
.dd-life-dimensions label{flex:1;min-width:0;font-size:12px;color:var(--ink)}
.dd-life-dimensions input{display:block;width:100%;min-height:36px;padding:5px;border:1px solid var(--rule-2);border-radius:6px;background:var(--paper);color:var(--ink);font:inherit}
.b4 .b2-top-actions{max-width:calc(100vw - 32px);overflow-x:auto;scrollbar-width:none}
.dd-plan-life{margin:18px 0;padding:16px;border:1px solid var(--rule-2);border-radius:12px}
.dd-plan-life header,.dd-plan-life-heading{display:flex;gap:8px;align-items:center}
.dd-plan-life header h2{flex:1;font-size:16px}
.dd-plan-life-section{border:1px solid var(--rule);border-radius:8px;margin:12px 0;padding:8px}
.dd-plan-life-heading input{flex:1;min-width:0;border:0;background:transparent;color:inherit;font-weight:600}
.dd-plan-life-children{padding-inline-start:12px;display:flex;flex-wrap:wrap;gap:12px}
.dd-plan-life-children>.dd-plan-life-section{flex:1 1 320px}
.dd-plan-life-note{width:220px;padding:8px;border-radius:3px 3px 10px 3px;box-shadow:0 10px 24px -14px #0008;margin:8px 0}
.dd-plan-life-note textarea{display:block;min-height:120px;width:100%;border:0;resize:vertical;background:transparent;color:inherit;font:inherit}
.dd-plan-life button{min-height:36px;padding:4px 8px}
@media(pointer:coarse){.b4-sticky-head{height:44px!important;gap:2px;padding:0 4px!important}.b4-sticky-head button,.b4-life-section>.b4-node-actions button{min-width:44px!important;min-height:44px!important}.b4-life-section>.b4-node-body,.b4-life-section>.b4-node-actions{height:44px;top:-50px}.dd-native-colors button{width:36px;height:36px}.dd-plan-life button{min-height:44px}}
.b2-viewport[data-tool=select]:not(.b4-panning),.b2-viewport[data-tool=select]:not(.b4-panning) .b4-node,.b2-viewport[data-tool=select]:not(.b4-panning) .dd-note-preview{cursor:default}
@media (prefers-reduced-motion:reduce){.dd-life-tools{transition:none}}
`;

// Native Board and Plan share these styles; Life has no separate gesture engine.
export function DDinstallLifeStyles() {
  if (typeof document !== "undefined" && !document.getElementById("dd-life-css"))
    document.head.append(Object.assign(document.createElement("style"), { id: "dd-life-css", textContent: DDlifeCSS }));
}

