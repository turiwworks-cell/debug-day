// The app's panels, each with one color and one icon so it is quick to spot.
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
    id: "plan",
    icon: "📋",
    color: "#3F8CFF",
    name: ["Plan", "پلن"],
    about: ["Today's cards in lanes, with steps and time", "کارهای امروز در لاین‌ها، با قدم‌ها و زمان"],
    words: "today tasks cards lanes blocks امروز کار کارت لاین",
    isolate: true,
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
  {
    id: "lab",
    icon: "🛠️",
    color: "#D39A00",
    name: ["App changes", "تغییرات اپ"],
    about: ["Ideas and notes about the app itself", "ایده‌ها و یادداشت‌ها دربارهٔ خود اپ"],
    words: "lab feedback ideas app changes ایده بازخورد اپ",
    isolate: true,
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
    ticked = habits.filter((habit) => day.habits?.[habit.id]?.done).length,
    notes = (setup.feedbacks || []).filter((item) => !item.done).length;
  return {
    plan: fa ? num(blocks.length) + " کارت" : blocks.length + (blocks.length === 1 ? " card" : " cards"),
    habits: habits.length ? (fa ? num(ticked) + " از " + num(habits.length) + " امروز" : ticked + " of " + habits.length + " today") : null,
    lab: notes ? (fa ? num(notes) + " باز" : notes + " open") : null,
  };
}

// The Section Drawer is not a panel of its own: it opens over the Board. It
// sits right after the Engine in Ctrl+Space.
export const DDsectionsCommand = {
  id: "sections",
  icon: "🗂️",
  color: "#8A6E4B",
  name: ["Sections", "سکشن‌ها"],
  about: ["Open the section drawer: pick a section and go into its board", "کشوی سکشن‌ها را باز کن: یک سکشن بردار و وارد بردش شو"],
  words: "sections drawer folders cards life rooms سکشن کشو پوشه کارت زندگی",
  isolate: false,
};

// Rows for Ctrl+Space. open(id, isolate) runs when one is picked.
export function DDpanelCommands(language, open) {
  const fa = language === "fa",
    list = [...DDpanelList];
  list.splice(list.findIndex((panel) => panel.id === "engine") + 1, 0, DDsectionsCommand);
  return list.map((panel) => ({
    id: "cmd-panel-" + panel.id,
    panel: { id: panel.id, icon: panel.icon, color: panel.color, isolate: panel.isolate },
    names: panel.name,
    title: panel.name[fa ? 1 : 0],
    subtitle: panel.about[fa ? 1 : 0],
    words: [panel.id, ...panel.name, ...panel.about, panel.words].join(" "),
    action: () => open(panel.id, panel.isolate),
    showWithRest: panel.isolate ? () => open(panel.id, false) : null,
  }));
}

// A colored icon chip.
export function DDPanelIcon({ React: R, id }) {
  const panel = DDpanelOf(id);
  return panel ? R.createElement("span", { className: "dd-panel-icon", "data-panel": id, "aria-hidden": true }, panel.icon) : null;
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
          R.createElement("span", { className: "dd-panel-icon", "aria-hidden": true }, panel.icon),
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
