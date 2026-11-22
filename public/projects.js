// Projects are a view of the shared Feed and the existing Engine. Only explicit
// roles, the selected note ID and the log marker are kept on Feed items.
import { DDlifeAdd, DDlifeItems, DDlifeState, DDsectionTint } from "./life-board.js";
import { DDcaptureId } from "./section-keys.js";
import { DDdueDate, DDdueText } from "./deadlines.js";
import { DDvalidDate } from "./dates.js";
import { DDrichPlain } from "./rich-text.js";

const byId = (items) => new Map(items.map((item) => [item.id, item]));
const isProject = (item) => item?.type === "section" && item.id !== DDcaptureId && item.projectKind === "project";
function ancestors(index, id) {
  const path = [], seen = new Set();
  for (let item = index.get(id); item && !seen.has(item.id); item = index.get(item.parent)) {
    seen.add(item.id);
    path.push(item);
  }
  return path;
}
const owner = (index, id) => ancestors(index, id).find(isProject);

export function DDprojectOwner(items, id) {
  return owner(byId(items), id);
}

export function DDprojectRole(items, id, kind) {
  const index = byId(items), item = index.get(id);
  if (item?.type !== "section" || id === DDcaptureId) return items;
  if (kind === "subproject" && !owner(index, item.parent)) return items;
  if (kind === "project" && owner(index, item.parent)) return items;
  if (kind && !["project", "subproject"].includes(kind)) return items;
  if ((item.projectKind || "") === (kind || "")) return items;
  return items.map((it) => {
    if (it !== item) return it;
    const { projectKind, nextNoteId, ...rest } = it;
    return kind ? { ...rest, projectKind: kind } : rest;
  });
}

// The parent project can choose a note anywhere inside it, including ordinary
// sections and explicitly marked subprojects. Never write a second text copy.
export function DDprojectChoose(items, projectId, noteId) {
  const index = byId(items), project = index.get(projectId), note = index.get(noteId);
  if (!isProject(project)) return items;
  if (noteId && (note?.type !== "sticky" || owner(index, noteId)?.id !== projectId || !String(note.text || "").trim())) return items;
  if ((project.nextNoteId || "") === (noteId || "")) return items;
  return items.map((it) => {
    if (it !== project) return it;
    const { nextNoteId, ...rest } = it;
    return noteId ? { ...rest, nextNoteId: noteId } : rest;
  });
}

// A real Feed note, dated using the same planner day as other notes. Use the
// usual free-spot placement, but do not grow/move any existing frame or item:
// where there is no room it can sit on the project's own board beyond its frame.
export function DDprojectRecord(items, projectId, text, date, id) {
  text = String(text || "").trim().slice(0, 4000);
  if (!text || !DDvalidDate(date) || !id || items.some((i) => i.id === id) || !isProject(items.find((i) => i.id === projectId))) return items;
  const note = DDlifeAdd(items, { id, type: "sticky", parent: projectId, text, at: date }).at(-1);
  const siblings = items.filter((i) => i.parent === projectId);
  if (siblings.some((i) => note.x < i.x + i.w && note.x + note.w > i.x && note.y < i.y + i.h && note.y + note.h > i.y)) {
    note.x = 24;
    note.y = Math.max(48, ...siblings.map((i) => i.y + i.h + 24));
  }
  return [...items, { ...note, projectLog: true }];
}

export function DDprojectCards(items = [], days = {}) {
  const index = byId(items), cards = new Map();
  for (const item of items) {
    if (isProject(item)) cards.set(item.id, { project: item, tint: DDsectionTint(items, item.id), goal: null, next: null, notes: [], subprojects: [], history: [], lastEntry: null });
  }
  for (const item of items) {
    const card = cards.get(owner(index, item.id)?.id);
    if (!card || card.project === item) continue;
    if (item.type === "section" && item.projectKind === "subproject") {
      const depth = ancestors(index, item.parent).filter((p) => p.projectKind === "subproject").length;
      card.subprojects.push({ item, depth, tint: DDsectionTint(items, item.id) });
    } else if (item.type === "sticky") {
      // A blank note is not a usable step. A goal in a subproject must never
      // masquerade as the main project's own goal.
      if (String(item.text || "").trim()) {
        card.notes.push(item);
        if (!card.goal && item.parent === card.project.id && item.role === "goal") card.goal = item;
        if (item.id === card.project.nextNoteId) card.next = item;
      }
      if (item.projectLog && DDvalidDate(item.at)) {
        card.history.push({ kind: "log", id: item.id, date: item.at, text: item.text });
        if (!card.lastEntry || item.at >= card.lastEntry.at) card.lastEntry = item;
      }
    }
  }
  for (const [date, day] of Object.entries(days)) {
    for (const task of day.blocks || []) {
      if (!task.done) continue;
      const card = cards.get(task.projectRef || owner(index, task.from)?.id);
      if (card) card.history.push({ kind: "done", id: task.id, date, text: task.name, noteId: task.noteRef });
    }
  }
  for (const card of cards.values()) {
    // The stored Feed order is stacking order, not necessarily parent-first.
    card.subprojects.sort((a, b) => {
      const path = (entry) => ancestors(index, entry.item.id).reverse().map((i) => i.id).join("/");
      return path(a).localeCompare(path(b));
    });
    card.history.sort((a, b) => b.date.localeCompare(a.date));
  }
  return [...cards.values()];
}

const plain = (text) => DDrichPlain(text).trim();
function ProjectCard({ React: R, card, language, today, onOpen, onChoose, onRecord, onSend }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => fa ? f : en;
  const { project, goal, next, notes, tint, subprojects, history, lastEntry } = card;
  const [details, setDetails] = R.useState(false), [recording, setRecording] = R.useState(false), [text, setText] = R.useState(""), [choosing, setChoosing] = R.useState(false);
  const recordButton = R.useRef(null), chooseButton = R.useRef(null);
  const finishRecord = () => { setRecording(false); setText(""); requestAnimationFrame(() => recordButton.current?.focus()); };
  const subtitle = (label, children) => h("div", { className: "dd-project-field" }, h("span", { className: "dd-project-label" }, label), children);
  const openText = (item, extra = {}) => h("button", { type: "button", dir: "auto", className: "dd-project-link", title: plain(item.text), onClick: () => onOpen(item.id), ...extra }, plain(item.text) || t("Untitled", "بی‌نام"));
  const due = DDdueText(project.due, today, language);
  return h("article", { className: "dd-project-card", "data-project-id": project.id },
    h("header", { className: "dd-project-card-head" },
      h("span", { className: "dd-project-color", "aria-hidden": true, style: { background: tint?.fill } }),
      h("h2", null, openText(project, { className: "dd-project-name", "data-project-open": project.id })),
      due && h("span", { className: "dd-project-due", title: DDdueDate(project.due, language) }, "◆ ", due)),
    goal && subtitle(t("Current goal", "هدف فعلی"), openText(goal, { className: "dd-project-link dd-project-goal" })),
    subtitle(t("Continue from here", "ادامه از اینجا"),
      next ? openText(next, { className: "dd-project-next", "data-project-next": next.id })
        : choosing && notes.length
          ? h("select", { autoFocus: true, dir: "auto", value: "", "aria-label": t("Choose a note", "انتخاب نوت"),
              onChange: (e) => { if (e.target.value) { onChoose(project.id, e.target.value); setChoosing(false); } },
              onKeyDown: (e) => { if (e.key === "Escape") { setChoosing(false); requestAnimationFrame(() => chooseButton.current?.focus()); } } },
              h("option", { value: "", disabled: true }, t("Choose a note…", "انتخاب نوت…")),
              notes.map((note) => h("option", { key: note.id, value: note.id, dir: "auto" }, plain(note.text).replace(/\s+/g, " ").slice(0, 180))))
          : h("button", { type: "button", className: "dd-project-quiet", ref: chooseButton, onClick: () => notes.length ? setChoosing(true) : onOpen(project.id) }, notes.length ? t("+ Choose a note", "+ انتخاب نوت") : t("Open the section to add a note", "باز کردن سکشن برای افزودن نوت"))),
    h("div", { className: "dd-project-actions" },
      next && h("button", { type: "button", className: "btn solid", "data-project-send": true, onClick: () => onSend(project, next) }, t("Send to Today", "بفرست به امروز")),
      h("button", { type: "button", className: "btn", ref: recordButton, "aria-expanded": recording, onClick: () => recording ? finishRecord() : setRecording(true) }, t("Record an event", "ثبت اتفاق")),
      h("button", { type: "button", className: "dd-project-quiet dd-project-detail-toggle", "aria-expanded": details, onClick: () => setDetails(!details) }, t("Details", "جزئیات"), h("span", { "aria-hidden": true }, details ? "⌃" : "⌄"))),
    recording && h("form", { className: "dd-project-record", onSubmit: (e) => {
      e.preventDefault();
      if (!text.trim()) return;
      onRecord(project.id, text);
      finishRecord(); setDetails(true);
    } },
      h("input", { autoFocus: true, type: "text", dir: "auto", value: text, maxLength: 4000, onChange: (e) => setText(e.target.value), placeholder: t("What happened today?", "امروز چی شد؟"), "aria-label": t("What happened today?", "امروز چی شد؟"), onKeyDown: (e) => { if (e.key === "Escape") { e.preventDefault(); finishRecord(); } } }),
      h("button", { type: "submit", className: "btn solid", disabled: !text.trim() }, t("Save", "ثبت"))),
    details && h("div", { className: "dd-project-details" },
      subprojects.length > 0 && h("section", null,
        h("h3", null, t("Subprojects", "زیرپروژه‌ها")),
        h("ul", { className: "dd-project-list" }, subprojects.map(({ item, tint, depth }) =>
          h("li", { key: item.id, style: { paddingInlineStart: Math.min(4, depth) * 14 } },
            h("span", { className: "dd-project-color dd-project-small-color", style: { background: tint?.fill }, "aria-hidden": true }),
            openText(item))))),
      lastEntry && subtitle(t("Last entry", "آخرین ثبت"), h("time", { dateTime: lastEntry.at }, DDdueDate(lastEntry.at, language))),
      h("section", null, h("h3", null, t("History", "سابقه")),
        history.length ? h("ul", { className: "dd-project-history" }, history.map((row) =>
          h("li", { key: row.kind + ":" + row.date + ":" + row.id, "data-project-history": row.kind },
            h("span", { className: "dd-project-history-date" }, h("time", { dateTime: row.date }, DDdueDate(row.date, language)),
              row.kind === "done" && h("span", { className: "dd-project-done" }, t(" · Completed", " · انجام شد"))),
            row.kind === "log" ? openText({ id: row.id, text: row.text }) : h("span", { dir: "auto" }, row.text || t("Untitled", "بی‌نام")))))
          : h("p", { className: "dd-project-muted" }, t("No entries yet.", "هنوز چیزی ثبت نشده.")))));
}

export function DDProjectsPanel({ React: R, setup, days, today, language, onUpdateSetup, onOpen, onSend, makeId }) {
  DDinstallProjectsStyles();
  const h = R.createElement, fa = language === "fa", t = (en, f) => fa ? f : en;
  const cards = R.useMemo(() => DDprojectCards(DDlifeItems(setup), days), [setup.life, days]);
  const change = (fn) => onUpdateSetup((s) => {
    const life = DDlifeState(s), items = fn(life.items);
    return items === life.items ? s : { ...s, life: { ...life, items } };
  });
  return h("section", { className: "dd-projects", "data-section-id": "projects", "data-panel": "projects", dir: fa ? "rtl" : "ltr" },
    h("h1", null, t("Projects", "پروژه‌ها")),
    cards.length ? h("div", { className: "dd-project-grid" }, cards.map((card) => h(ProjectCard, {
      key: card.project.id, React: R, card, language, today, onOpen, onSend,
      onChoose: (pid, nid) => change((items) => DDprojectChoose(items, pid, nid)),
      onRecord: (pid, text) => { const id = makeId(); change((items) => DDprojectRecord(items, pid, text, today, id)); },
    }))) : h("div", { className: "dd-project-empty" }, h("p", null, t("No projects yet.", "هنوز پروژه‌ای نیست.")),
      h("p", null, t("On the Board, open a section’s menu and choose Make it a project.", "روی برد، منوی یک سکشن را باز کن و «پروژه کن» را بزن."))));
}

// Solid surfaces and the app's existing type, buttons and colour tokens.
// All of this is scoped to Projects; Board gestures and styles stay untouched.
const DDprojectsCSS = `
.dd-projects{min-width:0;width:100%;max-width:1100px;margin:0 auto;padding:16px 0 24px;color:var(--ink);font:400 14px/1.5 var(--sans)}
.dd-projects h1{font:600 27px/1.2 var(--title);margin:0 0 20px;text-align:start;color:var(--ink)}
.dd-project-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:14px}
.dd-project-card,.dd-project-empty{background:var(--panel);border:1px solid var(--rule-2);border-radius:16px;padding:20px;min-width:0;display:flex;flex-direction:column;gap:16px}
.dd-project-card-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-width:0}
.dd-project-color{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px var(--rule-2)}
.dd-project-card h2{flex:1 1 140px;min-width:0;margin:0;font:600 18px/1.3 var(--sans);overflow-wrap:anywhere}
.dd-project-name,.dd-project-link,.dd-project-next,.dd-project-quiet{padding:0;background:none;border:0;text-align:start;color:var(--ink);font:inherit;min-width:0;overflow-wrap:anywhere;cursor:pointer}
.dd-project-name:hover,.dd-project-link:hover,.dd-project-next:hover{text-decoration:underline;text-underline-offset:3px;color:var(--now)}
.dd-project-due,.dd-project-label,.dd-project-muted,.dd-project-history-date{font-size:12px;color:var(--ink-3)}
.dd-project-due{white-space:nowrap;margin-inline-start:auto}
.dd-project-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dd-project-goal{margin:0;color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere}
.dd-project-next{align-self:start;font-weight:600;color:var(--now);white-space:pre-wrap}
.dd-project-card :is(.dd-project-goal,.dd-project-next){display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dd-project-quiet{color:var(--ink-3);font-size:13px;align-self:start;min-height:28px}
.dd-project-quiet:hover{color:var(--now)}
.dd-project-card :is(input,select){min-width:0;max-width:100%;background:var(--wash);border:0;color:var(--ink);border-radius:10px;padding:8px 10px;font:inherit}
.dd-project-card :is(button,input,select):focus-visible{outline:2px solid var(--now);outline-offset:2px}
.dd-project-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dd-project-actions .btn,.dd-project-record .btn{min-height:32px;padding:6px 12px;font-size:13px;white-space:normal}
.dd-project-detail-toggle{margin-inline-start:auto;display:flex;align-items:center;gap:5px;align-self:center}
.dd-project-record{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dd-project-record input{flex:1 1 150px}
.dd-project-details{display:flex;flex-direction:column;gap:16px;padding-top:15px;border-top:1px solid var(--rule-2)}
.dd-project-details h3{margin:0 0 6px;font:600 12px/1.35 var(--sans);color:var(--ink-3)}
.dd-project-details :is(ul,p){margin:0;padding:0}
.dd-project-list,.dd-project-history{list-style:none;display:flex;flex-direction:column;gap:8px}
.dd-project-list li{display:flex;align-items:center;min-width:0;gap:7px}
.dd-project-small-color{width:9px;height:9px}
.dd-project-history li{display:flex;flex-direction:column;gap:3px;padding-bottom:8px;border-bottom:1px solid var(--rule-2);overflow-wrap:anywhere;min-width:0}
.dd-project-history li:last-child{border:0;padding-bottom:0}
.dd-project-done{color:var(--ok)}
.dd-project-empty{gap:4px;max-width:540px}
.dd-project-empty p{margin:0}
.dd-project-empty p+p{color:var(--ink-3);font-size:13px}
@media(max-width:700px){.dd-project-grid{grid-template-columns:minmax(0,1fr)}.dd-projects{padding:12px 0 85px}.dd-project-card{padding:16px;gap:14px}.dd-projects h1{font-size:23px}}
@media(pointer:coarse){.dd-projects button,.dd-projects :is(input,select){min-height:44px}.dd-project-card-head{gap:7px}.dd-project-name{display:block}}
`;
function DDinstallProjectsStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-projects-style")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-projects-style", textContent: DDprojectsCSS }));
}
