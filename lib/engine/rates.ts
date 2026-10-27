import { daysBetween, excelSerial, parseYmd } from "@/lib/engine/dates";
import type { BidOffer, DividendPoint, OptionType, PricingParams, RatePoint } from "@/lib/engine/types";

export type CurveRead = {
  upperMaturity: string | null;
  lowerMaturity: string | null;
  upperForward: number | null;
  lowerForward: number | null;
  rate: number;
};

/** Curve rate as a fraction. Points linked to the Premium Growth Rate follow it. */
export function resolvedRate(point: RatePoint, premiumRate: number): number {
  return point.linkedToPremiumRate ? premiumRate : point.ratePercent / 100;
}

function sortedCurve(curve: RatePoint[]): RatePoint[] {
  return [...curve].sort((a, b) => parseYmd(a.date).getTime() - parseYmd(b.date).getTime());
}

/**
 * Upper Maturity is the last curve date on or before the maturity, Lower Maturity the next one.
 * The rate is a straight line through those two points, or the upper rate when there is no lower one.
 */
export function readRateCurve(curve: RatePoint[], maturity: string, premiumRate: number): CurveRead {
  const points = sortedCurve(curve);
  if (!points.length) {
    return { upperMaturity: null, lowerMaturity: null, upperForward: null, lowerForward: null, rate: premiumRate };
  }
  const m = excelSerial(maturity);
  const first = points[0]!;
  let upperIdx = 0;
  if (m > excelSerial(first.date)) {
    for (let i = 0; i < points.length; i++) {
      if (excelSerial(points[i]!.date) <= m) upperIdx = i;
      else break;
    }
  }
  const upper = points[upperIdx]!;
  let lower: RatePoint | null;
  if (excelSerial(upper.date) > excelSerial(first.date)) lower = points[upperIdx + 1] ?? null;
  else lower = first;

  const upperForward = resolvedRate(upper, premiumRate);
  const lowerForward = lower ? resolvedRate(lower, premiumRate) : upperForward;
  let rate = upperForward;
  if (lower && upperForward !== lowerForward) {
    const x0 = excelSerial(upper.date);
    const x1 = excelSerial(lower.date);
    const slope = (lowerForward - upperForward) / (x1 - x0);
    const intercept = (upperForward + lowerForward) / 2 - (slope * (x0 + x1)) / 2;
    rate = intercept + slope * m;
  }
  return {
    upperMaturity: upper.date.slice(0, 10),
    lowerMaturity: lower ? lower.date.slice(0, 10) : null,
    upperForward,
    lowerForward: lower ? lowerForward : upperForward,
    rate,
  };
}

/** Rate cap while selling forward: the last curve point, as Pricing Params O2 reads it. */
export function rateCapSellingForward(params: PricingParams, premiumRate: number): number {
  const points = sortedCurve(params.rateCurve);
  const last = points[points.length - 1];
  return last ? resolvedRate(last, premiumRate) : premiumRate;
}

/** Pricer discount yield: the curve rate capped by the Pricing Params rate caps. */
export function pricerDiscountYield(
  curveRate: number,
  type: OptionType,
  bidOffer: BidOffer,
  params: PricingParams,
  premiumRate: number,
): number {
  const buyingCap = params.rateCapBuyingForward;
  const sellingCap = rateCapSellingForward(params, premiumRate);
  if (type === "P") return Math.min(bidOffer === "O" ? buyingCap : sellingCap, curveRate);
  return Math.min(bidOffer === "O" ? sellingCap : buyingCap, curveRate);
}

/**
 * Dividend yield: every implied dividend dated before maturity, over the spot,
 * annualised over the days to maturity. The workbook sums from the start of the list.
 */
export function dividendYield(
  dividends: DividendPoint[],
  maturity: string,
  valuationDate: string,
  spot: number,
  scale: number,
  multiplier: number,
): number {
  const m = excelSerial(maturity);
  let sum = 0;
  for (const d of dividends) {
    if (excelSerial(d.date) < m) sum += d.amount * scale;
  }
  const days = daysBetween(valuationDate, maturity);
  if (!(days > 0) || !(spot > 0)) return 0;
  return ((sum / spot) * 365) / days * multiplier;
}
