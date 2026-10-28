import { describe, expect, it } from "vitest";

import { bsGreeks, bsPrice } from "@/lib/engine/black-scholes";
import { normCdf } from "@/lib/engine/normal";
import { EXPIRY_WEEKDAY, expiryForMonth, nearestWeekday, rawExpiryDate } from "@/lib/engine/schedule";
import { pickDeskClose } from "@/lib/market-data";

import { priced } from "./fixture";

const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

/** Textbook Black-Scholes on the forward, written independently of the engine. */
function closedForm(S: number, K: number, T: number, g: number, r: number, v: number) {
  const F = S * Math.exp(g * T);
  const d1 = (Math.log(F / K) + 0.5 * v * v * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);
  const df = Math.exp(-r * T);
  return {
    call: df * (F * normCdf(d1) - K * normCdf(d2)),
    put: df * (K * normCdf(-d2) - F * normCdf(-d1)),
    putDelta: -df * Math.exp(g * T) * normCdf(-d1),
    gamma: (df * Math.exp(g * T) * phi(d1)) / (S * v * Math.sqrt(T)),
    vega: df * F * phi(d1) * Math.sqrt(T),
  };
}

describe("Black-Scholes closed form", () => {
  it("matches the textbook values at S = K = 100, 5%, 20% vol, one year", () => {
    const args = { spot: 100, strike: 100, days: 365, growth: 0.05, discount: 0.05, vol: 0.2 };
    expect(bsPrice({ ...args, type: "C" })).toBeCloseTo(10.450583572185565, 9);
    expect(bsPrice({ ...args, type: "P" })).toBeCloseTo(5.573526022256971, 9);
  });

  it("matches an independent implementation across strikes, tenors and rates", () => {
    for (const K of [60000, 75000, 90000, 105000]) {
      for (const days of [30, 400, 1500]) {
        const args = { spot: 76799, strike: K, days, growth: 0.055, discount: 0.065, vol: 0.17 };
        const ref = closedForm(76799, K, days / 365, 0.055, 0.065, 0.17);
        expect(bsPrice({ ...args, type: "P" })).toBeCloseTo(ref.put, 6);
        expect(bsPrice({ ...args, type: "C" })).toBeCloseTo(ref.call, 6);
      }
    }
  });

  it("satisfies put-call parity: call less put equals the discounted forward less strike", () => {
    for (const K of [50000, 77300, 105901]) {
      const args = { spot: 76799, strike: K, days: 1270, growth: 0.055, discount: 0.065, vol: 0.18 };
      const c = bsPrice({ ...args, type: "C" });
      const p = bsPrice({ ...args, type: "P" });
      const T = 1270 / 365;
      expect(c - p).toBeCloseTo(Math.exp(-0.065 * T) * (76799 * Math.exp(0.055 * T) - K), 6);
    }
  });

  it("takes Greeks by finite difference that agree with the analytic Greeks", () => {
    const args = { spot: 76799, strike: 65705, days: 1270, growth: 0.055, discount: 0.065, vol: 0.18, type: "P" as const };
    const g = bsGreeks(args);
    const ref = closedForm(76799, 65705, 1270 / 365, 0.055, 0.065, 0.18);
    expect(g.delta).toBeCloseTo(ref.putDelta, 6);
    expect(g.gamma / ref.gamma).toBeCloseTo(1, 4);
    // Vega is a one point forward bump, so it equals the same bump of the closed form and sits near the derivative.
    const bumped = closedForm(76799, 65705, 1270 / 365, 0.055, 0.065, 0.19);
    expect(g.vega).toBeCloseTo(bumped.put - ref.put, 6);
    expect(Math.abs(g.vega / (ref.vega * 0.01) - 1)).toBeLessThan(0.05);
    expect(g.theta).toBeLessThan(0.5);
    expect(g.rho).toBeLessThan(0);
  });
});

describe("solver and book", () => {
  const r = priced();

  it("solves the goal seek to a residual below 1e-9", () => {
    expect(Math.abs(r.diagnostics.goalSeekResidual)).toBeLessThan(1e-9);
    expect(r.diagnostics.solverTrace.length).toBeGreaterThan(2);
    expect(Math.abs(r.diagnostics.solverTrace.at(-1)!.residual)).toBeLessThan(1e-9);
  });

  it("builds every Mark to Market row from its parts", () => {
    const rows = r.markToMarket.rows;
    const zero = rows.findIndex((m) => m.move === 0);
    const day1 = r.dayOneVegaHedge.margin;
    rows.forEach((m, k) => {
      // MTM G6 = E6 + F6; H6 = −G6 × H2 × C6 × 1e5 ÷ 1e7; K6 = H6 + I6 + J6
      expect(m.residualFuturesLakh).toBeCloseTo(m.productRequirementLakh + m.optionDeltaLakh, 9);
      expect(m.futuresMarginCr).toBeCloseTo((-m.residualFuturesLakh * r.inputs.futuresMargin * m.level * 1e5) / 1e7, 9);
      expect(m.optionsMarginCr).toBeCloseTo(day1.find((d) => d.move === m.move)!.totalMarginCr, 12);
      expect(m.totalRequirementCr).toBeCloseTo(m.futuresMarginCr + m.markToMarketCr + m.optionsMarginCr, 9);
      if (k === zero) expect(m.markToMarketCr).toBe(0);
      else {
        // P6 = G(row nearer 0) × (C6 − C(row nearer 0)) × 1e5 ÷ 1e7; I6 = I(row nearer 0) + P6
        const near = rows[k < zero ? k + 1 : k - 1]!;
        const step = (near.residualFuturesLakh * (m.level - near.level) * 1e5) / 1e7;
        expect(m.markToMarketCr).toBeCloseTo(near.markToMarketCr + step, 9);
      }
    });
    expect(r.summary.margin).toBeCloseTo(-rows[zero]!.totalRequirementCr / r.inputs.notionalCr, 12);
  });
});

describe("expiry rule", () => {
  it("adds months times 30.5 days, rounded", () => {
    // 28-Oct-2026 + 1,251 days = 01-Apr-2030, a Monday.
    expect(rawExpiryDate("2026-10-28", 41)).toBe("2030-04-01");
    expect(expiryForMonth("2026-10-28", 41, EXPIRY_WEEKDAY.Sensex)).toBe("2030-04-04");
    expect(expiryForMonth("2026-10-28", 41, EXPIRY_WEEKDAY.Nifty)).toBe("2030-04-02");
  });

  it("snaps to the nearest weekday: up to three days forward, otherwise back", () => {
    // Monday 01-Feb-2027 to Thursday 04-Feb: three forward.
    expect(nearestWeekday("2027-02-01", 4)).toBe("2027-02-04");
    // Friday 05-Feb: six forward or one back, so back.
    expect(nearestWeekday("2027-02-05", 4)).toBe("2027-02-04");
    // Sunday 07-Feb: four forward or three back, so back.
    expect(nearestWeekday("2027-02-07", 4)).toBe("2027-02-04");
    // Thursday stays put.
    expect(nearestWeekday("2027-02-04", 4)).toBe("2027-02-04");
    // Nifty Tuesday from Saturday 06-Feb: three forward.
    expect(nearestWeekday("2027-02-06", 2)).toBe("2027-02-09");
    // Nifty Tuesday from Thursday 04-Feb: five forward or two back, so back.
    expect(nearestWeekday("2027-02-04", 2)).toBe("2027-02-02");
  });
});

describe("market status", () => {
  const bars = [
    { dateYmd: "2026-10-26", close: 73000 },
    { dateYmd: "2026-10-27", close: 73598.67 },
  ];

  it("labels a weekday before the open as pre open, not a holiday", () => {
    // Wednesday 28-Oct-2026 08:30 IST.
    const picked = pickDeskClose(bars, new Date("2026-10-28T03:00:00Z"));
    expect(picked?.sessionPhase).toBe("pre_open");
    expect(picked?.close).toBe(73598.67);
  });

  it("labels a Saturday as a weekend or holiday", () => {
    expect(pickDeskClose(bars, new Date("2026-10-31T06:00:00Z"))?.sessionPhase).toBe("holiday_or_weekend");
  });
});
