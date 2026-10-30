import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { addExcelMasthead, autofitExcelColumns, EXCEL_LINE_HEIGHT, excelCellDisplayLength } from "@/lib/excel/export-theme";

function cell(value: ExcelJS.CellValue, numFmt?: string): ExcelJS.Cell {
  const ws = new ExcelJS.Workbook().addWorksheet("T");
  const c = ws.getCell("A1");
  c.value = value;
  if (numFmt) c.numFmt = numFmt;
  return c;
}

describe("display length of a cell", () => {
  it("measures blanks, percents, date serials, grouped numbers and dates", () => {
    expect(excelCellDisplayLength(cell(null))).toBe(0);
    expect(excelCellDisplayLength(cell(""))).toBe(0);
    expect(excelCellDisplayLength(cell(0.1234, "0.00%"))).toBe(6);
    expect(excelCellDisplayLength(cell(0.01, "0%"))).toBe(5);
    expect(excelCellDisplayLength(cell(46352, "dd-mmm-yyyy"))).toBe(12);
    expect(excelCellDisplayLength(cell(1234567.891))).toBe("12,34,567.891".length);
    expect(excelCellDisplayLength(cell(new Date("2026-11-26T00:00:00Z")))).toBe(12);
  });

  it("measures rich text, formula results, hyperlinks and formulas with no result", () => {
    expect(excelCellDisplayLength(cell({ richText: [{ text: "Hedge " }, { text: "Strike" }] }))).toBe(12);
    expect(excelCellDisplayLength(cell({ formula: "A2*2", result: 123456 }))).toBe(6);
    expect(excelCellDisplayLength(cell({ text: "Open The Sheet", hyperlink: "https://example.com" }))).toBe(14);
    expect(excelCellDisplayLength(cell({ formula: "NOW()" } as ExcelJS.CellFormulaValue))).toBe(12);
  });

  it("gives a desk date typed as text at least 12 characters", () => {
    expect(excelCellDisplayLength(cell("26-Nov-26"))).toBe(12);
    expect(excelCellDisplayLength(cell("Hedge"))).toBe(5);
  });
});

describe("column autofit", () => {
  it("widens date columns, ignores banners from column A, sizes mid sheet merges and wraps long text", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("T");
    ws.getCell("A1").value = "Valuation Date";
    ws.getCell("A2").value = 46352;
    ws.getCell("A2").numFmt = "dd-mmm-yy";
    ws.mergeCells("A4:F4");
    ws.getCell("A4").value = "A banner across the whole sheet that should not widen column A at all";
    ws.mergeCells("B5:D5");
    ws.getCell("B5").value = "Key Value Merged";
    ws.getCell("C6").value = "x".repeat(150);
    autofitExcelColumns(ws, 40);
    expect(ws.getColumn(1).width).toBe("Valuation Date".length + 2);
    expect(ws.getColumn(2).width).toBe("Key Value Merged".length + 3);
    expect(ws.getColumn(3).width).toBe(40);
    expect(ws.getCell("C6").alignment?.wrapText).toBe(true);
    expect(ws.getRow(6).height).toBe(Math.ceil(150 / 39) * EXCEL_LINE_HEIGHT);
  });

  it("marks a column holding dd-mmm-yy text as a date column", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("T");
    ws.getCell("A1").value = "Expiry";
    ws.getCell("A2").value = "26-Nov-26";
    autofitExcelColumns(ws);
    expect(ws.getColumn(1).width).toBe(14);
  });
});

describe("masthead", () => {
  it("spans columns 1 to 10 from the top by default", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("T");
    const next = addExcelMasthead(ws, { title: "Pricer", subtitle: "Sensex" });
    expect(next).toBeGreaterThan(2);
    expect(ws.getCell(2, 10).isMerged).toBe(true);
  });
});
