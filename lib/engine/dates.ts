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

/** A real calendar date: 2026-13-45 is rejected rather than rolled into 2027. */
export function isValidYmd(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  const d = parseYmd(value);
  return !Number.isNaN(d.getTime()) && toYmd(d) === value.slice(0, 10);
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** DD-MMM-YYYY, or "-" for a blank date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = parseYmd(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** The desk clock. In TEST_MODE=mock the server runs at TEST_NOW so every run is reproducible. */
export function deskNow(): Date {
  if (typeof window === "undefined" && typeof process !== "undefined" && process.env.TEST_MODE === "mock") {
    return new Date(process.env.TEST_NOW ?? "2026-10-28T04:30:00.000Z");
  }
  return new Date();
}

/** Asia/Kolkata calendar date. */
export function istTodayYmd(now: Date = deskNow()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
