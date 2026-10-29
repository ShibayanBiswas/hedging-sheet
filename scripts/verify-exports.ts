/** Builds the simulation Excel for the default product, reopens it and checks the sheets and key values. */
import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import { defaultInputs, seedMarketData } from "../lib/engine/defaults";
import { computeHedgingSheet } from "../lib/engine/hedging-sheet";
import { buildHedgingExcel, SHEET_NAMES } from "../lib/excel/build-hedging-excel";
import { hedgingExportFilename } from "../lib/excel/excel-runtime";

async function main() {
  const r = computeHedgingSheet(defaultInputs({ valuationDate: "2026-10-27", spot: 82000, dailyVol: 0.009 }), seedMarketData());
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  const wb = new ExcelJS.Workbook();
  buildHedgingExcel(wb, r, null);
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
  const noPivots = !Buffer.from(buffer as ArrayBuffer).toString("latin1").includes("pivotTable");
  console.log(`${noPivots ? "PASS" : "FAIL"}  No pivot tables`);
  const texts: string[] = [];
  reopened.getWorksheet("Pricer")!.eachRow((row) => row.eachCell((cell) => texts.push(String(cell.value))));
  const headersOk = texts.some((t) => /^\d+(\.\d+)?% · [\d,]+$/.test(t)) && texts.some((t) => /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(t)) && !texts.some((t) => /Strike Block|^Field$|^Expiry \d+$/.test(t));
  console.log(`${headersOk ? "PASS" : "FAIL"}  Pricer header: % strikes over real expiry dates`);
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
  if (!sheetsOk || !noPivots || !headersOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
