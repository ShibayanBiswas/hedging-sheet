/**
 * Lists every formula cell on the five output sheets of the reference workbook and fails when one has no row
 * in docs/11-workbook-mapping.md, or when a file the mapping names does not exist.
 *
 *   npm run verify:mapping
 */
import { existsSync, readFileSync } from "node:fs";

import ExcelJS from "exceljs";

import { isFormula, OUTPUT_SHEETS, REFERENCE_WORKBOOK } from "./workbook-reference";

const MAPPING = "docs/11-workbook-mapping.md";

type Box = { top: number; left: number; bottom: number; right: number };

const columnNumber = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

function cellOf(address: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(address.trim());
  if (!m) throw new Error(`"${address}" is not a cell address.`);
  return { col: columnNumber(m[1]!), row: Number(m[2]) };
}

function boxOf(range: string): Box {
  const [a, b = a] = range.split(":");
  const p = cellOf(a!);
  const q = cellOf(b!);
  return { top: Math.min(p.row, q.row), bottom: Math.max(p.row, q.row), left: Math.min(p.col, q.col), right: Math.max(p.col, q.col) };
}

/** Mapping rows by sheet, and every file path the Code Function and Test columns name. */
function readMapping(): { boxes: Map<string, Box[]>; files: string[] } {
  const boxes = new Map<string, Box[]>();
  const files: string[] = [];
  for (const line of readFileSync(MAPPING, "utf8").split(/\r?\n/)) {
    if (!line.startsWith("|") || line.startsWith("|---")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 5 || cells[0] === "Workbook Sheet") continue;
    const [sheet, range, , code, test] = cells as [string, string, string, string, string];
    for (const m of code.matchAll(/`([^`\s]+\.tsx?)`/g)) files.push(m[1]!);
    if (test !== "-") files.push(test);
    if (!(OUTPUT_SHEETS as readonly string[]).includes(sheet)) continue;
    const list = boxes.get(sheet) ?? [];
    for (const part of range.split(",")) list.push(boxOf(part));
    boxes.set(sheet, list);
  }
  return { boxes, files };
}

async function main() {
  const { boxes, files } = readMapping();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(REFERENCE_WORKBOOK);

  const unmapped: string[] = [];
  let formulas = 0;
  for (const name of OUTPUT_SHEETS) {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`The reference workbook has no ${name} sheet.`);
    const sheetBoxes = boxes.get(name) ?? [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (!isFormula(cell.value)) return;
        formulas++;
        const { row: r, col: c } = cellOf(cell.address);
        if (!sheetBoxes.some((b) => r >= b.top && r <= b.bottom && c >= b.left && c <= b.right)) unmapped.push(`${name}!${cell.address}`);
      });
    });
  }

  const missing = [...new Set(files)].filter((f) => !existsSync(f));
  console.log(`${formulas} formula cells on ${OUTPUT_SHEETS.length} sheets; ${formulas - unmapped.length} mapped.`);
  if (unmapped.length) console.error(`Formula cells with no mapping row (${unmapped.length}):\n  ${unmapped.slice(0, 50).join("\n  ")}`);
  if (missing.length) console.error(`Files the mapping names that do not exist:\n  ${missing.join("\n  ")}`);
  if (unmapped.length || missing.length) process.exit(1);
  console.log("Every formula cell has a mapping row, and every named file exists.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
