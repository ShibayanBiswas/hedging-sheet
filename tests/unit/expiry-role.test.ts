import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { medianExpiryIndex, quarterlyExpiries } from "@/lib/engine/schedule";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { outputTables, type TableSpec } from "@/lib/tables";

import { priced } from "../helpers/fixture";

const ROLE = "Observation And Hedge Option Expiry";

function expiryTable(r: ReturnType<typeof priced>): TableSpec {
  return outputTables(r).summary.find((s) => s.id === "summary-expiries") as TableSpec;
}

describe("the expiry role follows the chosen Option Expiry", () => {
  for (const choice of [null, 0, 3, 5] as const) {
    it(`Option Expiry ${choice == null ? "median" : `Expiry ${choice + 1}`}: one row carries the role, and every expiry is listed`, () => {
      const r = priced({ hedgeExpiryIndex: choice });
      const rows = expiryTable(r).rows;
      const index = choice ?? medianExpiryIndex(r.schedule.expiries.length);
      expect(rows.map((row) => row.date)).toEqual(r.schedule.expiries);
      expect(rows.filter((row) => row.role === ROLE)).toHaveLength(1);
      expect(rows[index]!.role).toBe(ROLE);
      expect(r.summary.hedgeExpiry).toBe(r.schedule.expiries[index]);
    });
  }

  it("lists all 10 dates when there are 10 expiries", () => {
    const r = priced({ expiryCount: 10, expiryDates: quarterlyExpiries("2027-01-28", 10, "Sensex"), hedgeExpiryIndex: 9 });
    const rows = expiryTable(r).rows;
    expect(rows).toHaveLength(10);
    expect(rows[9]!.role).toBe(ROLE);
  });

  it("writes the same role to the Summary Sheet of the Excel file", () => {
    const r = priced({ hedgeExpiryIndex: 3 });
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, r, null);
    const roles: string[] = [];
    wb.getWorksheet("Summary Sheet")!.eachRow((row) => row.eachCell((c) => typeof c.value === "string" && c.value.startsWith("Observation") && roles.push(c.value)));
    expect(roles.filter((x) => x === ROLE)).toHaveLength(1);
    expect(roles).toHaveLength(r.schedule.expiries.length);
  });
});
