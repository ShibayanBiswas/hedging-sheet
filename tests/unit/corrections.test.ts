import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { daysBetween } from "@/lib/engine/dates";
import { autoHedgeStrike, defaultInputs } from "@/lib/engine/defaults";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import {
  correctExpiryDate,
  correctForRun,
  correctNumber,
  correctSide,
  correctStrike,
  correctValuationDate,
  CORRECTED_AT_RUN,
  type CorrectionContext,
} from "@/lib/validation/corrections";
import { numberFieldRules, validateDeskInputs } from "@/lib/validation/inputRules";

const TODAY = "2026-10-28";
const ctx: CorrectionContext = { today: TODAY, spot: 76835.78 };
/** Default Values at the e2e close: strikes 137, 127, 125, 85, 84, 70, participations 1 and Calculated, Coupon 102.5%. */
const base = (): DeskInputs => defaultInputs({ valuationDate: TODAY, spot: 76835.78 });
const fix = (field: string, v: number, inputs = base(), c = ctx) => correctNumber(inputs, field, v, c);

describe("a number against its own range", () => {
  it("makes a sign typo positive where only positive makes sense, and clamps a rate to its range", () => {
    expect(fix("spot", -76835.78)).toEqual({ value: 76835.78, note: "Made Positive, 76,835.78" });
    expect(fix("coupon", -1.025)).toEqual({ value: 1.025, note: "Made Positive, 102.500%" });
    expect(fix("nbfcRate", -0.05)).toEqual({ value: 0, note: "Raised To The Minimum, 0.000%" });
    expect(fix("nbfcRate", 1.5)).toEqual({ value: 1, note: "Lowered To The Maximum, 100.000%" });
    expect(fix("floorUnits", -1)).toEqual({ value: 0, note: "Raised To The Minimum, 0.00" });
    expect(fix("startLevelUplift", 0.25)).toEqual({ value: 0.1, note: "Lowered To The Maximum, 10.000%" });
  });

  it("rounds a whole number field and the Hedge Strike to its 100s", () => {
    expect(fix("tenorDays", 1940.4)).toEqual({ value: 1940, note: "Rounded To A Whole Number, 1,940" });
    expect(fix("stressDays", 2.6)).toEqual({ value: 3, note: "Rounded To A Whole Number, 3" });
    expect(fix("hedgeStrike", 77350)).toEqual({ value: 77400, note: "Rounded To The Nearest 100, 77,400" });
    expect(fix("hedgeStrike", 77320)).toEqual({ value: 77300, note: "Rounded To The Nearest 100, 77,300" });
  });

  it("takes the Default Values value for zero where zero is not allowed", () => {
    expect(fix("coupon", 0)).toEqual({ value: 1.025, note: "Set To The Default, 102.500%" });
    expect(fix("tenorDays", 0)).toEqual({ value: 1940, note: "Set To The Default, 1,940" });
    expect(fix("stressDays", 0.4)).toEqual({ value: 2, note: "Set To The Default, 2" });
    expect(fix("dailyVol", 0)).toEqual({ value: 0.009, note: "Set To The Default, 0.900%" });
    expect(fix("spot", 0)).toEqual({ value: 76835.78, note: "Set To The Last Close, 76,835.78" });
    expect(fix("hedgeStrike", 0)).toEqual({ value: autoHedgeStrike(76835.78, "Sensex"), note: "Set To The Auto Hedge Strike, 77,300" });
  });

  it("keeps what the field had when there is nothing to fall back on", () => {
    expect(fix("spot", 0, base(), { today: TODAY })).toEqual({ value: 76835.78, note: "Kept, It Must Be Above Zero, 76,835.78" });
    expect(fix("spot", 0, blankInputs(), { today: TODAY })).toEqual({ value: NaN, note: "Kept Empty, It Must Be Above Zero" });
  });

  it("leaves a value that is fine alone", () => {
    for (const [field, v] of [["spot", 74151.04], ["coupon", 1.1], ["nbfcRate", 0], ["tenorDays", 1940], ["hedgeStrike", 77300]] as const) expect(fix(field, v)).toBeNull();
  });

  it("whatever is typed in any number field, the corrected value passes every rule on that field", () => {
    const inputs = base();
    for (const rule of numberFieldRules(inputs).filter((r) => !/\./.test(r.field))) {
      fc.assert(
        fc.property(fc.double({ min: -2 * rule.max - 1, max: 2 * rule.max + 1, noNaN: true }), (v) => {
          const c = fix(rule.field, v, inputs);
          const next = { ...inputs, [rule.field]: c ? c.value : v };
          const left = validateDeskInputs(next, { today: TODAY }).filter((e) => e.field === rule.field || (rule.field === "decay" && e.field === "floorUnits"));
          expect(left, `${rule.field} = ${v}`).toEqual([]);
        }),
        { numRuns: 60 },
      );
    }
  });
});

describe("rules across fields, on the field being committed only", () => {
  it("Decay Reduction Below Floor above the Decay is lowered to the Decay; a Decay below it is raised to it", () => {
    expect(fix("floorUnits", 2)).toEqual({ value: 1.6, note: "Lowered To The Decay, 1.60" });
    expect(fix("decay", 0.5)).toEqual({ value: 1, note: "Raised To The Decay Reduction Below Floor, 1.00" });
    expect(fix("floorUnits", 1.6)).toBeNull();
  });

  it("a Coupon the lower spreads already pay is raised just above it; with a typed top spread it is what the spreads pay", () => {
    expect(fix("coupon", 0.01)).toEqual({ value: 0.02001, note: "Raised Above What The Lower Spreads Pay, 2.001%" });
    expect(fix("coupon", 0.0201)).toBeNull();
    const typedTop = { ...base(), participations: [1, 8] };
    expect(fix("coupon", 1.5, typedTop)).toEqual({ value: expect.closeTo(0.82, 12), note: "Set To What The Spreads Pay, 82.000%" });
  });

  it("a Tenor short of the last expiry is raised to reach it", () => {
    const inputs = base();
    const need = daysBetween(TODAY, inputs.expiryDates[5]!);
    expect(fix("tenorDays", 1000, inputs)).toEqual({ value: need, note: `Raised To Reach Expiry 6, ${need.toLocaleString("en-US")}` });
  });

  it("a participation taking the spreads above the Coupon is lowered to the most that leaves the top spread a share", () => {
    expect(fix("participations.0", 60)).toEqual({ value: 51.24, note: "Lowered To Leave Room For The Top Spread, 51.24" });
    expect(fix("participations.0", 150)).toEqual({ value: 51.24, note: "Lowered To Leave Room For The Top Spread, 51.24" });
    expect(fix("participations.0", 0)).toEqual({ value: 1, note: "Set To The Default, 1.00" });
    expect(fix("participations.0", -2)).toEqual({ value: 2, note: "Made Positive, 2.00" });
    expect(fix("participations.0", 3)).toBeNull();
  });

  it("a typed top spread that does not reach the Coupon exactly goes back to Calculated", () => {
    expect(fix("participations.1", 8)).toEqual({ value: null, note: "Back To Calculated, 10.05" });
    expect(fix("participations.1", (1.025 - 0.02) / 0.1)).toBeNull();
    // With the top typed, a lower spread is set to reach the Coupon exactly.
    expect(fix("participations.0", 2, { ...base(), participations: [1, (1.025 - 0.02) / 0.1] })).toEqual({ value: expect.closeTo(1, 9), note: "Set To Reach The Coupon Exactly, 1.00" });
  });
});

describe("Product Payoff strikes keep their row's role", () => {
  it("a strike past a neighbour is clamped one point inside it", () => {
    expect(fix("strikePercents.1", 140)).toEqual({ value: 136, note: "Lowered Below Strike 1, 136.000%" });
    expect(fix("strikePercents.1", 125)).toEqual({ value: 126, note: "Raised Above Strike 3, 126.000%" });
    expect(fix("strikePercents.2", 127)).toEqual({ value: 126, note: "Lowered Below Strike 2, 126.000%" });
    expect(fix("strikePercents.5", 90)).toEqual({ value: 83, note: "Lowered Below Strike 5, 83.000%" });
    expect(fix("strikePercents.0", 100)).toEqual({ value: 128, note: "Raised Above Strike 2, 128.000%" });
    expect(fix("strikePercents.0", 600)).toEqual({ value: 500, note: "Lowered To The Maximum, 500.000%" });
  });

  it("the protection strike stays at or below 100%; a zero takes its role's default; a sign typo is made positive", () => {
    expect(fix("strikePercents.3", 110)).toEqual({ value: 100, note: "Lowered To Zero Protection, 100.000%" });
    expect(fix("strikePercents.5", 0)).toEqual({ value: 70, note: "Set To The Default, 70.000%" });
    expect(fix("strikePercents.5", -60)).toEqual({ value: 60, note: "Made Positive, 60.000%" });
  });

  it("a gap narrower than a point takes its middle, and no gap at all keeps the strike", () => {
    expect(correctStrike({ ...base(), strikePercents: [127.5, 127, 126.6, 85, 84, 70] }, 1, 130)).toEqual({ value: 127.05, note: "Lowered Below Strike 1, 127.050%" });
    expect(correctStrike({ ...base(), strikePercents: [127.001, 127.0007, 127.0005, 85, 84, 70] }, 1, 130)).toEqual({ value: 127.0007, note: "Kept, No Room Between Strike 1 And Strike 3, 127.001%" });
  });

  it("whatever is typed in any strike, the strikes stay strictly descending with the protection strike at most 100%", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), fc.double({ min: -600, max: 600, noNaN: true }), (i, v) => {
        const inputs = base();
        const c = correctStrike(inputs, i, v);
        const k = Object.assign([...inputs.strikePercents], { [i]: c ? c.value : v });
        for (let j = 1; j < k.length; j++) expect(k[j]!, `strike ${i} = ${v}`).toBeLessThan(k[j - 1]!);
        expect(k[3]!).toBeLessThanOrEqual(100);
        expect(k[5]!).toBeGreaterThan(0);
      }),
      { numRuns: 400 },
    );
  });

  it("Target Rise, Protection and Decay Floor Level correct through their strikes", () => {
    expect(fix("target", -0.1)).toEqual({ value: expect.closeTo(0.28, 12), note: "Raised Above Strike 2, 28.000%" });
    expect(fix("protection", -0.05)).toEqual({ value: 0, note: "Raised To The Minimum, 0.000%" });
    expect(fix("protection", 0.3)).toEqual({ value: expect.closeTo(0.28, 12), note: "Lowered To Keep The Strikes In Order, 28.000%" });
    expect(fix("protection", 0.15)).toBeNull();
    expect(fix("floorLevel", 0.9)).toEqual({ value: 0.83, note: "Lowered Below Strike 5, 83.000%" });
  });

  it("a Blank strike with no neighbours yet is only held to its range", () => {
    const blank = { ...blankInputs(), strikePercents: Array.from({ length: 6 }, () => NaN) };
    expect(fix("strikePercents.1", 600, blank)).toEqual({ value: 500, note: "Lowered To The Maximum, 500.000%" });
    expect(fix("strikePercents.1", -5, blank)).toEqual({ value: 5, note: "Made Positive, 5.000%" });
    expect(fix("strikePercents.1", 120, blank)).toBeNull();
  });

  it("a Buy Or Sell the payoff does not give becomes the one it needs, once the terms are in", () => {
    expect(correctSide(base(), 1, "S")).toEqual({ value: "B", note: "Set To Buy, The Payoff Needs It" });
    expect(correctSide(base(), 1, "B")).toBeNull();
    expect(correctSide({ ...base(), coupon: NaN }, 1, "S")).toBeNull();
  });
});

describe("dates", () => {
  it("a Valuation Date after today moves to today, and one on or after Expiry 1 to the day before it", () => {
    expect(correctValuationDate(base(), "2026-11-05", ctx)).toEqual({ value: TODAY, note: "Moved To Today, 28-Oct-2026" });
    expect(correctValuationDate(base(), "2030-04-01", { today: "2031-01-01" })).toEqual({ value: "2030-03-27", note: "Moved Before Expiry 1, 27-Mar-2030" });
    expect(correctValuationDate(base(), "2026-10-27", ctx)).toBeNull();
  });

  it("an expiry moves to its month's last expiry weekday, then after the one before and before the one after", () => {
    // Default expiries: 28-Mar-2030, 25-Jul-2030, 26-Sep-2030, 26-Dec-2030, 24-Apr-2031, 31-Jul-2031.
    expect(correctExpiryDate(base(), 1, "2030-07-10")).toEqual({ value: "2030-07-25", note: "Moved To The Last Thursday, 25-Jul-2030" });
    expect(correctExpiryDate(base(), 1, "2030-02-10")).toEqual({ value: "2030-04-25", note: "Moved After Expiry 1, 25-Apr-2030" });
    expect(correctExpiryDate(base(), 1, "2030-10-10")).toEqual({ value: "2030-08-29", note: "Moved Before Expiry 3, 29-Aug-2030" });
    expect(correctExpiryDate(base(), 0, "2026-09-01")).toEqual({ value: "2026-10-29", note: "Moved After The Valuation Date, 29-Oct-2026" });
    expect(correctExpiryDate(base(), 5, "2033-01-01")).toEqual({ value: "2032-01-29", note: "Moved Before The Maturity, 29-Jan-2032" });
    expect(correctExpiryDate(base(), 1, "2030-07-25")).toEqual({ value: "2030-07-25", note: "" });
  });

  it("Nifty's expiries snap to the last Tuesday", () => {
    const nifty = { ...base(), underlying: "Nifty" as const, expiryDates: ["2030-03-26", "2030-07-30", "2030-09-24", "2030-12-31", "2031-04-29", "2031-07-29"] };
    expect(correctExpiryDate(nifty, 1, "2030-02-10")).toEqual({ value: "2030-04-30", note: "Moved After Expiry 1, 30-Apr-2030" });
  });

  it("with no expiry month between its neighbours an expiry keeps what it had", () => {
    const tight = { ...base(), expiryCount: 3, expiryDates: ["2030-03-28", "2030-04-25", "2030-04-25"] };
    expect(correctExpiryDate({ ...tight, expiryDates: ["2030-03-28", "", "2030-04-25"] }, 1, "2030-03-01")).toEqual({ value: "", note: "Kept, No Expiry Month Between Expiry 1 And Expiry 3" });
  });
});

describe("Custom Option Book legs", () => {
  const custom = (): DeskInputs => ({ ...base(), bookMode: "custom", customLegs: [{ percent: 100, optionType: "C", side: "B", quantity: 1 }] });
  it("a leg's Level % and Quantity are held to their ranges, with no order between legs", () => {
    expect(fix("customLegs.0.percent", 0, custom())).toEqual({ value: 100, note: "Set To The Default, 100.000%" });
    expect(fix("customLegs.0.percent", -95, custom())).toEqual({ value: 95, note: "Made Positive, 95.000%" });
    expect(fix("customLegs.0.percent", 900, custom())).toEqual({ value: 500, note: "Lowered To The Maximum, 500.000%" });
    expect(fix("customLegs.0.quantity", 0, custom())).toEqual({ value: 1, note: "Set To The Default, 1.00" });
    expect(fix("customLegs.0.quantity", 5000, custom())).toEqual({ value: 1000, note: "Lowered To The Maximum, 1,000.00" });
  });
  it("the product's terms are not checked against each other in a Custom Option Book", () => {
    expect(fix("floorUnits", 2, custom())).toBeNull();
    expect(fix("strikePercents.1", 140, custom())).toBeNull();
  });
});

describe("Run Simulation corrects what is left", () => {
  const broken = (): DeskInputs => ({
    ...base(),
    valuationDate: "2026-11-30",
    strikePercents: [137, 127, 128, 85, 84, 70],
    participations: [1, 8],
    floorUnits: 2,
    strikeSides: ["S", "S", "B", "S", "B", "B"],
  });

  it("every correctable rule is corrected on the field it names, and the inputs then pass", () => {
    const { inputs, notes } = correctForRun(broken(), ctx);
    expect(validateDeskInputs(inputs, { today: TODAY }).filter((e) => e.kind === "invalid")).toEqual([]);
    expect(inputs.valuationDate).toBe(TODAY);
    expect(inputs.strikePercents).toEqual([137, 127, 126, 85, 84, 70]);
    expect(inputs.participations[1]).toBeNull();
    expect(inputs.floorUnits).toBe(1.6);
    expect(notes).toMatchObject({
      valuationDate: "Moved To Today, 28-Oct-2026",
      "strikePercents.2": "Lowered Below Strike 2, 126.000%",
      "participations.1": expect.stringMatching(/^Back To Calculated, /),
      floorUnits: "Lowered To The Decay, 1.60",
    });
    expect(Object.keys(notes)).toContain("strikeSides.1");
  });

  it("a Coupon lowered under the lower spreads is raised, and the side that then changes is set", () => {
    const { inputs, notes } = correctForRun({ ...base(), coupon: 0.01 }, ctx);
    expect(validateDeskInputs(inputs, { today: TODAY }).filter((e) => e.kind === "invalid")).toEqual([]);
    expect(inputs.coupon).toBeCloseTo(0.02001, 12);
    expect(notes.coupon).toBe("Raised Above What The Lower Spreads Pay, 2.001%");
  });

  it("Blank Inputs stay blank: an empty field is never filled", () => {
    const blank = blankInputs();
    const out = correctForRun(blank, { today: TODAY });
    expect(out.inputs).toBe(blank);
    expect(out.notes).toEqual({});
  });

  it("valid inputs come back unchanged", () => {
    const inputs = base();
    expect(correctForRun(inputs, ctx).inputs).toBe(inputs);
  });

  it("names the rule codes it corrects, and none of the required ones", () => {
    for (const code of ["strike-order", "coupon-exceeded", "strike-side", "floor-units", "expiry-order", "expiry-maturity"]) expect(CORRECTED_AT_RUN.has(code)).toBe(true);
    for (const code of ["spread-count", "leg-count", "leg-type", "leg-side", "expiry-blank"]) expect(CORRECTED_AT_RUN.has(code)).toBe(false);
  });
});
