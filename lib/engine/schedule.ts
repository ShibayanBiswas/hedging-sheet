import { addDays, parseYmd, toYmd } from "@/lib/engine/dates";
import type { HedgeInputs, Underlying, ValidationIssue } from "@/lib/engine/types";

export const MIN_EXPIRIES = 1;
export const MAX_EXPIRIES = 12;

/** Days per month number. Summary G3:M3 = n × 30.5. */
export const DAYS_PER_MONTH = 30.5;

/**
 * Expiry weekday per index, for contracts expiring on or after 1 September 2025:
 * Nifty on Tuesday (NSE circular FAOP 68747, 25 June 2025) and Sensex on Thursday
 * (BSE notice 20250623-59, 23 June 2025).
 */
export const EXPIRY_WEEKDAY: Record<Underlying, number> = { Sensex: 4, Nifty: 2 };
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Keep earlier values when the count changes. */
export function resizeList<T>(current: T[], length: number, fill: T): T[] {
  return Array.from({ length }, (_, i) => current[i] ?? fill);
}

export function maturityDate(inputs: Pick<HedgeInputs, "valuationDate" | "tenorDays">): string {
  return addDays(inputs.valuationDate, Math.round(inputs.tenorDays));
}

/** The given weekday nearest to a date, in either direction. At most 3 days away, so there is no tie. */
export function nearestWeekday(ymd: string, weekday: number): string {
  const d = parseYmd(ymd);
  const forward = (weekday - d.getUTCDay() + 7) % 7;
  const shift = forward <= 3 ? forward : forward - 7;
  return toYmd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift)));
}

/** Raw date: valuation date plus round(m × 30.5) days. Summary G4 = G2 + G3. */
export function rawExpiryDate(valuationDate: string, monthNumber: number): string {
  return addDays(valuationDate, Math.round(monthNumber * DAYS_PER_MONTH));
}

/** Expiry for a month number: the expiry weekday nearest to the raw date. */
export function expiryForMonth(valuationDate: string, monthNumber: number, weekday: number): string {
  return nearestWeekday(rawExpiryDate(valuationDate, monthNumber), weekday);
}

export function expiryDates(
  inputs: Pick<HedgeInputs, "valuationDate" | "expiryMonths" | "expiryCount" | "underlying">,
): Array<string | null> {
  const weekday = EXPIRY_WEEKDAY[inputs.underlying];
  return Array.from({ length: inputs.expiryCount }, (_, i) => {
    const n = inputs.expiryMonths[i];
    if (n == null || !Number.isInteger(n) || n < 1) return null;
    return expiryForMonth(inputs.valuationDate, n, weekday);
  });
}

/** Median expiry; the lower middle one for an even count. Summary D15 = E12. */
export function medianExpiryIndex(count: number): number {
  return Math.max(0, Math.floor((count - 1) / 2));
}

export function validateSchedule(inputs: HedgeInputs): { dates: string[]; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  if (!(inputs.tenorDays > 0)) {
    errors.push({
      field: "tenorDays",
      code: "tenor",
      message: "Tenor in Days must be above zero.",
      fix: "Enter the product tenor in calendar days, such as 1940.",
    });
  }
  if (!Number.isInteger(inputs.expiryCount) || inputs.expiryCount < MIN_EXPIRIES || inputs.expiryCount > MAX_EXPIRIES) {
    errors.push({
      field: "expiryCount",
      code: "expiry-count",
      message: `The Number Of Expiry Dates must be a whole number from ${MIN_EXPIRIES} to ${MAX_EXPIRIES}.`,
      fix: `Use the stepper to pick a count from ${MIN_EXPIRIES} to ${MAX_EXPIRIES}.`,
    });
    return { dates: [], errors };
  }
  const months = inputs.expiryMonths.slice(0, inputs.expiryCount);
  months.forEach((n, i) => {
    if (n == null || Number.isNaN(n)) {
      errors.push({ field: `expiryMonths.${i}`, code: "expiry-blank", message: `Enter Expiry Month ${i + 1}.`, fix: "Type a whole month number such as 41." });
    } else if (!Number.isInteger(n) || n < 1) {
      errors.push({
        field: `expiryMonths.${i}`,
        code: "expiry-blank",
        message: `Expiry Month ${i + 1} must be a whole number of at least 1.`,
        fix: "Type a whole month number such as 41.",
      });
    }
  });
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1];
    const cur = months[i];
    if (Number.isInteger(prev) && Number.isInteger(cur) && !(cur! > prev!)) {
      errors.push({
        field: `expiryMonths.${i}`,
        code: "expiry-order",
        message: `Expiry Month ${i + 1} is ${cur}, which is not above Expiry Month ${i} at ${prev}. Month numbers must strictly increase.`,
        fix: `Enter a month number above ${prev} for Expiry Month ${i + 1}.`,
      });
    }
  }
  const dates = expiryDates(inputs);
  if (inputs.tenorDays > 0) {
    const maturity = maturityDate(inputs);
    dates.forEach((d, i) => {
      if (d && parseYmd(d).getTime() > parseYmd(maturity).getTime()) {
        errors.push({
          field: `expiryMonths.${i}`,
          code: "expiry-maturity",
          message: `Expiry ${i + 1} falls after the maturity date.`,
          fix: "Lower the month number or lengthen the tenor.",
        });
      }
    });
  }
  return { dates: dates.filter((d): d is string => Boolean(d)), errors };
}
