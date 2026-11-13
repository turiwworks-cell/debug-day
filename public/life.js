// Optional scheduling and a gentle pause when the day changes unexpectedly.
import { DDduration } from "./measure.js";
import { DDcleanBoard } from "./search.js";
import { DDaddDays, DDvalidDate } from "./dates.js";
export function DDvalidAnchor(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
const DDlifeDate = DDvalidDate, DDlifeShift = (date) => DDaddDays(date, 1);
function DDlifeSubRefs(items, blockId) {
  return (items || []).flatMap((item) => [
    "sub:" + blockId + ":" + item.id,
    ...DDlifeSubRefs(item.children, blockId),
  ]);
}
function DDlifeCleanBoard(day, blocks) {
  DDcleanBoard(
    day,
    blocks.flatMap((block) => [
      "b:" + block.id,
      ...DDlifeSubRefs(block.subtasks, block.id),
    ]),
  );
}
function DDappendDayBlock(day, block) {
  const copy = structuredClone(block);
  if (day.blocks.some((b) => b.id === copy.id)) copy.id = crypto.randomUUID();
  delete copy.bx;
  delete copy.by;
  day.blocks.push(copy);
  return copy;
}
export function DDscheduleLater(snapshot, id, date, ensureDay) {
  if (!DDlifeDate(date)) return snapshot;
  const data = structuredClone(snapshot),
    block = (data.setup.later || []).find((b) => b.id === id);
  if (!block) return snapshot;
  const day =
    data.days[date] || (data.days[date] = structuredClone(ensureDay(date)));
  DDappendDayBlock(day, block);
  data.setup.later = data.setup.later.filter((b) => b.id !== id);
  return data;
}
export function DDbeginPause(
  snapshot,
  date,
  wasRunning,
  ensureDay,
  label = "Outside event",
) {
  const data = structuredClone(snapshot),
    day =
      data.days[date] || (data.days[date] = structuredClone(ensureDay(date)));
  if (day.pause?.active) return snapshot;
  const id = crypto.randomUUID();
  day.pause = {
    active: true,
    closed: false,
    at: new Date().toISOString(),
    wasRunning: !!wasRunning,
    eventId: id,
  };
  day.bugs ||= [];
  day.bugs.push({
    id,
    text: label,
    type: "",
    on: "",
    fixed: false,
    category: "plan",
    triggerTag: "outside-event",
    antidote: "",
  });
  return data;
}
export function DDresolvePause(snapshot, date, choice, ensureDay) {
  if (!["continue", "move", "close"].includes(choice)) return snapshot;
  const data = structuredClone(snapshot),
    day = data.days[date];
  if (!day?.pause) return snapshot;
  if (choice === "move") {
    const pending = day.blocks.filter((block) => !block.done),
      tomorrow = DDlifeShift(date);
    if (pending.length) {
      const target =
        data.days[tomorrow] ||
        (data.days[tomorrow] = structuredClone(ensureDay(tomorrow)));
      for (const block of pending) DDappendDayBlock(target, block);
      day.blocks = day.blocks.filter((block) => block.done);
      DDlifeCleanBoard(day, pending);
    }
  }
  const event = (day.bugs || []).find((bug) => bug.id === day.pause.eventId);
  if (event) event.fixed = true;
  day.pause.active = false;
  day.pause.closed = choice !== "continue";
  return data;
}
const DDlifeIcons = {
  tray: "M2 9.5h3.5l1 2h3l1-2H14M2 9.5 4 3.5h8l2 6V13H2z",
  pause: "M6 4v8M10 4v8",
};
function DDlifeIcon(h, name) {
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
    h("path", { d: DDlifeIcons[name] }),
  );
}
export function DDLifeTools({
  React: R,
  data,
  day,
  date,
  today,
  language,
  view,
  setData,
  ensureDay,
  parseTask,
  onPause,
  onResume,
  timer,
  onToast,
}) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, fr) => (fa ? fr : en);
  const [panel, setPanel] = R.useState(null),
    [text, setText] = R.useState(""),
    [target, setTarget] = R.useState(today),
    [armed, setArmed] = R.useState(null),
    [error, setError] = R.useState("");
  const dialog = R.useRef(null),
    entry = R.useRef(null),
    opener = R.useRef(null),
    pauseRef = R.useRef(null),
    later = data.setup.later || [],
    paused = !!day.pause?.active,
    closed = !!day.pause?.closed;
  R.useEffect(() => {
    document.body.classList.toggle(
      "dd-day-paused",
      (paused || closed) && (view === "plan" || view === "board"),
    );
    if (paused || closed) onPause();
    return () => document.body.classList.remove("dd-day-paused");
  }, [paused, closed, view, timer.running]);
  R.useEffect(() => {
    const open = (event) => {
      if (event.detail === "later") setPanel("later");
      if (event.detail === "resume") setPanel("pause");
      if (event.detail === "pause") pauseRef.current?.();
    };
    window.addEventListener("debug-day-open-capture", open);
    return () => window.removeEventListener("debug-day-open-capture", open);
  }, []);
  R.useEffect(() => {
    if (!panel) return;
    opener.current = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (entry.current || dialog.current?.querySelector("button"))?.focus();
    return () => {
      document.body.style.overflow = old;
      opener.current?.isConnected && opener.current.focus();
    };
  }, [panel]);
  function pause() {
    if (!paused && !closed)
      setData((old) =>
        DDbeginPause(
          old,
          date,
          timer.running,
          ensureDay,
          t("Outside event", "اتفاق خارج از برنامه"),
        ),
      );
    onPause();
    setPanel("pause");
  }
  pauseRef.current = pause;
  function resolve(choice) {
    const resume = day.pause?.wasRunning;
    setData((old) => DDresolvePause(old, date, choice, ensureDay));
    if (choice === "continue" && resume) onResume();
    setPanel(null);
    onToast(
      choice === "move"
        ? t(
            "Remaining tasks moved to tomorrow",
            "کارهای باقی‌مانده به فردا منتقل شدند",
          )
        : choice === "close"
          ? t(
              "Today is closed. Your tasks are kept.",
              "امروز بسته شد. کارهایت حفظ شده‌اند.",
            )
          : t("Continue at your own pace", "با ریتم خودت ادامه بده"),
    );
  }
  function add(event) {
    event.preventDefault();
    if (!text.trim()) return;
    const task = parseTask(text, { blocks: later });
    if (!task) return;
    setData((old) => ({
      ...old,
      setup: { ...old.setup, later: [...(old.setup.later || []), task] },
    }));
    setText("");
    entry.current?.focus();
  }
  function edit(id, patch) {
    setData((old) => ({
      ...old,
      setup: {
        ...old.setup,
        later: (old.setup.later || []).map((block) =>
          block.id === id ? { ...block, ...patch } : block,
        ),
      },
    }));
  }
  function schedule(id, d) {
    if (!DDlifeDate(d)) {
      setError(t("Choose a valid date", "یک تاریخ معتبر انتخاب کن"));
      return;
    }
    setData((old) => DDscheduleLater(old, id, d, ensureDay));
    setError("");
    onToast(t("Task scheduled", "کار زمان‌بندی شد"));
  }
  function remove(id) {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setData((old) => ({
      ...old,
      setup: {
        ...old.setup,
        later: (old.setup.later || []).filter((block) => block.id !== id),
      },
    }));
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
        ...dialog.current.querySelectorAll("button,input,select,summary"),
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
  return h(
    "section",
    { className: "dd-life-root", dir: fa ? "rtl" : "ltr" },
    h(
      "div",
      { className: "dd-life-bar" },
      h(
        "button",
        {
          type: "button",
          className: "dd-pill" + (later.length ? "" : " dd-quiet"),
          title: t(
            "Tasks that don't have a day yet",
            "کارهایی که هنوز روز مشخصی ندارند",
          ),
          onClick: () => setPanel("later"),
        },
        DDlifeIcon(h, "tray"),
        t("Park", "پارک"),
        later.length > 0 && h("b", { className: "dd-count" }, later.length),
      ),
      (view === "plan" || view === "board") &&
        h(
          "button",
          {
            type: "button",
            className: "dd-pill" + (paused || closed ? " on" : ""),
            title: t(
              "Pause the timer and choose what to do with the rest of the day",
              "زمان‌سنج را نگه دار و برای بقیهٔ روز تصمیم بگیر",
            ),
            onClick: pause,
          },
          DDlifeIcon(h, "pause"),
          paused
            ? t("Day paused", "روز متوقف است")
            : closed
              ? t("Today is closed", "امروز بسته است")
              : t("Pause the day", "روز را نگه دار"),
        ),
    ),
    (paused || closed) &&
      (view === "plan" || view === "board") &&
      h(
        "div",
        { className: "dd-pause-status", role: "status" },
        h(
          "p",
          null,
          closed
            ? t(
                "Today is closed. Remaining tasks are kept, without marking them done.",
                "امروز بسته است. کارهای باقی‌مانده حفظ شده‌اند و انجام‌شده حساب نشده‌اند.",
              )
            : t(
                "The timer is paused. Choose what would help now.",
                "زمان‌سنج متوقف است. هر گزینه‌ای که الان کمک می‌کند انتخاب کن.",
              ),
        ),
        h(
          "button",
          {
            type: "button",
            className: "btn",
            onClick: () => setPanel("pause"),
          },
          t("Choose next step", "انتخاب قدم بعدی"),
        ),
      ),
    panel &&
      h(
        "div",
        { className: "dd-capture-backdrop", onClick: () => setPanel(null) },
        h(
          "div",
          {
            className: "dd-capture-dialog dd-life-dialog",
            ref: dialog,
            role: "dialog",
            "aria-modal": true,
            "aria-label":
              panel === "pause"
                ? t("Pause the day", "روز را نگه دار")
                : t("Park", "پارک"),
            onClick: (e) => e.stopPropagation(),
            onKeyDown: key,
          },
          h(
            "header",
            null,
            h(
              "h2",
              null,
              panel === "pause"
                ? t("Pause the day", "روز را نگه دار")
                : t("Park", "پارک"),
            ),
            h(
              "button",
              {
                type: "button",
                "aria-label": t("Close day tools", "بستن ابزارهای روز"),
                onClick: () => setPanel(null),
              },
              "×",
            ),
          ),
          panel === "pause"
            ? h(
                "div",
                { className: "dd-pause-choices" },
                h(
                  "p",
                  null,
                  t(
                    "You can change the plan. Nothing here needs to be earned back.",
                    "می‌توانی برنامه را تغییر بدهی. لازم نیست چیزی را جبران کنی.",
                  ),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn solid",
                    onClick: () => resolve("continue"),
                  },
                  t("Continue the day", "ادامهٔ روز"),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn",
                    onClick: () => resolve("move"),
                  },
                  t("Move the rest to tomorrow", "انتقال باقی‌مانده به فردا"),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn",
                    onClick: () => resolve("close"),
                  },
                  t("Close today, keep the tasks", "بستن امروز و حفظ کارها"),
                ),
              )
            : h(
                "div",
                { className: "dd-later-list" },
                h(
                  "p",
                  null,
                  t(
                    "Tasks without a day. Schedule them when they belong somewhere.",
                    "کارهایی که هنوز روزی ندارند. هر وقت مناسب بود برایشان روز انتخاب کن.",
                  ),
                ),
                h(
                  "form",
                  { onSubmit: add, className: "dd-later-add" },
                  h("input", {
                    ref: entry,
                    value: text,
                    onChange: (e) => setText(e.target.value),
                    dir: "auto",
                    maxLength: 4000,
                    "aria-label": t("Parked task", "کار پارک‌شده"),
                    placeholder: t("Something not for today…", "کاری که برای امروز نیست…"),
                  }),
                  h(
                    "button",
                    {
                      type: "submit",
                      className: "btn solid",
                      disabled: !text.trim(),
                    },
                    t("Park it", "پارکش کن"),
                  ),
                ),
                h(
                  "label",
                  { className: "dd-later-date" },
                  t("Schedule date", "روز زمان‌بندی"),
                  h("input", {
                    type: "date",
                    value: target,
                    onChange: (e) => setTarget(e.target.value),
                    "aria-label": t("Schedule date", "روز زمان‌بندی"),
                  }),
                ),
                error && h("p", { role: "alert" }, error),
                !later.length &&
                  h(
                    "p",
                    null,
                    t("Park is empty.", "پارک خالی است."),
                  ),
                later.map((block) =>
                  h(
                    "article",
                    { key: block.id, className: "dd-later-item" },
                    h("h3", { dir: "auto" }, block.name),
                    h(
                      "small",
                      null,
                      block.at ? block.at + " · " : "",
                      DDduration(block.min, language),
                    ),
                    h(
                      "details",
                      null,
                      h("summary", null, t("Task options", "گزینه‌های کار")),
                      h(
                        "label",
                        null,
                        t("Name", "نام"),
                        h("input", {
                          value: block.name,
                          dir: "auto",
                          onChange: (e) =>
                            edit(block.id, { name: e.target.value }),
                          "aria-label": t("Parked task name", "نام کار پارک‌شده"),
                        }),
                      ),
                      h(
                        "label",
                        null,
                        t("Minutes", "دقیقه"),
                        h("input", {
                          type: "number",
                          min: 5,
                          max: 720,
                          step: 5,
                          value: block.min,
                          onChange: (e) => {
                            const value = +e.target.value;
                            if (
                              Number.isFinite(value) &&
                              value >= 5 &&
                              value <= 720
                            )
                              edit(block.id, { min: value });
                          },
                          "aria-label": t(
                            "Parked task minutes",
                            "مدت کار پارک‌شده",
                          ),
                        }),
                      ),
                      h(
                        "label",
                        null,
                        t("Lane", "بخش"),
                        h(
                          "select",
                          {
                            value: block.lane,
                            onChange: (e) =>
                              edit(block.id, { lane: e.target.value }),
                          },
                          data.setup.lanes.map((lane) =>
                            h(
                              "option",
                              { value: lane.id, key: lane.id },
                              lane.name,
                            ),
                          ),
                        ),
                      ),
                      h(
                        "label",
                        null,
                        t("Anchor time (optional)", "ساعت ثابت (اختیاری)"),
                        h("input", {
                          type: "time",
                          value: block.at || "",
                          onChange: (e) =>
                            edit(block.id, { at: e.target.value }),
                          "aria-label": t(
                            "Parked task anchor time",
                            "ساعت ثابت کار پارک‌شده",
                          ),
                        }),
                      ),
                    ),
                    h(
                      "div",
                      { className: "dd-later-actions" },
                      h(
                        "button",
                        {
                          type: "button",
                          onClick: () => schedule(block.id, today),
                        },
                        t("Schedule today", "برای امروز"),
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          onClick: () => schedule(block.id, DDlifeShift(today)),
                        },
                        t("Schedule tomorrow", "برای فردا"),
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          onClick: () => schedule(block.id, target),
                        },
                        t(
                          "Schedule for selected date",
                          "برای تاریخ انتخاب‌شده",
                        ),
                      ),
                      h(
                        "button",
                        { type: "button", onClick: () => remove(block.id) },
                        armed === block.id
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
