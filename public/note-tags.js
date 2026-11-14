// Tags on notes (5.36). Notes and tasks share one tag system: the same clean-up
// (DDtags in planner.js uses DDtagList), so #writing on a note and #writing on a
// task are one tag, found together in Board search and app search.
// Every read and write of a note's tags goes through DDnoteTags and DDsetNoteTags,
// for day notes and Feed notes alike.

// Clean a list (or "a, b" text) into tags: no #, spaces become _, at most 12.
export function DDtagList(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,،\n]+/)
      : [];
  const seen = new Set();
  return values.flatMap((raw) => {
    if (typeof raw !== "string") return [];
    const tag = raw
      .normalize("NFKC")
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, "_")
      .slice(0, 40);
    const key = DDtagKey(tag);
    if (!tag || seen.has(key) || seen.size >= 12) return [];
    seen.add(key);
    return [tag];
  });
}
// Two spellings of one tag (case, Arabic ي / ك) are the same tag.
export function DDtagKey(tag) {
  return String(tag || "")
    .toLocaleLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک");
}
// A note's tags (a day note or a Feed note).
export function DDnoteTags(item) {
  return DDtagList(item?.tags);
}
// Give a note these tags. Changes the note in place and returns it; no tags
// means no `tags` field at all.
export function DDsetNoteTags(item, tags) {
  if (!item || typeof item !== "object") return item;
  const next = DDtagList(tags);
  if (next.length) item.tags = next;
  else delete item.tags;
  return item;
}
// "#a #b": what search reads, so "#tag" finds notes and tasks alike.
export function DDtagText(tags) {
  return DDtagList(tags).map((tag) => "#" + tag).join(" ");
}
// Every tag in the planner with how often it is used, most used first:
// tasks, Later, day notes and Feed notes (5.62).
export function DDtagCounts(days = {}, setup = {}) {
  const count = new Map();
  const add = (tags) => {
    for (const tag of DDtagList(tags)) {
      const key = DDtagKey(tag), old = count.get(key);
      count.set(key, { tag: old?.tag || tag, n: (old?.n || 0) + 1 });
    }
  };
  for (const day of Object.values(days || {})) {
    for (const block of day?.blocks || []) add(block.tags);
    for (const note of day?.notes || []) add(note.tags);
  }
  for (const block of setup?.later || []) add(block.tags);
  for (const item of setup?.life?.items || []) add(item.tags);
  return [...count.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}
export function DDallTags(days = {}, setup = {}) {
  return DDtagCounts(days, setup).map((t) => t.tag);
}
// One tag renamed (or, with no new name, taken off) in a list of tags. The
// list keeps its order; a rename onto a tag already there becomes one tag.
export function DDtagSwap(tags, from, to) {
  const key = DDtagKey(from), name = to ? DDtagList([to])[0] : null;
  return DDtagList(DDtagList(tags).flatMap((t) => (DDtagKey(t) !== key ? [t] : name ? [name] : [])));
}
// The same thing for everything that carries tags: an item, a day, a list.
// Unchanged things come back as they were, so nothing is saved for nothing.
export function DDtagSwapItem(item, from, to) {
  const key = DDtagKey(from), tags = DDnoteTags(item);
  if (!tags.some((t) => DDtagKey(t) === key)) return item;
  return DDsetNoteTags({ ...item }, DDtagSwap(tags, from, to));
}
export function DDtagSwapList(list, from, to) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((item) => { const out = DDtagSwapItem(item, from, to); if (out !== item) changed = true; return out; });
  return changed ? next : list;
}
export function DDtagSwapDay(day, from, to) {
  if (!day) return day;
  const blocks = DDtagSwapList(day.blocks, from, to), notes = DDtagSwapList(day.notes, from, to);
  return blocks === day.blocks && notes === day.notes ? day : { ...day, blocks, notes };
}

// Tag colours (5.39). Each tag has a colour, the same everywhere; you can
// change it. Saved once for the whole planner in the Feed (`life.tagColors`,
// keyed by DDtagKey). A tag nobody coloured gets one from its name.
export const DDtagPalette = ["#FFD43B", "#FF922B", "#FF6B6B", "#F06595", "#CC5DE8", "#845EF7", "#5C7CFA", "#339AF0", "#22B8CF", "#20C997", "#51CF66", "#495057"];
const HEX = /^#[0-9a-f]{6}$/i;
export function DDtagColors(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value).slice(0, 300)) {
    const key = DDtagKey(DDtagList([k])[0] || "");
    if (key && typeof v === "string" && HEX.test(v)) out[key] = v.toUpperCase();
  }
  return out;
}
export function DDtagColor(colors, tag) {
  const key = DDtagKey(tag), own = colors?.[key];
  if (own && HEX.test(own)) return own;
  let n = 0;
  for (const ch of key) n = (n * 31 + ch.codePointAt(0)) >>> 0;
  return DDtagPalette[n % DDtagPalette.length];
}
// Dark or light words, whichever reads better on the tag's colour.
export function DDtagInk(color) {
  const c = HEX.test(color || "") ? color : "#FFD43B";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#121211" : "#FFFFFF";
}
// A small row of colours for one tag (right-click a tag, or its dot in the editor).
export function DDTagColorPicker({ React: R, tag, colors, onColor, onClose }) {
  const h = R.createElement, now = DDtagColor(colors, tag), own = !!colors?.[DDtagKey(tag)];
  return h("span", { className: "dd-tag-colors", role: "group", "aria-label": "Colour of #" + tag, onPointerDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation() },
    DDtagPalette.map((c) => h("button", { type: "button", key: c, className: "dd-tag-swatch", style: { background: c }, "aria-label": "Tag colour " + c, "aria-pressed": c === now,
      onClick: () => { onColor(tag, c); onClose?.(); } })),
    own && h("button", { type: "button", className: "dd-tag-swatch-reset", title: "Back to its own colour", "aria-label": "Reset tag colour", onClick: () => { onColor(tag, null); onClose?.(); } }, "↺"));
}

// Tags as chips. With onRemove, each chip has a × and Delete (or Backspace)
// on a focused chip takes it off, as on Milanote's labels.
export function DDTagChips({ React: R, tags, className = "dd-note-tags", onRemove, onPick, colors, onColor, dot }) {
  const list = DDtagList(tags), [open, setOpen] = R.useState(null);
  if (!list.length) return null;
  const h = R.createElement, showDot = dot ?? !!(onColor && onRemove);
  const keys = onRemove ? (tag) => (e) => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); onRemove(tag); } } : () => undefined;
  return h("span", { className, "aria-label": "Tags" },
    list.map((tag) => h("span", { key: tag, className: "dd-tag", dir: "auto", "data-tag": tag,
      style: colors ? { "--tag": DDtagColor(colors, tag), "--tag-ink": DDtagInk(DDtagColor(colors, tag)) } : undefined,
      onContextMenu: onColor ? (e) => { e.preventDefault(); e.stopPropagation(); setOpen(open === tag ? null : tag); } : undefined },
      onColor && showDot && h("button", { type: "button", className: "dd-tag-dot", "aria-label": "Change colour of " + tag, title: "Colour", onClick: (e) => { e.stopPropagation(); setOpen(open === tag ? null : tag); } }),
      onPick || onRemove
        ? h("button", { type: "button", className: "dd-tag-name", title: onPick ? "Find #" + tag : "#" + tag, onKeyDown: keys(tag), onClick: (e) => { e.stopPropagation(); onPick?.(tag); } }, "#" + tag)
        : "#" + tag,
      onRemove && h("button", { type: "button", className: "dd-tag-remove", "aria-label": "Remove tag " + tag, title: "Remove", onClick: (e) => { e.stopPropagation(); onRemove(tag); } }, "×"))),
    open && onColor && h(DDTagColorPicker, { React: R, tag: open, colors, onColor, onClose: () => setOpen(null) }));
}

// The tag menu (5.62, like Milanote's Labels). One field searches every tag
// you use and creates a new one; each tag in the list has a tick (on this
// note or not), its colour, how often it is used (a click finds them all) and
// a ⋯ menu to rename, recolour or delete it everywhere. Arrow keys move,
// Enter ticks or creates, Escape closes.
export function DDTagEditor({ React: R, tags, suggestions = [], counts, onChange, onClose, autoFocus = true, colors, onColor, onRename, onDelete, onFind, label = "Note tags" }) {
  const h = R.createElement, [draft, setDraft] = R.useState(""), [active, setActive] = R.useState(-1), [menu, setMenu] = R.useState(null);
  const input = R.useRef(null), listRef = R.useRef(null), uid = R.useRef("dd-tags-" + Math.random().toString(36).slice(2, 8)).current;
  const list = DDtagList(tags), have = new Set(list.map(DDtagKey));
  const typedTag = DDtagList([draft])[0] || "", typed = DDtagKey(typedTag);
  // Every tag: the ones on this note first, then the rest by how often they are used.
  const known = new Map();
  for (const t of counts || []) known.set(DDtagKey(t.tag), { tag: t.tag, n: t.n });
  for (const tag of suggestions) if (!known.has(DDtagKey(tag))) known.set(DDtagKey(tag), { tag, n: 0 });
  for (const tag of list) if (!known.has(DDtagKey(tag))) known.set(DDtagKey(tag), { tag, n: 1 });
  const all = [...known.values()].sort((a, b) => (have.has(DDtagKey(b.tag)) - have.has(DDtagKey(a.tag))) || b.n - a.n || a.tag.localeCompare(b.tag));
  const rows = all.filter((t) => !typed || DDtagKey(t.tag).includes(typed)).slice(0, 60);
  const exact = rows.findIndex((t) => DDtagKey(t.tag) === typed);
  const create = !!typed && exact < 0;
  const options = [...rows, ...(create ? [{ create: true, tag: typedTag }] : [])];
  // What Enter does without the arrows: the exact match, else the first match,
  // else make the tag you typed.
  const current = active >= 0 && active < options.length ? active : typed ? (exact >= 0 ? exact : 0) : -1;
  R.useEffect(() => { if (autoFocus) input.current?.focus({ preventScroll: true }); }, []);
  R.useEffect(() => { listRef.current?.querySelector("[data-active]")?.scrollIntoView?.({ block: "nearest" }); }, [current]);
  const focusField = () => input.current?.focus({ preventScroll: true });
  const add = (value) => {
    const next = DDtagList([...list, ...DDtagList(value)]);
    if (next.length !== list.length) onChange(next);
    setDraft(""); setActive(-1);
    focusField();
  };
  const toggle = (tag) => {
    if (have.has(DDtagKey(tag))) onChange(list.filter((t) => DDtagKey(t) !== DDtagKey(tag)));
    else onChange(DDtagList([...list, tag]));
    setDraft(""); setActive(-1);
    focusField();
  };
  const choose = (i) => {
    const o = options[i];
    if (!o) return;
    if (o.create) add(o.tag);
    // Typed exactly, not yet on the note: it goes on as you spelled it.
    else if (typed && DDtagKey(o.tag) === typed && !have.has(typed)) add(typedTag);
    else toggle(o.tag);
  };
  const row = (o, i) => {
    const key = DDtagKey(o.tag), on = have.has(key), color = DDtagColor(colors, o.tag), id = uid + "-" + i;
    if (o.create) return h("li", { key: "create", id, role: "option", "aria-selected": false, className: "dd-tag-row dd-tag-create", "data-tag-create": o.tag, "data-active": current === i || undefined,
      onPointerDown: (e) => e.preventDefault(), onPointerEnter: () => setActive(i), onClick: () => choose(i) },
      h("span", { className: "dd-tag-plus", "aria-hidden": true }, "+"), h("span", { dir: "auto" }, "Create ", h("b", null, "#" + o.tag)));
    return h("li", { key, id, role: "option", "aria-selected": on, className: "dd-tag-row", "data-tag-row": o.tag, "data-active": current === i || undefined,
      onPointerDown: (e) => { if (!e.target.closest("button")) e.preventDefault(); }, onPointerEnter: () => setActive(i),
      onClick: (e) => { if (!e.target.closest("button")) choose(i); },
      onDoubleClick: onRename ? (e) => { e.preventDefault(); setMenu({ tag: o.tag, step: "rename", name: o.tag }); } : undefined },
      h("span", { className: "dd-tag-tick", "aria-hidden": true }, on ? "✓" : ""),
      h("span", { className: "dd-tag-chip", dir: "auto", style: { "--tag": color, "--tag-ink": DDtagInk(color) } }, "#" + o.tag),
      onFind && o.n > 0
        ? h("button", { type: "button", className: "dd-tag-count", "data-tag-count": o.tag, title: "Find everything with #" + o.tag, "aria-label": "Find " + o.n + " with #" + o.tag, onClick: (e) => { e.stopPropagation(); onFind(o.tag); } }, o.n)
        : h("span", { className: "dd-tag-count" }, o.n || ""),
      (onRename || onDelete || onColor) && h("button", { type: "button", className: "dd-tag-more", "data-tag-more": o.tag, "aria-label": "Options for #" + o.tag, title: "Rename, colour or delete", "aria-expanded": menu?.tag === o.tag,
        onClick: (e) => { e.stopPropagation(); setMenu(menu?.tag === o.tag ? null : { tag: o.tag, step: "menu", name: o.tag }); } }, "⋯"));
  };
  // The ⋯ menu for one tag: rename everywhere, its colour, find, delete everywhere.
  const tagMenu = () => {
    const t = menu.tag, n = known.get(DDtagKey(t))?.n || 0;
    const rename = () => {
      const name = DDtagList([menu.name])[0];
      if (name && name !== t) onRename?.(t, name);
      setMenu(null); focusField();
    };
    return h("div", { className: "dd-tag-menu", role: "group", "aria-label": "Tag #" + t, "data-tag-menu": t },
      onRename && h("label", { className: "dd-tag-rename" }, h("small", null, "Name"),
        h("input", { value: menu.name, dir: "auto", maxLength: 41, "aria-label": "Rename tag", autoFocus: menu.step === "rename",
          onChange: (e) => setMenu({ ...menu, name: e.target.value }),
          onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); rename(); } else if (e.key === "Escape") { e.preventDefault(); setMenu(null); focusField(); } },
          onBlur: (e) => { if (!e.relatedTarget?.closest?.(".dd-tag-menu")) rename(); } })),
      onColor && h(DDTagColorPicker, { React: R, tag: t, colors, onColor }),
      menu.step === "delete"
        ? h("div", { className: "dd-tag-confirm", role: "alert" },
            h("span", { dir: "auto" }, n > 1 ? "Take #" + t + " off all " + n + " things?" : "Delete #" + t + "?"),
            h("button", { type: "button", className: "dd-tag-danger", onClick: () => { onDelete?.(t); setMenu(null); focusField(); } }, "Delete"),
            h("button", { type: "button", onClick: () => setMenu({ ...menu, step: "menu" }) }, "Keep"))
        : h("div", { className: "dd-tag-actions" },
            onFind && n > 0 && h("button", { type: "button", onClick: () => onFind(t) }, n === 1 ? "Find 1 thing" : "Find all " + n),
            onDelete && h("button", { type: "button", className: "dd-tag-danger", onClick: () => setMenu({ ...menu, step: "delete" }) }, "Delete tag")));
  };
  return h("div", { className: "dd-note-tag-editor", role: "group", "aria-label": label,
    onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation() },
    h(DDTagChips, { React: R, tags: list, colors, onColor, onRemove: (tag) => onChange(list.filter((t) => DDtagKey(t) !== DDtagKey(tag))) }),
    h("input", {
      ref: input, value: draft, dir: "auto", maxLength: 41,
      placeholder: list.length || all.length ? "Find or make a tag" : "Add a tag, like #idea",
      "aria-label": "Add a tag", "aria-controls": uid, "aria-autocomplete": "list",
      "aria-activedescendant": current >= 0 ? uid + "-" + current : undefined,
      onChange: (e) => {
        const value = e.target.value;
        setActive(-1);
        // A comma finishes the tag you were typing.
        if (/[,،]\s*$/.test(value)) add(value);
        else setDraft(value);
      },
      onKeyDown: (e) => {
        e.stopPropagation();
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!options.length) return;
          const step = e.key === "ArrowDown" ? 1 : -1;
          setActive(current < 0 ? (step > 0 ? 0 : options.length - 1) : (current + step + options.length) % options.length);
        }
        else if (e.key === "Enter") { e.preventDefault(); if (current >= 0) choose(current); else if (draft.trim()) add(draft); else onClose?.(); }
        else if (e.key === "Escape") { e.preventDefault(); if (menu) setMenu(null); else if (draft) { setDraft(""); setActive(-1); } else onClose?.(); }
        else if (e.key === "Backspace" && !draft && list.length) onChange(list.slice(0, -1));
      },
    }),
    options.length > 0 && h("ul", { ref: listRef, id: uid, className: "dd-tag-list", role: "listbox", "aria-label": "Tags", "aria-multiselectable": true }, options.map(row)),
    menu && known.has(DDtagKey(menu.tag)) && tagMenu(),
    onClose && h("button", { type: "button", className: "dd-tag-done", onClick: onClose }, "Done"));
}

export const DDnoteTagsCSS = `
.dd-note-tags{display:inline-flex;flex-wrap:wrap;gap:4px;min-width:0;position:relative}
.dd-tag[style*="--tag"]{background:var(--tag);color:var(--tag-ink);font-weight:600;box-shadow:0 1px 2px #0003,inset 0 0 0 1px #0000001f}
.dd-tag .dd-tag-dot{width:10px;height:10px;border-radius:50%;margin-inline-end:4px;background:var(--tag-ink);opacity:.35;flex:none}
.dd-tag .dd-tag-dot:hover,.dd-tag .dd-tag-dot:focus-visible{opacity:.8}
.dd-tag-colors{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-radius:10px;background:var(--wash,var(--paper));border:1px solid var(--rule-2,#0002);box-shadow:0 8px 20px -10px #0006;width:max-content;max-width:220px;pointer-events:auto;z-index:6}
.dd-tag-colors button{all:unset;cursor:pointer;box-sizing:border-box;width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1px #0003}
.dd-tag-colors button[aria-pressed=true]{outline:2px solid var(--ink);outline-offset:1px}
.dd-tag-colors .dd-tag-swatch-reset{display:grid;place-items:center;color:var(--ink);font-size:13px}
@media(pointer:coarse){.dd-tag-colors button{width:28px;height:28px}}
.dd-tag{display:inline-flex;align-items:center;gap:1px;max-width:100%;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--ink) 7%,transparent);color:var(--ink-2,var(--ink));font:500 11px/18px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-tag button{all:unset;cursor:pointer;color:inherit}
.dd-tag .dd-tag-remove{margin-inline-start:3px;padding:0 2px;opacity:.6;font-size:13px;line-height:1}
.dd-tag .dd-tag-remove:hover,.dd-tag .dd-tag-remove:focus-visible{opacity:1}
.dd-note-tag-editor{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;border-radius:12px;background:var(--wash,var(--paper));color:var(--ink);border:1px solid var(--rule-2,#0002);box-shadow:0 8px 24px -12px #0005;min-width:220px;max-width:340px}
.dd-note-tag-editor input{flex:1 1 120px;min-width:90px;height:30px;padding:0 8px;border:1px solid var(--rule-2,#0002);border-radius:8px;background:var(--paper);color:var(--ink);font:13px var(--sans)}
.dd-tag-offer{display:flex;flex-wrap:wrap;gap:4px;width:100%}
.dd-tag-offer button,.dd-tag-done{all:unset;cursor:pointer;padding:2px 8px;border-radius:999px;border:1px dashed var(--rule-2,#0003);font:12px/20px var(--sans);color:var(--ink-2,var(--ink))}
.dd-tag-done{border-style:solid;margin-inline-start:auto}
.dd-tag-offer button:hover,.dd-tag-done:hover,.dd-tag-offer button:focus-visible,.dd-tag-done:focus-visible{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.dd-search-tags{font-style:normal;color:var(--ink-3,#777);font-size:11px}
.dd-rail-tags{display:block;font:500 10px/16px var(--sans);color:var(--ink-3,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-review-note-tags{margin-inline-start:6px;color:var(--ink-3,#777);font-size:.85em}
.dd-note-tag-editor{flex-direction:column;align-items:stretch;flex-wrap:nowrap;min-width:260px;max-width:320px}
.dd-note-tag-editor>.dd-note-tags{display:flex}
.dd-note-tag-editor>input{flex:none;width:100%;box-sizing:border-box;height:32px}
.dd-tag-list{list-style:none;margin:0;padding:0;max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:1px;overscroll-behavior:contain}
.dd-tag-row{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 4px 0 6px;border-radius:7px;cursor:pointer;font:500 12px/1 var(--sans);color:var(--ink)}
.dd-tag-row[data-active]{background:color-mix(in srgb,var(--board-selection,#0D99FF) 14%,transparent)}
.dd-tag-tick{flex:none;display:grid;place-items:center;width:16px;height:16px;border-radius:4px;box-shadow:inset 0 0 0 1.5px var(--rule-2,#0003);font:700 11px/1 var(--sans);color:#fff}
.dd-tag-row[aria-selected=true] .dd-tag-tick{background:var(--board-selection,#0D99FF);box-shadow:none}
.dd-tag-chip{min-width:0;padding:2px 8px;border-radius:999px;background:var(--tag);color:var(--tag-ink);font:600 11px/16px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-tag-count{margin-inline-start:auto;min-width:20px;text-align:center;color:var(--ink-3,#777);font:500 11px/20px var(--sans)}
button.dd-tag-count,.dd-tag-more{all:unset;cursor:pointer;box-sizing:border-box;border-radius:6px;text-align:center}
button.dd-tag-count{min-width:22px;padding:0 4px;margin-inline-start:auto;color:var(--ink-3,#777);font:500 11px/22px var(--sans)}
.dd-tag-more{width:24px;height:22px;line-height:20px;color:var(--ink-3,#777);font-size:15px;opacity:0}
.dd-tag-row:hover .dd-tag-more,.dd-tag-row[data-active] .dd-tag-more,.dd-tag-more:focus-visible,.dd-tag-more[aria-expanded=true]{opacity:1}
button.dd-tag-count:hover,.dd-tag-more:hover,button.dd-tag-count:focus-visible,.dd-tag-more:focus-visible{background:color-mix(in srgb,var(--ink) 10%,transparent);color:var(--ink)}
.dd-tag-create{color:var(--ink-2,var(--ink))}
.dd-tag-create b{font-weight:700}
.dd-tag-plus{width:16px;text-align:center;font:600 15px/1 var(--sans);color:var(--board-selection,#0D99FF)}
.dd-tag-menu{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:10px;background:var(--paper);border:1px solid var(--rule-2,#0002)}
.dd-tag-menu .dd-tag-colors{box-shadow:none;border:0;padding:0;background:none;max-width:none}
.dd-tag-rename{display:flex;align-items:center;gap:6px}
.dd-tag-rename small{color:var(--ink-3,#777);font:500 11px var(--sans)}
.dd-tag-rename input{flex:1;min-width:0;height:28px;padding:0 8px;border:1px solid var(--rule-2,#0002);border-radius:7px;background:var(--wash,var(--paper));color:var(--ink);font:13px var(--sans)}
.dd-tag-actions,.dd-tag-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:12px var(--sans)}
.dd-tag-actions button,.dd-tag-confirm button{all:unset;cursor:pointer;padding:3px 10px;border-radius:999px;border:1px solid var(--rule-2,#0003);font:500 12px/18px var(--sans);color:var(--ink)}
.dd-tag-actions button:hover,.dd-tag-confirm button:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.dd-tag-actions .dd-tag-danger,.dd-tag-confirm .dd-tag-danger{color:#E03131;border-color:#E0313155}
.dd-tag-confirm .dd-tag-danger{background:#E03131;color:#fff;border-color:#E03131}
.dd-tag-confirm span{flex:1 1 100%}
.dd-note-tag-editor .dd-tag-done{align-self:flex-end}
@media(pointer:coarse){.dd-tag-row{min-height:40px}.dd-tag-more{opacity:1;width:32px;height:32px;line-height:30px}.dd-tag-list{max-height:40vh}}
@media(pointer:coarse){.dd-tag-offer button,.dd-tag-done{padding:8px 12px}.dd-tag .dd-tag-remove{padding:4px 6px}}
`;
