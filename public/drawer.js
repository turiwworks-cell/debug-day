// The Section Drawer: a card-file cabinet for the Life sections. Each section is
// a card and its name is the tab. Top-level sections are filled dividers, the
// sections inside them are outlined cards filed behind. It is only a view of
// setup.life: nothing here is a copy, so a name or color change shows at once.
import { DDlifeDescendants, DDlifePath, DDsectionTint, DDsectionPath, DDsectionPalette } from "./life-board.js";
import { DDengineStrip } from "./engine.js";
import { DDsearchBoardText } from "./board-experience.js";

// Ask the Board to open the drawer. The request waits until a Board is on
// screen (Ctrl+Space can ask from Plan or Calendar), like the Engine's bus.
export const DDdrawerBus = {
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

export function DDroman(n) {
  if (!Number.isFinite(n) || n < 1 || n > 3999) return n === 0 ? "·" : String(n);
  const marks = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [value, mark] of marks) while (n >= value) ((out += mark), (n -= value));
  return out;
}

// Two letters for a divider: the first letter of the first two words, or the
// first two letters of a single word. "Creative life" → "CL", "Job" → "JO".
export function DDinitials(text) {
  let words = String(text || "").split(/[\s/_\-–—&+.,·]+/).map((w) => [...w].filter((c) => /[\p{L}\p{N}]/u.test(c))).filter((w) => w.length);
  // Little joining words ("and", "و") do not make an initial.
  const joined = words.filter((w) => !["و", "and", "of", "the", "از", "به"].includes(w.join("").toLowerCase()));
  if (joined.length) words = joined;
  if (!words.length) return "··";
  const letters = words.length > 1 ? [words[0][0], words[1][0]] : words[0].slice(0, 2);
  return letters.join("").toLocaleUpperCase();
}

const byBoard = (a, b) => a.y - b.y || a.x - b.x;

// Every section, top down in board order (top to bottom, then left to right).
function boardOrder(sections) {
  const out = [], seen = new Set(),
    walk = (parent) => sections.filter((s) => (s.parent || "") === parent && !seen.has(s.id)).sort(byBoard)
      .forEach((s) => { seen.add(s.id); out.push(s); walk(s.id); });
  walk("");
  for (const s of sections) if (!seen.has(s.id)) out.push(s);
  return out;
}

// What the drawer holds, front card first. Row 0 is always "Main board". At the
// top the dividers are filed with their direct children behind them; inside a
// folder only its children show; a search lists matches from every level.
// Tabs cycle through three columns so they never sit on top of each other.
export function DDdrawerFile(items = [], folder = "", query = "") {
  const sections = items.filter((i) => i.type === "section"),
    kids = (parent) => sections.filter((s) => (s.parent || "") === parent).sort(byBoard),
    count = (id) => sections.filter((s) => s.parent === id).length,
    card = (s, index, kind = "card") => ({ kind, id: s.id, name: s.text || "", index, children: count(s.id), depth: DDlifePath(items, s.id).length - 1 }),
    cards = [{ kind: "main", id: "", name: "", index: 0, children: 0, depth: 0 }],
    words = DDsearchBoardText(query).split(" ").filter(Boolean);
  if (words.length) {
    let n = 0;
    for (const s of boardOrder(sections)) {
      const text = DDsearchBoardText(DDlifePath(items, s.id).map((i) => i.text || "").join(" "));
      if (words.every((w) => text.includes(w))) cards.push({ ...card(s, ++n), found: true });
    }
  } else if (folder && sections.some((s) => s.id === folder)) {
    kids(folder).forEach((s, i) => cards.push(card(s, i + 1)));
  } else {
    for (const top of kids("")) {
      cards.push({ ...card(top, 0, "divider"), initials: DDinitials(top.text), roman: DDroman(count(top.id)) });
      kids(top.id).forEach((s, i) => cards.push(card(s, i + 1)));
    }
  }
  return cards.map((c, row) => ({ ...c, row, column: row % 3 }));
}

// The pixel shape of one card: where its tab sits, the strip under the tab and
// the next column's strip. Both stay visible: the card in front has its tab in
// the third column, and the one two rows ahead sits lower than this strip.
export function DDdrawerShape(width, column, { rtl = false, phone = false } = {}) {
  const pad = phone ? 10 : 14, colW = (width - pad * 2) / 3, place = (c) => (rtl ? 2 - c : c),
    a = pad + place(column) * colW + 2, next = pad + place((column + 1) % 3) * colW;
  return { a, b: a + colW - 4, slant: phone ? 8 : 10, own: { x: a + 6, w: colW - 16 }, next: { x: next + 6, w: colW - 12 } };
}

function tabPath(a, b, s, T) {
  return `M${a - 4},${T} Q${a},${T} ${a + 1.5},${T - 4} L${a + s - 1.5},4 Q${a + s},0 ${a + s + 4},0 L${b - s - 4},0 Q${b - s},0 ${b - s + 1.5},4 L${b - 1.5},${T - 4} Q${b},${T} ${b + 4},${T}`;
}
function cardPath(w, H, a, b, s, T) {
  return `M0,${H} L0,${T + 7} Q0,${T} 7,${T} L` + tabPath(a, b, s, T).slice(1) + ` L${w - 7},${T} Q${w},${T} ${w},${T + 7} L${w},${H}`;
}

const PALETTE_NAMES = [
  ["Butter", "کره‌ای"], ["Apricot", "زردآلویی"], ["Coral", "مرجانی"], ["Rose", "صورتی"], ["Lilac", "یاسی"],
  ["Sky", "آسمانی"], ["Mint", "نعنایی"], ["Sage", "مریم‌گلی"], ["Ink black", "مشکی جوهری"], ["Paper white", "سفید کاغذی"],
];

export function DDSectionDrawer({ React: R, items = [], day = { blocks: [] }, history = new Map(), room = null, language, onEnter, onClose, onColor, onList }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    phoneQuery = () => !!globalThis.matchMedia?.("(max-width: 700px)").matches,
    [phone, setPhone] = R.useState(phoneQuery),
    [folder, setFolder] = R.useState(""),
    [query, setQuery] = R.useState(""),
    [focusRow, setFocusRow] = R.useState(-1),
    [palette, setPalette] = R.useState(null),
    [width, setWidth] = R.useState(0),
    root = R.useRef(null),
    files = R.useRef(null),
    clickTimer = R.useRef(null),
    press = R.useRef({ type: "mouse", timer: null, long: false }),
    T = phone ? 44 : 32,
    S = phone ? 50 : 28,
    PREVIEW = phone ? 0 : 64,
    H = T + S + PREVIEW + 14,
    FACE = phone ? 16 : 44,
    PAD = 18,
    sections = items.filter((i) => i.type === "section"),
    live = folder && sections.some((s) => s.id === folder) ? folder : "",
    cards = DDdrawerFile(items, live, query),
    n = cards.length,
    trail = live ? DDlifePath(items, live) : [],
    name = (it) => it?.text || t("Section", "سکشن");

  // The drawer measures its own width, so tabs are drawn with exact slants.
  R.useLayoutEffect(() => {
    const el = files.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth) setWidth(el.clientWidth); setPhone(phoneQuery()); };
    measure();
    const watch = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    watch?.observe(el);
    return () => watch?.disconnect();
  }, []);
  // A new filing starts at the front of the drawer, like opening it.
  R.useLayoutEffect(() => {
    if (files.current) files.current.scrollTop = files.current.scrollHeight;
  }, [live, query, width > 0]);
  R.useEffect(() => {
    const previous = document.activeElement;
    root.current?.closest(".b2")?.scrollIntoView?.({ block: "nearest" });
    return () => { clearTimeout(clickTimer.current); clearTimeout(press.current.timer); previous?.focus?.({ preventScroll: true }); };
  }, []);
  // Focus the first section card when the drawer opens or re-files.
  R.useLayoutEffect(() => {
    if (!width) return;
    if (document.activeElement?.closest?.(".dd-drawer-find")) return;
    focusCard(n > 1 ? 1 : 0);
  }, [live, width > 0]);
  R.useEffect(() => {
    if (focusRow >= n) setFocusRow(n - 1);
  }, [n]);

  function focusCard(row) {
    const next = Math.max(0, Math.min(n - 1, row));
    setFocusRow(next);
    const go = () => {
      const el = root.current?.querySelector(`[data-drawer-row="${next}"] .dd-drawer-tab`);
      el?.focus({ preventScroll: true });
      el?.closest(".dd-drawer-card")?.scrollIntoView?.({ block: "nearest" });
      return !!el;
    };
    if (!go()) requestAnimationFrame(go);
  }
  function openFolder(id) {
    setQuery("");
    setPalette(null);
    setFolder(id || "");
  }
  function up() {
    if (query) return setQuery("");
    if (!live) return;
    openFolder(sections.find((s) => s.id === live)?.parent || "");
  }
  function enter(card) {
    clearTimeout(clickTimer.current);
    onEnter(card.kind === "main" ? null : card.id);
  }
  function pick(card, event) {
    if (press.current.long) return (press.current.long = false);
    if (card.kind === "main" || !card.children) return enter(card);
    // A folder opens on one click; a quick second click enters its board instead.
    if (press.current.type !== "mouse") return openFolder(card.id);
    if (event?.detail > 1 || clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return enter(card);
    }
    clickTimer.current = setTimeout(() => { clickTimer.current = null; openFolder(card.id); }, 220);
  }
  function showPalette(card, target) {
    if (card.kind !== "divider") return;
    const box = target.getBoundingClientRect(), frame = root.current.getBoundingClientRect();
    setPalette({ id: card.id, x: Math.max(8, Math.min(box.left - frame.left, frame.width - 300)), y: Math.max(8, box.top - frame.top - 56) });
    requestAnimationFrame(() => root.current?.querySelector(".dd-drawer-palette button")?.focus({ preventScroll: true }));
  }
  function keyDown(event) {
    const typing = event.target.closest?.("input,textarea,select"),
      plain = !event.ctrlKey && !event.metaKey && !event.altKey,
      forward = fa ? "ArrowLeft" : "ArrowRight",
      back = fa ? "ArrowRight" : "ArrowLeft",
      card = cards[focusRow];
    // Ctrl/Cmd shortcuts (Ctrl+Space) still reach the app; the rest stays here.
    if (event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (palette) {
        const id = palette.id;
        setPalette(null);
        return requestAnimationFrame(() => root.current?.querySelector(`[data-drawer-card="${id}"] .dd-drawer-tab`)?.focus());
      }
      return onClose();
    }
    if (typing) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") (event.preventDefault(), focusCard(n > 1 ? 1 : 0));
      else if (event.key === "Enter") {
        event.preventDefault();
        const first = cards.find((c) => c.kind !== "main");
        if (first) enter(first);
      }
      return;
    }
    if (!plain || event.target.closest?.(".dd-drawer-palette")) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      // The drawer is seen from the front: up is further back.
      focusCard((focusRow < 0 ? 0 : focusRow) + (event.key === "ArrowUp" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusCard(event.key === "Home" ? 0 : n - 1);
    } else if (event.key === "Enter" && card) {
      event.preventDefault();
      enter(card);
    } else if (event.key === forward && card) {
      event.preventDefault();
      if (card.children) openFolder(card.id);
    } else if (event.key === back || event.key === "Backspace") {
      event.preventDefault();
      up();
    } else if (!event.shiftKey && (event.key === "d" || event.key === "D" || event.code === "KeyD")) {
      event.preventDefault();
      onClose();
    } else if (event.key === "/") {
      event.preventDefault();
      root.current?.querySelector(".dd-drawer-find input")?.focus();
    }
  }

  function preview(card) {
    if (!PREVIEW) return null;
    if (card.kind === "main") return h("div", { className: "dd-drawer-preview" }, h("small", null, room ? t("Leave this section and go back to the main board.", "از این سکشن بیرون برو و به برد اصلی برگرد.") : t("You are on the main board.", "روی برد اصلی هستی.")));
    const inside = DDlifeDescendants(items, card.id),
      notes = items.filter((i) => i.type === "sticky" && inside.has(i.id)).length,
      open = (day?.blocks || []).filter((b) => !b.done && inside.has(b.from)),
      strip = DDengineStrip(history.get(card.id) || [], day?.date || new Date().toISOString().slice(0, 10), 14);
    return h("div", { className: "dd-drawer-preview", "data-drawer-preview": card.id },
      h("small", { dir: "auto" }, DDsectionPath(items, card.id, 60, t("Section", "سکشن")).full),
      h("span", { className: "dd-drawer-preview-counts" },
        h("span", null, h("b", null, notes), " " + t(notes === 1 ? "note" : "notes", "یادداشت") + " · ", h("b", null, open.length), " " + t("open today", "کار باز امروز")),
        h("span", { className: "dd-history-strip", title: t("Last 14 days", "۱۴ روز اخیر") }, strip.map((d) => h("i", { key: d.date, "data-state": d.state })))),
      open.length > 0 && h("span", { className: "dd-drawer-preview-tasks", dir: "auto" }, open.slice(0, 2).map((b) => "○ " + (b.name || t("Untitled", "بی‌نام"))).join("   ")));
  }

  function renderCard(card) {
    const back = card.row,
      inset = phone ? 0 : Math.min(back, 12) * 3,
      w = Math.max(120, width - inset * 2),
      shape = DDdrawerShape(w, card.column, { rtl: fa, phone }),
      tint = card.kind === "main" ? null : DDsectionTint(items, card.id),
      divider = card.kind === "divider",
      label = card.kind === "main" ? t("Main board", "برد اصلی") : card.name || t("Section", "سکشن"),
      path = card.kind === "main" ? null : DDsectionPath(items, card.id, 28, t("Section", "سکشن")),
      action = card.kind === "main"
        ? t("Main board: leave the section", "برد اصلی: خروج از سکشن")
        : card.children && !card.found ? label + t(` · folder with ${card.children} inside`, ` · پوشه با ${card.children} سکشن`) : label,
      tabFill = divider ? tint.fill : tint ? `color-mix(in srgb, ${tint.fill} 30%, var(--paper,#fff))` : "var(--paper,#fff)",
      tabInk = divider ? tint.ink : "var(--ink,#121211)",
      { own, next } = shape,
      openW = phone ? 44 : 26,
      tip = path ? path.full : label;
    return h("div", {
        key: card.kind + card.id,
        className: "dd-drawer-card",
        "data-drawer-row": card.row,
        "data-drawer-card": card.id || "main",
        "data-kind": card.kind,
        "data-folder": card.children ? true : undefined,
        style: { top: PAD + (n - 1 - card.row) * S, left: inset, width: w, height: H, zIndex: n - card.row, animationDelay: Math.min(card.row * 15, 300) + "ms" },
      },
      h("svg", { className: "dd-drawer-card-art", width: w, height: H, viewBox: `0 0 ${w} ${H}`, "aria-hidden": true },
        h("path", { className: "dd-drawer-card-body", d: cardPath(w, H, shape.a, shape.b, shape.slant, T) }),
        h("path", { className: "dd-drawer-tab-fill", d: tabPath(shape.a, shape.b, shape.slant, T) + " Z", style: { fill: tabFill } }),
        h("path", { className: "dd-drawer-card-line", d: cardPath(w, H, shape.a, shape.b, shape.slant, T) })),
      h("button", {
          type: "button",
          className: "dd-drawer-tab",
          tabIndex: card.row === (focusRow < 0 ? (n > 1 ? 1 : 0) : focusRow) ? 0 : -1,
          title: tip + (divider ? t(" · right-click for color", " · کلیک راست برای رنگ") : ""),
          "aria-label": action,
          "data-root": tint?.root,
          dir: fa ? "rtl" : "ltr",
          style: { left: shape.a + shape.slant, width: shape.b - shape.a - shape.slant * 2, height: T, color: tabInk },
          onFocus: () => setFocusRow(card.row),
          onPointerDown: (event) => {
            press.current.type = event.pointerType || "mouse";
            press.current.long = false;
            clearTimeout(press.current.timer);
            if (divider && event.pointerType === "touch") {
              const target = event.currentTarget;
              press.current.timer = setTimeout(() => { press.current.long = true; showPalette(card, target); }, 480);
            }
          },
          onPointerUp: () => clearTimeout(press.current.timer),
          onPointerLeave: () => clearTimeout(press.current.timer),
          onPointerCancel: () => clearTimeout(press.current.timer),
          onClick: (event) => pick(card, event),
          onDoubleClick: () => card.kind !== "main" && enter(card),
          onContextMenu: (event) => {
            if (!divider) return;
            event.preventDefault();
            clearTimeout(press.current.timer);
            if (!palette || palette.id !== card.id) showPalette(card, event.currentTarget);
          },
        },
        card.kind === "main"
          ? h(R.Fragment, null, h("bdi", { className: "dd-drawer-num", dir: "ltr" }, "⌂"), h("span", { className: "dd-drawer-name" }, label))
          : divider
            ? h(R.Fragment, null, h("bdi", { className: "dd-drawer-num", dir: "ltr" }, card.initials), h("bdi", { className: "dd-drawer-roman", dir: "ltr" }, card.roman))
            : h(R.Fragment, null, h("bdi", { className: "dd-drawer-num", dir: "ltr" }, String(card.index).padStart(2, "0")), h("span", { className: "dd-drawer-name", dir: "auto" }, label))),
      // The strip under the tab: a divider's full name, a folder's count, or a found
      // card's path. It stays out of the column where the card in front has its tab.
      h("div", {
          className: "dd-drawer-strip",
          style: { top: T, left: own.x - 6, width: own.w + 12, height: S },
          onClick: (event) => pick(card, event),
          onDoubleClick: () => card.kind !== "main" && enter(card),
        },
        h("span", { className: "dd-drawer-meta", dir: "auto", style: { left: 6, width: own.w } },
          card.found ? path.short : divider ? card.name || t("Section", "سکشن") : [phone && card.kind === "card" ? label : "", card.children ? (fa ? "◂ " : "▸ ") + card.children + t(" inside", " داخلش") : ""].filter(Boolean).join(" · "))),
      card.kind !== "main" && h("button", {
          type: "button",
          className: "dd-drawer-open",
          tabIndex: -1,
          "data-drawer-open": card.id,
          title: t("Open this section's board", "باز کردن برد این سکشن"),
          "aria-label": t("Open board: ", "باز کردن برد: ") + (path?.full || label),
          style: { top: T + (phone ? 3 : 1), left: fa ? next.x + next.w - openW : next.x, width: openW },
          onClick: (event) => { event.stopPropagation(); enter(card); },
        }, "↗"),
      h("div", { className: "dd-drawer-preview-slot", style: { top: T + S + 6, left: 14, right: 14 } }, preview(card)));
  }

  const paletteFor = palette && sections.find((s) => s.id === palette.id),
    current = paletteFor && DDsectionTint(items, paletteFor.id),
    backInset = phone ? 0 : Math.min(n - 1, 12) * 3,
    label = live ? name(sections.find((s) => s.id === live)) : t("Sections", "سکشن‌ها");
  return h("div", {
      className: "dd-drawer-backdrop",
      onPointerDown: (event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
        else if (palette && !event.target.closest(".dd-drawer-palette")) setPalette(null);
      },
      onWheel: (event) => event.stopPropagation(),
      onKeyDown: keyDown,
    },
    h("section", {
        className: "dd-drawer" + (phone ? " is-phone" : ""),
        role: "dialog",
        "aria-modal": "true",
        "aria-label": t("Sections drawer", "کشوی سکشن‌ها"),
        "data-panel": "sections",
        dir: fa ? "rtl" : "ltr",
        ref: root,
      },
      h("div", { className: "dd-drawer-well" },
        !phone && h("svg", { className: "dd-drawer-sides", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": true },
          h("line", { x1: (backInset / Math.max(1, width)) * 100, y1: 0, x2: 0, y2: 100 }),
          h("line", { x1: 100 - (backInset / Math.max(1, width)) * 100, y1: 0, x2: 100, y2: 100 })),
        h("div", {
            className: "dd-drawer-files",
            ref: files,
            role: "list",
            "aria-label": label,
            "data-drawer-folder": live || "top",
          },
          // A new key re-files the cards, so they slide in again.
          h("div", { className: "dd-drawer-stack", key: (live || "top") + "|" + query, style: { height: PAD + Math.max(0, n - 1) * S + T + S + FACE } },
            width > 0 && cards.map(renderCard)),
          sections.length === 0 && h("p", { className: "dd-drawer-empty" }, t("No sections yet. Draw one on the board with Shift+S.", "هنوز سکشنی نداری. با Shift+S روی برد یکی بکش.")),
          query && n === 1 && sections.length > 0 && h("p", { className: "dd-drawer-empty" }, t("No section matches.", "سکشنی پیدا نشد.")))),
      h("div", { className: "dd-drawer-front" },
        h("svg", { className: "dd-drawer-front-art", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": true },
          // A phone shows the front flat, without the lip or the tilt.
          phone ? h("path", { d: "M0,0 H100 V100 H0 Z" }) : h(R.Fragment, null, h("path", { d: "M0,0 H100 V16 H0 Z" }), h("path", { d: "M1,16 L99,16 L95,100 L5,100 Z" }))),
        h("div", { className: "dd-drawer-front-row" },
          h("nav", { className: "dd-drawer-path", "aria-label": t("Folder path", "مسیر پوشه") },
            h("button", { type: "button", "data-drawer-crumb": "top", "aria-current": !live && !query ? "location" : undefined, onClick: () => openFolder("") }, t("Main board", "برد اصلی")),
            trail.map((s, i) => h(R.Fragment, { key: s.id },
              h("span", { className: "dd-drawer-sep", "aria-hidden": true }, "›"),
              h("button", { type: "button", dir: "auto", "data-drawer-crumb": s.id, "aria-current": i === trail.length - 1 && !query ? "location" : undefined, onClick: () => openFolder(s.id) }, name(s)))),
            live && !query && h("button", { type: "button", className: "dd-drawer-enter-folder", "data-drawer-open": live, title: t("Open this section's board", "باز کردن برد این سکشن"), onClick: () => onEnter(live) }, "↗ " + t("Open", "باز کن"))),
          h("label", { className: "dd-drawer-find" },
            h("span", { "aria-hidden": true }, "⌕"),
            h("input", {
              type: "search",
              value: query,
              dir: "auto",
              placeholder: t("Find a section…", "پیدا کردن سکشن…"),
              "aria-label": t("Find a section", "پیدا کردن سکشن"),
              onChange: (event) => setQuery(event.target.value),
            })),
          h("div", { className: "dd-drawer-tools" },
            onList && h("button", { type: "button", "data-drawer-list": true, title: t("The plain list, with Life area size and layout", "فهرست ساده، با اندازه و چیدمان محدودهٔ زندگی"), onClick: onList }, "☰ " + t("List", "فهرست")),
            h("button", { type: "button", className: "dd-drawer-close", "aria-label": t("Close drawer", "بستن کشو"), onClick: onClose }, h("kbd", null, "D"), " ", t("Close", "بستن")))),
        h("div", { className: "dd-drawer-label", dir: "auto" }, label)),
      paletteFor && h("div", {
          className: "dd-drawer-palette",
          role: "group",
          "aria-label": t("Color for ", "رنگ برای ") + name(paletteFor),
          style: { left: palette.x, top: palette.y },
        },
        DDsectionPalette.map((color, i) => h("button", {
          key: color,
          type: "button",
          "data-color": color,
          "aria-pressed": current?.fill === color,
          "aria-label": PALETTE_NAMES[i][fa ? 1 : 0],
          title: PALETTE_NAMES[i][fa ? 1 : 0],
          style: { background: color },
          onClick: () => { onColor?.(paletteFor.id, color); setPalette(null); },
        })))));
}

export const DDdrawerCSS = `
:root{--panel-sections:#8A6E4B}[data-panel="sections"]{--pc:var(--panel-sections)}
.dd-drawer-backdrop{position:absolute;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;padding:0 24px;background:rgba(18,18,17,.42);animation:dd-drawer-dim .18s ease-out}
.b2:has(.dd-drawer-backdrop) .b2-top{z-index:52}
@keyframes dd-drawer-dim{from{opacity:0}to{opacity:1}}
@keyframes dd-drawer-up{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}
@keyframes dd-drawer-file{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}
.dd-drawer{--dd-line:var(--ink,#121211);position:relative;width:min(940px,100%);max-height:calc(100% - 78px);display:flex;flex-direction:column;color:var(--ink,#121211);font:13px/1.3 var(--sans,system-ui);animation:dd-drawer-up .22s cubic-bezier(.2,.8,.2,1)}
.dd-drawer *{box-sizing:border-box}
.dd-drawer-well{position:relative;flex:0 1 auto;min-height:0;display:flex;flex-direction:column;padding:0 18px}
.dd-drawer-sides{position:absolute;inset:0 0 -2px;width:100%;height:100%;pointer-events:none;overflow:visible}
.dd-drawer-sides line{stroke:var(--dd-line);stroke-width:1.5;vector-effect:non-scaling-stroke}
.dd-drawer-files{position:relative;flex:0 1 auto;min-height:110px;max-height:min(56vh,560px);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;overscroll-behavior:contain}
.dd-drawer-stack{position:relative;min-height:110px;overflow:hidden}
.dd-drawer-card{position:absolute;pointer-events:none;transition:transform .15s ease-out;animation:dd-drawer-file .24s ease-out backwards}
.dd-drawer-card-art{position:absolute;inset:0;overflow:visible;pointer-events:none}
.dd-drawer-card-body{fill:var(--paper,#fff)}
.dd-drawer-card-line{fill:none;stroke:var(--dd-line);stroke-width:1.5;stroke-linejoin:round}
.dd-drawer-tab{position:absolute;top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 6px;border:0;background:transparent;font:500 13px/1 var(--sans,system-ui);cursor:pointer;pointer-events:auto;border-radius:6px;min-width:0}
.dd-drawer-tab:focus-visible{outline:2px solid var(--now,#7A5FF5);outline-offset:-2px}
.dd-drawer-num,.dd-drawer-roman{flex:none;font:600 12px/1 var(--mono,ui-monospace,monospace);letter-spacing:.04em}
.dd-drawer-name{flex:1;min-width:0;text-align:end;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-drawer-card[data-kind=divider] .dd-drawer-num{font-size:13px}
.dd-drawer-strip{position:absolute;pointer-events:auto;cursor:pointer}
.dd-drawer-meta{position:absolute;top:5px;font-size:11.5px;color:var(--ink-2,#52515a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.dd-drawer-card[data-kind=divider] .dd-drawer-meta{color:var(--ink,#121211);font-weight:600}
.dd-drawer-open{position:absolute;pointer-events:auto;width:26px;height:22px;padding:0;border:1px solid var(--dd-line);border-radius:6px;background:var(--paper,#fff);color:var(--ink,#121211);font-size:13px;line-height:1;cursor:pointer;opacity:0;transition:opacity .15s}
.dd-drawer-card:hover .dd-drawer-open,.dd-drawer-card:focus-within .dd-drawer-open{opacity:1}
.dd-drawer-preview-slot{position:absolute;pointer-events:none;opacity:0;transition:opacity .15s}
.dd-drawer-preview{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ink,#121211)}
.dd-drawer-preview small{color:var(--ink-2,#52515a);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-drawer-preview-counts{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.dd-drawer-preview-tasks{color:var(--ink-2,#52515a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (hover:hover){.dd-drawer-card:hover{transform:translateY(-10px);z-index:999!important}.dd-drawer-card:hover .dd-drawer-preview-slot{opacity:1}}
.dd-drawer-card:has(.dd-drawer-tab:focus-visible){transform:translateY(-10px);z-index:998!important}
.dd-drawer-card:has(.dd-drawer-tab:focus-visible) .dd-drawer-preview-slot{opacity:1}
.dd-drawer-empty{position:absolute;inset:auto 0 70px;margin:0;text-align:center;color:var(--ink-2,#52515a)}
.dd-drawer-front{position:relative;flex:none;z-index:1000;min-height:124px;padding:22px 7% 14px;display:flex;flex-direction:column;align-items:center;gap:12px}
.dd-drawer-front-art{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.dd-drawer-front-art path{fill:var(--paper,#fff);stroke:var(--dd-line);stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.dd-drawer-front-row{position:relative;width:100%;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dd-drawer-path{display:flex;align-items:center;flex-wrap:wrap;gap:2px;min-width:0;flex:1 1 260px}
.dd-drawer-path button,.dd-drawer-tools button{min-height:30px;padding:3px 8px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;cursor:pointer;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-drawer-path button:hover,.dd-drawer-tools button:hover{background:var(--wash,#0000000d)}
.dd-drawer-path [aria-current]{font-weight:650}
.dd-drawer-path .dd-drawer-enter-folder{margin-inline-start:6px;border:1px solid var(--dd-line)}
.dd-drawer-sep{opacity:.5}
.dd-drawer-find{display:flex;align-items:center;gap:6px;flex:0 1 230px;min-width:150px;height:32px;padding:0 10px;border:1.5px solid var(--dd-line);border-radius:999px;background:var(--paper,#fff)}
.dd-drawer-find input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink,#121211);font:inherit;outline:none}
.dd-drawer-find:focus-within{box-shadow:0 0 0 3px color-mix(in srgb,var(--now,#7A5FF5) 30%,transparent)}
.dd-drawer-tools{display:flex;align-items:center;gap:4px}
.dd-drawer-close kbd{font:600 11px/1 var(--mono,monospace);padding:2px 5px;border-radius:4px;border:1px solid var(--rule-2,#0002)}
.dd-drawer-label{position:relative;padding:5px 16px;border:1.5px solid #121211;border-radius:9px;background:#FFF27A;color:#121211;font:600 14px/1.2 var(--sans,system-ui);max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-drawer-palette{position:absolute;z-index:1100;display:grid;grid-template-columns:repeat(5,32px);gap:6px;padding:9px;border:1.5px solid var(--dd-line);border-radius:12px;background:var(--paper,#fff);box-shadow:0 10px 30px #0003}
.dd-drawer-palette button{width:32px;height:32px;padding:0;border:1.5px solid color-mix(in srgb,var(--ink,#121211) 45%,transparent);border-radius:50%;cursor:pointer}
.dd-drawer-palette button[aria-pressed=true]{outline:2px solid var(--now,#7A5FF5);outline-offset:2px}
.dd-drawer.is-phone{width:100%;max-height:calc(100% - 118px)}
.dd-drawer-backdrop:has(.is-phone){padding:0}
.dd-drawer.is-phone .dd-drawer-well{padding:0;background:var(--paper,#fff);border-radius:16px 16px 0 0;border:1.5px solid var(--dd-line);border-bottom:0}
.dd-drawer.is-phone .dd-drawer-files{max-height:none;padding:0 6px}
.dd-drawer.is-phone .dd-drawer-tab{font-size:14px}
.dd-drawer.is-phone .dd-drawer-open{opacity:1;height:44px}.dd-drawer.is-phone .dd-drawer-meta{top:9px;font-size:12px}
.dd-drawer.is-phone .dd-drawer-front{padding:18px 12px 12px;gap:8px;min-height:0}
.dd-drawer.is-phone .dd-drawer-find{flex:1 1 100%;height:44px}
.dd-drawer.is-phone .dd-drawer-path button,.dd-drawer.is-phone .dd-drawer-tools button{min-height:44px}
.dd-drawer.is-phone .dd-drawer-palette{grid-template-columns:repeat(5,40px)}
.dd-drawer.is-phone .dd-drawer-palette button{width:40px;height:40px}
@media (prefers-reduced-motion:reduce){.dd-drawer-backdrop,.dd-drawer,.dd-drawer-card{animation:none}.dd-drawer-card,.dd-drawer-open,.dd-drawer-preview-slot{transition:none}}
`;

export function DDinstallDrawerStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-drawer-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-drawer-css", textContent: DDdrawerCSS }));
}
