import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { EXPORT_TABS } from "@/lib/exports/tab-specs";
import { outputTables, specCells } from "@/lib/tables";

import { G0_OPTIONS, g0Inputs, run } from "../golden/cases";
import saved from "../golden/fixtures/workbook-values.json";

const OUTPUT_TABS = ["summary", "pricer", "product", "vega-hedge", "margin"] as const;
const WB = saved as Record<string, Record<string, number | string>>;

async function exported() {
  const r = run(g0Inputs(), undefined, G0_OPTIONS);
  const wb = new ExcelJS.Workbook();
  buildHedgingExcel(wb, r, null);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return { r, book: reopened };
}

function numbersOf(sheet: ExcelJS.Worksheet): number[] {
  const out: number[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => void (typeof cell.value === "number" && out.push(cell.value))));
  return out.sort((a, b) => a - b);
}

/** The number a label heads: beside it in an Item and Value table, or under it in a one-row headline table. */
function valueOf(sheet: ExcelJS.Worksheet, label: string): ExcelJS.CellValue {
  let found: ExcelJS.CellValue = null;
  sheet.eachRow((row, r) =>
    row.eachCell((cell, col) => {
      if (found != null || cell.value !== label) return;
      const beside = row.getCell(col + 1).value;
      const under = sheet.getRow(r + 1).getCell(col).value;
      found = typeof beside === "number" ? beside : typeof under === "number" ? under : null;
    }),
  );
  return found;
}

describe("Excel export of the reference workbook's own case", () => {
  it("writes every number of every output table unrounded: the sheet's numbers are the page tables' numbers", async () => {
    const { r, book } = await exported();
    const tables = outputTables(r);
    for (const tab of OUTPUT_TABS) {
      const name = EXPORT_TABS.find((t) => t.id === tab)!.name;
      const want = tables[tab]
        .flatMap(specCells)
        .map((c) => c.value)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        .map((v) => (Object.is(v, -0) ? 0 : v))
        .sort((a, b) => a - b);
      const got = numbersOf(book.getWorksheet(name)!);
      expect(got.length, name).toBe(want.length);
      expect(got.filter((v, i) => v !== want[i]).length, name).toBe(0);
    }
  });

  it("carries the workbook's saved headline values", async () => {
    const { book } = await exported();
    const pricer = book.getWorksheet("Pricer")!;
    const summary = book.getWorksheet("Summary Sheet")!;
    const s = WB["Summary Sheet"]!;
    const p = WB["Pricer"]!;
    const d = WB["Product Description"]!;
    // Pricer F5, H5, K5, O5, P5, U5 and V5; Summary E10, F10, F29 and Q10; Product Description D48 and H33.
    const pairs: Array<[ExcelJS.Worksheet, string, number]> = [
      [pricer, "Start Sensex Level", p.B5 as number],
      [pricer, "Actual Inbuilt", p.F5 as number],
      [pricer, "Inbuilt In Rupees", p.H5 as number],
      [pricer, "Premium In Rupees", p.K5 as number],
      [pricer, "Maturity Payout In Rupees", p.O5 as number],
      [pricer, "Achieved Coupon", p.P5 as number],
      [pricer, "Internal Rate Of Return", p.U5 as number],
      [summary, "Actual Inbuilt", s.E10 as number],
      [summary, "Internal Rate Of Return", s.F10 as number],
      [summary, "Margin", s.Q10 as number],
      [book.getWorksheet("Product Description")!, "Maturity Amount In Crore", d.D48 as number],
      [book.getWorksheet("Product Description")!, "Options Quantity Required For Vega Hedge", d.H33 as number],
    ];
    const off = pairs
      .map(([sheet, label, want]) => [sheet.name, label, valueOf(sheet, label), want] as const)
      .filter(([, , got, want]) => typeof got !== "number" || Math.abs(got - want) > 1e-6 * Math.max(1, Math.abs(want)));
    expect(off).toEqual([]);
  });
});
