import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { daysBetween } from "@/lib/engine/dates";
import { computeHedgingSheet, legKey } from "@/lib/engine/hedging-sheet";
import { EXPIRY_WEEKDAY, expiryDates, medianExpiryIndex, nearestWeekday, rawExpiryDate } from "@/lib/engine/schedule";
import { bookReturn, clientReturn, deriveTerms, startLevel } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";

import { FIXTURE_DATE, fixtureInputs, priced } from "../helpers/fixture";

function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

describe("terms derived from strikes", () => {
  it("reads spreads, target, protection and floor from the six default strikes", () => {
    const t = deriveTerms(fixtureInputs());
    expect(t.nSpreads).toBe(2);
    expect(t.target).toBeCloseTo(0.37, 12);
    expect(t.spreads[0]!.buy).toBeCloseTo(0.25, 12);
    expect(t.spreads[0]!.sell).toBeCloseTo(0.27, 12);
    expect(t.spreads[0]!.participation).toBe(1);
    expect(t.spreads[1]!.buy).toBeCloseTo(0.27, 12);
    expect(t.spreads[1]!.sell).toBeCloseTo(0.37, 12);
    // Summary L10: (coupon − 2 percent from Spread 1) ÷ 10 percent width
    expect(t.spreads[1]!.participation).toBeCloseTo(10.05, 10);
    expect(t.participationDerived).toEqual([false, true]);
    expect(t.protection).toBeCloseTo(0.15, 12);
    expect(t.outflowWidth).toBeCloseTo(0.01, 12);
    expect(t.floorLevel).toBeCloseTo(0.7, 12);
  });

  it("rounds the start level up to the next hundred", () => {
    expect(startLevel({ spot: 82000, startLevelUplift: 0.006, startLevelRounding: 100 })).toBe(82500);
    expect(startLevel({ spot: 82400, startLevelUplift: 0, startLevelRounding: 100 })).toBe(82400);
  });

  it("caps the payoff at the coupon and is flat to the protection level", () => {
    const i = fixtureInputs();
    expect(clientReturn(i, 0.6)).toBeCloseTo(i.coupon, 12);
    expect(clientReturn(i, 0)).toBe(0);
    expect(clientReturn(i, -0.15)).toBe(0);
    expect(clientReturn(i, -0.2)).toBeLessThan(0);
  });
});

describe("option book matches the payoff", () => {
  for (const [label, overrides] of [
    ["default put book", {}],
    ["one spread", { strikePercents: [127, 125, 85, 84, 70], participations: [null] }],
    ["three spreads", { strikePercents: [140, 130, 127, 125, 85, 84, 70], participations: [1, 1, null] }],
  ] as Array<[string, Partial<HedgeInputs>]>) {
    it(`agrees at every kink for the ${label}`, () => {
      const r = priced(overrides);
      expect(r.diagnostics.payoffBookGap).toBeLessThan(1e-9);
      for (const k of r.structure.strikes) {
        const p = k.strike / r.structure.startLevel - 1;
        if (p > -0.15 - 0.01 - 1e-9 && p < -0.15) continue;
        expect(Math.abs(bookReturn(r.inputs, r.structure.strikes, r.structure.startLevel, p) - clientReturn(r.inputs, p))).toBeLessThan(1e-9);
      }
    });
  }
});

describe("simulation invariants", () => {
  const r = priced();

  it("solves the Inbuilt so the pots reach the coupon", () => {
    expect(Math.abs(r.pricer.header.achievedCoupon - r.inputs.coupon)).toBeLessThan(1e-8);
    expect(Number.isFinite(r.summary.actualInbuilt)).toBe(true);
  });

  it("resets the spot bump to zero after the stress grid", () => {
    expect(r.diagnostics.spotBumpAfterStress).toBe(0);
  });

  it("always resolves Lower and Upper Maturity", () => {
    for (const leg of r.pricer.legs) {
      expect(leg.lowerMaturity).not.toBeNull();
      expect(leg.upperMaturity).not.toBeNull();
    }
    for (const row of r.dayOneVegaHedge.fair) expect(row.lowerMaturity).not.toBeNull();
  });

  it("prices every leg with finite numbers", () => {
    expect(r.pricer.legs.every((l) => Number.isFinite(l.price) && Number.isFinite(l.vega))).toBe(true);
    expect(r.markToMarket.rows.length).toBe(15);
  });

  it("prices each spread's legs with that spread's Option Type; the downside legs and the hedge stay puts", () => {
    const call = priced({ spreadOptionTypes: ["C", "C"] });
    const spreadLegs = call.pricer.legs.filter((l) => l.strikePercent > 100);
    expect(spreadLegs.length).toBeGreaterThan(0);
    expect(spreadLegs.every((l) => l.optionType === "C")).toBe(true);
    expect(call.pricer.legs.filter((l) => l.strikePercent < 100).every((l) => l.optionType === "P")).toBe(true);
    expect(call.dayOneVegaHedge.fair.every((h) => h.optionType === "P")).toBe(true);
    expect(r.pricer.legs.every((l) => l.optionType === "P")).toBe(true);
  });

  it("takes Bid or Offer from the surface parameters", () => {
    const market = seedMarketData();
    const offer = priced({}, { ...market, params: { ...market.params, bidOffer: "O" } });
    expect(offer.pricer.legs.every((l) => l.bidOffer === "O")).toBe(true);
    expect(r.pricer.legs.every((l) => l.bidOffer === "B")).toBe(true);
  });

  it("applies a per leg volatility override and flags it", () => {
    const key = legKey(0, 0);
    const o = priced({ legVolOverrides: { [key]: 0.3 } });
    const leg = o.pricer.legs.find((l) => legKey(l.blockIndex, l.expiryIndex) === key)!;
    expect(leg.volatility).toBe(0.3);
    expect(leg.volOverridden).toBe(true);
    expect(o.pricer.legs.filter((l) => l.volOverridden).length).toBe(1);
  });

  it("applies the Day 1 fair volatility override", () => {
    const o = priced({ hedgeVolOverride: 0.2 });
    expect(o.dayOneVegaHedge.fair.find((h) => h.move === 0)!.volatility).toBe(0.2);
  });
});

describe("expiry schedule", () => {
  it("lands every Sensex expiry on a Thursday and every Nifty expiry on a Tuesday", () => {
    for (const underlying of ["Sensex", "Nifty"] as const) {
      const i = fixtureInputs({ underlying });
      const dates = expiryDates(i);
      expect(dates.length).toBe(i.expiryCount);
      dates.forEach((date, k) => {
        expect(date).not.toBeNull();
        const d = date!;
        expect(weekdayOf(d)).toBe(EXPIRY_WEEKDAY[underlying]);
        expect(Math.abs(daysBetween(rawExpiryDate(FIXTURE_DATE, i.expiryMonths[k]!), d))).toBeLessThanOrEqual(3);
      });
    }
  });

  it("picks the nearest weekday within three days", () => {
    for (let d = 1; d <= 28; d++) {
      const ymd = `2027-02-${String(d).padStart(2, "0")}`;
      for (const wd of [2, 4]) {
        const out = nearestWeekday(ymd, wd);
        expect(weekdayOf(out)).toBe(wd);
        expect(Math.abs(daysBetween(ymd, out))).toBeLessThanOrEqual(3);
      }
    }
  });

  it("takes the lower middle expiry for the hedge", () => {
    expect(medianExpiryIndex(1)).toBe(0);
    expect(medianExpiryIndex(5)).toBe(2);
    expect(medianExpiryIndex(6)).toBe(2);
    expect(medianExpiryIndex(8)).toBe(3);
  });
});

describe("edge case validation", () => {
  const cases: Array<[string, Partial<HedgeInputs>]> = [
    ["strike-order", { strikePercents: [137, 127, 128, 85, 84, 70] }],
    ["strike-positive", { strikePercents: [137, 127, 125, 85, 84, 0] }],
    ["participation", { participations: [-1, null] }],
    ["coupon-unreachable", { participations: [1, 2] }],
    ["protection", { strikePercents: [137, 127, 125, 101, 100, 70] }],
    ["floor-units", { floorUnits: 2 }],
    ["spread-count", { strikePercents: [137, 85, 84], participations: [] }],
    ["expiry-order", { expiryMonths: [41, 44, 44, 50, 53, 56] }],
    ["expiry-maturity", { expiryMonths: [41, 44, 47, 50, 53, 70] }],
    ["tenor", { tenorDays: 0 }],
  ];
  for (const [code, overrides] of cases) {
    it(`blocks the run with ${code} and a fix`, () => {
      const r = computeHedgingSheet(fixtureInputs(overrides), seedMarketData());
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const issue = r.errors.find((e) => e.code === code);
        expect(issue, JSON.stringify(r.errors.map((e) => e.code))).toBeDefined();
        expect(issue!.fix).toBeTruthy();
      }
    });
  }

  it("warns but still runs when expiries pass the last surface row", () => {
    const r = computeHedgingSheet(fixtureInputs(), seedMarketData());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.code === "expiry-surface")).toBe(true);
  });

  it("prices a Nifty book with every number finite", () => {
    const r = priced({ underlying: "Nifty", spot: 25000, hedgeStrike: 25000 });
    expect(Number.isFinite(r.summary.actualInbuilt)).toBe(true);
    expect(r.productDescription.title).toContain("Nifty");
  });
});
