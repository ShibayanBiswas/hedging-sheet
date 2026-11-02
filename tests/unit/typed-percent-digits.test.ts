import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { cellKey, displayCell, outputTables, pricerGrid, strikeLabel, type AnySpec, type GridSpec, type TableSpec } from "@/lib/tables";

import { priced } from "../helpers/fixture";

/** Every cell the specs print, by row and column label. */
function printed(specs: AnySpec[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of specs) {
    if ("items" in spec) for (const item of spec.items) out[cellKey(item.label, "Value")] = displayCell(item.value, item.kind, item.digits).text;
    else if ("columns" in spec)
      spec.rows.forEach((row, r) => {
        for (const c of spec.columns) out[cellKey(`${spec.id}#${r}`, c.label)] = displayCell(row[c.key] ?? null, c.kind, c.digits).text;
      });
  }
  return out;
}

const TYPED = { strikePercents: [137.5, 127, 125, 84.5, 83, 72.5], coupon: 1.02125 };

function tabs(result = priced(TYPED)) {
  const t = outputTables(result);
  return { pricer: printed(t.pricer), product: printed(t.product), summary: printed(t.summary), raw: t };
}

describe("Output tabs print a typed percent without rounding it away", () => {
  it("Protection Till of 15.5% does not read 16%", () => {
    expect(tabs().pricer[cellKey("Protection Till", "Value")]).toBe("15.5%");
  });

  it("Total Coupon of 102.125% does not read 102.1%", () => {
    expect(tabs().pricer[cellKey("Total Coupon", "Value")]).toBe("102.125%");
  });

  it("Summary Sheet Strike % keeps 137.5% and 72.5%", () => {
    const out = tabs().summary;
    expect(out[cellKey("summary-options#0", "Strike %")]).toBe("137.5%");
    expect(out[cellKey("summary-options#5", "Strike %")]).toBe("72.5%");
    expect(out[cellKey("summary-options#1", "Strike %")]).toBe("127.0%");
  });

  it("the Product Description term sheet keeps the target, the spreads, the protection and the floor", () => {
    const out = tabs().product;
    expect(out[cellKey("Target Sensex Rise", "Value")]).toBe("37.5%");
    expect(out[cellKey("Spread 2", "Value")]).toMatch(/^27% To 37\.5% At /);
    expect(out[cellKey("Capital Protection", "Value")]).toBe("Down To -15.5%");
    expect(out[cellKey("Decay Floor", "Value")]).toBe("72.5% Of Start Level");
    expect(out[cellKey("Target Level", "Value")]).toBe("37.5%");
  });

  it("the Pricer strike band keeps a third decimal", () => {
    expect(strikeLabel(137.125, 106000)).toBe("137.125% · 106,000");
    expect(strikeLabel(84.5, 69123)).toBe("84.50% · 69,123");
    expect(strikeLabel(137, 106000)).toBe("137% · 106,000");
  });

  it("a surface parameter typed on Market Data keeps its decimals in the Pricer and Day 1 grids", () => {
    const market = seedMarketData();
    market.surface.pricingParams = market.surface.pricingParams.map((p) => ({ ...p, volBump: 0.0025, marginCost: 0.0275 }));
    const r = priced({}, market);
    const row = (spec: GridSpec, label: string) => spec.rows.find((x) => x.label === label)!;
    const text = (spec: GridSpec, label: string) => displayCell(row(spec, label).values[0] ?? null, row(spec, label).kind, row(spec, label).digits).text;
    const grid = pricerGrid(r);
    expect(text(grid, "Volatility Bump")).toBe("0.25%");
    expect(text(grid, "Incremental Margin Cost")).toBe("2.75%");
    expect(text(grid, "Full Margin Cost")).toBe("2.75%");
    const day1 = outputTables(r)["vega-hedge"].find((s) => s.id === "d1-fair") as TableSpec;
    const bump = day1.columns.find((c) => c.label === "Volatility Bump")!;
    expect(displayCell(day1.rows[0]![bump.key] ?? null, bump.kind, bump.digits).text).toBe("0.25%");
  });

  it("stops at 3 decimals", () => {
    const out = printed(outputTables(priced({ coupon: 1.021256 })).pricer);
    expect(out[cellKey("Total Coupon", "Value")]).toBe("102.126%");
  });

  it("a value worked out by the engine keeps its display", () => {
    expect(tabs().pricer[cellKey("Loss At The Protection Point", "Value")]).toBe("24.8%");
  });
});

describe("the default book", () => {
  it("prints these as it always has", () => {
    const { pricer, product, summary } = tabs(priced());
    expect(pricer[cellKey("Protection Till", "Value")]).toBe("15%");
    expect(pricer[cellKey("Total Coupon", "Value")]).toBe("102.5%");
    expect(pricer[cellKey("Loss At The Protection Point", "Value")]).toBe("24.0%");
    expect(summary[cellKey("summary-options#0", "Strike %")]).toBe("137%");
    expect(product[cellKey("Target Sensex Rise", "Value")]).toBe("37%");
    expect(product[cellKey("Spread 1", "Value")]).toMatch(/^25% To 27% At /);
    expect(product[cellKey("Capital Protection", "Value")]).toBe("Down To -15%");
    expect(product[cellKey("Decay Floor", "Value")]).toBe("70% Of Start Level");
    expect(product[cellKey("Target Level", "Value")]).toBe("37%");
    const grid = pricerGrid(priced());
    const row = (label: string) => grid.rows.find((x) => x.label === label)!;
    expect(displayCell(row("Volatility Bump").values[0] ?? null, "percent", row("Volatility Bump").digits).text).toBe("0.0%");
    expect(displayCell(row("Full Margin Cost").values[0] ?? null, "percent", row("Full Margin Cost").digits).text).toBe("3.0%");
  });
});
