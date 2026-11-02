import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import type { MarketData } from "@/lib/engine/types";
import { buildSurfaceFile } from "@/lib/excel/build-surface-file";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";

async function roundTrip(market: MarketData) {
  const wb = buildSurfaceFile(new ExcelJS.Workbook(), market.surface, market.params, { asOf: "2026-10-27" });
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return { wb, parsed: parseVolSurfaceFile(buffer, market.surface.monthKey) };
}

describe("Vol surface file round trip", () => {
  it("gives back a value typed to 3 decimals in the app", async () => {
    const market = seedMarketData();
    market.surface.volsPercent[0]![1] = 14.275;
    market.surface.volsPercent[1]![2] = 22.125;
    const { parsed } = await roundTrip(market);
    expect(parsed.surface.volsPercent[0]![1]).toBe(14.275);
    expect(parsed.surface.volsPercent[1]![2]).toBe(22.125);
  });

  it("gives back the whole surface, cell for cell", async () => {
    const market = seedMarketData();
    const { parsed } = await roundTrip(market);
    expect(parsed.surface.volsPercent).toEqual(market.surface.volsPercent);
  });

  it("shows up to 3 decimals and never fewer than 2", async () => {
    const market = seedMarketData();
    market.surface.volsPercent[0]![1] = 14.275;
    const { wb } = await roundTrip(market);
    const formats = new Set<string>();
    const sheet = wb.getWorksheet("Vol Surface")!;
    sheet.eachRow((row) => {
      if (!(row.getCell(1).value instanceof Date)) return;
      row.eachCell((cell, col) => {
        if (col > 1) formats.add(cell.numFmt);
      });
    });
    expect([...formats]).toEqual(["0.00#"]);
  });
});
