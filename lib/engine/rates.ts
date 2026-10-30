import { addDays, daysBetween, excelSerial } from "@/lib/engine/dates";
import type { BidOffer, DividendPoint, OptionType, PricingParams, RatePoint } from "@/lib/engine/types";

/** Default tenors of the dynamic curve, in years from the valuation date. */
const DEFAULT_CURVE_TENORS = [0, 1, 2, 3, 5, 7, 10];

export function defaultRateCurve(): RatePoint[] {
  return DEFAULT_CURVE_TENORS.map((years) => ({ years, ratePercent: 6.5, linkedToPremiumRate: true }));
}

export type CurveRead = {
  upperMaturity: string | null;
  lowerMaturity: string | null;
  upperForward: number | null;
  lowerForward: number | null;
  rate: number;
};

/** Curve rate as a fraction. Points linked to the Premium Growth Rate follow it, as MarketData D32:D34 do. */
function resolvedRate(point: RatePoint, premiumRate: number): number {
  return point.linkedToPremiumRate ? premiumRate : point.ratePercent / 100;
}

export type DatedRate = { date: string; rate: number };

/**
 * The curve anchored at the valuation date (MarketData B26:D64). The last point is
 * repeated one year past the longest maturity so a Lower Maturity always exists.
 */
export function anchoredCurve(curve: RatePoint[], valuationDate: string, premiumRate: number, longestMaturity?: string): DatedRate[] {
  const points = [...curve]
    .filter((p) => Number.isFinite(p.years) && p.years >= 0)
    .sort((a, b) => a.years - b.years)
    .map((p) => ({ date: addDays(valuationDate, Math.round(p.years * 365)), rate: resolvedRate(p, premiumRate) }));
  if (!points.length) points.push({ date: valuationDate, rate: premiumRate });
  if (longestMaturity) {
    const last = points[points.length - 1]!;
    if (excelSerial(last.date) <= excelSerial(longestMaturity)) {
      points.push({ date: addDays(longestMaturity, 365), rate: last.rate });
    }
  }
  return points;
}

/**
 * Pricer rows 21 to 24 and 29.
 * B21 Upper Maturity = INDEX(dates, MATCH(maturity, dates)): the last curve date on or before maturity.
 * B22 Lower Maturity = the next curve date.
 * B23, B24 = VLOOKUP of each date on the curve.
 * The rate is FORECAST(maturity, B23:B24, B21:B22), or the upper rate when the two forwards are equal.
 */
export function readRateCurve(points: DatedRate[], maturity: string): CurveRead {
  if (!points.length) return { upperMaturity: null, lowerMaturity: null, upperForward: null, lowerForward: null, rate: NaN };
  const m = excelSerial(maturity);
  let upperIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (excelSerial(points[i]!.date) <= m) upperIdx = i;
    else break;
  }
  const upper = points[upperIdx]!;
  const lower = points[upperIdx + 1] ?? null;
  const upperForward = upper.rate;
  const lowerForward = lower ? lower.rate : upperForward;
  let rate = upperForward;
  if (lower && upperForward !== lowerForward) {
    const x0 = excelSerial(upper.date);
    const x1 = excelSerial(lower.date);
    const slope = (lowerForward - upperForward) / (x1 - x0);
    const intercept = (upperForward + lowerForward) / 2 - (slope * (x0 + x1)) / 2;
    rate = intercept + slope * m;
  }
  return {
    upperMaturity: upper.date,
    lowerMaturity: lower ? lower.date : null,
    upperForward,
    lowerForward,
    rate,
  };
}

/** 'Pricing Params'!O2 = MarketData!D34 ÷ 100: the rate cap while selling forward is the last curve rate. */
export function rateCapSellingForward(params: PricingParams, premiumRate: number): number {
  const points = [...params.rateCurve].sort((a, b) => a.years - b.years);
  const last = points[points.length - 1];
  return last ? resolvedRate(last, premiumRate) : premiumRate;
}

/**
 * Pricer B29: MIN(cap, FORECAST(...)). A put bought on Bid and a call on Offer take the
 * selling-forward cap 'Pricing Params'!O2; the other two take the buying-forward cap N2.
 */
export function pricerDiscountYield(curveRate: number, type: OptionType, bidOffer: BidOffer, params: PricingParams, premiumRate: number): number {
  const buyingCap = params.rateCapBuyingForward;
  const sellingCap = rateCapSellingForward(params, premiumRate);
  if (type === "P") return Math.min(bidOffer === "O" ? buyingCap : sellingCap, curveRate);
  return Math.min(bidOffer === "O" ? sellingCap : buyingCap, curveRate);
}

/**
 * Pricer B30 = SUMIF(MarketData!I:I, "<" & maturity, J:J) ÷ spot × 365 ÷ days × the
 * 'Pricing Params'!M2 bid or offer factor. The sum runs from the start of the dividend list.
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
