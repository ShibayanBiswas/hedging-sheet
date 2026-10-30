import { describe, expect, it } from "vitest";

import { seedPricingParams } from "@/lib/engine/defaults";
import { anchoredCurve, defaultRateCurve, dividendYield, pricerDiscountYield, rateCapSellingForward, readRateCurve } from "@/lib/engine/rates";

const VALUATION = "2026-10-27";

describe("anchored rate curve", () => {
  it("dates each tenor from the valuation date, drops bad tenors, and reads unlinked points as their own rate", () => {
    const points = anchoredCurve(
      [
        { years: 2, ratePercent: 7, linkedToPremiumRate: false },
        { years: Number.NaN, ratePercent: 9, linkedToPremiumRate: false },
        { years: -1, ratePercent: 9, linkedToPremiumRate: false },
        { years: 0, ratePercent: 6, linkedToPremiumRate: true },
      ],
      VALUATION,
      0.065,
    );
    expect(points).toEqual([
      { date: "2026-10-27", rate: 0.065 },
      { date: "2028-10-26", rate: 0.07 },
    ]);
  });

  it("is the premium rate from the valuation date when the curve is empty", () => {
    expect(anchoredCurve([], VALUATION, 0.065)).toEqual([{ date: VALUATION, rate: 0.065 }]);
  });

  it("repeats the last point a year past the longest maturity, only when that maturity reaches it", () => {
    const curve = defaultRateCurve();
    expect(anchoredCurve(curve, VALUATION, 0.065, "2040-01-01").at(-1)).toEqual({ date: "2040-12-31", rate: 0.065 });
    expect(anchoredCurve(curve, VALUATION, 0.065, "2027-01-01")).toHaveLength(curve.length);
  });
});

describe("reading the curve at a maturity", () => {
  const points = [
    { date: "2026-10-27", rate: 0.06 },
    { date: "2027-10-27", rate: 0.07 },
    { date: "2028-10-26", rate: 0.07 },
  ];

  it("interpolates between two different forwards", () => {
    const r = readRateCurve(points, "2027-04-27");
    expect(r.upperMaturity).toBe("2026-10-27");
    expect(r.lowerMaturity).toBe("2027-10-27");
    expect(r.rate).toBeGreaterThan(0.06);
    expect(r.rate).toBeLessThan(0.07);
  });

  it("takes the upper rate when the two forwards are equal, or past the last point", () => {
    expect(readRateCurve(points, "2028-01-01").rate).toBe(0.07);
    const past = readRateCurve(points, "2030-01-01");
    expect(past).toMatchObject({ upperMaturity: "2028-10-26", lowerMaturity: null, lowerForward: 0.07, rate: 0.07 });
  });
});

describe("rate caps", () => {
  const params = { ...seedPricingParams(), rateCapBuyingForward: 0.068, rateCurve: [{ years: 1, ratePercent: 7.5, linkedToPremiumRate: false }] };

  it("the selling-forward cap is the last curve rate, or the premium rate with no curve", () => {
    expect(rateCapSellingForward(params, 0.065)).toBe(0.075);
    expect(rateCapSellingForward({ ...params, rateCurve: [] }, 0.065)).toBe(0.065);
  });

  it("a put on Bid and a call on Offer take the selling cap; the other two take the buying cap", () => {
    expect(pricerDiscountYield(0.1, "P", "B", params, 0.065)).toBe(0.075);
    expect(pricerDiscountYield(0.1, "C", "O", params, 0.065)).toBe(0.075);
    expect(pricerDiscountYield(0.1, "P", "O", params, 0.065)).toBe(0.068);
    expect(pricerDiscountYield(0.1, "C", "B", params, 0.065)).toBe(0.068);
    expect(pricerDiscountYield(0.05, "C", "B", params, 0.065)).toBe(0.05);
  });
});

describe("dividend yield", () => {
  const dividends = [
    { date: "2026-12-18", amount: 100 },
    { date: "2027-12-17", amount: 100 },
  ];

  it("sums the dividends before maturity, scaled and annualised", () => {
    expect(dividendYield(dividends, "2027-10-27", VALUATION, 80000, 1, 1)).toBeCloseTo((100 / 80000) * (365 / 365), 12);
    expect(dividendYield(dividends, "2027-10-27", VALUATION, 80000, 0.5, 2)).toBeCloseTo(100 / 80000, 12);
  });

  it("is 0 with no days to maturity or no spot", () => {
    expect(dividendYield(dividends, VALUATION, VALUATION, 80000, 1, 1)).toBe(0);
    expect(dividendYield(dividends, "2027-10-27", VALUATION, 0, 1, 1)).toBe(0);
  });
});
