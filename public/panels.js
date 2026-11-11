// The app's panels, each with one color and one icon so it is quick to spot.
import { DDcaptureHubBus } from "./capture-hub.js";
// Headings, the app map, the view tabs and Ctrl+Space all read from this list.
export const DDpanelList = [
  {
    id: "engine",
    icon: "⚙️",
    color: "#F05A28",
    name: ["Engine", "انجین"],
    about: ["Bring today's Engine over the board: tick, score and add tasks", "انجین امروز را روی برد بیاور: تیک، نمره و افزودن کار"],
    words: "engine today tasks tick score quick انجین موتور امروز تیک نمره",
    isolate: false,
  },
  {
    id: "board",
    icon: "🧠",
    color: "#A35BEA",
    name: ["Board", "برد"],
    about: ["The same day as a mind map or lanes", "همان روز به شکل مایندمپ یا لاین"],
    words: "mind map mindmap canvas nodes lanes مایندمپ بوم نود",
    isolate: true,
  },
  {
    id: "habits",
    icon: "🌱",
    color: "#2BA672",
    name: ["Habits", "عادت‌ها"],
    about: ["A tick and minutes, with color levels", "تیک و دقیقه، با شدت رنگ"],
    words: "habit routine streak tick minutes عادت روتین تیک دقیقه",
    isolate: true,
  },
  {
    id: "calendar",
    icon: "📅",
    color: "#1E9BB3",
    name: ["Calendar", "تقویم"],
    about: ["Days, reminders and stats in one place", "روزها، یادآورها و آمار در یک جا"],
    words: "calendar days month reminders تقویم روز ماه یادآور",
    isolate: false,
  },
  {
    id: "stats",
    icon: "📊",
    color: "#E0529C",
    name: ["Stats", "آمار"],
    about: ["Streaks, charts and patterns across your days", "استریک، نمودارها و الگوهای همهٔ روزها"],
    words: "stats statistics charts trends streak patterns mood wave آمار نمودار روند استریک الگو موج",
    isolate: false,
    partOf: "calendar",
  },
];

export function DDpanelOf(id) {
  return DDpanelList.find((panel) => panel.id === id) || null;
}

export function DDpanelName(id, language) {
  const panel = DDpanelOf(id);
  return panel ? panel.name[language === "fa" ? 1 : 0] : id;
}

// One CSS variable per panel, and --pc inside anything marked data-panel.
export const DDpanelCSS = DDpanelList.map(
  (panel) =>
    `:root{--panel-${panel.id}:${panel.color}}[data-panel="${panel.id}"]{--pc:var(--panel-${panel.id})}`,
).join("\n");

// A short live count for each panel, for the app map.
export function DDpanelCounts(day = {}, setup = {}, language) {
  const fa = language === "fa",
    num = (value) => value.toLocaleString(fa ? "fa-IR" : "en-US"),
    blocks = day.blocks || [],
    habits = setup.habits || [],
    ticked = habits.filter((habit) => day.habits?.[habit.id]?.done).length;
  return {
    plan: fa ? num(blocks.length) + " کارت" : blocks.length + (blocks.length === 1 ? " card" : " cards"),
    habits: habits.length ? (fa ? num(ticked) + " از " + num(habits.length) + " امروز" : ticked + " of " + habits.length + " today") : null,
  };
}

// The Sections flowchart is not a panel of its own: it opens over the Board.
// It sits right after the Engine in Ctrl+Space.
export const DDsectionsCommand = {
  id: "sections",
  icon: "🗂️",
  color: "#8A6E4B",
  name: ["Sections", "سکشن‌ها"],
  about: ["Open the Sections flowchart: see every section at once and go into any of them", "فلوچارت سکشن‌ها را باز کن: همهٔ سکشن‌ها را یک‌جا ببین و وارد هر کدام شو"],
  words: "sections flowchart flow chart tree list drawer colors life rooms سکشن فلوچارت درخت فهرست کشو رنگ زندگی",
  isolate: false,
};
export const DDcaptureCommand = {
  id: "capture", icon: "✳", color: "#2A9677", name: ["Capture", "ثبت ایده"],
  about: ["Ideas, Later and worries in one place", "ایده‌ها، کارهای بعداً و نگرانی‌ها در یک‌جا"],
  words: "capture inbox ideas later worries quick ثبت ایده صندوق نگرانی بعداً",
  isolate: false,
};

// Rows for Ctrl+Space. open(id, isolate) runs when one is picked.
export function DDpanelCommands(language, open) {
  const fa = language === "fa",
    list = [...DDpanelList];
  list.splice(list.findIndex((panel) => panel.id === "engine") + 1, 0, DDsectionsCommand);
  list.splice(list.findIndex((panel) => panel.id === "sections") + 1, 0, DDcaptureCommand);
  return list.map((panel) => ({
    id: "cmd-panel-" + panel.id,
    panel: { id: panel.id, icon: panel.icon, color: panel.color, isolate: panel.isolate },
    names: panel.name,
    title: panel.name[fa ? 1 : 0],
    subtitle: panel.about[fa ? 1 : 0],
    words: [panel.id, ...panel.name, ...panel.about, panel.words].join(" "),
    action: () => panel.id === "capture" ? (DDcaptureHubBus.request(), open("board", false)) : open(panel.id, panel.isolate),
    showWithRest: panel.isolate ? () => open(panel.id, false) : null,
  }));
}

// Line icons for the panels (5.43): the app draws its own icons with lines;
// emoji belong to the person's own content. The emoji in DDpanelList stay as
// a fallback for any panel without a line icon.
const DDpanelLines = {
  engine: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3"/>',
  plan: '<path d="M2.8 4.2l.9.9 1.6-1.8M2.8 8.7l.9.9 1.6-1.8M7.5 4.5h5.7M7.5 9h5.7M7.5 13h5.7M3 13h1.5"/>',
  board: '<circle cx="4" cy="8" r="1.9"/><circle cx="12" cy="3.8" r="1.7"/><circle cx="12" cy="12.2" r="1.7"/><path d="M5.7 7.1l4.6-2.4M5.7 8.9l4.6 2.4"/>',
  habits: '<path d="M3.2 12.8C3.2 7 6.8 3.6 12.8 3.2c-.4 6-3.8 9.6-9.6 9.6z"/><path d="M3.2 12.8 8.2 7.8"/>',
  calendar: '<rect x="2.5" y="3.3" width="11" height="10.2" rx="2"/><path d="M2.5 6.8h11M5.4 1.9v2.6M10.6 1.9v2.6"/>',
  stats: '<path d="M3 13.2V8.6M8 13.2V3M13 13.2V6.2"/>',
  sections: '<rect x="2.3" y="2.3" width="4.6" height="4.6" rx="1.2"/><rect x="9.1" y="2.3" width="4.6" height="4.6" rx="1.2"/><rect x="2.3" y="9.1" width="4.6" height="4.6" rx="1.2"/><rect x="9.1" y="9.1" width="4.6" height="4.6" rx="1.2"/>',
};
export function DDpanelGlyph(R, id) {
  const lines = DDpanelLines[id];
  return lines
    ? R.createElement("svg", { viewBox: "0 0 16 16", width: "1em", height: "1em", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, dangerouslySetInnerHTML: { __html: lines } })
    : (DDpanelOf(id)?.icon || null);
}

// A colored icon chip.
export function DDPanelIcon({ React: R, id }) {
  const panel = DDpanelOf(id);
  return panel ? R.createElement("span", { className: "dd-panel-icon", "data-panel": id, "aria-hidden": true }, DDpanelGlyph(R, id)) : null;
}

// The app map: one card per panel, open or isolate it. Stats lives inside
// the Calendar panel, so it shares its card.
export function DDPanelMap({ React: R, language, counts = {}, onPick }) {
  const fa = language === "fa",
    t = (en, f) => (fa ? f : en);
  return R.createElement(
    "div",
    { className: "app-map-grid dd-panel-map" },
    DDpanelList.filter((panel) => !panel.partOf).map((panel, index) =>
      R.createElement(
        "div",
        { key: panel.id, className: "app-map-card", "data-panel": panel.id },
        R.createElement(
          "div",
          { className: "dd-panel-map-head" },
          R.createElement("span", { className: "dd-panel-icon", "data-panel": panel.id, "aria-hidden": true }, DDpanelGlyph(R, panel.id)),
          R.createElement("b", null, panel.name[fa ? 1 : 0]),
          counts[panel.id] && R.createElement("small", null, counts[panel.id]),
        ),
        R.createElement("span", { className: "dd-panel-map-about" }, panel.about[fa ? 1 : 0]),
        R.createElement(
          "div",
          { className: "dd-panel-map-actions" },
          R.createElement(
            "button",
            {
              type: "button",
              className: "btn solid",
              title: t("Key ", "کلید ") + (index + 1),
              onClick: () => onPick(panel.id, panel.isolate),
            },
            panel.isolate ? t("Isolate", "ایزوله") : t("Open", "باز کردن"),
          ),
          panel.isolate &&
            R.createElement(
              "button",
              {
                type: "button",
                className: "btn",
                title: "Shift+" + (index + 1),
                onClick: () => onPick(panel.id, false),
              },
              t("Show with the rest", "با بقیه ببین"),
            ),
        ),
      ),
    ),
  );
}
