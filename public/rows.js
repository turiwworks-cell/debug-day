// Copy, card colour and collapse tools for the plan's lists and sections,
// plus select-all when a field still holds a default name.
export const DDrowColors = [
  "#D9434A",
  "#EC6A1E",
  "#E0A400",
  "#2E8B3A",
  "#1C9AA6",
  "#2C50FF",
  "#7A5FF5",
  "#E0529C",
  "#8E8A80",
];
const DDcollapseKey = "debug-day:collapsed";
export function DDfeedbackText(note) {
  const replies = (note?.thread || []).map((reply) => "  · " + reply.text);
  return [note?.text || "", ...replies].join("\n");
}
export function DDbugColor(bug) {
  if (bug?.color) return bug.color;
  return bug?.category === "inner"
    ? "#7A5FF5"
    : bug?.category === "energy"
      ? "#E0A400"
      : bug?.category === "creative"
        ? "#1C9AA6"
        : "#D9434A";
}
function DDfindStep(list, id) {
  for (const step of list || []) {
    if (step.id === id) return step.text || "";
    const found = DDfindStep(step.children, id);
    if (found) return found;
  }
  return "";
}
export function DDnodeTitle(day, lanes, id) {
  const [kind, first = "", second = ""] = String(id || "").split(":");
  if (kind === "day") return day?.focus || day?.date || "";
  if (kind === "b") return day?.blocks?.find((b) => b.id === first)?.name || "";
  if (kind === "sub")
    return DDfindStep(day?.blocks?.find((b) => b.id === first)?.subtasks, second);
  if (kind === "sticky")
    return (day?.notes?.find((n) => n.id === first)?.text || "").slice(0, 60);
  if (kind === "lane") return lanes?.find((l) => l.id === first)?.name || "";
  if (kind === "bug") return day?.bugs?.find((b) => b.id === first)?.text || "";
  return "";
}
// What a feeling was connected to on the board, with the "how" written on the line.
export function DDbugEffects(day, lanes, bugId) {
  const ref = "bug:" + bugId;
  return (day?.canvas?.board4?.links || [])
    .filter((link) => link.from === ref || link.to === ref)
    .map((link) => ({
      title: DDnodeTitle(day, lanes, link.from === ref ? link.to : link.from),
      label: (link.label || "").trim(),
    }))
    .filter((effect) => effect.title);
}
export function DDeffectsText(effects, language) {
  if (!effects?.length) return "";
  return (
    (language === "fa" ? "روی این اثر گذاشت: " : "Affected: ") +
    effects
      .map((e) => e.title + (e.label ? " (" + e.label + ")" : ""))
      .join(language === "fa" ? "، " : ", ")
  );
}
export function DDbugText(bug, effects = []) {
  return (
    (bug?.text || "") +
    (bug?.antidote ? "\n  → " + bug.antidote : "") +
    effects
      .map((e) => "\n  ↳ " + e.title + (e.label ? ": " + e.label : ""))
      .join("")
  );
}
export function DDlistText(texts) {
  return texts
    .filter((text) => text && text.trim())
    .map((text) => "- " + text)
    .join("\n");
}
export async function DDcopyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    return done;
  } catch {
    return false;
  }
}
export function DDreadCollapsed() {
  try {
    const list = JSON.parse(localStorage.getItem(DDcollapseKey) || "[]");
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}
export function DDtoggleCollapsed(collapsed, id) {
  const next = new Set(collapsed);
  next.has(id) ? next.delete(id) : next.add(id);
  try {
    localStorage.setItem(DDcollapseKey, JSON.stringify([...next]));
  } catch {}
  return next;
}
function DDrowIcon(h, d) {
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
    h("path", { d }),
  );
}
const DDcopyPath = "M5.5 5.5h8v8h-8zM3 10.5V2.5h8",
  DDchevronPath = "m4 6 4 4 4-4";
async function DDcopyAndTell(text, fa, onToast) {
  const done = await DDcopyText(text);
  onToast?.(done ? (fa ? "کپی شد" : "Copied") : fa ? "کپی نشد" : "Copy failed");
}
export function DDRowTools({ React: R, text, color, onColor, language, onToast }) {
  const h = R.createElement,
    fa = language === "fa",
    t = (en, other) => (fa ? other : en),
    current = (color || "").toLowerCase();
  return h(
    "span",
    { className: "dd-row-tools" },
    h(
      "button",
      {
        type: "button",
        className: "dd-row-btn",
        "aria-label": t("Copy text", "کپی متن"),
        "data-tip": t("Copy text", "کپی متن"),
        onClick: (event) => {
          event.stopPropagation();
          DDcopyAndTell(text, fa, onToast);
        },
      },
      DDrowIcon(h, DDcopyPath),
    ),
    onColor &&
      h(
        "details",
        { className: "dd-b4-colors dd-row-color" },
        h(
          "summary",
          {
            "aria-label": t("Card color", "رنگ کارت"),
            "data-tip": t("Card color", "رنگ کارت"),
          },
          h("i", { style: color ? { background: color } : undefined }),
        ),
        h(
          "div",
          { role: "group", "aria-label": t("Card color", "رنگ کارت") },
          h(
            "button",
            {
              type: "button",
              className: "dd-reset",
              "aria-label": t("Automatic color", "رنگ خودکار"),
              title: t("Automatic color", "رنگ خودکار"),
              "aria-pressed": !color,
              onClick: (event) => {
                event.currentTarget.closest("details").open = false;
                onColor(undefined);
              },
            },
            "↺",
          ),
          DDrowColors.map((value) =>
            h("button", {
              key: value,
              type: "button",
              style: { background: value },
              "aria-label": value,
              "aria-pressed": current === value.toLowerCase(),
              onClick: (event) => {
                event.currentTarget.closest("details").open = false;
                onColor(value);
              },
            }),
          ),
        ),
      ),
  );
}
export function DDCopyAll({ React: R, texts, language, onToast }) {
  const fa = language === "fa",
    list = DDlistText(texts || []);
  return R.createElement(
    "button",
    {
      type: "button",
      className: "dd-copy-all",
      disabled: !list,
      title: fa ? "کپی همهٔ موارد این فهرست" : "Copy every item in this list",
      onClick: () => DDcopyAndTell(list, fa, onToast),
    },
    DDrowIcon(R.createElement, DDcopyPath),
    fa ? "کپی همه" : "Copy all",
  );
}
export function DDCollapseButton({ React: R, open, onToggle, label, language }) {
  const fa = language === "fa",
    name = (open ? (fa ? "بستن " : "Collapse ") : fa ? "باز کردن " : "Expand ") + (label || "");
  return R.createElement(
    "button",
    {
      type: "button",
      className: "dd-collapse",
      "aria-expanded": !!open,
      "aria-label": name.trim(),
      title: name.trim(),
      onClick: (event) => {
        event.stopPropagation();
        onToggle();
      },
      onPointerDown: (event) => event.stopPropagation(),
    },
    DDrowIcon(R.createElement, DDchevronPath),
  );
}
if (typeof document !== "undefined")
  document.addEventListener(
    "pointerdown",
    (event) => {
      for (const open of document.querySelectorAll(".dd-row-color[open]"))
        if (!open.contains(event.target)) open.open = false;
    },
    true,
  );
const DDdefaultNames = new Set([
  "New block",
  "بلاک جدید",
  "New idea…",
  "ایده جدید…",
  "Untitled",
  "بدون عنوان",
  "New note",
  "یادداشت جدید",
]);
if (typeof document !== "undefined")
  document.addEventListener(
    "focusin",
    (event) => {
      const field = event.target;
      if (
        !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
        !DDdefaultNames.has(field.value.trim())
      )
        return;
      requestAnimationFrame(() => {
        if (document.activeElement === field) field.select();
      });
    },
    true,
  );
