import { lastWeekdayOfMonth, snapToLastWeekday } from "@/lib/dates";
import { addDays, isValidYmd, parseYmd } from "@/lib/engine/dates";
import type { HedgeInputs, Underlying, ValidationIssue } from "@/lib/engine/types";

export const MIN_EXPIRIES = 1;
export const MAX_EXPIRIES = 10;

/** Days per month number, the Summary Sheet's G3 to M3 helper: n × 30.5. Internal only. */
const DAYS_PER_MONTH = 30.5;

/**
 * Expiry weekday per index: every expiry is the last one of its month. Sensex expires on the last Thursday,
 * as every typed expiry in the reference workbook does; Nifty on the last Tuesday, under NSE circular
 * FAOP 68747 of 25 June 2025.
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

/** The expiry for a month number: the last expiry weekday of the month that valuation date + round(m × 30.5) days falls in. */
export function expiryForMonth(valuationDate: string, monthNumber: number, underlying: Underlying): string {
  const raw = addDays(valuationDate, Math.round(monthNumber * DAYS_PER_MONTH));
  const d = parseYmd(raw);
  return lastWeekdayOfMonth(d.getUTCFullYear(), d.getUTCMonth() + 1, EXPIRY_WEEKDAY[underlying]);
}

/** Moves any typed date to its month's last expiry weekday for the underlying. */
export function snapExpiry(ymd: string, underlying: Underlying): string {
  return snapToLastWeekday(ymd, EXPIRY_WEEKDAY[underlying]);
}

/** N expiries 3 months apart from the first one's month, each its month's last expiry weekday: Jan, Apr, Jul, Oct. */
export function quarterlyExpiries(first: string, count: number, underlying: Underlying): string[] {
  const d = parseYmd(first);
  return Array.from({ length: count }, (_, i) => {
    const m = d.getUTCMonth() + 3 * i;
    return lastWeekdayOfMonth(d.getUTCFullYear() + Math.floor(m / 12), (m % 12) + 1, EXPIRY_WEEKDAY[underlying]);
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
      fix: `Pick a count from ${MIN_EXPIRIES} to ${MAX_EXPIRIES}.`,
    });
    return { dates: [], errors };
  }
  const dates = inputs.expiryDates.slice(0, inputs.expiryCount);
  dates.forEach((d, i) => {
    if (!d || !isValidYmd(d)) {
      errors.push({ field: `expiryDates.${i}`, code: "expiry-blank", message: `Enter Expiry ${i + 1}.`, fix: "Type a date; it moves to the last expiry day of its month." });
    } else if (!(d > inputs.valuationDate)) {
      errors.push({ field: `expiryDates.${i}`, code: "expiry-past", message: `Expiry ${i + 1} must fall after the Valuation Date.`, fix: "Pick a later month." });
    }
  });
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const cur = dates[i];
    if (prev && cur && isValidYmd(prev) && isValidYmd(cur) && !(cur > prev)) {
      errors.push({
        field: `expiryDates.${i}`,
        code: "expiry-order",
        message: `Expiry ${i + 1} does not fall after Expiry ${i}. Expiries must be in strictly ascending order.`,
        fix: `Pick a month after Expiry ${i}.`,
      });
    }
  }
  if (inputs.tenorDays > 0) {
    const maturity = maturityDate(inputs);
    dates.forEach((d, i) => {
      if (d && isValidYmd(d) && d > maturity) {
        errors.push({ field: `expiryDates.${i}`, code: "expiry-maturity", message: `Expiry ${i + 1} falls after the maturity date.`, fix: "Pick an earlier month or lengthen the tenor." });
      }
    });
  }
  return { dates: dates.filter((d) => isValidYmd(d)), errors };
}
