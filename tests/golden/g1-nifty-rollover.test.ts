import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { defaultInputs, normalizePricingParams, seedPricingParams } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { derivedSides } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";

import { engineCell } from "./workbook-cells";

/**
 * G1: the 5 year Nifty Accelerator 102.5 rollover workbook of 17-Jul-2026, priced on its own MarketData as a
 * fixture surface. The live desk prices on the Unwinding Calculator's surface instead; this checks the formulas.
 * Strikes 137, 136, 125, 85, 84, 70 are the workbook's case, not the app's defaults.
 */
const FILE = "fixtures/reference/nifty-rollover-workbook.xlsm";
/** MarketData!N2: the workbook's 100 percent strike, the anchor of its moneyness columns. */
const MARKETDATA_ANCHOR = 24021.65;

const bytes = readFileSync(FILE);
const workbook = XLSX.read(bytes, { cellDates: true });
const parsed = parseVolSurfaceFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "2026-07");
const market = {
  surface: normalizeVolSurface({ ...parsed.surface, referenceUnderlyingPrice: MARKETDATA_ANCHOR }),
  params: normalizePricingParams({ ...seedPricingParams(), ...parsed.params }),
};

function rolloverInputs(): HedgeInputs {
  // Summary C3, the derived spot Pricer B27 and Day1 C2 price on; ROUNDUP(× 1.006, −2) gives Pricer B5 = 24,500 as D3 does.
  const base = defaultInputs({ valuationDate: "2026-07-17", spot: 24264.858285714286, dailyVol: 0.00905296 });
  const strikePercents = [137, 136, 125, 85, 84, 70];
  return {
    ...base,
    underlying: "Nifty",
    strikePercents,
    participations: [1, null],
    strikeSides: derivedSides({ ...base, strikePercents, participations: [1, null] }),
    expiryCount: 7,
    expiryDates: ["2029-09-25", "2029-12-25", "2030-03-26", "2030-06-25", "2030-09-24", "2030-12-31", "2031-03-25"],
    hedgeExpiryIndex: 2,
    hedgeStrike: 24000,
    hedgeStrikeAuto: false,
    notionalCr: 3,
    premiumRate: 0.076,
    marginGrowthRate: 0.06569,
  };
}

// Pricer B28 = 'Pricing Params'!H69, which the workbook holds at 6.60%.
const result = computeHedgingSheet(rolloverInputs(), market, { forwardGrowth: 0.066 });
if (!result.ok) throw new Error(result.errors.map((e) => e.message).join("; "));
const r = result;

function saved(sheet: string, address: string): number | string {
  const cell = workbook.Sheets[sheet]![address];
  if (!cell) throw new Error(`${sheet}!${address} is empty`);
  return cell.v instanceof Date ? cell.v.toISOString().slice(0, 10) : (cell.v as number | string);
}

function expectCells(sheet: string, addresses: string[], relative = 1e-6) {
  const misses: string[] = [];
  for (const address of addresses) {
    const expected = saved(sheet, address);
    const read = engineCell(r, sheet, address);
    if (!read) throw new Error(`${sheet}!${address} has no engine value`);
    const actual = read.value;
    const ok =
      typeof expected === "string"
        ? actual === expected
        : typeof actual === "number" && Math.abs(actual - expected) <= Math.max(relative * Math.abs(expected), read.kind === "price" ? 1e-4 : 1e-9);
    if (!ok) misses.push(`${sheet}!${address}: workbook ${expected}, engine ${String(actual)}`);
  }
  expect(misses).toEqual([]);
}

const cols = (letters: string[], rows: number[]) => rows.flatMap((row) => letters.map((c) => `${c}${row}`));

describe("G1: The Nifty Rollover Workbook Of 17-Jul-2026", () => {
  it("Summary Sheet: Inputs, The Derived Spread 2 Participation, Expiries, Greeks, Strike Prices And The Hedge", () => {
    expect(saved("Summary Sheet", "C2")).toBe("2026-07-17");
    expect(saved("Summary Sheet", "C5")).toBeCloseTo(0.076, 12);
    expectCells("Summary Sheet", ["C3", "C4", "C5", "C6", "C10", "D10", "G10", "H10", "I10", "J10", "K10", "L10", "M10", "N10", "O10", "C15", "D15"]);
    expectCells("Summary Sheet", cols(["C", "D", "E", "F", "G", "H", "I"], [12]));
    expectCells("Summary Sheet", cols(["E", "F", "G", "H", "J"], [15]));
    expectCells("Summary Sheet", cols(["E", "F", "G"], [23, 24, 25, 26, 27, 28]));
    expectCells("Summary Sheet", cols(["H", "I", "K", "L", "M"], [23]));
  });

  it("Pricer: Start Level, Rupee Strikes, Forward Growth, The Selling Forward Cap, Dividends, Forwards, Volatility, Prices, Units", () => {
    expectCells("Pricer", ["B5", "C5", "G5", "I5", "K5"]);
    expectCells("Pricer", cols(["B", "C", "D", "J", "R", "Z"], [17, 19, 20, 27, 28, 29, 30, 31, 32, 35, 47, 49, 52]));
  });

  it("Pricer: The Inbuilt The Workbook Saved From Its Last Goal Seek, Within 0.1%", () => {
    expectCells("Pricer", ["F5", "H5"], 1e-3);
  });

  it("Day1 Vega Hedge: The Hedge From The Summary, Its Quantity, Fair, Exchange And Stressed Prices, And The Margins", () => {
    expectCells("Day1 Vega Hedge", ["C2", "F2", "C3", "F3", "C4", "M6"]);
    expectCells("Day1 Vega Hedge", cols(["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"], [8, 15, 22]));
    expectCells("Day1 Vega Hedge", cols(["D", "E", "H", "I", "J", "K"], [26, 44, 62]));
  });

  it("MTM And Margin: The Spot Ladder From −50% To +20%, The 20% Futures Margin And The Options Margin", () => {
    expect(saved("MTM & Margin req", "D6")).toBe(-0.5);
    expect(saved("MTM & Margin req", "D20")).toBeCloseTo(0.2, 12);
    expectCells("MTM & Margin req", ["H2", ...cols(["C", "D", "F", "J"], [6, 10, 15, 20])]);
  });
});
