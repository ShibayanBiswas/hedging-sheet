import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { bsGreeks } from "@/lib/engine/black-scholes";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs, HedgingResult, MarketData, OptionType } from "@/lib/engine/types";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";

import defaults from "./fixtures/default-inputs.json";
import pricingParams from "./fixtures/pricing-params.json";
import surface from "./fixtures/surface.json";

const { monthKey, ...params } = pricingParams as typeof pricingParams & { monthKey: string };
void monthKey;
const market = { surface, params } as unknown as MarketData;
const base = defaults.inputs as unknown as HedgeInputs;

function run(types: OptionType[]): HedgingResult {
  const r = computeHedgingSheet({ ...base, strikeOptionTypes: types }, market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

const put = run(["P", "P", "P", "P", "P", "P"]);
const call = run(["C", "C", "C", "C", "C", "C"]);
const mixed = run(["C", "C", "P", "P", "C", "P"]);

describe("All Put equals main", () => {
  it("matches the figures recorded on main before per strike option types", () => {
    const h = put.pricer.header;
    expect(h.premium / 1e7).toBeCloseTo(51.12022123483423, 9);
    expect(put.summary.actualInbuilt).toBeCloseTo(0.08378730026608702, 12);
    expect(h.nbfcAmount / 1e7).toBeCloseTo(57.13194558728788, 9);
    expect(h.delta).toBeCloseTo(16996.877821641338, 6);
    expect(put.summary.vegaCr).toBeCloseTo(0.5225257261011594, 12);
    expect(put.dayOneVegaHedge.quantity).toBeCloseTo(12344.456810980662, 6);
    expect(put.markToMarket.zeroRow.totalRequirementCr).toBeCloseTo(-32.109324386103424, 9);
    expect(put.structure.strikes.map((s) => s.units)).toEqual([-10.05, 9.05, 1, -25.6, 24, 1].map((u) => expect.closeTo(u, 9)));
    expect(h.futuresAdjustment).toBe(0);
  });

  it("defaults to puts with the sides the payoff needs: Sell, Buy, Buy, Sell, Buy, Buy", () => {
    expect(put.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side}`)).toEqual(["137 P S", "127 P B", "125 P B", "85 P S", "84 P B", "70 P B"]);
    expect(base.strikeSides).toEqual(["S", "B", "B", "S", "B", "B"]);
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
    expect(Math.abs(c.vega - p.vega)).toBeLessThan(1e-6);
    expect(Math.abs(c.gamma - p.gamma)).toBeLessThan(1e-6);
  });
});

describe.each([
  ["All Call", call],
  ["Mixed: Strikes 1, 2 And 5 Call", mixed],
])("%s", (_name, r) => {
  it("prices each call strike as a call and books the parity difference as a futures leg", () => {
    const calls = r.pricer.legs.filter((l) => l.optionType === "C");
    expect(calls.length).toBeGreaterThan(0);
    for (const l of calls) {
      const t = l.days / 365;
      const parity = Math.exp(-l.discountYield * t) * (l.forward - l.strike);
      expect(Math.abs(l.futuresAdjustment - l.contracts * parity)).toBeLessThan(1e-4 * Math.max(1, Math.abs(l.contracts)));
    }
    expect(r.pricer.legs.filter((l) => l.optionType === "P").every((l) => l.futuresAdjustment === 0)).toBe(true);
    expect(r.pricer.header.futuresAdjustment).not.toBe(0);
  });

  it("gives the all-Put Premium, Inbuilt, NBFC, Greeks and payoff", () => {
    const a = r.pricer.header;
    const b = put.pricer.header;
    expect(rel(a.premium, b.premium)).toBeLessThan(1e-9);
    expect(Math.abs(r.summary.actualInbuilt - put.summary.actualInbuilt)).toBeLessThan(1e-9);
    expect(rel(a.nbfcAmount, b.nbfcAmount)).toBeLessThan(1e-9);
    expect(rel(a.delta, b.delta)).toBeLessThan(1e-9);
    expect(rel(a.vega, b.vega)).toBeLessThan(1e-9);
    expect(rel(a.gamma, b.gamma)).toBeLessThan(1e-6);
    expect(rel(r.summary.totalPremiumCr, put.summary.totalPremiumCr)).toBeLessThan(1e-9);
    expect(r.diagnostics.payoffBookGap).toBeLessThan(1e-6);
    expect(Math.abs(r.diagnostics.goalSeekResidual)).toBeLessThan(1e-8);
  });

  it("keeps the downside and hedge figures of the put book", () => {
    expect(r.dayOneVegaHedge.fair[0]!.optionType).toBe("P");
    expect(rel(r.dayOneVegaHedge.quantity, put.dayOneVegaHedge.quantity)).toBeLessThan(1e-9);
    expect(rel(r.markToMarket.zeroRow.totalRequirementCr, put.markToMarket.zeroRow.totalRequirementCr)).toBeLessThan(1e-9);
  });
});

describe("Excel", () => {
  it("writes each leg's option type and side, and the futures adjustment row, to the Summary Sheet", async () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, mixed, null);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const legStrikes = new Set(mixed.summary.legs.map((l) => l.strike));
    const found: string[] = [];
    let adjustment = false;
    reopened.getWorksheet("Summary Sheet")!.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1);
      if (values.includes("Futures Adjustment For Call Strikes")) adjustment = true;
      const type = values.find((v) => v === "Put" || v === "Call");
      const side = values.find((v) => v === "Buy" || v === "Sell");
      const strike = values.find((v) => typeof v === "number" && legStrikes.has(v));
      if (type && side && strike != null) found.push(`${strike} ${type} ${side}`);
    });
    expect(found).toEqual(mixed.summary.legs.map((l) => `${l.strike} ${l.optionType === "C" ? "Call" : "Put"} ${l.side === "S" ? "Sell" : "Buy"}`));
    expect(adjustment).toBe(true);
  });
});
