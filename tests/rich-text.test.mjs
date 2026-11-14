import test from "node:test";
import assert from "node:assert/strict";
import { DDrichFormat, DDrichKey, DDrichEnter, DDrichTab, DDrichPlain, DDRichText } from "../public/rich-text.js";

const f = (text, kind, start = 0, end = text.length, arg) => DDrichFormat(text, start, end, kind, arg).text;

test("headings, small text and quotes are set per line and toggle off", () => {
  assert.equal(f("Title", "h1"), "# Title");
  assert.equal(f("# Title", "h1"), "Title");
  assert.equal(f("# Title", "h2"), "## Title");
  assert.equal(f("## Title", "normal"), "Title");
  assert.equal(f("a\nb", "quote"), "> a\n> b");
  assert.equal(f("note", "small"), "-# note");
  assert.equal(f("one\ntwo", "h2", 5, 5), "one\n## two", "only the caret's line");
});

test("lists: bullets, numbers and to-dos replace each other and keep empty lines", () => {
  assert.equal(f("a\nb", "bullet"), "- a\n- b");
  assert.equal(f("- a\n- b", "bullet"), "a\nb");
  assert.equal(f("a\n\nb", "number"), "1. a\n\n2. b");
  assert.equal(f("- a", "number"), "1. a");
  assert.equal(f("a", "todo"), "- [ ] a");
});

test("inline marks wrap and unwrap", () => {
  assert.equal(f("word", "italic"), "_word_");
  assert.equal(f("_word_", "italic"), "word");
  assert.equal(f("glow", "highlight"), "==glow==");
  assert.equal(f("x", "code"), "`x`");
  assert.equal(f("word", "bold"), "**word**");
});

test("links: chosen words get an address, a bare address stays bare, an empty one removes it", () => {
  assert.equal(f("my site", "link", 0, 7, "example.com"), "[my site](https://example.com)");
  assert.equal(f("", "link", 0, 0, "https://a.io"), "https://a.io");
  assert.equal(f("[my site](https://example.com)", "link", 0, 30, ""), "my site");
  assert.equal(f("[x](https://a.io)", "link", 0, 17, "https://b.io"), "[x](https://b.io)");
});

test("code blocks wrap lines in fences and come off again", () => {
  const on = DDrichFormat("a\nb", 0, 3, "codeblock");
  assert.equal(on.text, "```\na\nb\n```");
  assert.equal(DDrichFormat(on.text, on.start, on.end, "codeblock").text, "a\nb");
});

test("Enter continues a list, steps out of an empty item, and Tab indents list lines only", () => {
  assert.deepEqual(DDrichEnter("- a", 3), { text: "- a\n- ", start: 6, end: 6 });
  assert.equal(DDrichEnter("1. a", 4).text, "1. a\n2. ");
  assert.equal(DDrichEnter("- [x] a", 7).text, "- [x] a\n- [ ] ");
  assert.equal(DDrichEnter("- a\n  - ", 8).text, "- a\n- ");
  assert.equal(DDrichEnter("- a\n- ", 6).text, "- a\n");
  assert.equal(DDrichEnter("plain", 5), null);
  assert.equal(DDrichTab("- a", 3, 3, false).text, "  - a");
  assert.equal(DDrichTab("  - a", 5, 5, true).text, "- a");
  assert.equal(DDrichTab("plain", 2, 2, false), null);
});

test("shortcuts follow Milanote, with To-do kept on Ctrl+Shift+9", () => {
  const k = (o) => DDrichKey({ ctrlKey: true, ...o });
  assert.equal(k({ code: "KeyB", key: "b" }), "bold");
  assert.equal(k({ code: "KeyK", key: "k" }), "link");
  assert.equal(k({ shiftKey: true, code: "Digit1" }), "h1");
  assert.equal(k({ shiftKey: true, code: "Digit0" }), "normal");
  assert.equal(k({ shiftKey: true, code: "Digit9" }), "todo");
  assert.equal(k({ shiftKey: true, code: "Period" }), "codeblock");
  assert.equal(DDrichKey({ code: "KeyB", key: "b" }), null);
});

test("plain words drop every mark", () => {
  assert.equal(DDrichPlain("## Plan\n- [ ] **sketch** [site](https://a.io) ==now=="), "Plan\nsketch site now");
});

test("the renderer draws headings, numbered lists, links and code", () => {
  const els = [];
  const R = { createElement: (type, props, ...kids) => { const el = { type, props: props || {}, kids }; els.push(el); return el; } };
  DDRichText({ React: R, text: "# Big\n1. a\n1. b\n  - c\nsee https://a.io\n```\nx\n```", language: "en" });
  assert.ok(els.some((e) => e.props.className === "dd-rich-h1"));
  const markers = els.filter((e) => e.props.className === "dd-rich-marker").map((e) => e.kids[0]);
  assert.deepEqual(markers, ["1.", "2.", "◦"], "numbers count themselves; a nested bullet gets its own mark");
  assert.ok(els.some((e) => e.type === "a" && e.props.href === "https://a.io" && e.props.rel.includes("noopener")));
  assert.ok(els.some((e) => e.type === "pre"));
  els.length = 0;
  DDRichText({ React: R, text: "[x](javascript:alert(1))", language: "en" });
  assert.equal(els.some((e) => e.type === "a"), false, "only web and mail links");
});

test("bold and friends go inside a heading or list mark", () => {
  assert.equal(f("## Plan", "italic"), "## _Plan_");
  assert.equal(f("- sketch", "highlight"), "- ==sketch==");
});
