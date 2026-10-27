import { addDays, isValidYmd, lastWeekdayOfMonthAfter, parseYmd } from "@/lib/engine/dates";
import type { HedgeInputs, ValidationIssue } from "@/lib/engine/types";

export const MAX_EXPIRIES = 10;

/** Keep earlier values when the count changes, as the probability calculator does. */
export function resizeList<T>(current: T[], length: number, fill: T): T[] {
  return Array.from({ length }, (_, i) => current[i] ?? fill);
}

export function maturityDate(inputs: Pick<HedgeInputs, "valuationDate" | "tenorDays">): string {
  return addDays(inputs.valuationDate, Math.round(inputs.tenorDays));
}

/** Expiry date for each month number: the last expiry weekday of that month, or the manual override. */
export function expiryDates(
  inputs: Pick<HedgeInputs, "valuationDate" | "expiryMonths" | "expiryOverrides" | "expiryWeekday" | "expiryCount">,
): Array<string | null> {
  return Array.from({ length: inputs.expiryCount }, (_, i) => {
    const override = inputs.expiryOverrides[i];
    if (override && isValidYmd(override)) return override.slice(0, 10);
    const n = inputs.expiryMonths[i];
    if (n == null || !Number.isInteger(n) || n < 0) return null;
    return lastWeekdayOfMonthAfter(inputs.valuationDate, n, inputs.expiryWeekday);
  });
}

/** Median expiry; the lower middle one for an even count. */
export function medianExpiryIndex(count: number): number {
  return Math.max(0, Math.floor((count - 1) / 2));
}

export function validateSchedule(inputs: HedgeInputs): { dates: string[]; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  if (!Number.isInteger(inputs.expiryCount) || inputs.expiryCount < 1 || inputs.expiryCount > MAX_EXPIRIES) {
    errors.push({ field: "expiryCount", message: `The Number Of Expiry Dates must be a whole number from 1 to ${MAX_EXPIRIES}.` });
    return { dates: [], errors };
  }
  const maturity = maturityDate(inputs);
  const dates = expiryDates(inputs);
  inputs.expiryMonths.slice(0, inputs.expiryCount).forEach((n, i) => {
    if (inputs.expiryOverrides[i]) return;
    if (n == null || Number.isNaN(n)) {
      errors.push({ field: `expiryMonths.${i}`, message: `Enter Expiry Month ${i + 1}.` });
    } else if (!Number.isInteger(n) || n < 1) {
      errors.push({ field: `expiryMonths.${i}`, message: `Expiry Month ${i + 1} must be a whole number of at least 1.` });
    }
  });
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const cur = dates[i];
    if (prev && cur && parseYmd(cur).getTime() <= parseYmd(prev).getTime()) {
      errors.push({
        field: `expiryMonths.${i}`,
        message: `Expiry ${i + 1} must fall after Expiry ${i}. Month numbers must be strictly increasing.`,
      });
    }
  }
  dates.forEach((d, i) => {
    if (d && parseYmd(d).getTime() > parseYmd(maturity).getTime()) {
      errors.push({ field: `expiryMonths.${i}`, message: `Expiry ${i + 1} falls after the maturity date.` });
    }
    if (d && parseYmd(d).getTime() <= parseYmd(inputs.valuationDate).getTime()) {
      errors.push({ field: `expiryMonths.${i}`, message: `Expiry ${i + 1} must fall after the valuation date.` });
    }
  });
  return { dates: dates.filter((d): d is string => Boolean(d)), errors };
}
