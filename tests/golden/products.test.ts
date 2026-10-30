import { describe, expect, it } from "vitest";

import { quarterlyExpiries } from "@/lib/engine/schedule";
import { blankInputs, isPriceable } from "@/lib/inputs/draft";
import type { HedgeInputs, HedgingResult, OptionType } from "@/lib/engine/types";

import { G0_OPTIONS, g0Inputs, product, run } from "./cases";
import { black, bookPayoff, numbersIn, termSheetPayoff, thirtyLevels } from "./independent";

/** The checks every golden product passes. */
type Shape = { underlying: "Nifty" | "Sensex"; strikes: number; calls: number; expiries: number };

function independentlyChecked(name: string, shape: Shape, make: () => { inputs: HedgeInputs; options?: typeof G0_OPTIONS }) {
  describe(name, () => {
    const { inputs, options } = make();
    const r = run(inputs, undefined, options);

    it("is the product it says it is", () => {
      expect(r.underlyingLabel).toBe(shape.underlying);
      expect(r.structure.strikes).toHaveLength(shape.strikes);
      expect(r.structure.strikes.filter((s) => s.optionType === "C")).toHaveLength(shape.calls);
      expect(r.schedule.expiries).toHaveLength(shape.expiries);
      expect(r.pricer.legs).toHaveLength(shape.strikes * shape.expiries);
    });

    it("prices every leg as the textbook Black formula does", () => {
      for (const l of r.pricer.legs) {
        const years = l.days / 365;
        const expected = black(l.forward, l.strike, years, l.volatility, l.discountYield, l.optionType);
        expect(Math.abs(l.price - expected)).toBeLessThan(1e-6 * Math.max(1, expected));
      }
    });

    it("holds put-call parity on every call strike, and its futures leg equals the parity gap", () => {
      for (const l of r.pricer.legs.filter((x) => x.optionType === "C")) {
        const years = l.days / 365;
        const put = black(l.forward, l.strike, years, l.volatility, l.discountYield, "P");
        const parity = Math.exp(-l.discountYield * years) * (l.forward - l.strike);
        expect(l.price - put).toBeCloseTo(parity, 6);
        expect(l.futuresAdjustment).toBeCloseTo(l.contracts * (l.price - put), 4);
      }
    });

    it("gives the term sheet payoff from the option book at 30 levels", () => {
      const levels = thirtyLevels(r.inputs);
      expect(levels).toHaveLength(30);
      for (const p of levels) expect(Math.abs(bookPayoff(r, p) - termSheetPayoff(r.inputs, p))).toBeLessThan(1e-6);
    });

    it("solves the Inbuilt so the payout pays the coupon", () => {
      expect(Math.abs(r.diagnostics.goalSeekResidual)).toBeLessThan(1e-6);
      expect(r.pricer.header.achievedCoupon).toBeCloseTo(r.inputs.coupon, 6);
    });

    it("has no NaN and no Infinity anywhere in the result", () => {
      const bad = numbersIn(r).filter(([, n]) => !Number.isFinite(n));
      expect(bad.map(([p]) => p)).toEqual([]);
    });
  });
}

const types = (pattern: OptionType[], count: number): OptionType[] => Array.from({ length: count }, (_, i) => pattern[i % pattern.length]!);

independentlyChecked("G1: Nifty, 5 strikes, 1 spread, all Put", { underlying: "Nifty", strikes: 5, calls: 0, expiries: 6 }, () => ({
  inputs: product({ underlying: "Nifty", spot: 24350, hedgeStrike: 24350, strikePercents: [125, 105, 85, 84, 70], participations: [null] }),
}));

independentlyChecked("G2: Sensex, 7 strikes, 3 spreads, mixed Put and Call", { underlying: "Sensex", strikes: 7, calls: 4, expiries: 6 }, () => ({
  inputs: product({
    strikePercents: [140, 130, 120, 110, 88, 87, 72],
    participations: [1, 1, null],
    strikeOptionTypes: types(["C", "P"], 7),
  }),
  options: G0_OPTIONS,
}));

independentlyChecked("G2: Sensex, 8 strikes, 4 spreads, mixed Put and Call", { underlying: "Sensex", strikes: 8, calls: 5, expiries: 6 }, () => ({
  inputs: product({
    strikePercents: [145, 135, 125, 115, 105, 85, 84, 70],
    participations: [1, 1, 1, null],
    strikeOptionTypes: types(["P", "C", "C"], 8),
  }),
  options: G0_OPTIONS,
}));

independentlyChecked("G3: all Call", { underlying: "Sensex", strikes: 6, calls: 6, expiries: 6 }, () => ({ inputs: product({ strikeOptionTypes: types(["C"], 6) }), options: G0_OPTIONS }));

independentlyChecked("G4: no protection", { underlying: "Sensex", strikes: 6, calls: 0, expiries: 6 }, () => ({
  inputs: product({ strikePercents: [137, 127, 125, 100, 99, 70] }),
  options: G0_OPTIONS,
}));

independentlyChecked("G5: a 3 year tenor with 10 quarterly observations", { underlying: "Sensex", strikes: 6, calls: 0, expiries: 10 }, () => ({
  inputs: product({ tenorDays: 1095, expiryCount: 10, expiryDates: quarterlyExpiries("2026-11-26", 10, "Sensex") }),
}));

describe("G3: an all Call book against the all Put book", () => {
  const puts = run(g0Inputs(), undefined, G0_OPTIONS);
  const calls = run(product({ strikeOptionTypes: types(["C"], 6) }), undefined, G0_OPTIONS);

  it("solves an Inbuilt within 0.25% of the all Put case, and in fact equal to it", () => {
    const gap = Math.abs(calls.summary.actualInbuilt - puts.summary.actualInbuilt) / puts.summary.actualInbuilt;
    expect(gap).toBeLessThan(0.0025);
    expect(gap).toBeLessThan(1e-9);
  });
});

describe("G7: one strike flipped to Call", () => {
  const puts = run(g0Inputs(), undefined, G0_OPTIONS);
  const oneCall = run(product({ strikeOptionTypes: ["C", "P", "P", "P", "P", "P"] }), undefined, G0_OPTIONS);

  it("keeps the Inbuilt within 0.5 percentage points of the Put book, far from the old -75%", () => {
    expect(Math.abs(oneCall.summary.actualInbuilt - puts.summary.actualInbuilt)).toBeLessThan(0.005);
    expect(oneCall.summary.actualInbuilt).toBeGreaterThan(0);
  });

  it("carries a futures adjustment equal to put-call parity on every leg of the call strike", () => {
    const legs = oneCall.pricer.legs.filter((l) => l.blockIndex === 0);
    expect(legs.every((l) => l.optionType === "C")).toBe(true);
    for (const l of legs) {
      const years = l.days / 365;
      const put = black(l.forward, l.strike, years, l.volatility, l.discountYield, "P");
      expect(l.futuresAdjustment).toBeCloseTo(l.contracts * Math.exp(-l.discountYield * years) * (l.forward - l.strike), 2);
      expect(l.price - put).toBeCloseTo(Math.exp(-l.discountYield * years) * (l.forward - l.strike), 6);
    }
    expect(oneCall.summary.futuresAdjustmentCr).not.toBe(0);
    expect(oneCall.summary.totalPremiumCr).toBeCloseTo(puts.summary.totalPremiumCr, 9);
  });
});

describe("G4: no protection", () => {
  const r = run(product({ strikePercents: [137, 127, 125, 100, 99, 70] }), undefined, G0_OPTIONS);

  it("loses at the decay rate from the first point below the start", () => {
    expect(termSheetPayoff(r.inputs, -0.05)).toBeCloseTo(-0.08, 12);
    expect(r.pricer.header.protectionLoss).toBe(0);
  });
});

describe("G5: a 3 year tenor with 10 quarterly observations", () => {
  const r = run(product({ tenorDays: 1095, expiryCount: 10, expiryDates: quarterlyExpiries("2026-11-26", 10, "Sensex") }));

  it("prices 10 expiries per strike, all before maturity", () => {
    expect(r.schedule.expiries).toHaveLength(10);
    expect(new Set(r.pricer.legs.map((l) => l.expiryIndex)).size).toBe(10);
    for (const d of r.schedule.expiries) expect(d < r.schedule.maturityDate).toBe(true);
  });
});

describe("G6: Blank Inputs typed to equal G0", () => {
  it("is identical to G0", () => {
    const g0 = g0Inputs();
    const typed: Record<string, unknown> = { ...blankInputs() };
    for (const key of Object.keys(g0) as Array<keyof HedgeInputs>) typed[key] = structuredClone(g0[key]);
    const desk = typed as ReturnType<typeof blankInputs>;
    expect(isPriceable(desk)).toBe(true);
    const fromBlank = run(desk as unknown as HedgeInputs, undefined, G0_OPTIONS) as HedgingResult;
    const fromDefaults = run(g0, undefined, G0_OPTIONS);
    const strip = (x: HedgingResult) => ({ ...x, diagnostics: { ...x.diagnostics, timings: {} } });
    expect(strip(fromBlank)).toEqual(strip(fromDefaults));
  });

  it("starts with no value G0 could leak from", () => {
    const blank = blankInputs();
    expect(Number.isNaN(blank.spot)).toBe(true);
    expect(blank.underlying).toBe("");
    expect(blank.strikePercents.every((x) => Number.isNaN(x))).toBe(true);
    expect(blank.strikeSides.every((x) => x === "")).toBe(true);
  });
});
