// Shared date helpers (YYYY-MM-DD, at UTC noon). Imports nothing.
export function DDaddDays(date, amount) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function DDvalidDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    +date.slice(0, 4) < 1900
  )
    return false;
  const value = new Date(date + "T12:00:00Z");
  return Number.isFinite(+value) && value.toISOString().slice(0, 10) === date;
}


// Today (5.86.3, L5). A day can end after midnight: Settings › "A new day
// starts at" moves the change of day to 1 to 6 in the morning, for people
// who work late. The hour syncs with the preferences; this device keeps a
// copy so every part of the app agrees on the date, from the first moment.
const DDdayHourKey = "debug-day:day-starts";
export function DDdayStartHour() {
  try {
    const hour = Math.round(Number(localStorage.getItem(DDdayHourKey)));
    return hour >= 0 && hour <= 6 ? hour : 0;
  } catch {
    return 0;
  }
}
export function DDsetDayStartHour(hour) {
  const value = Math.round(Number(hour)) || 0;
  try {
    if (value > 0 && value <= 6) localStorage.setItem(DDdayHourKey, String(value));
    else localStorage.removeItem(DDdayHourKey);
  } catch {}
}
// Read from the clock on the wall, so a change to or from summer time never
// moves it: before the chosen hour it is still the day before.
export function DDtoday(now = new Date()) {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getHours() < DDdayStartHour() ? 1 : 0), 12);
  return at.getFullYear() + "-" + String(at.getMonth() + 1).padStart(2, "0") + "-" + String(at.getDate()).padStart(2, "0");
}

// The week starts on Saturday with the Persian calendar and on Monday with
// the Gregorian one (5.86.3, L6). The Calendar's choice on this device
// decides, not the app's language (the app speaks English now).
export function DDcalendarSystem(language) {
  try {
    const saved = JSON.parse(localStorage.getItem("debug-day:review-calendar"));
    if (saved === "persian" || saved === "gregory") return saved;
  } catch {}
  return language === "fa" ? "persian" : "gregory";
}
export const DDweekStartDay = (language) => (DDcalendarSystem(language) === "persian" ? 6 : 1);
