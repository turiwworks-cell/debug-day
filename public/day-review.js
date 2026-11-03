import { DDcompletion, DDprogressLabel } from "./planner.js";
import { DDduration } from "./measure.js";
import { DDnoteTags, DDtagText } from "./note-tags.js";
import { DDmediaTitle } from "./media.js";
// Calendar and feelings share one selected day. Reading a day never creates it.
export function DDreviewValidDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    +date.slice(0, 4) < 1900
  )
    return false;
  const value = new Date(date + "T12:00:00Z");
  return Number.isFinite(+value) && value.toISOString().slice(0, 10) === date;
}
// Counted and waiting cards take no minutes from the day.
function DDreviewMinutes(block) {
  return block?.measure === "count" || block?.measure === "wait"
    ? 0
    : Number(block?.min) || 0;
}
export function DDreviewShift(date, amount) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
const DDreviewFormats = new Map();
function DDreviewFormatter(language, calendar, options) {
  const key = JSON.stringify([language, calendar, options]);
  if (!DDreviewFormats.has(key))
    DDreviewFormats.set(
      key,
      new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", {
        calendar,
        timeZone: "UTC",
        ...options,
      }),
    );
  return DDreviewFormats.get(key);
}
export function DDreviewParts(date, calendar = "gregory") {
  const formatter = DDreviewFormatter("en", calendar, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    numberingSystem: "latn",
  });
  return Object.fromEntries(
    formatter
      .formatToParts(new Date(date + "T12:00:00Z"))
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, +part.value]),
  );
}
export function DDreviewMonth(date, calendar = "gregory", weekStart = 6) {
  const parts = DDreviewParts(date, calendar),
    start = DDreviewShift(date, 1 - parts.day);
  let length = 28;
  while (
    length < 32 &&
    DDreviewParts(DDreviewShift(start, length), calendar).day !== 1
  )
    length++;
  const weekday = new Date(start + "T12:00:00Z").getUTCDay(),
    gridStart = DDreviewShift(start, -((weekday - weekStart + 7) % 7));
  return {
    start,
    length,
    previous: DDreviewShift(start, -1),
    next: DDreviewShift(start, length),
    cells: Array.from({ length: 42 }, (_, index) => {
      const date = DDreviewShift(gridStart, index),
        value = DDreviewParts(date, calendar);
      return {
        date,
        day: value.day,
        inMonth: value.year === parts.year && value.month === parts.month,
      };
    }),
  };
}
export function DDreviewDateLabel(
  date,
  language = "en",
  calendar = language === "fa" ? "persian" : "gregory",
) {
  const formatter = DDreviewFormatter(language, calendar, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    value = new Date(date + "T12:00:00Z");
  if (language !== "fa") return formatter.format(value);
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  return (
    parts.weekday + "، " + parts.day + " " + parts.month + " " + parts.year
  );
}
export function DDreviewEmptyDay(date) {
  return {
    date,
    heavy: 0,
    tpl: "",
    focus: "",
    mood: "",
    journal: "",
    blocks: [],
    bugs: [],
    notes: [],
    canvas: null,
    pause: null,
  };
}
export function DDreviewSummary(day = {}, setup = {}) {
  const lanes = setup.lanes || [],
    blocks = day.blocks || [],
    planned = blocks.filter(
      (block) => !lanes.length || lanes.some((lane) => lane.id === block.lane),
    );
  return {
    completionPct: DDcompletion(day, lanes.map((l) => l.id)).percent,
    tasks: blocks.length,
    completed: blocks.filter((block) => block.done).length,
    plannedMinutes: planned.reduce(
      (sum, block) => sum + DDreviewMinutes(block),
      0,
    ),
    doneMinutes: planned
      .filter((block) => block.done)
      .reduce((sum, block) => sum + DDreviewMinutes(block), 0),
    parked: blocks.length - planned.length,
    feelings: (day.bugs || []).length,
    openFeelings: (day.bugs || []).filter((bug) => !bug.fixed).length,
    notes: (day.notes || []).length,
  };
}
export function DDreviewReminders(reminders = [], date) {
  return reminders
    .filter((reminder) => {
      if (!DDreviewValidDate(reminder.date) || reminder.date > date)
        return false;
      const days = Math.round(
        (Date.parse(date + "T12:00:00Z") -
          Date.parse(reminder.date + "T12:00:00Z")) /
          86400000,
      );
      return reminder.repeat === "weekly"
        ? days % 7 === 0
        : reminder.repeat === "alternate"
          ? days % 2 === 0
          : reminder.date === date;
    })
    .map((reminder) =>
      reminder.repeat !== "once" && reminder.completedDates?.includes(date)
        ? { ...reminder, done: true }
        : reminder,
    );
}
export function DDreviewSetReminderDone(snapshot, date, reminderId, done) {
  const reminder = snapshot.setup.reminders?.find(
      (item) => item.id === reminderId,
    ),
    current = reminder && DDreviewReminders([reminder], date)[0];
  if (!DDreviewValidDate(date) || !current || !!current.done === done)
    return snapshot;
  const data = structuredClone(snapshot),
    item = data.setup.reminders.find((item) => item.id === reminderId);
  if (item.repeat === "once") item.done = done;
  else {
    item.done = false;
    const dates = new Set(item.completedDates || []);
    if (done) dates.add(date);
    else dates.delete(date);
    item.completedDates = [...dates].sort();
  }
  return data;
}
export function DDreviewField(snapshot, date, field, value) {
  if (
    !DDreviewValidDate(date) ||
    !["mood", "focus", "journal"].includes(field) ||
    typeof value !== "string" ||
    (snapshot.days[date]?.[field] || "") === value
  )
    return snapshot;
  const data = structuredClone(snapshot),
    day = data.days[date] || (data.days[date] = DDreviewEmptyDay(date));
  day[field] = value.slice(0, field === "mood" ? 16 : 4000);
  return data;
}
export function DDreviewSaveFeeling(
  snapshot,
  { date, id, text, category, blockId, antidote },
  classify,
) {
  if (
    !DDreviewValidDate(date) ||
    typeof text !== "string" ||
    !text.trim() ||
    (id && !snapshot.days[date]?.bugs?.some((bug) => bug.id === id))
  )
    return snapshot;
  const data = structuredClone(snapshot),
    day = data.days[date] || (data.days[date] = DDreviewEmptyDay(date));
  const existing = id && day.bugs.find((bug) => bug.id === id),
    block = day.blocks.find((block) => block.id === blockId);
  const chosenCategory = category || existing?.category || "inner",
    detected = classify?.(text, chosenCategory) || {},
    validCategory = ["inner", "plan", "creative", "energy"].includes(
      chosenCategory,
    )
      ? chosenCategory
      : "inner";
  const item = {
    ...(existing || { id: crypto.randomUUID(), fixed: false, type: "" }),
    text: text.trim().slice(0, 4000),
    category: validCategory,
    triggerTag: detected.triggerTag || existing?.triggerTag || "",
    blockId: blockId === undefined ? existing?.blockId || "" : block?.id || "",
    on: blockId === undefined ? existing?.on || "" : block?.name || "",
    antidote: (typeof antidote === "string"
      ? antidote
      : existing?.antidote || ""
    )
      .trim()
      .slice(0, 4000),
  };
  if (existing) Object.assign(existing, item);
  else day.bugs.unshift(item);
  return data;
}
export function DDreviewFeelingAction(snapshot, date, id, action) {
  if (
    !["toggle", "delete"].includes(action) ||
    !snapshot.days[date]?.bugs?.some((bug) => bug.id === id)
  )
    return snapshot;
  const data = structuredClone(snapshot),
    day = data.days[date],
    item = day.bugs.find((bug) => bug.id === id);
  if (action === "toggle") item.fixed = !item.fixed;
  else {
    day.bugs = day.bugs.filter((bug) => bug.id !== id);
    const board = day.canvas?.board4,
      ref = "bug:" + id;
    if (board) {
      board.links = (board.links || []).filter(
        (link) => link.from !== ref && link.to !== ref,
      );
      for (const layout of Object.values(board.layouts || {}))
        delete layout[ref];
      if (board.styles) delete board.styles[ref];
      if (Array.isArray(board.stack))
        board.stack = board.stack.filter((value) => value !== ref);
      for (const [key, link] of Object.entries(board.overrides || {}))
        if (link.from === ref || link.to === ref) delete board.overrides[key];
      for (const field of ["locked", "hidden"])
        if (board[field])
          board[field] = board[field].filter((value) => value !== ref);
      for (const [key, refs] of Object.entries(board.groups || {})) {
        board.groups[key] = refs.filter((value) => value !== ref);
        if (board.groups[key].length < 2) delete board.groups[key];
      }
    }
  }
  return data;
}
export function DDreviewScheduleReminder(
  snapshot,
  date,
  reminderId,
  taskId = crypto.randomUUID(),
) {
  const reminder = snapshot.setup.reminders?.find(
    (item) => item.id === reminderId,
  );
  if (
    !DDreviewValidDate(date) ||
    !reminder ||
    !DDreviewReminders([reminder], date).some((item) => !item.done)
  )
    return snapshot;
  const data = structuredClone(snapshot),
    day = data.days[date] || (data.days[date] = DDreviewEmptyDay(date));
  day.blocks.push({
    id: taskId,
    name: reminder.title,
    type: reminder.type || data.setup.types?.[0]?.id || "other",
    lane: reminder.lane || data.setup.lanes?.[0]?.id || "",
    min: reminder.min || 30,
    note: reminder.note || "",
    pri: 1,
    emo: "",
    done: false,
    expanded: true,
    subtasks: [],
  });
  return DDreviewSetReminderDone(data, date, reminderId, true);
}
const DDreviewCategories = [
  ["inner", "Feelings", "احساسات"],
  ["plan", "Plans & time", "برنامه و زمان"],
  ["creative", "Starting & ideas", "شروع و ایده‌ها"],
  ["energy", "Energy & rest", "انرژی و استراحت"],
];
// The same topics name feelings on the Board.
export const DDfeelingTopics = DDreviewCategories;
const DDreviewMoods = [
  ["😫", "A hard day", "روز سخت"],
  ["😕", "Not great", "چندان خوب نیست"],
  ["😐", "Okay", "معمولی"],
  ["🙂", "Good", "خوب"],
  ["😄", "Very good", "خیلی خوب"],
  ["🔥", "Energized", "پرانرژی"],
];
function DDreviewLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function DDreviewRemember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function DDreviewDraft(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    text: typeof source.text === "string" ? source.text.slice(0, 4000) : "",
    category: DDreviewCategories.some(([id]) => id === source.category)
      ? source.category
      : "inner",
    blockId: typeof source.blockId === "string" ? source.blockId : undefined,
    antidote:
      typeof source.antidote === "string" ? source.antidote.slice(0, 4000) : "",
  };
}
function DDreviewDrafts() {
  const saved = DDreviewLocal("debug-day:feeling-drafts", {});
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return Object.fromEntries(
    Object.entries(saved)
      .filter(([date]) => DDreviewValidDate(date))
      .map(([date, draft]) => [date, DDreviewDraft(draft)]),
  );
}
function DDreviewEdits() {
  const value = DDreviewLocal("debug-day:feeling-edits", {});
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
function DDreviewUI(R, language) {
  return {
    h: R.createElement,
    fa: language === "fa",
    t: (en, fa) => (language === "fa" ? fa : en),
    n: (value) =>
      new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-GB").format(
        value,
      ),
  };
}
function DDReviewCalendar({
  React: R,
  data,
  date,
  today,
  language,
  onSelect,
  feelingsOnly = false,
  panelId,
}) {
  const { h, fa, t, n } = DDreviewUI(R, language),
    [preference, setPreference] = R.useState(() =>
      DDreviewLocal("debug-day:review-calendar", null),
    );
  const system = ["persian", "gregory"].includes(preference)
    ? preference
    : fa
      ? "persian"
      : "gregory";
  const [anchor, setAnchor] = R.useState(date),
    root = R.useRef(null),
    weekStart = fa ? 6 : 1;
  R.useEffect(() => setAnchor(date), [date]);
  const month = R.useMemo(
    () => DDreviewMonth(anchor, system, weekStart),
    [anchor, system, weekStart],
  );
  const tabDate = month.cells.some((cell) => cell.date === date)
    ? date
    : month.start;
  function select(value, scroll = false) {
    if (!DDreviewValidDate(value)) return;
    setAnchor(value);
    onSelect(value);
    if (scroll && matchMedia("(max-width:700px)").matches)
      requestAnimationFrame(() =>
        document.getElementById(panelId)?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "auto"
            : "smooth",
        }),
      );
  }
  function key(event, cell) {
    const offsets = {
      ArrowLeft: fa ? 1 : -1,
      ArrowRight: fa ? -1 : 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = DDreviewShift(cell.date, offsets[event.key]);
    select(next);
    requestAnimationFrame(() =>
      root.current?.querySelector('[data-review-date="' + next + '"]')?.focus(),
    );
  }
  return h(
    "section",
    {
      className: "dd-review-calendar",
      ref: root,
      "aria-label": t("Choose a day", "انتخاب روز"),
    },
    h(
      "div",
      { className: "dd-review-calendar-head" },
      h(
        "div",
        null,
        h(
          "h2",
          null,
          DDreviewFormatter(language, system, { month: "long" }).format(
            new Date(month.start + "T12:00:00Z"),
          ) +
            " " +
            new Intl.NumberFormat(fa ? "fa-IR" : "en-GB", { useGrouping: false }).format(
              DDreviewParts(month.start, system).year,
            ),
        ),
        h(
          "p",
          null,
          t(
            "Choose a day to see its details.",
            "یک روز را انتخاب کن تا جزئیاتش را ببینی.",
          ),
        ),
      ),
      h(
        "label",
        { className: "dd-review-system" },
        t("Calendar", "تقویم"),
        h(
          "select",
          {
            value: system,
            "aria-label": t("Calendar system", "نوع تقویم"),
            onChange: (event) => {
              setPreference(event.target.value);
              DDreviewRemember("debug-day:review-calendar", event.target.value);
            },
          },
          h("option", { value: "persian" }, t("Persian", "شمسی")),
          h("option", { value: "gregory" }, t("Gregorian", "میلادی")),
        ),
      ),
    ),
    h(
      "div",
      { className: "dd-review-month-controls" },
      h(
        "button",
        {
          type: "button",
          onClick: () => setAnchor(month.previous),
          "aria-label": t("Previous month", "ماه قبل"),
        },
        fa ? "→" : "←",
      ),
      h(
        "button",
        { type: "button", onClick: () => select(today, true) },
        t("Today", "امروز"),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => setAnchor(month.next),
          "aria-label": t("Next month", "ماه بعد"),
        },
        fa ? "←" : "→",
      ),
    ),
    h(
      "div",
      {
        className: "dd-review-month-grid",
        role: "group",
        "aria-label": t("Days of the month", "روزهای ماه"),
      },
      Array.from({ length: 7 }, (_, index) =>
        h(
          "span",
          {
            className: "dd-review-weekday",
            key: "weekday" + index,
            "aria-hidden": true,
          },
          DDreviewFormatter(language, "gregory", { weekday: "short" }).format(
            new Date(
              "2026-10-" +
                String(18 + ((weekStart + index) % 7)).padStart(2, "0") +
                "T12:00:00Z",
            ),
          ),
        ),
      ),
      month.cells.map((cell) => {
        const day = data.days[cell.date],
          summary = DDreviewSummary(day, data.setup),
          worries = (data.setup.worries || []).filter(
            (item) => item.createdAt === cell.date,
          ).length,
          feelingCount = summary.feelings,
          other =
            day?.journal || summary.notes
              ? t("Note", "یادداشت")
              : day?.focus
                ? t("Focus", "هدف")
                : worries
                  ? t("Worry", "نگرانی")
                  : !feelingsOnly &&
                      DDreviewReminders(data.setup.reminders, cell.date).length
                    ? t("Reminder", "یادآور")
                    : "";
        return h(
          "button",
          {
            key: cell.date,
            type: "button",
            "data-review-date": cell.date,
            "aria-pressed": cell.date === date,
            tabIndex: cell.date === tabDate ? 0 : -1,
            "aria-current": cell.date === today ? "date" : undefined,
            disabled: !DDreviewValidDate(cell.date),
            "aria-label":
              DDreviewDateLabel(cell.date, language, system) +
              " · " +
              n(feelingCount) +
              t(feelingCount === 1 ? " feeling" : " feelings", " احساس") +
              (!feelingsOnly
                ? " · " + n(summary.tasks) + t(summary.tasks === 1 ? " task" : " tasks", " کار")
                : "") +
              (other ? " · " + other : ""),
            className:
              "dd-review-date" +
              (cell.inMonth ? "" : " outside") +
              (cell.date === today ? " today" : ""),
            onClick: (event) => select(cell.date, event.detail > 0),
            onKeyDown: (event) => key(event, cell),
          },
          h(
            "span",
            { className: "dd-review-date-top" },
            h("strong", null, n(cell.day)),
            day?.mood &&
              h(
                "span",
                { className: "dd-review-date-mood", "aria-hidden": true },
                day.mood,
              ),
          ),
          h(
            "small",
            null,
            !feelingsOnly &&
              summary.tasks > 0 &&
              h("span", null, n(summary.tasks), t(summary.tasks === 1 ? " task" : " tasks", " کار")),
            feelingCount > 0 &&
              h(
                "span",
                { className: "dd-review-has-feeling" },
                n(feelingCount),
                t(feelingCount === 1 ? " feeling" : " feelings", " حس"),
              ),
            !feelingCount &&
              (feelingsOnly || !summary.tasks) &&
              other &&
              h("span", null, other),
          ),
        );
      }),
    ),
    h(
      "p",
      { className: "dd-review-calendar-key" },
      feelingsOnly
        ? t(
            "Each day shows its saved mood and number of entries.",
            "روی هر روز، حال ثبت‌شده و تعداد احساس‌ها دیده می‌شود.",
          )
        : t(
            "Each day shows how many tasks it had. Empty days have nothing saved.",
            "روی هر روز، تعداد کارها دیده می‌شود. خانهٔ خالی یعنی هنوز چیزی ثبت نشده.",
          ),
    ),
  );
}
function DDReviewMood({ React: R, data, date, language, setData, playful }) {
  const { h, t } = DDreviewUI(R, language),
    mood = data.days[date]?.mood || "";
  return h(
    "div",
    { className: "dd-review-mood" },
    h("h3", null, t("How was this day?", "حال این روزت چطور بود؟")),
    h(
      "div",
      { role: "group", "aria-label": t("Mood for this day", "حال این روز") },
      DDreviewMoods.map(([emoji, en, fa]) =>
        h(
          "button",
          {
            type: "button",
            key: emoji,
            "aria-pressed": mood === emoji,
            onClick: () =>
              setData((old) =>
                DDreviewField(
                  old,
                  date,
                  "mood",
                  old.days[date]?.mood === emoji ? "" : emoji,
                ),
              ),
          },
          playful ? h(playful.Emoji, { emoji, size: 26, "aria-hidden": true }) : h("span", { "aria-hidden": true }, emoji),
          t(en, fa),
        ),
      ),
    ),
    mood &&
      h(
        "button",
        {
          type: "button",
          className: "dd-review-text-button",
          onClick: () => setData((old) => DDreviewField(old, date, "mood", "")),
        },
        t("Clear mood", "پاک کردن حال ثبت‌شده"),
      ),
  );
}
function DDReviewFeelingForm({
  React: R,
  data,
  date,
  language,
  setData,
  classify,
  onToast,
  item,
  onFinish,
  quick = false,
}) {
  const { h, t } = DDreviewUI(R, language),
    [drafts, setDrafts] = R.useState(DDreviewDrafts),
    [editing, setEditing] = R.useState(() =>
      item
        ? DDreviewDraft(DDreviewEdits()[date + ":" + item.id] || item)
        : null,
    ),
    [error, setError] = R.useState(""),
    field = R.useRef(null);
  const draft = item ? editing : drafts[date] || DDreviewDraft();
  function change(patch) {
    setError("");
    if (item)
      setEditing((old) => {
        const next = { ...old, ...patch };
        DDreviewRemember("debug-day:feeling-edits", {
          ...DDreviewEdits(),
          [date + ":" + item.id]: next,
        });
        return next;
      });
    else
      setDrafts((old) => {
        const next = {
          ...old,
          [date]: { ...DDreviewDraft(old[date]), ...patch },
        };
        DDreviewRemember("debug-day:feeling-drafts", next);
        return next;
      });
  }
  function finish() {
    if (item) {
      const edits = DDreviewEdits();
      delete edits[date + ":" + item.id];
      DDreviewRemember("debug-day:feeling-edits", edits);
    }
    onFinish?.();
  }
  function submit(event) {
    event.preventDefault();
    if (!draft.text.trim()) {
      setError(t("Write a few words first.", "اول چند کلمه بنویس."));
      field.current?.focus();
      return;
    }
    setData((old) =>
      DDreviewSaveFeeling(old, { ...draft, date, id: item?.id }, classify),
    );
    if (!item)
      setDrafts((old) => {
        const next = { ...old };
        delete next[date];
        DDreviewRemember("debug-day:feeling-drafts", next);
        return next;
      });
    onToast?.(t("Feeling saved", "احساس ثبت شد"));
    finish();
    if (!item) field.current?.focus();
  }
  if (quick)
    return h(
      "form",
      { className: "dd-review-feeling-form quick", onSubmit: submit },
      h("input", {
        key: date,
        ref: field,
        dir: "auto",
        maxLength: 4000,
        value: draft.text,
        "aria-label": t("Feeling text", "متن احساس"),
        placeholder: t(
          "A feeling or something that happened…",
          "یک حس یا اتفاقی که افتاد…",
        ),
        onChange: (event) => change({ text: event.target.value }),
      }),
      h(
        "button",
        { type: "submit", className: "btn solid", disabled: !draft.text.trim() },
        t("Save feeling", "ثبت احساس"),
      ),
    );
  return h(
    "form",
    { className: "dd-review-feeling-form", onSubmit: submit },
    h(
      "label",
      null,
      t(
        "What are you feeling, or what happened?",
        "چه حسی داری یا چه اتفاقی افتاده؟",
      ),
      h("textarea", {
        key: date,
        ref: field,
        rows: 3,
        dir: "auto",
        maxLength: 4000,
        value: draft.text,
        "aria-label": t("Feeling text", "متن احساس"),
        placeholder: t(
          "For example: I felt rushed after sleeping late.",
          "مثلاً: دیر خوابیدم و امروز برای کارها عجله داشتم.",
        ),
        onChange: (event) => change({ text: event.target.value }),
      }),
    ),
    h(
      "details",
      { className: "dd-review-optional" },
      h("summary", null, t("Optional details", "جزئیات اختیاری")),
      h(
        "div",
        { className: "dd-review-form-grid" },
        h(
          "label",
          null,
          t("Topic", "موضوع"),
          h(
            "select",
            {
              value: draft.category,
              "aria-label": t("Feeling topic", "موضوع احساس"),
              onChange: (event) => change({ category: event.target.value }),
            },
            DDreviewCategories.map(([id, en, fa]) =>
              h("option", { value: id, key: id }, t(en, fa)),
            ),
          ),
        ),
        h(
          "label",
          null,
          t("Related task", "کار مرتبط"),
          h(
            "select",
            {
              value: draft.blockId ?? (item?.on ? "__existing__" : ""),
              "aria-label": t("Related task", "کار مرتبط"),
              onChange: (event) =>
                change({
                  blockId:
                    event.target.value === "__existing__"
                      ? undefined
                      : event.target.value,
                }),
            },
            item?.on &&
              draft.blockId === undefined &&
              h(
                "option",
                { value: "__existing__" },
                t("Current: ", "ارتباط فعلی: ") + item.on,
              ),
            h("option", { value: "" }, t("No specific task", "کار خاصی ندارد")),
            (data.days[date]?.blocks || []).map((block) =>
              h("option", { key: block.id, value: block.id }, block.name),
            ),
          ),
        ),
      ),
      h(
        "label",
        null,
        t("What could help?", "چه چیزی می‌تواند کمک کند؟"),
        h("input", {
          value: draft.antidote,
          maxLength: 4000,
          dir: "auto",
          onChange: (event) => change({ antidote: event.target.value }),
        }),
      ),
    ),
    error && h("p", { role: "alert" }, error),
    h(
      "div",
      { className: "dd-review-form-actions" },
      h(
        "button",
        {
          type: "submit",
          className: "btn solid",
          disabled: !draft.text.trim(),
        },
        item
          ? t("Save changes", "ذخیرهٔ تغییرات")
          : t("Save feeling", "ثبت احساس"),
      ),
      item &&
        h(
          "button",
          { type: "button", className: "btn", onClick: finish },
          t("Cancel", "لغو"),
        ),
      !item &&
        h(
          "small",
          null,
          t(
            "Saved to the selected day above.",
            "برای روز انتخاب‌شده در بالای این بخش ثبت می‌شود.",
          ),
        ),
    ),
  );
}
export function DDFeelingsPanel({
  React: R,
  data,
  date,
  language,
  setData,
  classify,
  onToast,
  RowTools,
  effectsFor,
  compact = false,
  playful,
  onBrowse,
  PanelIcon,
}) {
  const { h, t, n } = DDreviewUI(R, language),
    [filter, setFilter] = R.useState("all"),
    [editing, setEditing] = R.useState(null),
    [armed, setArmed] = R.useState(null),
    day = data.days[date] || DDreviewEmptyDay(date),
    all = day.bugs || [],
    rows = all.filter(
      (item) =>
        filter === "all" || (filter === "closed" ? item.fixed : !item.fixed),
    );
  R.useEffect(() => {
    setEditing(null);
    setArmed(null);
  }, [date]);
  if (compact)
    return h(
      "section",
      {
        className: "dd-review-feelings compact",
        dir: language === "fa" ? "rtl" : "ltr",
        "data-panel": "feelings",
        "data-section-id": "bugs",
        "aria-label": t("Feelings for this day", "احساسات این روز"),
      },
      h(
        "div",
        { className: "dd-review-section-heading" },
        h(
          "h2",
          null,
          PanelIcon && h(PanelIcon, { React: R, id: "feelings" }),
          t("Feelings & events", "احساسات و اتفاق‌ها"),
          all.length > 0 && h("small", null, " · " + n(all.filter((item) => !item.fixed).length) + t(" open", " باز")),
        ),
        onBrowse &&
          h(
            "button",
            { type: "button", className: "btn", onClick: onBrowse },
            t("Details in Feelings", "جزئیات در احساسات"),
          ),
      ),
      h(DDReviewFeelingForm, {
        React: R,
        data,
        date,
        language,
        setData,
        classify,
        onToast,
        quick: true,
      }),
      all.length > 0 &&
        h(
          "ul",
          { className: "dd-feelings-quick-list" },
          all.map((item) =>
            h(
              "li",
              {
                key: item.id,
                "data-feeling-id": item.id,
                className: item.fixed ? "closed" : "",
                style: item.color ? { "--feeling-color": item.color } : undefined,
              },
              h(
                "button",
                {
                  type: "button",
                  className: "dd-feeling-tick",
                  "aria-pressed": !!item.fixed,
                  "aria-label": item.fixed
                    ? t("Reopen", "باز کردن دوباره") + ": " + item.text
                    : t("Close entry", "بستن این مورد") + ": " + item.text,
                  onClick: () =>
                    setData((old) =>
                      DDreviewFeelingAction(old, date, item.id, "toggle"),
                    ),
                },
                item.fixed ? "✓" : "",
              ),
              h("span", { dir: "auto" }, item.text),
              item.on && h("small", { dir: "auto" }, item.on),
            ),
          ),
        ),
    );
  return h(
    "section",
    {
      className: "dd-review-feelings",
      dir: language === "fa" ? "rtl" : "ltr",
      "data-panel": "feelings",
      "aria-label": t("Feelings for this day", "احساسات این روز"),
    },
    h(
      "div",
      { className: "dd-review-section-heading" },
      h(
        "div",
        null,
        h(
          "h2",
          null,
          PanelIcon && h(PanelIcon, { React: R, id: "feelings" }),
          t("Feelings & events", "احساسات و اتفاق‌ها"),
        ),
        h(
          "p",
          null,
          t(
            "A few words are enough. You do not need to choose a category.",
            "چند کلمه کافی است؛ لازم نیست دسته‌بندی انتخاب کنی.",
          ),
        ),
      ),
    ),
    h(DDReviewMood, { React: R, data, date, language, setData, playful }),
    h(DDReviewFeelingForm, {
      React: R,
      data,
      date,
      language,
      setData,
      classify,
      onToast,
    }),
    h(
      "div",
      { className: "dd-review-log-heading" },
      h(
        "h3",
        null,
        t("Saved entries", "ثبت‌های این روز"),
        " · ",
        n(all.length),
      ),
      all.length > 0 &&
        h(
          "div",
          {
            className: "dd-review-log-filters",
            role: "group",
            "aria-label": t("Entry status", "وضعیت ثبت‌ها"),
          },
          [
            ["all", "All", "همه"],
            ["open", "Open", "باز"],
            ["closed", "Closed", "بسته‌شده"],
          ].map(([id, en, fa]) =>
            h(
              "button",
              {
                key: id,
                type: "button",
                "aria-pressed": filter === id,
                onClick: () => setFilter(id),
              },
              t(en, fa),
            ),
          ),
        ),
    ),
    !rows.length &&
      h(
        "p",
        { className: "dd-review-empty" },
        all.length
          ? t("No entries with this status.", "موردی با این وضعیت نیست.")
          : t(
              "No feelings saved for this day yet. Use the box above to add one.",
              "هنوز احساسی برای این روز ثبت نشده. از کادر بالا شروع کن.",
            ),
      ),
    rows.map((item) => {
      const effects = effectsFor?.(day, item.id) || [];
      return h(
        "article",
        {
          key: item.id,
          className: "dd-review-feeling" + (item.fixed ? " closed" : ""),
          "data-feeling-id": item.id,
          style: item.color ? { "--feeling-color": item.color } : undefined,
        },
        editing === item.id
          ? h(DDReviewFeelingForm, {
              React: R,
              data,
              date,
              language,
              setData,
              classify,
              onToast,
              item,
              onFinish: () => setEditing(null),
            })
          : h(
              R.Fragment,
              null,
              h(
                "div",
                { className: "dd-review-feeling-heading" },
                h(
                  "span",
                  { className: "dd-review-status" },
                  item.fixed ? t("Closed", "بسته‌شده") : t("Open", "باز"),
                ),
                RowTools &&
                  h(RowTools, {
                    React: R,
                    language,
                    text: [item.text, item.antidote].filter(Boolean).join("\n"),
                    color: item.color,
                    onToast,
                    onColor: (color) =>
                      setData((old) => {
                        if (
                          !old.days[date]?.bugs?.some(
                            (bug) => bug.id === item.id,
                          )
                        )
                          return old;
                        const copy = structuredClone(old);
                        copy.days[date].bugs.find(
                          (bug) => bug.id === item.id,
                        ).color = color;
                        return copy;
                      }),
                  }),
              ),
              h(
                "p",
                { className: "dd-review-feeling-text", dir: "auto" },
                item.text,
              ),
              item.on &&
                h(
                  "p",
                  { className: "dd-review-context", dir: "auto" },
                  t("Related to: ", "مرتبط با: "),
                  item.on,
                ),
              item.antidote &&
                h(
                  "p",
                  { className: "dd-review-help", dir: "auto" },
                  t("What may help: ", "چیزی که کمک می‌کند: "),
                  item.antidote,
                ),
              effects.length > 0 &&
                h(
                  "div",
                  { className: "dd-review-effects" },
                  h(
                    "small",
                    null,
                    t(
                      "Connections from the board",
                      "ارتباط‌های ثبت‌شده در برد",
                    ),
                  ),
                  effects.map((effect, index) =>
                    h(
                      "p",
                      { key: index, dir: "auto" },
                      effect.title,
                      effect.label ? " — " + effect.label : "",
                    ),
                  ),
                ),
              h(
                "div",
                { className: "dd-review-item-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () =>
                      setData((old) =>
                        DDreviewFeelingAction(old, date, item.id, "toggle"),
                      ),
                  },
                  item.fixed
                    ? t("Reopen", "باز کردن دوباره")
                    : t("Close entry", "بستن این مورد"),
                ),
                h(
                  "button",
                  { type: "button", onClick: () => setEditing(item.id) },
                  t("Edit", "ویرایش"),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: armed === item.id ? "danger" : "",
                    onClick: () => {
                      if (armed !== item.id) {
                        setArmed(item.id);
                        return;
                      }
                      setData((old) =>
                        DDreviewFeelingAction(old, date, item.id, "delete"),
                      );
                      setArmed(null);
                      onToast?.(t("Entry deleted", "مورد حذف شد"));
                    },
                  },
                  armed === item.id
                    ? t("Confirm delete", "تأیید حذف")
                    : t("Delete", "حذف"),
                ),
                armed === item.id &&
                  h(
                    "button",
                    { type: "button", onClick: () => setArmed(null) },
                    t("Cancel", "لغو"),
                  ),
              ),
            ),
      );
    }),
  );
}
// Calendar shows what was felt; writing and editing live on the Feelings page.
function DDFeelingsBrief({ React: R, day, language, PanelIcon, onOpen }) {
  const { h, t, n } = DDreviewUI(R, language),
    all = day.bugs || [],
    mood = DDreviewMoods.find(([emoji]) => emoji === day.mood);
  return h(
    "section",
    {
      className: "dd-review-feelings-brief",
      "data-panel": "feelings",
      "aria-label": t("Feelings for this day", "احساسات این روز"),
    },
    h(
      "div",
      { className: "dd-review-section-heading" },
      h(
        "h2",
        null,
        PanelIcon && h(PanelIcon, { React: R, id: "feelings" }),
        t("Feelings & events", "احساسات و اتفاق‌ها"),
        " · ",
        n(all.length),
      ),
      onOpen &&
        h(
          "button",
          { type: "button", className: "btn", onClick: onOpen },
          all.length || day.mood
            ? t("Open in Feelings", "باز کردن در احساسات")
            : t("Write in Feelings", "نوشتن در احساسات"),
        ),
    ),
    (day.mood || "") &&
      h(
        "p",
        { className: "dd-review-brief-mood" },
        t("Mood: ", "حال: "),
        h("span", { "aria-hidden": true }, day.mood),
        mood ? " " + t(mood[1], mood[2]) : "",
      ),
    all.length
      ? h(
          "ul",
          null,
          all.slice(0, 6).map((item) =>
            h(
              "li",
              {
                key: item.id,
                "data-feeling-id": item.id,
                className: item.fixed ? "closed" : "",
                style: item.color ? { "--feeling-color": item.color } : undefined,
              },
              h(
                "span",
                { className: "dd-review-status" },
                item.fixed ? t("Closed", "بسته‌شده") : t("Open", "باز"),
              ),
              h("span", { dir: "auto" }, item.text),
            ),
          ),
          all.length > 6 &&
            h("li", { className: "more" }, t("and ", "و ") + n(all.length - 6) + t(" more", " مورد دیگر")),
        )
      : !day.mood &&
          h(
            "p",
            { className: "dd-review-empty" },
            t("Nothing recorded for this day.", "برای این روز چیزی ثبت نشده."),
          ),
  );
}
function DDReviewTasks({
  React: R,
  playful,
  data,
  date,
  language,
  setData,
  onOpenPlan,
  onToggleTask,
  onMoveTask,
  parseTask,
  onToast,
}) {
  const { h, t, n } = DDreviewUI(R, language),
    [text, setText] = R.useState(""),
    [move, setMove] = R.useState({}),
    [error, setError] = R.useState(""),
    day = data.days[date] || DDreviewEmptyDay(date);
  R.useEffect(() => {
    setText("");
    setError("");
    setMove({});
  }, [date]);
  function add(event) {
    event.preventDefault();
    const task = parseTask(text, day);
    if (!task) {
      setError(t("Enter a task name.", "نام کار را بنویس."));
      return;
    }
    setData((old) => {
      const copy = structuredClone(old),
        target = copy.days[date] || (copy.days[date] = DDreviewEmptyDay(date));
      target.blocks.push(task);
      return copy;
    });
    setText("");
    setError("");
    onToast?.(t("Task added to this day", "کار به این روز اضافه شد"));
  }
  return h(
    "section",
    { className: "dd-review-tasks" },
    h(
      "div",
      { className: "dd-review-section-heading" },
      h("h2", null, t("Tasks", "کارها"), " · ", n(day.blocks.length)),
      h(
        "button",
        { type: "button", className: "btn", onClick: () => onOpenPlan(date) },
        t("Open this day in Plan", "باز کردن این روز در پلن"),
      ),
    ),
    !day.blocks.length &&
      h(
        "p",
        { className: "dd-review-empty" },
        t("No saved tasks on this day.", "کاری برای این روز ثبت نشده."),
      ),
    day.blocks.map((block) =>
      h(
        "article",
        {
          key: block.id,
          className: "dd-review-task" + (block.done ? " done" : ""),
          "data-review-task": block.id,
        },
        h(
          "div",
          { className: "dd-review-task-main" },
          h(
            "button",
            {
              type: "button",
              className: "dd-review-check",
              "aria-label":
                t("Toggle task: ", "تغییر وضعیت کار: ") + block.name,
              "aria-pressed": !!block.done,
              onClick: () => onToggleTask(date, block.id),
            },
            block.done ? "✓" : "○",
          ),
          h(
            "button",
            {
              type: "button",
              className: "dd-review-task-name",
              onClick: () => onOpenPlan(date, block.id),
              dir: "auto",
            },
            playful && block.emo && h("span", { "aria-hidden": true }, h(playful.Emoji, { emoji: block.emo, size: 23 })),
            block.name,
          ),
          h(
            "span",
            { className: "dd-review-minutes" },
            block.measure === "count"
              ? n(block.count || 0) + "/" + n(block.times || 1) + t(" times", " بار")
              : block.measure === "wait"
                ? t("Waiting", "در انتظار")
                : DDduration(block.min, language),
          ),
        ),
        h(
          "details",
          { className: "dd-review-task-options" },
          h("summary", null, t("Task options", "گزینه‌های کار")),
          block.note && h("p", { dir: "auto" }, block.note),
          h(
            "div",
            { className: "dd-review-move" },
            h(
              "label",
              null,
              t(
                "Move to a different day (Gregorian)",
                "انتقال به روز دیگر (تاریخ میلادی)",
              ),
              h("input", {
                type: "date",
                value: move[block.id] || "",
                min: "1900-01-01",
                "aria-label":
                  t("New date for ", "تاریخ جدید برای ") + block.name,
                onChange: (event) => {
                  const value = event.target.value;
                  setMove((old) => ({
                    ...old,
                    [block.id]: value,
                  }));
                },
              }),
            ),
            h(
              "button",
              {
                type: "button",
                disabled:
                  !DDreviewValidDate(move[block.id]) || move[block.id] === date,
                onClick: () => {
                  onMoveTask(date, move[block.id], block.id);
                  onToast?.(t("Task moved", "کار منتقل شد"));
                },
              },
              t("Move task", "انتقال کار"),
            ),
          ),
        ),
      ),
    ),
    h(
      "form",
      { className: "dd-review-task-add", onSubmit: add },
      h(
        "label",
        null,
        t("Add a task for this day", "افزودن کار برای این روز"),
        h("input", {
          value: text,
          maxLength: 4000,
          dir: "auto",
          "aria-label": t("New task for this day", "کار جدید برای این روز"),
          placeholder: t("One thing to do…", "یک کار برای انجام دادن…"),
          onChange: (event) => setText(event.target.value),
        }),
      ),
      h(
        "button",
        { type: "submit", className: "btn solid", disabled: !text.trim() },
        t("Add task", "افزودن کار"),
      ),
    ),
    error && h("p", { role: "alert" }, error),
  );
}
function DDReviewReminders({
  React: R,
  data,
  date,
  language,
  setData,
  onScheduleReminder,
  onToast,
}) {
  const { h, t } = DDreviewUI(R, language),
    [text, setText] = R.useState(""),
    [repeat, setRepeat] = R.useState("once"),
    [armed, setArmed] = R.useState(null),
    reminders = DDreviewReminders(data.setup.reminders, date);
  R.useEffect(() => {
    setText("");
    setRepeat("once");
    setArmed(null);
  }, [date]);
  function add(event) {
    event.preventDefault();
    if (!text.trim()) return;
    const item = {
      id: crypto.randomUUID(),
      date,
      title: text.trim(),
      repeat,
      done: false,
      type: data.setup.types?.[0]?.id || "other",
      lane: data.setup.lanes?.[0]?.id || "",
      min: 30,
      note: "",
    };
    setData((old) => ({
      ...old,
      setup: {
        ...old.setup,
        reminders: [item, ...(old.setup.reminders || [])],
      },
    }));
    setText("");
    onToast?.(t("Reminder added", "یادآور اضافه شد"));
  }
  return h(
    "section",
    { className: "dd-review-reminders" },
    h("h2", null, t("Reminders", "یادآورها")),
    !reminders.length &&
      h(
        "p",
        { className: "dd-review-empty" },
        t("No reminders for this day.", "یادآوری برای این روز نیست."),
      ),
    reminders.map((item) =>
      h(
        "article",
        { key: item.id, className: "dd-review-reminder" },
        h(
          "div",
          null,
          h("strong", { dir: "auto" }, item.title),
          h(
            "small",
            null,
            item.repeat === "weekly"
              ? t("Every week", "هر هفته")
              : item.repeat === "alternate"
                ? t("Every other day", "یک روز در میان")
                : t("This day only", "فقط این روز"),
            item.done
              ? " · " + t("Done for this day", "این نوبت انجام‌شده")
              : "",
          ),
        ),
        h(
          "div",
          { className: "dd-review-item-actions" },
          !item.done &&
            h(
              "button",
              { type: "button", onClick: () => onScheduleReminder(item, date) },
              t("Make a task in Plan", "تبدیل به کار در پلن"),
            ),
          h(
            "button",
            {
              type: "button",
              onClick: () =>
                setData((old) =>
                  DDreviewSetReminderDone(old, date, item.id, !item.done),
                ),
            },
            item.done
              ? t("Reopen reminder", "باز کردن یادآور")
              : t("Mark this occurrence done", "انجام این نوبت"),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                if (armed !== item.id) {
                  setArmed(item.id);
                  return;
                }
                setData((old) => ({
                  ...old,
                  setup: {
                    ...old.setup,
                    reminders: (old.setup.reminders || []).filter(
                      (reminder) => reminder.id !== item.id,
                    ),
                  },
                }));
                setArmed(null);
              },
            },
            armed === item.id
              ? t("Confirm delete", "تأیید حذف")
              : item.repeat === "once"
                ? t("Delete", "حذف")
                : t("Delete repeating reminder", "حذف یادآور تکراری"),
          ),
          armed === item.id &&
            h(
              "button",
              { type: "button", onClick: () => setArmed(null) },
              t("Cancel", "لغو"),
            ),
        ),
      ),
    ),
    h(
      "details",
      null,
      h("summary", null, t("Add a reminder", "افزودن یادآور")),
      h(
        "form",
        { className: "dd-review-reminder-add", onSubmit: add },
        h(
          "label",
          null,
          t("Reminder text", "متن یادآور"),
          h("input", {
            value: text,
            maxLength: 300,
            dir: "auto",
            onChange: (event) => setText(event.target.value),
            "aria-label": t("Reminder text", "متن یادآور"),
          }),
        ),
        h(
          "label",
          null,
          t("Repeat", "تکرار"),
          h(
            "select",
            {
              value: repeat,
              onChange: (event) => setRepeat(event.target.value),
            },
            h("option", { value: "once" }, t("This day only", "فقط این روز")),
            h("option", { value: "weekly" }, t("Every week", "هر هفته")),
            h(
              "option",
              { value: "alternate" },
              t("Every other day", "یک روز در میان"),
            ),
          ),
        ),
        h(
          "button",
          { type: "submit", className: "btn", disabled: !text.trim() },
          t("Save reminder", "ثبت یادآور"),
        ),
      ),
    ),
  );
}
function DDReviewDay({
  React: R,
  data,
  date,
  today,
  language,
  setData,
  onOpenPlan,
  onToggleTask,
  onMoveTask,
  parseTask,
  onScheduleReminder,
  classify,
  onToast,
  RowTools,
  effectsFor,
  feelingsOnly = false,
  playful,
  PanelIcon,
  onOpenFeelings,
}) {
  const { h, t, n } = DDreviewUI(R, language),
    day = data.days[date] || DDreviewEmptyDay(date),
    summary = DDreviewSummary(day, data.setup),
    worries = (data.setup.worries || []).filter(
      (item) => item.createdAt === date,
    ),
    id = feelingsOnly ? "dd-feelings-day" : "dd-calendar-day";
  return h(
    "section",
    {
      className: "dd-review-day",
      id,
      "aria-label": t("Selected day details", "جزئیات روز انتخاب‌شده"),
    },
    h(
      "header",
      { className: "dd-review-day-heading" },
      h(
        "div",
        null,
        h(
          "small",
          null,
          date === today
            ? t("Today", "امروز")
            : t("Selected day", "روز انتخاب‌شده"),
        ),
        h("h2", { "aria-live": "polite" }, DDreviewDateLabel(date, language)),
        h("time", { dateTime: date, dir: "ltr" }, date),
      ),
      h(
        "button",
        {
          type: "button",
          className: "dd-review-text-button",
          onClick: (event) =>
            event.currentTarget
              .closest(".dd-review-root")
              .querySelector(".dd-review-calendar")
              ?.scrollIntoView({ block: "start" }),
        },
        t("Back to calendar", "برگشت به تقویم"),
      ),
    ),
    !feelingsOnly &&
      h(
        R.Fragment,
        null,
        h(
          "div",
          { className: "dd-review-overview" },
          h("h2", null, t("Day overview", "خلاصهٔ روز")),
          h(
            "dl",
            null,
            h(
              "div",
              null,
              h("dt", null, t("Tasks done", "کارهای انجام‌شده")),
              h(
                "dd",
                null,
                n(summary.completed),
                t(" of ", " از "),
                n(summary.tasks),
              ),
            ),
            h(
              "div",
              null,
              h("dt", null, t("Planned time", "زمان برنامه")),
              h("dd", null, DDduration(summary.plannedMinutes, language)),
              h("dd", { className: "dd-day-progress", title: DDprogressLabel(language), "data-completion": summary.completionPct }, t("Progress ", "پیشرفت "), n(summary.completionPct), "%"),
            ),
            // Feelings left the app in 5.16; old ones still show here.
            summary.feelings > 0 &&
              h(
                "div",
                null,
                h("dt", null, t("Feelings & events", "احساسات و اتفاق‌ها")),
                h("dd", null, n(summary.feelings)),
              ),
            day.focus &&
              h(
                "div",
                { className: "dd-review-focus" },
                h("dt", null, t("Focus", "تمرکز")),
                h("dd", { dir: "auto" }, day.focus),
              ),
          ),
        ),
      ),
    playful && h(playful.DayStickers, { day, date, onChange: fn => setData(old => ({...old, days: {...old.days, [date]: fn(old.days[date] || DDreviewEmptyDay(date))}})) }),
    !feelingsOnly &&
      h(DDReviewTasks, {
        React: R,
        playful,
        data,
        date,
        language,
        setData,
        onOpenPlan,
        onToggleTask,
        onMoveTask,
        parseTask,
        onToast,
      }),
    feelingsOnly
      ? h(DDFeelingsPanel, {
          playful,
          React: R,
          data,
          date,
          language,
          setData,
          classify,
          onToast,
          RowTools,
          effectsFor,
          PanelIcon,
        })
      : null, // Feelings were removed from the app (5.16); old entries stay in the data.
    feelingsOnly &&
      worries.length > 0 &&
      h(
        "section",
        { className: "dd-review-worries" },
        h(
          "h2",
          null,
          t("Worries parked on this day", "نگرانی‌های ثبت‌شده در این روز"),
        ),
        h(
          "p",
          null,
          t(
            "Worries stay in Worry parking across days.",
            "این نگرانی‌ها در جای نگرانی‌ها می‌مانند و به روز بعد هم دسترسی داری.",
          ),
        ),
        worries.map((item) => h("p", { key: item.id, dir: "auto" }, item.text)),
        h(
          "button",
          {
            type: "button",
            className: "btn",
            onClick: () =>
              window.dispatchEvent(
                new CustomEvent("debug-day-open-capture", { detail: "worry" }),
              ),
          },
          t("Open Worry parking", "باز کردن جای نگرانی‌ها"),
        ),
      ),
    !feelingsOnly &&
      h(DDReviewReminders, {
        React: R,
        data,
        date,
        language,
        setData,
        onScheduleReminder,
        onToast,
      }),
    feelingsOnly
      ? h(
          "section",
          { className: "dd-review-notes" },
          h("h2", null, t("Day note", "یادداشت روز")),
          h("textarea", {
            value: day.journal || "",
            rows: 3,
            maxLength: 4000,
            dir: "auto",
            "aria-label": t("Day note", "یادداشت روز"),
            placeholder: t(
              "Anything you want to remember about this day…",
              "هر چیزی که می‌خواهی از این روز یادت بماند…",
            ),
            onChange: (event) => {
              const value = event.target.value;
              setData((old) => DDreviewField(old, date, "journal", value));
            },
          }),
          h(
            "small",
            null,
            t("Changes save automatically.", "تغییرات خودکار ذخیره می‌شوند."),
          ),
          day.notes.length > 0 &&
            h(
              "details",
              null,
              h(
                "summary",
                null,
                t("Notes saved on the board", "نوت‌های ثبت‌شده در برد"),
                " · ",
                n(day.notes.length),
              ),
              day.notes.map((note) =>
                h("p", { key: note.id, dir: "auto" }, note.kind === "emoji" && playful ? h(playful.Emoji, { emoji: note.text, size: 42 }) : note.label || note.text || DDmediaTitle(note), DDnoteTags(note).length > 0 && h("small", { className: "dd-review-note-tags" }, DDtagText(DDnoteTags(note)))),
              ),
            ),
        )
      : (day.journal || day.notes.length > 0) &&
        h(
          "section",
          { className: "dd-review-notes brief" },
          h("h2", null, t("Day note", "یادداشت روز")),
          day.journal &&
            h("p", { className: "dd-review-note-text", dir: "auto" }, day.journal),
          day.notes.length > 0 &&
            h(
              "details",
              null,
              h(
                "summary",
                null,
                t("Notes saved on the board", "نوت‌های ثبت‌شده در برد"),
                " · ",
                n(day.notes.length),
              ),
              day.notes.map((note) =>
                h("p", { key: note.id, dir: "auto" }, note.kind === "emoji" && playful ? h(playful.Emoji, { emoji: note.text, size: 42 }) : note.label || note.text || DDmediaTitle(note), DDnoteTags(note).length > 0 && h("small", { className: "dd-review-note-tags" }, DDtagText(DDnoteTags(note)))),
              ),
            ),
        ),
  );
}
// Calendar, Feelings and Stats share one panel: one tab in the header and
// three sections inside it. The month grid sits beside the day on wide screens.
export const DDcalendarSections = [
  ["day", "calendar", "Day", "روز"],
  ["stats", "stats", "Stats", "آمار"],
];
export function DDCalendarView(props) {
  const { React: R, language, feelingsOnly = false, onSection, sections } = props,
    section = props.section || (feelingsOnly ? "feelings" : "day"),
    { h, t } = DDreviewUI(R, language),
    parts = DDcalendarSections.filter(([id]) => !sections || sections.includes(id)),
    feelings = section === "feelings";
  return h(
    "div",
    {
      className: "dd-review-root",
      "data-section": section,
      dir: language === "fa" ? "rtl" : "ltr",
      "data-panel": parts.find(([id]) => id === section)?.[1] || "calendar",
    },
    h(
      "header",
      { className: "dd-review-page-heading" },
      h(
        "div",
        null,
        h(
          "h1",
          null,
          props.PanelIcon && h(props.PanelIcon, { React: R, id: "calendar" }),
          t("Calendar", "تقویم"),
        ),
        h(
          "p",
          null,
          t(
            "Your days and the patterns across them.",
            "روزهایت و الگوهایی که در آن‌ها تکرار می‌شود.",
          ),
        ),
      ),
      onSection &&
        parts.length > 1 &&
        h(
          "div",
          {
            className: "dd-review-sections",
            role: "tablist",
            "aria-label": t("Calendar sections", "بخش‌های تقویم"),
          },
          parts.map(([id, panel, en, fa]) =>
            h(
              "button",
              {
                key: id,
                type: "button",
                role: "tab",
                "data-panel": panel,
                "aria-selected": section === id,
                onClick: () => onSection(id),
              },
              props.PanelIcon && h(props.PanelIcon, { React: R, id: panel }),
              t(en, fa),
            ),
          ),
        ),
    ),
    section === "stats"
      ? h("div", { className: "dd-review-stats" }, props.stats)
      : h(
          "div",
          { className: "dd-review-columns" },
          h(DDReviewCalendar, {
            ...props,
            feelingsOnly: feelings,
            onSelect: props.onSelectDay,
            panelId: feelings ? "dd-feelings-day" : "dd-calendar-day",
          }),
          h(DDReviewDay, { ...props, feelingsOnly: feelings }),
        ),
  );
}
