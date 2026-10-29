import { describe, expect, it } from "vitest";

import saved from "./fixtures/workbook-values.json";
import { G0_OPTIONS, g0Inputs, run } from "./cases";
import { termSheetPayoff } from "./independent";
import { engineCell, payoffCell, splitAddress, type CellRead } from "./workbook-cells";

const RELATIVE = 1e-6;
const PRICE_ABSOLUTE = 1e-4;
/** Values the workbook saves as zero noise, such as 5.7e-16. */
const NOISE = 1e-9;

/**
 * Saved values with an engine counterpart, per sheet. The rest are labels, the unused expiry slots 7 and 8,
 * the rate curve brackets, check columns and the two older products on Product Description: see docs/11.
 */
const COMPARED: Record<string, number> = {
  "Summary Sheet": 84,
  Pricer: 2696,
  "Product Description": 73,
  "Day1 Vega Hedge": 1464,
  "MTM & Margin req": 180,
};

function matches(expected: number | string, read: CellRead): boolean {
  const actual = read.value;
  if (typeof expected === "string") return actual === expected;
  if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
  const gap = Math.abs(actual - expected);
  if (gap <= NOISE) return true;
  if (read.kind === "price" && gap <= PRICE_ABSOLUTE) return true;
  return gap <= RELATIVE * Math.max(Math.abs(expected), Math.abs(actual));
}

describe("G0: the engine reproduces every value the reference workbook saves", () => {
  const r = run(g0Inputs(), undefined, G0_OPTIONS);
  const sheets = saved as Record<string, Record<string, number | string>>;

  for (const [sheet, cells] of Object.entries(sheets)) {
    it(`matches ${sheet} cell by cell`, () => {
      const misses: string[] = [];
      let compared = 0;
      for (const [address, expected] of Object.entries(cells)) {
        let read: CellRead | undefined;
        if (sheet === "Product Description") {
          const { col, row } = splitAddress(address);
          const performance = cells[`J${row}`];
          if (row >= 32 && row <= 53 && (col === 11 || col === 12) && typeof performance === "number") read = payoffCell(r, performance, col);
        }
        read ??= engineCell(r, sheet, address);
        if (!read) continue;
        compared++;
        if (!matches(expected, read)) misses.push(`${sheet}!${address}: workbook ${expected}, engine ${String(read.value)}`);
      }
      expect(misses.slice(0, 40)).toEqual([]);
      expect(compared).toBe(COMPARED[sheet]);
    });
  }

  it("matches the hand-written term sheet payoff to the saved payoff grid", () => {
    const grid = sheets["Product Description"]!;
    let rows = 0;
    for (let row = 32; row <= 53; row++) {
      const performance = grid[`J${row}`];
      const saved = grid[`K${row}`];
      if (typeof performance !== "number" || typeof saved !== "number") continue;
      expect(termSheetPayoff(r.inputs, performance)).toBeCloseTo(saved, 9);
      rows++;
    }
    expect(rows).toBeGreaterThanOrEqual(17);
  });
});
