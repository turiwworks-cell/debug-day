// A task's section tag (5.53): the path of the section it belongs to, shown on
// top of the task. It is the task's `from`, the same field the Engine, Lanes and
// the Board already read, so a tag set here shows everywhere at once and a
// rename or a new colour of the section shows on every tag.
// Set it from the task panel with a quick search, no dragging. A click on the
// tag goes into that section's own board.
import { DDsectionPath, DDsectionTint } from "./life-board.js";
import { DDsearchBoardText } from "./board-experience.js";

// "Go into this section", asked from anywhere (the Engine page, a tag): the
// Board takes it when it is on screen, or as soon as it opens.
export const DDsectionGo = {
  pending: null,
  listeners: new Set(),
  request(id) {
    this.pending = id || "";
    for (const listener of [...this.listeners]) listener();
  },
  take() {
    const id = this.pending;
    this.pending = null;
    return id;
  },
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};

// Every section with its full path, for the picker. `query` keeps the ones
// whose path has every word; the section you are in comes first.
export function DDsectionChoices(items = [], { query = "", here = "", fallback = "Section" } = {}) {
  const words = DDsearchBoardText(query).split(" ").filter(Boolean);
  return items
    .filter((i) => i?.type === "section")
    .map((s) => ({ id: s.id, path: DDsectionPath(items, s.id, 200, fallback).full }))
    .filter((c) => words.every((w) => DDsearchBoardText(c.path).includes(w)))
    .sort((a, b) => (b.id === here) - (a.id === here) || a.path.localeCompare(b.path));
}

export function DDSectionTagField({ React: R, items = [], value = "", here = "", language, disabled = false, onChange, onGo }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    fallback = t("Section", "سکشن"),
    [open, setOpen] = R.useState(false),
    [query, setQuery] = R.useState(""),
    [active, setActive] = R.useState(0),
    input = R.useRef(null),
    tint = value ? DDsectionTint(items, value) : null,
    path = tint ? DDsectionPath(items, value, 40, fallback) : null,
    choices = open ? DDsectionChoices(items, { query, here, fallback }).slice(0, 8) : [];
  R.useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open]);
  R.useEffect(() => setActive(0), [query]);
  const pick = (id) => {
    onChange?.(id);
    setOpen(false);
    setQuery("");
  };
  const keyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(choices.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); if (choices[active]) pick(choices[active].id); }
  };
  return h("div", { className: "dd-section-tag-field", "data-section-tag": value || "" },
    tint
      ? h("span", { className: "dd-section-tag-row" },
          h("button", {
            type: "button",
            className: "dd-section-tag",
            "data-go-section": value,
            dir: "auto",
            title: t("Go to ", "رفتن به ") + path.full,
            style: { background: tint.fill, color: tint.ink, borderColor: tint.line },
            onClick: () => onGo?.(value),
          }, "↖ " + path.short, h("span", { className: "dd-section-tag-go", "aria-hidden": true }, " ↗")),
          !disabled && h("button", { type: "button", className: "dd-section-tag-edit", "data-section-tag-change": true, "aria-expanded": open, onClick: () => setOpen((v) => !v) }, t("Change", "تغییر")),
          !disabled && h("button", { type: "button", className: "dd-section-tag-clear", "data-section-tag-clear": true, "aria-label": t("Take the section tag off", "برداشتن تگ سکشن"), title: t("Take it off", "برداشتن"), onClick: () => pick("") }, "×"))
      : h("button", { type: "button", className: "dd-section-tag-add", "data-section-tag-add": true, disabled: disabled || !items.some((i) => i.type === "section"), "aria-expanded": open, onClick: () => setOpen((v) => !v) }, "+ " + t("Section tag", "تگ سکشن")),
    open && h("div", { className: "dd-section-tag-pick" },
      h("input", {
        ref: input,
        type: "search",
        dir: "auto",
        value: query,
        placeholder: t("Find a section…", "پیدا کردن سکشن…"),
        "aria-label": t("Find a section", "پیدا کردن سکشن"),
        "aria-controls": "dd-section-tag-list",
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: keyDown,
      }),
      h("ul", { className: "dd-section-tag-list", id: "dd-section-tag-list", role: "listbox", "aria-label": t("Sections", "سکشن‌ها") },
        choices.map((c, i) => {
          const tone = DDsectionTint(items, c.id);
          return h("li", { key: c.id, role: "option", "aria-selected": i === active },
            h("button", {
              type: "button",
              "data-section-choice": c.id,
              dir: "auto",
              tabIndex: -1,
              onPointerEnter: () => setActive(i),
              onClick: () => pick(c.id),
            }, h("span", { className: "dd-section-tag-dot", style: { background: tone?.fill, borderColor: tone?.line } }), h("bdi", null, c.path), c.id === here && h("small", null, t("here", "اینجا"))));
        }),
        !choices.length && h("li", { className: "dd-section-tag-none" }, t("No section matches.", "سکشنی پیدا نشد.")))));
}

export const DDsectionTagCSS = `
.dd-section-tag-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.dd-section-tag-row{display:flex;align-items:center;gap:6px;min-width:0}
.dd-section-tag{min-width:0;max-width:100%;padding:2px 10px;border:1px solid;border-radius:999px;font:inherit;font-size:12px;font-weight:500;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.dd-section-tag:hover .dd-section-tag-go,.dd-section-tag:focus-visible .dd-section-tag-go{opacity:1}
.dd-section-tag-go{opacity:.55}
.dd-section-tag-edit,.dd-section-tag-add{flex:none;padding:2px 10px;border:1px dashed var(--rule-2,#0003);border-radius:999px;background:none;color:var(--ink-2,#4a4843);font:inherit;font-size:12px;cursor:pointer}
.dd-section-tag-add{align-self:flex-start}
.dd-section-tag-add:disabled{opacity:.5;cursor:default}
.dd-section-tag-clear{flex:none;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:none;color:var(--ink-3,#7f7c75);font-size:16px;line-height:1;cursor:pointer}
.dd-section-tag-edit:hover,.dd-section-tag-add:hover:not(:disabled),.dd-section-tag-clear:hover{background:var(--wash,#0000000d);color:var(--ink,#121211)}
.dd-section-tag-pick{display:flex;flex-direction:column;gap:4px;padding:6px;border:1px solid var(--rule-2,#0002);border-radius:10px;background:var(--raise,var(--paper,#fff))}
.dd-section-tag-pick input{height:30px;padding:0 10px;border:1px solid var(--rule-2,#0002);border-radius:8px;background:var(--wash,#0000000a);color:var(--ink,#121211);font:inherit;font-size:13px}
.dd-section-tag-list{display:flex;flex-direction:column;gap:1px;max-height:240px;margin:0;padding:0;list-style:none;overflow:auto}
.dd-section-tag-list button{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;padding:0 8px;border:0;border-radius:7px;background:none;color:var(--ink,#121211);font:inherit;font-size:13px;text-align:start;cursor:pointer}
.dd-section-tag-list button bdi{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-section-tag-list small{color:var(--ink-3,#7f7c75)}
.dd-section-tag-list [aria-selected=true] button{background:var(--wash,#0000000f)}
.dd-section-tag-dot{flex:none;width:10px;height:10px;border:1.5px solid;border-radius:50%}
.dd-section-tag-none{padding:6px 8px;color:var(--ink-3,#7f7c75);font-size:12px}
@media(max-width:700px){.dd-section-tag,.dd-section-tag-edit,.dd-section-tag-add{min-height:36px;font-size:14px}.dd-section-tag-clear{width:36px;height:36px}.dd-section-tag-list button{min-height:44px;font-size:15px}.dd-section-tag-pick input{height:44px;font-size:16px}}
`;
export function DDinstallSectionTagStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-section-tag-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-section-tag-css", textContent: DDsectionTagCSS }));
}
