import { describe, expect, it } from "vitest";

import { autoHedgeStrike, DEFAULT_TERMS, defaultInputs } from "@/lib/engine/defaults";
import { rupeeStrike, startLevel, strikeUnits } from "@/lib/engine/structure";
import { deriveInputs } from "@/lib/inputs/derive";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import { setSpreadCount, tableUnits } from "@/lib/inputs/strikes";
import { fmtNumber } from "@/lib/format";

/** One edit as the desk provider applies it. */
const apply = (prev: DeskInputs, patch: Partial<DeskInputs>) => deriveInputs(prev, { ...prev, ...patch });

describe("Hedge Strike Auto", () => {
  it("Nifty is the spot plus 150, Sensex the spot times 1.006, each rounded up to the next 100", () => {
    expect(autoHedgeStrike(23960.6, "Nifty")).toBe(24200);
    expect(autoHedgeStrike(24264.858285714286, "Nifty")).toBe(24500);
    expect(autoHedgeStrike(76799, "Sensex")).toBe(77300);
    expect(autoHedgeStrike(74000, "Sensex")).toBe(74500);
  });
});

describe("Blank Inputs Fill The Calculated Fields Once There Is A Spot", () => {
  const picked = apply(apply(blankInputs(), { underlying: "Nifty" }), { valuationDate: "2026-11-05" });

  it("Waits For The Spot: No Hedge Strike, No Start Level Uplift", () => {
    expect(picked.hedgeStrike).toBeNaN();
    expect(picked.startLevelUplift).toBeNaN();
  });

  it("A Typed Or Fetched Spot Brings The Hedge Strike And The Start Level", () => {
    const withSpot = apply(picked, { spot: 23960.6 });
    expect(withSpot.hedgeStrike).toBe(24200);
    expect(withSpot.hedgeStrikeAuto).toBe(true);
    expect(withSpot.startLevelUplift).toBe(DEFAULT_TERMS.startLevelUplift);
    // Pricer B5 = ROUNDUP(23,960.60 × 1.006, −2)
    expect(startLevel(withSpot)).toBe(24200);
    expect(fmtNumber(withSpot.spot, 2)).toBe("23,960.60");
  });

  it("A Spot Typed Before The Underlying Still Gets Its Hedge Strike", () => {
    const spotFirst = apply(blankInputs(), { spot: 74000 });
    expect(spotFirst.hedgeStrike).toBeNaN();
    expect(apply(spotFirst, { underlying: "Sensex" }).hedgeStrike).toBe(74500);
  });

  it("A Typed Uplift Is Kept, And Clearing It Leaves It Empty Until The Spot Changes", () => {
    const typed = apply(apply(picked, { startLevelUplift: 0.01 }), { spot: 24000 });
    expect(typed.startLevelUplift).toBe(0.01);
    const cleared = apply(typed, { startLevelUplift: NaN });
    expect(cleared.startLevelUplift).toBeNaN();
    expect(apply(cleared, { spot: 24100 }).startLevelUplift).toBe(DEFAULT_TERMS.startLevelUplift);
  });

  it("A Typed Hedge Strike Turns Auto Off And Stays", () => {
    const typed = apply(apply(picked, { spot: 23960.6 }), { hedgeStrike: 24000, hedgeStrikeAuto: false });
    expect(apply(typed, { spot: 24500 }).hedgeStrike).toBe(24000);
  });
});

describe("Strike Table Level In Points And Units In Blank Inputs", () => {
  const start = 24200;
  const strikes = (inputs: DeskInputs) => ({ ...inputs, ...setSpreadCount(inputs, 2, "blank"), strikePercents: [137, 127, 125, 85, 84, 70] });

  it("Level In Points Is ROUND(Start Level × Level %, 0), Pricer Row 19", () => {
    expect(rupeeStrike(start, 137)).toBe(33154);
    expect(rupeeStrike(start, 85)).toBe(20570);
  });

  it("Units Show Once Every Level % Is In, Reading The Default Values Terms Not Entered Yet", () => {
    const blank = strikes(blankInputs());
    expect(blank.coupon).toBeNaN();
    const units = tableUnits(blank, start);
    expect(units).toHaveLength(6);
    expect(units.every(Number.isFinite)).toBe(true);
    const defaults = defaultInputs({ valuationDate: "2026-11-05", spot: 23960.6 });
    expect(units).toEqual(strikeUnits(defaults, start));
  });

  it("Entered Terms Replace The Defaults", () => {
    const typed = { ...strikes(blankInputs()), coupon: 1.1, decay: 1.5, floorUnits: 0.5, participations: [2, null] };
    expect(tableUnits(typed, start)).toEqual(strikeUnits(typed, start));
    expect(tableUnits(typed, start)).not.toEqual(tableUnits(strikes(blankInputs()), start));
  });

  it("Stay Empty Until Every Level % And The Start Level Are In", () => {
    const partial = { ...strikes(blankInputs()), strikePercents: [137, 127, NaN, 85, 84, 70] };
    expect(tableUnits(partial, start)).toEqual([]);
    expect(tableUnits(strikes(blankInputs()), NaN)).toEqual([]);
  });
});
