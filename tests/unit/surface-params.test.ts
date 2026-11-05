import { describe, expect, it } from "vitest";

import { pricingParamsSchema, VALIDATORS } from "@/lib/db/schemas";
import { COLLECTIONS } from "@/lib/db/collections";
import { normalizePricingParams, seedPricingParams } from "@/lib/engine/defaults";
import { derivedRateCapSellingForward, pricerDiscountYield, rateCapSellingForward } from "@/lib/engine/rates";
import type { PricingParamPoint } from "@/lib/engine/types";
import { withMonthScalars } from "@/lib/engine/vol-surface";

describe("Surface Parameters · Rate Cap While Selling Forward", () => {
  const seed = seedPricingParams();

  it("Follows The Last Rate Curve Point Until The Desk Sets It, 'Pricing Params'!O2", () => {
    expect(seed.rateCapSellingForward).toBeUndefined();
    expect(rateCapSellingForward(seed, 0.076)).toBe(0.076);
    expect(derivedRateCapSellingForward(seed, 0.076)).toBe(0.076);
  });

  it("A Set Cap Wins And Caps The Discount Yield Of A Put Bought On Bid", () => {
    const set = { ...seed, rateCapSellingForward: 0.07 };
    expect(rateCapSellingForward(set, 0.076)).toBe(0.07);
    expect(pricerDiscountYield(0.08, "P", "B", set, 0.076)).toBe(0.07);
    expect(pricerDiscountYield(0.08, "P", "O", set, 0.076)).toBe(set.rateCapBuyingForward);
  });

  it("Saves Through The Schema And The Database Validator, And Survives A Reload", () => {
    expect(pricingParamsSchema.safeParse({ ...seed, rateCapSellingForward: 0.07 }).success).toBe(true);
    expect(pricingParamsSchema.safeParse(seed).success).toBe(true);
    expect(pricingParamsSchema.safeParse({ ...seed, rateCapSellingForward: 1.5 }).success).toBe(false);
    const props = (VALIDATORS[COLLECTIONS.pricingParams].$jsonSchema as { properties: Record<string, unknown> }).properties;
    expect(props.rateCapSellingForward).toEqual({ bsonType: "number" });
    expect(normalizePricingParams({ ...seed, rateCapSellingForward: 0.07 }).rateCapSellingForward).toBe(0.07);
  });

  it("Defaults: Bid, Dividend Factor 1, Buying Cap 6.80%, Every Curve Point Linked", () => {
    expect(seed.bidOffer).toBe("B");
    expect(seed.dividendBidOfferMultiplier).toBe(1);
    expect(seed.rateCapBuyingForward).toBe(0.068);
    expect(seed.rateCurve.every((p) => p.linkedToPremiumRate)).toBe(true);
  });
});

describe("Surface Parameters · A Month's Scalars", () => {
  const rows: PricingParamPoint[] = [
    { date: "2026-10-29", volBump: 0, fwdSellRate: 0.055, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03 },
    { date: "2026-11-26", volBump: 0, fwdSellRate: 0.055, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03 },
    { date: "2026-12-31", volBump: 0, fwdSellRate: 0.055, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03 },
  ];

  it("Write From That Month's Row Onward, Leaving Earlier Months As Saved", () => {
    const out = withMonthScalars(rows, "2026-11", { fwdSellRate: 0.066, volBump: 0.01 });
    expect(out.map((r) => r.fwdSellRate)).toEqual([0.055, 0.066, 0.066]);
    expect(out.map((r) => r.volBump)).toEqual([0, 0.01, 0.01]);
    expect(out[1]!.incMargin).toBe(0.06);
  });
});
