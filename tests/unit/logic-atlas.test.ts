import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { blankInputs } from "@/lib/inputs/draft";
import { atlasInsights, atlasOutputs, atlasStages, expiryRuleText, hedgeRuleText } from "@/lib/logic-atlas";

import { priced } from "../helpers/fixture";

const market = seedMarketData();
const BROKEN = /NaN|Infinity|undefined|null|\d\.\d{4,}|-0\.0+(?!\d)/;

describe("Logic Atlas", () => {
  it("states the hedge strike and expiry rules for each underlying", () => {
    expect(hedgeRuleText("Sensex")).toBe("Sensex: Spot Times 1.006, Rounded Up To The Next 100");
    expect(hedgeRuleText("Nifty")).toBe("Nifty: Spot Plus 150, Rounded Up To The Next 100");
    expect(expiryRuleText("Sensex")).toBe("Last Thursday Of Each Month");
    expect(expiryRuleText("Nifty")).toBe("Last Tuesday Of Each Month");
    expect(hedgeRuleText("")).not.toMatch(/Nearest/);
  });

  it("has thirteen stages in run order, and feeds are exactly the stages that use each one", () => {
    const stages = atlasStages(defaultInputs({ valuationDate: "2026-10-28" }), null, { market });
    expect(stages.map((s) => s.title)).toEqual([
      "Inputs",
      "Live Close",
      "Expiries",
      "Strikes And Spreads",
      "Volatility",
      "Surface Lookup",
      "Forwards",
      "Option Pricing",
      "Goal Seek Inbuilt",
      "Pots",
      "Day 1 Vega Hedge",
      "Mark To Market And Margin",
      "Payoff",
    ]);
    const ids = new Set(stages.map((s) => s.id));
    for (const s of stages) {
      for (const u of s.uses) expect(ids.has(u), `${s.id} uses ${u}`).toBe(true);
      for (const f of s.feeds) expect(stages.find((x) => x.id === f)!.uses).toContain(s.id);
      // Every stage reads only from earlier stages: the flow has no loops.
      for (const u of s.uses) expect(stages.findIndex((x) => x.id === u)).toBeLessThan(stages.indexOf(s));
      expect(s.lastRun).toBeNull();
    }
  });

  it("before Run there are no insights and every output waits", () => {
    expect(atlasInsights(null)).toEqual([]);
    expect(atlasOutputs(null).every((o) => o.values.length === 0)).toBe(true);
  });

  it("Blank Inputs: every missing value shows a dash and nothing breaks", () => {
    const stages = atlasStages(blankInputs(), null, { market });
    for (const s of stages) expect(`${s.description} ${s.rule}`, s.id).not.toMatch(BROKEN);
    expect(stages[0]!.description).toBe("Underlying product of - Crore valued on -: coupon -, tenor - days, NBFC rate - and premium growth rate -.");
  });

  it("after Run: last run values, five insights and four headline numbers per output, with at most 3 decimals", () => {
    const r = priced();
    const run = { result: r, market };
    const stages = atlasStages(r.inputs as never, run, { market });
    for (const s of stages) {
      expect(s.lastRun?.length, s.id).toBeGreaterThan(0);
      for (const v of s.lastRun!) expect(v.value, `${s.id} ${v.label}`).not.toMatch(BROKEN);
    }
    const insights = atlasInsights(run);
    expect(insights.map((x) => x.id)).toEqual(["inbuilt", "top-strike", "hedge-strike", "volatility", "margin-peak"]);
    for (const x of insights) expect(x.text, x.id).not.toMatch(BROKEN);
    const outputs = atlasOutputs(r);
    expect(outputs.map((o) => o.title)).toEqual(["Summary Sheet", "Pricer", "Product Description", "Day 1 Vega Hedge", "Mark To Market"]);
    for (const o of outputs) {
      expect(o.values).toHaveLength(4);
      for (const v of o.values) expect(v.value, `${o.tab} ${v.label}`).not.toMatch(BROKEN);
    }
  });

  it("descriptions follow the inputs for any spot, coupon and notional, never breaking", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500_000, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: 0.01, max: 10_000, noNaN: true }),
        fc.constantFrom("Sensex" as const, "Nifty" as const),
        (spot, coupon, notional, underlying) => {
          const i = { ...defaultInputs({ valuationDate: "2026-10-28" }), spot, coupon, notionalCr: notional, underlying };
          const stages = atlasStages(i, null, { market });
          for (const s of stages) expect(s.description).not.toMatch(BROKEN);
          expect(stages.find((s) => s.id === "live-close")!.description).toContain(underlying);
          expect(stages.map((s) => s.description).join(" ")).not.toContain(underlying === "Sensex" ? "Nifty" : "Sensex");
        },
      ),
      { numRuns: 60 },
    );
  });
});
