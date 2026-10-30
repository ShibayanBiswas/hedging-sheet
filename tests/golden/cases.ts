import { defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { derivedSides } from "@/lib/engine/structure";
import type { HedgeInputs, HedgingResult, MarketData } from "@/lib/engine/types";

/**
 * The reference workbook's own run: trade date 04-Aug-2026, close 76,799 and the forward growth it pinned to 5.5%
 * in 'Pricing Params'!H69. The default expiries come from the app's own rule and equal the typed ones.
 */
export const G0_OPTIONS = { forwardGrowth: 0.055 };

export function g0Inputs(): HedgeInputs {
  return { ...defaultInputs({ valuationDate: "2026-08-04", spot: 76799, dailyVol: 0.00895071 }), hedgeStrike: 76800 };
}

export function run(inputs: HedgeInputs, market: MarketData = seedMarketData(), options?: Parameters<typeof computeHedgingSheet>[2]): HedgingResult {
  const r = computeHedgingSheet(inputs, market, options);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

/** A product built from G0 with new terms. Sides follow the payoff unless given. */
export function product(overrides: Partial<HedgeInputs>): HedgeInputs {
  const merged = { ...g0Inputs(), ...overrides };
  return {
    ...merged,
    strikeOptionTypes: overrides.strikeOptionTypes ?? merged.strikePercents.map(() => "P"),
    strikeSides: overrides.strikeSides ?? derivedSides(merged),
  };
}
