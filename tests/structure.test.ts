import { describe, expect, it } from "vitest";

import { defaultInputs } from "@/lib/engine/defaults";
import {
  bookReturn,
  buildStrikes,
  clientReturn,
  deriveTerms,
  derivedSides,
  percentFromLevel,
  rupeeStrike,
  startLevel,
  validateStructure,
} from "@/lib/engine/structure";
import type { HedgeInputs, OptionType } from "@/lib/engine/types";
import { canRemoveStrike, insertStrike, removeStrike } from "@/lib/inputs/strikes";
import { INLINE_ONLY_CODES } from "@/lib/inputs/validate";

const base = (overrides: Partial<HedgeInputs> = {}): HedgeInputs => ({
  ...defaultInputs({ valuationDate: "2026-10-28", spot: 73598.67, dailyVol: 0.009 }),
  ...overrides,
});

describe("start level", () => {
  it.each([
    ["Start Live", 73598.67, 74100],
    ["Start Workbook", 76799, 77300],
    ["Start 80,000", 80000, 80500],
  ])("%s: spot %d gives %d", (_name, spot, expected) => {
    expect(startLevel({ spot, startLevelUplift: 0.006, startLevelRounding: 100 })).toBe(expected);
  });
});

describe("strike levels", () => {
  it("Strikes Workbook: start 77,300 gives the six workbook strikes", () => {
    const levels = base().strikePercents.map((p) => rupeeStrike(77300, p));
    expect(levels).toEqual([105901, 98171, 96625, 65705, 64932, 54110]);
  });

  it("Strike Level Edit: 92,625 at start 74,100 is 125%", () => {
    expect(percentFromLevel(92625, 74100)).toBe(125);
  });

  it("keeps the % and moves the level when the start changes", () => {
    const pct = percentFromLevel(92625, 74100);
    expect(rupeeStrike(80500, pct)).toBe(100625);
  });
});

describe("units", () => {
  it("Units: start 74,100 gives −10.05, 9.05, 1, −25.6, 24, 1", () => {
    const strikes = buildStrikes(base(), 74100);
    const expected = [-10.05, 9.05, 1, -25.6, 24, 1];
    expect(strikes).toHaveLength(expected.length);
    strikes.forEach((s, i) => {
      expect(s.optionType).toBe("P");
      expect(Math.abs(s.units - expected[i]!)).toBeLessThan(1e-6);
    });
  });
});

describe("spreads from strikes", () => {
  it("Strike 2 Edit: 128 gives Sell Level 28, Buy Level 28 and participation 11.0556", () => {
    const t = deriveTerms(base({ strikePercents: [137, 128, 125, 85, 84, 70] }));
    expect(t.spreads[0]!.sell).toBeCloseTo(0.28, 12);
    expect(t.spreads[1]!.buy).toBeCloseTo(0.28, 12);
    expect(t.spreads[1]!.participation).toBeCloseTo(11.0556, 4);
  });

  it("One Spread: 130 and 125 give participation 20.5", () => {
    const t = deriveTerms(base({ strikePercents: [130, 125, 85, 84, 70], participations: [null] }));
    expect(t.nSpreads).toBe(1);
    expect(t.spreads[0]!.participation).toBeCloseTo(20.5, 10);
  });

  it("Equal Strikes: two equal strikes give the strike-order error", () => {
    const codes = validateStructure(base({ strikePercents: [137, 127, 127, 85, 84, 70] })).map((e) => e.code);
    expect(codes).toContain("strike-order");
  });

  it("Override: participation 12 gives the inline coupon-exceeded error", () => {
    const errors = validateStructure(base({ participations: [1, 12] }));
    const e = errors.find((x) => x.code === "coupon-exceeded");
    expect(e?.field).toBe("participations.1");
    expect(e?.message).toBe("The Spreads Pay 122.00%, Above The Coupon Of 102.50%");
  });

  it("derived top participation never raises the coupon-exceeded error", () => {
    expect(validateStructure(base()).map((e) => e.code)).not.toContain("coupon-exceeded");
  });

  it("adjacent spreads sharing a strike are valid", () => {
    expect(validateStructure(base())).toEqual([]);
  });
});

describe("book matches client", () => {
  const levels = [-0.5, -0.3, -0.2, 0, 0.25, 0.26, 0.27, 0.3, 0.37, 0.5];
  const books: Array<[string, OptionType[]]> = [
    ["All Put", ["P", "P", "P", "P", "P", "P"]],
    ["All Call", ["C", "C", "C", "C", "C", "C"]],
    ["Mixed", ["C", "P", "C", "P", "P", "C"]],
  ];
  it.each(books)("%s", (_name, types) => {
    const i = base({ strikeOptionTypes: types });
    const start = startLevel(i);
    const strikes = buildStrikes(i, start);
    for (const p of levels) {
      expect(Math.abs(bookReturn(i, strikes, start, p) - clientReturn(i, p))).toBeLessThan(1e-6);
    }
  });
});

describe("Buy Or Sell", () => {
  it("defaults match the engine units: Sell, Buy, Buy, Sell, Buy, Buy", () => {
    const i = base();
    const units = buildStrikes(i, 74100).map((s) => s.units);
    expect(derivedSides(i)).toEqual(units.map((u) => (u < 0 ? "S" : "B")));
    expect(derivedSides(i)).toEqual(["S", "B", "B", "S", "B", "B"]);
    expect(i.strikeSides).toEqual(["S", "B", "B", "S", "B", "B"]);
  });

  it("a side that does not match the payoff is an inline error on that strike", () => {
    const errors = validateStructure(base({ strikeSides: ["S", "S", "B", "S", "B", "B"] }));
    const e = errors.find((x) => x.code === "strike-side");
    expect(e?.field).toBe("strikeSides.1");
    expect(e?.message).toBe("This Strike Must Be A Buy To Give The Product Payoff");
    expect(INLINE_ONLY_CODES.has("strike-side")).toBe(true);
  });
});

/** Units by finite differences of the client payoff: slope above less slope below each strike, in start units. */
function slopeUnits(i: HedgeInputs): number[] {
  const h = 1e-6;
  return i.strikePercents.map((pct) => {
    const p = pct / 100 - 1;
    const above = (clientReturn(i, p + 2 * h) - clientReturn(i, p + h)) / h;
    const below = (clientReturn(i, p - h) - clientReturn(i, p - 2 * h)) / h;
    return above - below;
  });
}

describe("adding and removing strikes", () => {
  it("a strike at 100 adds a bottom spread and its units follow the payoff", () => {
    const d = base();
    const next = insertStrike(d, 100, "default")!;
    expect(next.strikePercents).toEqual([137, 127, 125, 100, 85, 84, 70]);
    expect(next.participations).toEqual([1, 1, null]);
    const i = { ...d, ...next } as HedgeInputs;
    const units = buildStrikes(i, 100).map((s) => s.units);
    slopeUnits(i).forEach((u, k) => {
      // The outflow step is a one point drop the payoff table spreads, so only spread strikes compare by slope.
      if (k <= 3) expect(units[k]).toBeCloseTo(u, 4);
    });
    expect(units[3]).toBeCloseTo(1, 9);
    expect(next.strikeSides).toEqual(units.map((u) => (u < 0 ? "S" : "B")));
    expect(validateStructure(i)).toEqual([]);
  });

  it("splitting a spread keeps the payoff", () => {
    const d = base();
    const next = insertStrike(d, 132, "default")!;
    const i = { ...d, ...next } as HedgeInputs;
    for (const p of [0, 0.26, 0.3, 0.32, 0.35, 0.37, 0.5]) expect(clientReturn(i, p)).toBeCloseTo(clientReturn(d, p), 9);
  });

  it("removing a strike recomputes the units", () => {
    const d = base();
    const next = removeStrike(d, 1, "default")!;
    expect(next.strikePercents).toEqual([137, 125, 85, 84, 70]);
    expect(next.participations).toEqual([null]);
    const i = { ...d, ...next } as HedgeInputs;
    const units = buildStrikes(i, 100).map((s) => s.units);
    expect(units[0]).toBeCloseTo(-1.025 / 0.12, 9);
    expect(units[1]).toBeCloseTo(1.025 / 0.12, 9);
    expect(validateStructure(i)).toEqual([]);
  });

  it("protection, outflow and floor strikes cannot be removed, nor the last spread", () => {
    const d = base();
    expect([0, 1, 2, 3, 4, 5].map((k) => canRemoveStrike(d, k))).toEqual([true, true, true, false, false, false]);
    const one = { ...d, ...removeStrike(d, 1, "default")! };
    expect(canRemoveStrike(one, 0)).toBe(false);
  });

  it("Nifty strikes are in index points", () => {
    const i = base({ underlying: "Nifty", spot: 23500 });
    expect(startLevel(i)).toBe(23700);
    expect(buildStrikes(i, startLevel(i)).map((s) => s.strike)).toEqual([32469, 30099, 29625, 20145, 19908, 16590]);
  });
});
