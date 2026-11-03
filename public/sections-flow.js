// The Sections flowchart, like After Effects' Tab flowchart: Main board on the
// left, its sections branching to the right, and theirs further right. The board
// you are in is blue, and so is the way to it. Click a section to go into its
// board. It only reads setup.life, so a rename, a move or a new color shows here
// and on the board at once.
import { DDlifePath, DDlifeDescendants, DDsectionTint, DDsectionPath, DDsectionPalette } from "./life-board.js";
import { DDsearchBoardText } from "./board-experience.js";

// Ask the Board to open the flowchart. The request waits until a Board is on
// screen (Ctrl+Space can ask from Plan or Calendar), like the Engine's bus.
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
const estimate = (text) => [...String(text)].length * 7.4;

// Where every box and line of the flowchart goes. Columns are levels: Main board,
// then top sections, then the sections inside them. Each section sits in the
// middle of its children; a section with none takes the next row. A folded
// section hides what is inside it (a search opens the folds it needs).
// `quiet` sections (the Engine's own, 5.37) leave the main tree and come last,
// in one folded group; it opens when asked, when a search finds one of them, or
// when you are inside one.
export function DDsectionsFlow(items = [], { folded = [], room = "", query = "", measure = estimate, phone = false, rtl = false, mainLabel = "Main board", quiet = [], quietOpen = false } = {}) {
  const ROW = phone ? 56 : 42, H = phone ? 44 : 30, GAP = phone ? 64 : 78, PAD = phone ? 16 : 22,
    sections = items.filter((i) => i.type === "section"),
    ids = new Set(sections.map((s) => s.id)),
    quietIds = new Set([...quiet].filter((id) => sections.some((s) => s.id === id && !s.parent))),
    quietAll = new Set([...quietIds].flatMap((id) => [...DDlifeDescendants(items, id)])),
    kids = (parent) => sections.filter((s) => (s.parent || "") === parent && !(parent === "" && quietIds.has(s.id))).sort(byBoard),
    notes = (id) => items.filter((i) => i.type === "sticky" && (i.parent || "") === id).length,
    inside = (id) => kids(id).reduce((n, k) => n + 1 + inside(k.id), 0),
    words = DDsearchBoardText(query).split(" ").filter(Boolean),
    hits = new Set(),
    open = new Set();
  if (words.length)
    for (const s of sections) {
      const path = DDlifePath(items, s.id).filter((i) => i.type === "section");
      if (!words.every((w) => DDsearchBoardText(path.map((i) => i.text || "").join(" ")).includes(w))) continue;
      hits.add(s.id);
      path.slice(0, -1).forEach((i) => open.add(i.id));
    }
  const closed = new Set(folded.filter((id) => ids.has(id) && !open.has(id))),
    here = room && ids.has(room) ? room : "",
    trail = new Set(["", ...DDlifePath(items, here).map((i) => i.id)]),
    nodes = [],
    links = [],
    widths = [];
  let row = 0;
  const place = (id, depth, seen) => {
    const s = id ? sections.find((x) => x.id === id) : null,
      name = id ? String(s.text || "").trim() : mainLabel,
      count = notes(id),
      all = kids(id).filter((k) => !seen.has(k.id)),
      shut = !!id && all.length > 0 && closed.has(id),
      node = {
        id, parent: id ? s.parent || "" : null, depth, name, notes: count, children: all.length, folded: shut, quiet: quietAll.has(id),
        hidden: shut ? inside(id) : 0, here: id === here, trail: trail.has(id), found: hits.has(id), dim: words.length > 0 && !hits.has(id),
        w: Math.round(Math.max(phone ? 96 : 84, Math.min(240, 50 + measure(name || " ", depth) + (count ? 22 : 0)))), h: H,
      };
    nodes.push(node);
    widths[depth] = Math.max(widths[depth] || 0, node.w);
    if (shut || !all.length) node.y = PAD + row++ * ROW;
    else {
      const placed = all.map((k) => { seen.add(k.id); links.push({ from: id, to: k.id, trail: trail.has(k.id) }); return place(k.id, depth + 1, seen); });
      node.y = (placed[0].y + placed[placed.length - 1].y) / 2;
    }
    return node;
  };
  place("", 0, new Set());
  let group = null;
  if (quietIds.size) {
    const open = quietOpen || [...quietAll].some((id) => hits.has(id)) || quietAll.has(here);
    group = { count: quietIds.size, open, y: PAD + row++ * ROW, h: H, names: sections.filter((s) => quietIds.has(s.id)).sort(byBoard).map((s) => String(s.text || "").trim()) };
    if (open) for (const s of sections.filter((s) => quietIds.has(s.id)).sort(byBoard)) place(s.id, 1, new Set([s.id]));
  }
  const left = [];
  widths.forEach((w, d) => (left[d] = d ? left[d - 1] + widths[d - 1] + GAP : PAD));
  const width = left[widths.length - 1] + widths[widths.length - 1] + PAD + 44,
    height = PAD * 2 + (row - 1) * ROW + H;
  for (const node of nodes) node.x = rtl ? width - left[node.depth] - node.w : left[node.depth];
  return { nodes, links, width, height, row: ROW, gap: GAP, pad: PAD, group };
}

// The curve from a section to one inside it, with its arrowhead pointing back
// to the parent like After Effects. In Persian the flowchart runs right to left.
export function DDflowCurve(from, to, { rtl = false, lead = 18 } = {}) {
  const sign = rtl ? -1 : 1,
    x1 = rtl ? from.x - lead : from.x + from.w + lead, y1 = from.y + from.h / 2,
    x2 = rtl ? to.x + to.w : to.x, y2 = to.y + to.h / 2,
    k = Math.abs(x2 - x1) * 0.5,
    c1 = x1 + sign * k, c2 = x2 - sign * k,
    at = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d,
    mx = at(0.5, x1, c1, c2, x2), my = at(0.5, y1, y1, y2, y2),
    // The tangent there, turned around so the arrow points at the parent.
    dx = -(0.75 * (c1 - x1) + 1.5 * (c2 - c1) + 0.75 * (x2 - c2)),
    dy = -(1.5 * (y2 - y1)),
    len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, s = 5;
  return {
    d: `M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`,
    arrow: `M${mx + ux * s},${my + uy * s} L${mx - ux * s - uy * s * 0.8},${my - uy * s + ux * s * 0.8} L${mx - ux * s + uy * s * 0.8},${my - uy * s - ux * s * 0.8} Z`,
    start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, mid: { x: mx, y: my }, point: { x: ux, y: uy },
  };
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
// The Engine's group starts folded; opening it is remembered on this device.
const QUIET_KEY = "debug-day:sections-engine-open";
function readQuietOpen() {
  try { return localStorage.getItem(QUIET_KEY) === "1"; } catch { return false; }
}
const fullHex = (color) => {
  const v = String(color || "").replace("#", "");
  return "#" + (v.length <= 4 ? [...v.slice(0, 3)].map((c) => c + c).join("") : v.slice(0, 6)).toLowerCase();
};
let measureCanvas = null;
function textWidth(text, phone) {
  try {
    measureCanvas ||= document.createElement("canvas").getContext("2d");
    const family = getComputedStyle(document.documentElement).getPropertyValue("--sans").trim() || getComputedStyle(document.body).fontFamily || "system-ui";
    measureCanvas.font = (phone ? "500 15px " : "500 13px ") + family;
    return measureCanvas.measureText(String(text)).width;
  } catch { return estimate(text); }
}

export function DDSectionsFlowchart({ React: R, items = [], room = null, language, frame = null, quiet = [], onShow, onEnter, onColor, onClose, onEnlarge, onSize, onCompact }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, f) => (fa ? f : en),
    num = (n) => Number(n).toLocaleString(fa ? "fa-IR" : "en-US"),
    phoneQuery = () => !!globalThis.matchMedia?.("(max-width: 700px)").matches,
    [phone, setPhone] = R.useState(phoneQuery),
    [query, setQuery] = R.useState(""),
    [folded, setFolded] = R.useState(readFolded),
    [quietOpen, setQuietOpen] = R.useState(readQuietOpen),
    [focus, setFocus] = R.useState(null),
    [hot, setHot] = R.useState(null),
    [menu, setMenu] = R.useState(null),
    [draft, setDraft] = R.useState(null),
    [tools, setTools] = R.useState(false),
    [, setTick] = R.useState(0),
    root = R.useRef(null),
    backdrop = R.useRef(null),
    canvas = R.useRef(null),
    wantFocus = R.useRef(null),
    press = R.useRef({ timer: null, long: false }),
    sections = items.filter((i) => i.type === "section"),
    here = room && sections.some((s) => s.id === room) ? room : "",
    flow = DDsectionsFlow(items, { folded, room: here, query, phone, rtl: fa, mainLabel: t("Main board", "برد اصلی"), measure: (text) => textWidth(text, phone), quiet, quietOpen }),
    byId = new Map(flow.nodes.map((n) => [n.id, n])),
    active = byId.has(focus) ? focus : here,
    hotTrail = new Set(hot !== null && byId.has(hot) ? ["", ...DDlifePath(items, hot).map((i) => i.id)] : []),
    found = flow.nodes.filter((n) => n.found);

  R.useEffect(() => {
    const media = globalThis.matchMedia?.("(max-width: 700px)"), change = () => setPhone(phoneQuery());
    media?.addEventListener?.("change", change);
    const previous = document.activeElement;
    focusNode(here);
    return () => { clearTimeout(press.current.timer); media?.removeEventListener?.("change", change); if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);
  R.useEffect(() => {
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(folded)); } catch {}
  }, [folded]);
  R.useEffect(() => {
    try { localStorage.setItem(QUIET_KEY, quietOpen ? "1" : "0"); } catch {}
  }, [quietOpen]);
  // The board you are in is never folded away.
  R.useEffect(() => {
    if (!here) return;
    const above = new Set(DDlifePath(items, here).slice(0, -1).map((i) => i.id));
    setFolded((list) => (list.some((id) => above.has(id)) ? list.filter((id) => !above.has(id)) : list));
  }, [here]);
  // On a desktop it comes up just below the board's toolbar and the "where you are" bar.
  R.useLayoutEffect(() => {
    const el = backdrop.current, header = el?.closest(".b2")?.querySelector(".b2-top");
    if (!el || !header || phone) { if (el) el.style.paddingTop = ""; return; }
    const update = () => {
      const bottom = Math.max(header.getBoundingClientRect().bottom, ...[...header.children].map((c) => c.getBoundingClientRect().bottom));
      el.style.paddingTop = Math.max(16, Math.ceil(bottom - el.getBoundingClientRect().top + 10)) + "px";
    }, observer = new ResizeObserver(update);
    observer.observe(header);
    for (const child of header.children) observer.observe(child);
    update();
    return () => observer.disconnect();
  }, [phone, room]);
  R.useLayoutEffect(() => {
    const id = wantFocus.current;
    if (id === null) return;
    wantFocus.current = null;
    const el = root.current?.querySelector(`[data-flow-node="${CSS.escape(id)}"] .dd-flow-pill`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  });

  function focusNode(id) {
    if (id === undefined || id === null) return;
    setFocus(id);
    wantFocus.current = id;
    setTick((n) => n + 1);
  }
  function go(id) {
    onEnter?.(id || null);
    onClose?.();
  }
  function show(id) {
    if (!id) return go("");
    onShow?.(id);
    onClose?.();
  }
  function setFold(id, open) {
    setFolded((list) => (open ? list.filter((x) => x !== id) : list.includes(id) ? list : [...list, id]));
  }
  function pick(id, color) {
    onColor?.(id, color);
    setMenu(null);
    setDraft(null);
    focusNode(id);
  }
  function openMenu(id) {
    setMenu(id);
    setDraft(null);
    requestAnimationFrame(() => {
      const first = root.current?.querySelector(".dd-flow-menu button");
      first?.focus({ preventScroll: true });
      first?.parentElement.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
  }
  // Up and down stay in the same column; the arrows across follow the lines.
  function neighbour(node, step) {
    const column = flow.nodes.filter((n) => n.depth === node.depth).sort((a, b) => a.y - b.y);
    return column[column.indexOf(node) + step]?.id;
  }
  function keyDown(event) {
    const typing = event.target.closest?.("input"),
      el = event.target.closest?.("[data-flow-node]"),
      node = el ? byId.get(el.dataset.flowNode) : null;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (menu !== null) { const id = menu; setMenu(null); setDraft(null); return focusNode(id); }
      if (tools) { setTools(false); return root.current?.querySelector("[data-life-tools]")?.focus(); }
      if (query) { setQuery(""); return; }
      return onClose?.();
    }
    if (typing) {
      if (typing.type !== "search") return;
      if (event.key === "ArrowDown") { event.preventDefault(); focusNode((found[0] || byId.get(here) || flow.nodes[0]).id); }
      else if (event.key === "Enter") { event.preventDefault(); const first = found[0]; if (first) event.shiftKey ? show(first.id) : go(first.id); }
      return;
    }
    // The Engine's row: up goes back to the Main board, down into the group.
    if (event.target.closest?.("[data-flow-group]")) {
      if (event.key === "ArrowUp") { event.preventDefault(); focusNode(""); }
      else if (event.key === "ArrowDown") { event.preventDefault(); const first = flow.nodes.find((n) => n.quiet && n.depth === 1); first ? focusNode(first.id) : setQuietOpen(true); }
      else if (event.key === "Tab" && !event.shiftKey) { event.preventDefault(); onClose?.(); }
      return;
    }
    if (!node || event.target.closest(".dd-flow-menu")) return;
    const forward = fa ? "ArrowLeft" : "ArrowRight", back = fa ? "ArrowRight" : "ArrowLeft";
    let handled = true;
    if (event.key === "ArrowDown" && !node.id && flow.group) root.current?.querySelector("[data-flow-group]")?.focus();
    else if (event.key === "ArrowDown") focusNode(neighbour(node, 1));
    else if (event.key === "ArrowUp") focusNode(neighbour(node, -1));
    else if (event.key === forward) {
      if (node.folded) setFold(node.id, true);
      else if (node.children) focusNode(flow.links.find((l) => l.from === node.id)?.to);
    } else if (event.key === back) {
      if (node.children && !node.folded && node.id && !query.trim()) setFold(node.id, false);
      else if (node.parent !== null) focusNode(node.parent);
    } else if (event.key === "Home") focusNode("");
    else if (event.key === "Enter") event.shiftKey ? show(node.id) : go(node.id);
    else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) node.id ? openMenu(node.id) : (handled = false);
    else if (event.key === "Tab" && !event.shiftKey) onClose?.(); // Tab again closes it, like After Effects.
    else if (!event.shiftKey && (event.key === "d" || event.key === "D" || event.code === "KeyD")) onClose?.();
    else if (event.key === "/") root.current?.querySelector(".dd-flow-find input")?.focus();
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Typing a name starts a search.
      setQuery((q) => q + event.key);
      root.current?.querySelector(".dd-flow-find input")?.focus();
    } else handled = false;
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
  // The menu opens below a section, or above it near the bottom; the stage grows if neither fits.
  const MENU_H = phone ? 300 : 222;
  function menuTop(node) {
    const below = node.y + node.h + 6, above = node.y - 6 - MENU_H;
    return below + MENU_H <= flow.height || above < 0 ? below : above;
  }
  function colorMenu(node) {
    const tint = DDsectionTint(items, node.id), current = (tint.own ? tint.fill : "").toUpperCase(),
      sub = !!sections.find((s) => s.id === node.id)?.parent,
      custom = draft?.id === node.id ? draft.color : fullHex(tint.fill),
      x = fa ? node.x + node.w - 236 : node.x, y = menuTop(node);
    return h("div", {
        className: "dd-flow-menu",
        role: "menu",
        "aria-label": node.name || t("Section", "سکشن"),
        style: { left: Math.max(4, Math.min(flow.width - 240, x)), top: y },
        onPointerDown: (event) => event.stopPropagation(),
      },
      h("button", { type: "button", role: "menuitem", "data-flow-open": node.id, onClick: () => go(node.id) }, "↗ " + t("Open its board", "باز کردن برد سکشن")),
      h("button", { type: "button", role: "menuitem", "data-flow-show": node.id, onClick: () => show(node.id) }, "◎ " + t("Show on the board", "نشان دادن روی برد")),
      h("div", { className: "dd-flow-colors", role: "group", "aria-label": t("Color", "رنگ") },
        DDsectionPalette.map((color, i) => h("button", {
          key: color,
          type: "button",
          role: "menuitemradio",
          "data-color": color,
          "aria-checked": current === color,
          "aria-label": PALETTE_NAMES[i][fa ? 1 : 0],
          title: PALETTE_NAMES[i][fa ? 1 : 0],
          style: { background: color },
          onClick: () => pick(node.id, color),
        }))),
      h("div", { className: "dd-flow-color-row" },
        h("label", { className: "dd-flow-custom", title: t("Any color you like", "هر رنگی که دوست داری") },
          h("input", {
            type: "color",
            value: custom,
            "data-custom-color": node.id,
            "aria-label": t("Custom color", "رنگ دلخواه"),
            onInput: (event) => setDraft({ id: node.id, color: event.target.value }),
            onChange: (event) => setDraft({ id: node.id, color: event.target.value }),
            // The picker reports every step while you drag; save once, when it closes.
            ref: (el) => {
              if (!el || el.dataset.ready) return;
              el.dataset.ready = "1";
              el.addEventListener("change", () => pick(node.id, el.value.toUpperCase()));
            },
          }),
          h("span", null, t("Custom", "دلخواه"))),
        sub && h("button", {
          type: "button",
          className: "dd-flow-shade",
          "data-family-shade": node.id,
          "aria-pressed": !tint.own,
          title: t("A shade of its top section's color", "سایه‌ای از رنگ سکشن بالایی"),
          onClick: () => pick(node.id, null),
        }, t("Family shade", "سایهٔ خانواده"))));
  }
  function renderNode(node) {
    const tint = node.id ? DDsectionTint(items, node.id) : null,
      fill = draft?.id === node.id ? draft.color : tint?.fill,
      label = node.id ? node.name || t("Section", "سکشن") : node.name,
      path = node.id ? DDsectionPath(items, node.id, 80, t("Section", "سکشن")).full : label,
      lit = hotTrail.has(node.id),
      notes = node.notes ? t(node.notes === 1 ? " · 1 note" : ` · ${node.notes} notes`, ` · ${num(node.notes)} یادداشت`) : "",
      inside = node.children ? t(` · ${node.children} inside`, ` · ${num(node.children)} سکشن داخلش`) : "",
      fold = node.children > 0 && node.id,
      endX = fa ? -18 : node.w + 2;
    return h("div", {
        key: node.id || "main",
        className: "dd-flow-node" + (node.here ? " is-here" : "") + (node.trail ? " is-trail" : "") + (lit ? " is-lit" : "") + (node.dim ? " is-dim" : "") + (node.found ? " is-found" : "") + (node.quiet ? " is-quiet" : ""),
        "data-flow-node": node.id,
        "data-depth": node.depth,
        style: { left: node.x, top: node.y, width: node.w, height: node.h },
        onPointerEnter: () => setHot(node.id),
        onPointerLeave: () => setHot((v) => (v === node.id ? null : v)),
      },
      h("button", {
          type: "button",
          className: "dd-flow-pill",
          tabIndex: node.id === active ? 0 : -1,
          title: path + notes + (node.id ? t(" · Shift+click shows it on the board · right-click for color", " · Shift+کلیک: نشان دادن روی برد · کلیک راست: رنگ") : ""),
          "aria-label": path + notes + inside,
          "aria-current": node.here ? "location" : undefined,
          "aria-expanded": fold ? !node.folded : undefined,
          "aria-haspopup": node.id ? "menu" : undefined,
          onFocus: () => { setFocus(node.id); setHot(node.id); },
          onBlur: () => setHot((v) => (v === node.id ? null : v)),
          onPointerDown: (event) => {
            press.current.long = false;
            clearTimeout(press.current.timer);
            if (node.id && event.pointerType === "touch") press.current.timer = setTimeout(() => { press.current.long = true; openMenu(node.id); }, 480);
          },
          onPointerUp: () => clearTimeout(press.current.timer),
          onPointerLeave: () => clearTimeout(press.current.timer),
          onPointerCancel: () => clearTimeout(press.current.timer),
          onContextMenu: (event) => { if (!node.id) return; event.preventDefault(); clearTimeout(press.current.timer); openMenu(node.id); },
          onClick: (event) => {
            if (press.current.long) return (press.current.long = false);
            event.shiftKey ? show(node.id) : go(node.id);
          },
        },
        node.id
          ? h("span", { className: "dd-flow-dot", style: { background: fill, borderColor: tint.line } })
          : h("span", { className: "dd-flow-board", "aria-hidden": true }),
        h("bdi", { className: "dd-flow-label" }, node.id ? marked(label) : label),
        node.notes > 0 && h("span", { className: "dd-flow-notes", "aria-hidden": true }, num(node.notes))),
      fold
        ? h("button", {
            type: "button",
            className: "dd-flow-fold",
            tabIndex: -1,
            "data-flow-fold": node.id,
            "aria-label": (node.folded ? t("Unfold ", "باز کردن ") : t("Fold ", "جمع کردن ")) + label,
            title: node.folded ? t(`${node.hidden} folded inside`, `${num(node.hidden)} سکشن جمع شده`) : t("Fold", "جمع کردن"),
            disabled: !!query.trim(),
            style: { [fa ? "right" : "left"]: node.w + 1 },
            onClick: () => setFold(node.id, node.folded),
          }, node.folded ? "+" : "−")
        : h("span", { className: "dd-flow-end", "aria-hidden": true, style: { left: endX } }),
      node.folded && h("span", { className: "dd-flow-hidden", "aria-hidden": true, style: { [fa ? "right" : "left"]: node.w + (phone ? 30 : 22) } }, "+" + num(node.hidden)));
  }

  // The Engine's own sections, last and quiet: one folded row that names them.
  function groupRow(group) {
    const names = group.names.map((n) => n || t("Section", "سکشن")).join(", "),
      label = t("Engine", "انجین") + " · " + num(group.count);
    return h("button", {
        type: "button",
        className: "dd-flow-group",
        "data-flow-group": true,
        "aria-expanded": group.open,
        "aria-label": t("Engine sections: ", "سکشن‌های انجین: ") + names,
        title: group.open ? t("Fold the Engine's sections", "جمع کردن سکشن‌های انجین") : t("The Engine's own sections: ", "سکشن‌های خود انجین: ") + names,
        disabled: !!query.trim() && group.open && !quietOpen,
        style: { top: group.y, height: group.h, [fa ? "right" : "left"]: flow.pad, maxWidth: `calc(100% - ${flow.pad * 2}px)` },
        onClick: () => setQuietOpen(!group.open),
      },
      h("span", { className: "dd-flow-group-icon", "aria-hidden": true }, "⚙"),
      h("span", { className: "dd-flow-group-label" }, label),
      !group.open && h("bdi", { className: "dd-flow-group-names" }, names),
      h("span", { className: "dd-flow-group-fold", "aria-hidden": true }, group.open ? "▾" : fa ? "◂" : "▸"));
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
      "aria-label": key === "w" ? t("Feed width", "عرض فید") : t("Feed height", "ارتفاع فید"),
      onBlur: (event) => {
        const value = Number(event.target.value);
        if (event.target.value && Number.isFinite(value) && value >= 240 && value <= 100000) onSize?.({ [key]: value });
        else event.target.value = Math.round(frame?.[key] || 240);
      },
      onKeyDown: (event) => { if (event.key === "Enter") event.currentTarget.blur(); },
    }));
  const menuNode = menu !== null ? byId.get(menu) : null;
  const panel = h("section", {
      className: "dd-flow" + (phone ? " is-phone" : ""),
      role: "dialog",
      "aria-label": t("Sections flowchart", "فلوچارت سکشن‌ها"),
      "data-panel": "sections",
      dir: fa ? "rtl" : "ltr",
      ref: root,
      onKeyDown: keyDown,
      onPointerDown: (event) => { event.stopPropagation(); if (menu !== null && !event.target.closest(".dd-flow-menu")) setMenu(null); },
      onWheel: (event) => event.stopPropagation(),
    },
    phone && h("div", { className: "dd-flow-grab", "aria-hidden": true }),
    h("header", { className: "dd-flow-head" },
      h("strong", null, t("Sections", "سکشن‌ها")),
      h("span", { className: "dd-flow-count" }, query.trim() ? t(`${found.length} of ${sections.length}`, `${num(found.length)} از ${num(sections.length)}`) : num(sections.length)),
      h("label", { className: "dd-flow-find" },
        h("span", { "aria-hidden": true }, "⌕"),
        h("input", {
          type: "search",
          value: query,
          dir: "auto",
          placeholder: t("Find a section…", "پیدا کردن سکشن…"),
          "aria-label": t("Find a section", "پیدا کردن سکشن"),
          onChange: (event) => setQuery(event.target.value),
        })),
      h("button", { type: "button", className: "dd-flow-tools-button", "data-life-tools": true, "aria-expanded": tools, "aria-label": t("Feed size & layout", "اندازه و چیدمان فید"), title: t("Feed size & layout", "اندازه و چیدمان فید"), onClick: () => setTools((v) => !v) }, h("span", { "aria-hidden": true })),
      h("button", { type: "button", className: "dd-flow-close", "aria-label": t("Close the flowchart", "بستن فلوچارت"), title: t("Close (Tab or Esc)", "بستن (Tab یا Esc)"), onClick: onClose }, "×")),
    tools && h("div", { className: "dd-flow-tools" },
      h("button", { type: "button", onClick: onEnlarge }, t("Enlarge Feed +25%", "بزرگ‌تر کردن فید +۲۵٪")),
      h("div", { className: "dd-life-dimensions" }, ["w", "h"].map(sizeInput)),
      h("button", { type: "button", onClick: onCompact }, t("Compact layout", "جمع‌وجور کن"))),
    h("div", { className: "dd-flow-canvas", ref: canvas },
      h("div", { className: "dd-flow-stage", role: "group", "aria-label": t("Sections", "سکشن‌ها"), style: { width: flow.width, height: menuNode?.id ? Math.max(flow.height, menuTop(menuNode) + MENU_H + 8) : flow.height } },
        h("svg", { className: "dd-flow-lines", width: flow.width, height: flow.height, viewBox: `0 0 ${flow.width} ${flow.height}`, "aria-hidden": true },
          flow.links.map((link) => {
            const curve = DDflowCurve(byId.get(link.from), byId.get(link.to), { rtl: fa, lead: phone ? 28 : 18 }),
              cls = "dd-flow-link" + (link.trail ? " is-trail" : "") + (hotTrail.has(link.to) ? " is-lit" : "") + (byId.get(link.to).dim ? " is-dim" : "");
            return h("g", { key: link.from + ">" + link.to, className: cls, "data-flow-link": link.from + ">" + link.to },
              h("path", { className: "dd-flow-curve", d: curve.d }),
              h("path", { className: "dd-flow-arrow", d: curve.arrow }));
          })),
        flow.nodes.map(renderNode),
        flow.group && groupRow(flow.group),
        menuNode && menuNode.id && colorMenu(menuNode))),
    sections.length === 0 && h("p", { className: "dd-flow-empty" }, t("No sections yet. Draw one on the board with Shift+S.", "هنوز سکشنی نداری. با Shift+S روی برد یکی بکش.")),
    query.trim() && !found.length && sections.length > 0 && h("p", { className: "dd-flow-empty" }, t("No section matches.", "سکشنی پیدا نشد.")),
    !phone && h("p", { className: "dd-flow-hint" }, t("Click to go in · Shift+click shows it on the board · right-click for color · Tab closes", "کلیک: ورود · Shift+کلیک: نشان دادن روی برد · کلیک راست: رنگ · Tab: بستن")));
  return h("div", {
      className: "dd-flow-backdrop" + (phone ? " is-phone" : ""),
      ref: backdrop,
      onPointerDown: (event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose?.(); },
      onWheel: (event) => event.stopPropagation(),
    }, panel);
}

export const DDsectionsFlowCSS = `
:root{--panel-sections:#8A6E4B}[data-panel="sections"]{--pc:var(--panel-sections)}
.dd-flow-backdrop{position:absolute;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:64px 16px 16px}
.dd-flow-backdrop.is-phone{align-items:flex-end;padding:0;background:rgba(18,18,17,.36)}
.b2:has(.dd-flow-backdrop) .b2-top{z-index:101}
body:has(.dd-flow-backdrop.is-phone) .dd-floating-capture{visibility:hidden}
.dd-flow{--dd-flow-blue:#2367d1;--dd-flow-line:#3a8cf0;position:relative;display:flex;flex-direction:column;min-width:min(380px,100%);max-width:100%;max-height:100%;background:var(--raise,var(--paper,#fff));color:var(--ink,#121211);border:1px solid var(--rule-2,#0002);border-radius:12px;box-shadow:0 18px 50px #0000004d,0 2px 6px #0000001f;font:13px/1.3 var(--sans,system-ui);overflow:hidden;animation:dd-flow-in .14s ease-out}
@keyframes dd-flow-in{from{opacity:0;transform:translateY(-6px) scale(.985)}to{opacity:1;transform:none}}
.dd-flow *{box-sizing:border-box}
.dd-flow button{font:inherit;color:inherit}
.dd-flow-head{flex:none;display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-bottom:1px solid var(--rule,#0001)}
[dir=rtl] .dd-flow-head{padding:8px 14px 8px 8px}
.dd-flow-head strong{font-size:14px;font-weight:600}
.dd-flow-count{font-size:12px;color:var(--ink-3,#7f7c75);font-variant-numeric:tabular-nums}
.dd-flow-find{display:flex;align-items:center;gap:6px;flex:1 1 160px;min-width:120px;max-width:280px;height:30px;margin-inline-start:auto;padding:0 10px;border:1px solid var(--rule-2,#0002);border-radius:8px;background:var(--wash,#0000000a)}
.dd-flow-find:focus-within{border-color:var(--dd-flow-line);box-shadow:0 0 0 3px color-mix(in srgb,var(--dd-flow-line) 25%,transparent)}
.dd-flow-find>span{color:var(--ink-3,#7f7c75)}
.dd-flow-find input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink,#121211);font:inherit;outline:none}
.dd-flow-find input::-webkit-search-cancel-button{display:none}
.dd-flow-tools-button,.dd-flow-close{flex:none;display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:none;color:var(--ink-2,#4a4843)!important;cursor:pointer}
.dd-flow-close{font-size:20px!important;line-height:1}
.dd-flow-tools-button span{display:block;width:16px;height:12px;background:linear-gradient(currentColor,currentColor) 0 0/100% 2px no-repeat,linear-gradient(currentColor,currentColor) 0 5px/100% 2px no-repeat,linear-gradient(currentColor,currentColor) 0 10px/100% 2px no-repeat}
.dd-flow-tools-button:hover,.dd-flow-close:hover,.dd-flow-tools-button[aria-expanded=true]{background:var(--wash,#0000000d)}
.dd-flow-tools{flex:none;display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;padding:10px 14px;border-bottom:1px solid var(--rule,#0001)}
.dd-flow-tools>button{min-height:32px;padding:0 10px;border:1px solid var(--rule-2,#0002);border-radius:8px;background:var(--wash,#0000000a);cursor:pointer}
.dd-flow-tools .dd-life-dimensions{flex:1 1 200px;padding:0}
.dd-flow-canvas{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
.dd-flow-stage{position:relative;margin:0 auto}
.dd-flow-lines{position:absolute;inset:0;overflow:visible;pointer-events:none}
.dd-flow-curve{fill:none;stroke:color-mix(in srgb,var(--ink,#121211) 42%,transparent);stroke-width:1.6}
.dd-flow-arrow{fill:color-mix(in srgb,var(--ink,#121211) 42%,transparent)}
.dd-flow-link.is-trail .dd-flow-curve,.dd-flow-link.is-lit .dd-flow-curve{stroke:var(--dd-flow-line);stroke-width:2}
.dd-flow-link.is-trail .dd-flow-arrow,.dd-flow-link.is-lit .dd-flow-arrow{fill:var(--dd-flow-line)}
.dd-flow-link.is-dim{opacity:.3}
.dd-flow-node{position:absolute}
.dd-flow-node.is-dim{opacity:.35}
.dd-flow-pill{display:flex;align-items:center;gap:7px;width:100%;height:100%;padding:0 12px;border:1.5px solid color-mix(in srgb,var(--ink,#121211) 38%,transparent);border-radius:999px;background:var(--paper,#fff);color:var(--ink,#121211)!important;font-size:13px!important;font-weight:500;text-align:start;cursor:pointer;white-space:nowrap}
.dd-flow-pill:hover,.dd-flow-node.is-lit .dd-flow-pill{background:color-mix(in srgb,var(--ink,#121211) 12%,var(--paper,#fff))}
.dd-flow-node.is-trail:not(.is-here) .dd-flow-pill{border-color:var(--dd-flow-line)}
.dd-flow-node.is-here .dd-flow-pill{background:var(--dd-flow-blue);border-color:var(--dd-flow-blue);color:#fff!important}
.dd-flow-pill:focus-visible{outline:2px solid var(--dd-flow-line);outline-offset:2px}
.dd-flow-dot{flex:none;width:10px;height:10px;border:1.5px solid;border-radius:50%}
.dd-flow-node.is-here .dd-flow-dot{border-color:#fff!important}
.dd-flow-board{flex:none;width:12px;height:11px;border:1.5px solid currentColor;border-radius:3px;background:linear-gradient(currentColor,currentColor) 0 3px/100% 1.5px no-repeat}
.dd-flow-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.dd-flow-label mark{background:#FFD86B;color:#121211;border-radius:3px;padding:0 1px}
.dd-flow-notes{flex:none;font-size:11.5px;opacity:.7;font-variant-numeric:tabular-nums}
.dd-flow-fold{position:absolute;top:50%;width:17px;height:17px;margin-top:-8.5px;padding:0;border:1.5px solid color-mix(in srgb,var(--ink,#121211) 38%,transparent);border-radius:50%;background:var(--paper,#fff);color:var(--ink-2,#4a4843)!important;font-size:12px!important;line-height:13px;text-align:center;cursor:pointer}
.dd-flow-fold:hover:not(:disabled){border-color:var(--dd-flow-line);color:var(--ink,#121211)!important}
.dd-flow-fold:disabled{cursor:default;opacity:.6}
.dd-flow-node.is-trail .dd-flow-fold{border-color:var(--dd-flow-line)}
.dd-flow-end{position:absolute;top:50%;width:16px;height:12px;margin-top:-6px;pointer-events:none;background:linear-gradient(color-mix(in srgb,var(--ink,#121211) 42%,transparent),color-mix(in srgb,var(--ink,#121211) 42%,transparent)) 0 5px/14px 1.6px no-repeat,linear-gradient(color-mix(in srgb,var(--ink,#121211) 42%,transparent),color-mix(in srgb,var(--ink,#121211) 42%,transparent)) 13px 0/1.6px 12px no-repeat}
[dir=rtl] .dd-flow-end{transform:scaleX(-1)}
.dd-flow-node.is-here .dd-flow-end,.dd-flow-node.is-lit .dd-flow-end{background:linear-gradient(var(--dd-flow-line),var(--dd-flow-line)) 0 5px/14px 2px no-repeat,linear-gradient(var(--dd-flow-line),var(--dd-flow-line)) 13px 0/2px 12px no-repeat}
.dd-flow-hidden{position:absolute;top:50%;margin-top:-9px;padding:0 6px;border-radius:999px;background:var(--wash,#0000000d);color:var(--ink-2,#4a4843);font-size:11.5px;line-height:18px;font-variant-numeric:tabular-nums;pointer-events:none}
.dd-flow-node.is-quiet .dd-flow-pill{border-style:dashed;border-width:1px;background:transparent;color:var(--ink-3,#7f7c75)!important;font-weight:400}
.dd-flow-node.is-quiet .dd-flow-dot{opacity:.6}
.dd-flow-group{position:absolute;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border:1px dashed color-mix(in srgb,var(--ink,#121211) 26%,transparent);border-radius:999px;background:transparent;color:var(--ink-3,#7f7c75)!important;font-size:12px!important;white-space:nowrap;overflow:hidden;cursor:pointer}
.dd-flow-group:hover{background:var(--wash,#0000000d);color:var(--ink-2,#4a4843)!important}
.dd-flow-group:focus-visible{outline:2px solid var(--dd-flow-line);outline-offset:2px}
.dd-flow-group:disabled{cursor:default}
.dd-flow-group-icon{opacity:.75}
.dd-flow-group-label{font-weight:500}
.dd-flow-group-names{min-width:0;overflow:hidden;text-overflow:ellipsis;opacity:.75}
.dd-flow-group-fold{opacity:.7;font-size:10px}
.dd-flow.is-phone .dd-flow-group{font-size:14px!important}
.dd-flow-menu{position:absolute;z-index:5;display:flex;flex-direction:column;gap:2px;width:236px;padding:6px;border:1px solid var(--rule-2,#0002);border-radius:10px;background:var(--raise,var(--paper,#fff));box-shadow:0 12px 32px #00000040}
.dd-flow-menu>button{min-height:32px;padding:0 10px;border:0;border-radius:7px;background:none;text-align:start;cursor:pointer}
.dd-flow-menu>button:hover,.dd-flow-menu>button:focus-visible{background:var(--wash,#0000000d);outline:none}
.dd-flow-colors{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:8px 4px 4px;border-top:1px solid var(--rule,#0001);margin-top:4px}
.dd-flow-colors button{width:26px;height:26px;justify-self:center;padding:0;border:1.5px solid color-mix(in srgb,var(--ink,#121211) 40%,transparent);border-radius:50%;cursor:pointer}
.dd-flow-colors button[aria-checked=true]{outline:2px solid var(--dd-flow-line);outline-offset:2px}
.dd-flow-colors button:focus-visible{outline:2px solid var(--dd-flow-line);outline-offset:2px}
.dd-flow-color-row{display:flex;align-items:center;gap:6px;padding:4px}
.dd-flow-custom{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px 0 3px;border:1px solid var(--rule-2,#0002);border-radius:999px;font-size:12px;cursor:pointer}
.dd-flow-custom input{width:20px;height:20px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer}
.dd-flow-custom input::-webkit-color-swatch-wrapper{padding:0}
.dd-flow-custom input::-webkit-color-swatch{border:1px solid #0003;border-radius:50%}
.dd-flow-shade{height:28px;padding:0 10px;border:1px solid var(--rule-2,#0002);border-radius:999px;background:none;font-size:12px!important;cursor:pointer}
.dd-flow-shade[aria-pressed=true]{background:var(--ink,#121211);color:var(--paper,#fff)!important;border-color:var(--ink,#121211)}
.dd-flow-empty{margin:8px 14px 12px;color:var(--ink-3,#7f7c75);text-align:center}
.dd-flow-hint{flex:none;margin:0;padding:7px 14px;border-top:1px solid var(--rule,#0001);color:var(--ink-3,#7f7c75);font-size:12px}
.dd-flow.is-phone{width:100%;min-width:0;max-height:min(80%,calc(100% - 64px));border-radius:18px 18px 0 0;border-bottom:0;animation:none}
.dd-flow-grab{flex:none;width:40px;height:4px;margin:8px auto 0;border-radius:2px;background:var(--rule-2,#0002)}
.dd-flow.is-phone .dd-flow-head{flex-wrap:wrap;padding:8px 12px}
.dd-flow.is-phone .dd-flow-find{order:5;flex:1 1 100%;max-width:none;height:44px;margin:0}
.dd-flow.is-phone .dd-flow-find input{font-size:16px}
.dd-flow.is-phone .dd-flow-tools-button{margin-inline-start:auto}
.dd-flow.is-phone .dd-flow-tools-button,.dd-flow.is-phone .dd-flow-close{width:44px;height:44px}
.dd-flow.is-phone .dd-flow-pill{font-size:15px!important}
.dd-flow.is-phone .dd-flow-fold{width:26px;height:26px;margin-top:-13px;font-size:15px!important;line-height:22px}
.dd-flow.is-phone .dd-flow-menu>button,.dd-flow.is-phone .dd-flow-tools>button{min-height:44px}
.dd-flow.is-phone .dd-flow-colors button{width:36px;height:36px}
.dd-flow.is-phone .dd-flow-custom,.dd-flow.is-phone .dd-flow-shade{height:40px}
@media (prefers-reduced-motion:reduce){.dd-flow{animation:none}}
`;

export function DDinstallSectionsFlowStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-flow-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-flow-css", textContent: DDsectionsFlowCSS }));
}
