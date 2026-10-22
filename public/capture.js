// Quick capture, permanent worry parking and the phone's quiet Today view.
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
    t = (en, fr) => (fa ? fr : en);
  const [panel, setPanel] = R.useState(null),
    [kind, setKind] = R.useState("task"),
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
      else if (event.detail === "capture") setPanel("capture");
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
      (opener.current?.isConnected ? opener.current : trigger.current)?.focus();
    };
  }, [panel]);
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
    const captureDate = kind === "worry" ? today : target;
    const task =
      kind === "task"
        ? parseTask(
            text,
            target === "later"
              ? { blocks: data.setup.later || [] }
              : data.days[target] || ensureDay(target),
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
    return h(
      "article",
      { className: "dd-current-task" },
      h("small", null, label),
      block
        ? h(
            R.Fragment,
            null,
            h("h2", { dir: "auto" }, block.name),
            h(
              "p",
              null,
              block.at && h("time", null, block.at + " · "),
              block.min,
              t(" min", " دقیقه"),
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
                    onClick: () => onFocus(block),
                  },
                  timer.running
                    ? t("Restart focus", "شروع دوبارهٔ تمرکز")
                    : t("Start focus", "شروع تمرکز"),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "btn",
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
        : h(
            "p",
            null,
            t(
              "Nothing scheduled. Capture a task when you need one.",
              "کاری ثبت نشده. هر وقت لازم شد یک کار اضافه کن.",
            ),
          ),
    );
  }
  return h(
    "section",
    { className: "dd-capture-root", dir: fa ? "rtl" : "ltr" },
    view === "plan" &&
      date === today &&
      !isolated &&
      h(
        "div",
        { className: "dd-today-card" },
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
        card(current, t("Current", "کار فعلی")),
        card(next, t("Next", "کار بعدی")),
        timer.running &&
          h(
            "p",
            {
              className: "dd-focus-clock",
              role: "timer",
              "aria-label": t("Focus time remaining", "زمان باقی‌ماندهٔ تمرکز"),
            },
            Math.floor(timer.seconds / 60) +
              ":" +
              String(timer.seconds % 60).padStart(2, "0"),
          ),
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
        t("Worry parking", "جای نگرانی‌ها"),
        " · ",
        openWorries.length,
      ),
    ),
    h(
      "button",
      {
        type: "button",
        ref: trigger,
        className: "dd-floating-capture",
        "aria-label": t("Quick capture", "ثبت سریع"),
        onClick: () => {
          setTarget(today);
          setPanel("capture");
        },
      },
      h("span", { "aria-hidden": true }, "+"),
      t("Capture", "ثبت سریع"),
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
                    ["worry", t("Worry", "نگرانی")],
                    ["feeling", t("Feeling", "احساس")],
                  ].map(([id, label]) =>
                    h(
                      "button",
                      {
                        type: "button",
                        key: id,
                        "aria-pressed": kind === id,
                        onClick: () => {
                          setKind(id);
                          if (id !== "task" && target === "later")
                            setTarget(today);
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
                      : kind === "worry"
                        ? t("Leave the thought here…", "فکرت را همین‌جا بگذار…")
                        : t("What are you feeling?", "الان چه حسی داری؟"),
                }),
                kind !== "worry" &&
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
                      h(
                        "option",
                        { value: DDcaptureTomorrow(today) },
                        t("Tomorrow", "فردا"),
                      ),
                      kind === "task" &&
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
