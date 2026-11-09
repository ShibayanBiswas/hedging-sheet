import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { buildStrikes, clientReturn, customBookReturn, MAX_LEGS, payoffBookGap, payoffLevels, validateStructure } from "@/lib/engine/structure";
import type { CustomLeg, HedgeInputs, HedgingResult } from "@/lib/engine/types";
import { TEMPLATES, type TemplateId } from "@/lib/inputs/custom-legs";

import { fixtureInputs, priced } from "./helpers/fixture";

const market = seedMarketData();
const HALVES = 2;

function custom(legs: CustomLeg[], extra: Partial<HedgeInputs> = {}): HedgeInputs {
  return { ...fixtureInputs(), bookMode: "custom", customLegs: legs, ...extra };
}

function run(legs: CustomLeg[], extra: Partial<HedgeInputs> = {}): HedgingResult {
  const r = computeHedgingSheet(custom(legs, extra), market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

const legsOf = (id: TemplateId) => TEMPLATES.find((t) => t.id === id)!.legs;
const book = (id: TemplateId) => run(legsOf(id));

/** The book's payoff at each move, per unit of notional. */
const EXPECTED: Record<TemplateId, Array<[number, number]>> = {
  "long-call": [[-0.1, 0], [0, 0], [0.1, 0.1], [0.3, 0.3]],
  "long-put": [[-0.3, 0.3], [-0.1, 0.1], [0, 0], [0.1, 0]],
  "bull-call-spread": [[-0.1, 0], [0, 0], [0.025, 0.025], [0.05, 0.05], [0.2, 0.05]],
  "bear-call-spread": [[-0.1, 0], [0, 0], [0.025, -0.025], [0.05, -0.05], [0.2, -0.05]],
  "bull-put-spread": [[-0.2, -0.05], [-0.05, -0.05], [-0.025, -0.025], [0, 0], [0.1, 0]],
  "bear-put-spread": [[-0.2, 0.05], [-0.05, 0.05], [-0.025, 0.025], [0, 0], [0.1, 0]],
  "long-straddle": [[-0.1, 0.1], [0, 0], [0.1, 0.1]],
  "short-straddle": [[-0.1, -0.1], [0, 0], [0.1, -0.1]],
  "long-strangle": [[-0.1, 0.05], [-0.03, 0], [0, 0], [0.03, 0], [0.1, 0.05]],
  "short-strangle": [[-0.1, -0.05], [0, 0], [0.1, -0.05]],
  "iron-condor": [[-0.3, -0.05], [-0.1, -0.05], [-0.075, -0.025], [0, 0], [0.075, -0.025], [0.1, -0.05], [0.4, -0.05]],
  "iron-butterfly": [[-0.2, -0.05], [-0.05, -0.05], [-0.025, -0.025], [0, 0], [0.025, -0.025], [0.05, -0.05], [0.2, -0.05]],
  "call-butterfly": [[-0.1, 0], [-0.05, 0], [-0.025, 0.025], [0, 0.05], [0.025, 0.025], [0.05, 0], [0.2, 0]],
  "put-butterfly": [[-0.2, 0], [-0.05, 0], [-0.025, 0.025], [0, 0.05], [0.025, 0.025], [0.05, 0], [0.2, 0]],
  "call-ratio-spread": [[-0.1, 0], [0, 0], [0.05, 0.05], [0.1, 0], [0.2, -0.1]],
};

describe("Custom Option Book templates", () => {
  it("has the fifteen strategies of the brief, around 100% with 5% wings and quantity 1", () => {
    expect(TEMPLATES.map((t) => t.label)).toEqual([
      "Long Call",
      "Long Put",
      "Bull Call Spread",
      "Bear Call Spread",
      "Bull Put Spread",
      "Bear Put Spread",
      "Long Straddle",
      "Short Straddle",
      "Long Strangle",
      "Short Strangle",
      "Iron Condor",
      "Iron Butterfly",
      "Call Butterfly",
      "Put Butterfly",
      "Call Ratio Spread 1×2",
    ]);
    for (const t of TEMPLATES) {
      for (const l of t.legs) {
        expect([90, 95, 100, 105, 110], t.id).toContain(l.percent);
        expect([1, 2], t.id).toContain(l.quantity);
      }
    }
  });

  it.each(TEMPLATES.map((t) => [t.label, t.id] as const))("%s pays its own payoff at the key levels, in the table and in the formula", (_label, id) => {
    const r = book(id);
    for (const [move, payoff] of EXPECTED[id]) {
      expect(clientReturn(r.inputs, move), `${id} at ${move}`).toBeCloseTo(payoff, 12);
      expect(customBookReturn(legsOf(id), move), `${id} at ${move}`).toBeCloseTo(payoff, 12);
    }
    for (const row of r.productDescription.payoff) {
      expect(row.clientReturn).toBeCloseTo(customBookReturn(legsOf(id), row.performance), 12);
      expect(row.maturityValueCr).toBeCloseTo(r.inputs.notionalCr * (1 + row.clientReturn), 9);
    }
  });

  it.each(TEMPLATES.map((t) => [t.label, t.id] as const))("%s: the payoff is what the priced legs pay at expiry", (_label, id) => {
    const r = book(id);
    const start = r.structure.startLevel;
    const notional = r.inputs.notionalCr * 1e7;
    for (const row of r.productDescription.payoff) {
      const s = start * (1 + row.performance);
      const paid = r.pricer.legs.reduce((acc, l) => acc + HALVES * l.contracts * (l.optionType === "C" ? Math.max(s - l.strike, 0) : Math.max(l.strike - s, 0)), 0);
      // The legs strike at the rounded rupee level, the payoff at the typed Level %: under a point apart.
      expect(Math.abs(paid / notional - row.clientReturn), `${id} at ${row.performance}`).toBeLessThan(1e-4);
    }
    expect(r.diagnostics.payoffBookGap).toBe(0);
  });
});

describe("Custom Option Book legs, units and contracts", () => {
  const r = book("iron-condor");
  const start = r.structure.startLevel;
  const nLive = r.schedule.expiries.length;

  it("builds one strike slot per leg, at the rupee level, with Sell as negative units", () => {
    expect(r.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side} ${s.units}`)).toEqual(["110 C B 1", "105 C S -1", "95 P S -1", "90 P B 1"]);
    expect(r.structure.strikes.map((s) => s.strike)).toEqual([110, 105, 95, 90].map((p) => Math.round((start * p) / 100)));
    expect(r.structure.strikes.every((s) => s.roles.join() === "leg")).toBe(true);
  });

  it("prices every leg across every expiry, the contracts signed by the side: units × notional ÷ start ÷ (2 × expiries)", () => {
    expect(r.pricer.legs).toHaveLength(4 * nLive);
    for (const l of r.pricer.legs) {
      const slot = r.structure.strikes[l.blockIndex]!;
      expect(l.optionType).toBe(slot.optionType);
      expect(l.contracts).toBeCloseTo((slot.units * r.inputs.notionalCr * 1e7) / start / (HALVES * nLive), 9);
      expect(l.action).toBe(slot.side === "S" ? "Sell" : "Buy");
      expect(Math.sign(l.contracts)).toBe(slot.side === "S" ? -1 : 1);
      expect(l.futuresAdjustment === 0).toBe(true);
    }
    expect(r.pricer.header.futuresAdjustment).toBe(0);
    expect(r.summary.legs.map((l) => Math.sign(l.quantityLakh))).toEqual([1, -1, -1, 1]);
  });

  it("allows any order and a repeated level: a straddle has the put and the call at 100%", () => {
    const s = book("long-straddle");
    expect(s.structure.strikes.map((x) => x.strike)).toEqual([start, start]);
    expect(s.pricer.legs.filter((l) => l.blockIndex === 0).every((l) => l.optionType === "C")).toBe(true);
    expect(s.pricer.legs.filter((l) => l.blockIndex === 1).every((l) => l.optionType === "P")).toBe(true);
    const shuffled = run([...legsOf("iron-condor")].reverse());
    expect(shuffled.pricer.header.premium).toBeCloseTo(r.pricer.header.premium, 6);
  });

  it("sets the payoff levels at every leg, zero and every 5% from -50% to +50%", () => {
    const levels = payoffLevels(r.inputs, r.structure.strikes);
    const grid = Array.from({ length: 21 }, (_, j) => Math.round((0.5 - j * 0.05) * 1e6) / 1e6);
    expect(levels).toEqual([...grid].sort((a, b) => b - a));
    expect(r.productDescription.payoff.map((p) => p.performance)).toEqual(levels);
    const deep = run([{ percent: 30, optionType: "P", side: "B", quantity: 1 }, { percent: 172.5, optionType: "C", side: "B", quantity: 1 }]);
    const deepLevels = deep.productDescription.payoff.map((p) => p.performance);
    expect(deepLevels[0]).toBeCloseTo(0.8, 9);
    expect(deepLevels).toContain(0.725);
    expect(deepLevels).toContain(-0.7);
    expect(deepLevels.at(-1)).toBeCloseTo(-0.8, 9);
  });
});

describe("a Custom Option Book call is a real call", () => {
  // The product book with every strike a call, then the same strikes and units typed as custom call legs.
  const product = priced({ strikeOptionTypes: ["C", "C", "C", "C", "C", "C"] });
  const legs: CustomLeg[] = product.structure.strikes.map((s) => ({ percent: s.percent, optionType: "C", side: s.units < 0 ? "S" : "B", quantity: Math.abs(s.units) }));
  const r = run(legs);

  it("prices each leg as the call itself: same price, contracts and volatility as the product's call strike", () => {
    expect(r.pricer.legs).toHaveLength(product.pricer.legs.length);
    r.pricer.legs.forEach((l, k) => {
      const p = product.pricer.legs[k]!;
      expect(l.strike).toBe(p.strike);
      expect(l.optionType).toBe("C");
      expect(l.price).toBeCloseTo(p.price, 9);
      expect(l.contracts).toBeCloseTo(p.contracts, 9);
      expect(l.volatility).toBe(p.volatility);
    });
  });

  it("differs from the product's call strike by exactly its futures leg: premium and delta by put-call parity", () => {
    expect(product.pricer.header.futuresAdjustment).not.toBe(0);
    expect(r.pricer.header.premium - product.pricer.header.premium).toBeCloseTo(-product.pricer.header.futuresAdjustment, 4);
    r.pricer.legs.forEach((l, k) => {
      const p = product.pricer.legs[k]!;
      const t = l.days / 365;
      // The product leg carries the put's Greeks; the custom leg the call's. Delta differs by the forward's, vega and gamma not at all.
      expect(Math.abs(l.delta - p.delta - Math.exp((l.forwardGrowth - l.discountYield) * t))).toBeLessThan(1e-3);
      expect(Math.abs(l.vega - p.vega)).toBeLessThan(1e-6);
      expect(Math.abs(l.gamma - p.gamma)).toBeLessThan(1e-6);
      expect(l.optionValue).toBeCloseTo(-l.contracts * l.price, 6);
      expect(l.futuresAdjustment === 0).toBe(true);
    });
  });

  it("leaves Product Payoff pricing as it was, whatever legs sit in the inputs", () => {
    const withLegs = computeHedgingSheet({ ...fixtureInputs({ strikeOptionTypes: ["C", "C", "C", "C", "C", "C"] }), bookMode: "product", customLegs: legs }, market);
    if (!withLegs.ok) throw new Error("did not price");
    const strip = (x: HedgingResult) => ({ ...x, inputs: null, diagnostics: { ...x.diagnostics, timings: {} } });
    expect(strip(withLegs)).toEqual(strip(product));
  });
});

describe("Custom Option Book strategy sanity", () => {
  const h = (id: TemplateId) => book(id).pricer.header;

  it("a long straddle has positive gamma and vega; a short straddle the same with the sign flipped", () => {
    const long = h("long-straddle");
    const short = h("short-straddle");
    expect(long.gamma).toBeGreaterThan(0);
    expect(long.vega).toBeGreaterThan(0);
    expect(short.gamma).toBeLessThan(0);
    expect(short.vega).toBeLessThan(0);
    expect(short.vega).toBeCloseTo(-long.vega, 6);
    expect(short.premium).toBeCloseTo(-long.premium, 6);
    expect(long.premium).toBeLessThan(0);
  });

  it("a long strangle is long gamma and vega, a short strangle short", () => {
    expect(h("long-strangle").gamma).toBeGreaterThan(0);
    expect(h("long-strangle").vega).toBeGreaterThan(0);
    expect(h("short-strangle").gamma).toBeLessThan(0);
    expect(h("short-strangle").vega).toBeLessThan(0);
  });

  it("bull spreads have positive delta and bear spreads negative", () => {
    expect(h("bull-call-spread").delta).toBeGreaterThan(0);
    expect(h("bull-put-spread").delta).toBeGreaterThan(0);
    expect(h("bear-call-spread").delta).toBeLessThan(0);
    expect(h("bear-put-spread").delta).toBeLessThan(0);
  });

  it("a long call has positive delta and a long put negative; both are long vega and cost premium", () => {
    expect(h("long-call").delta).toBeGreaterThan(0);
    expect(h("long-put").delta).toBeLessThan(0);
    for (const id of ["long-call", "long-put"] as const) {
      expect(h(id).vega).toBeGreaterThan(0);
      expect(h(id).gamma).toBeGreaterThan(0);
      expect(h(id).premium).toBeLessThan(0);
    }
  });

  it("credit strategies take premium in and debit strategies pay it", () => {
    for (const id of ["bull-put-spread", "bear-call-spread", "short-straddle", "short-strangle", "iron-condor", "iron-butterfly"] as const) expect(h(id).premium, id).toBeGreaterThan(0);
    for (const id of ["bull-call-spread", "bear-put-spread", "long-straddle", "long-strangle", "call-butterfly", "put-butterfly"] as const) expect(h(id).premium, id).toBeLessThan(0);
  });

  it("an iron condor and an iron butterfly have a bounded payoff, never past the 5% wing", () => {
    for (const id of ["iron-condor", "iron-butterfly"] as const) {
      const legs = legsOf(id);
      const returns = Array.from({ length: 291 }, (_, j) => customBookReturn(legs, -0.9 + j * 0.01));
      expect(Math.min(...returns), id).toBeGreaterThanOrEqual(-0.05 - 1e-12);
      expect(Math.max(...returns), id).toBeLessThanOrEqual(0 + 1e-12);
    }
  });

  it("a long call's payoff keeps rising and a call ratio spread's keeps falling above its upper strike", () => {
    expect(customBookReturn(legsOf("long-call"), 1)).toBeCloseTo(1, 12);
    expect(customBookReturn(legsOf("call-ratio-spread"), 1)).toBeLessThan(customBookReturn(legsOf("call-ratio-spread"), 0.5));
  });

  it("the vega hedge, margin grid and Summary come from the same legs", () => {
    const r = book("long-straddle");
    // A long vega book sells the hedge options: Day 1 K26 = −book vega ÷ hedge vega.
    expect(r.dayOneVegaHedge.quantity).toBeLessThan(0);
    expect(r.dayOneVegaHedge.quantity * r.dayOneVegaHedge.fair.find((x) => x.move === 0)!.vega).toBeCloseTo(-r.pricer.header.vega, 4);
    expect(r.markToMarket.rows).toHaveLength(15);
    expect(r.summary.legs).toHaveLength(2);
    expect(r.summary.totalPremiumCr).toBeCloseTo(r.pricer.header.premium / 1e7, 9);
  });
});

describe("Custom Option Book outputs tied to product terms", () => {
  const r = book("bull-call-spread");

  it("leaves the coupon, its return, protection, leverage and target blank instead of inventing them", () => {
    const h = r.pricer.header;
    for (const v of [h.coupon, h.achievedCoupon, h.irr, h.protectionLoss, r.summary.irr, r.productDescription.irr, r.productDescription.greeks.leverage, r.productDescription.greeks.targetLevel, r.structure.maxCoupon]) {
      expect(Number.isNaN(v)).toBe(true);
    }
    expect(h.spreadPayouts).toEqual([]);
    expect(r.structure.spreadParticipations).toEqual([]);
  });

  it("solves the Inbuilt so the pots return the notional, and titles the book", () => {
    expect(r.pricer.header.payout / (r.inputs.notionalCr * 1e7)).toBeCloseTo(1, 9);
    expect(Math.abs(r.diagnostics.goalSeekResidual)).toBeLessThan(1e-9);
    expect(r.productDescription.maturityCr).toBeCloseTo(r.inputs.notionalCr, 6);
    expect(Number.isFinite(r.summary.actualInbuilt)).toBe(true);
    expect(r.productDescription.title).toBe("5 Year Sensex Custom Option Book For ₹100 Crore");
  });

  it("raises no loss cap warning, which reads the product's decay", () => {
    expect(r.warnings.filter((w) => w.code === "loss-cap")).toEqual([]);
  });
});

describe("Custom Option Book validation", () => {
  const leg = (patch: Partial<CustomLeg> = {}): CustomLeg => ({ percent: 100, optionType: "P", side: "B", quantity: 1, ...patch });
  const codes = (legs: CustomLeg[], extra: Partial<HedgeInputs> = {}) => {
    const r = computeHedgingSheet(custom(legs, extra), market);
    return r.ok ? [] : r.errors.map((e) => `${e.field} ${e.code}`);
  };

  it("needs 1 to 10 legs", () => {
    expect(codes([])).toEqual(["legCount leg-count"]);
    expect(codes(Array.from({ length: MAX_LEGS + 1 }, () => leg()))).toEqual(["legCount leg-count"]);
    expect(codes(Array.from({ length: MAX_LEGS }, () => leg()))).toEqual([]);
    expect(validateStructure(custom([]))[0]!.message).toBe("The book has 0 legs. A Custom Option Book needs 1 to 10 legs.");
  });

  it("needs a Level % above zero, a type, a side and a quantity above zero on every leg", () => {
    expect(codes([leg({ percent: 0 })])).toEqual(["customLegs.0.percent leg-level"]);
    expect(codes([leg(), leg({ percent: NaN })])).toEqual(["customLegs.1.percent leg-level"]);
    expect(codes([leg({ optionType: "" as never })])).toEqual(["customLegs.0.optionType leg-type"]);
    expect(codes([leg({ side: "" as never })])).toEqual(["customLegs.0.side leg-side"]);
    expect(codes([leg({ quantity: 0 })])).toEqual(["customLegs.0.quantity leg-quantity"]);
    expect(codes([leg({ quantity: -1 })])).toEqual(["customLegs.0.quantity leg-quantity"]);
    const [issue] = validateStructure(custom([leg({ quantity: 0 })]));
    expect(issue!.message).toBe("Leg 1 Quantity is 0. Every leg needs a quantity above zero; Buy Or Sell gives the sign.");
    expect(issue!.fix).toBe("Enter a quantity above zero for Leg 1, such as 1.");
  });

  it("skips every product rule: spreads, descending strikes, coupon, decay, protection, sides and floor units", () => {
    const blankProduct: Partial<HedgeInputs> = { strikePercents: [], participations: [], strikeOptionTypes: [], strikeSides: [], coupon: NaN, decay: NaN, floorUnits: NaN };
    expect(codes([leg({ percent: 90 }), leg({ percent: 110, optionType: "C" }), leg({ percent: 110, side: "S" })], blankProduct)).toEqual([]);
    // A product left half typed behind the switch does not block the legs.
    expect(codes([leg()], { strikePercents: [137, 140, NaN, 85, 84, 70], strikeOptionTypes: ["", "P"] as never, strikeSides: ["", "S"] as never })).toEqual([]);
  });

  it("still checks the schedule, spot and notional the book shares with the product", () => {
    expect(codes([leg()], { notionalCr: 0 })).toEqual(["notionalCr notionalCr-positive"]);
    expect(codes([leg()], { tenorDays: 0 })).toContain("tenorDays tenor");
  });

  it("builds no strikes for an absent book and keeps the product slots for the product mode", () => {
    expect(buildStrikes(custom([]), 82500)).toEqual([]);
    expect(buildStrikes({ ...fixtureInputs(), customLegs: [leg()] }, 82500)).toHaveLength(6);
    expect(payoffBookGap(custom([leg()]), [], 82500)).toBe(0);
  });
});
