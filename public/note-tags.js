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
// Every tag in the planner, most used first: tasks, Later, day notes and Feed notes.
export function DDallTags(days = {}, setup = {}) {
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
  return [...count.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((t) => t.tag);
}

export function DDTagChips({ React: R, tags, className = "dd-note-tags", onRemove, onPick }) {
  const list = DDtagList(tags);
  if (!list.length) return null;
  const h = R.createElement;
  return h("span", { className, "aria-label": "Tags" },
    list.map((tag) => h("span", { key: tag, className: "dd-tag", dir: "auto" },
      onPick ? h("button", { type: "button", className: "dd-tag-name", title: "Find #" + tag, onClick: (e) => { e.stopPropagation(); onPick(tag); } }, "#" + tag) : "#" + tag,
      onRemove && h("button", { type: "button", className: "dd-tag-remove", "aria-label": "Remove tag " + tag, title: "Remove", onClick: (e) => { e.stopPropagation(); onRemove(tag); } }, "×"))));
}

// Add and remove tags: the chips with ×, and a field that suggests tags you
// already use (tasks and notes), so one tag keeps one spelling.
export function DDTagEditor({ React: R, tags, suggestions = [], onChange, onClose, autoFocus = true }) {
  const h = R.createElement, [draft, setDraft] = R.useState(""), input = R.useRef(null), list = DDtagList(tags);
  const have = new Set(list.map(DDtagKey)), typed = DDtagKey(draft.trim().replace(/^#+/, "").replace(/\s+/g, "_"));
  const offer = suggestions.filter((tag) => !have.has(DDtagKey(tag)) && (!typed || DDtagKey(tag).includes(typed))).slice(0, 6);
  R.useEffect(() => { if (autoFocus) input.current?.focus({ preventScroll: true }); }, []);
  const add = (value) => {
    const next = DDtagList([...list, ...DDtagList(value)]);
    if (next.length !== list.length) onChange(next);
    setDraft("");
    input.current?.focus({ preventScroll: true });
  };
  return h("div", { className: "dd-note-tag-editor", role: "group", "aria-label": "Note tags",
    onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() },
    h(DDTagChips, { React: R, tags: list, onRemove: (tag) => onChange(list.filter((t) => DDtagKey(t) !== DDtagKey(tag))) }),
    h("input", {
      ref: input, value: draft, dir: "auto", maxLength: 41,
      placeholder: list.length ? "Add a tag" : "Add a tag, like #idea",
      "aria-label": "Add a tag",
      onChange: (e) => {
        const value = e.target.value;
        // A comma or space finishes the tag you were typing.
        if (/[,،]\s*$/.test(value)) add(value);
        else setDraft(value);
      },
      onKeyDown: (e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) add(draft); else onClose?.(); }
        else if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
        else if (e.key === "Backspace" && !draft && list.length) onChange(list.slice(0, -1));
      },
    }),
    offer.length > 0 && h("span", { className: "dd-tag-offer", "aria-label": "Tags you use" },
      offer.map((tag) => h("button", { type: "button", key: tag, dir: "auto", onClick: () => add(tag) }, "#" + tag))),
    onClose && h("button", { type: "button", className: "dd-tag-done", onClick: onClose }, "Done"));
}

export const DDnoteTagsCSS = `
.dd-note-tags{display:inline-flex;flex-wrap:wrap;gap:4px;min-width:0}
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
@media(pointer:coarse){.dd-tag-offer button,.dd-tag-done{padding:8px 12px}.dd-tag .dd-tag-remove{padding:4px 6px}}
`;
