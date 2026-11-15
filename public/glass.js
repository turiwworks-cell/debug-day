// Glass (5.81): Debug Day as if Apple had made it for iOS 27. The system's
// colors, San Francisco, continuous round corners, and Liquid Glass for the
// controls that float over the content: the view tabs, the Board's bars, the
// tools dock, menus and sheets. Only the look lives here: no behaviour.
//
// It is installed after Graphite (graphite.js), so the same tokens win. Sticky
// notes keep their own look: nothing here targets their paper, fold or font.

// System colors from the iOS 27 kit (light, dark).
const sys = {
  orange: ["#F5730C", "#FF9230"],
  blue: ["#0088FF", "#0091FF"],
  green: ["#34C759", "#30D158"],
  red: ["#FF383C", "#FF4245"],
  indigo: ["#6155F5", "#6D7CFF"],
  yellow: ["#FFCC00", "#FFD600"],
};
// The app's tint. One line to change it: every accent reads --now.
const tint = sys.blue;

const light = `
  --paper:#F2F2F7;--panel:#FFFFFF;--raise:#FFFFFF;
  --pi:#000000;--pi-2:#3C3C43C7;--pi-3:#3C3C4399;
  --ink:#000000;--ink-2:#3C3C43C7;--ink-3:#3C3C4399;--ink-4:#3C3C434D;
  --rule:#3C3C431A;--rule-2:#3C3C432E;--wash:#7676801F;--cell0:#74748014;
  --now:${tint[0]};--on-now:#FFFFFF;--now-on-light:var(--now);
  --ok:${sys.green[0]};--bug:${sys.red[0]};--inner:${sys.indigo[0]};--energy:${sys.yellow[0]};
  --g1:#CDEFD6;--g2:#8EDBA4;--g3:#34C759;--g4:#248A3D;
  --glass:rgba(255,255,255,.66);--glass-strong:rgba(255,255,255,.82);
  --glass-edge:inset 0 0 0 .5px rgba(255,255,255,.75),inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(0,0,0,.06);
  --glass-shadow:0 10px 30px -8px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.05);
  --glass-press:rgba(118,118,128,.16);--glass-pill:rgba(118,118,128,.14);
  --scrim:rgba(0,0,0,.22);
  --gr-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px -12px rgba(0,0,0,.18);
  --gr-hi:inset 0 1px 0 rgba(255,255,255,.7);
  color-scheme:light`;
const dark = `
  --paper:#000000;--panel:#1C1C1E;--raise:#2C2C2E;
  --pi:#FFFFFF;--pi-2:#EBEBF5C7;--pi-3:#EBEBF599;
  --ink:#FFFFFF;--ink-2:#EBEBF5C7;--ink-3:#EBEBF599;--ink-4:#EBEBF54D;
  --rule:#FFFFFF17;--rule-2:#FFFFFF2B;--wash:#7676803D;--cell0:#7474802E;
  --now:${tint[1]};--on-now:#FFFFFF;--now-on-light:var(--now);
  --ok:${sys.green[1]};--bug:${sys.red[1]};--inner:${sys.indigo[1]};--energy:${sys.yellow[1]};
  --g1:#123A1E;--g2:#1E6B35;--g3:#30D158;--g4:#7BE495;
  --glass:rgba(44,44,48,.58);--glass-strong:rgba(44,44,48,.82);
  --glass-edge:inset 0 0 0 .5px rgba(255,255,255,.16),inset 0 1px 0 rgba(255,255,255,.12),0 0 0 .5px rgba(0,0,0,.6);
  --glass-shadow:0 12px 36px -8px rgba(0,0,0,.7),0 2px 6px rgba(0,0,0,.4);
  --glass-press:rgba(255,255,255,.12);--glass-pill:rgba(255,255,255,.14);
  --scrim:rgba(0,0,0,.5);
  --gr-shadow:0 1px 0 rgba(255,255,255,.04),0 10px 28px -16px rgba(0,0,0,.9);
  --gr-hi:inset 0 1px 0 rgba(255,255,255,.06);
  color-scheme:dark`;
// The Board's canvas and cards (Freeform-like: a quiet canvas, white cards).
const boardLight = `--paper:#FFFFFF;--ink:#000000;--ink-2:#3C3C43C7;--ink-3:#3C3C4399;--ink-4:#3C3C434D;--wash:#7676801F;--rule:#3C3C431A;--rule-2:#3C3C432E;--board-canvas:#F2F2F7;--board-accent:var(--now);--b6-radius:16px`;
const boardDark = `--paper:#1C1C1E;--ink:#FFFFFF;--ink-2:#EBEBF5C7;--ink-3:#EBEBF599;--ink-4:#EBEBF54D;--wash:#7676803D;--rule:#FFFFFF17;--rule-2:#FFFFFF2B;--board-canvas:#000000;--board-accent:var(--now);--b6-radius:16px;color-scheme:dark`;
const islands =
  ".row,.cap-item,.bug-in,.cal-chip,.cmd-input-row,.app-map-card,.dd-on-light,.dd-panel select,.dd-panel input:not([type=checkbox]),.dd-card-field select,.dd-card-field textarea,.dd-card-minutes input,.dd-measure-times input,.dd-habits,.dd-habit-min input,.dd-habit-plus,.dd-habit-list input:not([type]),.dd-habit-edit input:not([type]),.dd-feeling-details input:not([type]),.dd-feeling-details select,.dd-review-feelings-brief li,.dd-feelings-quick-list li";

// Liquid Glass: a clear, blurred layer with a bright rim and a soft shadow.
const glass = `background:var(--glass);-webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);box-shadow:var(--glass-edge),var(--glass-shadow);border:0`;
const glassStrong = `background:var(--glass-strong);-webkit-backdrop-filter:blur(30px) saturate(190%);backdrop-filter:blur(30px) saturate(190%);box-shadow:var(--glass-edge),var(--glass-shadow);border:0`;

// Floating things made of glass.
const floating = [
  ".b6 .b2-top-actions",
  ".b6 .b2-dock",
  ".b6 .b2-camera",
  ".b6 .b4-minimap",
  ".b6 .b4-selectionbar",
  ".b6 .dd-rail-toggle",
  ".dd-shape-pop",
  ".dd-shape-row",
  ".dd-pen-bar",
].join(",");
const menus = [".b6-context", ".b6 .b6-properties", ".b6 .b6-view-panel", ".dd-board-search", ".dd-board-timer", ".dd-rail-panel", ".b4-inspector", ".dd-habit-colors", ".b6 .dd-card-details", ".dd-thread:not(.dd-comment-card)", ".dd-comments-panel"].join(",");

export const DDglassCSS = `
:root{${light};
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro","Geist","Vazirmatn",system-ui,sans-serif;
  --display:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro","Geist","Vazirmatn",system-ui,sans-serif;
  --mono:var(--sans);
  --r-ctl:12px;--r-card:20px;--r-panel:28px;--r-pill:999px}
:root[data-theme=dark]{${dark}}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${dark}}}
html[data-theme=dark] :is(${islands}){--ink:var(--pi);--ink-2:var(--pi-2);--ink-3:var(--pi-3);--ink-4:#EBEBF54D;--paper:#000;--rule:#FFFFFF17;--rule-2:#FFFFFF2B;--wash:#7676803D;--cell0:#7474802E;--now:${tint[1]};color-scheme:dark}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) :is(${islands}){--ink:var(--pi);--ink-2:var(--pi-2);--ink-3:var(--pi-3);--ink-4:#EBEBF54D;--paper:#000;--rule:#FFFFFF17;--rule-2:#FFFFFF2B;--wash:#7676803D;--cell0:#7474802E;--now:${tint[1]};color-scheme:dark}}
html .b6{${boardLight}}
html[data-theme=dark] .b6{${boardDark}}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) .b6{${boardDark}}}

/* Type: San Francisco, Apple's sizes and tracking */
html body{font-family:var(--sans);letter-spacing:-.01em;-webkit-font-smoothing:antialiased}
html .brand{font:700 calc(17px * var(--k))/1.2 var(--display);letter-spacing:-.022em}
html :is(.dd-review-root h1,.dd-review-calendar-head h2){font-family:var(--display);font-weight:700;letter-spacing:-.025em}
html .dd-review-root h1{font-size:34px;line-height:41px}
/* Like an app (5.84.1): the interface's own words can't be selected, and a long press on a phone shows no copy bubble.
   What you write or read stays selectable: fields, the note and document editors, a document you read, comments, the day note, code. */
html body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
html :is(input,textarea,select,[contenteditable]:not([contenteditable=false]),.dd-doc-read,.dd-thread p,.dd-review-note-text,code,pre,.dd-selectable),
html :is([contenteditable]:not([contenteditable=false]),.dd-doc-read,.dd-thread p,.dd-review-note-text,.dd-selectable) *{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
html :is(input[type=checkbox],input[type=radio],input[type=range],input[type=color],input[type=button],input[type=submit]){-webkit-user-select:none;user-select:none}

/* Buttons are capsules; quiet buttons are tinted text on a soft fill */
html :is(.btn,.dchip,.navb,.textbtn,.addlane,.defp,.bug-tag-btn,.dd-pill,.sw button){border-radius:var(--r-pill)}
html :is(.btn,.navb){border:0;background:var(--wash);color:var(--ink);box-shadow:none;font-weight:500}
html :is(.btn,.dchip,.navb):hover{background:var(--glass-press);box-shadow:none}
html .btn.solid,html .quick .go,html .bug-in .go{background:var(--now);color:var(--on-now);border-radius:var(--r-pill);font-weight:600;box-shadow:none}
html .btn.solid:hover,html .quick .go:hover{background:var(--now);filter:brightness(1.06);opacity:1}
html :is(.field,.box,.journal,.noterow){box-shadow:none;background:var(--panel);border-radius:var(--r-ctl)}
html .field:focus,html .box:focus-within{box-shadow:0 0 0 3.5px color-mix(in srgb,var(--now) 30%,transparent)}
:where(button,select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=range])):where(:not(.b4-sticky *,.dd-plan-life-note *,.b4-sticky,.dd-plan-life-note)){border-radius:var(--r-ctl)}
html :is(button,a,input,select,textarea):focus-visible{outline:3px solid color-mix(in srgb,var(--now) 55%,transparent);outline-offset:2px}

/* Segmented controls: a soft capsule track, the picked part a raised capsule */
html :is(.views,.seg,.lay,.dd-review-sections,.dd-measure-seg){background:var(--wash);border-radius:var(--r-pill);padding:2px;gap:0;box-shadow:none}
html :is(.views,.seg,.lay,.dd-review-sections,.dd-measure-seg) button{border:0;background:none;border-radius:var(--r-pill);color:var(--ink);font:500 calc(13px * var(--k))/1 var(--sans);letter-spacing:-.005em}
html .views button[aria-selected=true],html :is(.seg,.lay,.dd-measure-seg) button[aria-pressed=true],html .dd-review-sections button[aria-selected=true]{background:var(--panel);color:var(--ink);box-shadow:0 3px 8px rgba(0,0,0,.12),0 3px 1px rgba(0,0,0,.04),0 0 0 .5px rgba(0,0,0,.04)}
html[data-theme=dark] :is(.views button[aria-selected=true],.seg button[aria-pressed=true],.lay button[aria-pressed=true],.dd-measure-seg button[aria-pressed=true],.dd-review-sections button[aria-selected=true]){background:#636366}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) :is(.views button[aria-selected=true],.seg button[aria-pressed=true],.lay button[aria-pressed=true],.dd-measure-seg button[aria-pressed=true],.dd-review-sections button[aria-selected=true]){background:#636366}}

/* The view tabs at the top: a glass capsule, the picked tab a tinted pill (iPadOS 27) */
html .top .views{${glass};padding:4px}
html .top .views button{color:var(--ink);font-weight:600}
html .top .views button[aria-selected=true]{background:var(--glass-pill);color:var(--now);box-shadow:none}
html .top .views button:not([aria-selected=true]):hover{background:var(--glass-press)}
html .top :is(.dd-back,.dd-board-direct,.navb){${glass};border-radius:var(--r-pill);color:var(--ink)}
html .top :is(.dd-back,.dd-board-direct,.navb):hover{background:var(--glass-strong)}
html .top>div>.btn{${glass};border-radius:var(--r-pill);color:var(--ink-2);padding-inline:14px 18px}
html .top>div>.btn .cap{color:var(--ink-3);font-weight:400;font-size:calc(15px * var(--k))}
html .daynav .dd b{font:600 calc(15px * var(--k))/1.2 var(--display);letter-spacing:-.02em}
html .daynav .dd .cap{color:var(--ink-3)}

/* Cards and grouped lists: white on the grouped background, no outlines */
html .row{border-radius:var(--r-card);box-shadow:none;background:var(--panel)}
html .row .sq{border-radius:12px}
html .note{border-radius:var(--r-card);box-shadow:none;background:var(--panel)}
html .cap-item{box-shadow:none;border-radius:var(--r-card)}
html .ed{border-radius:var(--r-card);box-shadow:none}
html .drop:empty{box-shadow:none;border:1.5px dashed var(--rule-2);background:transparent}

/* The Board: glass bars over a quiet canvas */
html .b6 :is(${floating}){${glass}}
html .b6 .b2-top-actions{border-radius:var(--r-pill);padding:4px 6px;min-height:44px}
/* The day sits at the top centre of the Board as plain words, no box (5.82) */
html .b6 .b2-top>.b2-brandbar{border-color:transparent;border-radius:0;background:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;justify-content:center;text-align:center}
/* On a computer it floats at the top centre; a phone keeps it as its own row, so nothing below moves. */
@media (min-width:701px){
  html .b6 .b2-top>.b2-brandbar{position:absolute;left:50%;top:2px;transform:translateX(-50%);z-index:1;width:auto;max-width:min(360px,40%);min-height:0;padding:0;border:0;pointer-events:none}
  html .b6 .b2-top>.b2-top-actions{margin-inline-start:auto}
}
html .b6 .b2-top>.b2-brandbar>div{display:flex;flex-direction:column;align-items:center;gap:1px}
html .b6 .b2-brandbar strong{font:650 17px/1.2 var(--display);letter-spacing:-.02em;color:var(--ink);white-space:nowrap}
html .b6 .b2-brandbar small{font:500 12px/1.3 var(--sans);color:var(--ink-3);white-space:nowrap}
html .b6 .b2-brandbar .b2-brand-alt{color:var(--ink-2)}
html .b6 .b2-dock{border-radius:var(--r-pill);padding:6px;height:54px;gap:2px}
html .b6 .b2-dock>.b2-icon{border-radius:var(--r-pill);min-width:42px;height:42px}
html .b6 .b2-dock .b2-icon[aria-pressed=true],html .b6 .b2-dock .b2-icon[aria-pressed=true]:has(>.dd-btn-label){background:var(--now);color:var(--on-now);box-shadow:0 4px 12px -4px color-mix(in srgb,var(--now) 70%,transparent)}
html .b6 .b2-icon{border-radius:var(--r-pill)}
html .b6 .b2-icon:hover{background:var(--glass-press)}
html .b6 .b2-icon[aria-pressed=true]{background:var(--now);color:var(--on-now)}
html .b6 .b2-sep{background:var(--rule-2);opacity:1}
/* Icons read like SF Symbols: a touch larger in the bars, the soft body tinted with the picked state (5.83) */
html .b6 :is(.b2-dock,.b2-camera)>.b2-icon>svg{width:21px;height:21px}
html .b6 .b4-selectionbar .b2-icon>svg{width:20px;height:20px}
html .b6 .b2-icon[aria-pressed=true] .dd-icon-fill{opacity:.3}
/* Hover labels: the bars' own little glass labels replace the dark boxes (they were cut off under the dock) */
html .b6 :is(.b2-dock,.b2-camera,.b4-selectionbar,.b2-top-actions) .b2-icon[data-tip]:hover::after{content:none;display:none}
.dd-hover-tip{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;display:flex;align-items:center;gap:7px;padding:6px 11px;border-radius:var(--r-pill);${glassStrong};color:var(--ink);font:600 12.5px/1.25 var(--sans);letter-spacing:-.01em;white-space:nowrap;opacity:0;transform:translateY(var(--tip-shift,4px)) scale(.94);transition:opacity .12s ease,transform .2s cubic-bezier(.2,.9,.3,1.25)}
.dd-hover-tip.on{opacity:1;transform:none}
.dd-hover-tip small{font:500 12px/1.25 var(--sans);color:var(--ink-3)}
.dd-hover-tip kbd{font:600 11px/1 var(--sans);color:var(--ink-3);padding:3px 6px;border-radius:7px;background:var(--glass-pill)}
@media (prefers-reduced-motion:reduce){.dd-hover-tip{transition:none}}
/* The way back on the Board: a tinted chevron like iOS's Back, never a loud square (5.83) */
html .b6 :is(.dd-room-bar,.dd-place-bar){${glass};border-radius:var(--r-pill);padding:4px 6px 4px 4px;font:500 13.5px/1.2 var(--sans)}
html .b6 :is(.dd-room-bar,.dd-place-bar) button{border-radius:var(--r-pill)}
html .b6 :is(.dd-room-bar,.dd-place-bar) button:hover{background:var(--glass-press)}
html .b6 :is(.dd-room-bar,.dd-place-bar) .dd-room-back{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:4px 6px;background:color-mix(in srgb,var(--now) 13%,transparent);color:var(--now);font-weight:600}
html .b6 :is(.dd-room-bar,.dd-place-bar) .dd-room-back svg{stroke-width:2.2}
html .b6 :is(.dd-room-bar,.dd-place-bar) .dd-room-back:hover:not(:disabled){background:color-mix(in srgb,var(--now) 22%,transparent)}
html .b6 .dd-place-bar .dd-room-back:disabled{background:transparent;color:var(--ink-3);opacity:.6}
html .b6 :is(.dd-room-bar,.dd-place-bar) [aria-current=page]{font-weight:600}
html .b6 .b2-camera{border-radius:var(--r-pill);padding:5px 6px}
html .b6 .b2-camera button{border-radius:var(--r-pill)}
html .b6 .b4-minimap{border-radius:22px;overflow:hidden}
html .b6 .dd-rail-toggle{border-radius:var(--r-pill);padding:8px 14px;font-weight:500}
html .b6 .dd-rail-toggle:hover{background:var(--glass-strong)}

/* The selection bar: a glass capsule that follows the theme (iOS edit menu) */
html body .b6 .b4-selectionbar{color:var(--ink);border-radius:var(--r-pill);padding:4px 6px;min-height:44px;gap:2px}
html body .b6 .b4-selectionbar :is(.b2-icon,>strong){color:var(--ink)}
html body .b6 .b4-selectionbar .b2-icon{border-radius:var(--r-pill);min-width:36px;min-height:36px}
html body .b6 .b4-selectionbar .b2-icon:hover{background:var(--glass-press);color:var(--ink)}
html body .b6 .b4-selectionbar .b2-icon[aria-pressed=true],html body .b6 .b4-selectionbar .b2-icon[aria-expanded=true]{background:var(--glass-pill);color:var(--now)}
html body .b6 .b4-selectionbar .b2-sep{background:var(--rule-2)}
html body .b6 .b4-selectionbar .dd-shape-swatch{width:22px;height:22px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.12)}
html body .b6 .b4-selectionbar [data-shape-open]::after{display:none}
html body .b6 .b4-readout{color:var(--ink-2);font-weight:500;padding-inline:8px 4px}

/* Menus, popovers and panels over the Board: frosted, round, roomy */
html body :is(${menus}){${glassStrong};border-radius:22px;color:var(--ink)}
html body .b6-context{padding:6px;border-radius:20px}
html body .b6-context [role=menuitem],html body .b6-context [role=menuitemcheckbox],html body .b6-context [role=menuitemradio]{border-radius:12px;min-height:36px}
html body .b6-context [role=separator],html body .b6-context hr{background:var(--rule);border-color:var(--rule)}
html body :is(.dd-shape-pop){color:var(--ink);border-radius:24px}
html body .dd-shape-pop :focus-visible{outline-color:var(--now)}
html body .dd-shape-modes{border-bottom-color:var(--rule)}
html body .dd-shape-modes button{border-radius:var(--r-pill)}
html body .dd-shape-modes button:hover,html body .dd-shape-grid button:hover{background:var(--glass-press)}
html body :is(.dd-shape-modes button[aria-checked=true],.dd-shape-grid button[aria-selected=true]){background:var(--now);color:var(--on-now)}
html body .dd-shape-swatches button{box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}
html body .dd-shape-swatches button[aria-checked=true]{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--now)}
html body .dd-shape-search{background:var(--wash);color:var(--ink-3);border-radius:var(--r-pill)}
html body .dd-shape-search input{color:var(--ink)}
html body .dd-shape-search:focus-within{border-color:transparent;box-shadow:0 0 0 3px color-mix(in srgb,var(--now) 35%,transparent)}
html body .dd-shape-row>button[aria-pressed=true]{box-shadow:none;background:var(--glass-pill);color:var(--now)}
html body .dd-shape-row{border-radius:var(--r-pill)}

/* Windows over the page: sheets with large round corners and a soft scrim */
html :is(.cmd-modal,.app-map-modal,.dd-capture-dialog){border-radius:var(--r-panel);background:var(--panel);box-shadow:0 30px 80px -20px rgba(0,0,0,.35),0 0 0 .5px var(--rule-2);border:0}
html :is(.dd-engine-backdrop,.cmd-backdrop,.dd-doc-backdrop,.b4-help-backdrop,.dd-flow-backdrop){background:var(--scrim);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
html .toast{${glass};color:var(--ink);font:500 14px/1.3 var(--sans);border-radius:var(--r-pill);padding:12px 20px}

/* Floating Capture: a prominent tinted glass button */
html .dd-floating-capture{background:var(--now);color:var(--on-now);border:0;border-radius:var(--r-pill);box-shadow:0 10px 24px -8px color-mix(in srgb,var(--now) 65%,transparent),inset 0 1px 0 rgba(255,255,255,.35);font:600 15px var(--sans)}
html .dd-floating-capture.dd-on-board{width:52px;height:52px;min-height:52px;padding:0;justify-content:center}

/* Phone: the tab bar floats as a glass capsule above the content (iOS 27) */
@media (max-width:700px){
  html .top .dd-tabs{left:16px;right:16px;bottom:calc(10px + env(safe-area-inset-bottom,0px));padding:0;background:none;border:0;box-shadow:none;display:flex;gap:10px;align-items:center}
  html .top .dd-tabs .views{flex:1;${glass};padding:4px;height:62px}
  html .top .dd-tabs .views button{flex:1;height:54px;flex-direction:column;gap:2px;font:600 11px/1.1 var(--sans);letter-spacing:0}
  html .top .dd-tabs .views button .dd-panel-icon,html .top .dd-tabs .views button svg{width:24px;height:24px;margin:0}
  html .top .dd-tabs .views button[aria-selected=true]{background:var(--glass-pill);color:var(--now)}
  html .top .dd-tabs .dd-back{flex:none;width:62px;height:62px;${glass};border-radius:var(--r-pill)}
  html .top .dd-tabs{width:auto}
  html .dd-floating-capture{bottom:calc(86px + env(safe-area-inset-bottom,0px))}
  html .dd-floating-capture.dd-on-board{bottom:calc(150px + env(safe-area-inset-bottom,0px))}
  html .b4.focus-mode{bottom:calc(82px + env(safe-area-inset-bottom,0px))}
  html .top>div>.btn{width:44px;padding:0;justify-content:center}
  html .top>div>.btn .cap{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
  /* Content fades out under the floating tab bar (the scroll edge effect) */
  html body::after{content:"";position:fixed;left:0;right:0;bottom:0;height:calc(92px + env(safe-area-inset-bottom,0px));background:linear-gradient(to bottom,color-mix(in srgb,var(--paper) 0%,transparent),color-mix(in srgb,var(--paper) 88%,transparent) 55%,var(--paper));pointer-events:none;z-index:111}
  html .navb{width:44px;height:44px;min-width:44px}
}

/* The panels' colors, as iOS system colors */
:root{--panel-engine:#FF8D28;--panel-board:#CB30E0;--panel-habits:#34C759;--panel-calendar:#FF383C}
:root[data-theme=dark]{--panel-engine:#FF9230;--panel-board:#DB34F2;--panel-habits:#30D158;--panel-calendar:#FF4245}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--panel-engine:#FF9230;--panel-board:#DB34F2;--panel-habits:#30D158;--panel-calendar:#FF4245}}

/* Menus: round color dots stay dots; shortcuts in the same face */
html body .b6-context .b6-menu-swatches button{min-height:0;width:24px;height:24px;border-radius:50%;border:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
html body .b6-context .b6-menu-swatches button[aria-checked=true]{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--now)}
html kbd{font-family:var(--sans)}

/* Priority: a soft tinted capsule, never alarm red */
html .pri{border-radius:var(--r-pill);font:600 11px/18px var(--sans);height:18px;padding:0 7px;box-shadow:none}
html .pri.p1{background:var(--now);color:var(--on-now)}
html .pri.p2{background:color-mix(in srgb,var(--now) 16%,transparent);color:var(--now)}
html .pri.p3{background:var(--wash);color:var(--ink-3);box-shadow:none}
html .dd-priority-options{gap:0;padding:2px;border-radius:var(--r-pill);background:var(--wash);display:inline-flex}
html .dd-priority-options button{border:0;border-radius:var(--r-pill);background:none;min-height:30px;padding:0 14px;font:500 13px var(--sans);color:var(--ink)}
html .dd-priority-options button[aria-pressed=true],html .dd-priority-options button[data-priority="1"][aria-pressed=true]{background:var(--now);color:var(--on-now);border:0}

/* Cards on the Board: softer corners and a floating shadow */
html .b6 .b4-node:not(.b4-sticky):not(.b4-life-section):not(.b4-shape){border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 16px -8px rgba(0,0,0,.18),inset 0 0 0 .5px var(--rule-2)}
html .b6 .b4-node:not(.b4-sticky):not(.b4-life-section) .b4-node-icon{border-radius:14px 0 0 14px}
html[dir=rtl] .b6 .b4-node:not(.b4-sticky):not(.b4-life-section) .b4-node-icon{border-radius:0 14px 14px 0}
html .b6 .b4-node.selected{outline-color:var(--now)}

/* Card details and form fields inside panels */
html .b6 .dd-card-details :is(input:not([type=checkbox]):not([type=radio]),textarea,select){border:0;background:var(--wash);border-radius:12px;color:var(--ink)}
html .b6 .dd-card-details :is(input,textarea,select):focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--now) 30%,transparent);outline:none}
html .b6 .dd-card-details :is(.dd-pill,button.btn){border:0;background:var(--wash)}

/* Search (Ctrl+Space): Spotlight */
html :is(.cmd-backdrop,.dd-command-backdrop){background:var(--scrim);-webkit-backdrop-filter:blur(14px) saturate(140%);backdrop-filter:blur(14px) saturate(140%)}
html .cmd-modal{border-radius:30px;background:var(--glass-strong);-webkit-backdrop-filter:blur(40px) saturate(190%);backdrop-filter:blur(40px) saturate(190%);box-shadow:var(--glass-edge),0 40px 90px -20px rgba(0,0,0,.45)}
html .cmd-input-row{background:transparent;border-bottom:.5px solid var(--rule-2);padding:14px 18px}
html .cmd-input-row input{font:400 21px/1.2 var(--sans);letter-spacing:-.015em;color:var(--ink);outline:none!important;box-shadow:none!important;border:0!important;background:none!important}
html .cmd-input-row input::placeholder{color:var(--ink-3)}
html .dd-search-suggestions :is(button,span){border:0;background:var(--wash);border-radius:var(--r-pill);color:var(--ink);font-weight:500}
html .cmd-item{border-radius:14px}
html .cmd-item:hover,html .cmd-item[aria-selected=true]{background:var(--glass-pill);box-shadow:none}
html .dd-command-close{border-radius:50%;background:var(--wash)}

/* The Sections flowchart: a sheet */
html .dd-flow{border-radius:30px;box-shadow:0 40px 90px -20px rgba(0,0,0,.4),0 0 0 .5px var(--rule-2);overflow:hidden}
html .dd-flow-find{border:0;border-radius:var(--r-pill);background:var(--wash);box-shadow:none}
html .dd-flow-find input{border:0;background:none;box-shadow:none}

/* Search chips and the picked row */
html :is(.dd-search-chips,.dd-search-suggestions){border-bottom:.5px solid var(--rule-2)}
html :is(.dd-search-chips,.dd-search-suggestions) button{border:0;border-radius:var(--r-pill);background:var(--wash);color:var(--ink);font:500 13px var(--sans);padding:6px 12px}
html .dd-command-row{border-radius:14px}
html .dd-command-row.active{background:var(--glass-pill);box-shadow:none}

/* Settings: grouped, with switches and segmented choices (iOS Settings) */
/* The section bar stays solid: a blurred sticky bar painted over the top bar in Safari (5.81.1). The top bar always sits above it. */
html .dd-settings-nav{border-block-end:0;background:var(--paper);-webkit-backdrop-filter:none;backdrop-filter:none}
html .app:has(> main > .dd-settings) > .top{position:relative;z-index:41}
html .dd-settings-nav a{border-radius:var(--r-pill);background:var(--wash);font:500 13px var(--sans);padding:8px 14px}
html .dd-settings-nav a:hover{background:var(--glass-press)}
html .dd-settings :is(select,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])){border:0;background:var(--panel);border-radius:12px;box-shadow:none;color:var(--ink)}
html .sw button{box-shadow:none;background:var(--wash);color:var(--ink);border-radius:var(--r-pill)}
html .sw button[aria-pressed=true]{background:var(--now);color:var(--on-now)}
html .sw button.col{border-radius:50%}
html .sw button.col[aria-pressed=true]{box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--c)}
html .sw button.auto{font:600 11px/1 var(--sans);letter-spacing:0;text-transform:none}
html .dd-settings input[type=checkbox]{-webkit-appearance:none;appearance:none;flex:none;width:51px;height:31px;margin:0;border-radius:999px;border:0;background:var(--wash) radial-gradient(circle 13.5px at 15.5px 50%,#fff 96%,transparent 100%) no-repeat;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.04);cursor:pointer;transition:background-color .2s ease,background-position .2s ease;background-position:0 0}
html .dd-settings input[type=checkbox]:checked{background-color:var(--ok);background-position:20px 0}
html .dd-settings input[type=checkbox]:disabled{opacity:.4;cursor:default}
html[dir=rtl] .dd-settings input[type=checkbox]{background-position:20px 0}
html[dir=rtl] .dd-settings input[type=checkbox]:checked{background-position:0 0}

/* The Engine: a sheet, grouped like Reminders */
html .dd-engine-backdrop{background:var(--scrim);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%)}
html .dd-engine[data-mode=overlay]{border-radius:34px;box-shadow:0 40px 100px -24px rgba(0,0,0,.45),0 0 0 .5px var(--rule-2)}
html .dd-engine-head{border-bottom:0;padding:20px 24px 8px;gap:10px}
html .dd-engine-icon{display:none}
html .dd-engine-title strong{font:700 24px/1.15 var(--display);letter-spacing:-.025em}
html .dd-engine-title small{font-size:13px;color:var(--ink-3)}
html .dd-engine-progress{font:500 13px/1 var(--sans);color:var(--ink-2)}
html .dd-engine-bar{height:4px;background:var(--wash)}
html .dd-engine-bar i{background:var(--now)}
html :is(.dd-engine-earlier-toggle,.dd-engine-routine-toggle,.dd-engine-close){height:32px;padding:0 14px;border-radius:var(--r-pill);background:var(--wash);color:var(--ink);box-shadow:none;font:500 13px/1 var(--sans)}
html :is(.dd-engine-earlier-toggle,.dd-engine-routine-toggle)[aria-expanded=true]{background:var(--glass-pill);color:var(--now)}
html .dd-engine-close kbd{background:none;box-shadow:none;color:var(--ink-3);font:500 12px var(--sans);padding:0}
html .dd-engine-tools{padding:10px 24px 0;gap:10px}
html .dd-engine-find{height:36px;border-radius:var(--r-pill);padding:0 14px;background:var(--wash)}
html .dd-engine-find input{font-size:15px}
html .dd-engine-show{border-radius:var(--r-pill);padding:2px;background:var(--wash)}
html .dd-engine-show button{height:32px;padding:0 14px;border-radius:var(--r-pill);color:var(--ink);font:500 13px var(--sans)}
html .dd-engine-show button[aria-pressed=true]{background:var(--raise);box-shadow:0 3px 8px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}
html .dd-engine-quick input{height:36px;border-radius:var(--r-pill);border:0;background:var(--wash);padding:0 16px;font-size:15px}
html .dd-engine-quick input:focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--now) 30%,transparent)}
html .dd-engine-carry{margin:12px 24px 0;padding:10px 10px 10px 16px;border-radius:18px;background:color-mix(in srgb,var(--now) 9%,var(--raise))}
html .dd-engine .dd-nudges{margin:12px 24px 0}
html .dd-nudge{border-radius:18px;box-shadow:none;background:var(--wash);padding:10px 10px 10px 16px}
html .dd-nudge button,html .dd-engine-carry button{border-radius:var(--r-pill);min-height:32px;padding:0 14px;font-weight:500}
html .dd-nudge-go,html .dd-engine-carry-all{background:var(--now);color:var(--on-now)}
html .dd-engine-cols{padding:16px 24px 20px;gap:16px}
html .dd-engine-col{border-radius:24px;background:var(--wash);box-shadow:none;padding:14px;gap:6px}
html .dd-engine-col h3{font:600 17px/1.2 var(--display);letter-spacing:-.02em;padding:2px 4px 6px}
html .dd-engine-col h3 small{font:500 13px var(--sans);color:var(--ink-3)}
html .dd-engine-col-hint,html .dd-engine-empty{color:var(--ink-3);font-size:13px;padding-inline:4px}
html .dd-engine-task{border-radius:16px;background:var(--raise);box-shadow:none;padding:12px 12px 12px 10px}
html .dd-engine-task[data-next]{box-shadow:inset 3px 0 0 var(--now)}
html [dir=rtl] .dd-engine-task[data-next]{box-shadow:inset -3px 0 0 var(--now)}
html .dd-engine-check{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--ink-4);transition:background-color .15s,border-color .15s}
html .dd-engine-task[data-done=true] .dd-engine-check{background:var(--now);border-color:var(--now)}
html .dd-engine-step-check{border-color:var(--ink-4)}
html .dd-engine-step[data-done=true]>.dd-engine-step-row .dd-engine-step-check{background:var(--now);border-color:var(--now)}
html .dd-engine-name{font-size:15px;letter-spacing:-.01em}
html .dd-engine-pri{font:600 11px/1.6 var(--sans);box-shadow:none;background:color-mix(in srgb,var(--now) 14%,transparent);color:var(--now);border-radius:var(--r-pill);padding:0 7px}
html .dd-engine-up-next{color:var(--now);font-weight:600}
html .dd-engine-add input{border:0;border-radius:14px;background:transparent;font-size:15px;padding:10px 12px;color:var(--ink)}
html .dd-engine-add input::placeholder{color:var(--now)}
html .dd-engine-add input:focus{background:var(--raise);box-shadow:0 0 0 3px color-mix(in srgb,var(--now) 30%,transparent)}
html .dd-engine-foot{border-top:0;color:var(--ink-3);font-size:12px;padding:0 24px 16px}
html .dd-engine .dd-engine-quick input{background:var(--wash);border-radius:var(--r-pill);padding:0 16px;height:36px}
html .dd-engine .dd-engine-quick input::placeholder{color:var(--ink-3)}
html .dd-engine-col[data-col=park]{background:transparent;box-shadow:inset 0 0 0 1px var(--rule-2)}
html .dd-engine-pri[data-pri="1"]{background:var(--now);color:var(--on-now)}
html .dd-engine-pri[data-pri="3"]{background:var(--wash);color:var(--ink-3);box-shadow:none}

/* Calendar controls: capsules without outlines */
html .dd-review-root .dd-review-month-controls button{border:0;border-radius:var(--r-pill);background:var(--wash);color:var(--ink);box-shadow:none;font-weight:500}
html .dd-review-root .dd-review-month-controls button:hover{background:var(--glass-press)}
html :is(.dd-cal-seg,.dd-review-root .dd-cal-modes,.dd-cal-modes,.dd-cal-range){border-radius:var(--r-pill);box-shadow:none;background:var(--wash);padding:2px}
html .dd-review-root :is(.dd-cal-seg,.dd-cal-modes,.dd-cal-range) button{border-radius:var(--r-pill);color:var(--ink)}
html .dd-review-root :is(.dd-cal-seg button[aria-checked=true],.dd-cal-modes button[aria-pressed=true],.dd-cal-range button[aria-pressed=true]){background:var(--panel);box-shadow:0 3px 8px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}
html[data-theme=dark] .dd-review-root :is(.dd-cal-seg button[aria-checked=true],.dd-cal-modes button[aria-pressed=true],.dd-cal-range button[aria-pressed=true]){background:#636366}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) .dd-review-root :is(.dd-cal-seg button[aria-checked=true],.dd-cal-modes button[aria-pressed=true],.dd-cal-range button[aria-pressed=true]){background:#636366}}

/* The Calendar: Apple Calendar's month, calm and borderless */
html .dd-review-root .dd-review-page-heading .dd-panel-icon{display:none}
html .dd-review-root :is(.dd-review-calendar,.dd-cal-reminders,.dd-review-tasks,.dd-review-reminders){border:0;border-radius:24px;background:var(--panel);box-shadow:none}
html .dd-review-root .dd-review-calendar-head h2{font-size:28px;line-height:34px}
html .dd-review-root .dd-review-month-grid{gap:4px}
html .dd-review-root .dd-review-weekday{font:600 12px var(--sans);color:var(--ink-3);text-transform:uppercase;letter-spacing:.02em}
html .dd-review-root .dd-review-month-grid button.dd-review-date{border:0;border-radius:16px;background:var(--load,transparent);box-shadow:none}
html .dd-review-root .dd-review-month-grid button.dd-review-date:hover{background:color-mix(in srgb,var(--load,transparent) 100%,var(--wash))}
html .dd-review-root .dd-review-month-grid button.dd-review-date[aria-pressed=true]{box-shadow:inset 0 0 0 2px var(--now)}
html .dd-review-root .dd-review-month-grid .dd-review-date.today[aria-pressed=true]{box-shadow:inset 0 0 0 2px var(--now)}
html .dd-review-root .dd-review-month-grid .dd-review-date.outside{opacity:.4}
html .dd-review-root .dd-review-date strong{font:500 17px/1 var(--display)}
html .dd-review-root .dd-review-date.today strong{background:var(--now);color:#fff;font-weight:600}
html .dd-review-root [data-load="1"]{--load:color-mix(in srgb,var(--now) 6%,transparent)}
html .dd-review-root [data-load="2"]{--load:color-mix(in srgb,var(--now) 12%,transparent)}
html .dd-review-root [data-load="3"]{--load:color-mix(in srgb,var(--now) 20%,transparent)}
html .dd-review-root [data-load="4"]{--load:color-mix(in srgb,#FF8D28 22%,transparent)}
html .dd-review-root .dd-review-overview{border-radius:24px;box-shadow:none;border:0}
html .dd-cal-legend i[data-load]{border:0;border-radius:50%}
html .dd-review-root .dd-review-text-button{color:var(--now)}
html .dd-review-root .dd-cal-range button[aria-pressed=true]{background:var(--panel)}
html .dd-review-root .dd-review-task-add input{border-radius:var(--r-pill);background:var(--wash);border:0;padding-inline:16px}

/* The week: seven soft tiles on one grouped card */
html :is(.dd-week,.dd-week-review){border:0;border-radius:24px;background:var(--panel);box-shadow:none}
html .dd-week-grid{gap:6px}
html .dd-week-day{border-radius:16px;background:var(--wash);box-shadow:none}
html .dd-week-day[aria-current=date]{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--now) 45%,transparent)}
html .dd-week-day[data-selected=true]{background:color-mix(in srgb,var(--now) 8%,var(--panel));box-shadow:inset 0 0 0 2px var(--now)}
html .dd-week-day.drag-over{box-shadow:inset 0 0 0 2px var(--now);background:color-mix(in srgb,var(--now) 12%,var(--panel))}
html .dd-week-day[aria-current=date] .dd-week-day-head strong{color:var(--now)}
html .dd-week-moods{border-radius:14px;background:var(--wash)}
html .dd-week-focus textarea{border:0;border-radius:14px;background:var(--wash);box-shadow:none}
/* Capture: a small sheet with segmented choices and filled fields */
html .dd-capture-dialog h2{font:700 20px/1.2 var(--display);letter-spacing:-.02em}
html .dd-capture-dialog header button{border-radius:50%;background:var(--wash);width:30px;height:30px;min-height:30px;padding:0;color:var(--ink-2)}
html .dd-capture-kinds{display:flex;gap:0;padding:2px;border-radius:var(--r-pill);background:var(--wash)}
html .dd-capture-kinds button{flex:1;border:0;border-radius:var(--r-pill);background:none;color:var(--ink);font:500 14px var(--sans);min-height:32px;box-shadow:none}
html .dd-capture-kinds button[aria-pressed=true]{background:var(--panel);color:var(--ink);box-shadow:0 3px 8px rgba(0,0,0,.12),0 3px 1px rgba(0,0,0,.04),0 0 0 .5px rgba(0,0,0,.04)}
html[data-theme=dark] .dd-capture-kinds button[aria-pressed=true]{background:#636366}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) .dd-capture-kinds button[aria-pressed=true]{background:#636366}}
html .dd-capture-dialog :is(input,select){border:0;border-radius:12px;background:var(--wash);box-shadow:none;min-height:44px;padding-inline:14px;font-size:16px;color:var(--ink)}
html .dd-capture-dialog :is(input,select):focus{outline:0;box-shadow:0 0 0 3.5px color-mix(in srgb,var(--now) 30%,transparent)}
html .dd-capture-lanes button{border:0;border-radius:var(--r-pill);background:var(--wash);color:var(--ink);box-shadow:none;font-weight:500}
html .dd-capture-lanes button[aria-pressed=true]{background:var(--now);color:var(--on-now)}
html .dd-capture-dialog .btn.solid{min-height:46px;font:600 16px var(--sans)}
html .dd-capture-bar .textbtn{color:var(--now)}
/* Documents: a clean page under a quiet bar (Notes) */
html .dd-doc{background:var(--panel);border-radius:28px;overflow:hidden;outline:0;box-shadow:0 40px 100px -24px rgba(0,0,0,.45),0 0 0 .5px var(--rule-2)}
html .dd-doc:focus,html .dd-doc:focus-visible{outline:0}
html .dd-doc-top{background:var(--panel);padding:12px 14px;gap:10px}
html .dd-doc-bar{background:var(--panel);border-bottom:.5px solid var(--rule-2);padding:4px 12px 8px;gap:2px}
html .dd-doc-bar button{border-radius:8px;color:var(--ink-2)}
html .dd-doc-bar button:hover{background:var(--wash)}
html .dd-doc-top .dd-doc-back{display:grid;place-items:center;width:32px;height:32px;padding:0;border-radius:50%;background:var(--wash);color:var(--ink)}
html .dd-doc-kind svg{color:var(--now)}
html .dd-doc-modes{border-radius:var(--r-pill);background:var(--wash);padding:2px}
html .dd-doc-modes button{border-radius:var(--r-pill)!important;font:500 13px var(--sans);padding:0 12px}
html .dd-doc-modes button[aria-pressed=true]{background:var(--raise)!important;box-shadow:0 3px 8px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}
html[data-theme=dark] .dd-doc-modes button[aria-pressed=true]{background:#636366!important}
@media (prefers-color-scheme:dark){html:root:not([data-theme=light]) .dd-doc-modes button[aria-pressed=true]{background:#636366!important}}
html .dd-doc-save{border:0!important;border-radius:var(--r-pill)!important;background:var(--wash);color:var(--ink);font-weight:500}
html .dd-doc-done{border:0;border-radius:var(--r-pill);background:var(--now)!important;color:var(--on-now)!important;font-weight:600;padding-inline:16px!important}

/* Comments: a frosted bubble */
html .dd-thread:not(.dd-comment-card){border:0}
@media (prefers-reduced-transparency:reduce){
  html :is(${floating},${menus},.top .views,.toast){background:var(--panel)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
}
`;

// A small glass label over a Board bar's icon while the pointer rests on it: the name, then its key.
// It sits above a bar at the bottom of the screen and below one at the top, so nothing is cut off (5.83).
const DDtipScope = ".b6 :is(.b2-dock,.b2-camera,.b4-selectionbar,.b2-top-actions) .b2-icon[data-tip]";
export function DDsplitTip(text) {
  const m = /^(.*\S) \u00B7 (\S{1,7})$/.exec(String(text || ""));
  return m ? { label: m[1], key: m[2] } : { label: String(text || ""), key: "" };
}
function DDinstallHoverTips() {
  if (!window.matchMedia?.("(hover:hover) and (pointer:fine)").matches) return;
  const tip = Object.assign(document.createElement("div"), { className: "dd-hover-tip" });
  tip.setAttribute("aria-hidden", "true");
  document.body.append(tip);
  let timer = 0, current = null, warm = 0;
  const hide = () => { clearTimeout(timer); if (current) warm = Date.now(); current = null; tip.classList.remove("on"); };
  const show = (el) => {
    if (!el.isConnected || current !== el) return;
    const { label, key } = DDsplitTip(el.getAttribute("data-tip"));
    // A button that already shows its name only needs a label when it has a key to teach.
    if (!key && el.querySelector(".dd-btn-label")?.offsetWidth > 1) return;
    tip.replaceChildren(label);
    if (key) tip.append(Object.assign(document.createElement("kbd"), { textContent: key }));
    const hint = el.getAttribute("data-tip-hint");
    if (hint) tip.append(Object.assign(document.createElement("small"), { textContent: hint }));
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, below = r.top < innerHeight / 2;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = below ? r.bottom + 10 : r.top - h - 10;
    tip.style.setProperty("--tip-shift", below ? "-4px" : "4px");
    tip.style.left = x + "px"; tip.style.top = y + "px";
    tip.classList.add("on");
  };
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest?.(DDtipScope);
    if (el === current) return;
    hide();
    if (!el || el.disabled) return;
    current = el;
    // The first label waits a moment; moving along the bar shows the next one at once, like macOS.
    timer = setTimeout(() => show(el), Date.now() - warm < 600 ? 0 : 450);
  }, true);
  for (const type of ["pointerdown", "keydown", "wheel", "blur"]) window.addEventListener(type, hide, true);
  document.documentElement.addEventListener("pointerleave", hide);
}

export function DDinstallGlass() {
  if (typeof document === "undefined" || document.getElementById("dd-glass")) return;
  const style = Object.assign(document.createElement("style"), { id: "dd-glass", textContent: DDglassCSS });
  (document.body || document.documentElement).append(style);
  try { DDinstallHoverTips(); } catch {}
}
