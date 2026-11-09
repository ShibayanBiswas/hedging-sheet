import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { forwardMarket, normalizeVolSurface } from "@/lib/engine/vol-surface";
import type { HedgeInputs, MarketData } from "@/lib/engine/types";

import workbookFill from "../fixtures/blank-workbook-fill.json";
import { blankFillInputs, fixtureMarket, priceLikeTheApp } from "../helpers/mock-market";
import saved from "./fixtures/workbook-values.json";
import { G0_OPTIONS, g0Inputs, run } from "./cases";
import { engineCell } from "./workbook-cells";

const FILL = workbookFill.fill as Array<[string, string]>;
const sheets = saved as Record<string, Record<string, number | string>>;

/** Same within float noise: a typed 0.895% is 0.00895071 give or take one unit in the last place. */
const same = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)) : JSON.stringify(a) === JSON.stringify(b);

describe("G0 through Blank Inputs: the workbook's own values typed field by field", () => {
  const typed = blankFillInputs(FILL);
  const g0 = g0Inputs();

  it("parse to the G0 inputs: the helper dates move to C12 to H12, 0.895071% is I25 and 76,800 stays typed", () => {
    // Only the provenance flags differ: a typed volatility and a typed hedge strike.
    const keys = (Object.keys(g0) as Array<keyof HedgeInputs>).filter((k) => !["dailyVolSource", "hedgeStrikeAuto"].includes(k));
    expect(keys.filter((k) => !same(typed[k], g0[k])).map((k) => `${k}: typed ${JSON.stringify(typed[k])}, G0 ${JSON.stringify(g0[k])}`)).toEqual([]);
    expect(typed.expiryDates).toEqual(["2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24"]);
    expect(typed.hedgeStrikeAuto).toBe(false);
    expect(typed.hedgeStrike).toBe(76800);
  });

  it("price every saved workbook cell as G0 does, with the forward growth at H69 and every dividend kept", () => {
    const fromBlank = run(typed, undefined, G0_OPTIONS);
    const fromG0 = run(g0, undefined, G0_OPTIONS);
    const misses: string[] = [];
    let compared = 0;
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const address of Object.keys(cells)) {
        const a = engineCell(fromBlank, sheet, address);
        const b = engineCell(fromG0, sheet, address);
        if (!a || !b) continue;
        compared++;
        // G0's tolerances: the typed 0.895071% is one unit in the last place off I25, which moves the bumped gammas.
        const gap = typeof a.value === "number" && typeof b.value === "number" ? Math.abs(a.value - b.value) : NaN;
        const ok = Number.isNaN(gap) ? a.value === b.value : gap <= 1e-9 || (b.kind === "price" && gap <= 1e-4) || gap <= 1e-6 * Math.abs(b.value as number);
        if (!ok) {
          misses.push(`${sheet}!${address}: Blank ${String(a.value)}, G0 ${String(b.value)}`);
        }
      }
    }
    expect(misses.slice(0, 20)).toEqual([]);
    expect(compared).toBeGreaterThan(4000);
  });

  it("price as Run prices them only with the valuation month's forward sell rate and the dividends after the valuation date", () => {
    // Run reads the 4.45% August row, not H69's 5.50%, and drops the dividends dated before 04-Aug-2026. It also anchors the
    // month on Yahoo's closes on or before the 1st rather than the workbook's MarketData prices. With the workbook's anchors
    // put back, pinning H69 and keeping every dividend gives G0 back, so those documented rules are the whole gap.
    const app = priceLikeTheApp(typed);
    expect(app.pricer.legs[0]!.forwardGrowth).toBeCloseTo(0.0445, 12);
    const workbook = seedMarketData().surface;
    expect(fixtureMarket().surface.referenceSensexPrice).not.toBe(workbook.referenceSensexPrice);
    const anchoredLikeTheWorkbook = (): MarketData => {
      const m = fixtureMarket();
      return { ...m, surface: normalizeVolSurface({ ...m.surface, referenceUnderlyingPrice: workbook.referenceUnderlyingPrice, referenceSensexPrice: workbook.referenceSensexPrice }) };
    };
    const pinned = computeHedgingSheet(typed, forwardMarket(anchoredLikeTheWorkbook(), typed.valuationDate), G0_OPTIONS);
    const full = computeHedgingSheet(typed, anchoredLikeTheWorkbook(), G0_OPTIONS);
    if (!pinned.ok || !full.ok) throw new Error("did not price");
    const g = run(g0, undefined, G0_OPTIONS);
    expect(full.summary.actualInbuilt).toBeCloseTo(g.summary.actualInbuilt, 9);
    expect(full.dayOneVegaHedge.quantity).toBeCloseTo(g.dayOneVegaHedge.quantity, 6);
    // With H69 pinned the option book is the workbook's; the future-only dividends move only the Day 1 hedge growth.
    expect(pinned.summary.totalPremiumCr).toBeCloseTo(g.summary.totalPremiumCr, 9);
    expect(pinned.dayOneVegaHedge.quantity).not.toBeCloseTo(g.dayOneVegaHedge.quantity, 0);
    expect(app.summary.actualInbuilt).not.toBeCloseTo(g.summary.actualInbuilt, 2);
  });
});
