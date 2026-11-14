// Documents (5.63), after Milanote: a card on the Board for long writing, with
// a name. It shows as a card with the start of its words, or as a small icon.
// A double-click opens it full size to read and write, with the same text
// formatting as notes. It can be saved as Markdown, text, Word or PDF.
//
// A document is a note (sticky) with the style key `doc` (and `docView: "icon"`
// for the icon look), so sync, Lanes, search, tags and wires work unchanged.
// Its first line is its name; the rest is the document.

import { DDRichText, DDrichFormat, DDrichKey, DDrichEnter, DDrichTab, DDrichPlain, DDrichShortcuts } from "./rich-text.js";

// The style keys a document keeps (anything else is dropped).
export function DDdocLook(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  if (p.doc !== true) return {};
  return { doc: true, ...(p.docView === "icon" ? { docView: "icon" } : {}) };
}
export const DDdocSize = { card: { width: 240, height: 300 }, icon: { width: 120, height: 136 } };

// Name and words: the first line is the name (a heading mark is not part of it).
export function DDdocSplit(text) {
  const s = String(text || ""), i = s.indexOf("\n"), first = i < 0 ? s : s.slice(0, i);
  return { name: first.replace(/^\s*#{1,6}\s+/, "").trim(), body: i < 0 ? "" : s.slice(i + 1).replace(/^\s*\n/, "") };
}
export function DDdocJoin(name, body) {
  const n = String(name || "").replace(/\n+/g, " ").trim(), b = String(body || "");
  return (n ? "# " + n : "#") + (b ? "\n\n" + b.replace(/^\n+/, "") : "");
}
export const DDdocUntitled = "Untitled document";
export function DDdocName(text) {
  return DDrichPlain(DDdocSplit(text).name) || DDdocUntitled;
}
// A note that becomes a document keeps its words: its first line is the name.
export function DDdocFromNote(text) {
  const { name, body } = DDdocSplit(text);
  return name || body ? DDdocJoin(name, body) : "";
}
// A file name that every system accepts.
export function DDdocFileName(text, ext) {
  return (DDdocName(text).replace(/[\\/:*?"<>|#]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Document") + "." + ext;
}
function words(text) {
  return (DDrichPlain(DDdocSplit(text).body).match(/\S+/g) || []).length;
}
export function DDdocWords(text) { return words(text); }

// What each export holds. Word opens an HTML page saved as .doc; PDF is the
// browser's own print to PDF of the same page.
export function DDdocExportText(text, kind) {
  const { name, body } = DDdocSplit(text);
  if (kind === "md") return "# " + (name || DDdocUntitled) + "\n\n" + body.replace(/^(\s*)-# /gm, "$1<small>").replace(/<small>(.*)$/gm, "<small>$1</small>") + "\n";
  return DDrichPlain(name || DDdocUntitled) + "\n\n" + DDrichPlain(body) + "\n";
}
export function DDdocPage(text, html) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(DDdocName(text)) + "</title><style>" +
    "body{font:16px/1.6 Georgia,'Times New Roman',serif;color:#1d1d1b;max-width:680px;margin:48px auto;padding:0 24px}" +
    "h1{font:700 30px/1.2 Helvetica,Arial,sans-serif;margin:0 0 24px}.dd-rich-h1{font:700 24px/1.3 Helvetica,Arial,sans-serif;margin:18px 0 8px}.dd-rich-h2{font:700 19px/1.3 Helvetica,Arial,sans-serif;margin:14px 0 6px}" +
    ".dd-rich-small{font-size:13px;color:#666}.dd-rich-quote{margin:8px 0;padding-left:14px;border-left:3px solid #ccc;color:#555}.dd-rich-pre{font:13px/1.5 Menlo,monospace;background:#f4f4f2;padding:10px;border-radius:6px;white-space:pre-wrap}" +
    ".dd-rich-li{display:flex;gap:8px;padding-left:calc(var(--rich-level,0)*22px)}.dd-sticky-todo{display:flex;gap:8px}mark{background:#FFE58F}code{font:13px Menlo,monospace;background:#f4f4f2;padding:0 3px;border-radius:3px}a{color:#1F6FEB}" +
    "</style></head><body><h1>" + esc(DDdocName(text)) + "</h1>" + html + "</body></html>";
}
export function DDdocSave(name, content, type) {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch { return false; }
}
// Print to PDF from a hidden frame, so no new window or tab opens.
export function DDdocPrint(page) {
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const w = frame.contentWindow;
    w.document.open(); w.document.write(page); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} setTimeout(() => frame.remove(), 60000); }, 120);
    return true;
  } catch { return false; }
}

const DOC_ICON = "M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 12h7M9 15.5h7M9 9h3";
function DocGlyph({ React: R, size = 18 }) {
  return R.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    R.createElement("path", { d: DOC_ICON }));
}
export const DDdocIconPath = DOC_ICON;

// The document on the Board: a card with its name and the start of its words,
// or a small icon with its name under it.
export function DDDocCard({ React: R, node, language }) {
  const h = R.createElement, { body } = DDdocSplit(node.title), name = DDdocName(node.title);
  if (node.docView === "icon")
    return h("div", { className: "dd-doc-icon", dir: "auto" },
      h("span", { className: "dd-doc-icon-page", "aria-hidden": true }, h(DocGlyph, { React: R, size: 34 })),
      h("b", null, name));
  return h("div", { className: "dd-doc-card", dir: "auto" },
    h("header", null, h(DocGlyph, { React: R, size: 15 }), h("small", null, "Document")),
    h("b", { className: "dd-doc-name" }, name),
    body.trim()
      ? h("div", { className: "dd-doc-preview" }, h(DDRichText, { React: R, text: body.split("\n").slice(0, 40).join("\n"), language }))
      : h("p", { className: "dd-doc-empty" }, "Double-click to write"));
}

// The document full size: its name, a bar of text styles, the words to write
// in, a Read view, and Save as. Changes are handed up as the whole text.
export function DDDocumentView({ React: R, text, onChange, onClose, language, readOnly }) {
  const h = R.createElement, split = DDdocSplit(text);
  const [name, setName] = R.useState(split.name), [body, setBody] = R.useState(split.body);
  const [mode, setMode] = R.useState(readOnly || split.body.trim() ? "read" : "write"), [saveOpen, setSaveOpen] = R.useState(false);
  const area = R.useRef(null), page = R.useRef(null), box = R.useRef(null), saveButton = R.useRef(null), caret = R.useRef(null), nameRef = R.useRef(null), latest = R.useRef({ name, body });
  latest.current = { name, body };
  const full = (n = name, b = body) => DDdocJoin(n, b);
  // Hand changes up a moment after typing stops, and always on close.
  const timer = R.useRef(0);
  const push = (n, b) => { clearTimeout(timer.current); timer.current = setTimeout(() => onChange(full(n, b)), 400); };
  R.useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => { clearTimeout(timer.current); const t = DDdocJoin(latest.current.name, latest.current.body); if (t !== text) onChange(t); onClose(); };
  R.useEffect(() => {
    if (mode === "write" && area.current && document.activeElement !== nameRef.current) area.current.focus({ preventScroll: true });
    if (!split.name && !readOnly) nameRef.current?.focus();
    // Keys stay with the document (Escape closes it), whatever was focused before.
    if (!box.current?.contains(document.activeElement)) box.current?.focus({ preventScroll: true });
  }, []);
  R.useLayoutEffect(() => {
    const el = area.current, c = caret.current;
    if (el && c) { el.setSelectionRange(c.start, c.end); caret.current = null; }
    if (el) { el.style.height = "auto"; el.style.height = Math.max(320, el.scrollHeight) + "px"; }
  });
  const setWords = (r) => {
    // Same words (nothing to change): just put the caret where it belongs.
    if (r.text === body) { area.current?.setSelectionRange(r.start, r.end); return; }
    setBody(r.text); caret.current = { start: r.start, end: r.end }; push(name, r.text);
  };
  const format = (kind, arg) => {
    if (readOnly) return;
    if (mode !== "write") setMode("write");
    const el = area.current, s = el ? el.selectionStart : body.length, e = el ? el.selectionEnd : body.length;
    if (kind === "link" && arg === undefined) {
      const url = typeof prompt === "function" ? prompt("Link address") : null;
      if (url === null) return;
      arg = url;
    }
    setWords(DDrichFormat(body, s, e, kind, arg));
    requestAnimationFrame(() => area.current?.focus({ preventScroll: true }));
  };
  const save = (kind) => {
    setSaveOpen(false);
    saveButton.current?.focus({ preventScroll: true });
    const t = full(), html = page.current?.innerHTML || "";
    if (kind === "md") DDdocSave(DDdocFileName(t, "md"), DDdocExportText(t, "md"), "text/markdown;charset=utf-8");
    else if (kind === "txt") DDdocSave(DDdocFileName(t, "txt"), DDdocExportText(t, "txt"), "text/plain;charset=utf-8");
    else if (kind === "doc") DDdocSave(DDdocFileName(t, "doc"), "﻿" + DDdocPage(t, html), "application/msword");
    else if (kind === "pdf") DDdocPrint(DDdocPage(t, html));
  };
  const tool = (kind, label, glyph, extra) => h("button", { type: "button", key: kind, "data-doc-format": kind, title: label, "aria-label": label, disabled: readOnly, onPointerDown: (e) => e.preventDefault(), onClick: () => format(kind), ...extra }, glyph);
  const stop = (e) => e.stopPropagation();
  const n = words(full());
  return h("div", { className: "dd-doc-backdrop", onPointerDown: (e) => { stop(e); if (e.target === e.currentTarget) close(); }, onWheel: stop, onContextMenu: stop, onDoubleClick: stop,
    onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); if (saveOpen) setSaveOpen(false); else close(); } } },
    h("section", { ref: box, tabIndex: -1, className: "dd-doc", role: "dialog", "aria-modal": true, "aria-label": "Document: " + (name || DDdocUntitled), dir: "auto" },
      h("header", { className: "dd-doc-top" },
        h("button", { type: "button", className: "dd-doc-back", onClick: close, "aria-label": "Close document", title: "Close (Esc)" }, "←"),
        h("span", { className: "dd-doc-kind" }, h(DocGlyph, { React: R, size: 16 }), "Document"),
        h("span", { className: "dd-doc-count" }, n === 1 ? "1 word" : n + " words"),
        h("span", { className: "dd-doc-modes", role: "group", "aria-label": "View" },
          h("button", { type: "button", "aria-pressed": mode === "write", disabled: readOnly, onClick: () => setMode("write") }, "Write"),
          h("button", { type: "button", "aria-pressed": mode === "read", onClick: () => setMode("read") }, "Read")),
        h("span", { className: "dd-doc-save-wrap" },
          h("button", { ref: saveButton, type: "button", className: "dd-doc-save", "aria-expanded": saveOpen, "aria-haspopup": "menu", onClick: () => setSaveOpen(!saveOpen) }, "Save as…"),
          saveOpen && h("div", { className: "dd-doc-save-menu", role: "menu", "aria-label": "Save as" },
            [["pdf", "PDF"], ["doc", "Word (.doc)"], ["md", "Markdown (.md)"], ["txt", "Text (.txt)"]].map(([k, l]) =>
              h("button", { type: "button", role: "menuitem", key: k, "data-doc-save": k, onClick: () => save(k) }, l)))),
        h("button", { type: "button", className: "dd-doc-done", onClick: close }, "Done")),
      !readOnly && h("div", { className: "dd-doc-bar", role: "toolbar", "aria-label": "Text formatting" },
        DDrichShortcuts.map(([kind, label, keys]) => tool(kind, label + " (" + keys + ")", { h1: "H1", h2: "H2", normal: "T", small: "t", quote: "❝", codeblock: "{ }" }[kind] || label)),
        h("i", { "aria-hidden": true }),
        tool("bold", "Bold (Ctrl+B)", h("b", null, "B")),
        tool("italic", "Italic (Ctrl+I)", h("i", null, "I")),
        tool("strike", "Strikethrough (Ctrl+Shift+X)", h("s", null, "S")),
        tool("highlight", "Highlight (Ctrl+Shift+H)", h("mark", null, "H")),
        tool("code", "Code (Ctrl+E)", "</>"),
        tool("link", "Link (Ctrl+K)", "🔗"),
        h("i", { "aria-hidden": true }),
        tool("bullet", "Bulleted list (Ctrl+Shift+8)", "•"),
        tool("number", "Numbered list (Ctrl+Shift+7)", "1."),
        tool("todo", "To-do (Ctrl+Shift+9)", "☐")),
      h("div", { className: "dd-doc-paper" },
        h("input", { ref: nameRef, className: "dd-doc-title", value: name, placeholder: DDdocUntitled, "aria-label": "Document name", maxLength: 200, readOnly,
          onChange: (e) => { setName(e.target.value); push(e.target.value, body); },
          onKeyDown: (e) => {
            // Enter goes on to the words.
            if (e.key !== "Enter" || readOnly) return;
            e.preventDefault();
            if (area.current) { area.current.focus(); area.current.setSelectionRange(0, 0); }
            else { setMode("write"); requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(0, 0); }); }
          } }),
        mode === "write"
          ? h("textarea", { ref: area, className: "dd-doc-words", value: body, placeholder: "Start writing…", "aria-label": "Document text", spellCheck: true,
              onChange: (e) => { setBody(e.target.value); push(name, e.target.value); },
              onKeyDown: (e) => {
                const el = e.currentTarget, kind = DDrichKey(e);
                if (kind) { e.preventDefault(); format(kind); return; }
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && el.selectionStart === el.selectionEnd) {
                  const r = DDrichEnter(el.value, el.selectionStart);
                  if (r) { e.preventDefault(); setWords(r); }
                } else if (e.key === "Tab") {
                  const r = DDrichTab(el.value, el.selectionStart, el.selectionEnd, e.shiftKey);
                  if (r) { e.preventDefault(); setWords(r); }
                }
              } })
          : h("div", { className: "dd-doc-read", onDoubleClick: readOnly ? undefined : () => setMode("write") },
              body.trim() ? h(DDRichText, { React: R, text: body, language, onToggle: readOnly ? undefined : (i) => {
                const lines = body.split("\n"), line = lines[i];
                if (line === undefined) return;
                lines[i] = line.replace(/\[([ xX])\]/, (m, c) => (c === " " ? "[x]" : "[ ]"));
                const next = lines.join("\n");
                setBody(next); push(name, next);
              } }) : h("p", { className: "dd-doc-empty" }, readOnly ? "Nothing written yet." : "Nothing written yet. Double-click to write."))),
      // The same words, drawn, for Word and PDF.
      h("div", { ref: page, className: "dd-doc-print", "aria-hidden": true }, h(DDRichText, { React: R, text: body, language }))));
}

export const DDdocCSS = `
.b6 .b4-node.b4-sticky.b4-doc{border-radius:6px;overflow:visible}
.b6 .b4-node.b4-doc:not(.b4-doc-icon){background:var(--paper,#fff)!important;color:var(--ink)!important;box-shadow:0 1px 2px #0002,0 6px 18px -8px #0004;border:1px solid var(--rule-2,#0001)}
.b6 .b4-node.b4-doc .b4-sticky-head,.b6 .b4-node.b4-doc .dd-sticky-footer{display:none}
.b6 .b4-node.b4-doc>.b4-node-body{height:100%;overflow:hidden}
.dd-doc-card{display:flex;flex-direction:column;gap:6px;height:100%;padding:14px 16px 0;box-sizing:border-box;text-align:start;overflow:hidden;position:relative}
.b4-doc:not(.b4-doc-icon)::after{content:"";position:absolute;left:1px;right:1px;bottom:1px;height:36px;border-radius:0 0 6px 6px;background:linear-gradient(transparent,var(--paper,#fff));pointer-events:none}
.dd-doc-card header{display:flex;align-items:center;gap:6px;color:var(--ink-3,#777);font:600 10px/1 var(--sans);text-transform:uppercase;letter-spacing:.06em}
.dd-doc-card header svg{color:var(--board-selection,#0D99FF)}
.dd-doc-name{font:700 calc(var(--object-size,16px)*1.12)/1.25 var(--sans);overflow-wrap:anywhere}
.dd-doc-preview{font:calc(var(--object-size,16px)*.8)/1.5 var(--sans);color:var(--ink-2,var(--ink));pointer-events:none}
.dd-doc-preview a{pointer-events:none}
.dd-doc-empty{margin:0;color:var(--ink-3,#888);font:italic 12px var(--sans)}
.b6 .b4-node.b4-doc-icon{background:transparent!important;box-shadow:none!important}
.dd-doc-icon{display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;padding-top:4px;box-sizing:border-box;color:var(--ink)}
.dd-doc-icon-page{display:grid;place-items:center;width:72px;height:88px;border-radius:6px;background:var(--paper,#fff);color:var(--board-selection,#0D99FF);box-shadow:0 1px 2px #0002,0 6px 16px -8px #0005;border:1px solid var(--rule-2,#0001)}
.dd-doc-icon b{max-width:100%;font:600 12px/1.3 var(--sans);text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.b4-node.b4-doc-icon.selected .dd-doc-icon-page{outline:2px solid var(--board-selection,#0D99FF);outline-offset:2px}
.dd-doc-backdrop{position:fixed;inset:0;z-index:1200;background:color-mix(in srgb,#141413 55%,transparent);display:flex;justify-content:center;align-items:stretch;padding:24px;box-sizing:border-box;cursor:default}
.dd-doc:focus{outline:none}
.dd-doc{display:flex;flex-direction:column;width:min(860px,100%);border-radius:14px;background:var(--wash,#F6F5F1);color:var(--ink);box-shadow:0 30px 80px -20px #000a;overflow:hidden}
.dd-doc-top{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--rule-2,#0001);font:13px var(--sans)}
.dd-doc-top button{all:unset;cursor:pointer;box-sizing:border-box;padding:5px 12px;border-radius:8px;font:500 13px var(--sans)}
.dd-doc-top button:hover,.dd-doc-top button:focus-visible{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.dd-doc-back{font-size:17px!important}
.dd-doc-kind{display:flex;align-items:center;gap:6px;font-weight:600;color:var(--ink-2,var(--ink))}
.dd-doc-kind svg{color:var(--board-selection,#0D99FF)}
.dd-doc-count{color:var(--ink-3,#888);font-size:12px;margin-inline-end:auto}
.dd-doc-modes{display:flex;padding:2px;border-radius:9px;background:color-mix(in srgb,var(--ink) 7%,transparent)}
.dd-doc-modes button{padding:4px 12px!important}
.dd-doc-modes button[aria-pressed=true]{background:var(--paper,#fff)!important;box-shadow:0 1px 2px #0002}
.dd-doc-save-wrap{position:relative}
.dd-doc-save{border:1px solid var(--rule-2,#0002)!important}
.dd-doc-save-menu{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:2;display:flex;flex-direction:column;min-width:170px;padding:5px;border-radius:10px;background:var(--paper,#fff);border:1px solid var(--rule-2,#0002);box-shadow:0 14px 30px -12px #0006}
.dd-doc-save-menu button{padding:8px 10px!important}
.dd-doc-done{background:var(--ink)!important;color:var(--paper,#fff)!important}
.dd-doc-bar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px 12px;border-bottom:1px solid var(--rule-2,#0001)}
.dd-doc-bar button{all:unset;cursor:pointer;box-sizing:border-box;min-width:30px;height:30px;padding:0 7px;border-radius:7px;display:grid;place-items:center;font:600 13px var(--sans);color:var(--ink-2,var(--ink))}
.dd-doc-bar button:hover,.dd-doc-bar button:focus-visible{background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink)}
.dd-doc-bar mark{background:#FFE58F;color:#121211;padding:0 3px;border-radius:2px}
.dd-doc-bar>i{width:1px;height:18px;margin:0 6px;background:var(--rule-2,#0002)}
.dd-doc-paper{flex:1;overflow:auto;padding:40px clamp(20px,8vw,96px) 80px;background:var(--paper,#fff)}
.dd-doc-title{all:unset;display:block;width:100%;box-sizing:border-box;font:700 32px/1.25 var(--sans);color:var(--ink);margin-bottom:18px}
.dd-doc-title::placeholder{color:var(--ink-3,#aaa)}
.dd-doc-words{all:unset;display:block;width:100%;box-sizing:border-box;min-height:320px;white-space:pre-wrap;overflow-wrap:anywhere;font:17px/1.65 var(--sans);color:var(--ink);resize:none}
.dd-doc-words::placeholder{color:var(--ink-3,#aaa)}
.dd-doc-read{font:17px/1.65 var(--sans);color:var(--ink);min-height:320px}
.dd-doc-read .dd-rich-h1{font-size:1.5em;margin:.9em 0 .3em}
.dd-doc-read .dd-rich-h2{font-size:1.22em;margin:.8em 0 .25em}
.dd-doc-print{display:none}
@media(max-width:700px){.dd-doc-backdrop{padding:0}.dd-doc{border-radius:0}.dd-doc-count,.dd-doc-kind{display:none}.dd-doc-paper{padding:24px 18px 80px}.dd-doc-title{font-size:26px}.dd-doc-top{gap:4px;padding:8px}}
`;
