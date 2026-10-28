import type ExcelJS from "exceljs";

import { formatDate } from "@/lib/engine/dates";
import { deriveTerms } from "@/lib/engine/structure";
import type { HedgingResult } from "@/lib/engine/types";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import {
  marginTable,
  pricerGrid,
  pricerHeaderTable,
  pricerPayoutTable,
  productTables,
  summaryTables,
  vegaHedgeInputs,
  vegaHedgeMarginTable,
  vegaHedgePriceTable,
  type GridSpec,
  type KeyValueSpec,
  type TableSpec,
} from "@/lib/tables";
import { writeTypedCell } from "@/lib/workbook/excel-cells";
import { embedBrandLogo } from "@/lib/workbook/export-branding";
import {
  addExcelKpiTiles,
  addExcelMasthead,
  addExcelSection,
  autofitExcelColumns,
  EXCEL_FONT,
  EXCEL_THEME,
  excelFill,
  excelHairline,
  excelThin,
} from "@/lib/workbook/export-theme";

/** Excel caps sheet names at 31 characters, so the last sheet title is shortened on the tab only. */
export const SHEET_NAMES = [
  "Summary Sheet",
  "Pricer",
  "Product Description",
  "Day 1 Vega Hedge",
  "Mark to Market and Margin",
] as const;

const box: Partial<ExcelJS.Borders> = {
  top: excelThin(),
  left: excelThin(),
  bottom: excelThin(),
  right: excelThin(),
};

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: EXCEL_THEME.maroon }, name: EXCEL_FONT };
  cell.fill = excelFill(EXCEL_THEME.label);
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = { ...box, bottom: excelThin(EXCEL_THEME.gold) };
}

function styleBody(cell: ExcelJS.Cell, alt: boolean, highlight: boolean, total: boolean) {
  cell.font = { size: 10, color: { argb: EXCEL_THEME.ink }, name: EXCEL_FONT, bold: total || highlight };
  cell.fill = excelFill(highlight ? EXCEL_THEME.goldSoft : alt ? EXCEL_THEME.ivory : EXCEL_THEME.white);
  cell.border = { ...box, bottom: excelHairline() };
}

function writeTable(sheet: ExcelJS.Worksheet, row: number, spec: TableSpec, fromCol = 1): number {
  let r = addExcelSection(sheet, row, spec.title, fromCol, fromCol + Math.max(spec.columns.length - 1, 3));
  if (spec.note) {
    const cell = sheet.getCell(r, fromCol);
    cell.value = spec.note;
    cell.font = { italic: true, size: 9, color: { argb: EXCEL_THEME.muted }, name: EXCEL_FONT };
    r += 1;
  }
  if (spec.columns.some((c) => c.group)) {
    spec.columns.forEach((c, k) => {
      const cell = sheet.getCell(r, fromCol + k);
      cell.value = c.group ?? "";
      styleHeader(cell);
      cell.fill = excelFill(EXCEL_THEME.goldPale);
    });
    r += 1;
  }
  spec.columns.forEach((c, k) => {
    const cell = sheet.getCell(r, fromCol + k);
    cell.value = c.label;
    styleHeader(cell);
  });
  sheet.getRow(r).height = 30;
  r += 1;
  spec.rows.forEach((values, i) => {
    spec.columns.forEach((c, k) => {
      const cell = sheet.getCell(r, fromCol + k);
      writeTypedCell(cell, values[c.key] ?? null, c.kind, c.digits);
      const fmt = cell.numFmt;
      const align = cell.alignment;
      styleBody(cell, i % 2 === 1, spec.highlightRow === i, spec.totalRow === i);
      cell.numFmt = fmt;
      cell.alignment = align;
    });
    r += 1;
  });
  return r + 1;
}

function writeKeyValue(sheet: ExcelJS.Worksheet, row: number, spec: KeyValueSpec): number {
  let r = addExcelSection(sheet, row, spec.title, 1, 4);
  for (const [k, label] of ["Item", "Value"].entries()) {
    const cell = sheet.getCell(r, 1 + k);
    cell.value = label;
    styleHeader(cell);
  }
  r += 1;
  spec.items.forEach((item, i) => {
    const labelCell = sheet.getCell(r, 1);
    labelCell.value = item.label;
    styleBody(labelCell, i % 2 === 1, false, false);
    const valueCell = sheet.getCell(r, 2);
    writeTypedCell(valueCell, item.value, item.kind, item.digits);
    const fmt = valueCell.numFmt;
    const align = valueCell.alignment;
    styleBody(valueCell, i % 2 === 1, false, false);
    valueCell.numFmt = fmt;
    valueCell.alignment = align;
    r += 1;
  });
  return r + 1;
}

function writeGrid(sheet: ExcelJS.Worksheet, row: number, spec: GridSpec): { next: number; headerRow: number } {
  let r = addExcelSection(sheet, row, spec.title, 1, Math.min(spec.columnLabels.length + 1, 12));
  if (spec.note) {
    const cell = sheet.getCell(r, 1);
    cell.value = spec.note;
    cell.font = { italic: true, size: 9, color: { argb: EXCEL_THEME.muted }, name: EXCEL_FONT };
    r += 1;
  }
  const groupCell = sheet.getCell(r, 1);
  groupCell.value = "Strike Block";
  styleHeader(groupCell);
  let col = 2;
  for (const g of spec.groups) {
    if (g.span > 1) sheet.mergeCells(r, col, r, col + g.span - 1);
    const cell = sheet.getCell(r, col);
    cell.value = g.label;
    styleHeader(cell);
    cell.fill = excelFill(EXCEL_THEME.goldPale);
    col += g.span;
  }
  r += 1;
  const headerRow = r;
  const labelHead = sheet.getCell(r, 1);
  labelHead.value = "Field";
  styleHeader(labelHead);
  spec.columnLabels.forEach((label, k) => {
    const cell = sheet.getCell(r, 2 + k);
    cell.value = label;
    styleHeader(cell);
  });
  r += 1;
  spec.rows.forEach((field, i) => {
    const labelCell = sheet.getCell(r, 1);
    labelCell.value = field.label;
    styleBody(labelCell, i % 2 === 1, false, true);
    field.values.forEach((v, k) => {
      const cell = sheet.getCell(r, 2 + k);
      writeTypedCell(cell, v, field.kind, field.digits);
      const fmt = cell.numFmt;
      const align = cell.alignment;
      styleBody(cell, i % 2 === 1, false, false);
      cell.numFmt = fmt;
      cell.alignment = align;
    });
    r += 1;
  });
  return { next: r + 1, headerRow };
}

function finishSheet(sheet: ExcelJS.Worksheet, ySplit: number, xSplit = 0) {
  sheet.views = [{ state: "frozen", xSplit, ySplit, showGridLines: false }];
  autofitExcelColumns(sheet, 60);
}

function startSheet(
  wb: ExcelJS.Workbook,
  name: string,
  title: string,
  result: HedgingResult,
  logo: string | null,
  width: number,
): { sheet: ExcelJS.Worksheet; row: number } {
  const sheet = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  const offset = logo ? embedBrandLogo(wb, sheet, logo, width) : 0;
  const i = result.inputs;
  const row = addExcelMasthead(sheet, {
    title,
    subtitle: `${result.underlyingLabel} · Valuation Date ${formatDate(i.valuationDate)} · Spot ${fmtNumber(i.spot, 2)}`,
    eyebrow: `Anand Rathi Wealth · Hedging Sheet · ${i.optionType === "C" ? "Call" : "Put"} Book · Generated ${formatDate(new Date().toISOString())}`,
    toCol: width,
    rowOffset: offset,
  });
  return { sheet, row };
}

/** The five workbook sheets, in order, styled with the desk export theme. */
export function buildHedgingWorkbook(wb: ExcelJS.Workbook, result: HedgingResult, logo: string | null): ExcelJS.Workbook {
  const u = result.underlyingLabel;
  const s = result.summary;

  // Summary Sheet
  {
    const summary = summaryTables(result);
    const width = 12;
    const { sheet, row } = startSheet(wb, SHEET_NAMES[0], "Summary Sheet", result, logo, width);
    let r = addExcelKpiTiles(
      sheet,
      row,
      [
        ["Actual Inbuilt", fmtPercent(s.actualInbuilt)],
        ["Option Premium", `${fmtCrore(s.totalPremiumCr)} Crore`],
        ["Maturity Payout", `${fmtCrore(result.productDescription.maturityCr)} Crore`],
        ["Margin Requirement", fmtPercent(s.margin)],
        ["Hedge Quantity", fmtNumber(result.dayOneVegaHedge.quantity, 2)],
        ["Internal Rate of Return", fmtPercent(s.irr)],
      ],
      width,
    );
    const top = r;
    for (const block of summary.blocks) r = "items" in block ? writeKeyValue(sheet, r, block) : writeTable(sheet, r, block);
    finishSheet(sheet, top - 1);
  }

  // Pricer
  {
    const grid = pricerGrid(result);
    const width = Math.min(grid.columnLabels.length + 1, 22);
    const { sheet, row } = startSheet(wb, SHEET_NAMES[1], "Pricer", result, logo, width);
    let r = writeTable(sheet, row, pricerHeaderTable(result));
    r = writeKeyValue(sheet, r, pricerPayoutTable(result));
    const out = writeGrid(sheet, r, grid);
    finishSheet(sheet, out.headerRow, 1);
  }

  // Product Description
  {
    const pd = productTables(result);
    const width = 6;
    const { sheet, row } = startSheet(wb, SHEET_NAMES[2], result.productDescription.title, result, logo, width);
    let r = addExcelKpiTiles(
      sheet,
      row,
      [
        ["Maturity Value", `${fmtCrore(result.productDescription.maturityCr)} Crore`],
        ["Internal Rate of Return", fmtPercent(result.productDescription.irr)],
        ["Maximum Coupon", fmtPercent(result.inputs.coupon)],
        ["Protection", fmtPercent(deriveTerms(result.inputs).protection, 0)],
      ],
      width,
    );
    const top = r;
    for (const block of [pd.details, pd.maturity, pd.greeks, pd.rates]) r = writeKeyValue(sheet, r, block);
    writeTable(sheet, r, pd.payoff);
    finishSheet(sheet, top - 1);
  }

  // Day 1 Vega Hedge
  {
    const width = 14;
    const { sheet, row } = startSheet(wb, SHEET_NAMES[3], "Day 1 Vega Hedge", result, logo, width);
    let r = writeKeyValue(sheet, row, vegaHedgeInputs(result));
    const top = r;
    r = writeTable(sheet, r, vegaHedgeMarginTable(result));
    r = writeTable(sheet, r, vegaHedgePriceTable(result, "fair"));
    r = writeTable(sheet, r, vegaHedgePriceTable(result, "exchange"));
    writeTable(sheet, r, vegaHedgePriceTable(result, "stressed"));
    finishSheet(sheet, top - 1, 1);
  }

  // Mark to Market and Margin Requirement
  {
    const spec = marginTable(result);
    const width = spec.columns.length;
    const { sheet, row } = startSheet(wb, SHEET_NAMES[4], "Mark to Market and Margin Requirement", result, logo, width);
    const zero = result.markToMarket.zeroRow;
    const worst = result.markToMarket.worstCase;
    const r = addExcelKpiTiles(
      sheet,
      row,
      [
        ["Requirement At 0 Percent Move", `${fmtCrore(zero.totalRequirementCr)} Crore`],
        ["Worst Case Requirement", `${fmtCrore(worst.totalRequirementCr)} Crore At ${fmtPercent(worst.move, 0)}`],
        [`${u} Level At 0 Percent`, fmtNumber(zero.level, 0)],
        ["Margin As Percent Of Notional", fmtPercent(s.margin)],
      ],
      width,
    );
    const headerRow = r + 3;
    writeTable(sheet, r, spec);
    finishSheet(sheet, headerRow, 1);
  }

  return wb;
}
