// Graphite: the app's look (5.25). Calm graphite and soft aluminium surfaces,
// rounded shapes, one readable typeface and one accent. Only the look lives
// here: no behaviour. Sticky notes keep their own design, so nothing in this
// file targets them.
//
// The style is added at the end of <body>, after every other stylesheet, so it
// wins over the older rules without needing !important everywhere.

const light = `
  --paper:#eeeeec;--panel:#fbfbfa;--raise:#ffffff;
  --pi:#171717;--pi-2:#4f4f4b;--pi-3:#85857f;
  --ink:#171717;--ink-2:#4f4f4b;--ink-3:#85857f;--ink-4:#b9b9b3;
  --rule:#1717170f;--rule-2:#1717171f;--wash:#1717170a;--cell0:#1717170d;
  --now:#e8561d;--on-now:#ffffff;--now-on-light:var(--now);
  --ok:#1f9d4c;--bug:#e0453f;--inner:#6d5ce8;--energy:#d99a00;
  --g1:#c3ecd0;--g2:#7fd49c;--g3:#3fb56a;--g4:#1f8a48;
  --gr-shadow:0 1px 2px #17171710,0 6px 20px -12px #17171730;
  --gr-hi:inset 0 1px 0 #ffffffb3;
  color-scheme:light`;
const dark = `
  --paper:#121212;--panel:#1c1c1c;--raise:#242424;
  --pi:#efefec;--pi-2:#a9a9a4;--pi-3:#74746f;
  --ink:#efefec;--ink-2:#a9a9a4;--ink-3:#7a7a75;--ink-4:#4b4b48;
  --rule:#ffffff0f;--rule-2:#ffffff1f;--wash:#ffffff0a;--cell0:#ffffff0f;
  --now:#e3eb5a;--on-now:#141414;--now-on-light:var(--now);
  --ok:#3ccf6e;--bug:#ff6161;--inner:#a99bff;--energy:#ffcf4d;
  --g1:#1d3d27;--g2:#246b3a;--g3:#2ea152;--g4:#3fd673;
  --gr-shadow:0 1px 0 #ffffff08,0 10px 28px -16px #000000d0;
  --gr-hi:inset 0 1px 0 #ffffff0d;
  color-scheme:dark`;
// The board keeps its own surface tokens (nodes sit on a canvas).
const boardLight = `--paper:#ffffff;--ink:#171717;--ink-2:#4f4f4b;--ink-3:#77776f;--ink-4:#b0b0aa;--wash:#f3f3f1;--rule:#17171710;--rule-2:#17171721;--board-canvas:#f3f3f1;--board-accent:var(--now);--b6-radius:14px`;
const boardDark = `--paper:#1f1f1f;--ink:#efefec;--ink-2:#c3c3be;--ink-3:#93938d;--ink-4:#5a5a56;--wash:#ffffff0a;--rule:#ffffff10;--rule-2:#ffffff21;--board-canvas:#141414;--board-accent:var(--now);--b6-radius:14px;color-scheme:dark`;
// Before 6.0 these were light "islands" in dark mode. Now they follow the theme.
const islands =
  ".row,.cap-item,.bug-in,.cal-chip,.cmd-input-row,.app-map-card,.dd-on-light,.dd-panel select,.dd-panel input:not([type=checkbox]),.dd-card-field select,.dd-card-field textarea,.dd-card-minutes input,.dd-measure-times input,.dd-habits,.dd-habit-min input,.dd-habit-plus,.dd-habit-list input:not([type]),.dd-habit-edit input:not([type]),.dd-feeling-details input:not([type]),.dd-feeling-details select,.dd-review-feelings-brief li,.dd-feelings-quick-list li";
const islandDark = `--ink:var(--pi);--ink-2:var(--pi-2);--ink-3:var(--pi-3);--ink-4:#4b4b48;--paper:#121212;--rule:#ffffff0f;--rule-2:#ffffff1f;--wash:#ffffff0a;--cell0:#ffffff0f;--ok:#3ccf6e;--bug:#ff6161;--inner:#a99bff;--energy:#ffcf4d;--now:#e3eb5a;color-scheme:dark`;

// Small labels that used to be spaced-out capitals in a typewriter face.
const labels =
  ".cap,.views button,.totals span,.lay button,.seg button,.lname,.row .ty,.subnode-add button,.drop:empty:before,.addlane,.chip,.bug-in .on,.bug .when,.bug .bx.armed,.textbtn,.cal-head,.sw button.auto,.trow .x.armed,.defp,.keys,.toast,.b2-mode button,.b4-subtask .b4-node-subtitle,.dd-card-field>span";

export const DDgraphiteCSS = `
:root{${light};
  --sans:"Geist","Vazirmatn",ui-sans-serif,system-ui,sans-serif;
  --mono:"Geist","Vazirmatn",ui-sans-serif,system-ui,sans-serif;
  --r-ctl:10px;--r-card:14px;--r-panel:20px}
:root[data-theme=dark]{${dark}}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${dark}}}
html[data-theme=dark] :is(${islands}){${islandDark}}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) :is(${islands}){${islandDark}}}
html .b6{${boardLight}}
html[data-theme=dark] .b6{${boardDark}}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) .b6{${boardDark}}}

/* Type: one face, calm sizes, numbers line up */
html,body{background:var(--paper);color:var(--ink)}
body{font-family:var(--sans);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;letter-spacing:-.003em}
html .uppercase{text-transform:none}
html :is(${labels}){text-transform:none;letter-spacing:0;font-family:var(--sans)}
html :is(.cap,.totals span,.row .ty,.chip,.addlane,.textbtn,.cal-head,.defp,.bug .when,.bug-in .on,.sw button.auto,.dd-card-field>span,.drop:empty:before,.subnode-add button){font-size:calc(12.5px * var(--k));font-weight:500}
html .dd-card-field>span{color:var(--ink-3)}
html .toast{font:500 13.5px/1.3 var(--sans);border-radius:999px;padding:12px 20px;box-shadow:var(--gr-shadow)}
html .keys{font-size:12px;color:var(--ink-3)}
html .keys kbd{font:500 11px var(--sans);border-radius:6px;padding:2px 6px;background:var(--wash);box-shadow:none}
html .totals{gap:4px 16px}
html .totals span{color:var(--ink-3)}
html .totals b{font-weight:600;color:var(--ink)}
html .brand{font-size:calc(16px * var(--k));font-weight:600;letter-spacing:-.025em}

/* Controls: soft rounded shapes, light outlines */
html :is(.btn,.dchip,.box,.navb,.field,.lenbox,.addlane,.defp,.bug-tag-btn,.sw button,.bug,.bug-in,.cal-chip,.pattern-banner,.dd-pill){border-radius:var(--r-ctl)}
html :is(.btn,.dchip,.navb,.addlane,.lenbox,.bug-tag-btn,.sw button){transition:background-color .15s ease,box-shadow .15s ease,color .15s ease}
html :is(.btn,.dchip,.navb):hover{background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule-2)}
html .btn.solid,html .quick .go,html .bug-in .go{background:var(--ink);color:var(--paper);box-shadow:none;border-radius:var(--r-ctl);font-weight:600}
html .btn.solid:hover,html .quick .go:hover{background:var(--ink);opacity:.88}
html .btn.armed{border-radius:var(--r-ctl)}
html .quick .go{height:calc(100% - 8px);margin-inline-end:0}
html .chip{border-radius:999px;overflow:hidden}
html .chip[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px var(--now)}
html :is(.field,.box,.journal,.noterow){box-shadow:inset 0 0 0 1px var(--rule-2);background:var(--panel)}
html .field:focus,html .box:focus-within{box-shadow:inset 0 0 0 1.5px var(--now)}
html .box input,html .focus{background:transparent}
html .box kbd{border-radius:5px;font-family:var(--sans)}
html .sw button[aria-pressed=true]{background:var(--ink);color:var(--paper)}
html .lenbox button{border-radius:8px}

/* Any button or field without its own shape gets a soft corner (never inside a note) */
:where(button,select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=range])):where(:not(.b4-sticky *,.dd-plan-life-note *,.b4-sticky,.dd-plan-life-note)){border-radius:var(--r-ctl)}

/* Today card on phones */
html .dd-current-task{border-radius:var(--r-panel);border-color:var(--rule)}
html :is(.dd-next-task,.dd-today-empty){border-radius:var(--r-card);box-shadow:inset 0 0 0 1px var(--rule-2)}
html .dd-current-actions .btn{border-radius:12px}

/* Segmented switches (views, filters, layouts) */
html :is(.views,.seg,.lay){box-shadow:none;background:var(--wash);border-radius:12px;padding:3px;gap:2px}
html :is(.views,.seg,.lay) button{border-radius:9px;color:var(--ink-3);font:500 calc(13px * var(--k))/1 var(--sans);letter-spacing:0;transition:background-color .15s ease,color .15s ease}
html :is(.views,.seg,.lay) button:hover{color:var(--ink)}
html .views button[aria-selected=true],html :is(.seg,.lay) button[aria-pressed=true]{background:var(--panel);color:var(--ink);box-shadow:var(--gr-hi),0 1px 3px #00000022,0 0 0 1px var(--rule)}
html .views button{height:max(34px,var(--tmin))}
html .lay button{border-radius:9px}

html .dd-review-sections{box-shadow:none;border-radius:12px;padding:3px;gap:2px}
html .dd-review-sections button{border-radius:9px;color:var(--ink-3)}
html .dd-review-sections button[aria-selected=true]{background:var(--panel);color:var(--ink);box-shadow:var(--gr-hi),0 1px 3px #00000022,0 0 0 1px var(--rule)}
html .dd-review-sections .dd-panel-icon{background:none;box-shadow:none}
html .dd-review-date{border-radius:12px}

/* The day's note and journal */
html .note{border-radius:var(--r-card);overflow:hidden;box-shadow:inset 0 0 0 1px var(--rule-2);background:var(--panel)}
html .note .noterow,html .note .journal{box-shadow:none;background:transparent;border-radius:0}
html .note .journal{border-top:1px solid var(--rule)}
html .noterow button{border-radius:0}

/* Cards and rows */
html .row{border-radius:var(--r-card);overflow:hidden;box-shadow:inset 0 0 0 1px var(--rule)}
html .row .sq{border-radius:10px;margin:6px;width:calc(max(var(--rh),var(--tmin)) - 12px)}
html .row .nm{font-weight:550}
html .lname{font:600 calc(15px * var(--k))/1.2 var(--sans);color:var(--ink);letter-spacing:-.01em}
html .pri{border-radius:6px;font-family:var(--sans);font-size:10.5px;height:18px;padding:0 6px}
html .cap-item{box-shadow:inset 0 0 0 1px var(--rule)}
html .cap-item.sel{box-shadow:inset 0 0 0 2px var(--now)}
html .ed{border-radius:var(--r-card);box-shadow:inset 0 0 0 1px var(--rule-2)}
html .time-pill{border-radius:999px;height:18px;font:500 11px/18px var(--sans)}
html .duration-ruler{border-radius:999px}
html .time-sample{border:0;height:6px;border-radius:999px;background:var(--rule-2);opacity:1}
html .drop:empty{outline:none;box-shadow:inset 0 0 0 1px var(--rule-2);border-radius:var(--r-card);background:var(--wash)}

/* Stats, calendar, settings */
html .graph,html .tiles,html .cal-grid{border-radius:var(--r-card);overflow:hidden}
html .kpi b{font-weight:600}
html .cell{border-radius:3px}
html .bar .tr{border-radius:999px;overflow:hidden}
html .cal-day.selected{box-shadow:inset 0 0 0 2px var(--now)}

/* Windows that float above the page */
html :is(.cmd-modal,.app-map-modal,.dd-capture-dialog){border-radius:var(--r-panel);overflow:hidden;background:var(--panel)}
html .dd-capture-dialog{overflow:auto;border-color:var(--rule-2)}
html .cmd-input-row{background:transparent}
html .cmd-item{border-radius:10px}
html .dd-search-isolation{border-radius:var(--r-card)}
html .dd-search-suggestions :is(button,span){border-radius:999px}

/* Accent where it is filled */
html .dd-priority-options button[aria-pressed=true]{background:var(--now);color:var(--on-now);border-color:var(--now)}
html .dd-iso-tag{color:var(--on-now);border-radius:5px}

/* Board */
html .b6 .b2-viewport{background-color:var(--board-canvas)}
html .b6 .b2-icon[aria-pressed=true],html .b6 .b2-dock .b2-icon[aria-pressed=true]:has(>.dd-btn-label){background:var(--now);color:var(--on-now)}
html .b6 .b4-selectionbar .b2-icon[aria-pressed=true]{background:var(--now);color:var(--on-now)}
/* The selection bar names what is selected in full ("3 objects", a section name), up to a sensible width. */
html .b6 .b4-selectionbar>strong{max-width:180px}
html .b6 .b4-selectionbar>strong>span:nth-child(2){max-width:140px}
@media (max-width:700px){html .b6 .b4-selectionbar>strong{max-width:120px}html .b6 .b4-selectionbar>strong>span:nth-child(2){max-width:86px}}
html .b6 .b2-dock{border-radius:16px}
html .b6 .b2-dock>.b2-icon{border-radius:11px}

/* Views: emoji stay, the tinted squares and underline go */
html .views button[data-panel][aria-selected=true]{box-shadow:var(--gr-hi),0 1px 3px #00000022,0 0 0 1px var(--rule)}
html .views button .dd-panel-icon,html .views button[data-panel][aria-selected=true] .dd-panel-icon{background:none;box-shadow:none;width:1.4em;height:1.4em;margin-inline-end:.35em;font-size:1.05em}

/* Nothing important below 12px */
html .dchip .t .cap{font-size:calc(12px * var(--k));color:var(--ink-3)}
html .dchip b{font-weight:600}
html :is(.subnode-actions button,.nodes-lbl,.tree-btn span,.bug-tag-btn,.llen,.time-key,.dd-cloud-mini,.utilities button,.b4-modes button){font-size:12px;letter-spacing:0;font-family:var(--sans)}
html .duration-text{font-size:11.5px;font-weight:600}
html .b4-node-subtitle,html .b4-node-subtitle :is(b,span){font-size:11px;letter-spacing:0;font-family:var(--sans)}
html .b6 .b2-icon .dd-btn-label{font-size:12.5px}
html .drop:empty::before{text-transform:none;letter-spacing:0;font:500 12.5px/1.3 var(--sans);color:var(--ink-3)}

/* The Engine's section: calmer frame, title is the handle to move it */
html .dd-engine-area{border:1.5px solid color-mix(in srgb,var(--panel-engine,#F05A28) 38%,transparent);background:color-mix(in srgb,var(--panel-engine,#F05A28) 4%,transparent);border-radius:32px}
html .dd-engine-area-title{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 4px 14px -6px #0006}
html .dd-engine-area-title:active{cursor:grabbing}
html .dd-engine-area-title button{cursor:pointer}

/* Calmer details (5.40): a done task is the tick and the dim text, no extra
   "Done" pill; Persian steps start next to their tick; nothing hides behind
   the phone's Capture button; the calendar picker shows its whole name. */
html .dd-done-badge{display:none}
html:not([dir=rtl]) .subnode-input[dir=auto]{text-align:left}
html .dd-review-system{min-width:118px}
@media (max-width:700px){
  html .dd-review-system{min-width:112px;flex-basis:112px}
}

/* Board gets the room (5.41). On the Board view the Plan's rows (template,
   timer, worry, later, pause, day note, find and quick add) step aside: the
   board has its own timer, search and add tools, and the Plan keeps them all.
   The board then fills the window under the header. */
html main:has(> #b2) > :is(.dayline,.note,.toolbar,.dd-life-root,.dd-mobile-more){display:none}
html main:has(> #b2) > .dd-capture-root > .dd-capture-bar{display:none}
html main:has(> #b2) > #b2:not(.focus-mode){height:calc(100dvh - 104px);min-height:480px}

/* Phone: the view tabs sit at the bottom, under the thumb, like other phone
   apps. Capture floats just above them. */
@media (max-width:700px){
  html .top .dd-tabs{position:fixed;left:0;right:0;bottom:0;z-index:112;margin:0;padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px));background:var(--panel);border-top:1px solid var(--rule-2);box-shadow:0 -8px 24px -18px #0008}
  html .dd-floating-capture{bottom:calc(76px + env(safe-area-inset-bottom,0px))}
  html .dd-floating-capture.dd-on-board{bottom:calc(148px + env(safe-area-inset-bottom,0px))}
  html body{padding-bottom:calc(150px + env(safe-area-inset-bottom,0px))}
  html main:has(> #b2) > #b2:not(.focus-mode){height:calc(100dvh - 232px)}
  /* Full screen on a phone keeps the tabs, so Plan is one tap away. */
  html .b4.focus-mode{bottom:calc(64px + env(safe-area-inset-bottom,0px));height:auto}
  html body:has(.b4.focus-mode) .top .dd-tabs{z-index:1001}
}

/* Calm Plan (5.42). A task is one line: name, time, steps. The hour bar is
   gone, steps open only when asked, and the − / + and "+ Steps" buttons wait
   for the pointer on a computer. Day tools with nothing in them (one
   template, no worries, empty Later, a day not paused) wait behind "…". */
html main:not(.dd-more-open) .dd-quiet{display:none!important}
html main:not(.dd-more-open) .dd-capture-bar:not(:has(>:not(.dd-quiet))){display:none}
html .dd-day-more{width:max(var(--ctl),var(--tmin));justify-content:center;padding:0;color:var(--ink-3)}
html .dd-day-more:hover,html .dd-day-more[aria-expanded=true]{color:var(--ink)}
@media (pointer:coarse){html .dayline .dd-day-more{display:none}}
html .list .row .rn .ty{display:none}
@media (hover:hover){
  html .list .row .step>button,html .list .row .tree-btn[data-empty]:not([aria-expanded=true]){opacity:0;transition:opacity .12s}
  html .list .row:is(:hover,:focus-within) .step>button,html .list .row:is(:hover,:focus-within) .tree-btn[data-empty]{opacity:1}
}
html .subtree .dd-add-step{align-self:flex-start;min-height:26px;padding:0 4px;font-size:12px;color:var(--ink-3)}
html .subtree .dd-add-step:hover{color:var(--ink)}
html .dd-day-stickers.is-empty{border:0;padding:0;background:none;gap:0}
html .dd-day-stickers.is-empty .dd-day-sticker-heading{justify-content:flex-start}
html .dd-day-stickers.is-empty .dd-sticker-add{min-height:28px;padding:0 9px;background:none;border-color:transparent;color:var(--ink-3);font:500 12px/1 var(--sans)}
html .dd-day-stickers.is-empty .dd-sticker-add:hover{border-color:var(--rule-2);color:var(--ink)}
html .dd-day-stickers.is-empty .dd-sticker-add>span:first-child{font-size:13px}
html .time-key>.dd-day-stickers.is-empty{margin-inline-start:auto}
html .time-key>.dd-day-stickers.is-empty+*{margin-left:0!important}

/* Line icons for panels (5.43): the panel's color draws the icon; in the
   view tabs it takes the tab's own ink. */
html .dd-panel-icon{color:var(--pc,var(--ink-2))}
html .dd-panel-icon>svg{width:1.05em;height:1.05em;display:block}
html .views button .dd-panel-icon{color:inherit}

/* Focus stays visible for keyboards */
html :is(button,a,input,select,textarea):focus-visible{outline:2px solid var(--now);outline-offset:2px}

@media (prefers-reduced-motion:reduce){html *{transition:none!important}}
`;

export function DDinstallGraphite() {
  if (typeof document === "undefined" || document.getElementById("dd-graphite")) return;
  const style = Object.assign(document.createElement("style"), { id: "dd-graphite", textContent: DDgraphiteCSS });
  (document.body || document.documentElement).append(style);
}
