// Time focused on a task (5.88.0). Focus started from a task counts the time
// that really passed while the timer ran, and writes it on the task as
// `spent` (seconds). It is history, never a target: it shows as "45m focused"
// beside the task, in the Calendar's day and in the week's look back, so you
// can see "this week, 3h on the cover" without planning any hours.
import { DDduration } from "./measure.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/, MAX = 3600 * 1000;

export const DDspentOf = (block) => (Number.isFinite(block?.spent) && block.spent > 0 ? Math.min(MAX, Math.round(block.spent)) : 0);
const minutes = (seconds) => Math.round(seconds / 60);

// "45m focused"; under a minute says nothing.
export function DDspentText(seconds, language) {
  const m = minutes(seconds);
  return m >= 1 ? DDduration(m, language) + (language === "fa" ? " تمرکز" : " focused") : "";
}

// All the time focused on a day's tasks, in seconds.
export const DDdayFocused = (day) => (day?.blocks || []).reduce((sum, b) => sum + DDspentOf(b), 0);

// One task across the days it was carried on: c20261121-ink and ink are one.
export const DDfocusRoot = (id) => String(id || "").replace(/^(?:c\d{8}-|cpark-)+/, "");

// The tasks focused on in `dates`, most time first: [{ id, name, seconds }].
export function DDfocusedTasks(days, dates) {
  const rows = new Map();
  for (const date of dates || [])
    for (const b of days?.[date]?.blocks || []) {
      const seconds = DDspentOf(b);
      if (!seconds) continue;
      const key = DDfocusRoot(b.id), row = rows.get(key) || { id: key, name: "", seconds: 0 };
      row.seconds += seconds;
      row.name = String(b.name || "").trim() || row.name;
      rows.set(key, row);
    }
  return [...rows.values()].sort((a, b) => b.seconds - a.seconds);
}

// Owed time (from the timer) written on its tasks: on its day, or wherever the
// task is now (moved to another day, or parked). Time for a task that is gone
// is let go. Returns `data` itself when nothing changed.
export function DDaddFocus(data, entries) {
  const list = (entries || []).filter((e) => e && typeof e.id === "string" && e.id && Number.isFinite(e.seconds) && e.seconds > 0);
  if (!list.length || !data?.days) return data;
  let days = data.days, later = data.setup?.later, changed = false;
  const add = (b, seconds) => ({ ...b, spent: Math.min(MAX, DDspentOf(b) + Math.round(seconds)) });
  for (const e of list) {
    const order = [...(DAY.test(e.date) && days[e.date] ? [e.date] : []), ...Object.keys(days).filter((k) => k !== e.date).sort().reverse()];
    const date = order.find((k) => (days[k]?.blocks || []).some((b) => b.id === e.id));
    if (date) {
      days = { ...days, [date]: { ...days[date], blocks: days[date].blocks.map((b) => (b.id === e.id ? add(b, e.seconds) : b)) } };
      changed = true;
    } else if (Array.isArray(later) && later.some((b) => b.id === e.id)) {
      later = later.map((b) => (b.id === e.id ? add(b, e.seconds) : b));
      changed = true;
    }
  }
  if (!changed) return data;
  return { ...data, days, ...(later !== data.setup?.later ? { setup: { ...data.setup, later } } : {}) };
}
