import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { seedMarketData, workbookDefaultInputs } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgingResult } from "@/lib/engine/types";
import { buildHedgingWorkbook, SHEET_NAMES } from "@/lib/workbook/build-hedging-excel";
import { hedgingExportFilename } from "@/lib/workbook/excel-runtime";

function result(): HedgingResult {
  const r = computeHedgingSheet(workbookDefaultInputs(), seedMarketData());
  if (!r.ok) throw new Error("engine failed");
  return r;
}

/** Find the cell to the right of a label, or the value under a header in the next row. */
function valueRightOf(sheet: ExcelJS.Worksheet, label: string): ExcelJS.CellValue {
  let found: ExcelJS.CellValue = null;
  sheet.eachRow((row) => {
    row.eachCell((cell, col) => {
      if (found == null && cell.value === label) found = row.getCell(col + 1).value;
    });
  });
  return found;
}

function columnValues(sheet: ExcelJS.Worksheet, header: string): ExcelJS.CellValue[] {
  let headerRow = -1;
  let headerCol = -1;
  sheet.eachRow((row, r) => {
    row.eachCell((cell, c) => {
      if (headerRow < 0 && cell.value === header) {
        headerRow = r;
        headerCol = c;
      }
    });
  });
  const out: ExcelJS.CellValue[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const v = sheet.getRow(r).getCell(headerCol).value;
    if (v == null) break;
    out.push(v);
  }
  return out;
}

describe("Excel download", () => {
  it("has the five sheets in order and values match the engine", async () => {
    const r = result();
    const wb = new ExcelJS.Workbook();
    buildHedgingWorkbook(wb, r, null);
    const buffer = await wb.xlsx.writeBuffer();

    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer as ArrayBuffer);
    expect(reopened.worksheets.map((s) => s.name)).toEqual([...SHEET_NAMES]);

    const product = reopened.getWorksheet("Product Description")!;
    expect(valueRightOf(product, "Maturity Amount in Crore")).toBeCloseTo(r.productDescription.maturityCr, 9);
    expect(valueRightOf(product, "Internal Rate of Return")).toBeCloseTo(r.productDescription.irr, 12);

    const margin = reopened.getWorksheet("Mark to Market and Margin")!;
    const totals = columnValues(margin, "Total of Futures Margin, Mark to Market and Options Margin");
    expect(totals.length).toBe(15);
    expect(totals[10]).toBeCloseTo(r.markToMarket.zeroRow.totalRequirementCr, 9);

    const summary = reopened.getWorksheet("Summary Sheet")!;
    const premiums = columnValues(summary, "Premium in Crore");
    expect(premiums[premiums.length - 1]).toBeCloseTo(r.summary.totalPremiumCr, 9);

    const hedge = reopened.getWorksheet("Day 1 Vega Hedge")!;
    const lower = columnValues(hedge, "Lower Maturity");
    expect(lower.every((v) => v === "-")).toBe(true);
    const upperForward = columnValues(hedge, "Upper Forward");
    expect(upperForward.every((v) => typeof v === "number")).toBe(true);
  });

  it("names the file by underlying and valuation date", () => {
    expect(hedgingExportFilename(result())).toBe("SP-Hedging-Sheet-Sensex-04-Aug-2026.xlsx");
  });
});
