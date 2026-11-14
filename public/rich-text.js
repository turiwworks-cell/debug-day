// Text formatting for notes, text and shapes (5.61), after Milanote.
//
// A note's words stay plain text with a few marks, so search, sync, export and
// every other view read them as they are:
//   # Large heading    ## Heading    -# Small text    > Quote
//   ``` (a line before and after) Code block
//   - Bullet    1. Numbered    - [ ] To-do    (two spaces in front: one level in)
//   **bold**  _italic_  ~~strike~~  ==highlight==  `code`  [words](https://link)
// Bare web addresses become links too.
import { DDstickyFormat } from "./stickies.js";

const LIST = /^(\s*)(- \[[ xX]\] |[-*•] |\d+[.)] )/;
const BLOCK = /^(\s*)(#{1,2} |-# |> )/;
const URL_OK = /^(https?:\/\/|mailto:)/i;

function lineRange(text, start, end) {
  const a = text.lastIndexOf("\n", start - 1) + 1, b = text.indexOf("\n", end > start && text[end - 1] === "\n" ? end - 1 : end);
  return [a, b < 0 ? text.length : b];
}
function eachLine(text, start, end, fn) {
  const [a, b] = lineRange(text, start, end), lines = text.slice(a, b).split("\n"), value = fn(lines).join("\n");
  return { text: text.slice(0, a) + value + text.slice(b), start: a, end: a + value.length };
}
function wrap(text, start, end, mark) {
  // Marks go inside a line's own mark ("## **Plan**", "- **sketch**"), never around it.
  if (!text.slice(start, end).includes("\n") && (start === 0 || text[start - 1] === "\n")) {
    const p = text.slice(start, end).match(/^\s*(?:- \[[ xX]\] |[-*•] |\d+[.)] |#{1,2} |-# |> )/);
    if (p && p[0].length < end - start) start += p[0].length;
  }
  const n = mark.length, sel = text.slice(start, end);
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= 2 * n) return { text: text.slice(0, start) + sel.slice(n, -n) + text.slice(end), start, end: end - 2 * n };
  if (text.slice(start - n, start) === mark && text.slice(end, end + n) === mark) return { text: text.slice(0, start - n) + sel + text.slice(end + n), start: start - n, end: end - n };
  if (sel.includes("\n")) {
    const value = sel.split("\n").map((l) => (l.trim() ? l.replace(/^(\s*(?:- \[[ xX]\] |[-*•] |\d+[.)] |#{1,2} |-# |> )?)(.*?)(\s*)$/, (all, p, v, s) => p + mark + v + mark + s) : l)).join("\n");
    return { text: text.slice(0, start) + value + text.slice(end), start, end: start + value.length };
  }
  return { text: text.slice(0, start) + mark + sel + mark + text.slice(end), start: start + n, end: end + n };
}
const PREFIX = { h1: "# ", h2: "## ", small: "-# ", quote: "> ", normal: "" };
const LISTS = { bullet: "- ", number: "1. " };

// Apply one kind of formatting to the chosen part of the text (or, with nothing
// chosen, to the lines the caret is on). Returns the new text and selection.
export function DDrichFormat(text, start, end, kind, arg) {
  text = String(text || "");
  start = Math.max(0, Math.min(start ?? 0, text.length));
  end = Math.max(start, Math.min(end ?? text.length, text.length));
  if (kind === "todo") return DDstickyFormat(text, start, end, kind);
  if (kind === "bold") return wrap(text, start, end, "**");
  if (kind === "strike") return wrap(text, start, end, "~~");
  if (kind === "italic") return wrap(text, start, end, "_");
  if (kind === "highlight") return wrap(text, start, end, "==");
  if (kind === "code") return wrap(text, start, end, "`");
  if (kind === "link") {
    const url = String(arg || "").trim(), sel = text.slice(start, end), was = sel.match(/^\[([^\]\n]*)\]\(([^)\s]*)\)$/);
    const words = was ? was[1] : sel;
    if (!url) return { text: text.slice(0, start) + words + text.slice(end), start, end: start + words.length };
    const safe = URL_OK.test(url) ? url : "https://" + url.replace(/^\/+/, "");
    const value = words ? "[" + words + "](" + safe + ")" : safe;
    return { text: text.slice(0, start) + value + text.slice(end), start, end: start + value.length };
  }
  if (kind in PREFIX) {
    const prefix = PREFIX[kind];
    return eachLine(text, start, end, (lines) => {
      const all = prefix && lines.filter((l) => l.trim()).every((l) => l.replace(/^\s*/, "").startsWith(prefix) && !(prefix === "# " && l.trim().startsWith("## ")));
      return lines.map((l) => {
        if (!l.trim() && lines.length > 1) return l;
        const m = l.match(/^(\s*)/), lead = m[1], body = l.slice(lead.length).replace(/^(#{1,2} |-# |> )/, "");
        return lead + (all ? "" : prefix) + body;
      });
    });
  }
  if (kind in LISTS) {
    const prefix = LISTS[kind], is = kind === "number" ? (l) => /^\s*\d+[.)] /.test(l) : (l) => /^\s*[-*•] /.test(l) && !/^\s*- \[[ xX]\]/.test(l);
    return eachLine(text, start, end, (lines) => {
      const filled = lines.filter((l) => l.trim()), all = filled.length > 0 && filled.every(is);
      let n = 0;
      return lines.map((l) => {
        if (!l.trim() && lines.length > 1) return l;
        const lead = l.match(/^\s*/)[0], body = l.slice(lead.length).replace(/^(- \[[ xX]\] |[-*•] |\d+[.)] )/, "");
        return lead + (all ? "" : kind === "number" ? ++n + ". " : prefix) + body;
      });
    });
  }
  if (kind === "codeblock") {
    const [a, b] = lineRange(text, start, end), before = text.slice(0, a), after = text.slice(b);
    if (/(^|\n)```\n$/.test(before) && /^\n```(\n|$)/.test(after)) {
      const inner = text.slice(a, b), head = before.slice(0, -4), tail = after.slice(4);
      return { text: head + inner + tail, start: head.length, end: head.length + inner.length };
    }
    const inner = text.slice(a, b), value = "```\n" + inner + "\n```";
    return { text: before + value + after, start: a + 4, end: a + 4 + inner.length };
  }
  if (kind === "indent" || kind === "outdent")
    return eachLine(text, start, end, (lines) => lines.map((l) => (kind === "indent" ? (l.trim() ? "  " + l : l) : l.replace(/^ {1,2}/, ""))));
  return { text, start, end };
}

// Keyboard shortcuts, as in Milanote (Ctrl+Shift+9 stays To-do here, so Small text is Ctrl+Shift+3).
export function DDrichKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const code = e.code || "", key = String(e.key || "").toLowerCase(), k = /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : key;
  if (!e.shiftKey) return { b: "bold", i: "italic", k: "link", e: "code" }[k] || null;
  return {
    Digit1: "h1", Digit2: "h2", Digit3: "small", Digit0: "normal", Digit7: "number", Digit8: "bullet", Digit9: "todo",
    Period: "codeblock", Quote: "quote", KeyX: "strike", KeyH: "highlight",
  }[code] || null;
}
export const DDrichShortcuts = [
  ["h1", "Large heading", "Ctrl+Shift+1"], ["h2", "Heading", "Ctrl+Shift+2"], ["normal", "Normal text", "Ctrl+Shift+0"], ["small", "Small text", "Ctrl+Shift+3"],
  ["quote", "Quote", "Ctrl+Shift+'"], ["codeblock", "Code block", "Ctrl+Shift+>"],
];

// Enter in a list starts the next item; Enter on an empty item ends the list.
export function DDrichEnter(text, pos) {
  const a = text.lastIndexOf("\n", pos - 1) + 1, b = text.indexOf("\n", pos), line = text.slice(a, b < 0 ? text.length : b), m = line.match(LIST);
  if (!m || pos < a + m[0].length) return null;
  // An empty item steps out one level, then out of the list.
  if (!line.slice(m[0].length).trim()) {
    if (m[1].length >= 2) { const lead = m[1].slice(2); return { text: text.slice(0, a) + lead + text.slice(a + m[1].length), start: pos - 2, end: pos - 2 }; }
    return { text: text.slice(0, a) + text.slice(a + m[0].length), start: a, end: a };
  }
  const mark = m[2].startsWith("- [") ? "- [ ] " : /^\d/.test(m[2]) ? parseInt(m[2], 10) + 1 + m[2].replace(/^\d+/, "") : m[2];
  const add = "\n" + m[1] + mark;
  return { text: text.slice(0, pos) + add + text.slice(pos), start: pos + add.length, end: pos + add.length };
}
// Tab and Shift+Tab move list items in and out; elsewhere Tab is left alone.
export function DDrichTab(text, start, end, out) {
  const [a, b] = lineRange(text, start, end);
  if (!text.slice(a, b).split("\n").some((l) => LIST.test(l))) return null;
  const r = DDrichFormat(text, start, end, out ? "outdent" : "indent");
  if (start === end) {
    const moved = r.text.length - text.length;
    return { text: r.text, start: Math.max(a, start + moved), end: Math.max(a, start + moved) };
  }
  return r;
}

// The words without their marks (for a title in a bar, a search row…).
export function DDrichPlain(text) {
  return String(text || "")
    .replace(/^```.*$/gm, "")
    .replace(/^(\s*)(#{1,2} |-# |> )/gm, "$1")
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^)\s]+\)/gi, "$1")
    .replace(/\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|==([^=\n]+)==|`([^`\n]+)`/g, (all, a, b, c, d) => a || b || c || d)
    .replace(/(^|[^\w])_([^_\s][^_\n]*)_(?!\w)/g, "$1$2")
    .replace(/^\s*- \[[ xX]\]\s?/gm, "");
}

const INLINE = /(\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|\*\*[^*\n]+\*\*|~~[^~\n]+~~|==[^=\n]+==|`[^`\n]+`|(?<![\w])_[^_\s][^_\n]*_(?![\w])|(?:https?:\/\/|www\.)[^\s<>()]*[^\s<>().,;:!?'"])/gi;
// A link opens in a new tab on a click, never at the end of a drag.
function linkProps(href) {
  let at = null;
  return {
    href: /^www\./i.test(href) ? "https://" + href : href, target: "_blank", rel: "noopener noreferrer", className: "dd-rich-link", draggable: false, title: href,
    onPointerDown: (e) => { at = [e.clientX, e.clientY]; },
    onClick: (e) => { if (at && Math.hypot(e.clientX - at[0], e.clientY - at[1]) > 4) e.preventDefault(); },
  };
}
function inline(h, s, key = "i") {
  return String(s).split(INLINE).map((v, i) => {
    const k = key + i;
    if (!v) return null;
    let m;
    if ((m = v.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)$/)) && URL_OK.test(m[2])) return h("a", { key: k, ...linkProps(m[2]) }, inline(h, m[1], k));
    if (v.startsWith("**") && v.endsWith("**") && v.length > 4) return h("strong", { key: k }, inline(h, v.slice(2, -2), k));
    if (v.startsWith("~~") && v.endsWith("~~") && v.length > 4) return h("s", { key: k }, inline(h, v.slice(2, -2), k));
    if (v.startsWith("==") && v.endsWith("==") && v.length > 4) return h("mark", { key: k, className: "dd-rich-mark" }, inline(h, v.slice(2, -2), k));
    if (v.startsWith("`") && v.endsWith("`") && v.length > 2) return h("code", { key: k, className: "dd-rich-code" }, v.slice(1, -1));
    if (/^_[^_\s]/.test(v) && v.endsWith("_") && v.length > 2) return h("em", { key: k }, inline(h, v.slice(1, -1), k));
    if (/^(https?:\/\/|www\.)/i.test(v)) return h("a", { key: k, ...linkProps(v) }, v);
    return v;
  });
}

// Draws a note's words with their formatting. onToggle(line) ticks a to-do.
export function DDRichText({ React: R, text, onToggle, language }) {
  const h = R.createElement, lines = String(text || "").split("\n"), out = [], counters = [];
  const hint = language === "fa" ? "یک کار اضافه کن…" : "Add a task…";
  let code = null;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      if (code) { out.push(h("pre", { key: "c" + i, className: "dd-rich-pre" }, code.join("\n") || " ")); code = null; }
      else code = [];
      return;
    }
    if (code) { code.push(line); return; }
    const lead = (line.match(/^\s*/)[0].replace(/\t/g, "  ").length / 2) | 0, pad = lead ? { "--rich-level": lead } : undefined;
    let m;
    if ((m = line.match(/^\s*- \[([ xX])\]\s?(.*)$/))) {
      counters.length = 0;
      out.push(h("label", { key: i, className: "dd-sticky-todo", "data-done": m[1] !== " ", "data-level": lead || undefined, style: pad },
        h("input", { type: "checkbox", checked: m[1] !== " ", "aria-label": m[2] || hint, onPointerDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onChange: () => onToggle?.(i) }),
        h("span", null, m[2] ? inline(h, m[2]) : h("span", { className: "dd-sticky-hint" }, hint))));
      return;
    }
    if ((m = line.match(/^\s*(\d+)[.)] (.*)$/))) {
      counters.length = lead + 1;
      counters[lead] = (counters[lead] || 0) + 1;
      out.push(h("div", { key: i, className: "dd-rich-li", "data-list": "number", "data-level": lead || undefined, style: pad }, h("span", { className: "dd-rich-marker", "aria-hidden": true }, counters[lead] + "."), h("span", null, inline(h, m[2]))));
      return;
    }
    if ((m = line.match(/^\s*[-*•] (.*)$/))) {
      counters.length = lead;
      out.push(h("div", { key: i, className: "dd-rich-li", "data-list": "bullet", "data-level": lead || undefined, style: pad }, h("span", { className: "dd-rich-marker", "aria-hidden": true }, ["•", "◦", "▪"][lead % 3]), h("span", null, inline(h, m[1]))));
      return;
    }
    counters.length = 0;
    if ((m = line.match(/^\s*(#{1,2}) (.*)$/))) { out.push(h("div", { key: i, className: "dd-rich-h" + m[1].length, role: "heading", "aria-level": m[1].length + 2 }, inline(h, m[2]) || " ")); return; }
    if ((m = line.match(/^\s*-# (.*)$/))) { out.push(h("div", { key: i, className: "dd-rich-small" }, inline(h, m[1]) || " ")); return; }
    if ((m = line.match(/^\s*> ?(.*)$/)) && line.trim().startsWith(">")) { out.push(h("blockquote", { key: i, className: "dd-rich-quote" }, inline(h, m[1]) || " ")); return; }
    out.push(h("div", { key: i }, line ? inline(h, line) : " "));
  });
  if (code) out.push(h("pre", { key: "c-end", className: "dd-rich-pre" }, code.join("\n") || " "));
  return out;
}

export const DDrichCSS = `
.dd-rich-h1{font-size:1.6em;font-weight:750;line-height:1.2;letter-spacing:-.015em;margin:.1em 0 .15em}
.dd-rich-h2{font-size:1.25em;font-weight:700;line-height:1.25;letter-spacing:-.01em;margin:.08em 0 .1em}
.dd-rich-small{font-size:.8em;opacity:.78}
.dd-rich-quote{margin:.1em 0;padding-inline-start:.7em;border-inline-start:3px solid currentColor;opacity:.85;font-style:italic}
.dd-rich-pre{margin:.2em 0;padding:.5em .65em;border-radius:6px;background:color-mix(in srgb,currentColor 9%,transparent);font:500 .85em/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.dd-rich-code{padding:.05em .3em;border-radius:4px;background:color-mix(in srgb,currentColor 10%,transparent);font:500 .88em ui-monospace,SFMono-Regular,Menlo,monospace}
.dd-rich-mark{background:#FFE36E;color:#141414;border-radius:3px;padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.dd-rich-link{color:inherit;text-decoration:underline;text-decoration-color:color-mix(in srgb,currentColor 45%,transparent);text-underline-offset:.18em;cursor:pointer}
.dd-rich-link:hover{text-decoration-color:currentColor}
.dd-rich-li{display:flex;gap:.45em;align-items:baseline;padding-inline-start:calc(var(--rich-level,0) * 1.2em)}
.dd-rich-marker{flex:none;min-width:.9em;text-align:end;opacity:.75;font-variant-numeric:tabular-nums}
.dd-rich-li>span:last-child{flex:1 1 auto;min-width:0}
.dd-sticky-todo[data-level]{padding-inline-start:calc(var(--rich-level,0) * 1.2em)}
.b6 .b4-node.b4-sticky.b4-plain .dd-note-preview{width:100%;padding:2px 4px!important;line-height:1.3;box-sizing:border-box}
.b6 .b4-node.b4-sticky.b4-plain.b4-fit .dd-note-preview{width:max-content;max-width:var(--fit-max,100%)}
.b6 .b4-node.b4-sticky.b4-plain .dd-note-editor{padding:0!important;position:relative}
.b6 .b4-node.b4-sticky.b4-plain .dd-note-editor textarea{padding:2px 4px!important;line-height:1.3;box-sizing:border-box}
.b6 .b4-plain .dd-fit-mirror{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;width:max-content;max-width:var(--fit-max,100%);padding:2px 4px;box-sizing:border-box;font-size:calc(var(--object-size,16px) * 1.15);font-weight:600;line-height:1.3;letter-spacing:-.005em}
.dd-text-style-pop{position:absolute;z-index:80;min-width:220px;background:#1E1E1E;color:#fff;border:1px solid #ffffff1a;border-radius:12px;box-shadow:0 12px 32px #0005;padding:6px;font:13px/1.3 system-ui,sans-serif}
.dd-text-style-pop button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:16px;border:0;background:none;color:inherit;padding:8px 10px;border-radius:7px;cursor:pointer;font:inherit;text-align:start}
.dd-text-style-pop button:hover,.dd-text-style-pop button:focus-visible{background:#ffffff16;outline:none}
.dd-text-style-pop kbd{font:11px ui-monospace,monospace;opacity:.55}
.dd-text-style-pop [data-style=h1] span{font-size:19px;font-weight:750}.dd-text-style-pop [data-style=h2] span{font-size:16px;font-weight:700}.dd-text-style-pop [data-style=small] span{font-size:11.5px;opacity:.8}.dd-text-style-pop [data-style=quote] span{font-style:italic;border-inline-start:2px solid;padding-inline-start:6px}.dd-text-style-pop [data-style=codeblock] span{font-family:ui-monospace,monospace}
.dd-link-pop{position:absolute;z-index:85;display:flex;gap:6px;align-items:center;background:#1E1E1E;color:#fff;border:1px solid #ffffff1a;border-radius:10px;box-shadow:0 10px 26px #0005;padding:6px;font:13px system-ui,sans-serif;min-width:280px}
.dd-link-pop input{flex:1;min-width:0;height:32px;border:1px solid #ffffff22!important;border-radius:7px;background:#2C2C2C!important;color:#fff;padding:0 9px;font:inherit;outline:none!important;box-shadow:none!important}
.dd-link-pop input:focus{border-color:#9747FF!important}
.dd-link-pop button{height:32px;border:0;border-radius:7px;padding:0 10px;background:#9747FF;color:#fff;font:600 12px system-ui,sans-serif;cursor:pointer}
.dd-link-pop button[data-link-remove]{background:#ffffff14}
`;
