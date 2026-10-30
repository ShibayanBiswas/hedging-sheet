import type ExcelJS from "exceljs";

import { seedMarketData } from "@/lib/engine/defaults";
import { formatDate } from "@/lib/engine/dates";
import type { HedgingResult, MarketData } from "@/lib/engine/types";
import { AUDIT_SHEET, auditSpecs, EXPORT_TABS, tabSpecs } from "@/lib/exports/tab-specs";
import { fmtDeskClock, fmtNumber } from "@/lib/format";
import type { DeskInputs } from "@/lib/inputs/draft";
import { strikeTypesLabel, type AnySpec, type GridSpec, type KeyValueSpec, type TableSpec } from "@/lib/tables";
import { writeTypedCell } from "@/lib/excel/excel-cells";
import { embedBrandLogo } from "@/lib/excel/export-branding";
import { addExcelMasthead, addExcelSection, autofitExcelColumns, EXCEL_FONT, EXCEL_THEME, excelHairline, excelThin } from "@/lib/excel/export-theme";

/** One sheet per tab, in tab order, then the Audit sheet of the run's inputs. */
export const SHEET_NAMES = [...EXPORT_TABS.map((t) => t.name), AUDIT_SHEET] as const;

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: EXCEL_THEME.maroon }, name: EXCEL_FONT };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = { bottom: excelThin(EXCEL_THEME.gold) };
}

function styleBody(cell: ExcelJS.Cell, emphasis: boolean) {
  const numFmt = cell.numFmt;
  const alignment = cell.alignment;
  cell.font = { size: 10, color: { argb: EXCEL_THEME.ink }, name: EXCEL_FONT, bold: emphasis };
  cell.border = { bottom: excelHairline() };
  cell.numFmt = numFmt;
  cell.alignment = { ...alignment, vertical: "middle" };
}

function writeNote(sheet: ExcelJS.Worksheet, r: number, note: string | undefined, col = 1): number {
  if (!note) return r;
  const cell = sheet.getCell(r, col);
  cell.value = note;
  cell.font = { italic: true, size: 9, color: { argb: EXCEL_THEME.muted }, name: EXCEL_FONT };
  return r + 1;
}

function writeTable(sheet: ExcelJS.Worksheet, row: number, spec: TableSpec): number {
  let r = addExcelSection(sheet, row, spec.title, 1, Math.max(spec.columns.length, 4));
  r = writeNote(sheet, r, spec.note);
  spec.columns.forEach((c, k) => {
    const cell = sheet.getCell(r, 1 + k);
    cell.value = c.label;
    styleHeader(cell);
  });
  sheet.getRow(r).height = 30;
  r += 1;
  spec.rows.forEach((values, i) => {
    spec.columns.forEach((c, k) => {
      const cell = sheet.getCell(r, 1 + k);
      writeTypedCell(cell, values[c.key] ?? null, c.kind, c.digits);
      styleBody(cell, spec.highlightRow === i || spec.totalRow === i);
    });
    r += 1;
  });
  return r + 1;
}

function writeKeyValue(sheet: ExcelJS.Worksheet, row: number, spec: KeyValueSpec): number {
  let r = addExcelSection(sheet, row, spec.title, 1, 4);
  r = writeNote(sheet, r, spec.note);
  for (const [k, label] of ["Item", "Value"].entries()) styleHeader(Object.assign(sheet.getCell(r, 1 + k), { value: label }));
  r += 1;
  for (const item of spec.items) {
    const labelCell = sheet.getCell(r, 1);
    labelCell.value = item.label;
    styleBody(labelCell, false);
    const valueCell = sheet.getCell(r, 2);
    writeTypedCell(valueCell, item.value, item.kind, item.digits);
    styleBody(valueCell, false);
    r += 1;
  }
  return r + 1;
}

function writeGrid(sheet: ExcelJS.Worksheet, row: number, spec: GridSpec): number {
  let r = addExcelSection(sheet, row, spec.title, 1, Math.min(spec.columnLabels.length + 1, 12));
  r = writeNote(sheet, r, spec.note);
  styleHeader(Object.assign(sheet.getCell(r, 1), { value: spec.corner[0] }));
  let col = 2;
  for (const g of spec.groups) {
    if (g.span > 1) sheet.mergeCells(r, col, r, col + g.span - 1);
    styleHeader(Object.assign(sheet.getCell(r, col), { value: g.label }));
    col += g.span;
  }
  r += 1;
  styleHeader(Object.assign(sheet.getCell(r, 1), { value: spec.corner[1] }));
  spec.columnLabels.forEach((label, k) => styleHeader(Object.assign(sheet.getCell(r, 2 + k), { value: label })));
  r += 1;
  for (const field of spec.rows) {
    const labelCell = sheet.getCell(r, 1);
    labelCell.value = field.label;
    styleBody(labelCell, true);
    field.values.forEach((v, k) => {
      const cell = sheet.getCell(r, 2 + k);
      writeTypedCell(cell, v, field.kind, field.digits);
      styleBody(cell, false);
    });
    r += 1;
  }
  return r + 1;
}

function writeSpec(sheet: ExcelJS.Worksheet, r: number, spec: AnySpec): number {
  if ("items" in spec) return writeKeyValue(sheet, r, spec);
  if ("corner" in spec) return writeGrid(sheet, r, spec);
  return writeTable(sheet, r, spec);
}

function specWidth(spec: AnySpec): number {
  if ("items" in spec) return 2;
  if ("corner" in spec) return spec.columnLabels.length + 1;
  return spec.columns.length;
}

function writeSheet(wb: ExcelJS.Workbook, name: string, title: string, subtitle: string, eyebrow: string, specs: AnySpec[], logo: string | null) {
  // Plain sheets: no gridlines, no frozen panes, no filters.
  const sheet = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  const width = Math.min(Math.max(4, ...specs.map(specWidth)), 22);
  const offset = logo ? embedBrandLogo(wb, sheet, logo, width) : 0;
  let r = addExcelMasthead(sheet, { title, subtitle, eyebrow, toCol: width, rowOffset: offset });
  for (const spec of specs) r = writeSpec(sheet, r, spec);
  autofitExcelColumns(sheet, 60);
}

/**
 * The workbook: one sheet per tab in tab order, each with the tables the tab shows, then the Audit sheet.
 * `extra.market` is the market data of the run; `extra.inputs` the inputs on screen, the run's by default.
 */
export function buildHedgingExcel(
  wb: ExcelJS.Workbook,
  result: HedgingResult,
  logo: string | null,
  extra: { market?: MarketData; inputs?: DeskInputs; runAt?: string } = {},
): ExcelJS.Workbook {
  const market = extra.market ?? seedMarketData();
  const inputs = extra.inputs ?? result.inputs;
  const i = result.inputs;
  const runAt = extra.runAt ?? fmtDeskClock(new Date());
  const subtitle = `${result.underlyingLabel} · Valuation Date ${formatDate(i.valuationDate)} · Spot ${fmtNumber(i.spot, 2)}`;
  const eyebrow = `Anand Rathi Wealth · Hedging Sheet · ${strikeTypesLabel(i.strikeOptionTypes)} · Run ${runAt}`;
  const ctx = { result, inputs, market };
  for (const tab of EXPORT_TABS) {
    const title = tab.id === "product" ? result.productDescription.title : tab.id === "margin" ? "Mark To Market And Margin Requirement" : tab.name;
    writeSheet(wb, tab.name, title, subtitle, eyebrow, tabSpecs(tab.id, ctx), logo);
  }
  writeSheet(wb, AUDIT_SHEET, "Audit", subtitle, eyebrow, auditSpecs(result, market, runAt), logo);
  return wb;
}
