import type ExcelJS from "exceljs";

import { parseYmd } from "@/lib/engine/dates";
import type { CellKind, CellValue } from "@/lib/tables";

/** A download cell. Numbers and dates stay native Excel types. */
export type ExcelCell = string | number | Date | null;

function decimals(digits: number): string {
  return digits > 0 ? `.${"0".repeat(digits)}` : "";
}

/** Real Excel number formats per kind: percent 0.00%, crore #,##,##0.00, dates dd-mmm-yyyy. */
export function numFmtFor(kind: CellKind, digits?: number): string | undefined {
  switch (kind) {
    case "percent":
      return `0${decimals(digits ?? 2)}%`;
    case "crore":
    case "rupee":
      return `#,##,##0${decimals(digits ?? 2)}`;
    case "integer":
      return "#,##0";
    case "number":
      return `#,##0${decimals(digits ?? 2)}`;
    case "greek":
      return `0${decimals(digits ?? 8)}`;
    case "date":
      return "dd-mmm-yyyy";
    default:
      return undefined;
  }
}

/** Write a typed value. Blank, zero dates and non-finite numbers become "-". */
export function writeTypedCell(cell: ExcelJS.Cell, value: CellValue, kind: CellKind, digits?: number): void {
  if (value == null || value === "" || value === "-") {
    cell.value = "-";
    cell.alignment = { horizontal: kind === "text" ? "left" : "right" };
    return;
  }
  if (kind === "date") {
    const d = parseYmd(String(value));
    if (Number.isNaN(d.getTime())) {
      cell.value = "-";
      return;
    }
    cell.value = d;
    cell.numFmt = "dd-mmm-yyyy";
    cell.alignment = { horizontal: "right" };
    return;
  }
  if (kind === "text") {
    cell.value = String(value);
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    cell.value = "-";
    cell.alignment = { horizontal: "right" };
    return;
  }
  cell.value = Object.is(n, -0) ? 0 : n;
  const fmt = numFmtFor(kind, digits);
  if (fmt) cell.numFmt = fmt;
  cell.alignment = { horizontal: "right" };
}

/** Theme KPI tiles call this with untyped values; they pass preformatted text. */
export function writeExcelCell(cell: ExcelJS.Cell, value: ExcelCell, header?: string): void {
  void header;
  if (value == null || value === "" || value === "-") {
    cell.value = "-";
    return;
  }
  cell.value = value instanceof Date || typeof value === "number" ? value : String(value);
}
