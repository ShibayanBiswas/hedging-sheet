// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { VolSurfaceGrid } from "@/components/market/vol-surface-grid";
import { seedMarketData } from "@/lib/engine/defaults";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { tabSpecs } from "@/lib/exports/tab-specs";
import { volText } from "@/lib/format";
import type { DeskInputs } from "@/lib/inputs/draft";
import { specBlocks } from "@/lib/pdf/blocks";
import { displayCell, type TableSpec } from "@/lib/tables";

import { fixtureInputs, priced } from "../helpers/fixture";

function market() {
  const m = seedMarketData();
  m.surface.volsPercent[0]![1] = 14.275;
  m.surface.volsPercent[0]![2] = 14.2;
  m.surface.volsPercent[0]![3] = 53.498203;
  return m;
}
const asOf = (m: ReturnType<typeof market>) => m.surface.expiries[0]!.slice(0, 10);

describe("volText", () => {
  it("shows up to 3 decimals and never fewer than 2", () => {
    expect(volText(14.275).text).toBe("14.275");
    expect(volText(14.2).text).toBe("14.20");
    expect(volText(14).text).toBe("14.00");
    expect(volText(53.498203).text).toBe("53.498");
  });

  it("shows a dash for a value that is missing or failed", () => {
    expect(volText(null).text).toBe("-");
    expect(volText(Number.NaN).title).toBe("The value could not be computed");
  });
});

describe("Market Data surface on the page", () => {
  it("shows 14.275 as typed, keeps 14.20 at 2 decimals and stops 53.498203 at 3", () => {
    const m = market();
    render(<VolSurfaceGrid surface={m.surface} asOf={asOf(m)} />);
    const row = within(screen.getByTestId("vol-grid")).getAllByRole("row").find((r) => r.textContent?.includes("14.275"))!;
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(2, 5)).toEqual(["14.275", "14.20", "53.498"]);
  });

  it("the edit cell opens on the same text", () => {
    const m = market();
    render(<VolSurfaceGrid surface={m.surface} asOf={asOf(m)} editing draft={m.surface.volsPercent} />);
    expect((screen.getByTestId("vol-cell-0-1") as HTMLInputElement).value).toBe("14.275");
    expect((screen.getByTestId("vol-cell-0-2") as HTMLInputElement).value).toBe("14.20");
  });

  it("the scale legend reads the same way, and the reference strikes stay at 2 decimals", () => {
    const m = market();
    m.surface.volsPercent[1]![1] = 3.125;
    render(<VolSurfaceGrid surface={m.surface} asOf={asOf(m)} />);
    expect(screen.getByTestId("vol-grid-legend")).toHaveTextContent("3.125%");
    expect(screen.getByTestId("deep-strike-sensex")).toHaveTextContent(/^[\d,]+\.\d{2}$/);
  });
});

describe("Market Data tab export", () => {
  const inputs = fixtureInputs() as DeskInputs;
  const table = (id: string, m: ReturnType<typeof market>) => tabSpecs("market-data", { result: null, inputs, market: m }).find((s) => s.id === id) as TableSpec;

  it("prints volatilities up to 3 decimals, cell by cell, and the values in full", () => {
    const m = market();
    const spec = table("md-surface", m);
    const row = spec.rows[0]!;
    const shown = ["m0", "m1", "m2"].map((key) => displayCell(row[key] ?? null, spec.columns.find((c) => c.key === key)!.kind).text);
    expect(shown).toEqual(["14.275", "14.20", "53.498"]);
    expect(row.m2).toBe(53.498203);
    expect(JSON.stringify(specBlocks(spec))).toContain('"14.275"');
  });

  it("keeps the reference strikes at 2 decimals in their own table", () => {
    const spec = table("md-strikes", market());
    expect(spec.rows.map((r) => r.row)).toEqual(["Nifty Strikes", "Sensex Strikes"]);
    expect(displayCell(spec.rows[1]!.m0 ?? null, spec.columns.find((c) => c.key === "m0")!.kind, spec.columns.find((c) => c.key === "m0")!.digits).text).toMatch(/^[\d,]+\.\d{2}$/);
  });

  it("writes Excel cells that show up to 3 decimals", () => {
    const m = market();
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, priced({}, m), null, { market: m });
    const formats: string[] = [];
    wb.getWorksheet("Market Data")!.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.value === 14.275) formats.push(cell.numFmt);
      }),
    );
    expect(formats).toEqual(["0.00#"]);
  });
});
