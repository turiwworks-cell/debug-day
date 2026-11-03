// Quick capture, permanent worry parking and the phone's quiet Today view.
import { DDTimerMini } from "./timer.js";
import { DDduration } from "./measure.js";
import { DDlifeState, DDlifeAdd } from "./life-board.js";
function DDcaptureDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false;
  const value = new Date(date + "T12:00:00Z");
  return (
    +date.slice(0, 4) >= 1900 &&
    Number.isFinite(+value) &&
    value.toISOString().slice(0, 10) === date
  );
}
export function DDworry(text, date, tag = "general-friction") {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: date,
    closed: false,
    tag,
    convertedTo: "",
  };
}
// An idea goes to the Feed, into one "Inbox" section that is made the first
// time it is needed. Renaming or moving the section keeps it the Inbox.
export const DDinboxId = "lf-inbox";
export function DDcaptureIdea(snapshot, text, date) {
  const words = String(text || "").trim();
  if (!words || !DDcaptureDate(date)) return snapshot;
  const data = structuredClone(snapshot),
    state = DDlifeState(data.setup);
  let items = state.items;
  if (!items.some((i) => i.id === DDinboxId && i.type === "section"))
    items = DDlifeAdd(items, { id: DDinboxId, type: "section", text: "Inbox", color: "#FFFFFF" });
  items = DDlifeAdd(items, {
    id: "lf-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3),
    type: "sticky",
    parent: DDinboxId,
    text: words.slice(0, 4000),
    at: date,
    color: "#FFE299",
  });
  data.setup.life = { ...state, items };
  return data;
}

export function DDcaptureItem(
  snapshot,
  { kind, text, date, tag = "general-friction" },
  ensureDay,
  parseTask,
) {
  const unscheduled = kind === "task" && date === "later";
  if (!text.trim() || (!unscheduled && !DDcaptureDate(date))) return snapshot;
  const data = structuredClone(snapshot);
  if (kind === "worry") {
    data.setup.worries ||= [];
    data.setup.worries.unshift(DDworry(text, date, tag));
    return data;
  }
  if (kind === "task" && date === "later") {
    data.setup.later ||= [];
    const task = parseTask(text, { blocks: data.setup.later });
    if (!task) return snapshot;
    data.setup.later.push(task);
    return data;
  }
  if (!DDcaptureDate(date)) return snapshot;
  const day =
    data.days[date] || (data.days[date] = structuredClone(ensureDay(date)));
  if (kind === "task") {
    const block = parseTask(text, day);
    if (!block) return snapshot;
    day.blocks.push(block);
  } else if (kind === "feeling")
    day.bugs.push({
      id: crypto.randomUUID(),
      text: text.trim(),
      type: "",
      on: "",
      fixed: false,
      category: "inner",
      triggerTag: tag,
      antidote: "",
    });
  else return snapshot;
  return data;
}
export function DDcaptureLane(task, lane, text, lanes = [], blocks = []) {
  if (!task || !lane || !lanes.some((l) => l.id === lane)) return task;
  const typed = (" " + text + " ").match(/\s@(\S+)(?=\s)/);
  if (
    typed &&
    lanes.some((l) =>
      (l.name || "").toLowerCase().startsWith(typed[1].toLowerCase()),
    )
  )
    return task;
  if (task.lane === lane) return task;
  const same = blocks.filter((b) => b.lane === lane),
    tagged = /(?:^|\s)#\S/.test(text);
  return {
    ...task,
    lane,
    type: !tagged && same.length ? same.at(-1).type : task.type,
  };
}
export function DDconvertWorry(snapshot, id, date, ensureDay) {
  if (date !== "later" && !DDcaptureDate(date)) return snapshot;
  const data = structuredClone(snapshot),
    worry = (data.setup.worries || []).find((w) => w.id === id);
  if (!worry || worry.convertedTo) return snapshot;
  const block = {
    id: crypto.randomUUID(),
    name: worry.text,
    type:
      data.setup.types.find((t) => t.id === "other")?.id ||
      data.setup.types[0]?.id ||
      "other",
    lane:
      data.setup.lanes.find((l) => l.id === "life")?.id ||
      data.setup.lanes[0]?.id ||
      "",
    min: 30,
    note: "",
    pri: 0,
    emo: "",
    done: false,
    expanded: false,
    subtasks: [],
  };
  if (date === "later") {
    data.setup.later ||= [];
    data.setup.later.push(block);
  } else {
    const day =
      data.days[date] || (data.days[date] = structuredClone(ensureDay(date)));
    day.blocks.push(block);
  }
  worry.closed = true;
  worry.convertedTo = date + "|" + block.id;
  return data;
}
export function DDdaysWithWorries(days, worries = []) {
  if (!worries.length) return days;
  const result = { ...days };
  for (const worry of worries) {
    const date = worry.createdAt;
    if (!DDcaptureDate(date)) continue;
    const day = result[date] || { date, blocks: [], notes: [], bugs: [] };
    result[date] = {
      ...day,
      bugs: [
        ...(day.bugs || []),
        {
          id: "worry:" + worry.id,
          text: worry.text,
          type: "",
          fixed: !!worry.closed,
          category: "inner",
          triggerTag: worry.tag || "general-friction",
          antidote: "",
        },
      ],
    };
  }
  return result;
}
const DDcaptureIcons = {
  cloud:
    "M4.6 12.5h6.9a3 3 0 0 0 .4-6A4.2 4.2 0 0 0 4 5.6a3.5 3.5 0 0 0 .6 6.9z",
  plus: "M8 3v10M3 8h10",
};
export function DDcaptureIcon(h, name) {
  return h(
    "svg",
    {
      className: "i",
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
    },
    h("path", { d: DDcaptureIcons[name] }),
  );
}
function DDcaptureLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function DDcaptureRemember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function DDcaptureTomorrow(date) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
function DDcaptureDone(items) {
  return (items || []).map((item) => ({
    ...item,
    done: true,
    children: DDcaptureDone(item.children),
  }));
}
export function DDCaptureTools({
  React: R,
  playful,
  data,
  day,
  date,
  today,
  language,
  view,
  isolated,
  setData,
  ensureDay,
  parseTask,
  classify,
  onOpenBlock,
  onFocus,
  onStopFocus,
  focusId,
  timer,
  onToast,
}) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, fr) => (fa ? fr : en),
    reviewingDay = view === "calendar" || view === "stats" || view === "insights",
    defaultCaptureDay = reviewingDay ? date : today;
  const [panel, setPanel] = R.useState(null),
    [kind, setKind] = R.useState(() => {
      const saved = DDcaptureLocal("debug-day:capture-kind", "task");
      return ["task", "idea", "worry"].includes(saved) ? saved : "task";
    }),
    [text, setText] = R.useState(""),
    [target, setTarget] = R.useState(today),
    [error, setError] = R.useState(""),
    [closed, setClosed] = R.useState(false),
    [armed, setArmed] = R.useState(null),
    [details, setDetails] = R.useState(() =>
      DDcaptureLocal("debug-day:today-details", false),
    ),
    [coarse, setCoarse] = R.useState(
      () => matchMedia("(pointer:coarse)").matches,
    ),
    [lane, setLane] = R.useState(() =>
      DDcaptureLocal("debug-day:capture-lane", ""),
    );
  const dialog = R.useRef(null),
    entry = R.useRef(null),
    trigger = R.useRef(null),
    opener = R.useRef(null);
  R.useEffect(() => {
    const media = matchMedia("(pointer:coarse)"),
      update = () => setCoarse(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  R.useEffect(() => {
    const simple =
      coarse && view === "plan" && date === today && !isolated && !details;
    document.body.classList.toggle("dd-phone-today", simple);
    return () => document.body.classList.remove("dd-phone-today");
  }, [coarse, view, date, today, isolated, details]);
  R.useEffect(() => {
    const open = (event) => {
      if (event.detail === "worry") setPanel("worries");
      else if (event.detail === "capture") {
        setTarget(defaultCaptureDay);
        setPanel("capture");
      } else if (event.detail === "full-day") {
        setDetails(true);
        DDcaptureRemember("debug-day:today-details", true);
      }
    };
    window.addEventListener("debug-day-open-capture", open);
    return () => window.removeEventListener("debug-day-open-capture", open);
  }, [defaultCaptureDay]);
  R.useEffect(() => {
    if (!panel) return;
    opener.current = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (entry.current || dialog.current?.querySelector("button"))?.focus();
    return () => {
      document.body.style.overflow = old;
      (opener.current?.isConnected ? opener.current : trigger.current)?.focus();
    };
  }, [panel]);
  const lanes = data.setup.lanes || [],
    chosenLane = lanes.some((l) => l.id === lane) ? lane : lanes[0]?.id || "",
    typedLane = (() => {
      const m = (" " + text + " ").match(/\s@(\S+)(?=\s)/);
      return m
        ? lanes.find((l) =>
            (l.name || "").toLowerCase().startsWith(m[1].toLowerCase()),
          )?.id
        : "";
    })(),
    shownLane = typedLane || chosenLane;
  function pickLane(id) {
    setLane(id);
    DDcaptureRemember("debug-day:capture-lane", id);
    entry.current?.focus();
  }
  const worries = data.setup.worries || [],
    openWorries = worries.filter((w) => !w.closed),
    pending = day.blocks.filter((b) => !b.done),
    current = pending.find((b) => b.id === focusId) || pending[0],
    next = pending[pending.indexOf(current) + 1];
  function toggleDetails() {
    setDetails((value) => {
      DDcaptureRemember("debug-day:today-details", !value);
      return !value;
    });
  }
  function save(event) {
    event.preventDefault();
    if (!text.trim()) return;
    if (kind === "idea") {
      setData((old) => DDcaptureIdea(old, text, today));
      setText("");
      setError("");
      setPanel(null);
      onToast(t("Saved to Inbox in the Feed", "در صندوق ورودی فید ذخیره شد"));
      return;
    }
    const captureDate = kind === "worry" ? today : target;
    const scope =
        target === "later"
          ? { blocks: data.setup.later || [] }
          : data.days[target] || ensureDay(target),
      task =
        kind === "task"
          ? DDcaptureLane(
              parseTask(text, scope),
              chosenLane,
              text,
              lanes,
              scope.blocks || [],
            )
          : null;
    if (kind === "task" && !task) {
      setError(t("Enter a task name", "نام کار را بنویس"));
      entry.current?.focus();
      return;
    }
    const tag = classify(text)?.triggerTag || "general-friction";
    setData((old) =>
      DDcaptureItem(
        old,
        { kind, text, date: captureDate, tag },
        ensureDay,
        () => task,
      ),
    );
    setText("");
    setError("");
    setPanel(null);
    onToast(t("Captured", "ثبت شد"));
  }
  function complete(block) {
    if (block.id === focusId && timer.running) onStopFocus?.();
    setData((old) => {
      const copy = structuredClone(old),
        d =
          copy.days[date] ||
          (copy.days[date] = structuredClone(ensureDay(date))),
        b = d.blocks.find((item) => item.id === block.id);
      if (b) {
        b.done = true;
        b.subtasks = DDcaptureDone(b.subtasks);
      }
      return copy;
    });
  }
  function worryAction(id, action) {
    setData((old) => {
      const copy = structuredClone(old),
        w = (copy.setup.worries || []).find((item) => item.id === id);
      if (!w) return old;
      if (action === "delete")
        copy.setup.worries = copy.setup.worries.filter(
          (item) => item.id !== id,
        );
      else w.closed = !w.closed;
      return copy;
    });
    setArmed(null);
  }
  function key(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setPanel(null);
    }
    if (event.key === "Tab") {
      const nodes = [
        ...dialog.current.querySelectorAll(
          'button,input,textarea,select,[tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
        event.preventDefault();
        nodes[0].focus();
      }
    }
  }
  function card(block, label) {
    const blocked = day.pause?.active || day.pause?.closed;
    return h(
      "article",
      { className: "dd-current-task", "data-playful-task": block?.id },
      h("small", null, label),
      block
        ? h(
            R.Fragment,
            null,
            h("h2", { dir: "auto" }, playful && block.emo && h("span", { "aria-hidden": true }, h(playful.Emoji, { emoji: block.emo, size: 32 })), block.name),
            h(
              "p",
              null,
              block.at && h("time", null, block.at + " · "),
              DDduration(block.min, language),
            ),
            label === t("Current", "کار فعلی") &&
              h(
                "div",
                { className: "dd-current-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn solid",
                    onClick: () =>
                      blocked
                        ? window.dispatchEvent(
                            new CustomEvent("debug-day-open-capture", {
                              detail: "resume",
                            }),
                          )
                        : onFocus(block),
                  },
                  blocked
                    ? t("Continue the day", "ادامهٔ روز")
                    : timer.running
                      ? t("Restart focus", "شروع دوبارهٔ تمرکز")
                      : t("Start focus", "شروع تمرکز"),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn",
                    "data-playful-complete": true,
                    onClick: () => complete(block),
                  },
                  t("Done", "انجام شد"),
                ),
              ),
            h(
              "button",
              {
                type: "button",
                className: "textbtn",
                onClick: () => {
                  setDetails(true);
                  DDcaptureRemember("debug-day:today-details", true);
                  onOpenBlock(block.id, date);
                },
              },
              t("Task details", "جزئیات کار"),
            ),
          )
        : null,
    );
  }
  function openCapture() {
    setKind("task");
    setTarget(today);
    setPanel("capture");
  }
  return h(
    "section",
    { className: "dd-capture-root", dir: fa ? "rtl" : "ltr" },
    view === "plan" &&
      date === today &&
      !isolated &&
      h(
        "div",
        { className: "dd-today-card" + (details ? " is-details" : "") },
        h(
          "div",
          { className: "dd-today-heading" },
          h("h2", null, t("Today", "امروز")),
          h(
            "button",
            {
              type: "button",
              className: "textbtn",
              onClick: toggleDetails,
              "aria-expanded": details,
            },
            details
              ? t("Back to Today", "بازگشت به امروز")
              : t("Full day / more", "روز کامل / بیشتر"),
          ),
        ),
        current
          ? card(current, t("Current", "کار فعلی"))
          : h(
              "div",
              { className: "dd-today-empty" },
              h(
                "p",
                null,
                day.blocks.length
                  ? t("Everything for today is done.", "کارهای امروز تمام شد.")
                  : t("Nothing planned for today yet.", "هنوز برای امروز کاری نیست."),
              ),
              h(
                "button",
                { type: "button", className: "btn", onClick: openCapture },
                "+ ",
                t("Add a task", "افزودن کار"),
              ),
            ),
        next &&
          !details &&
          h(
            "button",
            {
              type: "button",
              className: "dd-next-task",
              onClick: () => {
                setDetails(true);
                DDcaptureRemember("debug-day:today-details", true);
                onOpenBlock(next.id, date);
              },
            },
            h("small", null, t("Next", "کار بعدی")),
            h("span", { dir: "auto" }, next.name),
            h("em", null, DDduration(next.min, language)),
          ),
        playful && coarse && !details && h(playful.DayStickers, {day,date,onChange:fn=>setData(old=>({...old,days:{...old.days,[date]:fn(old.days[date]||day)}}))}),
        timer.running &&
          h(
            "p",
            {
              className: "dd-focus-clock",
              role: "timer",
              "aria-label": t("Focus time remaining", "زمان باقی‌ماندهٔ تمرکز"),
            },
            h(DDTimerMini, { React: R }),
          ),
      ),
    h(
      "div",
      { className: "dd-capture-bar" },
      h(
        "button",
        {
          type: "button",
          className: "dd-pill" + (openWorries.length ? "" : " dd-quiet"),
          title: t(
            "Put a worry down without turning it into work",
            "نگرانی را اینجا بگذار، بدون اینکه کار شود",
          ),
          onClick: () => setPanel("worries"),
        },
        DDcaptureIcon(h, "cloud"),
        t("Worry parking", "جای نگرانی‌ها"),
        openWorries.length > 0 &&
          h("b", { className: "dd-count" }, openWorries.length),
      ),
    ),
    h(
      "button",
      {
        type: "button",
        ref: trigger,
        className:
          "dd-floating-capture" + (view === "board" ? " dd-on-board" : ""),
        "aria-label": t("Quick capture", "ثبت سریع"),
        title: t(
          "Quick capture: a task, an idea or a worry",
          "ثبت سریع: کار، ایده یا نگرانی",
        ),
        onClick: () => {
          setTarget(defaultCaptureDay);
          setPanel("capture");
        },
      },
      h("span", { "aria-hidden": true }, "+"),
      h("span", { className: "dd-fab-label" }, t("Capture", "ثبت سریع")),
    ),
    panel &&
      h(
        "div",
        { className: "dd-capture-backdrop", onClick: () => setPanel(null) },
        h(
          "div",
          {
            ref: dialog,
            role: "dialog",
            "aria-modal": true,
            "aria-label":
              panel === "worries"
                ? t("Worry parking", "جای نگرانی‌ها")
                : t("Quick capture", "ثبت سریع"),
            className: "dd-capture-dialog",
            onClick: (e) => e.stopPropagation(),
            onKeyDown: key,
          },
          h(
            "header",
            null,
            h(
              "h2",
              null,
              panel === "worries"
                ? t("Worry parking", "جای نگرانی‌ها")
                : t("Capture", "ثبت سریع"),
            ),
            h(
              "button",
              {
                type: "button",
                "aria-label": t("Close capture", "بستن ثبت سریع"),
                onClick: () => setPanel(null),
              },
              "×",
            ),
          ),
          panel === "capture"
            ? h(
                "form",
                { onSubmit: save },
                h(
                  "div",
                  {
                    className: "dd-capture-kinds",
                    role: "group",
                    "aria-label": t("Capture type", "نوع ثبت"),
                  },
                  [
                    ["task", t("Task", "کار")],
                    ["idea", t("Idea", "ایده")],
                    ["worry", t("Worry", "نگرانی")],
                  ].map(([id, label]) =>
                    h(
                      "button",
                      {
                        type: "button",
                        key: id,
                        "aria-pressed": kind === id,
                        onClick: () => {
                          setKind(id);
                          DDcaptureRemember("debug-day:capture-kind", id);
                          if (id !== "task" && target === "later")
                            setTarget(defaultCaptureDay);
                          entry.current?.focus();
                        },
                      },
                      label,
                    ),
                  ),
                ),
                h("input", {
                  ref: entry,
                  dir: "auto",
                  value: text,
                  onChange: (e) => {
                    setText(e.target.value);
                    setError("");
                  },
                  maxLength: 4000,
                  "aria-label": t("Capture text", "متن ثبت"),
                  placeholder:
                    kind === "task"
                      ? t("One thing to do…", "یک کار برای انجام دادن…")
                      : kind === "idea"
                        ? t("An idea, a thought, a reference…", "یک ایده، یک فکر، یک رفرنس…")
                        : kind === "worry"
                        ? t("Leave the thought here…", "فکرت را همین‌جا بگذار…")
                        : t("What are you feeling?", "الان چه حسی داری؟"),
                }),
                kind === "task" &&
                  lanes.length > 1 &&
                  h(
                    "div",
                    {
                      className: "dd-capture-lanes",
                      role: "group",
                      "aria-label": t("Goes to", "کجا برود"),
                    },
                    h("span", null, t("Goes to", "کجا برود")),
                    lanes.map((l) =>
                      h(
                        "button",
                        {
                          type: "button",
                          key: l.id,
                          "aria-pressed": shownLane === l.id,
                          disabled: !!typedLane && typedLane !== l.id,
                          title: typedLane
                            ? t(
                                "Set by @ in the text",
                                "با @ در متن انتخاب شده",
                              )
                            : undefined,
                          onClick: () => pickLane(l.id),
                          style: l.color ? { "--lane": l.color } : undefined,
                        },
                        l.name || l.id,
                      ),
                    ),
                  ),
                kind === "idea" &&
                  h(
                    "p",
                    null,
                    t(
                      "It lands as a note in the Feed's Inbox section. Sort it into a section later.",
                      "به شکل یک نوت در سکشن Inbox فید می‌نشیند. بعداً هر وقت خواستی جابه‌جاش کن.",
                    ),
                  ),
                kind === "task" &&
                  h(
                    "label",
                    { className: "dd-capture-date" },
                    t("For", "برای"),
                    h(
                      "select",
                      {
                        value: target,
                        onChange: (e) => setTarget(e.target.value),
                        "aria-label": t("Capture day", "روز ثبت"),
                      },
                      h("option", { value: today }, t("Today", "امروز")),
                      reviewingDay &&
                        date !== today &&
                        date !== DDcaptureTomorrow(today) &&
                        h("option", { value: date }, t("Selected day", "روز انتخاب‌شده") + " · " + date),
                      h(
                        "option",
                        { value: DDcaptureTomorrow(today) },
                        t("Tomorrow", "فردا"),
                      ),
                      h(
                          "option",
                          { value: "later" },
                          t("Later / no day", "بعداً / بدون روز"),
                        ),
                    ),
                  ),
                kind === "worry" &&
                  h(
                    "p",
                    null,
                    t(
                      "This stays here across days. You can close it or turn it into a task later.",
                      "این مورد به روز خاصی وابسته نیست. هر وقت خواستی ببندش یا به یک کار تبدیلش کن.",
                    ),
                  ),
                error && h("p", { role: "alert" }, error),
                h(
                  "button",
                  {
                    type: "submit",
                    className: "btn solid",
                    disabled: !text.trim(),
                  },
                  t("Capture", "ثبت"),
                ),
                h(
                  "div",
                  { className: "dd-capture-bar" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "textbtn",
                      onClick: () => setPanel("worries"),
                    },
                    t("View parked worries", "دیدن نگرانی‌ها"),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "textbtn",
                      onClick: () => {
                        setPanel(null);
                        window.dispatchEvent(
                          new CustomEvent("debug-day-open-capture", {
                            detail: "later",
                          }),
                        );
                      },
                    },
                    t("Open Later tray", "باز کردن سبد بعداً"),
                  ),
                ),
              )
            : h(
                "div",
                { className: "dd-worry-list" },
                h(
                  "p",
                  null,
                  t(
                    "A place to put a worry down, without turning it into work.",
                    "جایی برای گذاشتن یک نگرانی، بدون اینکه لازم باشد فوراً کاری انجام بدهی.",
                  ),
                ),
                h(
                  "div",
                  { className: "dd-worry-head" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "btn",
                      onClick: () => {
                        setKind("worry");
                        setPanel("capture");
                      },
                    },
                    t("Add a worry", "ثبت نگرانی"),
                  ),
                  h(
                    "label",
                    null,
                    h("input", {
                      type: "checkbox",
                      checked: closed,
                      onChange: (e) => setClosed(e.target.checked),
                    }),
                    t("Show closed", "نمایش بسته‌شده‌ها"),
                  ),
                ),
                !(closed ? worries : openWorries).length &&
                  h(
                    "p",
                    null,
                    t("Nothing parked here.", "نگرانی‌ای اینجا ثبت نشده."),
                  ),
                (closed ? worries : openWorries).map((worry) =>
                  h(
                    "article",
                    { key: worry.id, className: "dd-worry-item" },
                    h("p", { dir: "auto" }, worry.text),
                    h(
                      "small",
                      null,
                      worry.createdAt,
                      worry.convertedTo
                        ? " · " + t("Converted to a task", "به کار تبدیل شده")
                        : "",
                    ),
                    h(
                      "div",
                      null,
                      !worry.convertedTo &&
                        h(
                          "button",
                          {
                            type: "button",
                            onClick: () =>
                              setData((old) =>
                                DDconvertWorry(old, worry.id, today, ensureDay),
                              ),
                          },
                          t("Make a task today", "تبدیل به کار امروز"),
                        ),
                      !worry.convertedTo &&
                        h(
                          "button",
                          {
                            type: "button",
                            onClick: () =>
                              setData((old) =>
                                DDconvertWorry(
                                  old,
                                  worry.id,
                                  DDcaptureTomorrow(today),
                                  ensureDay,
                                ),
                              ),
                          },
                          t("Make a task tomorrow", "تبدیل به کار فردا"),
                        ),
                      !worry.convertedTo &&
                        h(
                          "button",
                          {
                            type: "button",
                            onClick: () =>
                              setData((old) =>
                                DDconvertWorry(
                                  old,
                                  worry.id,
                                  "later",
                                  ensureDay,
                                ),
                              ),
                          },
                          t(
                            "Turn into a Later task",
                            "تبدیل به کار برای بعداً",
                          ),
                        ),
                      h(
                        "button",
                        {
                          type: "button",
                          onClick: () => worryAction(worry.id, "close"),
                        },
                        worry.closed
                          ? t("Reopen", "باز کردن")
                          : t("Close worry", "بستن نگرانی"),
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          onClick: () =>
                            armed === worry.id
                              ? worryAction(worry.id, "delete")
                              : setArmed(worry.id),
                        },
                        armed === worry.id
                          ? t("Confirm delete", "تأیید حذف")
                          : t("Delete", "حذف"),
                      ),
                    ),
                  ),
                ),
              ),
        ),
      ),
  );
}
