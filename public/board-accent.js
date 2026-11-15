// The board's accent colour (5.85): a round dot beside the timer opens a few
// iOS colours and a custom one. It is the app's one accent (setup.look.accent),
// so Settings, the tabs and every view change with it.

// [name, hex]; "" is the app's own blue (Auto).
export const DDaccentPresets = [
  ["Blue", ""],
  ["Indigo", "#6155F5"],
  ["Purple", "#CB30E0"],
  ["Pink", "#FF2D55"],
  ["Red", "#FF383C"],
  ["Orange", "#FF8D28"],
  ["Green", "#34C759"],
  ["Teal", "#00B5C4"],
];

export function DDaccentClean(value) {
  const v = String(value || "").trim().replace(/^#?/, "#").toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(v)) return v;
  if (/^#[0-9A-F]{3}$/.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  return null;
}

// A hue on the custom strip becomes a colour that reads well with white on it.
export function DDaccentFromHue(hue) {
  const h = ((Number(hue) % 360) + 360) % 360, s = 0.82, l = 0.5;
  const f = (n) => {
    const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return ("#" + f(0) + f(8) + f(4)).toUpperCase();
}

export function DDaccentHue(hex) {
  const v = DDaccentClean(hex);
  if (!v) return 211;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

export function DDBoardAccentButton({ React: R, accent, open, onOpenChange, buttonRef }) {
  return R.createElement("button", { type: "button", ref: buttonRef, className: "b2-icon dd-board-accent-button", "aria-label": "Accent colour", "data-tip": "Accent colour",
    "aria-expanded": open, "aria-controls": "dd-board-accent", onClick: () => onOpenChange(!open) },
    R.createElement("span", { className: "dd-accent-dot", "data-custom": accent ? true : undefined, "aria-hidden": true }));
}

export function DDBoardAccent({ React: R, accent, onChange, open, onOpenChange, buttonRef }) {
  const h = R.createElement, panel = R.useRef(null);
  const current = DDaccentClean(accent) || "";
  const custom = !!current && !DDaccentPresets.some(([, c]) => c === current);
  const [hex, setHex] = R.useState(current);
  R.useEffect(() => { setHex(current); }, [current, open]);
  R.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!panel.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) onOpenChange(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  if (!open) return null;
  const close = () => { onOpenChange(false); buttonRef.current?.focus(); };
  const typed = () => { const v = DDaccentClean(hex); if (v && v !== current) onChange(v); else setHex(current); };
  return h("aside", { id: "dd-board-accent", ref: panel, className: "dd-board-accent", role: "dialog", "aria-label": "Accent colour",
      onPointerDown: (e) => e.stopPropagation(), onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); close(); } } },
    h("div", { className: "dd-accent-head" }, h("strong", null, "Accent colour"), h("small", null, "Buttons, the timer and what you pick")),
    h("div", { className: "dd-accent-swatches", role: "radiogroup", "aria-label": "Preset colours" },
      DDaccentPresets.map(([name, c]) => h("button", { key: name, type: "button", role: "radio", "aria-checked": current === c, "aria-label": name, title: name,
        className: "dd-accent-swatch", style: c ? { "--c": c } : undefined, "data-accent": c || "auto", onClick: () => onChange(c) }))),
    h("div", { className: "dd-accent-custom", "data-on": custom || undefined },
      h("label", { className: "dd-accent-hue" },
        h("span", null, "Custom"),
        h("input", { type: "range", min: 0, max: 359, step: 1, value: DDaccentHue(hex || current || "#0088FF"), "aria-label": "Custom colour",
          onChange: (e) => { const v = DDaccentFromHue(e.target.value); setHex(v); onChange(v); } })),
      h("label", { className: "dd-accent-hex" },
        h("i", { "aria-hidden": true, style: { background: DDaccentClean(hex) || "var(--now)" } }),
        h("input", { dir: "ltr", value: hex, placeholder: "#0088FF", maxLength: 7, spellCheck: false, "aria-label": "Colour code",
          onChange: (e) => setHex(e.target.value.toUpperCase()), onBlur: typed, onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); typed(); } } }))));
}

export const DDboardAccentCSS = `
.dd-board-accent-button .dd-accent-dot{display:block;width:18px;height:18px;border-radius:50%;background:var(--board-accent,var(--now));box-shadow:inset 0 0 0 1.5px #ffffff59,0 0 0 1px color-mix(in srgb,var(--ink) 12%,transparent)}
.dd-board-accent{position:absolute;z-index:106;top:72px;right:16px;width:272px;max-width:calc(100% - 32px);box-sizing:border-box;padding:14px;border-radius:20px;background:var(--paper);color:var(--ink);text-align:start;font:400 13px/1.3 var(--sans,system-ui)}
.dd-accent-head{display:flex;flex-direction:column;gap:2px;margin:0 2px 12px}.dd-accent-head strong{font-weight:600;font-size:14px}.dd-accent-head small{color:var(--ink-3);font-size:11.5px}
.dd-accent-swatches{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;justify-items:center}
.dd-accent-swatch{all:unset;box-sizing:border-box;width:26px;height:26px;border-radius:50%;background:var(--c,#0088FF);cursor:pointer;box-shadow:inset 0 0 0 1px #0000001a;transition:transform .12s}
.dd-accent-swatch[data-accent=auto]{background:var(--dd-accent-auto,#0088FF)}
.dd-accent-swatch:hover{transform:scale(1.08)}
.dd-accent-swatch[aria-checked=true]{box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--c,var(--dd-accent-auto,#0088FF))}
.dd-accent-swatch:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.dd-accent-custom{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;margin-top:14px;padding-top:12px;border-top:1px solid var(--rule)}
.dd-accent-hue{display:flex;flex-direction:column;gap:7px;min-width:0}.dd-accent-hue span{font-size:12px;color:var(--ink-2);font-weight:500}
.dd-board-accent .dd-accent-hue input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;min-height:0;margin:0;padding:0;border:0!important;border-radius:11px!important;background:linear-gradient(90deg,#E62E2E,#E6B82E,#8AE62E,#2EE65C,#2EE6E6,#2E5CE6,#8A2EE6,#E62EB8,#E62E2E)!important;box-shadow:inset 0 0 0 1px #0000001a;cursor:pointer;accent-color:auto}
.dd-board-accent .dd-accent-hue input::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0000004d,inset 0 0 0 1px #0000000f}
.dd-board-accent .dd-accent-hue input::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0000004d}
.dd-accent-hex{display:flex;align-items:center;gap:6px;height:30px;padding:0 8px 0 6px;border-radius:9px;background:var(--wash)}
.dd-accent-hex i{width:18px;height:18px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px #0000001a}
.dd-accent-hex input{all:unset;width:66px;font:500 12.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);-webkit-user-select:text;user-select:text}
@media(max-width:700px){.dd-board-accent{top:122px;right:8px;max-width:calc(100% - 16px)}}
`;
