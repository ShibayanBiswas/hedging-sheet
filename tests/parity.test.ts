import { describe, expect, it } from "vitest";

import parity from "@/lib/data/workbook-parity.json";
import { seedMarketData, workbookDefaultInputs } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { clientReturn, effectiveSpreads, preTaxIrr, resolveParticipations } from "@/lib/engine/structure";
import type { HedgeRow, HedgingResult, PricerLeg } from "@/lib/engine/types";

import { ParityCollector } from "./helpers";

function run(): HedgingResult {
  const result = computeHedgingSheet(workbookDefaultInputs(), seedMarketData());
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join("; "));
  return result;
}

const result = run();
const legs = result.pricer.legs;
const nLive = result.schedule.expiries.length;

type PricerColumn = (typeof parity.pricer.columns)[number];

/** Workbook column of a leg: 8 expiry slots per strike block, 48 columns per half. */
function workbookColumn(leg: PricerLeg, half: number): PricerColumn {
  const index = half * 48 + leg.blockIndex * 8 + leg.expiryIndex;
  return parity.pricer.columns[index]!;
}

const NUMERIC_LEG_FIELDS = [
  "strikePercent",
  "strike",
  "upperForward",
  "lowerForward",
  "spot",
  "forwardGrowth",
  "discountYield",
  "dividends",
  "forward",
  "volatility",
  "volBump",
  "price",
  "pricePercent",
  "incrementalMargin",
  "incrementalMarginCost",
  "incrementalCostInr",
  "incrementalAdjustedPrice",
  "fullMargin",
  "fullMarginCost",
  "fullCostInr",
  "fullAdjustedPrice",
  "units",
  "delta",
  "gamma",
  "theta",
  "vega",
  "rho",
  "contracts",
  "optionValue",
  "deltaInr",
  "deltaContracts",
  "gammaContracts",
  "thetaInr",
  "vegaInr",
  "rhoInr",
] as const;

describe("workbook parity in Workbook Defaults mode", () => {
  it("headline values", () => {
    const s = result.summary;
    expect(Math.abs(s.actualInbuilt - parity.summary.actualInbuilt!)).toBeLessThan(1e-4);
    expect(Math.abs(s.actualInbuilt - parity.summary.actualInbuilt!) / parity.summary.actualInbuilt!).toBeLessThan(1e-6);
    expect(Math.abs(s.totalPremiumCr - 50.67)).toBeLessThan(0.01);
    expect(Math.abs(result.productDescription.maturityCr - 202.5)).toBeLessThan(0.001);
    expect(Math.abs(result.markToMarket.zeroRow.totalRequirementCr - -32.31)).toBeLessThan(0.005);
    expect(Math.abs(s.margin - 0.323)).toBeLessThan(0.0005);
    expect(Math.abs(result.dayOneVegaHedge.quantity - 12809.67)).toBeLessThan(0.01);
    expect(Math.abs(s.irr - 0.142)).toBeLessThan(0.0001);
    const zero = result.dayOneVegaHedge.fair.find((r) => r.move === 0)!;
    expect(Math.abs(zero.price - 3555.76)).toBeLessThan(0.01);
    expect(Math.abs(zero.delta - -0.19611)).toBeLessThan(1e-5);
    expect(Math.abs(zero.vega - 424.0153)).toBeLessThan(1e-4);
    expect(Math.abs(zero.forward - 96990.09)).toBeLessThan(0.01);
    expect(Math.abs(zero.volatility - 0.177)).toBeLessThan(1e-4);
    expect(Math.abs(zero.forwardGrowth - 0.058716)).toBeLessThan(1e-6);
    expect(Math.abs(zero.discountYield - 0.065)).toBeLessThan(1e-12);
    expect(Math.abs(result.markToMarket.worstCase.totalRequirementCr - -72.1)).toBeLessThan(0.005);
  });

  it("generated leg units, strikes and expiries equal the Pricer cells", () => {
    const expectedUnits = [-10.05, 9.05, 1, -25.6, 24, 1];
    const expectedPercents = [137, 127, 125, 85, 84, 70];
    result.structure.strikes.forEach((slot, i) => {
      expect(slot.percent).toBeCloseTo(expectedPercents[i]!, 9);
      expect(slot.units).toBeCloseTo(expectedUnits[i]!, 9);
    });
    expect(result.schedule.expiries).toEqual(["2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24"]);
    expect(legs.length).toBe(36);
    expect(nLive).toBe(6);
  });

  it("every Pricer leg cell", () => {
    const c = new ParityCollector();
    for (const leg of legs) {
      for (const half of [0, 1]) {
        const col = workbookColumn(leg, half);
        const at = `Pricer ${col.column}`;
        for (const field of NUMERIC_LEG_FIELDS) {
          c.num(`${at}.${field}`, leg[field] as number | null, col[field] as number | null, field);
        }
        c.eq(`${at}.maturity`, leg.maturity, col.maturity);
        c.eq(`${at}.valuationDate`, leg.valuationDate, col.valuationDate);
        c.eq(`${at}.upperMaturity`, leg.upperMaturity, col.upperMaturity);
        c.eq(`${at}.callPut`, leg.optionType, col.callPut);
        c.eq(`${at}.bidOffer`, leg.bidOffer, col.bidOffer);
        c.eq(`${at}.action`, leg.action, col.action);
      }
    }
    // Inactive slots carry no units in the workbook.
    for (const col of parity.pricer.columns) {
      if (col.callPut == null) c.num(`Pricer ${col.column}.units`, 0, col.units as number);
    }
    expect(c.report()).toBe("");
    expect(c.checked).toBeGreaterThan(2000);
  });

  it("Pricer header", () => {
    const h = result.pricer.header;
    const p = parity.pricer.header;
    const c = new ParityCollector();
    const pairs: Array<[string, number, unknown]> = [
      ["startLevel", h.startLevel, p.startLevel],
      ["coupon", h.coupon, p.coupon],
      ["mobilisation", h.mobilisation, p.mobilisation],
      ["actualInbuilt", h.actualInbuilt, p.actualInbuilt],
      ["productCost", h.productCost, p.productCost],
      ["inbuiltInr", h.inbuiltInr, p.inbuiltInr],
      ["transactionCostInr", h.transactionCostInr, p.transactionCostInr],
      ["nbfcAmount", h.nbfcAmount, p.nbfcAmount],
      ["premium", h.premium, p.premium],
      ["payout", h.payout, p.payout],
      ["achievedCoupon", h.achievedCoupon, p.achievedCoupon],
      ["delta", h.delta, p.delta],
      ["vega", h.vega, p.vega],
      ["rho", h.rho, p.rho],
      ["gamma", h.gamma, p.gamma],
      ["irr", h.irr, p.irr],
      ["margin", h.margin, p.margin],
      ["deltaLakh", h.deltaLakh, p.deltaLakh],
      ["spreadOnePayout", h.spreadPayouts[0]!, p.spreadOnePayout],
      ["spreadTwoPayout", h.spreadPayouts[1]!, p.spreadTwoPayout],
      ["protectionLoss", h.protectionLoss, p.protectionLoss],
    ];
    for (const [k, a, e] of pairs) c.num(`Pricer header ${k}`, a, e as number, k === "gamma" ? "gammaContracts" : "");
    c.eq("Pricer header expiry", h.expiry, p.expiry);
    expect(c.report()).toBe("");
  });

  it("Summary Sheet", () => {
    const s = result.summary;
    const p = parity.summary;
    const c = new ParityCollector();
    c.num("actualInbuilt", s.actualInbuilt, p.actualInbuilt);
    c.num("irr", s.irr, p.irr);
    c.num("spreadTwoParticipation", result.structure.spreadParticipations[1], p.spreadTwoParticipation);
    c.num("margin", s.margin, p.margin);
    c.eq("optionExpiry", s.optionExpiry, p.optionExpiry);
    c.num("deltaContracts", s.deltaContracts, p.deltaContracts);
    c.num("deltaPercent", s.deltaPercent, p.deltaPercent);
    c.num("vegaWeightedVol", s.vegaWeightedVol, p.vegaWeightedVol);
    c.num("vegaCr", s.vegaCr, p.vegaCr);
    c.num("rhoWeightedForward", s.rhoWeightedForward, p.rhoWeightedForward);
    c.num("rhoCr", s.rhoCr, p.rhoCr);
    s.legs.forEach((leg, i) => {
      const e = p.legs[i]!;
      c.num(`leg ${i}.strike`, leg.strike, e.strike);
      c.eq(`leg ${i}.optionType`, leg.optionType, e.optionType);
      c.num(`leg ${i}.quantityLakh`, leg.quantityLakh, e.quantityLakh);
      c.num(`leg ${i}.averagePrice`, leg.averagePrice, e.averagePrice);
      c.num(`leg ${i}.premiumCr`, leg.premiumCr, e.premiumCr);
      c.num(`leg ${i}.strikePercent`, leg.strikePercent, e.strikePercent);
    });
    c.num("totalPremiumCr", s.totalPremiumCr, p.totalPremiumCr);
    c.num("hedgeStrike", s.hedgeStrike, p.hedgeStrike);
    c.eq("hedgeExpiry", s.hedgeExpiry, p.hedgeExpiry);
    c.num("hedgeQuantityLakh", s.hedgeQuantityLakh, p.hedgeQuantityLakh);
    c.num("hedgePrice", s.hedgePrice, p.hedgePrice);
    c.num("hedgePremiumCr", s.hedgePremiumCr, p.hedgePremiumCr);
    c.num("hedgeDelta", s.hedgeDelta, p.hedgeDelta);
    expect(c.report()).toBe("");
  });

  it("Product Description and every payoff", () => {
    const d = result.productDescription;
    const p = parity.productDescription;
    const c = new ParityCollector();
    const keys = [
      "initialInvestment",
      "inbuiltCr",
      "issuanceCostCr",
      "transactionCostCr",
      "marginCr",
      "nbfcCr",
      "premiumCr",
      "tenorDays",
      "nbfcRate",
      "finalNbfcCr",
      "premiumRate",
      "finalPremiumCr",
      "marginRate",
      "finalMarginCr",
      "maturityCr",
      "irr",
      "weightedCompRate",
      "weightedHalfYearlyRate",
      "weightedQuarterlyRate",
    ] as const;
    for (const k of keys) c.num(k, d[k], p[k]);
    for (const k of Object.keys(p.greeks) as Array<keyof typeof p.greeks>) c.num(`greeks.${k}`, d.greeks[k], p.greeks[k]);
    const inputs = result.inputs;
    const parts = resolveParticipations({ ...inputs, spreads: effectiveSpreads(inputs) });
    for (const row of p.payoff) {
      if (row.performance == null) continue;
      const value = clientReturn(inputs, parts, row.performance);
      c.num(`payoff ${row.performance}.clientReturn`, value, row.clientReturn);
      c.num(`payoff ${row.performance}.preTaxIrr`, preTaxIrr(value, inputs.tenorDays), row.preTaxIrr);
    }
    expect(c.report()).toBe("");
  });

  it("the payoff from the legs equals the Product Description payoff", () => {
    const inputs = result.inputs;
    const parts = resolveParticipations({ ...inputs, spreads: effectiveSpreads(inputs) });
    const start = result.structure.startLevel;
    for (const row of parity.productDescription.payoff) {
      const p = row.performance!;
      // The legs spread the protection outflow across one percent, so that band is skipped.
      if (p < -inputs.protection && p > -inputs.protection - inputs.outflowWidth) continue;
      const s = 1 + p;
      const legValue = result.structure.strikes.reduce((acc, k) => acc + k.units * Math.max(k.strike / start - s, 0), 0);
      expect(inputs.coupon + legValue).toBeCloseTo(clientReturn(inputs, parts, p), 9);
    }
  });

  it("every Day 1 Vega Hedge row", () => {
    const c = new ParityCollector();
    const d = result.dayOneVegaHedge;
    d.margin.forEach((row, i) => {
      const e = parity.dayOneVegaHedge.margin[i]!;
      for (const k of Object.keys(e) as Array<keyof typeof e>) {
        if (k === "expiry") c.eq(`margin ${i}.expiry`, row.expiry, e.expiry);
        else c.num(`margin ${i}.${k}`, row[k] as number, e[k] as number);
      }
    });
    const blocks: Array<["fair" | "exchange" | "stressed", HedgeRow[]]> = [
      ["fair", d.fair],
      ["exchange", d.exchange],
      ["stressed", d.stressed],
    ];
    const map: Record<string, keyof HedgeRow> = {
      performance: "move",
      spot: "spot",
      strike: "strike",
      price: "price",
      delta: "delta",
      vega: "vega",
      contracts: "contracts",
      vegaInr: "vegaInr",
      deltaContracts: "deltaContracts",
      volatility: "volatility",
      forwardGrowth: "forwardGrowth",
      discountYield: "discountYield",
      dividends: "dividends",
      forward: "forward",
      volBump: "volBump",
      pricePercent: "pricePercent",
      gamma: "gamma",
      theta: "theta",
      rho: "rho",
      optionValue: "optionValue",
      deltaInr: "deltaInr",
      gammaContracts: "gammaContracts",
      thetaInr: "thetaInr",
      rhoInr: "rhoInr",
      upperForward: "upperForward",
      lowerForward: "lowerForward",
    };
    for (const [name, rows] of blocks) {
      rows.forEach((row, i) => {
        const e = parity.dayOneVegaHedge[name][i]! as Record<string, unknown>;
        for (const [ek, ak] of Object.entries(map)) {
          c.num(`${name} ${i}.${ek}`, row[ak] as number, e[ek] as number, ak);
        }
        c.eq(`${name} ${i}.maturity`, row.maturity, e.maturity);
        c.eq(`${name} ${i}.upperMaturity`, row.upperMaturity, e.upperMaturity);
        c.eq(`${name} ${i}.callPut`, row.optionType, e.callPut);
      });
    }
    expect(c.report()).toBe("");
  });

  it("every Mark to Market row from minus 50 to plus 20 percent", () => {
    const c = new ParityCollector();
    result.markToMarket.rows.forEach((row, i) => {
      const e = parity.markToMarket[i]!;
      for (const k of Object.keys(e) as Array<keyof typeof e>) c.num(`mtm ${i}.${k}`, row[k], e[k]);
    });
    expect(c.report()).toBe("");
  });

  it("the margin loop settles and the solver hits the target payout", () => {
    expect(result.diagnostics.loopPasses).toBeLessThanOrEqual(2);
    expect(Math.abs(result.pricer.header.achievedCoupon - result.inputs.coupon)).toBeLessThan(1e-10);
  });
});
