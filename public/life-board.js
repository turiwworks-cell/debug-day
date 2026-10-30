// Life board: one shared set of sections and sticky notes that shows on the board of
// every day. It lives in setup (setup.life), so a change made on one day's board
// is the same change on all days. Sections can hold sections and stickies, like FigJam.
//
// Data: a flat list. Each item is { id, type: "section" | "sticky", parent, x, y, w, h,
// text, color }. x and y are relative to the parent section (or to the Life area).

export const DDlifeHead = 90;
export const DDlifeColors = ["#FFE08A", "#9DD6FF", "#D3B8FF", "#FFA799", "#FFA6D9", "#E6E6E6", "#A8E6B8"];
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

// Keep only valid items: known parents, no loops, sane numbers. Order is the stacking order.
export function DDnormalizeLife(life) {
  const raw = Array.isArray(life?.items) ? life.items : [];
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
      ...(r.style && typeof r.style === "object" ? { style: Object.fromEntries(Object.entries(r.style).filter(([k,v]) => (["textSize","opacity"].includes(k) && Number.isFinite(v)) || (k==="textAlign"&&["start","center","end"].includes(v)) || (k==="textColor"&&typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)))) } : {}),
      ...(typeof r.color === "string" && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r.color) ? { color: r.color } : {}),
    });
  }
  const sections = new Map(items.filter((i) => i.type === "section").map((i) => [i.id, i]));
  for (const it of items) {
    let p = it.parent,
      hops = 0;
    // A parent must be a section; walking up must end at the top without a loop.
    while (p && sections.has(p) && sections.get(p) !== it && hops++ < 50) p = sections.get(p).parent;
    if (!sections.has(it.parent) || it.parent === it.id || p) it.parent = "";
  }
  const refs = new Set(items.map((i) => "life:" + i.id));
  const links = (Array.isArray(life?.links) ? life.links : []).filter((l) => l && typeof l.id === "string" && refs.has(l.from) && refs.has(l.to) && l.from !== l.to).slice(0, 2000);
  const frame = {};
  for (const k of ["x", "y", "w", "h"]) if (Number.isFinite(life?.frame?.[k])) frame[k] = limit(life.frame[k], k === "w" || k === "h" ? 240 : -1e5, 1e5, 0);
  return { v: 2, items, links, frame };
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
      h("textarea",{key:it.text,defaultValue:it.text,dir:"auto","aria-label":t("Life note","یادداشت زندگی"),onBlur:(e)=>update(e.target.value)}),
      h("button",{type:"button",onClick:()=>onOpen(it.id)},t("Show on board","نمایش روی برد")));
    return h("div",{key:it.id,className:"dd-plan-life-section"},h("div",{className:"dd-plan-life-heading"},
      h("button",{type:"button","aria-expanded":!it.collapsed,onClick:()=>change((s)=>({...s,items:s.items.map((i)=>i.id===it.id?{...i,collapsed:!i.collapsed}:i)}))},it.collapsed?"▸":"▾"),
      h("input",{key:it.text,dir:"auto",defaultValue:it.text,"aria-label":t("Life section name","نام سکشن زندگی"),onBlur:(e)=>update(e.target.value)}),
      h("button",{type:"button",onClick:()=>onOpen(it.id)},t("Board","برد"))),
      !it.collapsed&&h("div",{className:"dd-plan-life-children"},state.items.filter((i)=>i.parent===it.id).map(render)));
  }
  return h("section",{className:"dd-plan-life","data-section-id":"life",onKeyDown:(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!e.target.matches("input,textarea")){e.preventDefault();undo();}}},
    h("header",null,h("h2",null,t("Life · shared across days","زندگی · مشترک بین روزها")),h("button",{type:"button",onClick:()=>undo()},t("Undo Life edit","واگرد تغییر زندگی")),h("button",{type:"button",onClick:()=>undo(true)},t("Redo Life edit","انجام دوبارهٔ تغییر زندگی"))),
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
export function DDlifeCompact(items) {
  let next = items.map((i) => ({ ...i }));
  function arrange(parent, width) {
    const kids = next.filter((i) => i.parent === parent).sort((a,b) => a.y - b.y || a.x - b.x);
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
  return DDlifeColors[hash % DDlifeColors.length];
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
  for (const it of items) if (!it.parent) ((w = Math.max(w, it.x + it.w)), (h = Math.max(h, it.y + (it.collapsed ? 38 : it.h))));
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
    pos = Number.isFinite(spec.x) && Number.isFinite(spec.y) ? { x: spec.x, y: spec.y } : freeSpot(items, spec.parent || "", w, h),
    item = {
      id: spec.id,
      type: spec.type,
      parent: spec.parent || "",
      x: pos.x,
      y: pos.y,
      w,
      h,
      text: spec.text || "",
      ...(spec.style ? { style: { ...spec.style } } : {}),
      ...(spec.color ? { color: spec.color } : section ? {} : { color: DDlifeColors[0] }),
    };
  return DDlifeFit([...items, item], item.parent);
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
export function DDlifeDropTarget(items, id, dx, dy) {
  const it = find(items, id);
  if (!it) return null;
  const abs = DDlifeAbs(items, id),
    ax = abs.x + dx,
    ay = abs.y + dy,
    cx = ax + it.w / 2,
    cy = ay + it.h / 2,
    skip = DDlifeDescendants(items, id);
  let target = null,
    area = Infinity;
  for (const s of items) {
    if (s.type !== "section" || skip.has(s.id)) continue;
    const a = DDlifeAbs(items, s.id);
    // Sections join only when fully inside. Merely overlapping a neighbour must
    // not silently reparent it or grow that neighbour into a huge white box.
    const inside = it.type === "section"
      ? ax >= a.x && ay >= a.y && ax + it.w <= a.x + s.w && ay + it.h <= a.y + s.h
      : cx >= a.x && cx <= a.x + s.w && cy >= a.y && cy <= a.y + s.h;
    if (inside && s.w * s.h < area) ((target = s), (area = s.w * s.h));
  }
  return target;
}
export function DDlifeMoveBy(items, id, dx, dy) {
  const it = find(items, id);
  if (!it || (!dx && !dy)) return items;
  const abs = DDlifeAbs(items, id), ax = abs.x + dx, ay = abs.y + dy,
    target = DDlifeDropTarget(items, id, dx, dy);
  const base = target ? DDlifeAbs(items, target.id) : { x: 0, y: 0 },
    moved = { ...it, parent: target ? target.id : "", x: Math.round(ax - base.x), y: Math.round(ay - base.y) };
  // Dropped last so it sits on top of its new neighbours.
  return [...items.filter((i) => i.id !== id), moved];
}

// Where a new top-level section goes when the click was at (x, y) in Life coordinates:
// inside the section under the click if there is one.
export function DDlifeParentAt(items, x, y, skip = new Set()) {
  let target = null,
    area = Infinity;
  for (const s of items) {
    if (s.type !== "section" || skip.has(s.id)) continue;
    const a = DDlifeAbs(items, s.id);
    if (x >= a.x && x <= a.x + s.w && y >= a.y && y <= a.y + s.h && s.w * s.h < area) ((target = s), (area = s.w * s.h));
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
.dd-life-area-title{padding:12px 16px;color:var(--ink-2);font-size:14px;pointer-events:none}
.b4-life-section{background:color-mix(in srgb,var(--node-color) 24%,var(--panel))!important;border:2px solid color-mix(in srgb,var(--node-color) 65%,#292526);box-shadow:none}
.b4-life-section>.b4-node-body{position:absolute;top:-40px;left:0;height:34px;width:auto;max-width:calc(100% - 180px);border-radius:7px;background:var(--node-color);color:var(--node-text);padding:0 12px}
.b4-life-section>.b4-node-actions{position:absolute;top:-40px;right:0;height:34px;border-radius:7px;background:var(--node-color);color:var(--node-text)}
.b4-life-section[data-collapsed=true]>.b4-node-body,.b4-life-section[data-collapsed=true]>.b4-node-actions{top:0}
.b4-node[aria-selected=true]{outline:3px solid #3478F6!important;outline-offset:4px;box-shadow:0 0 0 7px #3478f625!important}
.dd-native-colors{position:absolute;top:35px;left:0;display:flex;gap:6px;padding:8px;background:var(--panel);border:1px solid var(--rule-2);border-radius:10px;box-shadow:0 4px 16px #0003;z-index:100}
.dd-native-colors button{width:28px;height:28px;border:1px solid #2225;border-radius:50%;padding:0;cursor:pointer}
.dd-life-nav{position:absolute;top:70px;right:16px;z-index:100;display:flex;flex-direction:column;gap:4px;max-height:65%;width:240px;overflow:auto;background:var(--panel);color:var(--ink);padding:12px;border:1px solid var(--rule-2);border-radius:12px;box-shadow:0 8px 28px #0002}
.dd-life-nav button{text-align:start;min-height:36px;padding:6px 8px;border-radius:6px}
.dd-life-nav button:hover{background:var(--wash)}
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
@media(pointer:coarse){.b4-sticky-head{height:44px!important;gap:2px;padding:0 4px!important}.b4-sticky-head button,.b4-life-section>.b4-node-actions button{min-width:44px!important;min-height:44px!important}.b4-life-section>.b4-node-body,.b4-life-section>.b4-node-actions{height:44px;top:-50px}.dd-native-colors button{width:36px;height:36px}.dd-plan-life button{min-height:44px}.dd-life-nav button{min-height:44px}}
.b4-viewport[data-tool=select],.b4-viewport[data-tool=select] .b4-node{cursor:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%2245%22%20y1%3D%2245%22%20x2%3D%22410%22%20y2%3D%22440%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%23ed009c%22%2F%3E%3Cstop%20offset%3D%22.45%22%20stop-color%3D%22%23762752%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2344333f%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20d%3D%22M99%2045L445%20166Q470%20176%20470%20199Q470%20219%20446%20229L300%20278Q284%20284%20276%20305L230%20447Q220%20470%20198%20470Q174%20470%20165%20446L45%20100Q35%2072%2053%2054Q72%2035%2099%2045Z%22%20fill%3D%22url%28%23g%29%22%2F%3E%3C%2Fsvg%3E") 3 3,auto}
@media (prefers-reduced-motion:reduce){.dd-life-tools{transition:none}}
`;

// Native Board and Plan share these styles; Life has no separate gesture engine.
export function DDinstallLifeStyles() {
  if (typeof document !== "undefined" && !document.getElementById("dd-life-css"))
    document.head.append(Object.assign(document.createElement("style"), { id: "dd-life-css", textContent: DDlifeCSS }));
}
