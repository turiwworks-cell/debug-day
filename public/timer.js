// Focus timer (5.30): one clock for Plan, Board and Today.
// The clock lives outside React and in localStorage, so a reload or a second
// tab keeps the same time. When time is up it says so even when you are in
// another app: a system notice (when the browser allows it), a soft chime, the
// tab title, and a banner that stays until you close it.
// Bar mode hides the numbers, for when you only want a feel for what is left.
import { DDBoardIcon } from "./board-icons.js";

const KEY = "debug-day:timer", MAX = 5999, LATE = 5 * 60e3;
export const DDtimerPresets = [15, 25, 45, 60, 90];

export function DDtimerRemaining(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function DDtimerFormat(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

const clamp = (n) => Math.max(0, Math.min(MAX, Math.round(Number(n) || 0)));

// A saved clock, made safe. A running clock keeps its deadline, even one that
// passed while the app was closed: it finishes as soon as the app opens.
export function DDtimerRestore(saved, base = 1500, now = Date.now()) {
  const s = saved && typeof saved === "object" ? saved : {};
  const b = clamp(s.base) || clamp(base) || 1500, total = clamp(s.total) || b;
  const out = {
    base: b, total, view: s.view === "bar" ? "bar" : "numbers", sound: s.sound !== false,
    ended: Number(s.ended) || 0, announced: Number(s.announced) || 0, asked: !!s.asked,
    running: false, deadline: 0, seconds: s.seconds == null ? total : clamp(s.seconds),
  };
  if (s.running && Number(s.deadline) > 0) {
    out.running = true; out.deadline = Number(s.deadline);
    out.seconds = DDtimerRemaining(out.deadline, now);
  }
  return out;
}

// How much time is left, from 1 (all of it) to 0, for the bar.
export function DDtimerLeft(state) {
  return state.total ? Math.max(0, Math.min(1, state.seconds / state.total)) : 0;
}

// Words instead of numbers, for screen readers in bar mode.
export function DDtimerFeel(state) {
  const left = DDtimerLeft(state);
  if (!state.running && !state.seconds) return "Time is up";
  return left > 0.8 ? "Most of the time left" : left > 0.55 ? "More than half left" : left > 0.35 ? "About half left" : left > 0.12 ? "Less than half left" : "Nearly done";
}

function lengthText(seconds) {
  const m = Math.round(seconds / 60);
  return m >= 1 ? m + " min" : seconds + " sec";
}

// ---- the shared clock ----
let state = null, armed = 0, ticking = 0;
const listeners = new Set();
const live = () => typeof window !== "undefined" && typeof document !== "undefined";

function readSaved() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function persist() {
  try {
    const { running, deadline, seconds, total, base, view, sound, ended, announced, asked } = state;
    localStorage.setItem(KEY, JSON.stringify({ running, deadline, seconds, total, base, view, sound, ended, announced, asked }));
  } catch {}
}
function emit() {
  for (const fn of [...listeners]) fn(state);
  paintNotice();
}
function commit(patch) {
  state = { ...state, ...patch };
  persist(); emit(); arm();
}

function boot(base) {
  if (state) return state;
  state = DDtimerRestore(readSaved(), base);
  if (!live()) return state;
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    let next = null;
    try { next = JSON.parse(e.newValue || "null"); } catch {}
    state = DDtimerRestore(next, state.base);
    emit(); arm();
  });
  document.addEventListener("visibilitychange", () => { tick(); arm(); });
  // Sound can only start after a click or key press, so a reload re-arms it on the next one.
  const unlock = () => { if (state.running) wakeSound(); };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
  installStyle();
  arm(); paintNotice();
  return state;
}

// One timeout for the end (not a chain, so a background tab is not slowed to
// once a minute) and a quick tick only while the page is visible.
function arm() {
  if (!live()) return;
  clearTimeout(armed); clearInterval(ticking); armed = ticking = 0;
  if (!state.running) return;
  const left = state.deadline - Date.now();
  if (left <= 0) { finish(); return; }
  armed = setTimeout(finish, left + 30);
  if (document.visibilityState !== "hidden") ticking = setInterval(tick, 250);
}

function tick() {
  if (!state?.running) return;
  const seconds = DDtimerRemaining(state.deadline);
  if (!seconds) { finish(); return; }
  if (seconds !== state.seconds) { state = { ...state, seconds }; emit(); }
}

function finish() {
  if (!state.running) return;
  const now = Date.now(), deadline = state.deadline;
  if (now < deadline) { arm(); return; }
  // Another open tab may have told you already.
  const told = Number(readSaved()?.announced) === deadline;
  commit({ running: false, deadline: 0, seconds: 0, ended: deadline, announced: deadline });
  if (!told && now - deadline < LATE) tell();
}

// ---- telling you, also outside the app ----
let audio = null, flashing = 0;
function wakeSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = audio || new AC();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}
function chime() {
  try {
    if (!audio || audio.state !== "running") return false;
    const start = audio.currentTime + 0.05, out = audio.createGain();
    out.gain.value = 0.16; out.connect(audio.destination);
    for (const [at, hz] of [[0, 659.25], [0.24, 987.77], [0.48, 1318.5], [1.9, 659.25], [2.14, 987.77], [2.38, 1318.5]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, start + at);
      g.gain.exponentialRampToValueAtTime(1, start + at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + at + 1.5);
      o.connect(g); g.connect(out); o.start(start + at); o.stop(start + at + 1.6);
    }
    return true;
  } catch { return false; }
}
function systemNotice(body, quiet) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    const n = new Notification("Time’s up", { body, tag: "debug-day-timer", renotify: true, silent: quiet });
    n.onclick = () => { window.focus(); n.close(); };
    return true;
  } catch { return false; }
}
function flashTitle() {
  if (flashing || (document.visibilityState === "visible" && document.hasFocus())) return;
  const plain = document.title, alert = "Time’s up · " + (plain || "Debug Day");
  let on = true;
  document.title = alert;
  flashing = setInterval(() => { on = !on; document.title = on ? alert : plain; }, 1000);
  const seen = () => {
    if (document.visibilityState !== "visible") return;
    clearInterval(flashing); flashing = 0; document.title = plain;
    window.removeEventListener("focus", seen); document.removeEventListener("visibilitychange", seen);
  };
  window.addEventListener("focus", seen); document.addEventListener("visibilitychange", seen);
}
function tell() {
  const body = lengthText(state.total) + " are done. Take a breath.";
  const chimed = state.sound && chime();
  if (state.sound) try { navigator.vibrate?.([180, 120, 180]); } catch {}
  const notice = systemNotice(body, chimed || !state.sound);
  flashTitle();
  window.dispatchEvent(new CustomEvent("debug-day-timer-end", { detail: { chime: chimed, notice } }));
}

// The banner stays until you close it, in every view and every open tab.
let banner = null;
function paintNotice() {
  if (!live() || !document.body) return;
  const ended = state?.ended;
  if (!ended) { banner?.remove(); banner = null; return; }
  if (banner?.isConnected && banner.dataset.ended === String(ended)) return;
  banner?.remove();
  const late = Date.now() - ended > LATE, at = new Date(ended).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  banner = el("div", "dd-timer-notice");
  banner.setAttribute("role", "alert");
  banner.dataset.ended = String(ended);
  const words = el("div", "dd-timer-notice-words");
  words.append(el("strong", "", "Time’s up"), el("small", "", late ? "Your " + lengthText(state.total) + " ended at " + at + "." : lengthText(state.total) + " are done. Take a breath."));
  const more = el("button", "", "+5 min"), done = el("button", "dd-timer-notice-done", "Done");
  more.type = done.type = "button";
  more.setAttribute("aria-label", "Five more minutes");
  more.onclick = () => DDtimer.more();
  done.onclick = () => DDtimer.dismiss();
  banner.append(el("span", "dd-timer-notice-dot"), words, more, done);
  document.body.append(banner);
}

function askNotice(always) {
  try {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    if (!always && state.asked) return;
    commit({ asked: true });
    Promise.resolve(Notification.requestPermission()).then(emit, emit);
  } catch {}
}

export const DDtimer = {
  get: () => state || boot(),
  subscribe(fn) { boot(); listeners.add(fn); return () => listeners.delete(fn); },
  // A fresh length. While running it restarts from now with that length.
  set(seconds) {
    boot();
    const n = clamp(seconds);
    if (state.running && n) commit({ seconds: n, total: n, deadline: Date.now() + n * 1000, ended: 0 });
    else commit({ running: false, deadline: 0, seconds: n, total: n || state.total, ended: 0 });
  },
  add(seconds) {
    boot();
    if (!state.running && !state.seconds) { DDtimer.set(seconds); return; }
    const n = clamp(state.seconds + seconds), total = clamp(state.total + seconds);
    if (state.running) commit({ seconds: n, total, deadline: state.deadline + seconds * 1000 });
    else commit({ seconds: n, total, ended: 0 });
  },
  start() {
    boot();
    if (state.running) return;
    wakeSound(); askNotice(false);
    const n = state.seconds || state.total || state.base;
    commit({ running: true, deadline: Date.now() + n * 1000, seconds: n, total: state.seconds ? Math.max(state.total, n) : n, ended: 0 });
  },
  pause() {
    boot();
    if (!state.running) return;
    const left = DDtimerRemaining(state.deadline);
    if (!left) { finish(); return; }
    commit({ running: false, deadline: 0, seconds: left });
  },
  setRunning(next) {
    boot();
    const want = typeof next === "function" ? next(state.running) : !!next;
    want ? DDtimer.start() : DDtimer.pause();
  },
  preset(minutes) { DDtimer.set(minutes * 60); DDtimer.start(); },
  more() { boot(); wakeSound(); if (state.running) DDtimer.add(300); else { DDtimer.set(300); DDtimer.start(); } },
  reset() { boot(); commit({ running: false, deadline: 0, seconds: state.base, total: state.base, ended: 0 }); },
  dismiss() { boot(); commit({ ended: 0, seconds: state.running ? state.seconds : state.seconds || state.total }); },
  view(view) { boot(); commit({ view: view === "bar" ? "bar" : "numbers" }); },
  sound(on) { boot(); if (on) wakeSound(); commit({ sound: !!on }); },
  askNotice() { boot(); askNotice(true); },
};

// The length from Settings. It changes the clock only when the clock is idle at the old length.
export function DDtimerDefault(seconds) {
  boot(seconds);
  const n = clamp(seconds);
  if (!n || n === state.base) return;
  const untouched = !state.running && !state.ended && state.seconds === state.base && state.total === state.base;
  commit(untouched ? { base: n, seconds: n, total: n } : { base: n });
}

export function DDuseTimer(R, base) {
  boot(typeof base === "function" ? base() : base);
  const [snap, setSnap] = R.useState(() => state);
  R.useEffect(() => { setSnap(state); return DDtimer.subscribe(setSnap); }, []);
  return snap;
}

// The old hook's shape: [seconds, setSeconds, running, setRunning].
export function DDuseCountdown(R, initial) {
  const s = DDuseTimer(R, initial);
  return [s.seconds, DDtimer.set, s.running, DDtimer.setRunning];
}

// The small clock on buttons: numbers, or a short bar in bar mode.
export function DDTimerMini({ React: R, className = "" }) {
  const h = R.createElement, s = DDuseTimer(R);
  if (s.view === "bar")
    return h("b", { className: ("dd-timer-mini dd-timer-mini-bar " + className).trim(), role: "img", "aria-label": DDtimerFeel(s) },
      h("i", { style: { width: Math.round(DDtimerLeft(s) * 100) + "%" } }));
  return h("b", { className: ("dd-timer-mini " + className).trim(), dir: "ltr" }, DDtimerFormat(s.seconds));
}

function noticeState() {
  try { return "Notification" in window ? Notification.permission : "none"; } catch { return "none"; }
}

export function DDTimerPanel({ React: R, onClose, autoFocus = true }) {
  const h = R.createElement, s = DDuseTimer(R), icon = (name, size = 16) => h(DDBoardIcon, { React: R, name, size });
  const [draft, setDraft] = R.useState(null), input = R.useRef(null), root = R.useRef(null);
  R.useEffect(() => { if (autoFocus) ((s.running ? null : input.current) || root.current?.querySelector(".dd-timer-play"))?.focus(); }, []);
  const ended = !s.running && !s.seconds, bar = s.view === "bar";
  function save() {
    if (draft == null) return;
    const text = draft.replace(/[۰-۹٠-٩]/g, (c) => String(c.charCodeAt(0) % 16)).trim();
    const m = /^(\d{1,2})(?::([0-5]?\d))?$/.exec(text);
    setDraft(null);
    if (!s.running && m) DDtimer.set(+m[1] * 60 + +(m[2] || 0));
  }
  const endsAt = s.running ? new Date(s.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const status = s.running ? (bar ? "Focusing" : "Ends at " + endsAt) : ended ? "Time’s up" : s.seconds < s.total ? "Paused" : "Ready when you are";
  const permission = noticeState();
  return h("div", { ref: root, className: "dd-timer", "data-view": s.view, "data-running": s.running },
    h("div", { className: "dd-timer-head" },
      h("strong", null, "Timer"),
      h("span", { className: "dd-timer-seg", role: "group", "aria-label": "Show time as" },
        h("button", { type: "button", "aria-pressed": !bar, onClick: () => DDtimer.view("numbers") }, "Numbers"),
        h("button", { type: "button", "aria-pressed": bar, onClick: () => DDtimer.view("bar") }, "Bar")),
      onClose && h("button", { type: "button", className: "dd-timer-x", "aria-label": "Close timer", onClick: onClose }, icon("close"))),
    bar
      ? h("div", { className: "dd-timer-face" },
          h("div", { className: "dd-timer-bar", role: "progressbar", "aria-label": "Time left", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(DDtimerLeft(s) * 100), "aria-valuetext": DDtimerFeel(s) },
            h("i", { style: { width: DDtimerLeft(s) * 100 + "%" } })))
      : h("label", { className: "dd-timer-face dd-timer-clock" },
          h("span", { className: "dd-sr-only" }, "Minutes and seconds"),
          h("input", { ref: input, dir: "ltr", value: draft ?? DDtimerFormat(s.seconds), readOnly: s.running, inputMode: "decimal", "aria-label": "Timer duration (mm:ss)",
            onFocus: () => { if (!s.running) setDraft(DDtimerFormat(s.seconds)); },
            onChange: (e) => setDraft(e.target.value), onBlur: save,
            onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); save(); e.currentTarget.blur(); } } })),
    h("p", { className: "dd-timer-status", role: "status" }, status),
    h("div", { className: "dd-timer-presets", role: "group", "aria-label": "Start a length" },
      DDtimerPresets.map((m) => h("button", { key: m, type: "button", "aria-label": "Start " + m + " minutes", "aria-pressed": s.total === m * 60, onClick: () => DDtimer.preset(m) },
        m, h("small", null, "m")))),
    h("div", { className: "dd-timer-actions" },
      h("button", { type: "button", className: "dd-timer-more", onClick: () => DDtimer.add(300), disabled: s.seconds + 300 > MAX }, "+5 min"),
      h("button", { type: "button", className: "dd-timer-reset", "aria-label": "Reset timer", onClick: () => { setDraft(null); DDtimer.reset(); } }, icon("reset")),
      h("button", { type: "button", className: "dd-timer-play", "aria-label": s.running ? "Pause timer" : "Start timer", onClick: () => { setDraft(null); DDtimer.setRunning(!s.running); } }, icon(s.running ? "pause" : "play", 18))),
    h("div", { className: "dd-timer-foot" },
      h("button", { type: "button", className: "dd-timer-sound", "aria-pressed": s.sound, "aria-label": "Sound when time is up", onClick: () => DDtimer.sound(!s.sound) }, icon(s.sound ? "bell" : "bellOff", 14), s.sound ? "Sound on" : "Sound off"),
      permission === "default" && h("button", { type: "button", className: "dd-timer-ask", onClick: () => DDtimer.askNotice() }, "Notify me outside the app"),
      permission === "granted" && h("small", null, "Notices on"),
      permission === "denied" && h("small", null, "Notices are blocked in this browser")));
}

// Plan: a small button beside the Stillness chip opens the same panel.
export function DDTimerMenu({ React: R }) {
  const h = R.createElement, [open, setOpen] = R.useState(false), [pos, setPos] = R.useState(null);
  const button = R.useRef(null), box = R.useRef(null);
  R.useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(300, window.innerWidth - 16);
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), width: w });
    };
    const away = (e) => { if (!box.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false); };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", away);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("pointerdown", away); };
  }, [open]);
  const close = () => { setOpen(false); button.current?.focus(); };
  return h("span", { className: "dd-timer-menu" },
    h("button", { type: "button", ref: button, className: "dd-timer-menu-button", "aria-label": "Timer options", "aria-expanded": open, "aria-controls": "dd-plan-timer", onClick: () => setOpen(!open) },
      h(DDBoardIcon, { React: R, name: "collapse", size: 14 })),
    open && pos && h("div", { id: "dd-plan-timer", ref: box, className: "dd-timer-pop", role: "dialog", "aria-label": "Timer", style: pos,
      onKeyDown: (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } } },
      h(DDTimerPanel, { React: R, onClose: close })));
}

export const DDtimerCSS = `
.dd-timer{display:flex;flex-direction:column;gap:12px;font:13px/1.5 var(--sans);color:var(--ink);text-align:start}
.dd-timer button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.dd-timer button:disabled{opacity:.4;cursor:default}
.dd-timer-head{display:flex;align-items:center;gap:8px}
.dd-timer-head>strong{font-weight:600;font-size:13px;margin-inline-end:auto}
.dd-timer-seg{display:inline-flex;padding:2px;border-radius:999px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule)}
.dd-timer-seg>button{height:24px;padding:0 10px;border-radius:999px;color:var(--ink-3);font-size:12px;font-weight:500}
.dd-timer-seg>button[aria-pressed=true]{background:var(--paper);color:var(--ink);box-shadow:0 1px 2px #0000001f,inset 0 0 0 1px var(--rule-2)}
.dd-timer-x{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:var(--ink-3)}
.dd-timer-x:hover{background:var(--wash);color:var(--ink)}
.dd-timer-face{min-height:76px;display:flex;align-items:center}
.dd-timer-clock input{width:100%;direction:ltr;text-align:center;font:500 52px/1.2 var(--sans);letter-spacing:-.02em;font-variant-numeric:tabular-nums;background:transparent;border:1px solid transparent;color:var(--ink);border-radius:12px;padding:8px 4px}
.dd-timer-clock input:not([readonly]):hover{background:var(--wash)}
.dd-timer-clock input:focus{border-color:var(--now);background:var(--wash);outline:none}
.dd-timer-clock input[readonly]:focus{border-color:transparent;background:transparent}
.dd-timer[data-running=true] .dd-timer-clock input{cursor:default}
.dd-timer-bar{width:100%;height:14px;border-radius:999px;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule-2);overflow:hidden}
.dd-timer-bar>i{display:block;height:100%;border-radius:inherit;background:var(--now);transition:width 1s linear}
.dd-timer-status{margin:-4px 0 0;text-align:center;color:var(--ink-3);font-size:12px}
.dd-timer-presets{display:flex;gap:6px}
.dd-timer-presets>button{flex:1;height:32px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--rule-2);font-weight:500;font-variant-numeric:tabular-nums}
.dd-timer-presets>button>small{font-size:10px;color:var(--ink-3);margin-inline-start:1px}
.dd-timer-presets>button:hover{background:var(--wash)}
.dd-timer-presets>button[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px var(--ink)}
.dd-timer-actions{display:flex;gap:8px;align-items:center}
.dd-timer-actions>button{min-height:36px;min-width:36px;padding:0 12px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--rule-2);display:grid;place-items:center;font-weight:500}
.dd-timer-actions>button:hover:not(:disabled){background:var(--wash)}
.dd-timer-actions>.dd-timer-reset{padding:0}
.dd-timer-actions>.dd-timer-play{margin-inline-start:auto;width:48px;height:48px;padding:0;border-radius:50%;background:var(--now);color:var(--on-now);box-shadow:0 4px 14px -6px var(--now)}
.dd-timer-actions>.dd-timer-play:hover{background:var(--now);filter:brightness(1.06)}
.dd-timer-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--rule)}
.dd-timer-foot>button{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border-radius:999px;font-size:12px;color:var(--ink-2);box-shadow:inset 0 0 0 1px var(--rule-2)}
.dd-timer-foot>button:hover{color:var(--ink);background:var(--wash)}
.dd-timer-foot>.dd-timer-sound[aria-pressed=false]{color:var(--ink-3)}
.dd-timer-foot>small{font-size:11.5px;color:var(--ink-3)}
.dd-timer-mini{font:inherit;font-weight:500;font-variant-numeric:tabular-nums}
.dd-timer-mini-bar{display:inline-block;width:38px;height:6px;border-radius:999px;background:color-mix(in srgb,currentColor 18%,transparent);overflow:hidden;vertical-align:middle}
.dd-focus-clock .dd-timer-mini-bar{width:min(240px,70%);height:8px}
.dd-timer-mini-bar>i{display:block;height:100%;border-radius:inherit;background:currentColor;transition:width 1s linear}
.dd-timer-menu{display:inline-flex}
.dd-timer-menu-button{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:var(--ink-3);background:none;border:0;cursor:pointer}
.dd-timer-menu-button:hover,.dd-timer-menu-button[aria-expanded=true]{color:var(--ink);background:var(--wash)}
.dd-timer-pop{position:fixed;z-index:1600;box-sizing:border-box;padding:16px;background:var(--panel,var(--paper));color:var(--ink);border-radius:16px;box-shadow:0 0 0 1px var(--rule-2),0 18px 48px -18px #00000059;max-height:calc(100vh - 24px);overflow:auto}
.dd-timer-notice{position:fixed;z-index:10050;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:10px 10px 10px 14px;background:var(--raise,var(--paper));color:var(--ink);border-radius:16px;box-shadow:0 0 0 1px var(--rule-2),0 18px 48px -16px #00000066;font:13px/1.4 var(--sans);animation:dd-timer-in .35s cubic-bezier(.2,.8,.2,1)}
.dd-timer-notice-dot{width:10px;height:10px;flex:none;border-radius:50%;background:var(--now);box-shadow:0 0 0 4px color-mix(in srgb,var(--now) 22%,transparent);animation:dd-timer-pulse 1.6s ease-in-out infinite}
.dd-timer-notice-words{display:flex;flex-direction:column;min-width:0;margin-inline-end:4px}
.dd-timer-notice-words strong{font-weight:600;font-size:14px}
.dd-timer-notice-words small{color:var(--ink-3);font-size:12px}
.dd-timer-notice button{flex:none;min-height:34px;padding:0 12px;border-radius:999px;border:0;background:none;color:var(--ink);font:500 12.5px/1 var(--sans);box-shadow:inset 0 0 0 1px var(--rule-2);cursor:pointer}
.dd-timer-notice button:hover{background:var(--wash)}
.dd-timer-notice .dd-timer-notice-done{background:var(--now);color:var(--on-now);box-shadow:none}
.dd-timer-notice .dd-timer-notice-done:hover{background:var(--now);filter:brightness(1.06)}
@keyframes dd-timer-in{from{opacity:0;transform:translate(-50%,-10px)}}
@keyframes dd-timer-pulse{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--now) 8%,transparent)}}
@media (max-width:520px){.dd-timer-notice{top:calc(10px + env(safe-area-inset-top));flex-wrap:wrap;width:calc(100vw - 24px);row-gap:8px}.dd-timer-notice-words{flex:1 1 calc(100% - 30px)}.dd-timer-notice>button:first-of-type{margin-inline-start:auto}}
@media (prefers-reduced-motion:reduce){.dd-timer-notice,.dd-timer-notice-dot{animation:none}.dd-timer-bar>i,.dd-timer-mini-bar>i{transition:none}}
`;

function installStyle() {
  if (document.getElementById("dd-timer-style")) return;
  const style = Object.assign(document.createElement("style"), { id: "dd-timer-style", textContent: DDtimerCSS });
  (document.body || document.documentElement).append(style);
}
