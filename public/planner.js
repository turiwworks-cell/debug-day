import { DDSectionChip, DDlifeItems } from "./life-board.js";
import { DDtagList } from "./note-tags.js";
import { DDTaskMedia, DDmediaList, DDinstallMediaStyles } from "./media.js";
// The shared meaning of a task: tags, importance and daily progress.
// Time totals remain time totals. Progress measures completed work by importance.
// One tag system for tasks and notes: the clean-up lives in note-tags.js.
export function DDtags(value) {
  return DDtagList(value);
}
export function DDpriorityWeight(task) {
  return { 1: 4, 2: 3, 3: 2 }[task?.pri] || 1;
}
export function DDcompletion(day, laneIds) {
  const planned = (day?.blocks || []).filter(
    (b) => !laneIds || laneIds.includes(b.lane),
  );
  const weight = planned.reduce((sum, b) => sum + DDpriorityWeight(b), 0);
  const doneWeight = planned
    .filter((b) => b.done)
    .reduce((sum, b) => sum + DDpriorityWeight(b), 0);
  const ratio = weight ? doneWeight / weight : 0;
  return {
    total: planned.length,
    done: planned.filter((b) => b.done).length,
    weight,
    doneWeight,
    ratio,
    percent: Math.round(ratio * 100),
  };
}
export function DDpriorityLabel(priority, language) {
  const labels =
    language === "fa"
      ? [
          "عادی · ×۱",
          "P1 · خیلی مهم · ×۴",
          "P2 · مهم · ×۳",
          "P3 · کم‌اهمیت‌تر · ×۲",
        ]
      : [
          "Normal · ×1",
          "P1 · Highest · ×4",
          "P2 · High · ×3",
          "P3 · Medium · ×2",
        ];
  return labels[priority] || labels[0];
}
export function DDprogressLabel(language) {
  return language === "fa"
    ? "پیشرفت بر پایهٔ اولویت: P1 ×۴، P2 ×۳، P3 ×۲ و عادی ×۱. کارهای پارک‌شده حساب نمی‌شوند."
    : "Progress by priority: P1 ×4, P2 ×3, P3 ×2, normal ×1. Parked tasks are excluded.";
}
// Plan passes setup, so a task also shows the section it came from, path and all.
export function DDTaskTags({ React: R, task, language, setup }) {
  const tags = DDtags(task?.tags),
    from = setup && task?.from ? R.createElement(DDSectionChip, { React: R, items: DDlifeItems(setup), id: task.from, language, className: "dd-plan-from" }) : null;
  if (from) return R.createElement(R.Fragment, null, from, DDTaskTags({ React: R, task, language }));
  const media = DDmediaList(task?.media).length,
    fa = language === "fa";
  return tags.length || media
    ? R.createElement(
        "span",
        {
          className: "dd-task-tags",
          "aria-label": fa ? "تگ‌ها" : "Tags",
        },
        tags.map((tag) =>
          R.createElement("span", { key: tag, dir: "auto" }, "#" + tag),
        ),
        media
          ? R.createElement(
              "span",
              {
                key: "dd-media",
                className: "dd-media-count",
                title: fa ? media + " عکس یا ویدیو" : media + (media === 1 ? " photo or video" : " photos or videos"),
              },
              "📎 " + media,
            )
          : null,
      )
    : null;
}
export function DDTaskMetadata({
  React: R,
  task,
  language,
  disabled = false,
  onChange,
}) {
  const h = R.createElement,
    fa = language === "fa",
    [draft, setDraft] = R.useState(""),
    tags = DDtags(task.tags),
    canceled = R.useRef(false);
  R.useEffect(() => setDraft(""), [task.id]);
  R.useEffect(DDinstallMediaStyles, []);
  const add = () => {
    if (!draft.trim() || disabled) return;
    onChange({ tags: DDtags([...tags, ...DDtags(draft)]) });
    setDraft("");
  };
  return h(
    "div",
    { className: "dd-task-metadata" },
    h(
      "div",
      {
        className: "dd-priority-options",
        role: "group",
        "aria-label": fa ? "اولویت" : "Priority",
        title: DDprogressLabel(language),
      },
      [0, 1, 2, 3].map((pri) =>
        h(
          "button",
          {
            key: pri,
            type: "button",
            disabled,
            "aria-pressed": (task.pri || 0) === pri,
            "aria-label": DDpriorityLabel(pri, language),
            "data-priority": pri,
            onClick: () => onChange({ pri }),
          },
          pri ? "P" + pri : fa ? "عادی" : "Normal",
        ),
      ),
    ),
    h(
      "small",
      { className: "dd-priority-help" },
      DDpriorityLabel(task.pri, language),
      " · ",
      fa ? "وزن در پیشرفت روز" : "weight in daily progress",
    ),
    h(
      "div",
      {
        className: "dd-tag-editor",
        role: "group",
        "aria-label": fa ? "تگ‌های کار" : "Task tags",
      },
      h(
        "div",
        { className: "dd-task-tags" },
        tags.map((tag) =>
          h(
            "span",
            { key: tag, dir: "auto" },
            "#" + tag,
            h(
              "button",
              {
                type: "button",
                disabled,
                "aria-label": (fa ? "حذف تگ " : "Remove tag ") + tag,
                onClick: () =>
                  onChange({ tags: tags.filter((t) => t !== tag) }),
              },
              "×",
            ),
          ),
        ),
      ),
      h(
        "div",
        { className: "dd-tag-input" },
        h("input", {
          value: draft,
          disabled: disabled || tags.length >= 12,
          maxLength: 240,
          dir: "auto",
          "aria-label": fa ? "تگ جدید" : "New tag",
          placeholder: fa
            ? "تگ جدید؛ مثلاً پروژه یا شخصی"
            : "New tag, e.g. project or personal",
          onChange: (e) => {
            canceled.current = false;
            setDraft(e.target.value);
          },
          onBlur: () => {
            if (canceled.current) {
              canceled.current = false;
              return;
            }
            add();
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === "," || e.key === "،") {
              e.preventDefault();
              e.stopPropagation();
              add();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              canceled.current = true;
              setDraft("");
              e.currentTarget.blur();
            }
          },
        }),
        h(
          "button",
          {
            type: "button",
            disabled: disabled || !draft.trim(),
            "aria-label": fa ? "افزودن تگ" : "Add tag",
            onPointerDown: (e) => e.preventDefault(),
            onClick: add,
          },
          "+",
        ),
      ),
    ),
    h(DDTaskMedia, { React: R, task, language, disabled, onChange }),
  );
}
