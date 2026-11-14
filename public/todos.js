// To-do lists (5.65), after Milanote: a card of tasks with tick boxes. It can
// have a title, tasks go in and out with Tab and Shift+Tab, a task can have a
// due date (and a time for a reminder), and a done task has a small bin next
// to it. Tasks are dragged up and down by their grip.
//
// A to-do list is a note (sticky) with the style key `todo`, so sync, Lanes,
// search, tags and wires work unchanged. Its words stay plain marks that every
// other view reads as they are:
//   # Title                 (only when the list has a title)
//   - [ ] A task            (two spaces in front: one level in)
//   - [x] A done task
//   - [ ] Send it 📅2026-11-20        a due date
//   - [ ] Call 📅2026-11-20T14:30     a due date with a time (a reminder)

import { DDdueText, DDdueDate, DDdueClean } from "./deadlines.js";

export function DDtodoLook(raw) {
  return raw && typeof raw === "object" && raw.todo === true ? { todo: true } : {};
}
export const DDtodoSize = { width: 260, height: 120 };

const TASK = /^(\s*)- \[([ xX])\]\s?(.*)$/;
const DUE = /\s*📅(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?\s*$/;
const MAX_LEVEL = 4;

export function DDtodoDueClean(due) {
  const m = String(due || "").match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m || !DDdueClean(m[1])) return "";
  if (m[2] === undefined) return m[1];
  return +m[2] < 24 && +m[3] < 60 ? m[1] + "T" + m[2] + ":" + m[3] : m[1];
}

// Words → { title, items: [{ level, done, text, due }] }. A line that is not a
// task becomes one, so a note turned into a list keeps every line.
export function DDtodoParse(text) {
  const lines = String(text || "").split("\n");
  let title = null;
  if (lines.length && /^\s*#{1,6}(\s|$)/.test(lines[0])) title = lines.shift().replace(/^\s*#{1,6}\s?/, "").trim();
  const items = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(TASK);
    let level, done, words;
    if (m) { level = Math.floor(m[1].replace(/\t/g, "  ").length / 2); done = m[2] !== " "; words = m[3]; }
    else { const lead = line.match(/^\s*/)[0]; level = Math.floor(lead.length / 2); done = false; words = line.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, "").replace(/^#{1,6}\s+/, ""); }
    const d = words.match(DUE), due = d ? DDtodoDueClean(d[1] + (d[2] ? "T" + d[2] : "")) : "";
    items.push({ level: Math.min(MAX_LEVEL, level), done, text: d ? words.replace(DUE, "") : words, ...(due ? { due } : {}) });
  }
  return { title, items };
}

export function DDtodoJoin({ title, items }) {
  const rows = (items || []).map((i) => "  ".repeat(Math.max(0, Math.min(MAX_LEVEL, i.level || 0))) + "- [" + (i.done ? "x" : " ") + "] " +
    String(i.text || "").replace(/\n+/g, " ") + (DDtodoDueClean(i.due) ? " 📅" + DDtodoDueClean(i.due) : ""));
  return [...(title !== null && title !== undefined ? ["# " + String(title).replace(/\n+/g, " ")] : []), ...rows].join("\n");
}

// A note becomes a list: its first heading is the title, every other line a task.
export function DDtodoFromNote(text) {
  const p = DDtodoParse(text);
  return DDtodoJoin({ title: p.title, items: p.items.length ? p.items : [{ level: 0, done: false, text: "" }] });
}
export const DDtodoEmpty = DDtodoJoin({ title: null, items: [{ level: 0, done: false, text: "" }] });

export function DDtodoProgress(text) {
  const items = DDtodoParse(text).items.filter((i) => i.text.trim());
  return { done: items.filter((i) => i.done).length, all: items.length };
}

// Moves: one task with the tasks under it (a deeper level right after it).
function branchEnd(items, i) {
  let j = i + 1;
  while (j < items.length && items[j].level > items[i].level) j++;
  return j;
}
export function DDtodoMove(items, from, to) {
  if (from === to || from < 0 || from >= items.length) return items;
  const end = branchEnd(items, from), part = items.slice(from, end), rest = [...items.slice(0, from), ...items.slice(end)];
  if (to > from && to < end) return items;
  const at = Math.max(0, Math.min(rest.length, to > from ? to - part.length : to));
  return [...rest.slice(0, at), ...part, ...rest.slice(at)];
}

// "today", "tomorrow", "6 days left", with the date and a time when there is one.
export function DDtodoDueLabel(due, today, language) {
  const clean = DDtodoDueClean(due);
  if (!clean) return "";
  const [day, time] = clean.split("T"), left = DDdueText(day, today, language);
  return DDdueDate(day, language) + (time ? " · " + time : "") + (left ? " · " + left : "");
}

// Tasks with a due date that are not done, as Calendar rows (one per task).
export function DDtodoDueItems(lists) {
  const out = [];
  for (const { id, text, color } of lists || []) {
    DDtodoParse(text).items.forEach((it, i) => {
      if (!it.due || it.done || !it.text.trim()) return;
      out.push({ id: "todo:" + id + ":" + i, type: "todo", text: it.text, due: it.due.slice(0, 10), time: it.due.slice(11), color });
    });
  }
  return out;
}
// Every to-do list in the data: day notes and Feed notes with the to-do style.
export function DDtodoLists(data) {
  const lists = [];
  for (const it of data?.setup?.life?.items || []) if (it?.type === "sticky" && it.style?.todo === true) lists.push({ id: "life:" + it.id, text: it.text, color: it.color });
  for (const [date, day] of Object.entries(data?.days || {})) {
    const styles = day?.canvas?.board4?.styles || {};
    for (const n of day?.notes || []) if (styles["sticky:" + n.id]?.todo === true) lists.push({ id: date + ":" + n.id, text: n.text, color: n.color });
  }
  return lists;
}

// Reminders: a task with a time says so once, when that time comes, while the
// app is open (a browser notification when allowed, else a soft line on screen).
export function DDtodoRemindersDue(data, now = new Date(), told = new Set()) {
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + "T" + pad(now.getHours()) + ":" + pad(now.getMinutes());
  const dayAgo = new Date(now.getTime() - 864e5), since = dayAgo.getFullYear() + "-" + pad(dayAgo.getMonth() + 1) + "-" + pad(dayAgo.getDate()) + "T" + pad(dayAgo.getHours()) + ":" + pad(dayAgo.getMinutes());
  return DDtodoDueItems(DDtodoLists(data)).filter((r) => r.time && r.due + "T" + r.time <= stamp && r.due + "T" + r.time > since)
    .map((r) => ({ key: r.id + "@" + r.due + "T" + r.time + ":" + r.text.slice(0, 40), text: r.text, at: r.due + "T" + r.time }))
    .filter((r) => !told.has(r.key));
}
let reminderTimer = null;
// A soft line at the bottom of the screen; it goes away on its own or on a click.
function toast(words) {
  if (typeof document === "undefined") return;
  const el = Object.assign(document.createElement("div"), { className: "dd-todo-toast", role: "status", textContent: words });
  el.addEventListener("click", () => el.remove());
  document.body.append(el);
  setTimeout(() => el.remove(), 12000);
}
export function DDtodoStartReminders(read, say) {
  if (reminderTimer || typeof window === "undefined") return;
  const load = () => { try { return new Set(JSON.parse(localStorage.getItem("debug-day:todo-told") || "[]")); } catch { return new Set(); } };
  const tick = () => {
    let data = null;
    try { data = read(); } catch {}
    if (!data) return;
    const told = load(), due = DDtodoRemindersDue(data, new Date(), told);
    if (!due.length) return;
    for (const r of due) {
      told.add(r.key);
      let shown = false;
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") { new Notification("Debug Day", { body: "☐ " + r.text, tag: r.key }); shown = true; } } catch {}
      if (!shown) (say || toast)("☐ " + r.text);
    }
    try { localStorage.setItem("debug-day:todo-told", JSON.stringify([...told].slice(-300))); } catch {}
  };
  tick();
  reminderTimer = setInterval(tick, 30000);
}

const ICON = {
  grip: "M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01",
  bin: "M3.5 5.5h13M8 5.5V3h4v2.5M5.5 5.5l1 12h7l1-12",
  due: "M4 5.5h12v11H4zM4 9h12M7.5 3.5v3M12.5 3.5v3",
  title: "M4 5h12M10 5v11",
  plus: "M10 4v12M4 10h12",
};
const svg = (h, d, size = 14) => h("svg", { width: size, height: size, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d }));

// The due date card for one task: a day, an optional time, Remove, Done.
function DueCard({ React: R, value, language, onChange, onClose }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en), ref = R.useRef(null);
  const [day, time] = (DDtodoDueClean(value) || "T").split("T");
  R.useEffect(() => {
    ref.current?.querySelector("input")?.focus({ preventScroll: true });
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, []);
  const set = (d, tm) => onChange(d ? DDtodoDueClean(d + (tm ? "T" + tm : "")) : "");
  const quick = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
  return h("div", { ref, className: "dd-todo-due-card", role: "dialog", "aria-label": t("Due date", "تاریخ سررسید"), dir: fa ? "rtl" : "ltr",
      onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(),
      onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); onClose(); } } },
    h("label", null, h("span", null, t("Due date", "تاریخ")),
      h("input", { type: "date", value: day || "", "aria-label": t("Due date", "تاریخ"), onChange: (e) => set(e.target.value, time) })),
    h("div", { className: "dd-todo-due-quick" },
      [[0, t("Today", "امروز")], [1, t("Tomorrow", "فردا")], [7, t("Next week", "هفتهٔ بعد")]].map(([n, label]) =>
        h("button", { type: "button", key: n, "aria-pressed": day === quick(n), onClick: () => set(quick(n), time) }, label))),
    h("label", null, h("span", null, t("Remind me at (optional)", "یادآوری در ساعت (اختیاری)")),
      h("input", { type: "time", value: time || "", disabled: !day, "aria-label": t("Reminder time", "ساعت یادآوری"),
        onChange: (e) => { set(day, e.target.value); if (e.target.value && typeof Notification !== "undefined" && Notification.permission === "default") { try { Notification.requestPermission(); } catch {} } } })),
    h("div", { className: "dd-todo-due-actions" },
      day && h("button", { type: "button", className: "dd-todo-due-clear", onClick: () => { onChange(""); onClose(); } }, t("Remove due date", "حذف تاریخ")),
      h("button", { type: "button", className: "dd-todo-due-done", onClick: onClose }, t("Done", "باشه"))));
}

// The card on the board. Unpicked it shows the list (tick boxes still tick);
// picked, each task is a line to type in, with the list's tools above it.
export function DDTodoCard({ React: R, node, text, picked, focusAsk, language, today, readOnly, onChange }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => (fa ? f : en);
  const parsed = R.useMemo(() => DDtodoParse(text), [text]);
  const [local, setLocal] = R.useState(parsed), [active, setActive] = R.useState(-1), [dueFor, setDueFor] = R.useState(null), [drag, setDrag] = R.useState(null);
  const root = R.useRef(null), focusNext = R.useRef(null), localRef = R.useRef(local), typing = R.useRef(false);
  localRef.current = local;
  // Words from elsewhere (sync, undo, another view) come in when nothing is being typed here.
  R.useEffect(() => { if (!typing.current) setLocal(parsed); }, [parsed]);
  R.useEffect(() => { if (!picked) { setActive(-1); setDueFor(null); } }, [picked]);
  // Double-click or Enter on the card: start typing in the first task (or the last).
  R.useEffect(() => {
    if (!focusAsk || readOnly) return;
    const list = localRef.current.items;
    if (!list.length) { const next = { ...localRef.current, items: [{ level: 0, done: false, text: "" }] }; setLocal(next); onChange(DDtodoJoin(next), null); focusNext.current = { i: 0, at: 0 }; return; }
    focusNext.current = { i: list.length - 1, at: list[list.length - 1].text.length };
    setActive(list.length - 1);
  }, [focusAsk]);
  R.useLayoutEffect(() => {
    const f = focusNext.current;
    if (!f || !root.current) return;
    const el = root.current.querySelector(f.title ? "[data-todo-title]" : '[data-todo-index="' + f.i + '"]');
    if (!el) return;
    focusNext.current = null;
    el.focus({ preventScroll: true });
    if (typeof f.at === "number" && el.setSelectionRange) el.setSelectionRange(f.at, f.at);
  });
  // Every text box is as tall as its words.
  R.useLayoutEffect(() => { root.current?.querySelectorAll("textarea").forEach((el) => { el.style.height = "0px"; el.style.height = el.scrollHeight + "px"; }); });

  const save = (next, message = null) => { setLocal(next); onChange(DDtodoJoin(next), message); };
  const setItems = (fn, message) => save({ ...localRef.current, items: fn(localRef.current.items.map((x) => ({ ...x }))) }, message);
  const toggle = (i) => setItems((items) => { items[i].done = !items[i].done; return items; }, null);
  const remove = (i) => { setItems((items) => items.filter((_, j) => j !== i), t("Task deleted", "کار حذف شد")); focusNext.current = picked ? { i: Math.max(0, i - 1) } : null; };
  const add = (after, words = "", level) => {
    setItems((items) => { const lv = level ?? (items[after]?.level || 0); items.splice(after + 1, 0, { level: lv, done: false, text: words }); return items; }, null);
    focusNext.current = { i: after + 1, at: 0 }; setActive(after + 1);
  };
  const stop = (e) => e.stopPropagation();
  // A tap on a task's words picks the card first (so it still moves); once picked it types.
  const textDown = (e) => { if (picked && !readOnly) e.stopPropagation(); };
  function keys(e, i) {
    e.stopPropagation();
    const el = e.target, at = el.selectionStart, end = el.selectionEnd, items = localRef.current.items, it = items[i];
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if ((e.ctrlKey || e.metaKey)) { toggle(i); return; }
      if (!it.text.trim() && it.level > 0) { setItems((list) => { list[i].level--; return list; }); focusNext.current = { i, at: 0 }; return; }
      const head = it.text.slice(0, at), tail = it.text.slice(end);
      setItems((list) => { list[i].text = head; list.splice(i + 1, 0, { level: it.level, done: false, text: tail }); return list; }, null);
      focusNext.current = { i: i + 1, at: 0 }; setActive(i + 1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const max = i === 0 ? 0 : Math.min(MAX_LEVEL, items[i - 1].level + 1);
      setItems((list) => { list[i].level = e.shiftKey ? Math.max(0, list[i].level - 1) : Math.min(max, list[i].level + 1); return list; }, null);
      focusNext.current = { i, at };
    } else if (e.key === "Backspace" && at === 0 && end === 0) {
      if (it.level > 0) { e.preventDefault(); setItems((list) => { list[i].level--; return list; }); focusNext.current = { i, at: 0 }; return; }
      if (i === 0) { if (!it.text && items.length > 1) { e.preventDefault(); remove(0); focusNext.current = { i: 0, at: 0 }; } return; }
      e.preventDefault();
      const prev = items[i - 1].text;
      setItems((list) => { list[i - 1].text = prev + list[i].text; list.splice(i, 1); return list; }, null);
      focusNext.current = { i: i - 1, at: prev.length }; setActive(i - 1);
    } else if (e.key === "ArrowUp" && at === 0 && i > 0) { e.preventDefault(); focusNext.current = { i: i - 1, at: items[i - 1].text.length }; setActive(i - 1); }
    else if (e.key === "ArrowDown" && at === it.text.length && i < items.length - 1) { e.preventDefault(); focusNext.current = { i: i + 1, at: 0 }; setActive(i + 1); }
    else if (e.key === "Escape") { e.preventDefault(); el.blur(); root.current?.closest("[data-board-id]")?.focus({ preventScroll: true }); }
  }
  // Drag a task by its grip to move it (with the tasks under it).
  function gripDown(e, i) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const id = e.pointerId, rows = [...root.current.querySelectorAll("[data-todo-row]")].map((el) => el.getBoundingClientRect());
    let to = i;
    const mv = (ev) => {
      if (ev.pointerId !== id) return;
      to = rows.findIndex((r) => ev.clientY < r.top + r.height / 2);
      if (to < 0) to = rows.length;
      setDrag({ from: i, to });
    };
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
      setDrag(null);
      if (ev.type === "pointerup" && to !== i && to !== i + 1) setItems((items) => DDtodoMove(items, i, to), t("Task moved", "کار جابه‌جا شد"));
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  }
  const { title, items } = local, progress = items.filter((x) => x.text.trim());
  const edit = picked && !readOnly;
  return h("div", { ref: root, className: "dd-todo", dir: "auto", "data-picked": edit || undefined,
      onFocus: () => { typing.current = true; },
      onBlur: (e) => { if (!root.current?.contains(e.relatedTarget)) { typing.current = false; setActive(-1); onChange(DDtodoJoin(localRef.current), null); } } },
    edit && h("div", { className: "dd-todo-tools", role: "toolbar", "aria-label": t("To-do list tools", "ابزار فهرست کارها"), onPointerDown: stop, onDoubleClick: stop },
      h("button", { type: "button", "aria-pressed": title !== null, title: t("Title", "عنوان"), onClick: () => {
        if (title !== null) save({ ...local, title: null }, t("Title removed", "عنوان برداشته شد"));
        else { save({ ...local, title: "" }, null); focusNext.current = { title: true }; }
      } }, svg(h, ICON.title), t("Title", "عنوان")),
      h("button", { type: "button", disabled: active < 0 || !items[active], "aria-expanded": dueFor !== null, title: t("Due date for the task you are in", "تاریخ سررسید برای کاری که در آن هستی"),
        onPointerDown: (e) => e.preventDefault(), onClick: () => setDueFor(dueFor === active ? null : active) }, svg(h, ICON.due), t("Due date", "تاریخ")),
      progress.length > 0 && h("small", { className: "dd-todo-count" }, progress.filter((x) => x.done).length + "/" + progress.length)),
    title !== null && (edit
      ? h("input", { className: "dd-todo-title", "data-todo-title": true, value: title, placeholder: t("Title", "عنوان"), "aria-label": t("List title", "عنوان فهرست"), dir: "auto", maxLength: 200,
          onPointerDown: stop, onChange: (e) => setLocal({ ...local, title: e.target.value }),
          onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusNext.current = { i: 0, at: 0 }; setActive(0); if (!items.length) add(-1); } } })
      : h("div", { className: "dd-todo-title", dir: "auto" }, title || h("span", { className: "dd-todo-hint" }, t("Title", "عنوان")))),
    h("ul", { className: "dd-todo-list", role: "list" },
      items.map((it, i) => h("li", { key: i, "data-todo-row": i, "data-done": it.done || undefined, "data-level": it.level || undefined, "data-active": edit && active === i || undefined,
          "data-drop": drag && drag.to === i ? "before" : drag && drag.to === items.length && i === items.length - 1 ? "after" : undefined, style: { "--todo-level": it.level } },
        h("input", { type: "checkbox", checked: it.done, disabled: readOnly, "aria-label": (it.done ? t("Mark not done: ", "انجام‌نشده: ") : t("Mark done: ", "انجام شد: ")) + (it.text || t("task", "کار")),
          onPointerDown: stop, onClick: stop, onDoubleClick: stop, onChange: () => toggle(i) }),
        h("div", { className: "dd-todo-words" },
          edit
            ? h("textarea", { "data-todo-index": i, rows: 1, value: it.text, dir: "auto", maxLength: 1000, placeholder: t("Add a task…", "یک کار بنویس…"), "aria-label": t("Task", "کار") + " " + (i + 1),
                onPointerDown: textDown, onDoubleClick: stop, onFocus: () => setActive(i),
                onChange: (e) => { const v = e.target.value.replace(/\n/g, " "); setLocal((cur) => ({ ...cur, items: cur.items.map((x, j) => (j === i ? { ...x, text: v } : x)) })); },
                onKeyDown: (e) => keys(e, i) })
            : h("span", null, it.text || h("span", { className: "dd-todo-hint" }, t("Add a task…", "یک کار بنویس…"))),
          it.due && h("button", { type: "button", className: "dd-todo-due", "data-due-past": DDtodoDueClean(it.due).slice(0, 10) < today || undefined, disabled: !edit, title: edit ? t("Change the due date", "تغییر تاریخ") : undefined,
            onPointerDown: edit ? stop : undefined, onClick: () => setDueFor(i) }, svg(h, ICON.due, 11), DDtodoDueLabel(it.due, today, language))),
        // Milanote: a done task has a small bin next to it.
        it.done && !readOnly && h("button", { type: "button", className: "dd-todo-bin", "aria-label": t("Delete task: ", "حذف کار: ") + (it.text || t("task", "کار")), title: t("Delete task", "حذف کار"), onPointerDown: stop, onDoubleClick: stop, onClick: () => remove(i) }, svg(h, ICON.bin)),
        edit && h("button", { type: "button", className: "dd-todo-grip", tabIndex: -1, "aria-label": t("Drag to move the task", "برای جابه‌جایی کار بکش"), onPointerDown: (e) => gripDown(e, i) }, svg(h, ICON.grip)),
        dueFor === i && h(DueCard, { React: R, value: it.due, language, onClose: () => { setDueFor(null); focusNext.current = { i }; },
          onChange: (v) => setItems((list) => { if (v) list[i].due = v; else delete list[i].due; return list; }, v ? t("Due date set", "تاریخ گذاشته شد") : t("Due date removed", "تاریخ برداشته شد")) })))),
    edit && h("button", { type: "button", className: "dd-todo-add", onPointerDown: stop, onDoubleClick: stop, onClick: () => add(items.length - 1, "", items.length ? items[items.length - 1].level : 0) }, svg(h, ICON.plus), t("Add a task", "افزودن کار")),
    !items.length && !edit && h("div", { className: "dd-todo-hint dd-todo-empty" }, t("Double-click to add tasks", "برای افزودن کار دوبار کلیک کن")));
}

export const DDtodoCSS = `
.b6 .b4-node.b4-todo-card{border-radius:10px}
.b6 .b4-todo-card>.b4-node-body{display:block;flex:none;padding:0;overflow:visible;height:auto;min-height:0;max-height:none}
.b6 .b4-todo-card input.dd-todo-title,.b6 .b4-todo-card input.dd-todo-title:focus{background:none!important;border:0!important;box-shadow:none!important;outline:0;height:auto;min-height:0;border-radius:0}
.dd-todo{display:flex;flex-direction:column;gap:2px;padding:10px 10px 10px 8px;font:14px/1.4 var(--sans);color:inherit;text-align:start;cursor:inherit}
.dd-todo{position:relative}
/* The list's tools float under the card (the selection bar is above), so picking it never moves its tasks. */
.dd-todo-tools{position:absolute;top:calc(100% + 10px);inset-inline-start:0;z-index:9;display:flex;align-items:center;gap:2px;padding:3px;border-radius:10px;background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 0 0 1px var(--rule-2,#dcd9cf),0 6px 18px -8px #0005;white-space:nowrap;transform:scale(clamp(.9,var(--b4-inverse,1),3));transform-origin:0 0}
.dd-todo-tools .dd-todo-count{padding:0 6px}
.dd-todo-tools button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 7px;border-radius:7px;font:600 11px/1 var(--sans);cursor:pointer;color:inherit;opacity:.75}
.dd-todo-tools button:hover:not(:disabled),.dd-todo-tools button[aria-pressed=true],.dd-todo-tools button[aria-expanded=true]{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}
.dd-todo-tools button:disabled{opacity:.35;cursor:default}
.dd-todo-count{margin-inline-start:auto;font:600 11px var(--sans);opacity:.6}
.dd-todo-title{all:unset;display:block;box-sizing:border-box;width:100%;font:700 16px/1.3 var(--sans);padding:2px 4px 6px 24px;overflow-wrap:anywhere}
.dd-todo-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.dd-todo-list li{position:relative;display:flex;align-items:flex-start;gap:6px;padding:3px 2px 3px calc(4px + var(--todo-level,0) * 20px);border-radius:6px}
[dir=rtl] .dd-todo-list li,.dd-todo[dir=rtl] .dd-todo-list li{padding:3px calc(4px + var(--todo-level,0) * 20px) 3px 2px}
.dd-todo-list li[data-active]{background:color-mix(in srgb,currentColor 6%,transparent)}
.dd-todo-list li[data-drop=before]{box-shadow:inset 0 2px 0 var(--board-accent,#0D99FF)}
.dd-todo-list li[data-drop=after]{box-shadow:inset 0 -2px 0 var(--board-accent,#0D99FF)}
.b6 .dd-todo input[type=checkbox]{flex:none;width:15px;height:15px;min-width:0;min-height:0;margin:3px 0 0;padding:0;accent-color:var(--board-accent,#0D99FF);cursor:pointer}
.dd-todo-words{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.dd-todo-words>span{white-space:pre-wrap;overflow-wrap:anywhere}
.dd-todo li[data-done] .dd-todo-words>span,.dd-todo li[data-done] textarea{text-decoration:line-through;opacity:.55}
.b6 .dd-todo textarea{all:unset;box-sizing:border-box;display:block;width:100%;min-height:0;resize:none;overflow:hidden;font:inherit;color:inherit;white-space:pre-wrap;overflow-wrap:anywhere;cursor:text}
.dd-todo-hint{opacity:.45}
.dd-todo-empty{padding:4px 24px}
.dd-todo-grip{all:unset;flex:none;display:grid;place-items:center;width:16px;height:22px;opacity:0;cursor:grab;touch-action:none}
.dd-todo-list li:hover .dd-todo-grip,.dd-todo-list li[data-active] .dd-todo-grip{opacity:.55}
.dd-todo-bin{all:unset;flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:6px;cursor:pointer;opacity:.5}
.dd-todo-bin:hover,.dd-todo-bin:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}
.dd-todo-due{all:unset;align-self:flex-start;display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font:600 11px/1.2 var(--sans);background:color-mix(in srgb,currentColor 9%,transparent);cursor:pointer}
.dd-todo-due:disabled{cursor:inherit}
.dd-todo-due[data-due-past]{opacity:.6;font-weight:500}
.dd-todo-add{all:unset;display:inline-flex;align-items:center;gap:6px;margin:4px 0 0 4px;padding:4px 6px;border-radius:7px;font:600 12px var(--sans);opacity:.6;cursor:pointer}
.dd-todo-add:hover,.dd-todo-add:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}
.dd-todo-due-card{position:absolute;z-index:60;top:100%;inset-inline-start:24px;margin-top:4px;width:240px;display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:12px;background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 0 0 1px var(--rule-2,#dcd9cf),0 12px 32px -12px #0005;font:13px/1.35 var(--sans);cursor:auto}
.dd-todo-due-card label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--ink-3,#77746b)}
.dd-todo-due-card input{height:32px;border-radius:8px;border:1px solid var(--rule-2,#dcd9cf);background:var(--paper,#fff);color:var(--ink,#121211);padding:0 8px;font:inherit;font-size:14px}
.dd-todo-due-quick,.dd-todo-due-actions{display:flex;flex-wrap:wrap;gap:6px}
.dd-todo-due-actions{justify-content:flex-end}
.dd-todo-due-card button{height:28px;padding:0 10px;border-radius:999px;border:0;background:var(--wash,#f1efe9);color:var(--ink-2,#4a4843);box-shadow:inset 0 0 0 1px var(--rule,#e6e3da);font:500 12px/1 var(--sans);cursor:pointer}
.dd-todo-due-card button[aria-pressed=true],.dd-todo-due-card .dd-todo-due-done{background:var(--ink,#121211);color:var(--paper,#fff);box-shadow:none}
.dd-todo-due-card .dd-todo-due-clear{background:none;box-shadow:none}
.dd-todo-toast{position:fixed;z-index:400;left:50%;bottom:24px;transform:translateX(-50%);max-width:calc(100vw - 32px);padding:10px 16px;border-radius:12px;background:var(--ink,#121211);color:var(--paper,#fff);font:500 14px/1.35 var(--sans,system-ui);box-shadow:0 10px 30px -10px #0008;cursor:pointer}
@media(pointer:coarse){.dd-todo-grip{opacity:.4;width:26px;height:30px}.b6 .dd-todo input[type=checkbox]{width:20px;height:20px}.dd-todo-bin{width:32px;height:32px}.dd-todo-due-card button{height:38px}.dd-todo-due-card input{height:42px}}
`;
