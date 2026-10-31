// The Sections list: every Life section in one list, in board order, under its
// parent. It is only a view of setup.life: a rename, a move or a new color shows
// here and on the board at once. Colors are picked here too.
import { DDlifePath, DDsectionTint, DDsectionPath, DDsectionPalette } from "./life-board.js";
import { DDsearchBoardText } from "./board-experience.js";

// Ask the Board to open the list. The request waits until a Board is on screen
// (Ctrl+Space can ask from Plan or Calendar), like the Engine's bus.
export const DDsectionsBus = {
  pending: false,
  listeners: new Set(),
  request() {
    this.pending = true;
    for (const listener of [...this.listeners]) listener();
  },
  take() {
    const pending = this.pending;
    this.pending = false;
    return pending;
  },
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};

const byBoard = (a, b) => a.y - b.y || a.x - b.x;

// The rows the list shows, top down. "Main board" comes first. A folded section
// hides what is inside it. A search keeps every section whose path matches, and
// the sections above them (dimmed), and opens every fold.
export function DDsectionsRows(items = [], { query = "", folded = [] } = {}) {
  const sections = items.filter((i) => i.type === "section"),
    kids = (parent) => sections.filter((s) => (s.parent || "") === parent).sort(byBoard),
    notes = (id) => items.filter((i) => i.type === "sticky" && (i.parent || "") === id).length,
    inside = (id) => kids(id).reduce((n, k) => n + 1 + inside(k.id), 0),
    fold = new Set(folded),
    words = DDsearchBoardText(query).split(" ").filter(Boolean),
    hits = new Set(),
    shown = words.length ? new Set() : null,
    rows = shown ? [] : [{ kind: "main", id: "", parent: "", depth: 0, children: 0, notes: notes("") }];
  if (shown)
    for (const s of sections) {
      const path = DDlifePath(items, s.id).filter((i) => i.type === "section");
      if (!words.every((w) => DDsearchBoardText(path.map((i) => i.text || "").join(" ")).includes(w))) continue;
      hits.add(s.id);
      path.forEach((i) => shown.add(i.id));
    }
  const walk = (parent, depth, seen) => {
    for (const s of kids(parent)) {
      if (seen.has(s.id) || (shown && !shown.has(s.id))) continue;
      seen.add(s.id);
      const children = kids(s.id).filter((k) => !shown || shown.has(k.id)).length,
        closed = !shown && children > 0 && fold.has(s.id);
      rows.push({
        kind: "section", id: s.id, parent: s.parent || "", depth, name: s.text || "", children, folded: closed,
        hidden: closed ? inside(s.id) : 0, notes: notes(s.id), found: hits.has(s.id), context: !!shown && !hits.has(s.id),
      });
      if (!closed) walk(s.id, depth + 1, seen);
    }
  };
  walk("", 0, new Set());
  return rows;
}

// Where the search words sit in a name, as [start, end] pairs in the name itself.
export function DDsectionsMarks(name = "", query = "") {
  const words = DDsearchBoardText(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  let flat = "";
  const at = [];
  [...String(name)].forEach((c, i, all) => {
    const start = all.slice(0, i).join("").length;
    for (const k of DDsearchBoardText(c)) { flat += k; at.push(start); }
  });
  const marks = [];
  for (const w of words) {
    const found = flat.indexOf(w);
    if (found < 0) continue;
    const last = at[found + w.length - 1], end = last + ([...String(name).slice(last)][0] || "").length;
    marks.push([at[found], end]);
  }
  return marks.sort((a, b) => a[0] - b[0]).filter((m, i, all) => !i || m[0] >= all[i - 1][1]);
}

const PALETTE_NAMES = [
  ["Butter", "کره‌ای"], ["Apricot", "زردآلویی"], ["Coral", "مرجانی"], ["Rose", "صورتی"], ["Lilac", "یاسی"],
  ["Sky", "آسمانی"], ["Mint", "نعنایی"], ["Sage", "مریم‌گلی"], ["Ink black", "مشکی جوهری"], ["Paper white", "سفید کاغذی"],
];
const FOLDED_KEY = "debug-day:sections-folded";
function readFolded() {
  try { const v = JSON.parse(localStorage.getItem(FOLDED_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
const fullHex = (color) => {
  const v = String(color || "").replace("#", "");
  return "#" + (v.length <= 4 ? [...v.slice(0, 3)].map((c) => c + c).join("") : v.slice(0, 6)).toLowerCase();
};

export function DDSectionsList({ React: R, items = [], room = null, language, frame = null, onShow, onEnter, onColor, onClose, onEnlarge, onSize, onCompact }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    num = (n) => Number(n).toLocaleString(fa ? "fa-IR" : "en-US"),
    phoneQuery = () => !!globalThis.matchMedia?.("(max-width: 700px)").matches,
    [phone, setPhone] = R.useState(phoneQuery),
    [query, setQuery] = R.useState(""),
    [folded, setFolded] = R.useState(readFolded),
    [focus, setFocus] = R.useState(null),
    [colorFor, setColorFor] = R.useState(null),
    [draft, setDraft] = R.useState(null),
    [tools, setTools] = R.useState(false),
    [, setFocusTick] = R.useState(0),
    root = R.useRef(null),
    wantFocus = R.useRef(null),
    sections = items.filter((i) => i.type === "section"),
    here = room && sections.some((s) => s.id === room) ? room : "",
    rows = DDsectionsRows(items, { query, folded }),
    found = rows.filter((r) => r.found).length,
    active = rows.some((r) => r.id === focus) ? focus : rows.some((r) => r.id === here) ? here : rows[0]?.id ?? null,
    name = (id) => sections.find((s) => s.id === id)?.text || t("Section", "سکشن");

  R.useEffect(() => {
    const media = globalThis.matchMedia?.("(max-width: 700px)"), change = () => setPhone(phoneQuery());
    media?.addEventListener?.("change", change);
    const previous = document.activeElement;
    // A desktop opens ready to type; a phone does not pop its keyboard up.
    if (!phoneQuery()) root.current?.querySelector(".dd-sections-find input")?.focus({ preventScroll: true });
    return () => { media?.removeEventListener?.("change", change); if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);
  R.useEffect(() => {
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(folded)); } catch {}
  }, [folded]);
  // The board you are in is always visible in the list.
  R.useEffect(() => {
    if (!here) return;
    const above = new Set(DDlifePath(items, here).slice(0, -1).map((i) => i.id));
    setFolded((list) => (list.some((id) => above.has(id)) ? list.filter((id) => !above.has(id)) : list));
    requestAnimationFrame(() => root.current?.querySelector(`[data-section-row="${CSS.escape(here)}"]`)?.scrollIntoView?.({ block: "nearest" }));
  }, [here]);
  R.useLayoutEffect(() => {
    const id = wantFocus.current;
    if (id === null) return;
    wantFocus.current = null;
    const el = root.current?.querySelector(`[data-section-row="${CSS.escape(id)}"] .dd-sections-name`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "nearest" });
  });

  function focusRow(id) {
    if (id === undefined || id === null) return;
    setFocus(id);
    wantFocus.current = id;
    setFocusTick((n) => n + 1);
  }
  function show(id) {
    if (!id) onEnter?.(null);
    else onShow?.(id);
    setFocus(id);
    if (phone) onClose?.();
  }
  function enter(id) {
    onEnter?.(id);
    setFocus(id);
    if (phone) onClose?.();
  }
  function setFold(id, open) {
    setFolded((list) => (open ? list.filter((x) => x !== id) : list.includes(id) ? list : [...list, id]));
  }
  function pick(id, color) {
    onColor?.(id, color);
    setColorFor(null);
    setDraft(null);
    focusRow(id);
  }
  function keyDown(event) {
    const typing = event.target.closest?.("input"),
      row = event.target.closest?.("[data-section-row]"),
      at = row ? rows.findIndex((r) => r.id === row.dataset.sectionRow) : -1,
      current = rows[at];
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && current) {
      event.preventDefault();
      event.stopPropagation();
      return current.id ? enter(current.id) : show("");
    }
    // Ctrl/Cmd shortcuts (Ctrl+Space) still reach the app; the rest stays here.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (colorFor) { const id = colorFor; setColorFor(null); setDraft(null); return focusRow(id); }
      if (typing && query) return setQuery("");
      return onClose?.();
    }
    if (typing) {
      if (typing.type !== "search") return;
      if (event.key === "ArrowDown") { event.preventDefault(); focusRow(rows[0]?.id); }
      else if (event.key === "Enter") {
        event.preventDefault();
        const first = rows.find((r) => r.found) || rows[0];
        if (first) show(first.id);
      }
      return;
    }
    if (!current || event.target.closest(".dd-sections-colors")) return;
    const forward = fa ? "ArrowLeft" : "ArrowRight", back = fa ? "ArrowRight" : "ArrowLeft";
    let handled = true;
    if (event.key === "ArrowDown") focusRow(rows[Math.min(rows.length - 1, at + 1)].id);
    else if (event.key === "ArrowUp") at === 0 ? root.current.querySelector(".dd-sections-find input")?.focus() : focusRow(rows[at - 1].id);
    else if (event.key === "Home") focusRow(rows[0].id);
    else if (event.key === "End") focusRow(rows[rows.length - 1].id);
    else if (event.key === forward) {
      if (current.folded) setFold(current.id, true);
      else if (current.children) focusRow(rows[at + 1]?.id);
    } else if (event.key === back) {
      if (current.children && !current.folded && !query.trim()) setFold(current.id, false);
      else if (current.parent) focusRow(current.parent);
    } else if (event.key === "/") root.current.querySelector(".dd-sections-find input")?.focus();
    else if (!event.shiftKey && (event.key === "d" || event.key === "D" || event.code === "KeyD")) onClose?.();
    else handled = false;
    if (handled) event.preventDefault();
  }

  function marked(text) {
    const marks = DDsectionsMarks(text, query);
    if (!marks.length) return text;
    const out = [];
    let from = 0;
    marks.forEach(([a, b], i) => { out.push(text.slice(from, a), h("mark", { key: i }, text.slice(a, b))); from = b; });
    out.push(text.slice(from));
    return out;
  }
  function colors(row, tint) {
    const current = (tint.own ? tint.fill : "").toUpperCase(), custom = draft?.id === row.id ? draft.color : fullHex(tint.fill);
    return h("div", { className: "dd-sections-colors", role: "group", "aria-label": t("Color for ", "رنگ برای ") + name(row.id) },
      DDsectionPalette.map((color, i) => h("button", {
        key: color,
        type: "button",
        "data-color": color,
        "aria-pressed": current === color,
        "aria-label": PALETTE_NAMES[i][fa ? 1 : 0],
        title: PALETTE_NAMES[i][fa ? 1 : 0],
        style: { background: color },
        onClick: () => pick(row.id, color),
      })),
      h("label", { className: "dd-sections-custom", title: t("Any color you like", "هر رنگی که دوست داری") },
        h("input", {
          type: "color",
          value: custom,
          "data-custom-color": row.id,
          "aria-label": t("Custom color", "رنگ دلخواه"),
          onInput: (event) => setDraft({ id: row.id, color: event.target.value }),
          onChange: (event) => setDraft({ id: row.id, color: event.target.value }),
          // The picker reports every step while you drag; save once, when it closes.
          ref: (el) => {
            if (!el || el.dataset.ready) return;
            el.dataset.ready = "1";
            el.addEventListener("change", () => pick(row.id, el.value.toUpperCase()));
          },
        }),
        h("span", null, t("Custom", "دلخواه"))),
      row.parent && h("button", {
        type: "button",
        className: "dd-sections-shade",
        "data-family-shade": row.id,
        "aria-pressed": !tint.own,
        title: t("A shade of its top section's color", "سایه‌ای از رنگ سکشن بالایی"),
        onClick: () => pick(row.id, null),
      }, t("Family shade", "سایهٔ خانواده")));
  }
  function renderRow(row) {
    const isHere = row.id === here, tab = row.id === active ? 0 : -1;
    if (row.kind === "main")
      return h("li", { key: "main", className: "dd-sections-row is-main" + (isHere ? " is-here" : ""), "data-section-row": "", role: "none" },
        h("span", { className: "dd-sections-fold is-empty", "aria-hidden": true }),
        h("span", { className: "dd-sections-board", "aria-hidden": true }),
        h("button", { type: "button", className: "dd-sections-name", tabIndex: tab, "data-section-show": "", "aria-current": isHere ? "location" : undefined, onFocus: () => setFocus(""), onClick: () => show("") },
          h("span", { className: "dd-sections-label" }, t("Main board", "برد اصلی"))),
        isHere && h("span", { className: "dd-sections-here" }, t("You're here", "اینجایی")),
        row.notes > 0 && h("span", { className: "dd-sections-notes", title: t(row.notes === 1 ? "1 note on the main board" : `${row.notes} notes on the main board`, `${num(row.notes)} یادداشت روی برد اصلی`) }, num(row.notes)),
        h("span", { className: "dd-sections-open is-empty", "aria-hidden": true }));
    const tint = DDsectionTint(items, row.id), shown = draft?.id === row.id ? draft.color : tint.fill,
      path = DDsectionPath(items, row.id, 80, t("Section", "سکشن")).full,
      label = row.name.trim() || t("Section", "سکشن");
    return h(R.Fragment, { key: row.id },
      h("li", {
          className: "dd-sections-row" + (isHere ? " is-here" : "") + (row.context ? " is-context" : ""),
          "data-section-row": row.id,
          "data-depth": Math.min(row.depth, 3),
          role: "none",
          style: { "--dd-depth": row.depth },
        },
        row.children
          ? h("button", {
              type: "button",
              className: "dd-sections-fold",
              tabIndex: -1,
              "data-section-fold": row.id,
              "aria-label": row.folded ? t("Unfold ", "باز کردن ") + label : t("Fold ", "جمع کردن ") + label,
              "aria-expanded": !row.folded,
              disabled: !!query.trim(),
              onClick: () => setFold(row.id, row.folded),
            }, h("svg", { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true }, h("path", { d: "M3 4.5 6 7.5 9 4.5" })))
          : h("span", { className: "dd-sections-fold is-empty", "aria-hidden": true }),
        h("button", {
          type: "button",
          className: "dd-sections-swatch",
          tabIndex: tab,
          "data-section-color": row.id,
          "aria-label": t("Color for ", "رنگ برای ") + label,
          "aria-expanded": colorFor === row.id,
          title: t("Change color", "تغییر رنگ"),
          style: { background: shown, borderColor: tint.line },
          onClick: () => { setDraft(null); setColorFor((id) => (id === row.id ? null : row.id)); },
        }),
        h("button", {
            type: "button",
            className: "dd-sections-name",
            tabIndex: tab,
            title: path,
            "data-section-show": row.id,
            "aria-current": isHere ? "location" : undefined,
            "aria-expanded": row.children ? !row.folded : undefined,
            "aria-level": row.depth + 1,
            onFocus: () => setFocus(row.id),
            onClick: () => show(row.id),
          },
          h("bdi", { className: "dd-sections-label" }, marked(label))),
        isHere && h("span", { className: "dd-sections-here" }, t("You're here", "اینجایی")),
        row.hidden > 0 && h("span", { className: "dd-sections-hidden", title: t(`${row.hidden} folded inside`, `${num(row.hidden)} سکشن جمع شده`) }, "+" + num(row.hidden)),
        row.notes > 0 && h("span", { className: "dd-sections-notes", title: t(row.notes === 1 ? "1 note in this section" : `${row.notes} notes in this section`, `${num(row.notes)} یادداشت در این سکشن`) }, num(row.notes)),
        isHere
          ? h("span", { className: "dd-sections-open is-empty", "aria-hidden": true })
          : h("button", {
              type: "button",
              className: "dd-sections-open",
              tabIndex: tab,
              "data-enter-section": row.id,
              title: t("Open this section's board", "باز کردن برد این سکشن"),
              "aria-label": t("Open board: ", "باز کردن برد: ") + path,
              onClick: () => enter(row.id),
            }, "↗")),
      colorFor === row.id && h("li", { className: "dd-sections-colors-row", role: "none", style: { "--dd-depth": row.depth } }, colors(row, tint)));
  }
  // Rows are grouped by their top section, so each family sits on its own tint.
  const groups = [];
  for (const row of rows) {
    if (row.kind === "main" || !row.depth || !groups.length) groups.push({ key: row.id || "main", rows: [row] });
    else groups[groups.length - 1].rows.push(row);
  }
  const sizeInput = (key) => h("label", { key },
    key === "w" ? t("Width", "عرض") : t("Height", "ارتفاع"),
    h("input", {
      key: frame?.[key],
      type: "number",
      min: 240,
      max: 100000,
      step: 100,
      defaultValue: Math.round(frame?.[key] || 240),
      "aria-label": key === "w" ? t("Life area width", "عرض محدودهٔ زندگی") : t("Life area height", "ارتفاع محدودهٔ زندگی"),
      onBlur: (event) => {
        const value = Number(event.target.value);
        if (event.target.value && Number.isFinite(value) && value >= 240 && value <= 100000) onSize?.({ [key]: value });
        else event.target.value = Math.round(frame?.[key] || 240);
      },
      onKeyDown: (event) => { if (event.key === "Enter") event.currentTarget.blur(); },
    }));
  const panel = h("section", {
      className: "dd-sections" + (phone ? " is-phone" : ""),
      role: "dialog",
      "aria-label": t("Sections", "سکشن‌ها"),
      "data-panel": "sections",
      dir: fa ? "rtl" : "ltr",
      ref: root,
      onKeyDown: keyDown,
      onPointerDown: (event) => event.stopPropagation(),
      onWheel: (event) => event.stopPropagation(),
    },
    phone && h("div", { className: "dd-sections-grab", "aria-hidden": true }),
    h("header", { className: "dd-sections-head" },
      h("div", { className: "dd-sections-title" },
        h("strong", null, t("Sections", "سکشن‌ها")),
        h("span", { className: "dd-sections-count" }, query.trim() ? t(`${found} of ${sections.length}`, `${num(found)} از ${num(sections.length)}`) : num(sections.length)),
        h("button", { type: "button", className: "dd-sections-close", "aria-label": t("Close sections", "بستن سکشن‌ها"), title: t("Close (D)", "بستن (D)"), onClick: onClose }, "×")),
      h("label", { className: "dd-sections-find" },
        h("span", { "aria-hidden": true }, "⌕"),
        h("input", {
          type: "search",
          value: query,
          dir: "auto",
          placeholder: t("Find a section…", "پیدا کردن سکشن…"),
          "aria-label": t("Find a section", "پیدا کردن سکشن"),
          onChange: (event) => setQuery(event.target.value),
        }),
        !phone && h("kbd", { "aria-hidden": true }, "/"))),
    h("div", { className: "dd-sections-body" },
      sections.length === 0 && h("p", { className: "dd-sections-empty" }, t("No sections yet. Draw one on the board with Shift+S.", "هنوز سکشنی نداری. با Shift+S روی برد یکی بکش.")),
      query.trim() && !rows.length && sections.length > 0 && h("p", { className: "dd-sections-empty" }, t("No section matches.", "سکشنی پیدا نشد.")),
      h("ul", { className: "dd-sections-list", role: "list", "aria-label": t("Sections", "سکشن‌ها") },
        groups.map((group) => {
          const top = group.rows[0], tint = top.kind === "section" ? DDsectionTint(items, top.id) : null;
          return h("li", { key: group.key, className: "dd-sections-family" + (tint ? "" : " is-main"), role: "none", style: tint ? { "--dd-family": draft?.id === top.id ? draft.color : tint.fill } : undefined },
            h("ul", { role: "none" }, group.rows.map(renderRow)));
        }))),
    h("footer", { className: "dd-sections-foot" },
      h("button", { type: "button", className: "dd-sections-tools-toggle", "aria-expanded": tools, "data-life-tools": true, onClick: () => setTools((v) => !v) },
        h("span", null, t("Life area size & layout", "اندازه و چیدمان محدودهٔ زندگی")), h("span", { "aria-hidden": true }, tools ? "▴" : "▾")),
      tools && h("div", { className: "dd-sections-tools" },
        h("button", { type: "button", onClick: onEnlarge }, t("Enlarge Life area +25%", "بزرگ‌تر کردن محدودهٔ زندگی +۲۵٪")),
        h("div", { className: "dd-life-dimensions" }, ["w", "h"].map(sizeInput)),
        h("button", { type: "button", onClick: onCompact }, t("Compact layout", "جمع‌وجور کن")))));
  return phone
    ? h("div", { className: "dd-sections-backdrop", onPointerDown: (event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose?.(); } }, panel)
    : panel;
}

export const DDsectionsCSS = `
:root{--panel-sections:#8A6E4B}[data-panel="sections"]{--pc:var(--panel-sections)}
.dd-sections{--dd-k:30%;position:absolute;top:70px;inset-inline-end:16px;z-index:100;width:328px;max-width:calc(100% - 32px);max-height:calc(100% - 86px);display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#121211);border:1px solid var(--rule-2,#0002);border-radius:14px;box-shadow:0 14px 40px #0000002e,0 2px 6px #00000014;font:13.5px/1.35 var(--sans,system-ui);overflow:hidden}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .dd-sections{--dd-k:16%}}
:root[data-theme=dark] .dd-sections{--dd-k:16%}
.dd-sections *{box-sizing:border-box}
.dd-sections button{font:inherit;color:inherit}
.dd-sections-head{flex:none;display:grid;gap:10px;padding:12px 12px 10px;border-bottom:1px solid var(--rule,#0001)}
.dd-sections-title{display:flex;align-items:center;gap:8px}
.dd-sections-title strong{font-size:15px;font-weight:600}
.dd-sections-count{font-size:12px;color:var(--ink-3,#7f7c75);font-variant-numeric:tabular-nums}
.dd-sections-close{margin-inline-start:auto;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:none;font-size:20px!important;line-height:1;color:var(--ink-2,#4a4843)!important;cursor:pointer}
.dd-sections-close:hover{background:var(--wash,#0000000d)}
.dd-sections-find{position:relative;display:flex;align-items:center;gap:6px;height:36px;padding:0 10px;border:1px solid var(--rule-2,#0002);border-radius:9px;background:var(--wash,#0000000a)}
.dd-sections-find:focus-within{border-color:var(--now,#7A5FF5);box-shadow:0 0 0 3px color-mix(in srgb,var(--now,#7A5FF5) 22%,transparent)}
.dd-sections-find>span{color:var(--ink-3,#7f7c75)}
.dd-sections-find input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink,#121211);font:inherit;font-size:14px;outline:none}
.dd-sections-find input::-webkit-search-cancel-button{display:none}
.dd-sections-find kbd{min-width:20px;padding:0 5px;border:1px solid var(--rule-2,#0002);border-radius:5px;font:500 11px/18px var(--mono,ui-monospace,monospace);color:var(--ink-3,#7f7c75);text-align:center}
.dd-sections-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px;scrollbar-width:thin}
.dd-sections-list,.dd-sections-list ul{margin:0;padding:0;list-style:none}
.dd-sections-list{display:flex;flex-direction:column;gap:6px}
.dd-sections-family{padding:2px;border-radius:10px;background:color-mix(in srgb,var(--dd-family) var(--dd-k),var(--paper,#fff))}
.dd-sections-family.is-main{background:none}
.dd-sections-row{position:relative;display:flex;align-items:center;gap:6px;min-height:32px;padding-inline:3px;padding-inline-start:calc(3px + var(--dd-depth,0) * 16px);border-radius:8px}
.dd-sections-row:hover{background:color-mix(in srgb,var(--ink,#121211) 7%,transparent)}
.dd-sections-row[data-depth]:not([data-depth="0"])::before{content:"";position:absolute;top:0;bottom:0;inset-inline-start:calc(13px + (var(--dd-depth) - 1) * 16px);border-inline-start:1.5px solid color-mix(in srgb,var(--dd-family),var(--ink,#121211) 28%)}
.dd-sections-fold{flex:none;display:grid;place-items:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:none;color:var(--ink-2,#4a4843)!important;cursor:pointer}
.dd-sections-fold:hover:not(:disabled){background:var(--wash,#0000000d);color:var(--ink,#121211)}
.dd-sections-fold:disabled{cursor:default}
.dd-sections-fold svg{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;transition:transform .15s}
.dd-sections-fold[aria-expanded=false] svg{transform:rotate(-90deg)}
[dir=rtl] .dd-sections-fold[aria-expanded=false] svg{transform:rotate(90deg)}
.dd-sections-fold.is-empty{visibility:hidden}
.dd-sections-swatch{flex:none;width:14px;height:14px;padding:0;border:1.5px solid;border-radius:4px;cursor:pointer}
.dd-sections-row:not([data-depth="0"]) .dd-sections-swatch{width:12px;height:12px;border-radius:3px}
.dd-sections-swatch:hover,.dd-sections-swatch[aria-expanded=true]{outline:2px solid color-mix(in srgb,var(--ink,#121211) 35%,transparent);outline-offset:1px}
.dd-sections-board{flex:none;width:14px;height:14px;border:1.5px solid var(--ink-2,#4a4843);border-radius:4px;background:linear-gradient(var(--ink-2,#4a4843),var(--ink-2,#4a4843)) 0 4px/100% 1.5px no-repeat}
.dd-sections-name{flex:1 1 auto;min-width:0;display:flex;align-items:center;min-height:28px;padding:0;border:0;background:none;text-align:start;cursor:pointer;border-radius:5px}
.dd-sections-label{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.dd-sections-row[data-depth="0"] .dd-sections-name{font-size:14px;font-weight:600}
.dd-sections-row[data-depth="2"] .dd-sections-name,.dd-sections-row[data-depth="3"] .dd-sections-name{font-size:13px;color:var(--ink-2,#4a4843)}
.dd-sections-row.is-main .dd-sections-name{font-size:14px;font-weight:500}
.dd-sections-row.is-context .dd-sections-name{color:var(--ink-3,#7f7c75)}
.dd-sections-name mark{background:#FFD86B;color:#121211;border-radius:3px;padding:0 1px}
.dd-sections-here{flex:none;padding:0 7px;border-radius:999px;background:var(--ink,#121211);color:var(--paper,#fff);font-size:10.5px;font-weight:600;line-height:18px}
.dd-sections-row.is-here{background:var(--paper,#fff);box-shadow:inset 0 0 0 1.5px var(--ink,#121211)}
.dd-sections-notes,.dd-sections-hidden{flex:none;font-size:11.5px;color:var(--ink-3,#7f7c75);font-variant-numeric:tabular-nums}
.dd-sections-notes::before{content:"";display:inline-block;width:7px;height:8px;margin-inline-end:3px;border:1.2px solid currentColor;border-radius:1.5px;vertical-align:-.5px}
.dd-sections-hidden{padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dd-family,#999) 55%,var(--paper,#fff));color:var(--ink-2,#4a4843);line-height:18px}
.dd-sections-open{flex:none;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:none;color:var(--ink-2,#4a4843)!important;font-size:14px!important;line-height:1;cursor:pointer;opacity:0}
.dd-sections-open:hover{background:color-mix(in srgb,var(--ink,#121211) 10%,transparent)}
.dd-sections-row:hover .dd-sections-open,.dd-sections-row:focus-within .dd-sections-open{opacity:1}
.dd-sections-open.is-empty{visibility:hidden}
@media (pointer:coarse){.dd-sections-open{opacity:1}}
.dd-sections-name:focus-visible,.dd-sections-open:focus-visible,.dd-sections-fold:focus-visible,.dd-sections-swatch:focus-visible{outline:2px solid var(--now,#7A5FF5);outline-offset:1px}
.dd-sections-colors-row{padding:4px 6px 8px;padding-inline-start:calc(30px + var(--dd-depth,0) * 16px)}
.dd-sections-colors{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.dd-sections-colors>button[data-color]{width:24px;height:24px;padding:0;border:1.5px solid color-mix(in srgb,var(--ink,#121211) 40%,transparent);border-radius:50%;cursor:pointer}
.dd-sections-colors>button[aria-pressed=true]{outline:2px solid var(--now,#7A5FF5);outline-offset:2px}
.dd-sections-custom{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 8px 0 3px;border:1px solid var(--rule-2,#0002);border-radius:999px;background:var(--paper,#fff);font-size:12px;cursor:pointer}
.dd-sections-custom input{width:20px;height:20px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer}
.dd-sections-custom input::-webkit-color-swatch-wrapper{padding:0}
.dd-sections-custom input::-webkit-color-swatch{border:1px solid #0003;border-radius:50%}
.dd-sections-shade{height:26px;padding:0 9px;border:1px solid var(--rule-2,#0002);border-radius:999px;background:var(--paper,#fff);font-size:12px!important;cursor:pointer}
.dd-sections-shade[aria-pressed=true]{background:var(--ink,#121211);color:var(--paper,#fff)!important;border-color:var(--ink,#121211)}
.dd-sections-empty{margin:18px 8px;text-align:center;color:var(--ink-3,#7f7c75)}
.dd-sections-foot{flex:none;border-top:1px solid var(--rule,#0001)}
.dd-sections-tools-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:40px;padding:0 14px;border:0;background:none;font-size:12.5px!important;color:var(--ink-2,#4a4843)!important;text-align:start;cursor:pointer}
.dd-sections-tools-toggle:hover{background:var(--wash,#0000000d)}
.dd-sections-tools{display:grid;gap:6px;padding:0 12px 12px}
.dd-sections-tools>button{min-height:34px;padding:0 10px;border:1px solid var(--rule-2,#0002);border-radius:8px;background:var(--wash,#0000000a);text-align:start;cursor:pointer}
.dd-sections-tools>button:hover{background:color-mix(in srgb,var(--ink,#121211) 8%,transparent)}
.dd-sections-backdrop{position:absolute;inset:0;z-index:99;display:flex;align-items:flex-end;background:rgba(18,18,17,.36)}
.b2:has(.dd-sections-backdrop) .b2-top{z-index:101}
.dd-sections.is-phone{position:relative;top:auto;inset-inline:auto;width:100%;max-width:none;max-height:min(78%,calc(100% - 64px));border-radius:18px 18px 0 0;border-bottom:0}
.dd-sections-grab{flex:none;width:40px;height:4px;margin:8px auto 0;border-radius:2px;background:var(--rule-2,#0002)}
.dd-sections.is-phone .dd-sections-head{padding-top:8px}
.dd-sections.is-phone .dd-sections-find{height:44px}
.dd-sections.is-phone .dd-sections-find input{font-size:16px}
.dd-sections.is-phone .dd-sections-row{min-height:44px;padding-inline-start:calc(3px + var(--dd-depth,0) * 20px)}
.dd-sections.is-phone .dd-sections-row[data-depth]:not([data-depth="0"])::before{inset-inline-start:calc(19px + (var(--dd-depth) - 1) * 20px)}
.dd-sections.is-phone .dd-sections-fold{width:34px;height:40px}
.dd-sections.is-phone .dd-sections-name{min-height:44px}
.dd-sections.is-phone .dd-sections-open{width:44px;height:40px;opacity:1}
.dd-sections.is-phone .dd-sections-swatch{width:20px;height:20px}
.dd-sections.is-phone .dd-sections-close{width:44px;height:44px}
.dd-sections.is-phone .dd-sections-colors>button[data-color]{width:36px;height:36px}
.dd-sections.is-phone .dd-sections-custom,.dd-sections.is-phone .dd-sections-shade{height:36px}
.dd-sections.is-phone .dd-sections-colors-row{padding-inline-start:12px}
.dd-sections.is-phone .dd-sections-tools-toggle,.dd-sections.is-phone .dd-sections-tools>button{min-height:44px}
@media (prefers-reduced-motion:reduce){.dd-sections-fold svg{transition:none}}
`;

export function DDinstallSectionsStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-sections-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-sections-css", textContent: DDsectionsCSS }));
}
