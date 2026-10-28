import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";
import { expect, type Page } from "@playwright/test";

import { titleCaseViolations } from "../../lib/format/title-case";
import { SHEET_NAMES } from "../../lib/workbook/build-hedging-excel";
import { close, schema, type CellRead, type TabId } from "./tables";

const OUT = path.join("test-results", "downloads");

const SHEET_FOR_TAB: Record<TabId, string> = {
  summary: SHEET_NAMES[0],
  pricer: SHEET_NAMES[1],
  product: SHEET_NAMES[2],
  "vega-hedge": SHEET_NAMES[3],
  margin: SHEET_NAMES[4],
};

/** Download Excel from the header and return the saved path. */
async function downloadExcel(page: Page): Promise<{ file: string; name: string }> {
  fs.mkdirSync(OUT, { recursive: true });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-excel").click()]);
  const file = path.join(OUT, `${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  return { file, name: download.suggestedFilename() };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result);
  return String(v);
}

/** Row number where these labels sit in consecutive cells from column A, or null. */
function findRow(sheet: ExcelJS.Worksheet, labels: string[]): number | null {
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (labels.every((label, i) => cellText(row.getCell(i + 1).value).trim() === label)) return r;
  }
  return null;
}

/**
 * B17.2 to B17.6 on a downloaded workbook: sheet names and order, no pivots in the zip, every web table's header row
 * present, one-row headline values equal to the page, no "Workbook" text, and title case on names and headers.
 */
async function excelProblems(file: string, ui: Record<string, Record<string, CellRead>>): Promise<string[]> {
  const problems: string[] = [];
  const zip = fs.readFileSync(file).toString("latin1");
  for (const part of ["xl/pivotCache", "xl/pivotTables"]) if (zip.includes(part)) problems.push(`the zip contains ${part}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const names = wb.worksheets.map((s) => s.name);
  if (JSON.stringify(names) !== JSON.stringify([...SHEET_NAMES])) problems.push(`sheets ${names.join(", ")}`);
  for (const n of names) for (const w of titleCaseViolations(n)) problems.push(`sheet name "${n}" needs a capital on ${w}`);

  for (const sheet of wb.worksheets) {
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (/workbook/i.test(cellText(cell.value))) problems.push(`${sheet.name} ${cell.address} says "${cellText(cell.value)}"`);
      }),
    );
  }

  for (const [tab, tables] of Object.entries(schema.tabs) as Array<[TabId, (typeof schema.tabs)[TabId]]>) {
    const sheet = wb.getWorksheet(SHEET_FOR_TAB[tab]);
    if (!sheet) continue;
    for (const t of tables) {
      const header = t.headers[t.headers.length - 1]!;
      const at = findRow(sheet, header);
      if (at == null) {
        problems.push(`${sheet.name} has no header row ${JSON.stringify(header)} for ${t.id}`);
        continue;
      }
      for (const h of header) for (const w of titleCaseViolations(h)) problems.push(`${sheet.name} header "${h}" needs a capital on ${w}`);
      if (t.rowLabels.length !== 1 || t.headers.length !== 1) continue;
      // One-row headline tables: each value cell equals the number on the page.
      const values = sheet.getRow(at + 1);
      header.forEach((h, i) => {
        const shown = ui[t.id]?.[`${t.rowLabels[0]}::${h}`];
        const v = values.getCell(i + 1).value;
        if (shown?.value != null && typeof v === "number" && !close(v, shown.value, 1e-9)) {
          problems.push(`${sheet.name} ${t.id} ${h}: Excel ${v} != page ${shown.value}`);
        }
      });
    }
  }
  return problems;
}

export async function expectExcelMatches(page: Page, ui: Record<string, Record<string, CellRead>>, underlying = "Sensex") {
  const { file, name } = await downloadExcel(page);
  expect(name).toBe(`SP-Hedging-Sheet-${underlying}-28-Oct-2026.xlsx`);
  expect(await excelProblems(file, ui)).toEqual([]);
}
