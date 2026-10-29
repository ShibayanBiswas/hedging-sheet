import type ExcelJS from "exceljs";

import type { PricingParams, VolSurface } from "@/lib/engine/types";
import { rateCapSellingForward } from "@/lib/engine/rates";
import { pricingRowForMonth } from "@/lib/engine/vol-surface";
import { EXCEL_FONT, EXCEL_THEME, addExcelMasthead, excelFill, excelThin } from "@/lib/excel/export-theme";

const PARAMS_SHEET = "Surface Parameters";

function colLetter(n: number): string {
  let value = n;
  let out = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
}

function utcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

const border = () => ({
  top: excelThin(EXCEL_THEME.border),
  left: excelThin(EXCEL_THEME.border),
  bottom: excelThin(EXCEL_THEME.border),
  right: excelThin(EXCEL_THEME.border),
});

function headerCell(cell: ExcelJS.Cell) {
  cell.fill = { type: "pattern", pattern: "none" };
  cell.font = { bold: true, color: { argb: EXCEL_THEME.ink }, name: EXCEL_FONT, size: 9 };
  cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  cell.border = border();
}

function dataCell(cell: ExcelJS.Cell, horizontal: ExcelJS.Alignment["horizontal"] = "center") {
  cell.font = { name: EXCEL_FONT, size: 9, color: { argb: EXCEL_THEME.ink } };
  cell.alignment = { vertical: "middle", horizontal };
  cell.border = border();
}

/** Logo wash and desk masthead. Returns the first free content row. */
function brand(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, logoImageId: number | null, title: string, subtitle: string, cols: number): number {
  const toCol = Math.max(cols, 8);
  let rowOffset = 0;
  if (logoImageId != null) {
    ws.addImage(logoImageId, { tl: { col: 0, row: 0 }, ext: { width: 210, height: 48 } });
    for (let c = 1; c <= toCol; c += 1) for (const r of [1, 2, 3]) ws.getCell(r, c).fill = excelFill(EXCEL_THEME.goldPale);
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 6;
    rowOffset = 3;
  }
  void wb;
  return addExcelMasthead(ws, { title, subtitle, eyebrow: "Anand Rathi Wealth · Hedging Sheet", fromCol: 1, toCol, rowOffset });
}

/**
 * The vol surface file in the upload layout: Vol Surface, Surface Parameters with the forward Pricing Params grid,
 * Rate Curve and Dividends. Uploading the file back gives the same surface and parameters.
 */
export function buildSurfaceFile(
  wb: ExcelJS.Workbook,
  surface: VolSurface,
  params: PricingParams,
  options: { logoBase64?: string | null; asOf: string; premiumRate?: number },
): ExcelJS.Workbook {
  wb.creator = "Anand Rathi Wealth";
  const logoId = options.logoBase64 ? wb.addImage({ base64: options.logoBase64, extension: "png" }) : null;
  const label = surface.label;
  const row = pricingRowForMonth(surface.pricingParams, options.asOf);
  const fromTime = row ? utcDate(row.date).getTime() : -Infinity;
  const forwardGrid = surface.pricingParams.filter((p) => utcDate(p.date).getTime() >= fromTime);
  const futureDividends = params.dividends.filter((d) => d.date.slice(0, 10) >= options.asOf);

  // Vol Surface
  const ws = wb.addWorksheet("Vol Surface", { views: [{ showGridLines: false }] });
  const gridCols = 2 + surface.moneyness.length;
  const headRow = brand(wb, ws, logoId, label, "Implied volatility in % points by strike and expiry. Strike rows are the reference prices times the Strike Change.", gridCols);
  ws.getCell(headRow, 1).value = "Strike Change";
  ws.getCell(headRow, 2).value = "Deep";
  surface.moneyness.forEach((m, i) => {
    const cell = ws.getCell(headRow, 3 + i);
    cell.value = m;
    cell.numFmt = "0%";
  });
  for (let c = 1; c <= gridCols; c++) headerCell(ws.getCell(headRow, c));
  const niftyRow = headRow + 1;
  const sensexRow = headRow + 2;
  const expiryHeader = headRow + 3;
  for (const [r, text] of [
    [niftyRow, "Nifty Strikes"],
    [sensexRow, "Sensex Strikes"],
  ] as const) {
    ws.getCell(r, 1).value = text;
    dataCell(ws.getCell(r, 1), "left");
    ws.getCell(r, 2).value = surface.deepStrike;
    ws.getCell(r, 2).numFmt = "#,##0";
    dataCell(ws.getCell(r, 2));
  }
  ws.getCell(expiryHeader, 1).value = "Expiry Date";
  dataCell(ws.getCell(expiryHeader, 1), "left");
  for (let c = 2; c <= gridCols; c++) dataCell(ws.getCell(expiryHeader, c));
  surface.expiries.forEach((expiry, r) => {
    const rr = expiryHeader + 1 + r;
    ws.getCell(rr, 1).value = utcDate(expiry);
    ws.getCell(rr, 1).numFmt = "dd-mmm-yyyy";
    dataCell(ws.getCell(rr, 1));
    (surface.volsPercent[r] ?? []).forEach((v, c) => {
      const cell = ws.getCell(rr, 2 + c);
      cell.value = Math.round(v * 100) / 100;
      cell.numFmt = "0.00";
      dataCell(cell);
    });
  });

  // Surface Parameters
  const ps = wb.addWorksheet(PARAMS_SHEET, { views: [{ showGridLines: false }] });
  const tableRow = brand(wb, ps, logoId, `Surface Parameters · ${label.replace(" Volatility Surface", "")}`, "Reference prices are the 100% anchors of the Strike Change columns. The Pricing Params grid is read by expiry date.", 6);
  const rows: Array<[string, ExcelJS.CellValue, string]> = [
    ["Month", label.replace(" Volatility Surface", ""), "@"],
    ["Reference Nifty Price", surface.referenceUnderlyingPrice ?? null, "#,##0.00"],
    ["Reference Sensex Price", surface.referenceSensexPrice ?? null, "#,##0.00"],
    ["Bid or Offer", params.bidOffer === "O" ? "Offer" : "Bid", "@"],
    ["Volatility Bump", row?.volBump ?? 0, "0.00%"],
    ["Forward Sell Rate", row?.fwdSellRate ?? params.forwardSellRate, "0.00%"],
    ["Dividend Bid or Offer Factor", params.dividendBidOfferMultiplier, "0.00"],
    ["Rate Cap While Buying Forward", params.rateCapBuyingForward, "0.00%"],
    ["Rate Cap While Selling Forward", rateCapSellingForward(params, options.premiumRate ?? 0.065), "0.00%"],
  ];
  ps.getCell(tableRow, 1).value = "Parameter";
  ps.getCell(tableRow, 2).value = "Value";
  headerCell(ps.getCell(tableRow, 1));
  headerCell(ps.getCell(tableRow, 2));
  rows.forEach(([text, value, fmt], i) => {
    const r = tableRow + 1 + i;
    ps.getCell(r, 1).value = text;
    ps.getCell(r, 2).value = value;
    ps.getCell(r, 2).numFmt = fmt;
    dataCell(ps.getCell(r, 1), "left");
    dataCell(ps.getCell(r, 2));
  });
  const niftyRefRow = tableRow + 2;
  const sensexRefRow = tableRow + 3;
  surface.moneyness.forEach((m, i) => {
    const col = 3 + i;
    const moneyAddr = `${colLetter(col)}${headRow}`;
    const nifty = ws.getCell(niftyRow, col);
    nifty.value = { formula: `'${PARAMS_SHEET}'!$B$${niftyRefRow}*${moneyAddr}`, result: m * (surface.referenceUnderlyingPrice ?? 0) };
    nifty.numFmt = "#,##0.00";
    dataCell(nifty);
    const sensex = ws.getCell(sensexRow, col);
    sensex.value = { formula: `'${PARAMS_SHEET}'!$B$${sensexRefRow}*${moneyAddr}`, result: m * (surface.referenceSensexPrice ?? 0) };
    sensex.numFmt = "#,##0.00";
    dataCell(sensex);
  });
  const ppHead = tableRow + rows.length + 3;
  ["Date", "Volatility Bump", "Incremental Margin", "Full Margin", "Margin Cost", "Forward Sell Rate"].forEach((h, c) => {
    ps.getCell(ppHead, 1 + c).value = h;
    headerCell(ps.getCell(ppHead, 1 + c));
  });
  forwardGrid.forEach((p, i) => {
    const r = ppHead + 1 + i;
    const values: Array<[ExcelJS.CellValue, string]> = [
      [utcDate(p.date), "dd-mmm-yyyy"],
      [p.volBump, "0.00%"],
      [p.incMargin ?? 0, "0.00%"],
      [p.fullMargin ?? 0, "0.00%"],
      [p.marginCost ?? 0, "0.00%"],
      [p.fwdSellRate, "0.00%"],
    ];
    values.forEach(([value, fmt], c) => {
      const cell = ps.getCell(r, 1 + c);
      cell.value = value;
      cell.numFmt = fmt;
      dataCell(cell);
    });
  });

  // Rate Curve
  const curve = wb.addWorksheet("Rate Curve", { views: [{ showGridLines: false }] });
  const curveRow = brand(wb, curve, logoId, "Rate Curve", "Tenors in years from the valuation date, with rates in % per annum. Linked points follow the Premium Growth Rate.", 3);
  ["Tenor In Years", "Rate %", "Linked To Premium Growth Rate"].forEach((h, c) => {
    curve.getCell(curveRow, 1 + c).value = h;
    headerCell(curve.getCell(curveRow, 1 + c));
  });
  params.rateCurve.forEach((p, i) => {
    const r = curveRow + 1 + i;
    curve.getCell(r, 1).value = p.years;
    curve.getCell(r, 1).numFmt = "0.00";
    curve.getCell(r, 2).value = p.ratePercent;
    curve.getCell(r, 2).numFmt = "0.00";
    curve.getCell(r, 3).value = p.linkedToPremiumRate ? "Yes" : "No";
    for (let c = 1; c <= 3; c++) dataCell(curve.getCell(r, c));
  });

  // Dividends
  const divs = wb.addWorksheet("Dividends", { views: [{ showGridLines: false }] });
  const divRow = brand(wb, divs, logoId, "Implied Dividends", "Future implied dividends in Sensex index points. Nifty scales them by the ratio of the reference prices.", 3);
  ["Date", "Implied Dividend In Index Points"].forEach((h, c) => {
    divs.getCell(divRow, 1 + c).value = h;
    headerCell(divs.getCell(divRow, 1 + c));
  });
  futureDividends.forEach((p, i) => {
    const r = divRow + 1 + i;
    divs.getCell(r, 1).value = utcDate(p.date);
    divs.getCell(r, 1).numFmt = "dd-mmm-yyyy";
    divs.getCell(r, 2).value = p.amount;
    divs.getCell(r, 2).numFmt = "0.000";
    dataCell(divs.getCell(r, 1));
    dataCell(divs.getCell(r, 2));
  });

  const fit = (sheet: ExcelJS.Worksheet, widths: Record<number, number>) => {
    for (const [col, width] of Object.entries(widths)) sheet.getColumn(Number(col)).width = width;
  };
  fit(ws, Object.fromEntries([[1, 18], ...Array.from({ length: gridCols - 1 }, (_, i) => [i + 2, 11])]));
  fit(ps, { 1: 32, 2: 16, 3: 18, 4: 14, 5: 14, 6: 18 });
  fit(curve, { 1: 16, 2: 14, 3: 30 });
  fit(divs, { 1: 16, 2: 30 });
  return wb;
}

export function surfaceFileName(surface: VolSurface): string {
  return `Hedging_Sheet_Vol_Surface_${surface.monthKey}.xlsx`;
}
