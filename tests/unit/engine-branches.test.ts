import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet, totalLossFall } from "@/lib/engine/hedging-sheet";
import { expiryForMonth } from "@/lib/engine/schedule";
import type { HedgeInputs, HedgingResult, MarketData } from "@/lib/engine/types";

import { fixtureInputs } from "../helpers/fixture";
import { numbersIn } from "../golden/independent";

const MIXED = ["C", "P", "C", "P", "P", "P"] as const;

function priced(inputs: HedgeInputs, market: MarketData): HedgingResult {
  const r = computeHedgingSheet(inputs, market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  expect(numbersIn(r).filter(([, n]) => !Number.isFinite(n)).map(([p]) => p).slice(0, 5)).toEqual([]);
  return r;
}

function offerMarket(withMargins: boolean): MarketData {
  const m = seedMarketData();
  const pricingParams = m.surface.pricingParams.map((p) =>
    withMargins ? { ...p, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03 } : { date: p.date, volBump: p.volBump, fwdSellRate: p.fwdSellRate },
  );
  return { surface: { ...m.surface, pricingParams }, params: { ...m.params, bidOffer: "O" } };
}

describe("pricing on the Offer side", () => {
  it("prices a mixed Call and Put book, with the margin adjusted prices when the grid carries the margins", () => {
    const r = priced(fixtureInputs({ strikeOptionTypes: [...MIXED] }), offerMarket(true));
    expect(r.pricer.legs.every((l) => l.incrementalAdjustedPrice != null && l.fullAdjustedPrice != null)).toBe(true);
  });

  it("leaves the margin adjusted prices blank when the grid has no margins", () => {
    const r = priced(fixtureInputs({ strikeOptionTypes: [...MIXED] }), offerMarket(false));
    expect(r.pricer.legs.every((l) => l.incrementalAdjustedPrice == null && l.fullAdjustedPrice == null)).toBe(true);
  });
});

describe("pricing on the Bid side", () => {
  it("prices an all Call book with no NaN", () => {
    priced(fixtureInputs({ strikeOptionTypes: MIXED.map(() => "C") }), seedMarketData());
  });
});

describe("Nifty dividends", () => {
  it("are taken as they are when the surface has no Sensex anchor to scale them by", () => {
    const m = seedMarketData();
    const market = { ...m, surface: { ...m.surface, referenceSensexPrice: undefined } };
    priced(fixtureInputs({ underlying: "Nifty", spot: 24000, hedgeStrike: 24200 }), market);
  });
});

describe("input shape", () => {
  it("a malformed book is refused before any pricing", () => {
    const r = computeHedgingSheet({ ...fixtureInputs(), strikePercents: "x" as unknown as number[] }, seedMarketData());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.code).toBe("shape");
  });
});

describe("total loss fall", () => {
  it("with the floor below a 90% fall the loss reaches 100% at 1 over the decay", () => {
    const inputs = fixtureInputs({ strikePercents: [137, 127, 125, 100, 99, 5], decay: 2 });
    expect(totalLossFall(inputs)).toBeCloseTo(0.5, 12);
  });
});

describe("expiries outside the surface", () => {
  it("two expiries before the first row are counted in one warning", () => {
    const m = seedMarketData();
    const surface = { ...m.surface, expiries: m.surface.expiries.slice(10), volsPercent: m.surface.volsPercent.slice(10) };
    const early = [1, 2].map((n) => expiryForMonth("2026-10-27", n, "Sensex"));
    const r = priced(fixtureInputs({ expiryDates: [...early, ...fixtureInputs().expiryDates.slice(2)] }), { ...m, surface });
    expect(r.warnings.some((w) => w.message.startsWith("2 expiry dates fall before the first surface row"))).toBe(true);
  });
});
