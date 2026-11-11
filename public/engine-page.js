// The Engine page (5.50). Today, and the Park, with the day's steps in sight.
//
// It is the first tab, and it replaces the old Plan page: the Plan's tasks, its
// lanes and its details all live here now, calmer and more automatic. The Engine
// over the Board (E) still exists and opens this page's data the same way; the
// board's dimmed overlay is kept for the place you are already in.
//
// Every change goes through `onDay`, which writes the day the Board and Plan
// write, so what is ticked here is ticked everywhere (CLAUDE.md › 0).
import {
  DDengineToday,
  DDengineFilters,
  DDenginePlan,
  DDengineTotals,
  DDtaskSteps,
  DDstepAfter,
  DDstepRef,
  DDstepWaiting,
  DDtaskWaitsFor,
  DDtaskParked,
  DDparkTask,
  DDunparkTask,
  DDtaskTag,
  DDsetTaskTag,
  DDtagLook,
  DDtagSections,
  DDengineSteps,
  DDengineNotes,
  DDengineNote,
  DDpriorityOrder,
} from "./engine-today.js";
import { DDduration } from "./measure.js";
import { DDpriorityLabel } from "./planner.js";
import { DDsetTaskDone, DDtoggleSubtask } from "./search.js";

// Every page here is a plain function of (props, React): the app's bundle passes
// React as the second argument, so components read it with DDpageProps and build
// their own local `h` bound to it (module-level `h` is only a fallback).
const h = (type, props, ...children) => {
  if (!DDruntime) throw new Error("DD pages: render without React");
  return DDruntime.createElement(type, props, ...children);
};
let DDruntime = null;
const t = (fa, en, f) => (fa ? f : en);
const num = (fa, value) => Number(value || 0).toLocaleString(fa ? "fa-IR" : "en-US");

// The app's bundle hands React to a component as its second argument, so every
// component here reads its props and React the same way (see DDEnginePage).
function DDpageProps(args) {
  const props = args[0] || {},
    React =
      [props.React, ...args.slice(1)]
        .flatMap((candidate) => [candidate, candidate?.default, candidate?.React, candidate?.React?.default])
        .find((candidate) => candidate && typeof candidate.createElement === "function") || null;
  if (React) DDruntime = React;
  return { ...props, React };
}

// The three filters the Engine offers: All, Left, Done.
function FilterBar(...ddArgs) {
  const { React, value, counts, language, onChange } = DDpageProps(ddArgs);
  const fa = language === "fa";
  const labels = { all: t(fa, "All", "همه"), left: t(fa, "Left", "باقی‌مانده"), done: t(fa, "Done", "انجام‌شده") };
  return h(
    "div",
    { className: "dd-engine-filter", role: "group", "aria-label": t(fa, "Show", "نمایش") },
    DDengineFilters.map((id) =>
      h(
        "button",
        { key: id, type: "button", "aria-pressed": value === id, "data-filter": id, onClick: () => onChange(id) },
        labels[id],
        id === "all" ? h("small", null, num(fa, counts.total)) : null,
      ),
    ),
  );
}

// The section tag: a small pill at the top of a task. Clicking it opens the
// section's board; the ⌄ picks another section.
function TagPill(...ddArgs) {
  const { React, setup, from, language, onPick, onOpen } = DDpageProps(ddArgs);
  const fa = language === "fa",
    look = from ? DDtagLook(setup, from, language, 26) : null;
  return h(
    "span",
    { className: "dd-engine-tag", "data-empty": look ? undefined : "true" },
    look
      ? h(
          "button",
          {
            type: "button",
            className: "dd-engine-tag-open",
            dir: "auto",
            title: t(fa, "Go to ", "برو به ") + look.full,
            style: { background: look.fill, color: look.ink, borderColor: look.line },
            onClick: onOpen,
          },
          "↖ " + look.label,
        )
      : h("span", { className: "dd-engine-tag-none", "aria-hidden": true }, "↖"),
    h(
      "button",
      {
        type: "button",
        className: "dd-engine-tag-pick",
        "aria-label": t(fa, "Tag with a section", "برچسب سکشن"),
        title: t(fa, "Tag with a section", "برچسب سکشن"),
        onClick: onPick,
      },
      "⌄",
    ),
  );
}

// A picker over the Feed's sections, for a task's tag. Typing narrows it.
function TagPicker(...ddArgs) {
  const { React, setup, language, value, onChoose, onClose } = DDpageProps(ddArgs);
  const fa = language === "fa",
    [query, setQuery] = React.useState(""),
    sections = DDtagSections(setup, language),
    words = query.trim().toLowerCase(),
    shown = sections.filter((s) => !words || s.path.toLowerCase().includes(words));
  return h(
    "div",
    { className: "dd-engine-picker", role: "dialog", "aria-label": t(fa, "Sections", "سکشن‌ها") },
    h("input", {
      autoFocus: true,
      value: query,
      dir: "auto",
      placeholder: t(fa, "Find a section", "پیدا کردن سکشن"),
      "aria-label": t(fa, "Find a section", "پیدا کردن سکشن"),
      onChange: (event) => setQuery(event.target.value),
      onKeyDown: (event) => {
        event.stopPropagation();
        if (event.key === "Escape") onClose();
        if (event.key === "Enter" && shown[0]) onChoose(shown[0].id);
      },
    }),
    h(
      "button",
      { type: "button", className: "dd-engine-pick-none", "aria-pressed": !value, onClick: () => onChoose("") },
      t(fa, "No section", "بدون سکشن"),
    ),
    h(
      "ul",
      null,
      shown.map((section) =>
        h(
          "li",
          { key: section.id },
          h(
            "button",
            {
              type: "button",
              "aria-pressed": section.id === value,
              "data-section-tag": section.id,
              onClick: () => onChoose(section.id),
            },
            h("i", { "data-tint": section.tint, "aria-hidden": true, style: { paddingInlineStart: 8 * section.depth } }),
            h("span", { dir: "auto" }, section.path),
          ),
        ),
      ),
    ),
  );
}

// Steps of a task, folded inside it. Each step can be ticked, and can say what
// it waits for: another step, here or in another task, or a whole task.
function StepList(...ddArgs) {
  const { React, day, block, language, onDay, onPickAfter } = DDpageProps(ddArgs);
  const fa = language === "fa",
    steps = DDtaskSteps(block);
  if (!steps.length) return null;
  const toggle = (stepId) => onDay((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === block.id ? DDtoggleSubtask(b, stepId) : b)) }));
  return h(
    "ul",
    { className: "dd-engine-steps", "aria-label": t(fa, "Steps", "قدم‌ها") },
    steps.map((step) => {
      const waiting = DDstepWaiting(day, step),
        after = DDstepAfter(step);
      return h(
        "li",
        { key: step.id, "data-step": step.id, "data-done": step.done, "data-depth": step.depth, style: { "--depth": step.depth } },
        h(
          "button",
          {
            type: "button",
            className: "dd-engine-step-check",
            "aria-pressed": step.done,
            "aria-label": (step.done ? t(fa, "Mark not done: ", "برداشتن تیک: ") : t(fa, "Mark done: ", "تیک زدن: ")) + step.text,
            onClick: () => toggle(step.id),
          },
          step.done ? "✓" : "",
        ),
        h("span", { className: "dd-engine-step-text", dir: "auto" }, step.text),
        waiting.length
          ? h("span", { className: "dd-engine-step-wait", title: waiting.join(" · ") }, "⏳ " + num(fa, waiting.length))
          : null,
        h(
          "button",
          {
            type: "button",
            className: "dd-engine-step-after",
            "aria-label": t(fa, "Waits for", "منتظر"),
            title: t(fa, "Waits for", "منتظر"),
            onClick: () => onPickAfter(step, block),
          },
          after.length ? "↳" : "+",
        ),
      );
    }),
  );
}

// Which step or task a step waits for: pick it from the day's steps.
function AfterPicker(...ddArgs) {
  const { React, day, language, step, task, onChoose, onClose } = DDpageProps(ddArgs);
  const fa = language === "fa",
    [query, setQuery] = React.useState(""),
    words = query.trim().toLowerCase(),
    rows = DDengineSteps(day).filter(
      (row) => row.ref !== DDstepRef(task.id, step.id) && (!words || (row.text + " " + row.taskName).toLowerCase().includes(words)),
    ),
    current = DDstepAfter(step);
  return h(
    "div",
    { className: "dd-engine-picker", role: "dialog", "aria-label": t(fa, "Waits for", "منتظر") },
    h("input", {
      autoFocus: true,
      value: query,
      dir: "auto",
      placeholder: t(fa, "Find a step or task", "پیدا کردن قدم یا کار"),
      "aria-label": t(fa, "Find a step or task", "پیدا کردن قدم یا کار"),
      onChange: (event) => setQuery(event.target.value),
      onKeyDown: (event) => {
        event.stopPropagation();
        if (event.key === "Escape") onClose();
      },
    }),
    h(
      "ul",
      null,
      rows.map((row) =>
        h(
          "li",
          { key: row.ref },
          h(
            "button",
            {
              type: "button",
              "aria-pressed": current.includes(row.ref),
              "data-after-step": row.ref,
              onClick: () => onChoose(row.ref),
            },
            h("span", { dir: "auto" }, (row.text || t(fa, "Whole task", "کل کار")) + " · " + row.taskName),
            row.done ? h("small", null, "✓") : null,
          ),
        ),
      ),
      !rows.length ? h("li", { className: "dd-engine-picker-empty" }, t(fa, "Step or task not found.", "قدم یا کاری پیدا نشد.")) : null,
    ),
  );
}

// One task: tag, name, kind and time, its steps, and the small tools that stay
// quiet until the row is touched.
function TaskRow(...ddArgs) {
  const { React, day, block, setup, language, onDay, onOpenSection, onToast, wave } = DDpageProps(ddArgs);
  const fa = language === "fa",
    [open, setOpen] = React.useState(true),
    [tagging, setTagging] = React.useState(false),
    [after, setAfter] = React.useState(null),
    [renaming, setRenaming] = React.useState(false),
    steps = DDtaskSteps(block),
    doneSteps = steps.filter((s) => s.done).length,
    waiting = DDtaskWaitsFor(block),
    update = (fn) => onDay((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === block.id ? fn(b) : b)) }));
  const togglePark = () => {
    const parked = DDtaskParked(block);
    update((b) => (parked ? DDunparkTask(b) : DDparkTask(b)));
    setOpen(false);
    onToast?.(parked ? t(fa, "Back in Today", "به امروز برگشت") : t(fa, "Set aside in the Park", "در پارک گذاشته شد"));
  };
  return h(
    "li",
    {
      className: "dd-engine-row",
      "data-task": block.id,
      "data-done": !!block.done,
      "data-wave": wave,
      "data-parked": DDtaskParked(block),
      "data-steps": steps.length ? "open" : "none",
    },
    h(
      "div",
      { className: "dd-engine-row-head" },
      h(
        "button",
        {
          type: "button",
          className: "dd-engine-row-check",
          "aria-pressed": !!block.done,
          "aria-label": (block.done ? t(fa, "Mark not done: ", "برداشتن تیک: ") : t(fa, "Mark done: ", "تیک زدن: ")) + (block.name || ""),
          onClick: () => update((b) => DDsetTaskDone(b, !b.done)),
        },
        block.done ? "✓" : "",
      ),
      h(
        "div",
        { className: "dd-engine-row-main" },
        renaming
          ? h("input", {
              className: "dd-engine-row-name",
              defaultValue: block.name || "",
              autoFocus: true,
              dir: "auto",
              maxLength: 300,
              "aria-label": t(fa, "Task name", "نام کار"),
              onBlur: (event) => {
                const value = event.target.value.trim();
                setRenaming(false);
                if (value && value !== block.name) update((b) => ({ ...b, name: value }));
              },
              onKeyDown: (event) => {
                event.stopPropagation();
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.currentTarget.value = block.name || "";
                  event.currentTarget.blur();
                }
              },
            })
          : h(
              "button",
              { type: "button", className: "dd-engine-row-name-btn", dir: "auto", title: t(fa, "Rename", "تغییر نام"), onClick: () => setRenaming(true) },
              block.name || t(fa, "Untitled", "بی‌نام"),
            ),
        h(
          "div",
          { className: "dd-engine-row-meta" },
          h(TagPill, {
            React,
            setup,
            from: DDtaskTag(block),
            language,
            onOpen: () => onOpenSection(DDtaskTag(block)),
            onPick: () => setTagging(true),
          }),
          Number(block.min) > 0 ? h("span", { className: "dd-engine-row-min" }, DDduration(block.min, language)) : null,
          steps.length ? h("span", { className: "dd-engine-row-steps" }, num(fa, doneSteps) + "/" + num(fa, steps.length) + " " + t(fa, "steps", "قدم")) : null,
          block.pri ? h("span", { className: "dd-engine-row-pri", "data-pri": block.pri, title: DDpriorityLabel(block.pri, language) }, "P" + block.pri) : null,
          waiting.length ? h("span", { className: "dd-engine-row-wait", title: waiting.join(" · ") }, "↳ " + num(fa, waiting.length)) : null,
        ),
      ),
      h(
        "div",
        { className: "dd-engine-row-tools" },
        steps.length
          ? h(
              "button",
              { type: "button", className: "dd-engine-step-toggle", "aria-expanded": open, onClick: () => setOpen(!open) },
              open ? "▾" : "▸",
              h("span", null, t(fa, "Steps", "قدم‌ها")),
            )
          : null,
        h(
          "button",
          {
            type: "button",
            className: "dd-engine-park",
            title: DDtaskParked(block) ? t(fa, "Bring back to Today", "آوردن به امروز") : t(fa, "Set aside in the Park", "گذاشتن در پارک"),
            "aria-label": DDtaskParked(block) ? t(fa, "Bring back to Today", "آوردن به امروز") : t(fa, "Set aside in the Park", "گذاشتن در پارک"),
            onClick: togglePark,
          },
          DDtaskParked(block) ? "↑" : "↓",
        ),
        h(
          "button",
          {
            type: "button",
            className: "dd-engine-pri",
            title: DDpriorityLabel(block.pri || 0, language),
            "aria-label": t(fa, "Priority", "اولویت"),
            onClick: () => update((b) => ({ ...b, pri: ((Number(b.pri) || 0) + 1) % 4 })),
          },
          block.pri ? "P" + block.pri : "·",
        ),
      ),
    ),
    open ? h(StepList, { React, day, block, language, onDay, onPickAfter: (step) => setAfter(step) }) : null,
    tagging
      ? h(TagPicker, {
          React,
          setup,
          language,
          value: DDtaskTag(block),
          onChoose: (from) => {
            update((b) => DDsetTaskTag(b, from));
            setTagging(false);
          },
          onClose: () => setTagging(false),
        })
      : null,
    after ? h(AfterPicker, { React, day, language, step: after, task: block, onClose: () => setAfter(null), onChoose: (ref) => onToggleAfter(update, block, after, ref) }) : null,
  );
}

// Add or remove one wait on a step.
function onToggleAfter(update, block, step, ref) {
  update((b) => ({
    ...b,
    subtasks: DDmapSteps(b.subtasks, (s) =>
      s.id === step.id
        ? (() => {
            const list = DDstepAfter(s),
              next = list.includes(ref) ? list.filter((one) => one !== ref) : [...list, ref],
              { after, ...rest } = s;
            return next.length ? { ...rest, after: next } : rest;
          })()
        : s,
    ),
  }));
}

function DDmapSteps(steps, fn) {
  return (steps || []).map((step) => ({ ...fn(step), children: DDmapSteps(step.children, fn) }));
}

// A quick new task, with an optional tag, into Today or the Park.
function AddTask(...ddArgs) {
  const { React, language, onAdd } = DDpageProps(ddArgs);
  const fa = language === "fa",
    [value, setValue] = React.useState("");
  return h(
    "form",
    {
      className: "dd-engine-add",
      onSubmit: (event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onAdd(value);
        setValue("");
      },
    },
    h("input", {
      value,
      dir: "auto",
      maxLength: 300,
      placeholder: t(fa, "+ New task", "+ کار تازه"),
      "aria-label": t(fa, "New task", "کار تازه"),
      onChange: (event) => setValue(event.target.value),
      onKeyDown: (event) => event.stopPropagation(),
    }),
  );
}

// The Engine's page: the day, the park and the notes that stay.
export function DDEnginePage(...ddArgs) {
  const React = DDpageProps(ddArgs).React;
  const {
    day,
    setup,
    language,
    dateLabel,
    filter = "all",
    onFilter,
    onDay,
    onPrevDay,
    onNextDay,
    onOpenSection,
    onOpenDay,
    onPauseDay,
    onOpenBoard,
    onToast,
    makeId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
    onNote,
  } = ddArgs[0] || {};
  const fa = language === "fa",
    [notesOpen, setNotesOpen] = React.useState(false),
    [noteText, setNoteText] = React.useState(""),
    shown = DDengineToday(day, filter),
    plan = DDenginePlan(day, shown.today),
    totals = DDengineTotals(day, setup),
    notes = DDengineNotes(setup),
    sections = DDtagSections(setup, language);
  const addTask = (name, parked = false) => {
    const block = {
      id: makeId(),
      name: String(name || "").trim().slice(0, 300),
      type: setup?.types?.[0]?.id || "work",
      lane: setup?.lanes?.[0]?.id || "",
      min: Number(setup?.preferences?.defaultMinutes) || 60,
      note: "",
      pri: 0,
      emo: "",
      done: false,
      expanded: true,
      subtasks: [],
    };
    if (parked) block.park = true;
    onDay((d) => ({ ...d, blocks: [...d.blocks, block] }));
  };
  return h(
    "section",
    { className: "dd-engine-page", "data-panel": "engine", "aria-label": t(fa, "Engine", "انجین") },
    h(
      "header",
      { className: "dd-engine-page-head" },
      h(
        "div",
        { className: "dd-engine-page-title" },
        h("h1", null, t(fa, "Today", "امروز")),
        h(
          "div",
          { className: "dd-engine-page-day" },
          h("button", { type: "button", className: "navb", "aria-label": t(fa, "Previous day", "روز قبل"), onClick: onPrevDay }, "‹"),
          h("button", { type: "button", className: "textbtn", title: t(fa, "Open the calendar", "باز کردن تقویم"), onClick: onOpenDay }, dateLabel),
          h("button", { type: "button", className: "navb", "aria-label": t(fa, "Next day", "روز بعد"), onClick: onNextDay }, "›"),
        ),
      ),
      h(
        "div",
        { className: "dd-engine-page-progress", title: t(fa, "Done, weighted by priority", "انجام‌شده، با وزن اولویت") },
        h("span", { className: "dd-engine-bar" }, h("i", { style: { width: totals.percent + "%" } })),
        h("b", null, num(fa, totals.done) + "/" + num(fa, totals.total)),
        h("small", null, num(fa, totals.open) + " " + t(fa, "left", "باقی")),
      ),
      h(
        "div",
        { className: "dd-engine-page-actions" },
        h("button", { type: "button", className: "dd-engine-page-pause", onClick: onPauseDay, title: t(fa, "Pause the day", "روز را نگه دار") }, "⏸ " + t(fa, "Pause the day", "روز را نگه دار")),
        h("button", { type: "button", className: "dd-engine-page-board", onClick: onOpenBoard, title: t(fa, "The same day on the Board", "همان روز روی برد") }, "◎ " + t(fa, "Board", "برد")),
      ),
    ),
    h(FilterBar, { React, value: shown.filter, counts: shown.counts, language, onChange: onFilter }),
    h(
      "div",
      { className: "dd-engine-page-body" },
      h(
        "div",
        { className: "dd-engine-today" },
        h(
          "h2",
          { className: "dd-engine-col-title" },
          h(DDtabGlyph, { React, id: "engine" }),
          t(fa, "Today", "امروز"),
          h("small", null, num(fa, shown.today.length)),
        ),
        plan.length
          ? plan.map((wave) =>
              h(
                "div",
                { key: wave.wave, className: "dd-engine-wave", "data-wave": wave.wave, "data-parallel": wave.parallel },
                wave.wave > 0 || plan.length > 1
                  ? h(
                      "div",
                      { className: "dd-engine-wave-head" },
                      h("span", { className: "dd-engine-wave-name" }, wave.parallel ? t(fa, "Together", "با هم") : t(fa, "After that", "بعد از آن")),
                      h("i", { "aria-hidden": true }),
                    )
                  : null,
                h(
                  "ul",
                  { className: "dd-engine-list" },
                  wave.blocks.map(({ block }) =>
                    h(TaskRow, { key: block.id, React, day, block, setup, language, onDay, onOpenSection, onToast, wave: wave.wave }),
                  ),
                ),
              ),
            )
          : h("p", { className: "dd-engine-empty" }, t(fa, "Nothing here yet. Add a task below.", "هنوز چیزی اینجا نیست. پایین یک کار اضافه کن.")),
        h(AddTask, { React, language, onAdd: (name) => addTask(name) }),
      ),
      h(
        "div",
        { className: "dd-engine-park" },
        h("h2", { className: "dd-engine-col-title" }, h(DDtabGlyph, { React, id: "park" }), t(fa, "Park", "پارک"), h("small", null, num(fa, shown.park.length))),
        shown.park.length
          ? h(
              "ul",
              { className: "dd-engine-list" },
              shown.park.map((block) => h(TaskRow, { key: block.id, React, day, block, setup, language, onDay, onOpenSection, onToast, wave: 0 })),
            )
          : h("p", { className: "dd-engine-empty" }, t(fa, "The Park is empty. Set a task aside and it waits here.", "پارک خالی است. کاری را کنار بگذار تا اینجا بماند.")),
        h(AddTask, { React, language, onAdd: (name) => addTask(name, true) }),
      ),
    ),
    h(
      "div",
      { className: "dd-engine-notes" },
      h(
        "button",
        { type: "button", className: "dd-engine-notes-toggle", "aria-expanded": notesOpen, onClick: () => setNotesOpen(!notesOpen) },
        "✎ " + t(fa, "Engine notes", "یادداشت‌های انجین"),
        notes.length ? h("small", null, num(fa, notes.length)) : null,
      ),
      notesOpen
        ? h(
            "div",
            { className: "dd-engine-notes-body" },
            h(
              "p",
              { className: "dd-engine-notes-hint" },
              t(fa, "These notes stay on the Board and inside every section, on every day.", "این یادداشت‌ها روی برد و در همهٔ سکشن‌ها، در همهٔ روزها می‌مانند."),
            ),
            h(
              "form",
              {
                onSubmit: (event) => {
                  event.preventDefault();
                  if (!noteText.trim()) return;
                  onNote?.(noteText);
                  setNoteText("");
                },
              },
              h("input", {
                value: noteText,
                dir: "auto",
                "aria-label": t(fa, "New note", "یادداشت تازه"),
                placeholder: t(fa, "+ A note that stays", "+ یادداشتی که می‌ماند"),
                onChange: (event) => setNoteText(event.target.value),
                onKeyDown: (event) => event.stopPropagation(),
              }),
            ),
            h(
              "ul",
              null,
              notes.slice(0, 8).map((note) =>
                h(
                  "li",
                  { key: note.id },
                  h("span", { dir: "auto" }, note.text || ""),
                  note.at ? h("small", null, note.at) : null,
                ),
              ),
            ),
          )
        : null,
    ),
  );
}

// The small line icons the page uses for its columns, matching panels.js.
export function DDtabGlyph({ React, id }) {
  const lines = {
    engine: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3"/>',
    park: '<path d="M6 2.5v11M10 2.5v11M3.5 5.5h9M3.5 10.5h9"/>',
  };
  const d = lines[id];
  return d
    ? React.createElement("svg", { viewBox: "0 0 16 16", width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, dangerouslySetInnerHTML: { __html: d } })
    : null;
}

export const DDenginePageCSS = `
.dd-engine-page{display:flex;flex-direction:column;gap:14px;padding:18px 20px 28px;border-radius:16px;background:var(--paper,#fff);box-shadow:inset 0 0 0 1px var(--rule-2,#0002);min-width:0}
.dd-engine-page-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.dd-engine-page-title{display:flex;flex-direction:column;gap:4px;min-width:0}
.dd-engine-page-title h1{margin:0;font:600 calc(19px * var(--k,1))/1.1 var(--sans,system-ui);letter-spacing:-.02em}
.dd-engine-page-day{display:flex;align-items:center;gap:6px;color:var(--ink-2,#555);font-size:12px}
.dd-engine-page-progress{display:flex;align-items:center;gap:8px;margin-inline-start:auto;font:500 12px/1 var(--mono,monospace);color:var(--ink-3,#777)}
.dd-engine-page-progress b{color:var(--ink,#121211)}
.dd-engine-page-progress small{color:var(--ink-3,#777);font-size:11px}
.dd-engine-bar{width:110px;height:6px;border-radius:9px;background:var(--wash,#eee);overflow:hidden}
.dd-engine-bar i{display:block;height:100%;background:var(--panel-engine,#F05A28);border-radius:inherit;transition:width .2s}
.dd-engine-page-actions{display:flex;align-items:center;gap:6px}
.dd-engine-page-actions>button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 11px;border-radius:9px;background:var(--wash,#f1efe9);color:var(--ink,#121211);font:500 12px/1 var(--sans,system-ui)}
.dd-engine-page-actions>button:hover{background:color-mix(in srgb,var(--ink,#121211) 8%,var(--wash,#f1efe9))}
.dd-engine-filter{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:10px;background:var(--wash,#f1efe9);align-self:flex-start}
.dd-engine-filter button{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 12px;border-radius:8px;background:none;color:var(--ink-3,#777);font:500 12px/1 var(--sans,system-ui)}
.dd-engine-filter button small{font:600 10px/1 var(--mono,monospace);opacity:.7}
.dd-engine-filter button[aria-pressed=true]{background:var(--paper,#fff);color:var(--ink,#121211);box-shadow:0 1px 2px #0002}
.dd-engine-page-body{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:16px;align-items:start}
.dd-engine-col-title{display:flex;align-items:center;gap:7px;margin:0 0 8px;font:600 12px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2,#555)}
.dd-engine-col-title small{margin-inline-start:auto;font:500 11px/1 var(--mono,monospace);color:var(--ink-3,#777);letter-spacing:0}
.dd-engine-today,.dd-engine-park{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px;border-radius:13px;background:var(--panel,#f6f5f2)}
.dd-engine-park{background:transparent;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-wave{display:flex;flex-direction:column;gap:6px}
.dd-engine-wave-head{display:flex;align-items:center;gap:8px;font:500 10.5px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#777)}
.dd-engine-wave-head i{flex:1;height:1px;background:var(--rule-2,#0002)}
.dd-engine-wave[data-parallel=true] .dd-engine-wave-name{color:color-mix(in srgb,var(--panel-engine,#F05A28) 70%,var(--ink,#121211))}
.dd-engine-wave[data-parallel=true] .dd-engine-wave-head i{background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--panel-engine,#F05A28) 35%,transparent) 0 4px,transparent 4px 8px)}
.dd-engine-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dd-engine-row{position:relative;border-radius:10px;background:var(--paper,#fff);box-shadow:0 1px 2px #0001,inset 0 0 0 1px var(--rule-2,#0001);padding:7px 8px;display:flex;flex-direction:column;gap:6px}
.dd-engine-row[data-done=true] .dd-engine-row-name-btn{text-decoration:line-through;opacity:.55}
.dd-engine-row[data-parked=true]{background:color-mix(in srgb,var(--wash,#f1efe9) 70%,var(--paper,#fff))}
.dd-engine-row-head{display:flex;align-items:flex-start;gap:8px}
.dd-engine-row-check{flex:none;width:22px;height:22px;border-radius:6px;border:1.6px solid var(--ink-3,#888);display:grid;place-items:center;font-size:13px;color:#fff;background:none}
.dd-engine-row-check[aria-pressed=true]{background:var(--ok,#2E8B3A);border-color:var(--ok,#2E8B3A)}
.dd-engine-row-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.dd-engine-row-name-btn{all:unset;cursor:text;font:500 calc(13.5px * var(--k,1))/1.35 var(--sans,system-ui);overflow-wrap:anywhere}
.dd-engine-row-name-btn:focus-visible{outline:2px solid var(--panel-engine,#F05A28);outline-offset:2px;border-radius:3px}
.dd-engine-row-name{font:inherit;font-size:13.5px;padding:3px 6px;border-radius:6px;border:1px solid var(--rule-2,#ccc);background:var(--panel,#fff);color:var(--ink,#121211);width:100%;box-sizing:border-box}
.dd-engine-row-meta{display:flex;flex-wrap:wrap;align-items:center;gap:5px;font-size:11px;color:var(--ink-3,#777);min-width:0}
.dd-engine-row-min{font:500 11px/1 var(--mono,monospace)}
.dd-engine-row-steps{font:500 10.5px/1 var(--mono,monospace)}
.dd-engine-row-pri{font:700 10px/1 var(--mono,monospace);padding:2px 5px;border-radius:5px;background:var(--wash,#eee);color:var(--ink-2,#555)}
.dd-engine-row-pri[data-pri="1"]{background:#D9434A;color:#fff}
.dd-engine-row-pri[data-pri="2"]{background:color-mix(in srgb,#D9434A 60%,#fff);color:#fff}
.dd-engine-row-wait{font:500 10.5px/1 var(--mono,monospace);color:color-mix(in srgb,var(--panel-engine,#F05A28) 75%,var(--ink,#121211))}
.dd-engine-tag{display:inline-flex;align-items:center;gap:2px;min-width:0}
.dd-engine-tag-open{display:inline-flex;align-items:center;max-width:190px;padding:1px 7px;border:1px solid;border-radius:999px;font:500 10.5px/1.6 var(--sans,system-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:none}
.dd-engine-tag-pick{width:18px;height:18px;border-radius:5px;background:none;color:var(--ink-3,#777);font-size:11px;line-height:1;opacity:0}
.dd-engine-tag-pick:hover{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-row:hover .dd-engine-tag-pick,.dd-engine-tag-pick:focus-visible,.dd-engine-tag[data-empty=true] .dd-engine-tag-pick{opacity:1}
.dd-engine-tag-none{color:var(--ink-3,#777);font-size:11px;opacity:.7}
.dd-engine-row-tools{display:flex;align-items:center;gap:2px;flex:none}
.dd-engine-row-tools button{min-width:24px;height:24px;border-radius:6px;background:none;color:var(--ink-3,#777);font-size:11px;padding:0 5px;display:inline-flex;align-items:center;gap:3px}
.dd-engine-row-tools button:hover{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-step-toggle span{font-size:10.5px}
.dd-engine-steps{list-style:none;margin:0;padding:0 0 0 30px;display:flex;flex-direction:column;gap:1px}
.dd-engine-steps li{display:flex;align-items:center;gap:6px;min-height:26px;padding-inline-start:calc(var(--depth,0) * 14px);border-radius:6px}
.dd-engine-steps li:hover{background:color-mix(in srgb,var(--wash,#f1efe9) 70%,transparent)}
.dd-engine-step-check{flex:none;width:17px;height:17px;border-radius:5px;border:1.4px solid var(--ink-3,#999);display:grid;place-items:center;font-size:10px;color:#fff;background:none}
.dd-engine-step-check[aria-pressed=true]{background:var(--ok,#2E8B3A);border-color:var(--ok,#2E8B3A)}
.dd-engine-step-text{flex:1;min-width:0;font-size:12px;line-height:1.35;overflow-wrap:anywhere}
.dd-engine-steps li[data-done=true] .dd-engine-step-text{color:var(--ink-3,#777);text-decoration:line-through}
.dd-engine-step-wait{font:500 10px/1 var(--mono,monospace);color:var(--ink-3,#777)}
.dd-engine-step-after{width:20px;height:20px;border-radius:5px;background:none;color:var(--ink-3,#777);font-size:11px;opacity:0}
.dd-engine-steps li:hover .dd-engine-step-after,.dd-engine-step-after:focus-visible{opacity:1}
.dd-engine-step-after:hover{background:var(--wash,#eee);color:var(--ink,#121211)}
.dd-engine-add input{width:100%;box-sizing:border-box;font:inherit;font-size:12.5px;padding:7px 9px;border-radius:8px;border:1px dashed var(--rule-2,#bbb);background:transparent;color:var(--ink,#121211)}
.dd-engine-add input:focus{border-style:solid;outline:none;border-color:var(--panel-engine,#F05A28)}
.dd-engine-empty{margin:0;padding:10px 4px;color:var(--ink-3,#777);font-size:12.5px}
.dd-engine-picker{position:absolute;z-index:20;top:100%;inset-inline-start:8px;margin-top:4px;width:min(320px,90%);padding:8px;border-radius:11px;background:var(--paper,#fff);box-shadow:0 14px 34px #0003,0 0 0 1px var(--rule-2,#0002);display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto}
.dd-engine-picker input{font:inherit;font-size:12.5px;padding:6px 8px;border-radius:7px;border:1px solid var(--rule-2,#ccc);background:var(--panel,#fff);color:var(--ink,#121211)}
.dd-engine-picker ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.dd-engine-picker li button{display:flex;align-items:center;gap:7px;width:100%;min-height:30px;padding:4px 7px;border-radius:7px;background:none;color:var(--ink,#121211);font:inherit;font-size:12px;text-align:start}
.dd-engine-picker li button:hover{background:var(--wash,#f1efe9)}
.dd-engine-picker li button[aria-pressed=true]{background:color-mix(in srgb,var(--panel-engine,#F05A28) 12%,transparent)}
.dd-engine-picker li button i{width:8px;height:8px;border-radius:50%;flex:none;background:var(--tint,var(--ink-3))}
.dd-engine-picker li button span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-engine-pick-none{min-height:30px;border-radius:7px;background:var(--wash,#f1efe9);color:var(--ink-2,#555);font:inherit;font-size:12px}
.dd-engine-picker-empty{color:var(--ink-3,#777);font-size:12px;padding:6px}
.dd-engine-notes{border-radius:12px;box-shadow:inset 0 0 0 1px var(--rule-2,#0002)}
.dd-engine-notes-toggle{display:flex;align-items:center;gap:8px;width:100%;min-height:38px;padding:0 12px;border-radius:12px;background:none;color:var(--ink-2,#555);font:500 12px/1 var(--sans,system-ui)}
.dd-engine-notes-toggle small{font:600 10px/1 var(--mono,monospace);padding:2px 5px;border-radius:5px;background:var(--wash,#eee);color:var(--ink-3,#777)}
.dd-engine-notes-toggle[aria-expanded=true]{background:var(--wash,#f1efe9);color:var(--ink,#121211)}
.dd-engine-notes-body{display:flex;flex-direction:column;gap:8px;padding:0 12px 12px}
.dd-engine-notes-hint{margin:0;font-size:11.5px;color:var(--ink-3,#777)}
.dd-engine-notes-body form input{width:100%;box-sizing:border-box;font:inherit;font-size:12.5px;padding:7px 9px;border-radius:8px;border:1px dashed var(--rule-2,#bbb);background:transparent;color:var(--ink,#121211)}
.dd-engine-notes-body ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.dd-engine-notes-body li{display:flex;align-items:baseline;gap:8px;padding:6px 8px;border-radius:8px;background:var(--wash,#f1efe9);font-size:12px}
.dd-engine-notes-body li span{flex:1;min-width:0;overflow-wrap:anywhere}
.dd-engine-notes-body li small{font:10.5px/1 var(--mono,monospace);color:var(--ink-3,#777);white-space:nowrap}
@media (max-width:860px){.dd-engine-page-body{grid-template-columns:1fr}}
@media (max-width:640px){.dd-engine-page{padding:14px 12px 22px;gap:11px}.dd-engine-page-progress{margin-inline-start:0;order:3;width:100%}.dd-engine-page-progress .dd-engine-bar{flex:1;width:auto}.dd-engine-page-actions{width:100%}.dd-engine-page-actions>button{flex:1;justify-content:center;min-height:40px}.dd-engine-row-check{width:26px;height:26px}.dd-engine-step-check{width:22px;height:22px}.dd-engine-row-tools button{min-width:32px;height:32px}.dd-engine-tag-pick{opacity:1;width:24px;height:24px}.dd-engine-step-after{opacity:1;width:26px;height:26px}}
`;

export function DDinstallEnginePageStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-engine-page-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-engine-page-css", textContent: DDenginePageCSS }));
}
