import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { bsGreeks } from "@/lib/engine/black-scholes";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs, HedgingResult, MarketData, OptionType } from "@/lib/engine/types";
import { buildHedgingWorkbook } from "@/lib/workbook/build-hedging-excel";

import defaults from "./fixtures/default-inputs.json";
import pricingParams from "./fixtures/pricing-params.json";
import surface from "./fixtures/surface.json";

const { monthKey, ...params } = pricingParams as typeof pricingParams & { monthKey: string };
void monthKey;
const market = { surface, params } as unknown as MarketData;
const base = defaults.inputs as unknown as HedgeInputs;

function run(types: OptionType[]): HedgingResult {
  const r = computeHedgingSheet({ ...base, spreadOptionTypes: types }, market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

/** Average discount factor of the observation expiries, which every leg shares. */
function meanDiscountFactor(r: HedgingResult): number {
  const byExpiry = new Map<number, number>();
  for (const l of r.pricer.legs) byExpiry.set(l.expiryIndex, Math.exp((-l.discountYield * l.days) / 365));
  return [...byExpiry.values()].reduce((a, b) => a + b, 0) / byExpiry.size;
}

/** What the call spreads pay at the Target, as a fraction of notional. */
function callPayout(r: HedgingResult): number {
  return r.pricer.header.spreadPayouts.reduce((acc, p, j) => acc + (r.inputs.spreadOptionTypes[j] === "C" ? p : 0), 0);
}

/**
 * Put-call parity on each call spread: the call book pays the put book's premium less each call spread's
 * payout discounted at the options' own rates. The pots grow premium at the Premium Growth Rate to maturity
 * and fund the NBFC at the NBFC Rate, so the Inbuilt moves by payout × (1 − DF × premium growth) ÷ NBFC growth.
 */
function explained(put: HedgingResult, other: HedgingResult) {
  const h = put.pricer.header;
  const df = meanDiscountFactor(put);
  const payout = callPayout(other);
  const premiumGrowth = (1 + h.premiumRate) ** (h.tenorDays / 365);
  const nbfcGrowth = (1 + h.nbfcRate) ** (h.tenorDays / 365);
  return {
    premium: h.premium - payout * h.mobilisation * df,
    inbuilt: put.summary.actualInbuilt + (payout * (1 - df * premiumGrowth)) / nbfcGrowth,
  };
}

const put = run(["P", "P"]);
const call = run(["C", "C"]);
const mixed = run(["C", "P"]);

describe("All Put equals main", () => {
  it("matches the figures recorded on main before per spread option types", () => {
    const h = put.pricer.header;
    expect(h.premium / 1e7).toBeCloseTo(51.12022123483423, 9);
    expect(put.summary.actualInbuilt).toBeCloseTo(0.08378730026608702, 12);
    expect(h.nbfcAmount / 1e7).toBeCloseTo(57.13194558728788, 9);
    expect(h.delta).toBeCloseTo(16996.877821641338, 6);
    expect(put.summary.vegaCr).toBeCloseTo(0.5225257261011594, 12);
    expect(put.dayOneVegaHedge.quantity).toBeCloseTo(12344.456810980662, 6);
    expect(put.markToMarket.zeroRow.totalRequirementCr).toBeCloseTo(-32.109324386103424, 9);
    expect(put.structure.strikes.map((s) => s.units)).toEqual([-10.05, 9.05, 1, -25.6, 24, 1].map((u) => expect.closeTo(u, 9)));
  });
});

describe("put-call parity on every leg", () => {
  it.each(put.pricer.legs.map((l) => [`${l.strikePercent}% expiry ${l.expiryIndex + 1}`, l] as const))("%s", (_name, l) => {
    const args = { spot: l.spot, strike: l.strike, days: l.days, growth: l.forwardGrowth, discount: l.discountYield, vol: l.volatility };
    const p = bsGreeks({ ...args, type: "P" });
    const c = bsGreeks({ ...args, type: "C" });
    const t = l.days / 365;
    const df = Math.exp(-l.discountYield * t);
    const forward = l.spot * Math.exp(l.forwardGrowth * t);
    expect(Math.abs(c.price - p.price - df * (forward - l.strike))).toBeLessThan(0.01);
    expect(Math.abs(c.delta - p.delta - Math.exp((l.forwardGrowth - l.discountYield) * t))).toBeLessThan(1e-3);
  });
});

describe("All Call", () => {
  it("replicates the payoff table", () => {
    expect(call.diagnostics.payoffBookGap).toBeLessThan(1e-6);
  });

  it("prices the spreads as calls and keeps the downside and hedge as puts", () => {
    const types = call.structure.strikes.map((s) => `${s.percent}${s.optionType}`);
    expect(types).toEqual(["137C", "127C", "125C", "85P", "84P", "70P"]);
    expect(call.dayOneVegaHedge.fair[0]!.optionType).toBe("P");
  });

  it("matches the all-Put Premium after adding the call spreads' payout at the options' discount factor", () => {
    const want = explained(put, call);
    expect(Math.abs(call.pricer.header.premium - want.premium) / Math.abs(put.pricer.header.premium)).toBeLessThan(0.01);
  });

  it("moves the Inbuilt only by the carry between expiry and maturity", () => {
    expect(Math.abs(call.summary.actualInbuilt - explained(put, call).inbuilt)).toBeLessThan(1e-6);
  });

  it("keeps the delta and vega of the put book", () => {
    expect(call.pricer.header.delta).toBeCloseTo(put.pricer.header.delta, 3);
    expect(call.summary.vegaCr).toBeCloseTo(put.summary.vegaCr, 9);
  });

  it("reaches the coupon", () => {
    expect(Math.abs(call.diagnostics.goalSeekResidual)).toBeLessThan(1e-8);
  });
});

describe("Mixed: Spread 1 Call, Spread 2 Put", () => {
  it("replicates the payoff table", () => {
    expect(mixed.diagnostics.payoffBookGap).toBeLessThan(1e-6);
  });

  it("has an Inbuilt between all-Call and all-Put", () => {
    const lo = Math.min(call.summary.actualInbuilt, put.summary.actualInbuilt);
    const hi = Math.max(call.summary.actualInbuilt, put.summary.actualInbuilt);
    expect(mixed.summary.actualInbuilt).toBeGreaterThan(lo);
    expect(mixed.summary.actualInbuilt).toBeLessThan(hi);
    expect(Math.abs(mixed.summary.actualInbuilt - explained(put, mixed).inbuilt)).toBeLessThan(1e-6);
  });

  it("writes each leg's option type to the Excel Summary Sheet", async () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingWorkbook(wb, mixed, null);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const label = (t: OptionType) => (t === "C" ? "Call" : "Put");
    const legStrikes = new Set(mixed.summary.legs.map((l) => l.strike));
    const found: string[] = [];
    reopened.getWorksheet("Summary Sheet")!.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1);
      const type = values.find((v) => v === "Put" || v === "Call");
      const strike = values.find((v) => typeof v === "number" && legStrikes.has(v));
      if (type && strike != null) found.push(`${strike} ${type}`);
    });
    expect(found).toEqual(mixed.summary.legs.map((l) => `${l.strike} ${label(l.optionType)}`));
  });
});
