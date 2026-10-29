/**
 * Saves every value the reference workbook stores on its five output sheets to a JSON fixture,
 * so the golden test compares against frozen values and never opens the workbook itself.
 *
 *   npx tsx scripts/extract-workbook-values.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import { OUTPUT_SHEETS, REFERENCE_WORKBOOK, savedValue } from "./workbook-reference";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(REFERENCE_WORKBOOK);
  const out: Record<string, Record<string, number | string>> = {};
  for (const name of OUTPUT_SHEETS) {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`The reference workbook has no ${name} sheet.`);
    const cells: Record<string, number | string> = {};
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = savedValue(cell.value);
        if (v !== undefined) cells[cell.address] = v;
      });
    });
    out[name] = cells;
  }
  const file = path.join("tests", "golden", "fixtures", "workbook-values.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(out, null, 0)}\n`);
  const total = Object.values(out).reduce((s, c) => s + Object.keys(c).length, 0);
  console.log(`Saved ${total} values from ${OUTPUT_SHEETS.length} sheets to ${file}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
