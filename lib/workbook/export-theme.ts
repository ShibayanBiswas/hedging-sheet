/**
 * Shared Anand Rathi desk export theme for Excel.
 * Same maroon / gold language as the Primary SP Dashboard.
 */
import type ExcelJS from "exceljs";

/** ARGB hex for ExcelJS fills / fonts / borders. */
export const EXCEL_THEME = {
  maroon: "FF7A1E2C",
  maroonDeep: "FF5C1622",
  maroonSoft: "FFF7EDEF",
  gold: "FFD4B24C",
  goldRich: "FFC4A03E",
  goldSoft: "FFF6EDCF",
  goldPale: "FFFCF8EE",
  ivory: "FFFAF7EF",
  parchment: "FFF8F4EA",
  white: "FFFFFFFF",
  ink: "FF1C1917",
  inkSoft: "FF44403C",
  muted: "FF78716C",
  label: "FFF3EFE6",
  border: "FFE7E1CF",
  borderStrong: "FFD4B24C",
  rule: "FFC9B88A",
} as const;

export const EXCEL_FONT = "Calibri";

export function excelFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function excelThin(argb: string = EXCEL_THEME.border): Partial<ExcelJS.Border> {
  return { style: "thin", color: { argb } };
}

export function excelHairline(argb: string = EXCEL_THEME.rule): Partial<ExcelJS.Border> {
  return { style: "hair", color: { argb } };
}

function excelMedium(argb: string = EXCEL_THEME.gold): Partial<ExcelJS.Border> {
  return { style: "medium", color: { argb } };
}

const DESK_DATE_TEXT_RE = /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/;
const DESK_DATE_HEADER_RE = /\bdate\b/i;

/** True when the cell renders as a desk date (native Date, date numFmt, or dd-mmm-yy text). */
function excelCellLooksLikeDate(cell: ExcelJS.Cell): boolean {
  const v = cell.value;
  if (v instanceof Date) return true;
  const fmt = String(cell.numFmt ?? "");
  if (/[dym]/i.test(fmt) && /mmm|yyyy|yy|dd/i.test(fmt)) return true;
  if (typeof v === "string" && DESK_DATE_TEXT_RE.test(v.trim())) return true;
  return false;
}

/** Display length of a cell value for autofit. */
function excelCellDisplayLength(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v == null || v === "") return 0;
  if (typeof v === "number") {
    const fmt = String(cell.numFmt ?? "");
    if (fmt.includes("%")) return Math.max(4, `${(v * 100).toFixed(2)}%`.length);
    // Excel date serials with dd-mmm-yy need room or the cell prints ####.
    if (/[dym]/i.test(fmt) && /mmm|yyyy|yy|dd/i.test(fmt)) return 12;
    return v.toLocaleString("en-IN", { maximumFractionDigits: 4 }).length;
  }
  if (v instanceof Date) return 12;
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((part) => part.text).join("").length;
    }
    if ("result" in v && v.result != null && typeof v.result !== "object") {
      return String(v.result).length;
    }
    if ("text" in v) return String((v as { text?: unknown }).text ?? "").length;
    if ("formula" in v) return 12;
  }
  const text = String(v);
  if (DESK_DATE_TEXT_RE.test(text.trim())) return Math.max(12, text.length);
  return text.length;
}

/**
 * Size each column to the longest visible cell.
 * Date columns get a hard floor so Excel never renders #### for dd-mmm-yy values.
 * Cap at `max` so extreme formulae columns stay usable.
 * Full-width merged chrome (masthead / section / disclaimer starting at column A) is
 * ignored so banners do not inflate every column. Mid-sheet value merges (e.g. B:F key
 * values) still size their master column from the cell text.
 */
export function autofitExcelColumns(sheet: ExcelJS.Worksheet, max = 60): void {
  const multiColMerges = new Map<string, { startCol: number; endCol: number }>();
  for (const merge of sheet.model.merges ?? []) {
    const text = String(merge);
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(text);
    if (!m) continue;
    const startCol = columnLettersToNumber(m[1]!);
    const endCol = columnLettersToNumber(m[3]!);
    if (endCol > startCol) {
      multiColMerges.set(`${m[1]!.toUpperCase()}${m[2]}`, { startCol, endCol });
    }
  }

  sheet.columns.forEach((col, colIndex) => {
    if (!col || typeof col.eachCell !== "function") return;
    let longest = 1;
    let dateColumn = false;
    const headerText = String(sheet.getRow(1).getCell((colIndex ?? 0) + 1).value ?? "");
    if (DESK_DATE_HEADER_RE.test(headerText)) dateColumn = true;

    col.eachCell({ includeEmpty: false }, (cell) => {
      if (excelCellLooksLikeDate(cell)) dateColumn = true;
      if (typeof cell.value === "string" && DESK_DATE_HEADER_RE.test(cell.value)) dateColumn = true;
      if (cell.isMerged) {
        const master = cell.master ?? cell;
        if (cell !== master) return;
        const info = multiColMerges.get(String(master.address).toUpperCase());
        if (info) {
          if (info.startCol === 1) return;
          longest = Math.max(longest, excelCellDisplayLength(cell));
          return;
        }
      }
      longest = Math.max(longest, excelCellDisplayLength(cell));
    });

    // +1 padding: Calibri character width under-measures vs Excel's column unit,
    // which is what produced #### on date cells with exact string length widths.
    const floor = dateColumn ? 14 : 10;
    const pad = dateColumn ? 2 : 3;
    col.width = Math.min(max, Math.max(floor, longest + pad));
  });
}

function columnLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

/**
 * Classy desk masthead — gold rule, maroon title band, gold subtitle, ink eyebrow.
 * Returns the next free content row.
 */
export function addExcelMasthead(
  sheet: ExcelJS.Worksheet,
  options: {
    title: string;
    subtitle: string;
    eyebrow?: string;
    fromCol?: number;
    toCol?: number;
    rowOffset?: number;
  },
): number {
  const from = options.fromCol ?? 1;
  const to = options.toCol ?? 10;
  const base = options.rowOffset ?? 0;

  sheet.mergeCells(1 + base, from, 1 + base, to);
  const rule = sheet.getCell(1 + base, from);
  rule.fill = excelFill(EXCEL_THEME.gold);
  sheet.getRow(1 + base).height = 5;

  sheet.mergeCells(2 + base, from, 2 + base, to);
  const banner = sheet.getCell(2 + base, from);
  banner.value = options.title;
  banner.fill = excelFill(EXCEL_THEME.maroonDeep);
  banner.font = {
    bold: true,
    size: 18,
    color: { argb: EXCEL_THEME.white },
    name: EXCEL_FONT,
  };
  banner.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2 + base).height = 36;

  sheet.mergeCells(3 + base, from, 3 + base, to);
  const sub = sheet.getCell(3 + base, from);
  sub.value = options.subtitle;
  sub.fill = excelFill(EXCEL_THEME.gold);
  sub.font = {
    bold: true,
    size: 10,
    color: { argb: EXCEL_THEME.ink },
    name: EXCEL_FONT,
  };
  sub.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  sheet.getRow(3 + base).height = 22;

  let next = 4 + base;
  if (options.eyebrow?.trim()) {
    sheet.mergeCells(next, from, next, to);
    const eye = sheet.getCell(next, from);
    eye.value = options.eyebrow;
    eye.fill = excelFill(EXCEL_THEME.parchment);
    eye.font = {
      size: 8,
      italic: true,
      color: { argb: EXCEL_THEME.muted },
      name: EXCEL_FONT,
    };
    eye.alignment = { vertical: "middle", horizontal: "left" };
    eye.border = { bottom: excelThin(EXCEL_THEME.rule) };
    sheet.getRow(next).height = 16;
    next += 1;
  }

  sheet.getRow(next).height = 8;
  return next + 1;
}

/** Section rail — maroon accent bar + soft gold wash. */
export function addExcelSection(
  sheet: ExcelJS.Worksheet,
  row: number,
  title: string,
  fromCol = 1,
  toCol = 6,
): number {
  sheet.mergeCells(row, fromCol, row, toCol);
  const cell = sheet.getCell(row, fromCol);
  cell.value = title.toUpperCase();
  cell.fill = excelFill(EXCEL_THEME.goldSoft);
  cell.font = {
    bold: true,
    size: 11,
    color: { argb: EXCEL_THEME.maroon },
    name: EXCEL_FONT,
  };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.border = {
    left: excelMedium(EXCEL_THEME.maroon),
    bottom: excelThin(EXCEL_THEME.gold),
    top: excelHairline(EXCEL_THEME.rule),
    right: excelHairline(EXCEL_THEME.rule),
  };
  sheet.getRow(row).height = 24;
  return row + 1;
}
