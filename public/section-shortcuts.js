// Device-local navigation preferences, never written into synced planner data.
export const DD_SECTION_KEYS = "debug-day:section-shortcuts";

export function DDreadSectionShortcuts(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(DD_SECTION_KEYS) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
      .filter(([digit, id]) => /^[1-9]$/.test(digit) && typeof id === "string" && id.length <= 80));
  } catch { return {}; }
}

export function DDassignSectionShortcut(shortcuts, sectionId, digit) {
  const next = Object.fromEntries(Object.entries(shortcuts || {}).filter(([, id]) => id !== sectionId));
  if (/^[1-9]$/.test(String(digit))) next[String(digit)] = sectionId;
  return next;
}

export function DDfindThisApp(items = []) {
  return items.find((item) => item.type === "section" && /^(this app|این برنامه|برنامه)$/i.test((item.text || "").trim())) || null;
}

export function DDsectionForShortcut(items, event, shortcuts = {}) {
  if (event.ctrlKey || event.metaKey) return null;
  if (!event.altKey && !event.shiftKey && (event.code === "KeyT" || event.key?.toLowerCase() === "t"))
    return DDfindThisApp(items);
  const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
  if (!event.altKey || !digit) return null;
  return items.find((item) => item.type === "section" && item.id === shortcuts[digit]) || null;
}
