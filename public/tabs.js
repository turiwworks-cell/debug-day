// Tabs and their keys (5.50). One list the top bar, the Tabs sheet, the app map
// and Ctrl+Space all read, so a section is quick to reach from anywhere and its
// key is the same every time it is shown.
//
// Keys stay small and never take a key a text field needs: T opens This app,
// E the Engine, and the rest are shortcuts a person makes for themselves.

// The fixed tabs, in the order they sit in the top bar. `key` is the plain key
// that opens it when nothing is being typed in. Capture is marked apart: it is
// where things are put down, not a place you work in.
export const DDtabs = [
  { id: "engine", name: ["Today", "امروز"], about: ["Today's tasks and their steps", "کارهای امروز و قدم‌هایشان"], key: "e", glyph: "engine" },
  { id: "board", name: ["Board", "برد"], about: ["The same day as a map or lanes", "همان روز به شکل نقشه یا لاین"], key: "b", glyph: "board" },
  { id: "calendar", name: ["Calendar", "تقویم"], about: ["Days, reminders and stats", "روزها، یادآورها و آمار"], key: "c", glyph: "calendar" },
  { id: "capture", name: ["Capture", "ثبت"], about: ["Put a thought down and go on", "فکری را بگذار و برو"], key: "n", glyph: "capture", apart: true },
  { id: "this-app", name: ["This app", "این اپ"], about: ["What is in the app and what changed", "چه چیزی در اپ هست و چه تغییری کرد"], key: "t", glyph: "app" },
];

export const DDtabIds = DDtabs.map((tab) => tab.id);

export function DDtabOf(id) {
  return DDtabs.find((tab) => tab.id === id) || null;
}

export function DDtabName(id, language) {
  const tab = DDtabOf(id);
  return tab ? tab.name[language === "fa" ? 1 : 0] : id;
}

// ── Shortcuts a person makes ────────────────────────────────────────────────
// Stored per device in `debug-day:tab-keys`: { sectionId: "key" }. Only one
// section per key, and a fixed tab's key is never taken, so a key means one
// thing while the app is open.
export const DDtabKeyStore = "debug-day:tab-keys";
// Keys this app already answers to. A section shortcut never takes one of these.
export const DDtabKeyTaken = new Set([
  "e", "b", "c", "n", "t", "d", "v", "h", "s", "x", "l", "g", "w", "q", "z", "y",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "?", "/", "+", "-", "=",
]);

export function DDtabKeys(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const [id, key] of Object.entries(value)) {
    const one = String(key || "").toLowerCase();
    if (typeof id === "string" && id && /^[a-z0-9]$/.test(one) && !DDtabKeyTaken.has(one)) out[id] = one;
  }
  return out;
}

// Give a section a key, taking it away from whatever had it before.
export function DDtabSetKey(keys, id, key) {
  const next = { ...DDtabKeys(keys) },
    one = String(key || "").toLowerCase(),
    clean = /^[a-z0-9]$/.test(one) && !DDtabKeyTaken.has(one) ? one : "";
  for (const [other, taken] of Object.entries(next)) if (taken === clean) delete next[other];
  if (!id || !clean) return next;
  next[id] = clean;
  return next;
}

// The key that opens something, by id, in one word (for a tooltip or a pill).
export function DDtabKeyFor(keys = {}, id) {
  const fixed = DDtabOf(id);
  return fixed ? fixed.key : DDtabKeys(keys)[id] || "";
}

// Which place a key opens: a fixed tab, or a section's own board. `null` when
// the key means nothing here. Typing in a field never calls this.
export function DDtabForKey(key, keys = {}) {
  const one = String(key || "").toLowerCase();
  if (!/^[a-z0-9]$/.test(one)) return null;
  const fixed = DDtabs.find((tab) => tab.key === one);
  if (fixed) return { view: fixed.id === "engine" ? "engine" : fixed.id === "capture" ? "capture" : fixed.id === "this-app" ? "this-app" : fixed.id };
  const id = Object.keys(DDtabKeys(keys)).find((section) => DDtabKeys(keys)[section] === one);
  return id ? { view: "board", room: id } : null;
}

// How a key is written for a person: one capital letter, always.
export function DDtabKeyLabel(key) {
  return key ? String(key).toUpperCase() : "";
}

// The tabs as rows for Ctrl+Space, in the same order, with their keys.
export function DDtabCommands(language, open, keys = {}) {
  const fa = language === "fa";
  return DDtabs.map((tab) => ({
    id: "cmd-tab-" + tab.id,
    names: tab.name,
    title: tab.name[fa ? 1 : 0],
    subtitle: tab.about[fa ? 1 : 0] + " · " + DDtabKeyLabel(tab.key),
    words: [tab.id, ...tab.name, ...tab.about, tab.key].join(" "),
    action: () => open(tab.id),
  }));
}

// ── Matching a place to a tab ───────────────────────────────────────────────
// The app's older views map onto the new tabs, so whatever keeps a view name
// (the places trail, the address, a saved view) still lands somewhere.
export const DDviewToTab = {
  engine: "engine",
  plan: "engine",
  board: "board",
  calendar: "calendar",
  stats: "calendar",
  insights: "calendar",
  capture: "capture",
  "this-app": "this-app",
  setup: "this-app",
};

export function DDtabOfView(view) {
  return DDviewToTab[view] || "engine";
}

export const DDtabsCSS = `
.dd-tabbar{display:flex;align-items:center;gap:2px;padding:2px;border-radius:10px;background:var(--wash,#f1efe9);box-shadow:inset 0 0 0 1px var(--rule-2,#0002);min-width:0}
.dd-tabbar button{display:inline-flex;align-items:center;gap:7px;height:max(32px,calc(var(--tmin,32px) - 2px));padding:0 11px;border:0;border-radius:8px;background:none;color:var(--ink-3,#777);font:500 calc(11.5px * var(--k,1))/1 var(--sans,system-ui);white-space:nowrap}
.dd-tabbar button:hover{color:var(--ink,#121211);background:color-mix(in srgb,var(--paper,#fff) 60%,transparent)}
.dd-tabbar button[aria-selected=true]{background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 1px 2px #0002}
.dd-tabbar button .dd-tabbar-icon{display:grid;place-items:center;width:16px;height:16px;flex:none}
.dd-tabbar button[aria-selected=true] .dd-tabbar-icon{color:var(--pc,var(--now))}
.dd-tabbar kbd{font:600 calc(9.5px * var(--k,1))/1 var(--mono,monospace);padding:2px 4px;border-radius:4px;background:var(--wash,#eee);color:var(--ink-3,#777);box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-tabbar button[aria-selected=true] kbd{background:color-mix(in srgb,var(--pc,var(--now)) 14%,transparent);color:var(--ink-2,#555)}
/* Capture is where things are put down, so its tab is the one dashed, quiet one. */
.dd-tabbar button[data-tab=capture]{border:1px dashed color-mix(in srgb,var(--ink,#121211) 22%,transparent);background:transparent;margin-inline-start:4px}
.dd-tabbar button[data-tab=capture][aria-selected=true]{background:var(--paper,#fff);border-style:solid}
.dd-tabs-more{width:max(32px,calc(var(--tmin,32px) - 2px));justify-content:center;padding:0}
.dd-tabs-sheet{display:flex;flex-direction:column;gap:4px;min-width:260px;max-width:min(420px,92vw);padding:8px;border-radius:12px;background:var(--paper,#fff);box-shadow:0 16px 40px #0003,0 0 0 1px var(--rule-2,#0002)}
.dd-tabs-sheet h4{margin:6px 8px 2px;font:600 11px/1 var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#777)}
.dd-tabs-sheet a,.dd-tabs-sheet button{display:flex;align-items:center;gap:10px;min-height:38px;padding:6px 10px;border:0;border-radius:9px;background:none;color:var(--ink,#121211);text-align:start;font:inherit;font-size:13px;text-decoration:none}
.dd-tabs-sheet a:hover,.dd-tabs-sheet button:hover{background:var(--wash,#f1efe9)}
.dd-tabs-sheet .dd-tabs-sheet-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-tabs-sheet small{font:11px/1.2 var(--mono,monospace);color:var(--ink-3,#777);max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-tabs-sheet kbd{flex:none;font:600 10px/1 var(--mono,monospace);padding:3px 5px;border-radius:5px;background:var(--wash,#eee);box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-tabs-sheet [data-tab-dot]{width:8px;height:8px;border-radius:50%;flex:none}
.dd-tabs-sheet button[data-apart]{border:1px dashed color-mix(in srgb,var(--ink,#121211) 22%,transparent);margin-top:4px}
@media (max-width:700px){.dd-tabbar{overflow:auto;scrollbar-width:none}.dd-tabbar::-webkit-scrollbar{display:none}}
`;

export function DDinstallTabsStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-tabs-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-tabs-css", textContent: DDtabsCSS }));
}

// The Engine's sun, so the first tab matches the rest of the app's icons.
const DDtabSun = '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.9v1.5M8 12.6v1.5M1.9 8h1.5M12.6 8h1.5M3.7 3.7l1.1 1.1M11.2 11.2l1.1 1.1M3.7 12.3l1.1-1.1M11.2 4.8l1.1-1.1"/>';
const DDtabGlyph = ({ React, id }) =>
  React.createElement("svg", {
    viewBox: "0 0 16 16", width: 15, height: 15, fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
    dangerouslySetInnerHTML: { __html: DDtabSun },
  });

// Labels here are the app's own few words; words.js fills them in at runtime
// through the host's dictionary when it has one.
const DDtabLabels = {
  View: "\u0646\u0645\u0627\u06CC\u0634",
  "All tabs and sections": "\u0647\u0645\u0647\u06CC \u062A\u0628\u200C\u0647\u0627 \u0648 \u0633\u06A9\u0634\u0646\u200C\u0647\u0627",
  Tabs: "\u062A\u0628\u200C\u0647\u0627",
  Sections: "\u0633\u06A9\u0634\u0646\u200C\u0647\u0627",
  "Tabs and sections": "\u062A\u0628\u200C\u0647\u0627 \u0648 \u0633\u06A9\u0634\u0646\u200C\u0647\u0627",
  "Press one key": "\u06CC\u06A9 \u06A9\u0644\u06CC\u062F \u0628\u0632\u0646",
  "Shortcut for ": "\u06A9\u0644\u06CC\u062F \u0628\u0631\u0627\u06CC ",
};
// The host may hand over the app's full dictionary (index.html sets it), so a
// label still reads in the person's language.
let DDtabWords = null;
export function DDtabSetWords(words) {
  DDtabWords = typeof words === "function" ? words : null;
}
const DDtabUI = (text) => {
  if (DDtabWords) {
    try {
      const word = DDtabWords(text);
      if (word) return word;
    } catch {}
  }
  return DDtabLabels[text] || text;
};

// ── Tabs (5.50) ──────────────────────────────────────────────────────────
// One bar for every place: Today (the Engine), Board, Calendar, Capture and This
// app, then a sheet with the Feed's sections and the shortcuts that open them.
// The bar, the sheet, Ctrl+Space and the section keys all read the same list.
export function DDtabGlyphFor(React, id) {
  const tab=DDtabs.find(one=>one.id===id),
    lines={board:"<circle cx=\"4\" cy=\"8\" r=\"1.9\"/><circle cx=\"12\" cy=\"3.8\" r=\"1.7\"/><circle cx=\"12\" cy=\"12.2\" r=\"1.7\"/><path d=\"M5.7 7.1l4.6-2.4M5.7 8.9l4.6 2.4\"/>",calendar:"<rect x=\"2.5\" y=\"3.3\" width=\"11\" height=\"10.2\" rx=\"2\"/><path d=\"M2.5 6.8h11M5.4 1.9v2.6M10.6 1.9v2.6\"/>",capture:"<path d=\"M8 2.8v7.4M5 7.2 8 10.2l3-3\"/><path d=\"M3 11.6v1.2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.2\"/>",app:"<circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M8 5.5v3.2l2 1.4\"/>"}[id];
  if (id === "engine") return DDtabGlyph({ React, id: "engine" });
  return lines ? React.createElement("svg",{viewBox:"0 0 16 16",width:14,height:14,fill:"none",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true,dangerouslySetInnerHTML:{__html:lines}}) : null;
}
export function DDtabBarFor({ React: R, view, onGo, down, onDown, language: lang, keys, sections }) {
  const fa=lang==="fa",active=id=>view===id||(id==="calendar"&&(view==="stats"||view==="insights")),
    go=id=>{onGo(id);onDown(false)},
    row=DDtabs.map(tab=>R.createElement("button",{key:tab.id,type:"button",role:"tab","data-tab":tab.id,"data-panel":tab.id,"aria-selected":active(tab.id),title:tab.about[fa?1:0]+" · "+DDtabKeyLabel(tab.key),onClick:()=>go(tab.id)},
      R.createElement("span",{className:"dd-tabbar-icon","data-panel":tab.id,"aria-hidden":true},DDtabGlyphFor(R,tab.id)),
      R.createElement("span",{className:"dd-tabbar-name"},tab.name[fa?1:0]),
      R.createElement("kbd",{className:"dd-tabbar-key"},DDtabKeyLabel(tab.key))));
  return R.createElement("div",{className:"dd-tabbar-wrap"},
    R.createElement("div",{className:"dd-tabbar",role:"tablist","aria-label":DDtabUI("View")},row),
    R.createElement("div",{className:"dd-tabbar-more-wrap"},
      R.createElement("button",{type:"button",className:"dd-tabs-more","aria-expanded":!!down,"aria-haspopup":"dialog","aria-label":DDtabUI("All tabs and sections"),title:DDtabUI("All tabs and sections"),onClick:()=>onDown(!down)},"⌄"),
      down && R.createElement(DDSectionSheet, {
        React: R, language: lang, keys, sections,
        onGo: (id) => { onGo(id); onDown(false); },
        onRoom: (id) => { onGo("board"); onDown(false); setTimeout(() => onRoom?.(id), 70); },
      })));
}
// The sheet behind ⌄: every tab, then the Feed's sections. Each row shows the
// key that opens it, and a section can be given a key right here.
export function DDSectionSheet({ React: R, language: lang, keys, sections, onGo, onRoom }) {
  const fa=lang==="fa",[list,setList]=R.useState(()=>DDtabKeys(keys)),[picking,setPicking]=R.useState(null);
  const save=next=>{setList(next);try{localStorage.setItem("debug-day:tab-keys",JSON.stringify(next))}catch{}};
  R.useEffect(()=>{const esc=e=>{if(e.key==="Escape"){e.stopPropagation();setPicking(null)}};window.addEventListener("keydown",esc,true);return()=>window.removeEventListener("keydown",esc,true)},[]);
  return R.createElement("div",{className:"dd-tabs-sheet",role:"dialog","aria-label":DDtabUI("Tabs and sections")},
    R.createElement("h4",null,DDtabUI("Tabs")),
    DDtabs.map(tab=>R.createElement("button",{key:tab.id,type:"button","data-sheet-tab":tab.id,onClick:()=>onGo(tab.id)},
      R.createElement("span",{className:"dd-tabbar-icon","data-panel":tab.id,"aria-hidden":true},DDtabGlyphFor(R,tab.id)),
      R.createElement("span",{className:"dd-tabs-sheet-name"},tab.name[fa?1:0]),
      R.createElement("small",null,tab.about[fa?1:0]),
      R.createElement("kbd",null,DDtabKeyLabel(tab.key)))),
    sections.length?R.createElement("h4",null,DDtabUI("Sections")):null,
    sections.map(section=>R.createElement("div",{key:section.id,className:"dd-tabs-sheet-sec","data-section":section.id},
      R.createElement("button",{type:"button",className:"dd-tabs-sheet-room",onClick:()=>onRoom(section.id),style:{paddingInlineStart:10+section.depth*12}},
        R.createElement("span",{"data-tab-dot":"",style:{background:section.tint||"var(--ink-3)"}}),
        R.createElement("span",{className:"dd-tabs-sheet-name",dir:"auto"},section.name)),
      picking===section.id
        ?R.createElement("input",{className:"dd-tabs-sheet-type",autoFocus:true,maxLength:1,dir:"ltr","aria-label":DDtabUI("Press one key"),placeholder:"A–Z",onKeyDown:e=>{e.stopPropagation();const one=String(e.key||"").toLowerCase();if(e.key==="Escape")return setPicking(null);if(/^[a-z0-9]$/.test(one)){save(DDtabSetKey(list,section.id,one));setPicking(null)}},onBlur:()=>setPicking(null)})
        :R.createElement("button",{type:"button",className:"dd-tabs-sheet-key","aria-label":DDtabUI("Shortcut for ")+section.name,title:DDtabUI("Shortcut for ")+section.name,onClick:()=>setPicking(section.id)},R.createElement("kbd",null,DDtabKeyLabel(DDtabKeys(list)[section.id]) || "+")))));
}
