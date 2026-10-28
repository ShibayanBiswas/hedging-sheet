import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { HedgingResult } from "@/lib/engine/types";
import { buildHedgingWorkbook, SHEET_NAMES } from "@/lib/workbook/build-hedging-excel";
import { hedgingExportFilename } from "@/lib/workbook/excel-runtime";

import { priced } from "./fixture";

function result(): HedgingResult {
  return priced();
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
    expect(valueRightOf(product, "Client Internal Rate of Return")).toBeCloseTo(r.productDescription.irr, 12);
    expect(valueRightOf(product, "Residual Futures To Be Done")).toBeCloseTo(r.productDescription.greeks.residualFutures, 6);

    const margin = reopened.getWorksheet("Mark to Market and Margin")!;
    const totals = columnValues(margin, "Total of Futures Margin, Mark to Market and Options Margin");
    expect(totals.length).toBe(15);
    expect(totals[10]).toBeCloseTo(r.markToMarket.zeroRow.totalRequirementCr, 9);

    const summary = reopened.getWorksheet("Summary Sheet")!;
    const premiums = columnValues(summary, "Premium in Crore");
    expect(premiums[premiums.length - 1]).toBeCloseTo(r.summary.totalPremiumCr, 9);

    const hedge = reopened.getWorksheet("Day 1 Vega Hedge")!;
    const lower = columnValues(hedge, "Lower Maturity");
    expect(lower.length).toBe(15);
    expect(lower.every((v) => v instanceof Date)).toBe(true);
    expect(valueRightOf(hedge, "Option Type")).toBe("Put");
    const upperForward = columnValues(hedge, "Upper Forward");
    expect(upperForward.every((v) => typeof v === "number")).toBe(true);
  });

  it("has no pivots and the Pricer header shows % strikes over real expiry dates", async () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingWorkbook(wb, result(), null);
    const buffer = await wb.xlsx.writeBuffer();
    expect(Buffer.from(buffer as ArrayBuffer).toString("latin1").includes("pivotTable")).toBe(false);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer as ArrayBuffer);
    const texts: string[] = [];
    reopened.getWorksheet("Pricer")!.eachRow((row) => row.eachCell((cell) => texts.push(String(cell.value))));
    expect(texts.includes("137% · 1,13,025")).toBe(true);
    expect(texts.some((t) => /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(t))).toBe(true);
    expect(texts.some((t) => /Strike Block|^Field$|^Expiry \d+$/.test(t))).toBe(false);
    const all: string[] = [];
    reopened.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => all.push(String(cell.value)))));
    expect(all.some((t) => /\bpercent\b|Helper Columns|Workbook Defaults|00-Jan-00/i.test(t) || /\bNaN\b|Infinity/.test(t))).toBe(false);
  });

  it("names the file by underlying and valuation date", () => {
    expect(hedgingExportFilename(result())).toBe("SP-Hedging-Sheet-Sensex-27-Oct-2026.xlsx");
  });
});
