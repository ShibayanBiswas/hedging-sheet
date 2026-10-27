import pricingSeed from "@/lib/data/pricing-params-seed.json";
import defaults from "@/lib/data/workbook-defaults.json";
import { monthsBetween } from "@/lib/engine/dates";
import { medianExpiryIndex } from "@/lib/engine/schedule";
import type { HedgeInputs, MarketData, PricingParams, Underlying } from "@/lib/engine/types";
import { normalizeVolSurface, SEED_SURFACE } from "@/lib/engine/vol-surface";

/**
 * Monthly expiry weekday per index, for contracts expiring on or after 1 September 2025:
 * Nifty on the last Tuesday (NSE circular FAOP 68747, 25 June 2025) and Sensex on the last
 * Thursday (BSE notice 20250623-59, 23 June 2025).
 */
export const EXPIRY_WEEKDAY: Record<Underlying, number> = { Sensex: 4, Nifty: 2 };

export const WORKBOOK_VALUATION_DATE = defaults.valuationDate;
export const WORKBOOK_SPOT = Number(defaults.spot);

export function workbookDefaultInputs(): HedgeInputs {
  const expiryMonths = defaults.expiryDates.map((d) => monthsBetween(defaults.valuationDate, d));
  const count = expiryMonths.length;
  // The workbook hedge expiry is the lower median of six, so the median default reproduces it.
  const hedgeIdx = defaults.hedgeExpiry ? defaults.expiryDates.indexOf(defaults.hedgeExpiry) : -1;
  const hedgeIsMedian = hedgeIdx === medianExpiryIndex(count);
  return {
    mode: "workbook",
    underlying: "Sensex",
    valuationDate: defaults.valuationDate,
    spot: Number(defaults.derivedSpot ?? defaults.spot),
    startLevelUplift: defaults.startLevelUplift,
    startLevelRounding: defaults.startLevelRounding,
    nbfcRate: Number(defaults.nbfcRate),
    premiumRate: Number(defaults.premiumRate),
    marginGrowthRate: Number(defaults.marginGrowthRate),
    target: Number(defaults.target),
    coupon: Number(defaults.coupon),
    protection: Number(defaults.protection),
    decay: Number(defaults.decay),
    tenorDays: Number(defaults.tenorDays),
    expiryCount: count,
    expiryMonths,
    expiryOverrides: expiryMonths.map(() => null),
    expiryWeekday: EXPIRY_WEEKDAY.Sensex,
    hedgeExpiryIndex: hedgeIdx >= 0 && !hedgeIsMedian ? hedgeIdx : null,
    spreads: defaults.spreads.map((s) => ({
      buy: Number(s.buy),
      sell: Number(s.sell),
      participation: Number(s.participation),
    })),
    autoParticipation: true,
    outflowWidth: defaults.outflowWidth,
    floorLevel: defaults.floorLevel,
    floorUnits: Number(defaults.floorUnits ?? 1),
    notionalCr: Number(defaults.notionalCr),
    transactionCost: Number(defaults.transactionCost),
    issuanceCost: Number(defaults.issuanceCost),
    marginCost: Number(defaults.marginCost),
    dailyVol: Number(defaults.dailyVol),
    exposureMargin: Number(defaults.exposureMargin),
    futuresMargin: Number(defaults.futuresMargin),
    hedgeStrike: Number(defaults.hedgeStrike),
    hedgeStrikeAuto: false,
    exchangeForwardRate: Number(defaults.exchangeForwardRate),
    exchangeDiscountRate: Number(defaults.exchangeDiscountRate),
    stressedForwardRate: Number(defaults.stressedForwardRate),
    stressedDiscountRate: Number(defaults.stressedDiscountRate),
    stressSigmas: defaults.stressSigmas,
    stressDays: defaults.stressDays,
    stressVolMultiplier: defaults.stressVolMultiplier,
    volBump: 0,
    bidOffer: "B",
  };
}

export function seedPricingParams(): PricingParams {
  return {
    forwardSellRate: pricingSeed.forwardSellRate,
    premiumRateSpread: pricingSeed.premiumRateSpread,
    rateCapBuyingForward: pricingSeed.rateCapBuyingForward,
    dividendBidOfferMultiplier: pricingSeed.dividendBidOfferMultiplier,
    rateCurve: pricingSeed.rateCurve,
    dividends: pricingSeed.dividends,
  };
}

export function seedMarketData(): MarketData {
  return { surface: normalizeVolSurface(SEED_SURFACE), params: seedPricingParams() };
}

/** Listed hedge strike for a spot: the nearest 100 point strike. */
export function autoHedgeStrike(spot: number): number {
  return Math.round(spot / 100) * 100;
}
