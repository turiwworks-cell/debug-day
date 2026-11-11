// Shared presentation and interaction helpers. No planner data is stored here.
import { DDSectionChip, DDsectionPath } from "./life-board.js";
import { DDTimerMini, DDTimerPanel } from "./timer.js";
import { DDtagList, DDtagText, DDnoteTags } from "./note-tags.js";
import { DDmediaTitle } from "./media.js";
export const DDboardShortcuts = [
  ["V", "Select", "انتخاب"], ["H / Space+drag", "Pan", "حرکت بوم"],
  ["S", "Sticky note", "یادداشت"], ["Shift+T", "Text / title", "متن / تایتل"], ["T", "This App section", "سکشن This App"], ["Shift+S", "Section", "سکشن"],
  ["X / Shift+L", "Bent connector", "اتصال شکسته"], ["L", "Straight connector", "اتصال مستقیم"],
  ["C", "Capture hub", "سکشن ثبت ایده"], ["P", "Pen (draw freehand)", "Pen"], ["M", "Comment", "Comment"], ["Shift+M", "All comments", "All comments"], ["B", "Task", "کار"], ["E", "Engine over the board", "انجین روی برد"], ["Tab / D", "Tabs and sections", "تب‌ها و سکشن‌ها"], ["Alt+1–9", "Assigned section shortcuts", "میانبرهای دلخواه سکشن‌ها"],
  ["G / Shift+G", "Goal / note rail", "ریل هدف / نوت"], ["Shift+H", "Habits rail", "ریل عادت‌ها"],
  ["Ctrl/Cmd+F", "Search this board", "جست‌وجوی همین برد"],
  ["Shift+1 / F", "Fit the whole board", "نمای کل برد"], ["Shift+2 / Shift+F", "Zoom to selection", "نمای انتخاب"],
  ["Shift+3", "Fit current day", "نمای روز جاری"],
  ["Shift+0 / 0", "Zoom to 100%", "زوم ۱۰۰٪"], ["+ / −", "Zoom in / out", "بزرگ‌نمایی / کوچک‌نمایی"],
  ["Ctrl/Cmd+wheel", "Zoom at pointer", "زوم دور نشانگر"],
  ["Shift+click", "Add / remove from selection", "افزودن / کاستن از انتخاب"],
  ["Ctrl/Cmd+A", "Select all unlocked objects", "انتخاب همهٔ اشیای باز"],
  ["Esc", "Cancel gesture / clear selection", "لغو حرکت / پاک‌کردن انتخاب"],
  ["↗ / Esc", "Open a section as its own board / step back out", "ورود به برد سکشن / برگشت یک سطح"],
  ["Enter", "Edit selected object", "ویرایش شیء منتخب"], ["Ctrl/Cmd+Enter", "Create adjacent note", "ایجاد نوت مجاور"],
  ["Ctrl/Cmd+D", "Duplicate (a copy on its own)", "تکثیر (کپی مستقل)"], ["Ctrl/Cmd+Shift+D", "Synced copy: a change in one shows in all", "کپی همگام: تغییر یکی در همه"],
  ["Ctrl/Cmd+C / X / V", "Copy / cut / paste", "کپی / برش / چسباندن"],
  ["Ctrl/Cmd+Z", "Undo", "بازگشت"], ["Ctrl/Cmd+Shift+Z / Ctrl+Y", "Redo", "انجام مجدد"],
  ["Ctrl/Cmd+G", "Group", "گروه‌کردن"], ["Ctrl/Cmd+Shift+G", "Ungroup / remove section, keep contents", "بازکردن گروه / برداشتن سکشن با حفظ محتوا"],
  ["Ctrl/Cmd+Shift+L", "Lock / unlock", "قفل / بازکردن قفل"],
  ["[ / ]", "Send to back / bring to front", "فرستادن به پشت / آوردن به جلو"],
  ["Ctrl/Cmd+[ / ]", "Move one layer back / forward", "یک لایه عقب / جلو"],
  ["Alt+A / D / W / S", "Align left / right / top / bottom", "تراز چپ / راست / بالا / پایین"],
  ["Alt+H / V", "Align horizontal / vertical centers", "تراز مرکز افقی / عمودی"],
  ["Ctrl/Cmd+Alt+L / T / R", "Text left / center / right", "تراز متن چپ / وسط / راست"],
  ["Arrows / Shift+Arrows", "Nudge by 1 / 10", "جابه‌جایی ۱ / ۱۰ واحد"],
  ["Alt+← / →", "Back / forward to where you were", "برگشت / جلو به جایی که بودی"],
  ["Alt+↑ / ↓", "Previous / next tab", "تب قبلی / بعدی"],
  ["Shift+F10", "Context menu", "منوی زمینه‌ای"],
  ["Ctrl/Cmd+Shift+F", "Board full screen", "تمام‌صفحهٔ برد"], ["?", "Keyboard shortcuts", "میان‌برهای کیبورد"],
];

export function DDsearchBoardText(value = "") {
  return String(value).normalize("NFKC").toLocaleLowerCase()
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[۰-۹٠-٩]/g, (c) => String(c.charCodeAt(0) % 16))
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
}

export function DDboardSearchRows(day, lifeItems, visibleNodes = []) {
  const rows = new Map(visibleNodes.filter((n) => n.section !== "life" && n.kind !== "section")
    .map((n) => [n.id, { id: n.id, title: n.title || "", detail: n.subtitle || "", blockId: n.blockId, lifeId: n.lifeId, kind: n.kind }]));
  const put = (row) => rows.set(row.id, { ...rows.get(row.id), ...row });
  for (const b of day.blocks || []) {
    // "#tag" finds tasks and notes alike (5.36).
    put({ id: "b:" + b.id, title: b.name, detail: [b.note, DDtagText(b.tags)].join(" "), tags: DDtagList(b.tags), blockId: b.id, kind: "block", ...(b.from ? { from: b.from } : {}) });
    const visit = (list, parents) => { for (const s of list || []) {
      put({ id: `sub:${b.id}:${s.id}`, title: s.text, detail: b.name, blockId: b.id, parents, kind: "subtask" });
      visit(s.children, [...parents, s.id]);
    } };
    visit(b.subtasks, []);
  }
  for (const n of day.notes || []) if (n.kind !== "emoji") put({ id: "sticky:" + n.id, title: n.text || DDmediaTitle(n), detail: DDtagText(DDnoteTags(n)), tags: DDnoteTags(n), kind: "sticky" });
  for (const i of lifeItems) put({ id: "life:" + i.id, title: i.text || DDmediaTitle(i), detail: "Feed " + DDtagText(DDnoteTags(i)), tags: DDnoteTags(i), lifeId: i.id, kind: i.type === "section" ? "life-section" : "sticky" });
  return [...rows.values()];
}

export function DDboardSearch(rows, query) {
  const words = DDsearchBoardText(query).split(" ").filter(Boolean);
  return rows.filter((row) => { const text = DDsearchBoardText(row.title + " " + row.detail); return words.every((w) => text.includes(w)); });
}

export function DDrootSelection(nodes, selected) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.filter((n) => {
    if (!selected.has(n.id)) return false;
    let p = n.parentId; const seen = new Set([n.id]);
    while (p && !seen.has(p)) { if (selected.has(p)) return false; seen.add(p); p = byId.get(p)?.parentId; }
    return true;
  });
}

export function DDmarqueeSelection(nodes, box, locked) {
  const chosen = new Set(nodes.filter((n) => {
    if (locked.has(n.id) || ["frame", "section", "day", "lane"].includes(n.kind) || n.section === "life") return false;
    if (n.lifeSection) return n.x >= box.x && n.y >= box.y && n.x + n.w <= box.x + box.w && n.y + n.h <= box.y + box.h;
    return n.x < box.x + box.w && n.x + n.w > box.x && n.y < box.y + box.h && n.y + n.h > box.y;
  }).map((n) => n.id));
  return DDrootSelection(nodes, chosen).map((n) => n.id);
}

export function DDselectionToolbar(bounds, camera, viewport, size, top = 72, bottom = 82) {
  const x = camera.x + (bounds.x + bounds.w / 2) * camera.z - size.w / 2;
  const above = camera.y + bounds.y * camera.z - size.h - 24;
  const below = camera.y + (bounds.y + bounds.h) * camera.z + 14;
  return { x: Math.max(8, Math.min(viewport.w - size.w - 8, x)),
    y: Math.max(top, Math.min(viewport.h - bottom - size.h, above >= top ? above : below)) };
}

// The clock itself lives in timer.js: one clock for Plan, Board and Today.
export function DDBoardTimerButton({ React: R, Icon, timer, open, onOpenChange, buttonRef }) {
  return R.createElement("button", { type:"button",ref:buttonRef,className:"b2-icon dd-board-timer-button","aria-label":"Board timer","aria-expanded":open,"aria-controls":"dd-board-timer", "data-running":timer.running,onClick:()=>onOpenChange(!open) },
    R.createElement(Icon,{React:R,name:"timer"}),R.createElement("span",null,R.createElement(DDTimerMini,{React:R})));
}

export function DDBoardTimer({ React: R, open, onOpenChange, buttonRef }) {
  const h = R.createElement, panel = R.useRef(null);
  R.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!panel.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) onOpenChange(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const close = () => { onOpenChange(false); buttonRef.current?.focus(); };
  return open && h("aside",{id:"dd-board-timer",ref:panel,className:"dd-board-timer",role:"dialog","aria-label":"Timer",onPointerDown:e=>e.stopPropagation(),onKeyDown:e=>{e.stopPropagation();if(e.key==="Escape"){e.preventDefault();close();}}},
    h(DDTimerPanel,{React:R,onClose:close}));
}

export function DDBoardSearch({ React:R,language,rows,query,onQuery,onReveal,onClose,items=[] }) {
  const h=R.createElement,t=(en,fa)=>language==="fa"?fa:en;
  const [index,setIndex]=R.useState(0),input=R.useRef(null),list=R.useRef(null);
  const matches=DDboardSearch(rows,query),shown=matches.slice(0,100);
  R.useEffect(()=>{input.current?.focus();},[]);
  R.useEffect(()=>setIndex(0),[query]);
  R.useEffect(()=>{list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"});},[index]);
  return h("aside",{className:"b4-search dd-board-search",role:"search","aria-label":t("Search board","جست‌وجوی برد"),dir:language==="fa"?"rtl":"ltr",onPointerDown:e=>e.stopPropagation(),onKeyDown:e=>{
    e.stopPropagation();if(e.key==="Escape"){e.preventDefault();onClose();}
    else if(["ArrowDown","ArrowUp"].includes(e.key)){e.preventDefault();setIndex(n=>shown.length?(n+(e.key==="ArrowDown"?1:-1)+shown.length)%shown.length:0);}
    else if(e.key==="Enter"&&shown[index]){e.preventDefault();onReveal(shown[index]);}
  }},h("div",{className:"b4-panel-head"},h("input",{ref:input,value:query,"aria-label":t("Search board nodes","جست‌وجوی اشیای برد"),placeholder:t("Search tasks, notes and the Feed…","جست‌وجوی کارها، نوت‌ها و فید…"),onChange:e=>onQuery(e.target.value),"aria-controls":"dd-board-results","aria-activedescendant":shown[index]?`dd-board-result-${index}`:undefined}),h("button",{type:"button","aria-label":t("Close board search","بستن جست‌وجوی برد"),onClick:onClose},"×")),
    h("small",{role:"status"},matches.length?t(`${matches.length} results · ↑ ↓ Enter`,`${matches.length} نتیجه · ↑ ↓ Enter`):t("No matching objects","چیزی پیدا نشد")),
    h("div",{ref:list,id:"dd-board-results",role:"listbox","aria-label":t("Board results","نتیجه‌های برد")},shown.map((r,i)=>h("button",{type:"button",role:"option",id:`dd-board-result-${i}`,key:r.id,"aria-selected":index===i,dir:"auto",onMouseEnter:()=>setIndex(i),onClick:()=>onReveal(r)},h("span",null,r.title||t("Untitled","بدون عنوان"),r.tags?.length?h("em",{className:"dd-search-tags"}," "+DDtagText(r.tags)):null),
      // A task shows the section it came from; a section shows where it sits.
      r.from?h(DDSectionChip,{React:R,items,id:r.from,language,className:"dd-search-from"}):h("small",null,r.kind==="life-section"&&items.length?DDsectionPath(items,r.lifeId,60,t("Section","سکشن")).full:r.lifeId?"Life":r.kind)))));
}

// Browser zoom never resizes the app. Ctrl/Cmd with + = - 0 and Ctrl/Cmd+wheel
// (also a trackpad pinch) are taken over everywhere; the Board turns them into
// its own zoom. Returns 1 (in), -1 (out), 0 (fit) or null for any other key.
export function DDzoomKey(event) {
  if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key, code = event.code || "";
  if (key === "0" || code === "Digit0" || code === "Numpad0") return 0;
  if (key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract") return -1;
  if (key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd") return 1;
  return null;
}
export function DDinstallZoomLock(target = globalThis) {
  if (!target?.addEventListener || target.__ddZoomLock) return;
  target.__ddZoomLock = true;
  target.addEventListener("keydown", (event) => {
    const step = DDzoomKey(event);
    if (step === null) return;
    event.preventDefault();
    target.dispatchEvent(new CustomEvent("debug-day-board-zoom", { detail: step }));
  }, true);
  target.addEventListener("wheel", (event) => { if (event.ctrlKey || event.metaKey) event.preventDefault(); }, { passive: false, capture: true });
  // Safari pinches with gesture events; on the Board the Board zooms instead.
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    target.addEventListener(type, (event) => { if (event.target?.closest?.(".b2-viewport")) event.preventDefault(); }, { passive: false, capture: true });
}

export function DDinstallBoardExperience() {
  if (typeof document==="undefined" || document.getElementById("dd-board-experience")) return;
  document.head.append(Object.assign(document.createElement("style"),{id:"dd-board-experience",textContent:DDboardExperienceCSS}));
}

export const DDboardExperienceCSS = `
.b6{--board-accent:#9147ff;--board-selection:#179cf2;--paper:#fff;--ink:#242326;--ink-2:#52515a;--ink-3:#706e79;--ink-4:#aaa;--wash:#f4f3f6;--rule:#24232612;--rule-2:#24232624;--board-surface:var(--paper);--board-canvas:#f5f5f5;--b6-radius:12px}
:root[data-theme=dark] .b6{--paper:#242327;--ink:#f1f0f4;--ink-2:#cbc8d2;--ink-3:#a5a1af;--ink-4:#6e6977;--wash:#ffffff0d;--rule:#ffffff12;--rule-2:#ffffff25;--board-canvas:#18171b;color-scheme:dark}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .b6{--paper:#242327;--ink:#f1f0f4;--ink-2:#cbc8d2;--ink-3:#a5a1af;--ink-4:#6e6977;--wash:#ffffff0d;--rule:#ffffff12;--rule-2:#ffffff25;--board-canvas:#18171b;color-scheme:dark}}
.b6 .b2-viewport{background-color:var(--board-canvas)}
.b6 .b2-dock{left:50%;right:auto;transform:translateX(-50%);bottom:14px;max-width:calc(100% - 370px);height:54px;padding:6px;gap:3px;overflow-x:auto;scrollbar-width:none;justify-content:center}
.b6 .b2-dock>.b2-icon{width:38px;min-width:38px;height:40px;min-height:40px;padding:8px;flex:none}
.b6 .b2-dock>.b2-icon>span{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
.b6 .b2-icon[aria-pressed=true],.b6 .b2-dock .b2-icon[aria-pressed=true]:has(>.dd-btn-label){background:var(--board-accent);color:#fff;box-shadow:none}
.b6 .b4-selectionbar{position:absolute;top:80px;left:8px;max-width:calc(100% - 16px);min-height:42px;background:#242326;color:#fff;border:1px solid #ffffff16;border-radius:11px;box-shadow:0 4px 14px #0003;padding:4px 6px;gap:2px;z-index:64;overflow-x:auto;scrollbar-width:none;transition:opacity .1s}
.b6 .b4-selectionbar .b2-icon,.b6 .b4-selectionbar>strong{color:#f4f3f7}
.b6 .b4-selectionbar .b2-icon:hover{background:#ffffff20;color:#fff}
.b6 .b4-selectionbar .b2-icon[aria-pressed=true]{background:#9147ff}
.b6 .b4-selectionbar>.b2-icon{min-width:30px;min-height:32px;padding:5px}
.b6 .b4-selectionbar .b2-sep{background:#ffffff26}
.b6 .b4-child{z-index:100}
.b6 .b4-node[aria-selected=true]{outline:calc(1.5px * var(--b4-inverse,1)) solid var(--board-selection)!important;outline-offset:0;box-shadow:0 3px 8px #0002!important}
.b6 .b4-node:focus-visible{outline:calc(2px * var(--b4-inverse,1)) dashed var(--board-accent)!important;outline-offset:calc(4px * var(--b4-inverse,1))}
.b6 .b4-sticky{border-radius:2px;box-shadow:0 3px 6px #0002;overflow:visible}
.b6 .b4-sticky .dd-note-preview{padding:20px 20px 44px;line-height:1.5;scrollbar-width:thin;cursor:inherit}
.b6 .b4-sticky-head{position:absolute;inset-inline:6px;top:auto;bottom:6px;height:28px!important;min-height:0;padding:0 3px;background:var(--node-color);border:0;border-radius:5px;opacity:0;z-index:3;transition:opacity .12s}
.b6 .b4-sticky-head>span{position:absolute;width:1px;clip-path:inset(50%);overflow:hidden}
.b6 .b4-sticky:is(:hover,.selected,:focus-within) .b4-sticky-head{opacity:1}
.b6 .b4-sticky-head button{min-height:24px;height:24px;min-width:24px;padding:2px 5px;font-size:10px}
.b6 .dd-note-editor{border-radius:2px;overflow:hidden;background:var(--node-color)}
.b6 .dd-note-editor textarea{padding:18px 20px;font-size:var(--object-size,14px);line-height:1.5}
.b6 .b4-life-section{background:color-mix(in srgb,var(--node-color) 12%,var(--paper))!important;border:1px solid color-mix(in srgb,var(--node-color) 45%,transparent);border-radius:12px}
/* FigJam: the name pill sits inside the top-left corner. It grows and shrinks with the board, stops shrinking at a readable 12px on screen, and is never wider than its section. */
.b6 .b4-life-section{--dd-sec-k:clamp(1,calc(var(--b4-inverse,1) * .75),60)}
.b6 .b4-life-section>.b4-node-body{top:calc(10px * var(--dd-sec-k));left:calc(10px * var(--dd-sec-k));bottom:auto;margin:0;height:calc(28px * var(--dd-sec-k));width:auto;max-width:calc(100% - 20px * var(--dd-sec-k));min-width:0;border-radius:calc(6px * var(--dd-sec-k));border:calc(1px * var(--dd-sec-k)) solid color-mix(in srgb,var(--node-color) 70%,#1e1e1e 30%);padding:0 calc(8px * var(--dd-sec-k));overflow:hidden;z-index:30;box-shadow:none}
.b6 .b4-life-section>.b6-note-resize[data-edge]{z-index:31}
/* Corners sit above the edge bands, so grabbing a corner resizes both ways (the bottom band used to cover it). */
.b6 .b4-node>.b6-note-resize[data-resize][data-edge=nw],.b6 .b4-node>.b6-note-resize[data-resize][data-edge=ne],.b6 .b4-node>.b6-note-resize[data-resize][data-edge=sw],.b6 .b4-node>.b6-note-resize[data-resize][data-edge=se]{z-index:32}
.b6 .b4-life-section>.b4-node-body{align-items:stretch}
.b6 .b4-life-section>.b4-node-body .b4-node-title{font-size:calc(16px * var(--dd-sec-k));font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;min-width:0}
.b6 .b4-life-section>.b4-node-body .b4-node-title::before{content:none}
.b6 .b4-life-section>.b4-node-actions{display:none}
/* Ctrl+Space search opens above the full-screen board too. */
.cmd-backdrop.dd-command-backdrop{z-index:1200}
.b6 .b4-life-section[data-collapsed=true]>.b4-node-body{top:calc(5px * var(--dd-sec-k));bottom:auto;margin:0}
@media(pointer:coarse){.b6 .b4-life-section>.b4-node-body{height:calc(36px * var(--dd-sec-k))}}
.b6 .b4-port::after{background:var(--paper);border:1.5px solid var(--board-selection);width:9px;height:9px;left:17.5px;top:17.5px}
.b6 .b6-note-resize[data-edge]:after{border-color:var(--board-selection);border-radius:1px;background:var(--paper)}
.b6 .b4-node:not(.selected)>.b6-note-resize[data-edge]{opacity:0;pointer-events:none}
.b6 .b4-marquee{border-color:var(--board-selection);background:#179cf218}
.b6 .b4-connect-hint{pointer-events:none}
.b6 .b2-viewport.b4-panning,.b6 .b2-viewport.b4-panning *{cursor:grabbing!important}
.b6 .b2-viewport[data-tool=hand],.b6 .b2-viewport[data-tool=hand] .b4-node{cursor:grab}
.b6 .b2-viewport[data-tool=section],.b6 .b2-viewport[data-tool=sticky]{cursor:crosshair}
.b6 .b2-dock>.b2-icon[data-view-toggle][aria-pressed=true]{background:color-mix(in srgb,var(--board-accent) 10%,var(--paper));color:var(--board-accent);box-shadow:none}
.b6 .b4-search,.b6 .dd-board-timer{background:var(--paper);color:var(--ink);border:1px solid var(--rule-2);border-radius:14px;box-shadow:0 6px 24px #0002;text-align:start}
.b6 .dd-board-search{z-index:105;top:72px;right:16px;left:auto;width:350px;max-width:calc(100% - 32px);max-height:calc(100% - 170px);padding:12px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.dd-board-search .b4-panel-head{display:flex;gap:8px}.dd-board-search input{width:100%;min-width:0;border:1px solid var(--rule-2);background:var(--wash);color:var(--ink);padding:8px 10px;border-radius:7px;font:inherit}
.dd-board-search [role=listbox]{overflow:auto;display:flex;flex-direction:column;gap:3px}.dd-board-search [role=option]{display:flex;text-align:start;align-items:center;justify-content:space-between;gap:10px;border:0;background:transparent;padding:9px 10px;border-radius:7px;min-height:40px;flex:none;color:var(--ink)}
.dd-board-search [role=option]>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dd-board-search [role=option]>small{color:var(--ink-3);font-size:10px;flex:none}.dd-board-search [role=option][aria-selected=true]{background:color-mix(in srgb,var(--board-accent) 12%,var(--paper))}
.dd-board-search>small{font-size:11px;color:var(--ink-3)}
.b6 .dd-board-timer{position:absolute;z-index:106;top:72px;right:16px;width:300px;max-width:calc(100% - 32px);box-sizing:border-box;padding:16px;border-radius:16px;box-shadow:0 18px 48px -18px #00000059;overflow:auto}
.b6 .b2-top-actions .dd-board-timer-button{width:auto;flex:none;min-width:78px;padding:0 8px;gap:6px}.dd-board-timer-button>svg{flex:none}.dd-board-timer-button>span{font-variant-numeric:tabular-nums;min-width:38px;font-size:12px;display:inline-flex;justify-content:center}.dd-board-timer-button[data-running=true]{background:color-mix(in srgb,var(--board-accent) 15%,var(--paper));color:var(--ink)}
.dd-board-direct{display:inline-grid;place-items:center;width:34px;height:34px;border:1px solid var(--rule-2);border-radius:7px;color:var(--ink-2);background:var(--paper)}
.b6 .dd-board-theme{min-width:32px}.dd-sr-only{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
.b6 .dd-shortcut-list{display:grid;grid-template-columns:minmax(160px,.8fr) minmax(180px,1.2fr);gap:0;max-height:50vh;overflow:auto;direction:ltr}.dd-shortcut-list dt,.dd-shortcut-list dd{margin:0;padding:8px;border-bottom:1px solid var(--rule-2);font-size:12px}.dd-shortcut-list dd{direction:auto;text-align:start}.dd-shortcut-list dt{font-family:var(--mono);color:var(--ink)}
.b6 .b4-help{max-width:660px;width:calc(100% - 24px)}
@media(max-width:1100px){.b6 .b2-top-actions .dd-btn-label{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.b6 .b2-top-actions{max-width:calc(100% - 310px)}.b6 .b2-dock{max-width:calc(100% - 240px)}}
@media(max-width:700px){.b6 .b2-top-actions{max-width:100%;width:100%;justify-content:flex-start;overflow-x:auto}.b6 .b2-dock{left:8px;right:8px;transform:none;bottom:8px;max-width:none;width:auto;height:54px;justify-content:flex-start;gap:2px}.b6 .b2-dock>.b2-icon{flex:1;min-width:36px;height:42px;min-height:42px}.b6 .b2-camera{bottom:72px;right:10px}.b6 .b2-map{bottom:130px}.b6 .b4-selectionbar{max-width:calc(100% - 16px)}.b6 .dd-board-search,.b6 .dd-board-timer{top:122px;right:8px;max-width:calc(100% - 16px);max-height:calc(100% - 194px)}.b6 .b4-sticky-head{opacity:1;height:36px!important}.b6 .b4-sticky .dd-note-preview{padding-top:44px}.b6 .b4-life-section>.b4-node-actions{opacity:1}.b6 .b2-bottom-left{bottom:76px}.b6 .dd-shortcut-list{grid-template-columns:minmax(140px,.9fr) minmax(140px,1.1fr)}}
/* FigJam sticky notes: preview under the tool, type on the note, "+" beside it. */
.b6 .dd-ghost-note{position:absolute;pointer-events:none;z-index:60;opacity:.5;border-radius:2px;box-shadow:0 4px 10px #0002}
.b6 .dd-sticky-colors{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);z-index:104;display:flex;gap:6px;padding:6px 8px;background:var(--paper);border:1px solid var(--rule-2);border-radius:999px;box-shadow:0 4px 16px #0002}
.b6 .dd-sticky-colors button{width:22px;height:22px;padding:0;border-radius:50%;border:1px solid #12121133;cursor:pointer}
.b6 .dd-sticky-colors button[aria-checked=true]{outline:2px solid var(--board-selection);outline-offset:2px}
.b6 .dd-note-placeholder{opacity:.45}
.b6 .dd-note-editor{background:transparent}
.b6 .dd-note-editor textarea{background:transparent;border:0;outline:none;box-shadow:none;padding:20px 20px 44px;color:inherit;resize:none}
.b6 .dd-note-editor textarea::placeholder{color:currentColor;opacity:.45}
.b6 .dd-add-near{position:absolute;width:22px;height:22px;padding:0;border-radius:50%;display:grid;place-items:center;font:600 15px/1 var(--sans);color:var(--board-selection);background:var(--paper);border:1.5px solid var(--board-selection);transform:translate(-50%,-50%) scale(var(--b4-inverse,1));opacity:.85;z-index:6;cursor:pointer}
.b6 .dd-add-near:hover,.b6 .dd-add-near:focus-visible{background:var(--board-selection);color:#fff;opacity:1}
@media(hover:none),(pointer:coarse){.b6 .dd-add-near{display:none}}
/* With the "+" showing, it is the connector start too; the circles behind the edges go. */
@media(hover:hover) and (pointer:fine){.b6 .b4-node[data-add-near-host]>.b4-port{display:none}}
.b6 .dd-add-near.left{left:calc(-46px * var(--b4-inverse,1));top:50%}
.b6 .dd-add-near.right{left:calc(100% + 46px * var(--b4-inverse,1));top:50%}
.b6 .dd-add-near.top{left:50%;top:calc(-46px * var(--b4-inverse,1))}
.b6 .dd-add-near.bottom{left:50%;top:calc(100% + 46px * var(--b4-inverse,1))}
@media(hover:hover) and (pointer:fine){.b6 .b4-sticky .b4-sticky-head{opacity:0!important;pointer-events:none}.b6 .b4-sticky .b4-sticky-head:focus-within{opacity:1!important;pointer-events:auto}}
/* FigJam connectors: grey, weighted with the canvas, with a toolbar of their own. */
/* Resize handles win over connection points; zoomed out, the points no longer grow over them. */
.b6 .b4-node>.b4-node-actions:empty{display:none}
.b6 .b4-node>.b6-note-resize[data-edge]{z-index:9}.b6 .b4-node>.b4-port{z-index:7;transform:scale(clamp(.6,var(--b4-inverse,1),1.6))}
/* Connectors read clearly: dark ink, full strength, never thinner than about 2.4px on screen. Under the pointer they thicken in blue. */
.b6{--dd-wire:var(--ink-2,#4a4843)}
.b6 .b4-wire-line{stroke-width:max(calc(var(--w,3) * 1px),calc(var(--w,3) * .8px * var(--b4-line-inverse,1)));transition:stroke .12s}
.b6 .b4-wire:hover .b4-wire-line{stroke:var(--board-selection);stroke-width:max(calc(var(--w,3) * 1.6px),calc(var(--w,3) * 1.3px * var(--b4-line-inverse,1)))}
.b6 .dd-wire-pop{display:inline-flex;align-items:center;gap:3px;margin-inline:2px;padding:2px 4px;background:#ffffff14;border-radius:8px;flex:none}
.b6 .dd-wire-pop button{min-width:26px;height:26px;border-radius:6px;padding:0 6px;color:#fff;background:transparent;font-size:11px}
.b6 .dd-wire-pop button[aria-pressed=true],.b6 .dd-wire-pop button:hover{background:#ffffff22}
.b6 .dd-wire-pop .dd-swatch{width:22px;min-width:22px;height:22px;padding:0;border-radius:50%;border:1px solid #ffffff55}
.b6 .dd-wire-color{display:inline-block;width:14px;height:14px;border-radius:50%;border:1.5px solid #fff8}
@media(prefers-reduced-motion:reduce){.b6 *{transition:none!important}}
.b6 .b6-align{z-index:63}
.b4-node.dd-alt-ghost{opacity:.5;outline:2px dashed var(--board-selection,#0D99FF);outline-offset:3px}
.b4-node.dd-alt-original{pointer-events:none!important}
.b2-viewport.dd-alt-copying,.b2-viewport.dd-alt-copying *{cursor:copy!important}
@media(max-width:700px){.b6 .b6-properties{top:182px}.b6 .b4-sticky .dd-note-preview{padding:20px 20px 60px}}
/* A section too small on screen to hold its name lets it step aside; selecting it shows the name again. */
.b6 .b4-life-section[data-label-hidden=true]:not(.selected):not(:focus-within)>:is(.b4-node-body,.dd-sec-history){opacity:0;visibility:hidden;pointer-events:none}
.b6 .b4-life-section>:is(.b4-node-body,.dd-sec-history){transition:opacity .15s,visibility .15s}
/* "+" beside a selected note: a small dot that keeps one size and distance on screen, a "+" under the pointer. */
.b6 .dd-add-near{width:calc(20px * var(--b4-inverse,1));height:calc(20px * var(--b4-inverse,1));transform:translate(-50%,-50%);border:0;background:transparent;color:transparent;font-size:calc(14px * var(--b4-inverse,1));opacity:1;isolation:isolate}
.b6 .dd-add-near::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:50%;background:var(--board-selection);transform:scale(.3);transition:transform .12s}
.b6 .dd-add-near:hover,.b6 .dd-add-near:focus-visible{background:transparent;color:#fff}
.b6 .dd-add-near:hover::before,.b6 .dd-add-near:focus-visible::before{transform:scale(1)}
.b6 .dd-add-near.left{left:calc(-16px * var(--b4-inverse,1))}
.b6 .dd-add-near.right{left:calc(100% + 16px * var(--b4-inverse,1))}
.b6 .dd-add-near.top{top:calc(-16px * var(--b4-inverse,1))}
.b6 .dd-add-near.bottom{top:calc(100% + 16px * var(--b4-inverse,1))}
/* Connection points: one small dot on screen at any zoom, bigger under the pointer. */
.b6 .b4-node>.b4-port{transform:scale(var(--b4-inverse,1))}
.b6 .b4-port::after{width:7px;height:7px;left:18.5px;top:18.5px;transition:transform .12s}
.b6 .b4-port:hover::after,.b6 .b4-port:focus-visible::after{transform:scale(1.7)}
/* Far out (under 35%) the dots and "+" go. */
.b6 .b2-viewport.b4-far :is(.dd-add-near,.b4-port){display:none}
/* 5.32 Renaming a section: the name is edited at 16px or more on screen, at any zoom. */
.b6 .b4-life-section>.b4-node-body:has(>.dd-section-rename){--dd-ed-k:max(var(--dd-sec-k,1),var(--b4-inverse,1));height:calc(40px * var(--dd-ed-k));width:auto;max-width:none;overflow:visible;padding:0;border:0;background:transparent;z-index:60}
.b6 .b4-node-body>input.dd-section-rename{width:calc(280px * var(--dd-ed-k));height:100%;font-size:calc(16px * var(--dd-ed-k));font-weight:500;line-height:1.2;padding:0 calc(10px * var(--dd-ed-k));border:calc(2px * var(--dd-ed-k)) solid var(--now);border-radius:calc(7px * var(--dd-ed-k));background:var(--paper);color:var(--ink);box-shadow:0 calc(6px * var(--dd-ed-k)) calc(18px * var(--dd-ed-k)) #0002}
/* Text objects: a note without its paper. Notes keep their own design. */
.b6 .b4-sticky.b4-plain{background:transparent!important;box-shadow:none!important;border-color:transparent!important}
.b6 .b4-sticky.b4-plain .b4-sticky-head,.b6 .b4-sticky.b4-plain .dd-sticky-footer{display:none}
.b6 .b4-sticky.b4-plain .dd-note-preview,.b6 .b4-sticky.b4-plain .dd-note-editor{padding:4px 6px!important;background:transparent}
.b6 .b4-sticky.b4-plain .dd-note-preview,.b6 .b4-sticky.b4-plain .dd-note-editor textarea{color:var(--node-text)!important;font-weight:600;line-height:1.3}
.b6 .b4-sticky.b4-plain .dd-note-preview:empty::before{content:"Text";color:var(--ink-3);font-weight:500}
.b6 .b4-sticky.b4-plain:not(.selected):hover{outline:1px dashed color-mix(in srgb,var(--now) 55%,transparent);outline-offset:2px}
.b6 .b2-viewport[data-tool=text]{cursor:text}
/* Right-click: quick colors in one row. */
.b6-menu-swatches{display:flex;flex-wrap:wrap;gap:7px;padding:4px 10px 8px;flex:none}
.b6-menu-swatches button{width:22px;height:22px;min-height:0;padding:0;border-radius:50%;border:1px solid color-mix(in srgb,var(--ink) 20%,transparent);cursor:pointer;flex:none}
.b6-menu-swatches button[aria-checked=true]{box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--now)}
.b6-menu-swatches button:hover:not(:disabled),.b6-menu-swatches button:focus-visible{outline:2px solid var(--now);outline-offset:1px}
/* Align panel, like a design app. */
.b6 .b6-align{width:272px;gap:10px}
.b6-align-row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.b6-align-gap{width:6px}
.b6-align-button,.b6-align-wide{height:32px;min-height:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;border:1px solid var(--rule-2);background:var(--paper);color:var(--ink-2);font-size:12px;cursor:pointer}
.b6-align-button{width:32px;padding:0}
.b6-align-wide{flex:1;padding:0 8px;white-space:nowrap}
.b6-align button:hover:not(:disabled){background:var(--wash);color:var(--now)}
.b6-align button:disabled{opacity:.4;cursor:default}
.b6-align-label{color:var(--ink-3);font-size:11px;margin-bottom:-6px}
.b6-align-note{color:var(--ink-3);font-size:11px;line-height:1.4;margin:0}
.b6 .dd-wire-pop-note{font-size:10px;color:#fffb;white-space:nowrap;padding-inline:4px 2px}
@media(max-width:700px){.b6 .dd-wire-pop-note{display:none}.b6 .b4-sticky.b4-plain .dd-note-preview{padding:4px 6px!important}}
`;

