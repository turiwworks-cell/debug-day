// Habits: small things you come back to (writing, sketching, a walk).
// A habit is not a task with hours. You tick it, and add minutes if you like.
// The minutes give each day a color level for the stats:
// 1 done · 2 good (half the goal) · 3 enough (the goal) · 4 too much (twice the goal).
// Each habit has its own goal (5.31), so 60 minutes of sport can be "enough"
// while 60 minutes of writing is "too much".
import { DDaddDays } from "./dates.js";
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
      return Number.isFinite(n) && n >= 1 && n <= 1440 ? n : fallback;
    },
    good = read(v.good, 15),
    enough = Math.max(good + 1, read(v.enough, 30)),
    much = Math.max(enough + 1, read(v.much, 60));
  return { good, enough, much };
}

// A habit's goal in minutes a day: its own, or "enough" from the older shared levels.
export function DDhabitGoal(habit, levels) {
  const goal = Math.round(+habit?.goal);
  return Number.isFinite(goal) && goal >= 5 && goal <= 600 ? goal : DDhabitLevels(levels).enough;
}

// The levels for one habit follow its goal: good at half, enough at the goal, too much at twice.
export function DDhabitLevelsFor(habit, levels) {
  const goal = Math.round(+habit?.goal);
  if (!(Number.isFinite(goal) && goal >= 5 && goal <= 600)) return DDhabitLevels(levels);
  return DDhabitLevels({ good: Math.round(goal / 2), enough: goal, much: goal * 2 });
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
    const goal = Math.round(+h.goal);
    out.push({
      id,
      name: name.trim() ? name : "Habit",
      emo: typeof h.emo === "string" ? h.emo.slice(0, 16) : "",
      color: /^#[0-9a-fA-F]{6}$/.test(h.color)
        ? h.color
        : DDhabitPalette[out.length % DDhabitPalette.length],
      ...(Number.isFinite(goal) && goal >= 5 && goal <= 600 ? { goal } : {}),
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

const DDshiftDate = DDaddDays;

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
    l = DDhabitLevels(levels),
    step = Math.min(15, l.good);
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
        "aria-label": "Add " + step + " minutes to " + habit.name,
        onClick: () => onChange({ min: (entry.min || 0) + step }),
      },
      "+" + step,
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
// "Manage habits" turns the list into name, color, goal and remove, right here.
export function DDHabitsPanel({
  React: R,
  Emoji,
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
  DDhabitStyle();
  const h = R.createElement,
    habits = setup.habits || [],
    shared = setup.preferences?.habitLevels,
    [name, setName] = R.useState(""),
    [open, setOpen] = R.useState(null),
    [managing, setManaging] = R.useState(false),
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
  return h(
    "section",
    {
      className: "dd-habits",
      "data-section-id": "habits",
      "data-panel": "habits",
      "data-managing": managing || undefined,
      "aria-label": "Habits",
    },
    h(
      "div",
      { className: "dd-habits-head" },
      h(
        "h2",
        null,
        PanelIcon ? h(PanelIcon, { React: R, id: "habits" }) : h("span", { "aria-hidden": true }, "🌱 "),
        "Habits",
      ),
      h(
        "small",
        null,
        managing
          ? "Each habit has its own goal. At the goal a day is “Enough”; at twice the goal, “Too much”."
          : "Tick it, add minutes if you like. Each habit has its own goal.",
      ),
      habits.length > 0 &&
        h(
          "button",
          {
            type: "button",
            className: "dd-habits-manage",
            "aria-pressed": managing,
            onClick: () => setManaging((v) => !v),
          },
          managing ? "Done" : "Manage habits",
        ),
    ),
    habits.length
      ? managing
        ? h(DDHabitManager, { React: R, habits, shared, onUpdateSetup })
        : h(
            "ul",
            null,
            habits.map((habit) => {
              const levels = DDhabitLevelsFor(habit, shared),
                entry = DDhabitEntry(day, habit.id),
                history = DDhabitHistory(days, habit.id, date, 14, levels);
              return h(
                "li",
                { key: habit.id, className: "dd-habit", style: { "--hc": habit.color }, "data-habit-id": habit.id },
                h(
                  "button",
                  {
                    type: "button",
                    className: "dd-habit-name",
                    "aria-expanded": open === habit.id,
                    title: "Show stats",
                    onClick: () => setOpen((v) => (v === habit.id ? null : habit.id)),
                  },
                  habit.emo ? (Emoji ? h(Emoji, { emoji: habit.emo, size: 22 }) : habit.emo + " ") : "",
                  h("span", { dir: "auto" }, habit.name),
                  h("small", { className: "dd-habit-goal" }, "goal " + DDminutesText(DDhabitGoal(habit, shared))),
                ),
                h(DDHabitControls, {
                  React: R,
                  habit,
                  entry,
                  levels,
                  language,
                  onChange: (patch) => onUpdateDay((d) => DDsetHabitEntry(d, habit.id, patch)),
                }),
                h(DDHabitStrip, { React: R, history, language }),
                open === habit.id && h(DDHabitStats, { React: R, habit, days, date, levels, language }),
              );
            }),
          )
      : h(
          "p",
          { className: "dd-habits-empty" },
          "No habits yet. Add one below, or drop a card into Habits on the Board.",
        ),
    h(
      "form",
      { className: "dd-habit-add", onSubmit: add },
      h("input", {
        dir: "auto",
        value: name,
        maxLength: 120,
        placeholder: "New habit, e.g. Writing",
        "aria-label": "New habit",
        onChange: (event) => setName(event.target.value),
      }),
      h("button", { type: "submit", className: "btn" }, "Add habit"),
    ),
  );
}

// Name, color, goal and remove for every habit, in one place.
export function DDHabitManager({ React: R, habits, shared, onUpdateSetup }) {
  const h = R.createElement,
    [armed, setArmed] = R.useState(null),
    patch = (id, change) =>
      onUpdateSetup((s) => ({ ...s, habits: (s.habits || []).map((x) => (x.id === id ? { ...x, ...change } : x)) }));
  return h(
    "ul",
    { className: "dd-habit-manage" },
    habits.map((habit) =>
      h(
        "li",
        { key: habit.id, style: { "--hc": habit.color }, "data-habit-id": habit.id },
        h("input", {
          type: "color",
          value: habit.color,
          "aria-label": "Color of " + habit.name,
          onChange: (event) => patch(habit.id, { color: event.target.value }),
        }),
        h("input", {
          dir: "auto",
          className: "dd-habit-rename",
          value: habit.name,
          maxLength: 120,
          "aria-label": "Name of " + habit.name,
          onChange: (event) => patch(habit.id, { name: event.target.value }),
        }),
        h(DDHabitGoalField, { React: R, habit, shared, onChange: (goal) => patch(habit.id, { goal }) }),
        h(
          "button",
          {
            type: "button",
            className: "textbtn dd-habit-remove" + (armed === habit.id ? " armed" : ""),
            "aria-label": armed === habit.id ? "Confirm removing " + habit.name : "Remove " + habit.name,
            onBlur: () => setArmed((v) => (v === habit.id ? null : v)),
            onClick: () => {
              if (armed !== habit.id) return setArmed(habit.id);
              onUpdateSetup((s) => ({ ...s, habits: (s.habits || []).filter((x) => x.id !== habit.id) }));
              setArmed(null);
            },
          },
          armed === habit.id ? "Remove? Past days keep their record" : "Remove",
        ),
      ),
    ),
  );
}

// Minutes a day that count as "enough" for this habit.
export function DDHabitGoalField({ React: R, habit, shared, onChange }) {
  const h = R.createElement,
    goal = DDhabitGoal(habit, shared),
    [draft, setDraft] = R.useState(null),
    save = () => {
      if (draft == null) return;
      const n = Math.round(+draft);
      setDraft(null);
      if (Number.isFinite(n) && n >= 5 && n <= 600) onChange(n);
    };
  return h(
    "label",
    { className: "dd-habit-goal-field" },
    h("span", null, "Goal"),
    h("input", {
      type: "number",
      inputMode: "numeric",
      min: 5,
      max: 600,
      step: 5,
      value: draft ?? goal,
      "aria-label": "Daily goal in minutes for " + habit.name,
      onChange: (event) => setDraft(event.target.value),
      onBlur: save,
      onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }
      },
    }),
    h("small", null, "min a day"),
  );
}

// Board: the panel for a selected habit.
export function DDHabitDetails({
  React: R,
  Emoji,
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
  DDhabitStyle();
  const h = R.createElement,
    shared = setup.preferences?.habitLevels,
    levels = DDhabitLevelsFor(habit, shared),
    entry = DDhabitEntry(day, habit.id),
    [armed, setArmed] = R.useState(false),
    patchHabit = (patch) =>
      onUpdateSetup((s) => ({
        ...s,
        habits: (s.habits || []).map((x) => (x.id === habit.id ? { ...x, ...patch } : x)),
      }));
  return h(
    "aside",
    {
      className: "dd-card-details dd-habit-details",
      "aria-label": "Habit",
      style: { "--card-color": habit.color, "--hc": habit.color },
      onPointerDown: (event) => event.stopPropagation(),
    },
    h(
      "header",
      null,
      h("span", { className: "dd-card-swatch" }),
      h("strong", { dir: "auto" }, habit.emo && (Emoji ? h(Emoji, { emoji: habit.emo, size: 24 }) : habit.emo + " "), habit.name),
      h("button", { type: "button", "aria-label": "Hide details", onClick: onClose }, "×"),
    ),
    h(
      "div",
      { className: "dd-card-field" },
      h("span", null, "Today"),
      h(DDHabitControls, {
        React: R,
        habit,
        entry,
        levels,
        language,
        onChange: (patch) => onUpdateDay((d) => DDsetHabitEntry(d, habit.id, patch)),
      }),
    ),
    h(
      "div",
      { className: "dd-card-field" },
      h("span", null, "Last 8 weeks"),
      h(DDHabitStats, { React: R, habit, days, date, levels, language }),
    ),
    h(
      "div",
      { className: "dd-card-field dd-habit-edit" },
      h("span", null, "Name, color and goal"),
      h(
        "div",
        null,
        h("input", {
          dir: "auto",
          value: habit.name,
          maxLength: 120,
          "aria-label": "Habit name",
          onChange: (event) => patchHabit({ name: event.target.value }),
        }),
        h("input", {
          type: "color",
          value: habit.color,
          "aria-label": "Habit color",
          onChange: (event) => patchHabit({ color: event.target.value }),
        }),
      ),
      h(DDHabitGoalField, { React: R, habit, shared, onChange: (goal) => patchHabit({ goal }) }),
    ),
    h(
      "button",
      {
        type: "button",
        className: "textbtn dd-habit-remove" + (armed ? " armed" : ""),
        onClick: () => {
          if (!armed) return setArmed(true);
          onUpdateSetup((s) => ({ ...s, habits: (s.habits || []).filter((x) => x.id !== habit.id) }));
          onClose?.();
        },
      },
      armed ? "Remove this habit? Past days keep their record." : "Remove habit",
    ),
  );
}

export function DDhabitStyle() {
  if (typeof document === "undefined" || document.getElementById("dd-habit-style")) return;
  (document.body || document.documentElement).append(Object.assign(document.createElement("style"), { id: "dd-habit-style", textContent: DDhabitCSS }));
}

export const DDhabitCSS = `
.dd-habits-head .dd-habits-manage{margin-inline-start:auto;align-self:center;font:500 12px/1 var(--sans);padding:7px 11px;border-radius:999px;color:var(--ink-2);background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule-2);cursor:pointer}
.dd-habits-head .dd-habits-manage:hover,.dd-habits-head .dd-habits-manage[aria-pressed=true]{color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink-3)}
.dd-habit-name{display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px}
.dd-habit-name .dd-habit-goal{font-size:11px;font-weight:400;color:var(--ink-3)}
.dd-habit-manage{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.dd-habit-manage li{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:6px 10px;border-radius:9px;background:var(--wash);border-inline-start:4px solid var(--hc)}
.dd-habit-manage input[type=color]{width:28px;height:28px;padding:0;border:0;background:none;flex:none;cursor:pointer}
.dd-habit-manage .dd-habit-rename{flex:1 1 160px;min-width:0;border:1px solid var(--rule-2);background:var(--panel);color:var(--ink);border-radius:7px;padding:6px 9px;font:inherit}
.dd-habit-goal-field{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-3)}
.dd-habit-goal-field input{width:62px;border:1px solid var(--rule-2);background:var(--panel);color:var(--ink);border-radius:7px;padding:5px 7px;font:inherit;font-size:13px}
.dd-habit-manage .dd-habit-remove{margin-inline-start:auto}
.dd-habit-edit .dd-habit-goal-field{margin-top:8px}
`;
