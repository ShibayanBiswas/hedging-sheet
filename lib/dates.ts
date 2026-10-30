/** Calendar rules for expiries. Dates are YYYY-MM-DD in UTC. */

const pad = (n: number) => String(n).padStart(2, "0");

/** The last given weekday, 0 Sunday to 6 Saturday, of a month numbered 1 to 12. */
export function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const back = (last.getUTCDay() - weekday + 7) % 7;
  return `${year}-${pad(month)}-${pad(last.getUTCDate() - back)}`;
}

/** The last Thursday of a month numbered 1 to 12: the monthly Sensex expiry. */
export function lastThursday(year: number, month: number): string {
  return lastWeekdayOfMonth(year, month, 4);
}

/** Moves a date to the last given weekday of its own month. */
export function snapToLastWeekday(ymd: string, weekday: number): string {
  const [y, m] = ymd.split("-").map(Number) as [number, number];
  return lastWeekdayOfMonth(y, m, weekday);
}
