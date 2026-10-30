import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoHedgeStrike } from "@/lib/engine/defaults";
import { startLevel } from "@/lib/engine/structure";

describe("hedge strike from the spot", () => {
  it("Sensex: spot times 1.006, rounded up to the next 100", () => {
    expect(autoHedgeStrike(74151.04, "Sensex")).toBe(74600);
    // The workbook's Start Level, Pricer B5, for its close of 76,799.
    expect(autoHedgeStrike(76799, "Sensex")).toBe(77300);
    expect(startLevel({ spot: 76799, startLevelUplift: 0.006, startLevelRounding: 100 })).toBe(77300);
  });

  it("Sensex: an exact multiple stays where it is, and anything above it moves up", () => {
    expect(autoHedgeStrike(74600 / 1.006, "Sensex")).toBe(74600);
    // In JavaScript 77,900 ÷ 1.006 × 1.006 is 77,900.00000000001; the float noise must not push it to 78,000.
    const noisy = 77900 / 1.006;
    expect(noisy * 1.006).toBeGreaterThan(77900);
    expect(autoHedgeStrike(noisy, "Sensex")).toBe(77900);
    // 74,155.07 × 1.006 = 74,600.0004
    expect(autoHedgeStrike(74155.07, "Sensex")).toBe(74700);
  });

  it("Nifty: spot plus 150, rounded up to the next 100", () => {
    expect(autoHedgeStrike(22698.85, "Nifty")).toBe(22900);
    expect(autoHedgeStrike(22850, "Nifty")).toBe(23000);
    expect(autoHedgeStrike(22850.01, "Nifty")).toBe(23100);
  });

  it("is a multiple of 100, at least the raw value and below it plus 100, for any spot", () => {
    fc.assert(
      fc.property(fc.double({ min: 1000, max: 200_000, noNaN: true }), fc.constantFrom("Nifty" as const, "Sensex" as const), (spot, u) => {
        const raw = u === "Nifty" ? spot + 150 : spot * 1.006;
        const k = autoHedgeStrike(spot, u);
        expect(k % 100).toBe(0);
        expect(k).toBeGreaterThanOrEqual(Math.round(raw * 1e6) / 1e6);
        expect(k).toBeLessThan(raw + 100);
      }),
      { numRuns: 500 },
    );
  });
});
