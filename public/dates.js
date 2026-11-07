// Shared UTC noon date helpers (YYYY-MM-DD). Imports nothing.
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

