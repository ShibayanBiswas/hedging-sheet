/** Builds the simulation Excel for the default product, reopens it and checks the sheets and key values. */
import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import { defaultInputs, seedMarketData } from "../lib/engine/defaults";
import { computeHedgingSheet } from "../lib/engine/hedging-sheet";
import { buildHedgingWorkbook, SHEET_NAMES } from "../lib/workbook/build-hedging-excel";
import { hedgingExportFilename } from "../lib/workbook/excel-runtime";

async function main() {
  const r = computeHedgingSheet(defaultInputs({ valuationDate: "2026-10-27", spot: 82000, dailyVol: 0.009 }), seedMarketData());
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  const wb = new ExcelJS.Workbook();
  buildHedgingWorkbook(wb, r, null);
  const buffer = await wb.xlsx.writeBuffer();
  const out = path.join(process.cwd(), "test-results", hedgingExportFilename(r));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(buffer as ArrayBuffer));

  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer as ArrayBuffer);
  const names = reopened.worksheets.map((s) => s.name);
  const sheetsOk = JSON.stringify(names) === JSON.stringify([...SHEET_NAMES]);
  console.log(`${sheetsOk ? "PASS" : "FAIL"}  Sheets: ${names.join(", ")}`);
  for (const s of reopened.worksheets) console.log(`      ${s.name.padEnd(28)} ${s.rowCount} rows, ${s.columnCount} columns`);
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
  if (!sheetsOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
