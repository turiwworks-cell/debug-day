// Deadlines (5.46). A Feed note or section can carry the day it is due (`due`).
// It shows as a small "◆ 8 days left" beside a section's name, above a note
// (never on the paper), and on that day in the Calendar. Nothing turns red and
// nothing moves on its own; a passed date just says so.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function DDdueClean(value) {
  if (typeof value !== "string" || !DAY.test(value)) return undefined;
  const at = new Date(value + "T12:00:00Z");
  return Number.isFinite(+at) && at.toISOString().slice(0, 10) === value ? value : undefined;
}

export const DDdueOf = (item) => DDdueClean(item?.due) || "";

export function DDdueSet(item, due) {
  const { due: _old, ...rest } = item || {};
  const clean = DDdueClean(due);
  return clean ? { ...rest, due: clean } : rest;
}

const shift = (date, n) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export function DDdueDaysLeft(due, today) {
  if (!DDdueClean(due) || !DDdueClean(today)) return null;
  return Math.round((Date.parse(due + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5);
}

// "8 days left", "tomorrow", "today", "date passed".
export function DDdueText(due, today, language) {
  const fa = language === "fa", left = DDdueDaysLeft(due, today), num = (n) => (fa ? n.toLocaleString("fa-IR") : String(n));
  if (left === null) return "";
  if (left > 1) return fa ? num(left) + " روز مانده" : left + " days left";
  if (left === 1) return fa ? "فردا" : "tomorrow";
  if (left === 0) return fa ? "امروز" : "today";
  return fa ? "تاریخش گذشت" : "date passed";
}

export function DDdueDate(due, language) {
  let calendar = language === "fa" ? "persian" : "gregory";
  try { const saved = JSON.parse(localStorage.getItem("debug-day:review-calendar")); if (["persian", "gregory"].includes(saved)) calendar = saved; } catch {}
  try { return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", { calendar, day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(due + "T12:00:00Z")); } catch { return due; }
}

// The first words of a note, or a section's name.
export function DDdueName(item, language) {
  const line = String(item?.text || "").split("\n").map((l) => l.replace(/^\s*(?:#+|- \[[ xX]\]|[-*•])\s*/, "").trim()).find(Boolean);
  return (line || (item?.type === "section" ? (language === "fa" ? "سکشن" : "Section") : language === "fa" ? "نوت" : "Note")).slice(0, 60);
}

// Feed items with a deadline between two days (both included), soonest first.
export function DDdueBetween(items, from, to) {
  return (items || []).filter((i) => { const d = DDdueOf(i); return d && (!from || d >= from) && (!to || d <= to); })
    .sort((a, b) => a.due.localeCompare(b.due) || String(a.text).localeCompare(String(b.text)));
}

export const DDdueOn = (items, date) => DDdueBetween(items, date, date);

export function DDduePresets(today, language) {
  const fa = language === "fa";
  return [
    [3, fa ? "۳ روز دیگه" : "In 3 days"],
    [7, fa ? "یه هفته دیگه" : "In a week"],
    [14, fa ? "دو هفته دیگه" : "In 2 weeks"],
    [30, fa ? "یه ماه دیگه" : "In a month"],
  ].map(([n, label]) => ({ date: shift(today, n), label }));
}

// A small card with a date field and a few soft choices.
export function DDDueEditor({ React: R, item, today, language, onChange, onClose, style }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en),
    due = DDdueOf(item), ref = R.useRef(null);
  R.useEffect(() => {
    ref.current?.querySelector("input")?.focus({ preventScroll: true });
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, []);
  const pick = (value) => { onChange(value || null); onClose(); };
  return h("div", {
      ref, className: "dd-due-editor", role: "dialog", "aria-label": t("Deadline", "ددلاین"), dir: fa ? "rtl" : "ltr", style,
      onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation(),
      onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); onClose(); } },
    },
    h("b", null, t("Deadline for “", "ددلاینِ «") + DDdueName(item, language) + t("”", "»")),
    h("label", null, h("span", null, t("Due on", "تا تاریخ")),
      h("input", { type: "date", value: due, "aria-label": t("Due on", "تا تاریخ"), onChange: (e) => onChange(e.target.value || null),
        onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); onClose(); } } })),
    h("div", { className: "dd-due-presets" }, DDduePresets(today, language).map((p) =>
      h("button", { key: p.date, type: "button", "aria-pressed": due === p.date, onClick: () => pick(p.date) }, p.label))),
    h("div", { className: "dd-due-actions" },
      due && h("button", { type: "button", className: "dd-due-clear", onClick: () => pick(null) }, t("No deadline", "بدون ددلاین")),
      h("button", { type: "button", className: "dd-due-done", onClick: onClose }, t("Done", "باشه"))));
}

export const DDdueCSS = `
.dd-due-editor{position:absolute;z-index:60;width:260px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 0 0 1px var(--rule-2,#dcd9cf),0 12px 32px -12px #0004;font:400 13px/1.35 var(--sans,system-ui)}
.dd-due-editor>b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-due-editor label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--ink-3,#77746b)}
.dd-due-editor input{height:34px;border-radius:9px;border:1px solid var(--rule-2,#dcd9cf);background:var(--paper,#fff);color:var(--ink,#121211);padding:0 10px;font:inherit;font-size:14px}
.dd-due-presets{display:flex;flex-wrap:wrap;gap:6px}
.dd-due-editor button{height:30px;padding:0 11px;border-radius:999px;border:0;background:var(--wash,#f1efe9);color:var(--ink-2,#4a4843);box-shadow:inset 0 0 0 1px var(--rule,#e6e3da);font:500 12px/1 var(--sans,system-ui);cursor:pointer}
.dd-due-editor button[aria-pressed=true]{background:var(--ink,#121211);color:var(--paper,#fff);box-shadow:none}
.dd-due-actions{display:flex;justify-content:flex-end;gap:6px}
.dd-due-editor .dd-due-done{background:var(--ink,#121211);color:var(--paper,#fff);box-shadow:none}
.dd-due-editor .dd-due-clear{background:none;box-shadow:none}
@media (pointer:coarse){.dd-due-editor button{height:40px}.dd-due-editor input{height:44px}}
.b6 .dd-due-badge{--k:clamp(.9,var(--b4-inverse,1),3);position:absolute;left:2px;bottom:100%;margin:0 0 5px;display:inline-flex;align-items:center;gap:4px;height:20px;max-width:100%;min-width:0;min-height:0;padding:0 8px 0 6px;border:1px solid color-mix(in srgb,var(--ink,#121211) 14%,transparent);border-radius:999px;background:var(--paper,#fff);color:color-mix(in srgb,var(--ink,#121211) 70%,transparent);font:600 11px/1 var(--sans,system-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px -5px #0005;transform:scale(var(--k));transform-origin:0 100%;cursor:pointer;z-index:8}
.b6 .dd-due-badge:hover,.b6 .dd-due-badge:focus-visible{color:var(--ink,#121211)}
.b6 .dd-due-badge[data-left="passed"]{color:var(--ink-3,#77746b);font-weight:500}
.b6 .b4-life-section>.dd-sec-history .dd-sec-due{font-weight:500;color:var(--ink-2,#4a4843);white-space:nowrap}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-due-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-due-styles", textContent: DDdueCSS }));
