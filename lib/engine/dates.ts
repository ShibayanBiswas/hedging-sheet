function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC midnight for a YYYY-MM-DD (or ISO) string. */
export function parseYmd(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function toYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function isValidYmd(value: string | null | undefined): value is string {
  return typeof value === "string" && !Number.isNaN(parseYmd(value).getTime());
}

/** Excel 1900 serial for a date, matching worksheet day arithmetic. */
export function excelSerial(value: string): number {
  return Math.round((parseYmd(value).getTime() - Date.UTC(1899, 11, 30)) / 86_400_000);
}

/** Whole calendar days from a to b. */
export function daysBetween(a: string, b: string): number {
  return excelSerial(b) - excelSerial(a);
}

export function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  return toYmd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)));
}

/** Last given weekday (0 Sunday … 6 Saturday) of the month `months` after the month of `from`. */
export function lastWeekdayOfMonthAfter(from: string, months: number, weekday: number): string {
  const d = parseYmd(from);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const back = (lastDay.getUTCDay() - weekday + 7) % 7;
  return toYmd(new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate() - back)));
}

/** Calendar months from the month of a to the month of b. */
export function monthsBetween(a: string, b: string): number {
  const da = parseYmd(a);
  const db = parseYmd(b);
  return (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** DD-MMM-YYYY, or "-" for a blank date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = parseYmd(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Asia/Kolkata calendar date. */
export function istTodayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
