import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { logicModules } from "@/lib/logic-atlas";
import { outputTables, specCells, specHeaders } from "@/lib/tables";

import { priced } from "../helpers/fixture";

/** Columns and tables taken off the display. */
const REMOVED = ["Used In", "Linked To Premium Growth Rate", "Rate Used", "Pricing Params Forward Grid", "Pricing Parameters By Expiry", "Rate Curve As Read", "Implied Dividends"];
/** The text a cell holds: plain text, rich text, or the cached result of a formula. */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value !== "object" || value instanceof Date) return String(value);
  if ("richText" in value) return value.richText.map((t) => t.text).join("");
  if ("result" in value) return String(value.result ?? "");
  return "";
}

const hits = (texts: string[]) => texts.flatMap((t) => REMOVED.filter((gone) => t.includes(gone)).map((gone) => `"${gone}" in "${t.slice(0, 80)}"`));

describe("the removed columns and tables appear nowhere", () => {
  const r = priced();

  it("not in the five tab Excel file: sheet names, headers or cells", () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, r, null);
    const texts: string[] = [];
    wb.eachSheet((ws) => {
      texts.push(ws.name);
      ws.eachRow((row) => row.eachCell((cell) => texts.push(cellText(cell.value))));
    });
    expect(texts.length).toBeGreaterThan(200);
    expect(hits(texts)).toEqual([]);
  });

  it("not in the Logic Atlas: no card, step, formula, output or row", () => {
    const texts = logicModules("Sensex", "Thursday").flatMap((m) => [
      m.title,
      m.subtitle,
      m.description,
      ...m.nodes.flatMap((n) => [n.label, n.description]),
      ...m.formulas.flatMap((f) => [f.name, f.words, f.inputs, f.output]),
      ...m.outputs.map((o) => o.label),
      ...m.insights(r),
      ...m.edgeCases,
    ]);
    expect(hits(texts)).toEqual([]);
  });

  it("not in the output tables", () => {
    const texts = Object.values(outputTables(r))
      .flat()
      .flatMap((spec) => [spec.title, spec.note ?? "", ...specHeaders(spec).flat(), ...specCells(spec).map((c) => c.text)]);
    expect(hits(texts)).toEqual([]);
  });
});
