import { defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { derivedSides } from "@/lib/engine/structure";
import type { HedgeInputs, HedgingResult, MarketData } from "@/lib/engine/types";

/** A fixed day and close so tests do not depend on today's market. */
export const FIXTURE_DATE = "2026-10-27";
const FIXTURE_SPOT = 82000;

/** Defaults with overrides. A structure change without its own sides takes the sides the payoff needs, all puts. */
export function fixtureInputs(overrides: Partial<HedgeInputs> = {}): HedgeInputs {
  const merged = { ...defaultInputs({ valuationDate: FIXTURE_DATE, spot: FIXTURE_SPOT, dailyVol: 0.009 }), ...overrides };
  return {
    ...merged,
    strikeOptionTypes: overrides.strikeOptionTypes ?? merged.strikePercents.map(() => "P"),
    strikeSides: overrides.strikeSides ?? derivedSides(merged),
  };
}

export function priced(overrides: Partial<HedgeInputs> = {}, market: MarketData = seedMarketData()): HedgingResult {
  const r = computeHedgingSheet(fixtureInputs(overrides), market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}
