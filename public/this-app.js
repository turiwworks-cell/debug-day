// This app (5.50): what is in the app, and what changed lately.
//
// One page that answers "where am I and what is new", close to After Effects'
// comp list: every tab and section with the key that opens it, the app's own
// counts, and the newest entries from CHANGELOG.md. It reads and never writes,
// except for the section keys, which it hands back to the app.
import { DDtabs, DDtabKeys, DDtabKeyLabel, DDtabSetKey, DDtabName } from "./tabs.js";
import { DDtagSections, DDengineTotals, DDengineNotes } from "./engine-today.js";
import { DDcompletion } from "./planner.js";

// Every page here is a plain function of (props, React): the app's bundle passes
// React as the second argument, so components read it with DDpageProps and build
// their own local `h` bound to it (module-level `h` is only a fallback).
const h = (type, props, ...children) => {
  if (!DDruntime) throw new Error("DD pages: render without React");
  return DDruntime.createElement(type, props, ...children);
};
let DDruntime = null;
const t = (fa, en, f) => (fa ? f : en);

// The newest entries of the changelog, read once and kept. Nothing else is
// fetched: the file sits beside the app, like every other module.
export function DDchangesFrom(text, limit = 6) {
  const rows = [];
  let current = null;
  for (const line of String(text || "").split("\n")) {
    const head = line.match(/^##\s+(.+?)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/);
    if (head) {
      current = { version: head[1], date: head[2], lines: [] };
      rows.push(current);
      continue;
    }
    if (!current) continue;
    const item = line.match(/^-\s+(.*\S)\s*$/);
    if (item && current.lines.length < 5) current.lines.push(item[1].replace(/`/g, ""));
  }
  return rows.slice(0, Math.max(1, limit));
}

// "2h 15m" for the time still planned, in the app's one way of writing time.
const DDthisAppCounts = (day, setup) => {
  const totals = DDengineTotals(day, setup),
    parked = (day?.blocks || []).filter((b) => b.park).length,
    habits = (setup?.habits || []).length,
    ticked = (setup?.habits || []).filter((habit) => day?.habits?.[habit.id]?.done).length;
  return { ...totals, parked, habits, ticked };
};

export function DDThisAppPage(...ddArgs) {
  return DDThisAppPageInner(...ddArgs);
}
function DDThisAppPageInner(...ddArgs) {
  const _props = ddArgs[0] || {},
    React =
      [...ddArgs, _props.React, _props._owner]
        .flatMap((candidate) => [candidate, candidate?.default, candidate?.React])
        .find((candidate) => candidate && typeof candidate.createElement === "function") || null;
  if (React) DDruntime = React;
  const { setup, day, days = {}, language, keys = {}, onKeys, onTab, onRoom, changes = [] } = _props;
  const fa = language === "fa",
    sections = DDtagSections(setup, language),
    counts = DDthisAppCounts(day, setup),
    notes = DDengineNotes(setup).length,
    [picking, setPicking] = React.useState(null),
    [list, setList] = React.useState(() => DDtabKeys(keys));
  React.useEffect(() => setList(DDtabKeys(keys)), [keys]);
  const save = (next) => {
    setList(next);
    try {
      localStorage.setItem("debug-day:tab-keys", JSON.stringify(next));
      window.dispatchEvent(new Event("debug-day-tab-keys"));
    } catch {}
    onKeys?.(next);
  };
  const progress = DDcompletion(day, (setup?.lanes || []).map((lane) => lane.id));
  return h(
    "section",
    { className: "dd-this-app", "data-panel": "this-app", "aria-label": t(fa, "This app", "این اپ") },
    h(
      "header",
      { className: "dd-this-app-head" },
      h("h1", null, t(fa, "This app", "این اپ")),
      h("p", null, t(fa, "Everything in the app, and the keys that open it.", "همه‌ی اپ، و کلیدهایی که بازش می‌کنند.")),
    ),
    h(
      "div",
      { className: "dd-this-app-grid" },
      h(
        "section",
        { className: "dd-this-app-card" },
        h("h2", null, t(fa, "Tabs", "تب‌ها")),
        h(
          "ul",
          { className: "dd-this-app-tabs" },
          DDtabs.map((tab) =>
            h(
              "li",
              { key: tab.id, "data-tab": tab.id },
              h(
                "button",
                { type: "button", onClick: () => onTab?.(tab.id) },
                h("span", { className: "dd-this-app-name" }, DDtabName(tab.id, language)),
                h("small", null, tab.about[fa ? 1 : 0]),
              ),
              h("kbd", null, DDtabKeyLabel(tab.key)),
            ),
          ),
        ),
        h(
          "p",
          { className: "dd-this-app-hint" },
          t(fa, "A key works while nothing is being typed. A section can have its own key too.", "کلید وقتی کار می‌کند که چیزی تایپ نمی‌شود. هر سکشن هم می‌تواند کلید خودش را داشته باشد."),
        ),
      ),
      h(
        "section",
        { className: "dd-this-app-card" },
        h("h2", null, t(fa, "Sections", "سکشن‌ها"), sections.length ? h("small", null, sections.length) : null),
        sections.length
          ? h(
              "ul",
              { className: "dd-this-app-sections" },
              sections.map((section) =>
                h(
                  "li",
                  { key: section.id, "data-section": section.id },
                  h(
                    "button",
                    { type: "button", className: "dd-this-app-name", onClick: () => onRoom?.(section.id), style: { paddingInlineStart: 6 + section.depth * 12 } },
                    h("i", { "data-tint": section.tint, "aria-hidden": true }),
                    h("span", { dir: "auto" }, section.path),
                  ),
                  picking === section.id
                    ? h("input", {
                        className: "dd-this-app-key",
                        autoFocus: true,
                        maxLength: 1,
                        dir: "ltr",
                        "aria-label": t(fa, "Press one key", "یک کلید بزن"),
                        placeholder: "A–Z",
                        onKeyDown: (event) => {
                          event.stopPropagation();
                          if (event.key === "Escape") return setPicking(null);
                          const one = String(event.key || "").toLowerCase();
                          if (/^[a-z0-9]$/.test(one)) {
                            save(DDtabSetKey(list, section.id, one));
                            setPicking(null);
                          }
                        },
                        onBlur: () => setPicking(null),
                      })
                    : h(
                        "button",
                        { type: "button", className: "dd-this-app-keybtn", "aria-label": t(fa, "Shortcut for ", "کلید میان‌بر برای ") + section.name, onClick: () => setPicking(section.id) },
                        h("kbd", null, DDtabKeyLabel(list[section.id]) || "+"),
                      ),
                ),
              ),
            )
          : h("p", { className: "dd-this-app-hint" }, t(fa, "The Feed has no sections yet.", "فید هنوز سکشنی ندارد.")),
      ),
      h(
        "section",
        { className: "dd-this-app-card" },
        h("h2", null, t(fa, "Today", "امروز")),
        h(
          "ul",
          { className: "dd-this-app-counts" },
          [
            [t(fa, "Tasks", "کارها"), counts.total],
            [t(fa, "Done", "انجام‌شده"), counts.done],
            [t(fa, "Left", "باقی"), counts.open],
            [t(fa, "In the Park", "در پارک"), counts.parked],
            [t(fa, "Engine notes", "یادداشت‌های انجین"), notes],
            counts.habits ? [t(fa, "Habits today", "عادت‌های امروز"), counts.ticked + "/" + counts.habits] : null,
            [t(fa, "Days kept", "روزهای نگه‌داشته"), Object.keys(days).length],
          ]
            .filter(Boolean)
            .map(([label, value]) =>
              h("li", { key: label }, h("span", null, label), h("b", null, Number(value).toLocaleString(fa ? "fa-IR" : "en-US"))),
            ),
        ),
        h("span", { className: "dd-this-app-bar" }, h("i", { style: { width: progress.percent + "%" } })),
      ),
    ),
    changes.length
      ? h(
          "section",
          { className: "dd-this-app-changes" },
          h("h2", null, t(fa, "What changed", "چه چیزی تغییر کرد")),
          h(
            "ol",
            null,
            changes.map((entry) =>
              h(
                "li",
                { key: entry.version + entry.date },
                h("div", { className: "dd-this-app-version" }, h("b", null, entry.version), h("small", null, entry.date)),
                h("ul", null, entry.lines.map((line, index) => h("li", { key: index, dir: "auto" }, line))),
              ),
            ),
          ),
        )
      : null,
  );
}

export const DDthisAppCSS = `
.dd-this-app{display:flex;flex-direction:column;gap:16px;padding:18px 20px 26px;border-radius:16px;background:var(--paper,#fff);box-shadow:inset 0 0 0 1px var(--rule-2,#0002);min-width:0}
.dd-this-app-head h1{margin:0 0 4px;font:600 calc(19px * var(--k,1))/1.15 var(--sans,system-ui);letter-spacing:-.02em}
.dd-this-app-head p{margin:0;font-size:12.5px;color:var(--ink-3,#777)}
.dd-this-app-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;align-items:start}
.dd-this-app-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002);min-width:0}
.dd-this-app-card h2{display:flex;align-items:center;gap:8px;margin:0;font:600 12px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2,#555)}
.dd-this-app-card h2 small{margin-inline-start:auto;font:600 10px/1 var(--mono,monospace);padding:2px 5px;border-radius:5px;background:var(--wash,#eee);color:var(--ink-3,#777);letter-spacing:0}
.dd-this-app ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dd-this-app-tabs>li,.dd-this-app-sections>li{display:flex;align-items:center;gap:6px;min-width:0}
.dd-this-app-tabs>li>button,.dd-this-app-sections>li>button{flex:1;display:flex;align-items:center;gap:8px;min-width:0;min-height:32px;padding:4px 8px;border-radius:8px;background:none;color:var(--ink,#121211);font:inherit;text-align:start}
.dd-this-app-tabs>li>button:hover,.dd-this-app-sections>li>button:hover{background:var(--wash,#f1efe9)}
.dd-this-app-name{display:flex;align-items:center;gap:6px;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-this-app-name small{font:11px/1.2 var(--sans,system-ui);color:var(--ink-3,#777);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-this-app-name i{width:8px;height:8px;border-radius:50%;flex:none;background:var(--tint,var(--ink-3))}
.dd-this-app kbd{flex:none;font:600 10px/1 var(--mono,monospace);padding:3px 5px;border-radius:5px;background:var(--wash,#eee);box-shadow:inset 0 0 0 1px var(--rule-2,#0002);color:var(--ink-2,#555)}
.dd-this-app-keybtn{flex:none;width:26px;height:26px;border-radius:6px;background:none;display:grid;place-items:center}
.dd-this-app-keybtn:hover{background:var(--wash,#f1efe9)}
.dd-this-app-key{flex:none;width:34px;height:26px;text-align:center;border-radius:6px;border:1px solid var(--now,#2C50FF);background:var(--paper,#fff);color:var(--ink,#121211);font:600 11px/1 var(--mono,monospace)}
.dd-this-app-hint{margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-3,#777)}
.dd-this-app-counts>li{display:flex;align-items:baseline;gap:8px;padding:4px 2px;font-size:12.5px;color:var(--ink-2,#555)}
.dd-this-app-counts>li b{margin-inline-start:auto;font:600 12.5px/1 var(--mono,monospace);color:var(--ink,#121211)}
.dd-this-app-bar{display:block;height:5px;border-radius:9px;background:var(--wash,#eee);overflow:hidden}
.dd-this-app-bar i{display:block;height:100%;background:var(--ok,#2E8B3A);border-radius:inherit}
.dd-this-app-changes{display:flex;flex-direction:column;gap:8px}
.dd-this-app-changes h2{margin:0;font:600 12px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2,#555)}
.dd-this-app-changes ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.dd-this-app-changes>ol>li{padding:10px 12px;border-radius:11px;background:var(--panel,#f6f5f2);min-width:0}
.dd-this-app-version{display:flex;align-items:baseline;gap:8px;margin-bottom:4px;font:600 12.5px/1 var(--mono,monospace)}
.dd-this-app-version small{font:11px/1 var(--mono,monospace);color:var(--ink-3,#777)}
.dd-this-app-changes ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.dd-this-app-changes ul li{font-size:12.5px;line-height:1.5;color:var(--ink-2,#555);padding-inline-start:12px;position:relative;overflow-wrap:anywhere}
.dd-this-app-changes ul li:before{content:"·";position:absolute;inset-inline-start:2px;color:var(--ink-3,#999)}
@media (max-width:640px){.dd-this-app{padding:14px 12px}.dd-this-app-tabs>li>button,.dd-this-app-sections>li>button{min-height:40px}}
`;

export function DDinstallThisAppStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-this-app-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-this-app-css", textContent: DDthisAppCSS }));
}
