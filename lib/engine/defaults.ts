import pricingSeed from "@/lib/data/pricing-params-seed.json";
import { istTodayYmd, isValidYmd } from "@/lib/engine/dates";
import { defaultRateCurve } from "@/lib/engine/rates";
import { expiryForMonth } from "@/lib/engine/schedule";
import { derivedSides } from "@/lib/engine/structure";
import type { DividendPoint, HedgeInputs, MarketData, PricingParams, RatePoint, Underlying } from "@/lib/engine/types";
import { normalizeVolSurface, SEED_SURFACE } from "@/lib/engine/vol-surface";

/** Used only when the Yahoo history cannot be read. */
const FALLBACK_DAILY_VOL = 0.009;

/** The product terms. Spot, valuation date and daily volatility come from live data. */
const DEFAULT_TERMS = {
  startLevelUplift: 0.006,
  startLevelRounding: 100,
  nbfcRate: 0.08,
  premiumRate: 0.065,
  marginGrowthRate: 0.06579,
  coupon: 1.025,
  decay: 1.6,
  tenorDays: 1940,
  strikePercents: [137, 127, 125, 85, 84, 70],
  participations: [1, null] as Array<number | null>,
  floorUnits: 1,
  /** Months from the valuation date to each default expiry, the Summary Sheet's H3 to M3 helpers. */
  expiryMonths: [41, 44, 47, 50, 53, 56],
  notionalCr: 100,
  transactionCost: 0.0225,
  issuanceCost: 0.0013,
  marginCost: 0,
  exposureMargin: 0.05,
  futuresMargin: 0.2,
  exchangeForwardRate: 0.0348,
  exchangeDiscountRate: 0.0348,
  stressedForwardRate: 0.0348,
  stressedDiscountRate: 0.0348,
  stressSigmas: 6,
  stressDays: 2,
  stressVolMultiplier: 1.25,
  historyWindowDays: 365,
};

/** The default expiries for a valuation date: the last expiry weekday of each helper month. */
export function defaultExpiryDates(valuationDate: string, underlying: Underlying): string[] {
  if (!isValidYmd(valuationDate)) return DEFAULT_TERMS.expiryMonths.map(() => "");
  return DEFAULT_TERMS.expiryMonths.map((m) => expiryForMonth(valuationDate, m, underlying));
}

export function defaultInputs(options?: { valuationDate?: string; spot?: number; dailyVol?: number }): HedgeInputs {
  const spot = options?.spot ?? NaN;
  const valuationDate = options?.valuationDate ?? istTodayYmd();
  return {
    underlying: "Sensex",
    valuationDate,
    spot,
    startLevelUplift: DEFAULT_TERMS.startLevelUplift,
    startLevelRounding: DEFAULT_TERMS.startLevelRounding,
    nbfcRate: DEFAULT_TERMS.nbfcRate,
    premiumRate: DEFAULT_TERMS.premiumRate,
    marginGrowthRate: DEFAULT_TERMS.marginGrowthRate,
    coupon: DEFAULT_TERMS.coupon,
    decay: DEFAULT_TERMS.decay,
    tenorDays: DEFAULT_TERMS.tenorDays,
    strikePercents: [...DEFAULT_TERMS.strikePercents],
    participations: [...DEFAULT_TERMS.participations],
    floorUnits: DEFAULT_TERMS.floorUnits,
    strikeOptionTypes: DEFAULT_TERMS.strikePercents.map(() => "P" as const),
    strikeSides: derivedSides(DEFAULT_TERMS),
    expiryCount: DEFAULT_TERMS.expiryMonths.length,
    expiryDates: defaultExpiryDates(valuationDate, "Sensex"),
    hedgeExpiryIndex: null,
    notionalCr: DEFAULT_TERMS.notionalCr,
    transactionCost: DEFAULT_TERMS.transactionCost,
    issuanceCost: DEFAULT_TERMS.issuanceCost,
    marginCost: DEFAULT_TERMS.marginCost,
    dailyVol: options?.dailyVol ?? FALLBACK_DAILY_VOL,
    dailyVolSource: options?.dailyVol != null ? "calculated" : "fallback",
    historyWindowDays: DEFAULT_TERMS.historyWindowDays,
    exposureMargin: DEFAULT_TERMS.exposureMargin,
    futuresMargin: DEFAULT_TERMS.futuresMargin,
    hedgeStrike: Number.isFinite(spot) ? autoHedgeStrike(spot, "Sensex") : NaN,
    hedgeStrikeAuto: true,
    exchangeForwardRate: DEFAULT_TERMS.exchangeForwardRate,
    exchangeDiscountRate: DEFAULT_TERMS.exchangeDiscountRate,
    stressedForwardRate: DEFAULT_TERMS.stressedForwardRate,
    stressedDiscountRate: DEFAULT_TERMS.stressedDiscountRate,
    stressSigmas: DEFAULT_TERMS.stressSigmas,
    stressDays: DEFAULT_TERMS.stressDays,
    stressVolMultiplier: DEFAULT_TERMS.stressVolMultiplier,
    legVolOverrides: {},
    hedgeVolOverride: null,
  };
}

/** Older stored params carried a dated curve; the curve is now tenor points anchored at the valuation date. */
export function normalizePricingParams(raw: Partial<PricingParams> & { rateCurve?: unknown[] }): PricingParams {
  const curve = Array.isArray(raw.rateCurve) && raw.rateCurve.every((p) => typeof (p as RatePoint).years === "number")
    ? (raw.rateCurve as RatePoint[])
    : defaultRateCurve();
  return {
    forwardSellRate: Number(raw.forwardSellRate ?? pricingSeed.forwardSellRate),
    premiumRateSpread: Number(raw.premiumRateSpread ?? pricingSeed.premiumRateSpread),
    rateCapBuyingForward: Number(raw.rateCapBuyingForward ?? pricingSeed.rateCapBuyingForward),
    dividendBidOfferMultiplier: Number(raw.dividendBidOfferMultiplier ?? pricingSeed.dividendBidOfferMultiplier),
    bidOffer: raw.bidOffer === "O" ? "O" : "B",
    rateCurve: curve,
    dividends: (raw.dividends ?? pricingSeed.dividends) as DividendPoint[],
  };
}

export function seedPricingParams(): PricingParams {
  return normalizePricingParams(pricingSeed as unknown as PricingParams);
}

export function seedMarketData(): MarketData {
  return { surface: normalizeVolSurface(SEED_SURFACE), params: seedPricingParams() };
}

/** Rounds up to the next 100, treating float noise such as 74,600.0000001 as the exact multiple. */
function ceilTo100(x: number): number {
  return Math.ceil(Math.round(x * 1e6) / 1e6 / 100) * 100;
}

/**
 * The desk's hedge strike from the spot: Nifty spot plus 150, Sensex spot times 1.006, each rounded up to the
 * next 100. The Sensex rule is the Start Level's, Pricer B5 = ROUNDUP(D3 × 1.006, −2).
 */
export function autoHedgeStrike(spot: number, underlying: Underlying): number {
  return ceilTo100(underlying === "Nifty" ? spot + 150 : spot * 1.006);
}
