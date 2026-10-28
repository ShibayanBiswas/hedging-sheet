import { defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs, HedgingResult, MarketData } from "@/lib/engine/types";

/** A fixed day and close so tests do not depend on today's market. */
export const FIXTURE_DATE = "2026-10-27";
const FIXTURE_SPOT = 82000;

export function fixtureInputs(overrides: Partial<HedgeInputs> = {}): HedgeInputs {
  return { ...defaultInputs({ valuationDate: FIXTURE_DATE, spot: FIXTURE_SPOT, dailyVol: 0.009 }), ...overrides };
}

export function priced(overrides: Partial<HedgeInputs> = {}, market: MarketData = seedMarketData()): HedgingResult {
  const r = computeHedgingSheet(fixtureInputs(overrides), market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}
