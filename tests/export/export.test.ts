import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { HedgingResult } from "@/lib/engine/types";
import { buildHedgingExcel, SHEET_NAMES } from "@/lib/excel/build-hedging-excel";
import { hedgingExportFilename } from "@/lib/excel/excel-runtime";
import { EXCEL_THEME } from "@/lib/excel/export-theme";
import { titleCaseViolations } from "@/lib/format/title-case";

import { priced } from "../helpers/fixture";

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

describe("Excel number formats", () => {
  it("show at most 3 decimals on every numeric cell of every sheet", () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, priced({ strikeOptionTypes: ["C", "P", "C", "P", "P", "P"] }), null);
    const wide: string[] = [];
    let numbers = 0;
    wb.eachSheet((ws) =>
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          if (typeof cell.value !== "number") return;
          numbers++;
          const places = Math.max(0, ...(cell.numFmt ?? "General").split(";").map((part) => part.match(/\.([0#]+)/)?.[1]?.length ?? 0));
          if (places > 3 || !cell.numFmt || cell.numFmt === "General") wide.push(`${ws.name}!${cell.address} "${cell.numFmt ?? "General"}"`);
        }),
      ),
    );
    expect(numbers).toBeGreaterThan(2000);
    expect(wide.slice(0, 20)).toEqual([]);
  });
});

describe("Excel download", () => {
  it("has one sheet per tab in tab order, then Audit, with no frozen panes, no filters and no gridlines", async () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, result(), null);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(reopened.worksheets.map((s) => s.name)).toEqual([
      "Inputs",
      "Summary Sheet",
      "Pricer",
      "Product Description",
      "Day 1 Vega Hedge",
      "Mark To Market",
      "Market Data",
      "Logic Atlas",
      "Audit",
    ]);
    for (const sheet of reopened.worksheets) {
      expect(sheet.views.every((v) => v.state !== "frozen" && v.showGridLines === false), sheet.name).toBe(true);
      expect(sheet.autoFilter ?? null, sheet.name).toBeNull();
      expect(sheet.rowCount, sheet.name).toBeGreaterThan(4);
    }
  });

  it("labels the third expiry as the observation and hedge option expiry, and the Audit sheet records the run", async () => {
    const r = result();
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, r, null, { runAt: "28-Oct-2026 · 10:00:00 am IST" });
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const inputs = reopened.getWorksheet("Inputs")!;
    expect(valueRightOf(inputs, "Expiry 3 · Observation And Hedge Option Expiry")).toEqual(new Date(`${r.schedule.expiries[2]}T00:00:00.000Z`));
    expect(valueRightOf(inputs, "Expiry 1 · Observation")).toBeInstanceOf(Date);
    const audit = reopened.getWorksheet("Audit")!;
    expect(valueRightOf(audit, "Run At")).toBe("28-Oct-2026 · 10:00:00 am IST");
    expect(valueRightOf(audit, "Coupon")).toBeCloseTo(r.inputs.coupon, 12);
    expect(valueRightOf(audit, "Inbuilt")).toBeCloseTo(r.summary.actualInbuilt, 12);
  });

  it("values match the engine", async () => {
    const r = result();
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, r, null);
    const buffer = await wb.xlsx.writeBuffer();

    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer as ArrayBuffer);
    expect(reopened.worksheets.map((s) => s.name)).toEqual([...SHEET_NAMES]);

    const product = reopened.getWorksheet("Product Description")!;
    expect(valueRightOf(product, "Maturity Amount In Crore")).toBeCloseTo(r.productDescription.maturityCr, 9);
    expect(valueRightOf(product, "Client Internal Rate Of Return")).toBeCloseTo(r.productDescription.irr, 12);
    expect(valueRightOf(product, "Residual Futures To Be Done")).toBeCloseTo(r.productDescription.greeks.residualFutures, 6);

    const margin = reopened.getWorksheet("Mark To Market")!;
    const totals = columnValues(margin, "Total Margin In Crore");
    expect(totals.length).toBe(15);
    expect(totals[10]).toBeCloseTo(r.markToMarket.zeroRow.totalRequirementCr, 9);

    const summary = reopened.getWorksheet("Summary Sheet")!;
    const premiums = columnValues(summary, "Premium In Crore");
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
    buildHedgingExcel(wb, result(), null);
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

  it("capitalises every word of the sheet names and every header row", async () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, result(), null);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const offenders: string[] = [];
    for (const sheet of reopened.worksheets) {
      if (titleCaseViolations(sheet.name).length) offenders.push(`sheet name: ${sheet.name}`);
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          // Header cells are bold maroon on the label fill; masthead titles are bold too.
          const header = cell.font?.bold && cell.font?.color?.argb === EXCEL_THEME.maroon;
          if (!header || typeof cell.value !== "string") return;
          const bad = titleCaseViolations(cell.value);
          if (bad.length) offenders.push(`${sheet.name}!${cell.address}: "${cell.value}" (${bad.join(", ")})`);
        }),
      );
    }
    expect(offenders).toEqual([]);
  });

  it("names the file by underlying and valuation date", () => {
    expect(hedgingExportFilename(result())).toBe("SP-Hedging-Sheet-Sensex-27-Oct-2026.xlsx");
  });
});
