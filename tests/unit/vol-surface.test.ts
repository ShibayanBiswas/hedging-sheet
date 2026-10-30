import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import type { PricingParamPoint, VolSurface } from "@/lib/engine/types";
import {
  DEEP_STRIKE,
  DEFAULT_FWD_SELL_RATE,
  deepMismatchCount,
  forwardMarket,
  forwardSellRateForMonth,
  interpolateVolPercent,
  labelSurfaceForDeskMonth,
  lookupFwdSellRate,
  lookupVolBump,
  normalizeVolSurface,
  pricingParamOnOrBefore,
  pricingRowForMonth,
  referencePriceForUnderlying,
  surfaceMonthLabel,
} from "@/lib/engine/vol-surface";

const grid = (overrides: Partial<VolSurface> = {}): VolSurface => ({
  monthKey: "2026-10",
  label: "October 2026 Volatility Surface",
  deepStrike: DEEP_STRIKE,
  moneyness: [0.55, 1, 1.2],
  strikes: [DEEP_STRIKE, 0.55, 1, 1.2],
  expiries: ["2026-11-26T00:00:00.000Z", "2027-02-25T00:00:00.000Z"],
  volsPercent: [
    [30, 30, 20, 15],
    [28, 28, 19, 14],
  ],
  pricingParams: [{ date: "2026-10-29T00:00:00.000Z", volBump: 0, fwdSellRate: 0.06 }],
  ...overrides,
});

const point = (date: string, fwdSellRate = 0.05, volBump = 0): PricingParamPoint => ({ date: `${date}T00:00:00.000Z`, volBump, fwdSellRate });

describe("surface month label", () => {
  it("names the month and year", () => {
    expect(surfaceMonthLabel("2027-01")).toBe("January 2027 Volatility Surface");
  });
});

describe("reference prices", () => {
  it("use the stored anchor, then the live spot, then 0", () => {
    const anchored = grid({ referenceSensexPrice: 80000, referenceUnderlyingPrice: 24000 });
    expect(referencePriceForUnderlying(anchored, "Sensex", 1)).toBe(80000);
    expect(referencePriceForUnderlying(anchored, "Nifty", 1)).toBe(24000);
    expect(referencePriceForUnderlying(grid(), "Sensex", 76000)).toBe(76000);
    expect(referencePriceForUnderlying(grid(), "Nifty", Number.NaN)).toBe(0);
    expect(referencePriceForUnderlying(grid(), "Sensex")).toBe(0);
  });
});

describe("surface carried into a later desk month", () => {
  it("is returned as it is for its own month, a later one, or a bad month key", () => {
    const s = grid();
    expect(labelSurfaceForDeskMonth(s, "2026-10")).toBe(s);
    expect(labelSurfaceForDeskMonth(s, "2026-09")).toBe(s);
    expect(labelSurfaceForDeskMonth(s, "October")).toBe(s);
  });

  it("takes the new month's name and anchors, keeping the old anchors where none are given", () => {
    const s = grid({ referenceSensexPrice: 75000, referenceUnderlyingPrice: 23000 });
    const moved = labelSurfaceForDeskMonth(s, "2026-12", { sensex: 81000, nifty: null });
    expect(moved).toMatchObject({ monthKey: "2026-12", label: "December 2026 Volatility Surface", referenceSensexPrice: 81000, referenceUnderlyingPrice: 23000 });
    expect(labelSurfaceForDeskMonth(s, "2026-12").referenceSensexPrice).toBe(75000);
  });
});

describe("Deep mismatch count", () => {
  it("is 0 with no strike columns, and counts rows whose Deep differs from the 55% column", () => {
    expect(deepMismatchCount({ moneyness: [], volsPercent: [[1]] })).toBe(0);
    expect(deepMismatchCount({ moneyness: undefined as unknown as number[], volsPercent: undefined as unknown as number[][] })).toBe(0);
    expect(deepMismatchCount({ moneyness: [0.55, 1], volsPercent: [[30, 30, 20], [31, 30, 20]] })).toBe(1);
  });

  it("uses the lowest column when there is no 55% column", () => {
    expect(deepMismatchCount({ moneyness: [1, 0.6], volsPercent: [[25, 20, 25]] })).toBe(0);
  });
});

describe("normalising a stored surface", () => {
  it("survives a document missing every list", () => {
    const empty = normalizeVolSurface({ monthKey: "bad", label: "  " } as unknown as VolSurface);
    expect(empty.expiries).toEqual([]);
    expect(empty.moneyness).toEqual([]);
    expect(empty.volsPercent).toEqual([]);
    expect(empty.monthKey).toMatch(/^\d{4}-\d{2}$/);
    expect(empty.label).toBe(surfaceMonthLabel(empty.monthKey));
    expect(empty.pricingParams).toHaveLength(1);
    expect(empty.pricingParams[0]!.fwdSellRate).toBe(DEFAULT_FWD_SELL_RATE);
  });

  it("drops bad dates and strike columns, sorts both, reads a missing or text volatility as 0 and sets Deep from the 55% column", () => {
    const s = normalizeVolSurface(
      grid({
        moneyness: [1.2, 0.55, -1, Number.NaN],
        expiries: ["2027-02-25T00:00:00.000Z", "not a date", "2026-11-26T00:00:00.000Z"],
        volsPercent: [[0, 14, 28, 9, 9], [1, 1, 1, 1, 1], [0, "x" as unknown as number, 30]],
      }),
    );
    expect(s.moneyness).toEqual([0.55, 1.2]);
    expect(s.expiries).toEqual(["2026-11-26T00:00:00.000Z", "2027-02-25T00:00:00.000Z"]);
    expect(s.volsPercent).toEqual([
      [30, 30, 0],
      [28, 28, 14],
    ]);
  });

  it("keeps one Pricing Params row per day, fills a bad bump or rate, and drops a bad date", () => {
    const s = normalizeVolSurface(
      grid({
        pricingParams: [
          { date: "2026-12-31T00:00:00.000Z", volBump: Number.NaN, fwdSellRate: Number.NaN },
          { date: "2026-11-30T00:00:00.000Z", volBump: 0.01, fwdSellRate: 0.06 },
          { date: "2026-11-30T12:00:00.000Z", volBump: 0.02, fwdSellRate: 0.07 },
          { date: "nope", volBump: 0, fwdSellRate: 0 },
        ],
      }),
    );
    expect(s.pricingParams).toEqual([
      { date: "2026-11-30T00:00:00.000Z", volBump: 0.01, fwdSellRate: 0.06 },
      { date: "2026-12-31T00:00:00.000Z", volBump: 0, fwdSellRate: DEFAULT_FWD_SELL_RATE },
    ]);
  });

  it("keeps only positive anchors", () => {
    const s = normalizeVolSurface(grid({ referenceSensexPrice: -1, referenceUnderlyingPrice: 24000 }));
    expect(s.referenceSensexPrice).toBeUndefined();
    expect(s.referenceUnderlyingPrice).toBe(24000);
  });
});

describe("volatility lookup", () => {
  // Strike columns at 55%, 100% and 120% of 80,000.
  const s = normalizeVolSurface(grid({ referenceSensexPrice: 80000 }));
  const AT = 80000;
  const EIGHTY = 64000;

  it("is 0 on a surface with no rows", () => {
    expect(interpolateVolPercent(normalizeVolSurface(grid({ expiries: [], volsPercent: [] })), AT, "2026-12-01", "Sensex")).toBe(0);
  });

  it("is flat before the first row, after the last row, and beyond both strike ends", () => {
    expect(interpolateVolPercent(s, AT, "2026-10-30", "Sensex")).toBe(20);
    expect(interpolateVolPercent(s, AT, "2030-01-01", "Sensex")).toBe(19);
    expect(interpolateVolPercent(s, 1_000_000, "2026-11-26", "Sensex")).toBe(15);
    expect(interpolateVolPercent(s, 100, "2026-11-26", "Sensex")).toBe(30);
  });

  it("interpolates linearly in calendar days between two rows", () => {
    const mid = interpolateVolPercent(s, AT, "2027-01-11", "Sensex");
    expect(mid).toBeGreaterThan(19);
    expect(mid).toBeLessThan(20);
  });

  it("reads a row with one value, or with a gap, without NaN", () => {
    const thin = { ...s, volsPercent: [[25], [Number.NaN, Number.NaN, 18, 12]] };
    expect(interpolateVolPercent(thin, AT, "2026-11-26", "Sensex")).toBe(25);
    expect(interpolateVolPercent(thin, EIGHTY, "2027-02-25", "Sensex")).toBe(18);
    const gapAbove = { ...s, volsPercent: [[30, 30, Number.NaN, 15], [30, 30, Number.NaN, 15]] };
    expect(interpolateVolPercent(gapAbove, EIGHTY, "2026-11-26", "Sensex")).toBe(30);
    const allGap = { ...s, volsPercent: [[30, Number.NaN, Number.NaN, 15], [30, Number.NaN, Number.NaN, 15]] };
    expect(interpolateVolPercent(allGap, EIGHTY, "2026-11-26", "Sensex")).toBe(0);
    const empty = { ...s, volsPercent: [[], []] };
    expect(interpolateVolPercent(empty, EIGHTY, "2026-11-26", "Sensex")).toBe(0);
  });

  it("reads the earlier of two rows on the same day", () => {
    const twin = { ...s, expiries: ["2026-11-26T00:00:00.000Z", "2026-11-26T00:00:00.000Z"] };
    expect(interpolateVolPercent(twin, AT, "2026-11-26", "Sensex")).toBe(20);
  });
});

describe("Pricing Params lookups", () => {
  const params = [point("2026-10-29", 0.06, 0.01), point("2026-11-26", 0.065, 0.02), point("2027-01-28", 0.07, 0.03)];

  it("are empty-safe and fall back to the defaults", () => {
    expect(pricingParamOnOrBefore([], "2026-11-01")).toBeNull();
    expect(pricingRowForMonth([], "2026-11-01")).toBeNull();
    expect(lookupVolBump([], "2026-11-01")).toBe(0);
    expect(lookupFwdSellRate([], "2026-11-01")).toBe(DEFAULT_FWD_SELL_RATE);
    expect(forwardSellRateForMonth([], "2026-11-01")).toBe(DEFAULT_FWD_SELL_RATE);
  });

  it("read the row on or before the date, or the first row for a date before every row", () => {
    expect(lookupVolBump(params, "2026-12-15")).toBe(0.02);
    expect(lookupFwdSellRate(params, "2026-01-01")).toBe(0.06);
  });

  it("pick the valuation month's row, then the first row after it, then the last row", () => {
    expect(forwardSellRateForMonth(params, "2026-11-05")).toBe(0.065);
    expect(pricingRowForMonth(params, "2026-12-10")).toEqual(params[2]);
    expect(pricingRowForMonth(params, "2027-06-10")).toEqual(params[2]);
  });

  it("the forward market keeps the rows from the valuation month on, and the dividends on or after the valuation date", () => {
    const market = seedMarketData();
    const forward = forwardMarket(market, "2026-10-27");
    expect(forward.surface.pricingParams.every((p) => p.date.slice(0, 7) >= "2026-10")).toBe(true);
    expect(forward.params.dividends.every((d) => d.date.slice(0, 10) >= "2026-10-27")).toBe(true);
    const bare = forwardMarket({ ...market, surface: { ...market.surface, pricingParams: [] } }, "2026-10-27");
    expect(bare.surface.pricingParams).toEqual([]);
  });
});
