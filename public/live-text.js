// Writing without the marks (5.73). A note's words are still plain text with a
// few marks (**bold**, ## Heading, - [ ] To-do… see rich-text.js), so search,
// sync and every other view read them as before. While you write, the marks
// are hidden and the words already look formatted: the box draws the text
// itself and keeps the marks in hidden spans, so the text it holds is always
// exactly the saved text.
//
// The box behaves like a textarea for the board: value, selectionStart,
// selectionEnd, setSelectionRange() and select() work on it.
import { DDrichInline } from "./rich-text.js";

const URL_OK = /^(https?:\/\/|mailto:)/i;
const ZW = "​"; // only a resting place for the caret after hidden marks; never saved
const PREFIX = /^(\s*)(- \[[ xX]\] |[-*•] |#{1,2} |-# |> ?)/;

// ---- text -> boxes ---------------------------------------------------------

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const mark = (s) => el("span", "dd-mk", s);

function inline(parent, s) {
  for (const v of String(s).split(DDrichInline)) {
    if (!v) continue;
    let m;
    if ((m = v.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)$/)) && URL_OK.test(m[2])) {
      const a = el("a", "dd-rich-link"); a.dataset.href = m[2];
      parent.append(mark("["), a, mark("](" + m[2] + ")")); inline(a, m[1]); continue;
    }
    const pair = (open, tag, cls) => { const e = el(tag, cls); parent.append(mark(open), e, mark(open)); return e; };
    if (v.startsWith("**") && v.endsWith("**") && v.length > 4) { inline(pair("**", "strong"), v.slice(2, -2)); continue; }
    if (v.startsWith("~~") && v.endsWith("~~") && v.length > 4) { inline(pair("~~", "s"), v.slice(2, -2)); continue; }
    if (v.startsWith("==") && v.endsWith("==") && v.length > 4) { inline(pair("==", "mark", "dd-rich-mark"), v.slice(2, -2)); continue; }
    if (v.startsWith("`") && v.endsWith("`") && v.length > 2) { pair("`", "code", "dd-rich-code").textContent = v.slice(1, -1); continue; }
    if (/^_[^_\s]/.test(v) && v.endsWith("_") && v.length > 2) { inline(pair("_", "em"), v.slice(1, -1)); continue; }
    if (/^(https?:\/\/|www\.)/i.test(v)) { const a = el("a", "dd-rich-link", v); a.dataset.href = v; parent.append(a); continue; }
    parent.append(document.createTextNode(v));
  }
}

// Draws `text` into `root`, one box per line. Returns where each line starts
// and how long its hidden mark in front is (for Backspace).
export function DDliveDraw(root, text) {
  root.textContent = "";
  const lines = String(text).split("\n"), info = [];
  if (text === "") return info;
  let pos = 0, code = false;
  for (const line of lines) {
    const row = el("div", "dd-lv");
    row.dir = "auto";
    let prefix = 0, m;
    if (/^\s*```/.test(line)) {
      row.classList.add("dd-lv-fence"); row.append(mark(line)); prefix = line.length;
      code = !code;
    } else if (code) {
      row.classList.add("dd-lv-code"); if (line) row.append(document.createTextNode(line));
    } else if ((m = line.match(PREFIX))) {
      const lead = m[1].replace(/\t/g, "  ").length >> 1, kind = m[2];
      prefix = m[0].length;
      row.append(mark(m[0]));
      if (lead) row.style.setProperty("--lv-level", lead);
      if (kind.startsWith("- [")) { row.classList.add("dd-lv-todo"); if (/x/i.test(kind)) row.dataset.done = "true"; }
      else if (/^[-*•] $/.test(kind)) { row.classList.add("dd-lv-bullet"); row.dataset.bullet = ["•", "◦", "▪"][lead % 3]; }
      else if (kind === "# ") row.classList.add("dd-rich-h1");
      else if (kind === "## ") row.classList.add("dd-rich-h2");
      else if (kind === "-# ") row.classList.add("dd-rich-small");
      else row.classList.add("dd-lv-quote");
      inline(row, line.slice(prefix));
    } else if (line) inline(row, line);
    // An empty line keeps its height; hidden marks at the end keep a place for the caret.
    if (!row.firstChild) row.append(el("br"));
    else if (row.lastChild.nodeType === 1 && row.lastChild.classList.contains("dd-mk")) row.append(document.createTextNode(ZW));
    else if (row.lastChild.nodeType === 1 && row.lastChild.lastChild?.nodeType === 1 && row.lastChild.lastChild.classList?.contains("dd-mk")) row.append(document.createTextNode(ZW));
    root.append(row);
    info.push({ start: pos, prefix, length: line.length });
    pos += line.length + 1;
  }
  return info;
}

// ---- boxes -> text ---------------------------------------------------------

// Reads the words back, whatever the browser did to the boxes while typing.
export function DDliveRead(node) {
  const lines = [];
  let cur = null;
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) cur = (cur ?? "") + c.data;
      else if (c.nodeName === "BR") { cur = cur ?? ""; if (c.nextSibling) { lines.push(cur); cur = ""; } }
      else if (c.nodeType === 1 && /^(DIV|P|LI|H\d|BLOCKQUOTE|PRE)$/.test(c.nodeName)) {
        if (cur !== null) lines.push(cur);
        cur = "";
        walk(c);
        lines.push(cur);
        cur = null;
      } else if (c.nodeType === 1 || c.nodeType === 11) walk(c);
    }
  };
  walk(node);
  if (cur !== null) lines.push(cur);
  return lines.join("\n").split(ZW).join("");
}

// The place of a DOM point in the text.
function offsetOf(root, node, off) {
  if (!root.contains(node)) return null;
  const r = document.createRange();
  r.setStart(root, 0);
  try { r.setEnd(node, off); } catch { return null; }
  let n = DDliveRead(r.cloneContents()).length;
  // A point between two lines, given on the box itself, is the start of the next one.
  if (node === root && off > 0 && off < root.childNodes.length) n += 1;
  return n;
}
function visibleText(row) {
  const out = [], walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  let pos = 0, n;
  while ((n = walker.nextNode())) {
    const len = n.data.split(ZW).join("").length, hidden = n.parentElement?.closest(".dd-mk");
    if (!hidden) out.push({ node: n, start: pos, end: pos + len });
    pos += len;
  }
  return out;
}
// The DOM point for a place in the text, always somewhere the caret can show.
function pointAt(root, pos) {
  const rows = [...root.children];
  if (!rows.length) return [root, 0];
  let start = 0;
  for (let i = 0; i < rows.length; i++) {
    const len = DDliveRead(rows[i]).length;
    if (pos <= start + len || i === rows.length - 1) {
      const p = Math.max(0, Math.min(pos - start, len)), list = visibleText(rows[i]);
      if (!list.length) return [rows[i], rows[i].querySelector("br") ? 0 : rows[i].childNodes.length];
      let hit = list.find((t) => t.start <= p && p <= t.end);
      if (!hit) hit = list.reduce((a, t) => { const d = (x) => (p < x.start ? x.start - p : p - x.end); return d(t) <= d(a) ? t : a; });
      const q = Math.max(hit.start, Math.min(p, hit.end)) - hit.start;
      // Count past the caret's resting marks inside the node.
      let k = 0, seen = 0;
      while (k < hit.node.data.length && (seen < q || hit.node.data[k] === ZW)) { if (hit.node.data[k] !== ZW) seen++; k++; }
      return [hit.node, k];
    }
    start += len + 1;
  }
  return [root, root.childNodes.length];
}

// ---- the box ---------------------------------------------------------------

function selection(root) {
  const s = typeof getSelection === "function" ? getSelection() : null;
  if (!s || !s.rangeCount) return null;
  const a = offsetOf(root, s.anchorNode, s.anchorOffset), f = offsetOf(root, s.focusNode, s.focusOffset);
  if (a == null || f == null) return null;
  return [Math.min(a, f), Math.max(a, f)];
}
function select(root, a, b = a) {
  const s = getSelection(), [an, ao] = pointAt(root, a), [bn, bo] = a === b ? [an, ao] : pointAt(root, b);
  s.setBaseAndExtent(an, ao, bn, bo);
}

// Gives the box the textarea's words the board already uses.
function textareaLike(root, state) {
  if (root.__ddLive) return;
  root.__ddLive = true;
  Object.defineProperties(root, {
    value: { configurable: true, get: () => state.text },
    selectionStart: { configurable: true, get: () => (document.activeElement === root || root.contains(getSelection()?.anchorNode) ? selection(root)?.[0] : null) ?? state.caret[0] },
    selectionEnd: { configurable: true, get: () => (document.activeElement === root || root.contains(getSelection()?.anchorNode) ? selection(root)?.[1] : null) ?? state.caret[1] },
    setSelectionRange: { configurable: true, value: (a, b) => { const n = state.text.length; a = Math.max(0, Math.min(a, n)); b = Math.max(a, Math.min(b ?? a, n)); state.caret = [a, b]; if (document.activeElement === root) select(root, a, b); } },
    select: { configurable: true, value: () => { root.focus(); select(root, 0, state.text.length); } },
  });
}

export function DDLiveText({ React: R, value, onValue, onKeyDown, onPaste, onBlur, onFocus, onPointerDown, autoFocus, maxLength, placeholder, boxRef, className, dir, ...rest }) {
  const ref = R.useRef(null), state = R.useRef(null);
  if (!state.current) state.current = { text: null, caret: [String(value).length, String(value).length], info: [], undo: [], redo: [], at: 0, composing: false };
  const s = state.current;
  const draw = (text, caret) => {
    const root = ref.current;
    s.text = text;
    s.info = DDliveDraw(root, text);
    if (caret) { s.caret = caret; if (document.activeElement === root) select(root, caret[0], caret[1]); }
  };
  // A change from the board (Bold, To-do, a sync…) is drawn again.
  R.useLayoutEffect(() => {
    const root = ref.current;
    textareaLike(root, s);
    if (boxRef) boxRef.current = root;
    if (s.text !== value) {
      if (s.text != null) { s.undo.push({ text: s.text, caret: s.caret }); s.redo = []; s.at = 0; }
      const keep = s.text == null ? [value.length, value.length] : (selection(root) || s.caret);
      draw(value, [Math.min(keep[0], value.length), Math.min(keep[1], value.length)]);
    }
  }, [value]);
  R.useEffect(() => {
    if (!autoFocus) return;
    const root = ref.current;
    root.focus({ preventScroll: true });
    select(root, s.caret[0], s.caret[1]);
  }, []);
  // Every change goes through here: remembered for Undo, drawn, then passed on.
  const change = (text, caret, record = true, typing = false) => {
    if (maxLength && text.length > maxLength && text.length > s.text.length) { draw(s.text, s.caret); return; }
    if (record) {
      const now = Date.now();
      if (!typing || now - s.at > 700 || !s.undo.length) s.undo.push({ text: s.text, caret: s.caret });
      if (s.undo.length > 200) s.undo.shift();
      s.redo = [];
      s.at = typing ? now : 0;
    }
    draw(text, caret);
    onValue(text);
  };
  const insert = (str) => {
    const [a, b] = selection(ref.current) || s.caret;
    change(s.text.slice(0, a) + str + s.text.slice(b), [a + str.length, a + str.length]);
  };
  const history = (back) => {
    const from = back ? s.undo : s.redo, to = back ? s.redo : s.undo, step = from.pop();
    if (!step) return;
    to.push({ text: s.text, caret: selection(ref.current) || s.caret });
    s.at = 0;
    change(step.text, step.caret, false);
  };
  const lineOf = (pos) => s.info.find((l) => pos >= l.start && pos <= l.start + l.length);
  const handleKey = (e) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.nativeEvent?.isComposing || s.composing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (e.code === "KeyZ" || e.code === "KeyY")) {
      e.preventDefault(); e.stopPropagation();
      history(e.code === "KeyZ" && !e.shiftKey);
      return;
    }
    if (e.key === "Enter" && !mod && !e.altKey) { e.preventDefault(); insert("\n"); return; }
    if ((e.key === "Backspace" || e.key === "Delete") && !mod && !e.altKey) {
      const sel = selection(ref.current);
      if (!sel || sel[0] !== sel[1]) return;
      const p = sel[0], line = lineOf(p);
      if (!line) return;
      if (e.key === "Backspace") {
        // At the start of a heading, bullet or to-do: Backspace takes the style off first.
        if (line.prefix && p === line.start + line.prefix && !/^\s*```/.test(s.text.slice(line.start, line.start + line.length))) {
          e.preventDefault();
          change(s.text.slice(0, line.start) + s.text.slice(line.start + line.prefix), [line.start, line.start]);
          return;
        }
        if (p <= line.start + line.prefix) {
          if (line.start === 0) { e.preventDefault(); return; }
          e.preventDefault();
          change(s.text.slice(0, line.start - 1) + s.text.slice(line.start), [line.start - 1, line.start - 1]);
          return;
        }
        // Hidden marks right before the caret: take the last visible letter before them.
        const vis = visibleBefore(p, line);
        if (vis != null && vis < p - 1) { e.preventDefault(); change(s.text.slice(0, vis) + s.text.slice(vis + 1), [vis, vis]); }
        return;
      }
      if (p === line.start + line.length) {
        e.preventDefault();
        if (p < s.text.length) change(s.text.slice(0, p) + s.text.slice(p + 1), [p, p]);
      }
    }
  };
  // The last letter before `p` that is not part of a mark.
  const visibleBefore = (p, line) => {
    const row = ref.current.children[s.info.indexOf(line)];
    if (!row) return null;
    const list = visibleText(row), q = p - line.start;
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      if (t.start < q && t.end > t.start) return line.start + Math.min(q, t.end) - 1;
    }
    return null;
  };
  const input = () => {
    if (s.composing) return;
    const root = ref.current, text = DDliveRead(root), caret = selection(root) || [text.length, text.length];
    if (text === s.text) return;
    change(text, caret, true, true);
  };
  return R.createElement("div", {
    ...rest,
    ref,
    className: "dd-live" + (className ? " " + className : ""),
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-multiline": true,
    "data-placeholder": placeholder,
    dir: dir || "auto",
    spellCheck: true,
    onKeyDown: handleKey,
    onInput: input,
    onFocus,
    onPointerDown: (e) => { tick(e); onPointerDown?.(e); },
    onBlur: (e) => { s.caret = selection(ref.current) || s.caret; onBlur?.(e); },
    onCompositionStart: () => { s.composing = true; },
    onCompositionEnd: () => { s.composing = false; input(); },
    onBeforeInput: (e) => {
      const type = e.nativeEvent?.inputType;
      if (type === "historyUndo" || type === "historyRedo") { e.preventDefault(); history(type === "historyUndo"); }
      else if (type === "insertParagraph" || type === "insertLineBreak") { e.preventDefault(); insert("\n"); }
      else if (/^format/.test(type || "")) e.preventDefault();
    },
    onPaste: (e) => {
      onPaste?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      const str = (e.clipboardData?.getData("text/plain") || "").replace(/\r\n?/g, "\n");
      if (str) insert(str);
    },
    onDrop: (e) => {
      // Dropped words come in as plain text, where they were dropped.
      const str = e.dataTransfer?.getData("text/plain");
      if (!str) return;
      e.preventDefault();
      const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY), range = !pos && document.caretRangeFromPoint?.(e.clientX, e.clientY);
      const at = pos ? offsetOf(ref.current, pos.offsetNode, pos.offset) : range ? offsetOf(ref.current, range.startContainer, range.startOffset) : null;
      const p = at ?? s.text.length;
      change(s.text.slice(0, p) + str + s.text.slice(p), [p + str.length, p + str.length]);
    },
  });
  // A click on a to-do's box ticks it; a click on a link while writing just places the caret.
  function tick(e) {
      const row = e.target.closest?.(".dd-lv-todo");
      if (row && row.parentElement === ref.current) {
        const r = row.getBoundingClientRect(), rtl = getComputedStyle(row).direction === "rtl", pad = parseFloat(getComputedStyle(row).paddingInlineStart) || 24;
        const inBox = rtl ? e.clientX > r.right - pad : e.clientX < r.left + pad;
        if (inBox) {
          e.preventDefault();
          const line = s.info[[...ref.current.children].indexOf(row)], at = s.text.indexOf("[", line.start);
          if (at >= 0 && at < line.start + line.length) {
            const next = s.text.slice(0, at + 1) + (/x/i.test(s.text[at + 1]) ? " " : "x") + s.text.slice(at + 2);
            change(next, selection(ref.current) || s.caret);
          }
        }
      }
  }
}

export const DDliveCSS = `
.dd-live{outline:none;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;cursor:text;user-select:text;-webkit-user-select:text;text-align:var(--object-align,start)}
.dd-live:empty::before{content:attr(data-placeholder);opacity:.45;pointer-events:none}
.dd-live .dd-mk{display:none}
.dd-live .dd-lv{min-height:1lh;padding-inline-start:calc(var(--lv-level,0) * 1.2em)}
.dd-live .dd-lv-bullet,.dd-live .dd-lv-todo{position:relative;padding-inline-start:calc(var(--lv-level,0) * 1.2em + 1.35em)}
.dd-live .dd-lv-bullet::before{content:attr(data-bullet);position:absolute;inset-inline-start:calc(var(--lv-level,0) * 1.2em + .25em);opacity:.75;user-select:none;pointer-events:none}
.dd-live .dd-lv-todo::before{content:"";position:absolute;inset-inline-start:calc(var(--lv-level,0) * 1.2em + .1em);top:.28em;width:.85em;height:.85em;border:1.5px solid currentColor;border-radius:3px;opacity:.7;box-sizing:border-box;cursor:pointer}
.dd-live .dd-lv-todo[data-done=true]::before{content:"✓";display:grid;place-items:center;font:700 .7em/1 system-ui,sans-serif;width:1.21em;height:1.21em;top:.4em;opacity:.8}
.dd-live .dd-lv-todo[data-done=true]{text-decoration:line-through;text-decoration-color:color-mix(in srgb,currentColor 55%,transparent)}
.dd-live .dd-lv-quote{padding-inline-start:.7em;border-inline-start:3px solid currentColor;font-style:italic;opacity:.85}
.dd-live .dd-lv-code{font:500 .85em/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:color-mix(in srgb,currentColor 9%,transparent);padding-inline:.65em}
.dd-live .dd-lv-fence{min-height:0;height:.35em;overflow:hidden;background:color-mix(in srgb,currentColor 9%,transparent);font-size:.3em}
.dd-live .dd-rich-link{cursor:text}
`;
