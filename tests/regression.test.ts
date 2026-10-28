import { describe, expect, it } from "vitest";

import { defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgingResult } from "@/lib/engine/types";
import { forwardMarket } from "@/lib/engine/vol-surface";

function run(...args: Parameters<typeof computeHedgingSheet>): HedgingResult {
  const r = computeHedgingSheet(...args);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

/**
 * Frozen regression fixture, hand-checked against the approved desk numbers. The saved sheet typed its
 * expiries and pinned the Pricer forward growth to 'Pricing Params'!H69 (5.5%), so both are explicit here.
 * The expiry rule of the app gives different dates, so the app's live run is not expected to match these.
 */
describe("frozen regression at spot 76,799 and the 76,835.78 surface anchor", () => {
  const inputs = { ...defaultInputs({ valuationDate: "2026-08-04", spot: 76799, dailyVol: 0.00895071 }), hedgeStrike: 76800 };
  const r = run(inputs, seedMarketData(), {
    expiryDates: ["2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24"],
    forwardGrowth: 0.055,
  });
  const g = r.productDescription.greeks;

  it("ties out the pots", () => {
    expect(r.summary.actualInbuilt).toBeCloseTo(0.079499, 6);
    expect(r.summary.totalPremiumCr).toBeCloseTo(50.67, 2);
    expect(r.productDescription.maturityCr).toBeCloseTo(202.5, 9);
    expect(r.summary.margin * r.inputs.notionalCr).toBeCloseTo(32.31, 2);
    expect(r.structure.startLevel).toBe(77300);
    expect(r.summary.hedgeExpiry).toBe("2030-07-25");
  });

  it("ties out the Greek Details", () => {
    expect(g.hedgeQuantity).toBeCloseTo(-12809.67, 2);
    expect(Math.round(g.totalDelta)).toBe(16880);
    expect(g.hedgePremiumCr).toBeCloseTo(4.55, 2);
    expect(Math.round(g.optionsDelta)).toBe(2512);
    expect(Math.round(g.residualFutures)).toBe(14368);
    expect(g.vegaWeightedVol).toBeCloseTo(0.0781, 4);
    expect(g.vegaCr).toBeCloseTo(0.54, 2);
    expect(g.rhoWeightedForward).toBeCloseTo(0.055, 9);
    expect(g.rhoCr).toBeCloseTo(-7.09, 2);
    expect(g.leverage).toBe(1.6);
    expect(g.targetLevel).toBeCloseTo(0.37, 12);
  });
});

/**
 * Live spot 73,598.67 on 28-Oct-2026 with the October surface anchor 71,909.70. Round 1 used last-Thursday
 * expiries and the full dividend list, which is where 12,320.29 and 8.86% come from.
 */
describe("live spot chain at 73,598.67", () => {
  const seed = seedMarketData();
  const october = { ...seed, surface: { ...seed.surface, referenceSensexPrice: 71909.7 } };
  const inputs = defaultInputs({ valuationDate: "2026-10-28", spot: 73598.67, dailyVol: 0.008837005682952256 });
  const roundOneDates = ["2030-03-28", "2030-06-27", "2030-09-26", "2030-12-26", "2031-03-27", "2031-06-26"];

  it("reproduces the Round 1 figures with Round 1 dates and the full dividend list", () => {
    const r = run(inputs, october, { expiryDates: roundOneDates });
    expect(r.dayOneVegaHedge.quantity).toBeCloseTo(12320.29, 2);
    expect(r.summary.actualInbuilt).toBeCloseTo(0.088564, 6);
  });

  it("moves with the expiry rule and future dividends, as the app runs it", () => {
    const r = run(inputs, forwardMarket(october, "2026-10-28"));
    expect(r.summary.hedgeExpiry).toBe("2030-10-03");
    expect(r.dayOneVegaHedge.quantity).toBeCloseTo(12863.31, 2);
    expect(r.summary.actualInbuilt).toBeCloseTo(0.08648, 5);
  });

  it("re-derives vega, quantity, premium, option delta and residual futures by hand", () => {
    const r = run(inputs, forwardMarket(october, "2026-10-28"));
    const halves = r.pricer.halves;
    const bookVega = halves * r.pricer.legs.reduce((s, l) => s + l.contracts * l.vega, 0);
    const bookDelta = halves * r.pricer.legs.reduce((s, l) => s + l.contracts * l.delta, 0);
    const hedgeAtZero = r.dayOneVegaHedge.fair.find((h) => h.move === 0)!;
    // Summary H15 = −SUM(row 61) ÷ 1e7
    expect(r.summary.vegaCr).toBeCloseTo(-bookVega / 1e7, 12);
    // Day 1 K26 = H15 × 1e7 ÷ J36
    const quantity = (r.summary.vegaCr * 1e7) / hedgeAtZero.vega;
    expect(r.dayOneVegaHedge.quantity).toBeCloseTo(quantity, 6);
    // Summary M23 = −K23 × L23 × 1e5 ÷ 1e7, with K23 = −quantity ÷ 1e5
    expect(r.summary.hedgePremiumCr).toBeCloseTo((quantity * hedgeAtZero.price) / 1e7, 9);
    // Product Description H33 is the sold quantity, H35 = H33 × M24, H36 = H32 − H35
    const g = r.productDescription.greeks;
    expect(g.hedgeQuantity).toBeCloseTo(-quantity, 6);
    expect(g.hedgeQuantity).toBeLessThan(0);
    expect(g.totalDelta).toBeCloseTo(bookDelta, 6);
    expect(g.optionsDelta).toBeCloseTo(-quantity * hedgeAtZero.delta, 6);
    expect(g.residualFutures).toBeCloseTo(bookDelta - g.optionsDelta, 6);
  });
});
