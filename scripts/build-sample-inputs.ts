/**
 * Builds public/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx from the workbook seeds.
 * Logo and masthead above a clean grid with thin grey borders, in the Unwinding Calculator layout.
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

import pricingSeed from "../lib/data/pricing-params-seed.json";
import volSeed from "../lib/data/vol-surface-seed.json";
import { applySampleDeskBrand, styleSampleDataCell, styleSampleHeaderCell } from "./sample-branding";

const PARAMS_SHEET = "Surface Parameters";
export const SAMPLE_FILE = "Hedging_Sheet_Vol_Surface_Sample.xlsx";

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

function fit(ws: ExcelJS.Worksheet, widths: Record<number, number>) {
  for (const [col, width] of Object.entries(widths)) ws.getColumn(Number(col)).width = width;
}

export async function buildVolSurfaceSample(outDir = path.join(process.cwd(), "public", "samples")): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Anand Rathi Wealth";
  const surface = volSeed;
  // The desk carries the latest surface into the current month, so the sample is labelled with it.
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).split("-").map(Number);
  const monthName = new Date(Date.UTC(year!, month! - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });
  const firstParam = surface.pricingParams.find((p) => utcDate(p.date) >= utcDate(`${surface.monthKey}-01`)) ?? surface.pricingParams[0]!;

  // Sheet 1: Vol Surface
  const ws = wb.addWorksheet("Vol Surface", { views: [{ showGridLines: false }] });
  const gridCols = 2 + surface.moneyness.length;
  const headRow = applySampleDeskBrand(
    wb,
    ws,
    `Volatility Surface Input · ${monthName} ${year}`,
    "Implied volatility in percent points by strike and expiry. Strike rows are live formulas of the reference prices times the Strike Change.",
    gridCols,
  );
  ws.getCell(headRow, 1).value = "Strike Change";
  ws.getCell(headRow, 2).value = "Deep";
  surface.moneyness.forEach((m, i) => {
    const cell = ws.getCell(headRow, 3 + i);
    cell.value = m;
    cell.numFmt = "0%";
  });
  for (let c = 1; c <= gridCols; c++) styleSampleHeaderCell(ws.getCell(headRow, c));

  const niftyRow = headRow + 1;
  const sensexRow = headRow + 2;
  const expiryHeader = headRow + 3;
  for (const [row, label] of [
    [niftyRow, "Nifty Strikes"],
    [sensexRow, "Sensex Strikes"],
  ] as const) {
    ws.getCell(row, 1).value = label;
    styleSampleDataCell(ws.getCell(row, 1), { horizontal: "left" });
    ws.getCell(row, 2).value = surface.deepStrike;
    ws.getCell(row, 2).numFmt = "#,##0";
    styleSampleDataCell(ws.getCell(row, 2));
  }
  ws.getCell(expiryHeader, 1).value = "Expiry Date";
  styleSampleDataCell(ws.getCell(expiryHeader, 1), { horizontal: "left" });
  for (let c = 2; c <= gridCols; c++) styleSampleDataCell(ws.getCell(expiryHeader, c));
  surface.expiries.forEach((expiry, r) => {
    const row = expiryHeader + 1 + r;
    ws.getCell(row, 1).value = utcDate(expiry);
    ws.getCell(row, 1).numFmt = "dd-mmm-yyyy";
    styleSampleDataCell(ws.getCell(row, 1));
    (surface.volsPercent[r] ?? []).forEach((v, c) => {
      const cell = ws.getCell(row, 2 + c);
      cell.value = Math.round(v * 100) / 100;
      cell.numFmt = "0.00";
      styleSampleDataCell(cell);
    });
  });

  // Sheet 2: Surface Parameters
  const params = wb.addWorksheet(PARAMS_SHEET, { views: [{ showGridLines: false }] });
  const tableRow = applySampleDeskBrand(
    wb,
    params,
    `Surface Parameters · ${monthName} ${year}`,
    "Reference prices are the 100 percent anchors of the Strike Change columns. The Pricing Params table is read by expiry date.",
    6,
  );
  const rows: Array<[string, ExcelJS.CellValue, string]> = [
    ["Month", `${monthName} ${year}`, "@"],
    ["Reference Nifty Price", surface.referenceUnderlyingPrice ?? null, "#,##0.00"],
    ["Reference Sensex Price", surface.referenceSensexPrice ?? null, "#,##0.00"],
    ["Volatility Bump", firstParam.volBump, "0.00%"],
    ["Forward Sell Rate", pricingSeed.forwardSellRate, "0.00%"],
    ["Rate Cap While Buying Forward", pricingSeed.rateCapBuyingForward, "0.00%"],
    ["Dividend Bid Offer Multiplier", pricingSeed.dividendBidOfferMultiplier, "0.00"],
    ["Bid or Offer", pricingSeed.bidOffer === "O" ? "Offer" : "Bid", "@"],
  ];
  params.getCell(tableRow, 1).value = "Parameter";
  params.getCell(tableRow, 2).value = "Value";
  styleSampleHeaderCell(params.getCell(tableRow, 1));
  styleSampleHeaderCell(params.getCell(tableRow, 2));
  rows.forEach(([label, value, fmt], i) => {
    const r = tableRow + 1 + i;
    params.getCell(r, 1).value = label;
    params.getCell(r, 2).value = value;
    params.getCell(r, 2).numFmt = fmt;
    styleSampleDataCell(params.getCell(r, 1), { horizontal: "left" });
    styleSampleDataCell(params.getCell(r, 2));
  });
  const niftyRefRow = tableRow + 2;
  const sensexRefRow = tableRow + 3;
  surface.moneyness.forEach((m, i) => {
    const col = 3 + i;
    const moneyAddr = `${colLetter(col)}${headRow}`;
    const nifty = ws.getCell(niftyRow, col);
    nifty.value = { formula: `'${PARAMS_SHEET}'!$B$${niftyRefRow}*${moneyAddr}`, result: m * (surface.referenceUnderlyingPrice ?? 0) };
    nifty.numFmt = "#,##0.00";
    styleSampleDataCell(nifty);
    const sensex = ws.getCell(sensexRow, col);
    sensex.value = { formula: `'${PARAMS_SHEET}'!$B$${sensexRefRow}*${moneyAddr}`, result: m * surface.referenceSensexPrice };
    sensex.numFmt = "#,##0.00";
    styleSampleDataCell(sensex);
  });

  const ppHead = tableRow + rows.length + 3;
  const ppHeaders = ["Date", "BID", "Inc. Margin", "Full Margin", "Margin Cost", "Fwd Sell rate"];
  ppHeaders.forEach((h, c) => {
    params.getCell(ppHead, 1 + c).value = h;
    styleSampleHeaderCell(params.getCell(ppHead, 1 + c));
  });
  surface.pricingParams.forEach((p, i) => {
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
      const cell = params.getCell(r, 1 + c);
      cell.value = value;
      cell.numFmt = fmt;
      styleSampleDataCell(cell);
    });
  });

  // Sheet 3: Rate Curve
  const curve = wb.addWorksheet("Rate Curve", { views: [{ showGridLines: false }] });
  const curveRow = applySampleDeskBrand(
    wb,
    curve,
    "Rate Curve",
    "Tenors in years from the valuation date, with rates in percent per annum. Linked points follow the Premium Growth Rate.",
    3,
  );
  ["Tenor In Years", "Rate In Percent", "Linked To Premium Growth Rate"].forEach((h, c) => {
    curve.getCell(curveRow, 1 + c).value = h;
    styleSampleHeaderCell(curve.getCell(curveRow, 1 + c));
  });
  pricingSeed.rateCurve.forEach((p, i) => {
    const r = curveRow + 1 + i;
    curve.getCell(r, 1).value = p.years;
    curve.getCell(r, 1).numFmt = "0.00";
    curve.getCell(r, 2).value = p.ratePercent;
    curve.getCell(r, 2).numFmt = "0.00";
    curve.getCell(r, 3).value = p.linkedToPremiumRate ? "Yes" : "No";
    for (let c = 1; c <= 3; c++) styleSampleDataCell(curve.getCell(r, c));
  });

  // Sheet 4: Dividends
  const divs = wb.addWorksheet("Dividends", { views: [{ showGridLines: false }] });
  const divRow = applySampleDeskBrand(wb, divs, "Implied Dividends", "Monthly implied dividends in Sensex index points.", 3);
  ["Date", "Implied Dividend"].forEach((h, c) => {
    divs.getCell(divRow, 1 + c).value = h;
    styleSampleHeaderCell(divs.getCell(divRow, 1 + c));
  });
  pricingSeed.dividends.forEach((p, i) => {
    const r = divRow + 1 + i;
    divs.getCell(r, 1).value = utcDate(p.date);
    divs.getCell(r, 1).numFmt = "dd-mmm-yyyy";
    divs.getCell(r, 2).value = p.amount;
    divs.getCell(r, 2).numFmt = "0.000";
    styleSampleDataCell(divs.getCell(r, 1));
    styleSampleDataCell(divs.getCell(r, 2));
  });

  fit(ws, Object.fromEntries([[1, 18], ...Array.from({ length: gridCols - 1 }, (_, i) => [i + 2, 11])]));
  fit(params, { 1: 32, 2: 16, 3: 14, 4: 14, 5: 14, 6: 14 });
  fit(curve, { 1: 16, 2: 18, 3: 30 });
  fit(divs, { 1: 16, 2: 18 });

  const out = path.join(outDir, SAMPLE_FILE);
  await wb.xlsx.writeFile(out);
  return out;
}

if (process.argv[1] && /build-sample-inputs/.test(process.argv[1])) {
  void buildVolSurfaceSample().then((out) => console.log("Wrote", path.relative(process.cwd(), out)));
}
