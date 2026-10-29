// Life board: one shared set of sections and sticky notes that shows on the board of
// every day. It lives in setup (setup.life), so a change made on one day's board
// is the same change on all days. Sections can hold sections and stickies, like FigJam.
//
// Data: a flat list. Each item is { id, type: "section" | "sticky", parent, x, y, w, h,
// text, color }. x and y are relative to the parent section (or to the Life area).

export const DDlifeHead = 54;
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
      ...(typeof r.color === "string" && /^#[0-9a-f]{3,8}$/i.test(r.color) ? { color: r.color } : {}),
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
  return { v: 1, items };
}

// What every day shows: the saved list, or the starting content until someone edits it.
export const DDlifeItems = (setup) =>
  setup?.life && Array.isArray(setup.life.items) ? setup.life.items : DDlifeDefault();

const find = (items, id) => items.find((i) => i.id === id);
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
  for (const it of items) if (!it.parent) ((w = Math.max(w, it.x + it.w)), (h = Math.max(h, it.y + it.h)));
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
export function DDlifeMoveBy(items, id, dx, dy) {
  const it = find(items, id);
  if (!it) return items;
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
    if (cx >= a.x && cx <= a.x + s.w && cy >= a.y && cy <= a.y + s.h && s.w * s.h < area) ((target = s), (area = s.w * s.h));
  }
  const base = target ? DDlifeAbs(items, target.id) : { x: 0, y: 0 },
    moved = { ...it, parent: target ? target.id : "", x: Math.round(ax - base.x), y: Math.round(ay - base.y) };
  // Dropped last so it sits on top of its new neighbours.
  return DDlifeFit([...items.filter((i) => i.id !== id), moved], moved.parent);
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
.dd-life-sec{background:var(--panel,#fff);box-shadow:inset 0 0 0 1px #12121126}
.dd-life-sec.is-nested{background:color-mix(in srgb,#5BC8E0 11%,var(--panel,#fff))}
.dd-life-sec-head{position:absolute;left:0;right:0;top:0;height:34px;display:flex;align-items:center;gap:6px;padding:0 8px 0 12px;cursor:grab;touch-action:none;border-radius:10px 10px 0 0}
.dd-life-sec-head strong{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-life-sec-head input{flex:1;min-width:0;font:inherit;font-size:14px;font-weight:700;border:1px solid var(--now,#7A5FF5);border-radius:6px;padding:2px 6px;background:var(--panel,#fff);color:inherit}
.dd-life-note{padding:30px 14px 14px;font-size:17px;line-height:1.45;color:#121211;background:var(--note,#FFE08A);box-shadow:0 2px 6px #0002,inset 0 0 0 1px #12121122;cursor:grab;touch-action:none;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
.dd-life-note textarea{position:absolute;inset:28px 6px 6px;width:calc(100% - 12px);height:calc(100% - 34px);font:inherit;font-size:17px;line-height:1.45;border:0;outline:2px solid #12121155;border-radius:6px;padding:6px 8px;background:#fff9;color:#121211;resize:none}
.dd-life-tools{position:absolute;top:3px;display:flex;gap:2px;inset-inline-end:4px;opacity:.35;transition:opacity .15s}
.dd-life-sec-head .dd-life-tools{position:static;opacity:.4}
.dd-life-sec:hover>.dd-life-sec-head .dd-life-tools,.dd-life-note:hover>.dd-life-tools,.dd-life-tools:focus-within{opacity:1}
@media (hover:none){.dd-life-tools,.dd-life-sec-head .dd-life-tools{opacity:.9}}
.dd-life-tools button{min-width:24px;height:24px;padding:0 5px;border:0;border-radius:6px;background:#ffffffb8;color:#121211;font-size:13px;line-height:1;cursor:pointer}
.dd-life-sec-head .dd-life-tools button{background:color-mix(in srgb,var(--ink,#121211) 9%,transparent);color:inherit}
.dd-life-tools button:hover,.dd-life-tools button:focus-visible{background:var(--now,#7A5FF5);color:#fff}
.dd-life-tools button[data-armed]{background:#D9434A;color:#fff}
.dd-life-grip{position:absolute;inset-inline-end:0;bottom:0;width:22px;height:22px;border:0;padding:0;background:none;cursor:nwse-resize;touch-action:none;opacity:.4}
.dd-life-grip::after{content:"";position:absolute;right:5px;bottom:5px;width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor}
.dd-life-sec:hover>.dd-life-grip{opacity:1}
.dd-life-dragging{z-index:50;box-shadow:0 10px 26px #0003!important;opacity:.95}
.b4-frame[data-section=life]{background:color-mix(in srgb,#5BC8E0 7%,var(--wash))!important}
@media (prefers-reduced-motion:reduce){.dd-life-tools{transition:none}}
`;

// The Life area as a React component. It renders inside the Life frame on the board.
export function DDcreateLifeBoard(R) {
  const h = R.createElement,
    { useState, useRef, useEffect } = R;
  if (typeof document !== "undefined" && !document.getElementById("dd-life-css"))
    document.head.append(Object.assign(document.createElement("style"), { id: "dd-life-css", textContent: DDlifeCSS }));
  return function LifeBoard({ items, getZoom, language, onChange, makeId }) {
    const fa = language === "fa",
      t = (en, fa2) => (fa ? fa2 : en),
      [ghost, setGhost] = useState(null),
      [edit, setEdit] = useState(null),
      [armed, setArmed] = useState(null),
      drag = useRef(null),
      armTimer = useRef(0),
      bounds = DDlifeBounds(items);
    useEffect(() => () => clearTimeout(armTimer.current), []);
    const interactive = (el) => !!el.closest?.("button,input,textarea,[data-life-tools]");
    const down = (event, it) => {
      if (event.button !== 0 || edit?.id === it.id || interactive(event.target)) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { id: it.id, sx: event.clientX, sy: event.clientY, dx: 0, dy: 0, moved: false };
    };
    const move = (event) => {
      const d = drag.current;
      if (!d) return;
      event.stopPropagation();
      const z = getZoom() || 1;
      d.dx = (event.clientX - d.sx) / z;
      d.dy = (event.clientY - d.sy) / z;
      if (!d.moved && Math.hypot(event.clientX - d.sx, event.clientY - d.sy) > 4) d.moved = true;
      if (d.moved) setGhost({ id: d.id, dx: d.dx, dy: d.dy });
    };
    const up = (event) => {
      const d = drag.current;
      if (!d) return;
      event.stopPropagation();
      drag.current = null;
      setGhost(null);
      if (d.moved) onChange((list) => DDlifeMoveBy(list, d.id, d.dx, d.dy));
    };
    const resizeDown = (event, it) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { resize: it.id, sx: event.clientX, sy: event.clientY, w: it.w, hh: it.h };
    };
    const resizeMove = (event) => {
      const d = drag.current;
      if (!d?.resize) return;
      event.stopPropagation();
      const z = getZoom() || 1;
      d.nw = Math.max(160, Math.round(d.w + (event.clientX - d.sx) / z));
      d.nh = Math.max(110, Math.round(d.hh + (event.clientY - d.sy) / z));
      setGhost({ id: d.resize, w: d.nw, h: d.nh });
    };
    const resizeUp = (event) => {
      const d = drag.current;
      if (!d?.resize) return;
      event.stopPropagation();
      drag.current = null;
      setGhost(null);
      if (d.nw)
        onChange((list) => {
          const it = list.find((i) => i.id === d.resize);
          return it ? DDlifeFit(DDlifeUpdate(list, d.resize, { w: d.nw, h: d.nh }), it.parent) : list;
        });
    };
    const add = (type, parent) => {
      const id = "lf-" + makeId();
      onChange((list) => DDlifeAdd(list, { id, type, parent }));
      if (type === "sticky") setEdit({ id, value: "" });
      else setEdit({ id, value: "" });
    };
    const colorNext = (it) => {
      const i = DDlifeColors.indexOf(it.color);
      onChange((list) => DDlifeUpdate(list, it.id, { color: DDlifeColors[(i + 1) % DDlifeColors.length] }));
    };
    // Deleting takes two presses so a stray tap cannot remove shared content from every day.
    const remove = (it) => {
      if (armed !== it.id) {
        setArmed(it.id);
        clearTimeout(armTimer.current);
        armTimer.current = setTimeout(() => setArmed(null), 3000);
        return;
      }
      setArmed(null);
      onChange((list) => (it.type === "section" ? DDlifeRemove(list, it.id) : list.filter((i) => i.id !== it.id)));
    };
    const finish = (it, save = true) => {
      if (save && edit && edit.id === it.id && edit.value !== it.text)
        onChange((list) => DDlifeUpdate(list, it.id, { text: edit.value }));
      setEdit(null);
    };
    const tool = (label, title, onClick, extra = {}) =>
      h("button", { type: "button", "aria-label": title, title, onClick: (e) => (e.stopPropagation(), onClick()), ...extra }, label);
    const render = (it) => {
      const g = ghost?.id === it.id ? ghost : null,
        style = {
          left: it.x,
          top: it.y,
          width: g?.w ?? it.w,
          height: g?.h ?? it.h,
          ...(g?.dx !== undefined ? { transform: `translate(${g.dx}px,${g.dy}px)` } : {}),
        },
        editing = edit?.id === it.id,
        delTool = tool(
          armed === it.id ? t("Sure?", "مطمئنی؟") : "×",
          armed === it.id ? t("Press again to delete", "برای حذف دوباره بزن") : t("Delete", "حذف"),
          () => remove(it),
          armed === it.id ? { "data-armed": true } : {},
        );
      if (it.type === "sticky")
        return h(
          "div",
          {
            key: it.id,
            className: "dd-life-note" + (g?.dx !== undefined ? " dd-life-dragging" : ""),
            "data-life-id": it.id,
            "data-life-type": "sticky",
            style: { ...style, "--note": it.color || DDlifeColors[0] },
            onPointerDown: (e) => down(e, it),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: up,
            onDoubleClick: (e) => (e.stopPropagation(), setEdit({ id: it.id, value: it.text })),
          },
          h(
            "div",
            { className: "dd-life-tools", "data-life-tools": true },
            tool("✎", t("Edit text", "ویرایش"), () => setEdit({ id: it.id, value: it.text })),
            tool("●", t("Change color", "تغییر رنگ"), () => colorNext(it)),
            delTool,
          ),
          editing
            ? h("textarea", {
                autoFocus: true,
                dir: "auto",
                value: edit.value,
                maxLength: 4000,
                "aria-label": t("Sticky text", "متن یادداشت"),
                onChange: (e) => setEdit({ ...edit, value: e.target.value }),
                onBlur: () => finish(it),
                onPointerDown: (e) => e.stopPropagation(),
                onKeyDown: (e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") finish(it, false);
                  else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) finish(it);
                },
              })
            : h("span", { dir: "auto" }, it.text),
        );
      const kids = items.filter((i) => i.parent === it.id).map(render),
        nested = !!it.parent;
      return h(
        "div",
        {
          key: it.id,
          className: "dd-life-sec" + (nested ? " is-nested" : "") + (g?.dx !== undefined ? " dd-life-dragging" : ""),
          "data-life-id": it.id,
          "data-life-type": "section",
          style,
        },
        h(
          "div",
          {
            className: "dd-life-sec-head",
            onPointerDown: (e) => down(e, it),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: up,
            onDoubleClick: (e) => (e.stopPropagation(), setEdit({ id: it.id, value: it.text })),
          },
          editing
            ? h("input", {
                autoFocus: true,
                dir: "auto",
                value: edit.value,
                maxLength: 120,
                "aria-label": t("Section name", "نام سکشن"),
                onChange: (e) => setEdit({ ...edit, value: e.target.value }),
                onBlur: () => finish(it),
                onPointerDown: (e) => e.stopPropagation(),
                onKeyDown: (e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") finish(it);
                  else if (e.key === "Escape") finish(it, false);
                },
              })
            : h("strong", { dir: "auto" }, it.text || t("Section", "سکشن")),
          h(
            "span",
            { className: "dd-life-tools", "data-life-tools": true },
            tool("✎", t("Rename", "تغییر نام"), () => setEdit({ id: it.id, value: it.text })),
            tool("▤", t("Add sticky note", "افزودن یادداشت"), () => add("sticky", it.id)),
            tool("▢", t("Add section inside", "افزودن سکشن داخل"), () => add("section", it.id)),
            delTool,
          ),
        ),
        kids,
        h("button", {
          type: "button",
          className: "dd-life-grip",
          "aria-label": t("Resize section", "تغییر اندازهٔ سکشن"),
          onPointerDown: (e) => resizeDown(e, it),
          onPointerMove: resizeMove,
          onPointerUp: resizeUp,
          onPointerCancel: resizeUp,
        }),
      );
    };
    return h(
      "div",
      {
        className: "dd-life",
        "data-life": true,
        style: { top: DDlifeHead, width: bounds.w, height: bounds.h },
        // Keep board gestures (pan, marquee) from starting on the content.
        onDoubleClick: (e) => e.stopPropagation(),
      },
      items.filter((i) => !i.parent).map(render),
    );
  };
}
