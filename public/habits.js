// Habits: small things you come back to (writing, sketching, a walk).
// A habit is not a task with hours. You tick it, and add minutes if you like.
// The minutes give each day a color level for the stats:
// 1 done · 2 good (15m) · 3 enough (30m) · 4 too much (60m). Levels are editable.
export const DDhabitPalette = [
  "#E2683C",
  "#3F8CFF",
  "#2BA672",
  "#A35BEA",
  "#D39A00",
  "#D9434A",
  "#1E9BB3",
];

const DDhabitLabels = [
  ["Not yet", "هنوز نه"],
  ["Done", "انجام شد"],
  ["Good", "خوب"],
  ["Enough", "به اندازه"],
  ["Too much", "بیش از اندازه"],
];

export function DDhabitLevelName(level, language) {
  const pair = DDhabitLabels[Math.max(0, Math.min(4, level | 0))];
  return language === "fa" ? pair[1] : pair[0];
}

// Minutes where "good", "enough" and "too much" start. Always in that order.
export function DDhabitLevels(value) {
  const v = value && typeof value === "object" ? value : {},
    read = (x, fallback) => {
      const n = Math.round(+x);
      return Number.isFinite(n) && n >= 1 && n <= 600 ? n : fallback;
    },
    good = read(v.good, 15),
    enough = Math.max(good + 1, read(v.enough, 30)),
    much = Math.max(enough + 1, read(v.much, 60));
  return { good, enough, much };
}

export function DDnormalizeHabits(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set(),
    out = [];
  for (const item of list.slice(0, 40)) {
    const h = item && typeof item === "object" ? item : {},
      id = typeof h.id === "string" ? h.id.slice(0, 80) : "",
      name = typeof h.name === "string" ? h.name.slice(0, 120) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: name.trim() ? name : "Habit",
      emo: typeof h.emo === "string" ? h.emo.slice(0, 16) : "",
      color: /^#[0-9a-fA-F]{6}$/.test(h.color)
        ? h.color
        : DDhabitPalette[out.length % DDhabitPalette.length],
    });
  }
  return out;
}

// One day's record: { habitId: { done: true, min: 25 } }. Empty days keep nothing.
export function DDnormalizeHabitLog(log) {
  const out = {};
  if (!log || typeof log !== "object" || Array.isArray(log)) return out;
  for (const [id, entry] of Object.entries(log).slice(0, 60)) {
    if (!id || !entry || typeof entry !== "object") continue;
    const min = Math.max(0, Math.min(1440, Math.round(+entry.min || 0)));
    if (entry.done || min > 0) out[id.slice(0, 80)] = min ? { done: true, min } : { done: true };
  }
  return out;
}

export function DDhabitEntry(day, id) {
  const entry = day?.habits?.[id];
  if (!entry) return { done: false, min: 0 };
  const min = Math.max(0, Math.round(+entry.min || 0));
  return { done: !!entry.done || min > 0, min };
}

export function DDhabitLevel(entry, levels) {
  const l = DDhabitLevels(levels);
  if (!entry?.done && !(entry?.min > 0)) return 0;
  const min = entry.min || 0;
  return min >= l.much ? 4 : min >= l.enough ? 3 : min >= l.good ? 2 : 1;
}

// Minutes mean it was done; unticking clears the day's minutes too.
export function DDsetHabitEntry(day, id, patch) {
  const current = DDhabitEntry(day, id),
    next = { ...current, ...patch };
  next.min = Math.max(0, Math.min(1440, Math.round(+next.min || 0)));
  if (next.min > 0) next.done = true;
  const habits = { ...(day?.habits || {}) };
  if (next.done) habits[id] = next.min ? { done: true, min: next.min } : { done: true };
  else delete habits[id];
  const out = { ...day, habits };
  if (!Object.keys(habits).length) delete out.habits;
  return out;
}

export function DDtoggleHabit(day, id) {
  return DDhabitEntry(day, id).done
    ? DDsetHabitEntry(day, id, { done: false, min: 0 })
    : DDsetHabitEntry(day, id, { done: true });
}

function DDshiftDate(date, amount) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

// The last `count` days up to `endDate`, oldest first.
export function DDhabitHistory(days, id, endDate, count, levels) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = DDshiftDate(endDate, -i),
      entry = DDhabitEntry(days?.[date], id);
    out.push({ date, ...entry, level: DDhabitLevel(entry, levels) });
  }
  return out;
}

// Days in a row, counting back from today (or yesterday, while today is still open).
export function DDhabitStreak(days, id, endDate) {
  let date = endDate,
    streak = 0;
  if (!DDhabitEntry(days?.[date], id).done) date = DDshiftDate(date, -1);
  while (streak < 3660 && DDhabitEntry(days?.[date], id).done) {
    streak++;
    date = DDshiftDate(date, -1);
  }
  return streak;
}

export function DDhabitSummary(history) {
  const levels = [0, 0, 0, 0, 0];
  let minutes = 0;
  for (const day of history) {
    levels[day.level]++;
    minutes += day.min || 0;
  }
  return { done: history.length - levels[0], minutes, levels };
}

// Turn a card into a habit. Reuses a habit with the same name.
export function DDhabitForBlock(habits, block, color, makeId) {
  const list = habits || [],
    name = (block?.name || "").trim() || "Habit",
    same = list.find((h) => h.name.trim().toLowerCase() === name.toLowerCase());
  if (same) return { habit: same, habits: list };
  const habit = {
    id: makeId(),
    name,
    emo: block?.emo || "",
    color: /^#[0-9a-fA-F]{6}$/.test(color || "")
      ? color
      : DDhabitPalette[list.length % DDhabitPalette.length],
  };
  return { habit, habits: [...list, habit] };
}

function DDminutesText(min, language) {
  if (!min) return "";
  const h = Math.floor(min / 60),
    m = min % 60,
    fa = language === "fa";
  if (!h) return m + (fa ? " دقیقه" : "m");
  return h + (fa ? " ساعت" : "h") + (m ? " " + m + (fa ? " دقیقه" : "m") : "");
}

export function DDhabitText(entry, levels, language) {
  const level = DDhabitLevel(entry, levels),
    minutes = DDminutesText(entry.min, language);
  return DDhabitLevelName(level, language) + (minutes ? " · " + minutes : "");
}

const tr = (language) => (en, fa) => (language === "fa" ? fa : en);

// A strip of small squares, one per day, colored by level.
export function DDHabitStrip({ React: R, history, language, className = "dd-habit-strip" }) {
  return R.createElement(
    "span",
    { className, "aria-hidden": true },
    history.map((d) =>
      R.createElement("i", {
        key: d.date,
        "data-level": d.level,
        title:
          d.date +
          " · " +
          DDhabitLevelName(d.level, language) +
          (d.min ? " · " + DDminutesText(d.min, language) : ""),
      }),
    ),
  );
}

// Tick + minutes for one habit on one day. Used by Plan and the Board panel.
export function DDHabitControls({ React: R, habit, entry, levels, language, onChange }) {
  const t = tr(language),
    level = DDhabitLevel(entry, levels),
    l = DDhabitLevels(levels);
  return R.createElement(
    "div",
    { className: "dd-habit-controls", "data-level": level },
    R.createElement(
      "button",
      {
        type: "button",
        className: "dd-habit-tick",
        "aria-pressed": entry.done,
        "aria-label": (entry.done ? t("Not done: ", "انجام نشد: ") : t("Done: ", "انجام شد: ")) + habit.name,
        onClick: () => onChange(entry.done ? { done: false, min: 0 } : { done: true }),
      },
      entry.done ? "✓" : "",
    ),
    R.createElement(
      "label",
      { className: "dd-habit-min" },
      R.createElement("input", {
        type: "number",
        inputMode: "numeric",
        min: 0,
        max: 600,
        step: 5,
        value: entry.min || "",
        placeholder: "0",
        "aria-label": t("Minutes for ", "دقیقه برای ") + habit.name,
        onChange: (event) => onChange({ min: event.target.value === "" ? 0 : +event.target.value }),
      }),
      R.createElement("span", null, t("min", "دقیقه")),
    ),
    R.createElement(
      "button",
      {
        type: "button",
        className: "dd-habit-plus",
        dir: "ltr",
        "aria-label": t("Add 15 minutes to ", "۱۵ دقیقه بیشتر برای ") + habit.name,
        onClick: () => onChange({ min: (entry.min || 0) + l.good }),
      },
      "+" + l.good,
    ),
    R.createElement("span", { className: "dd-habit-level" }, DDhabitLevelName(level, language)),
  );
}

// A few weeks of a habit as a calendar of colored squares.
export function DDHabitStats({ React: R, habit, days, date, levels, language, weeks = 8 }) {
  const t = tr(language),
    history = DDhabitHistory(days, habit.id, date, weeks * 7, levels),
    summary = DDhabitSummary(history),
    streak = DDhabitStreak(days, habit.id, date),
    weekday = new Date(history[0].date + "T12:00:00Z").getUTCDay(),
    // Weeks start on Saturday in Persian and on Monday in English.
    pad = language === "fa" ? (weekday + 1) % 7 : (weekday + 6) % 7;
  return R.createElement(
    "div",
    { className: "dd-habit-stats", style: { "--hc": habit.color } },
    R.createElement(
      "div",
      { className: "dd-habit-grid", role: "img", "aria-label": t("Last weeks", "هفته‌های اخیر") },
      Array.from({ length: pad }, (_, i) => R.createElement("i", { key: "p" + i, "data-pad": true })),
      history.map((d) =>
        R.createElement("i", {
          key: d.date,
          "data-level": d.level,
          "data-today": d.date === date || undefined,
          title: d.date + " · " + DDhabitText(d, levels, language),
        }),
      ),
    ),
    R.createElement(
      "p",
      { className: "dd-habit-sum" },
      summary.done + t(" days", " روز"),
      summary.minutes ? " · " + DDminutesText(summary.minutes, language) : "",
      streak > 1 ? " · " + streak + t(" in a row", " پشت سر هم") : "",
    ),
    R.createElement(
      "div",
      { className: "dd-habit-legend" },
      [1, 2, 3, 4].map((level) =>
        R.createElement(
          "span",
          { key: level },
          R.createElement("i", { "data-level": level }),
          DDhabitLevelName(level, language),
          " ",
          R.createElement("b", null, summary.levels[level]),
        ),
      ),
    ),
  );
}

// Plan: today's habits, each with tick, minutes and the last two weeks.
export function DDHabitsPanel({
  React: R,
  setup,
  day,
  days,
  date,
  language,
  onUpdateDay,
  onUpdateSetup,
  makeId,
  PanelIcon,
}) {
  const t = tr(language),
    habits = setup.habits || [],
    levels = DDhabitLevels(setup.preferences?.habitLevels),
    [name, setName] = R.useState(""),
    [open, setOpen] = R.useState(null),
    add = (event) => {
      event.preventDefault();
      const value = name.trim();
      if (!value) return;
      const id = makeId();
      onUpdateSetup((s) => ({
        ...s,
        habits: [
          ...(s.habits || []),
          { id, name: value, emo: "", color: DDhabitPalette[(s.habits || []).length % DDhabitPalette.length] },
        ],
      }));
      setName("");
    };
  return R.createElement(
    "section",
    {
      className: "dd-habits",
      "data-section-id": "habits",
      "data-panel": "habits",
      dir: language === "fa" ? "rtl" : "ltr",
      "aria-label": t("Habits", "عادت‌ها"),
    },
    R.createElement(
      "div",
      { className: "dd-habits-head" },
      R.createElement(
        "h2",
        null,
        PanelIcon ? R.createElement(PanelIcon, { React: R, id: "habits" }) : R.createElement("span", { "aria-hidden": true }, "🌱 "),
        t("Habits", "عادت‌ها"),
      ),
      R.createElement(
        "small",
        null,
        t(
          "Tick it, add minutes if you like. Colors: done · " + levels.good + "m good · " + levels.enough + "m enough · " + levels.much + "m too much",
          "تیک بزن، اگر خواستی دقیقه بنویس. رنگ‌ها: انجام شد · " + levels.good + " خوب · " + levels.enough + " به اندازه · " + levels.much + " بیش از اندازه",
        ),
      ),
    ),
    habits.length
      ? R.createElement(
          "ul",
          null,
          habits.map((habit) => {
            const entry = DDhabitEntry(day, habit.id),
              history = DDhabitHistory(days, habit.id, date, 14, levels);
            return R.createElement(
              "li",
              { key: habit.id, className: "dd-habit", style: { "--hc": habit.color }, "data-habit-id": habit.id },
              R.createElement(
                "button",
                {
                  type: "button",
                  className: "dd-habit-name",
                  "aria-expanded": open === habit.id,
                  title: t("Show stats", "نمایش آمار"),
                  onClick: () => setOpen((v) => (v === habit.id ? null : habit.id)),
                },
                habit.emo ? habit.emo + " " : "",
                habit.name,
              ),
              R.createElement(DDHabitControls, {
                React: R,
                habit,
                entry,
                levels,
                language,
                onChange: (patch) => onUpdateDay((d) => DDsetHabitEntry(d, habit.id, patch)),
              }),
              R.createElement(DDHabitStrip, { React: R, history, language }),
              open === habit.id &&
                R.createElement(DDHabitStats, { React: R, habit, days, date, levels, language }),
            );
          }),
        )
      : R.createElement(
          "p",
          { className: "dd-habits-empty" },
          t(
            "No habits yet. Add one below, or drop a card into Habits on the Board.",
            "هنوز عادتی نداری. پایین اضافه کن، یا در برد یک کارت را داخل بخش عادت‌ها بینداز.",
          ),
        ),
    R.createElement(
      "form",
      { className: "dd-habit-add", onSubmit: add },
      R.createElement("input", {
        dir: "auto",
        value: name,
        maxLength: 120,
        placeholder: t("New habit, e.g. Writing", "عادت تازه، مثلاً نوشتن"),
        "aria-label": t("New habit", "عادت تازه"),
        onChange: (event) => setName(event.target.value),
      }),
      R.createElement("button", { type: "submit", className: "btn" }, t("Add habit", "افزودن عادت")),
    ),
  );
}

// Board: the panel for a selected habit.
export function DDHabitDetails({
  React: R,
  habit,
  day,
  days,
  date,
  setup,
  language,
  onUpdateDay,
  onUpdateSetup,
  onClose,
}) {
  const t = tr(language),
    levels = DDhabitLevels(setup.preferences?.habitLevels),
    entry = DDhabitEntry(day, habit.id),
    [armed, setArmed] = R.useState(false),
    patchHabit = (patch) =>
      onUpdateSetup((s) => ({
        ...s,
        habits: (s.habits || []).map((h) => (h.id === habit.id ? { ...h, ...patch } : h)),
      }));
  return R.createElement(
    "aside",
    {
      className: "dd-card-details dd-habit-details",
      dir: language === "fa" ? "rtl" : "ltr",
      "aria-label": t("Habit", "عادت"),
      style: { "--card-color": habit.color, "--hc": habit.color },
      onPointerDown: (event) => event.stopPropagation(),
    },
    R.createElement(
      "header",
      null,
      R.createElement("span", { className: "dd-card-swatch" }),
      R.createElement("strong", { dir: "auto" }, (habit.emo ? habit.emo + " " : "") + habit.name),
      R.createElement(
        "button",
        { type: "button", "aria-label": t("Hide details", "بستن جزئیات"), onClick: onClose },
        "×",
      ),
    ),
    R.createElement(
      "div",
      { className: "dd-card-field" },
      R.createElement("span", null, t("Today", "امروز")),
      R.createElement(DDHabitControls, {
        React: R,
        habit,
        entry,
        levels,
        language,
        onChange: (patch) => onUpdateDay((d) => DDsetHabitEntry(d, habit.id, patch)),
      }),
    ),
    R.createElement(
      "div",
      { className: "dd-card-field" },
      R.createElement("span", null, t("Last 8 weeks", "۸ هفتهٔ اخیر")),
      R.createElement(DDHabitStats, { React: R, habit, days, date, levels, language }),
    ),
    R.createElement(
      "div",
      { className: "dd-card-field dd-habit-edit" },
      R.createElement("span", null, t("Name and color", "نام و رنگ")),
      R.createElement(
        "div",
        null,
        R.createElement("input", {
          dir: "auto",
          value: habit.name,
          maxLength: 120,
          "aria-label": t("Habit name", "نام عادت"),
          onChange: (event) => patchHabit({ name: event.target.value }),
        }),
        R.createElement("input", {
          type: "color",
          value: habit.color,
          "aria-label": t("Habit color", "رنگ عادت"),
          onChange: (event) => patchHabit({ color: event.target.value }),
        }),
      ),
    ),
    R.createElement(
      "button",
      {
        type: "button",
        className: "textbtn dd-habit-remove" + (armed ? " armed" : ""),
        onClick: () => {
          if (!armed) return setArmed(true);
          onUpdateSetup((s) => ({ ...s, habits: (s.habits || []).filter((h) => h.id !== habit.id) }));
          onClose?.();
        },
      },
      armed
        ? t("Remove this habit? Past days keep their record.", "این عادت حذف شود؟ روزهای قبل ثبت‌شان می‌ماند.")
        : t("Remove habit", "حذف عادت"),
    ),
  );
}

// Settings: the minutes for each level, and the habit list.
export function DDHabitSettings({ React: R, setup, language, onUpdateSetup }) {
  const t = tr(language),
    levels = DDhabitLevels(setup.preferences?.habitLevels),
    habits = setup.habits || [],
    setLevel = (key, value) =>
      onUpdateSetup((s) => ({
        ...s,
        preferences: {
          ...(s.preferences || {}),
          habitLevels: { ...DDhabitLevels(s.preferences?.habitLevels), [key]: +value },
        },
      })),
    field = (key, label) =>
      R.createElement(
        "label",
        { key },
        R.createElement("span", null, label),
        R.createElement("input", {
          type: "number",
          min: 1,
          max: 600,
          value: levels[key],
          "aria-label": label,
          onChange: (event) => event.target.value && setLevel(key, event.target.value),
        }),
        R.createElement("small", null, t("minutes or more", "دقیقه یا بیشتر")),
      );
  return R.createElement(
    "section",
    { id: "dd-habits-prefs", className: "dd-panel" },
    R.createElement(
      "div",
      { className: "sec-h" },
      R.createElement("h2", null, t("Habits", "عادت‌ها")),
    ),
    R.createElement(
      "p",
      { className: "desc" },
      t(
        "A tick alone counts as “Done”. Minutes move the day up to the next color.",
        "تیک تنها یعنی «انجام شد». دقیقه‌ها رنگ روز را پررنگ‌تر می‌کنند.",
      ),
    ),
    R.createElement(
      "div",
      { className: "dd-fields dd-habit-levels" },
      field("good", t("Good", "خوب")),
      field("enough", t("Enough", "به اندازه")),
      field("much", t("Too much", "بیش از اندازه")),
    ),
    habits.length > 0 &&
      R.createElement(
        "ul",
        { className: "dd-habit-list" },
        habits.map((habit) =>
          R.createElement(
            "li",
            { key: habit.id, style: { "--hc": habit.color } },
            R.createElement("input", {
              type: "color",
              value: habit.color,
              "aria-label": t("Habit color", "رنگ عادت"),
              onChange: (event) =>
                onUpdateSetup((s) => ({
                  ...s,
                  habits: (s.habits || []).map((h) => (h.id === habit.id ? { ...h, color: event.target.value } : h)),
                })),
            }),
            R.createElement("input", {
              dir: "auto",
              value: habit.name,
              maxLength: 120,
              "aria-label": t("Habit name", "نام عادت"),
              onChange: (event) =>
                onUpdateSetup((s) => ({
                  ...s,
                  habits: (s.habits || []).map((h) => (h.id === habit.id ? { ...h, name: event.target.value } : h)),
                })),
            }),
            R.createElement(
              "button",
              {
                type: "button",
                className: "textbtn",
                "aria-label": t("Remove ", "حذف ") + habit.name,
                onClick: () =>
                  onUpdateSetup((s) => ({ ...s, habits: (s.habits || []).filter((h) => h.id !== habit.id) })),
              },
              "×",
            ),
          ),
        ),
      ),
  );
}
