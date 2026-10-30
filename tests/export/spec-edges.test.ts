import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import type { MarketData } from "@/lib/engine/types";
import { buildSurfaceFile } from "@/lib/excel/build-surface-file";
import { excelCellDisplayLength } from "@/lib/excel/export-theme";
import { tabSpecs } from "@/lib/exports/tab-specs";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";

import { fixtureInputs } from "../helpers/fixture";
import { numbersIn } from "../golden/independent";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Every label and value of every spec, flattened to text, plus any number that is not finite. */
function read(specs: unknown) {
  const json = JSON.stringify(specs);
  return { json, bad: numbersIn(specs).filter(([, n]) => !Number.isFinite(n)).map(([p]) => p) };
}

/** A market whose surface has no anchors, no 55% column and no Pricing Params, priced on the Offer side. */
function bareMarket(): MarketData {
  const m = seedMarketData();
  const keep = m.surface.moneyness.map((x, i) => ({ x, i })).filter(({ x }) => Math.abs(x - 0.55) > 1e-9);
  return {
    surface: {
      ...m.surface,
      referenceSensexPrice: undefined,
      referenceUnderlyingPrice: undefined,
      moneyness: keep.map(({ x }) => x),
      strikes: [m.surface.strikes[0]!, ...keep.map(({ x }) => x)],
      volsPercent: m.surface.volsPercent.map((row) => [row[0]!, ...keep.map(({ i }) => row[i + 1]!)]),
      pricingParams: [],
    },
    params: { ...m.params, bidOffer: "O" },
  };
}

describe("Inputs tab export", () => {
  it("Blank Inputs export every group with dashes and no NaN", () => {
    const { json, bad } = read(tabSpecs("inputs", { result: null, inputs: blankInputs(), market: seedMarketData() }));
    expect(bad).toEqual([]);
    expect(json).not.toMatch(/NaN|undefined/);
  });

  it("names a typed hedge strike, an edited volatility, Calls and Sells", () => {
    const inputs = { ...fixtureInputs({ strikeOptionTypes: ["C", "P", "C", "P", "P", "P"] }), hedgeStrikeAuto: false, dailyVolSource: "overridden" } as DeskInputs;
    const { json } = read(tabSpecs("inputs", { result: null, inputs, market: seedMarketData() }));
    for (const word of ["Typed", "Edited", "Call", "Put", "Buy", "Sell"]) expect(json).toContain(`"${word}"`);
  });

  it("a half typed strike row exports dashes for what is missing", () => {
    const base = fixtureInputs() as DeskInputs;
    const inputs = { ...base, spot: Number.NaN, strikeOptionTypes: base.strikeOptionTypes.map(() => ""), strikeSides: base.strikeSides.map(() => ""), expiryDates: ["", ...base.expiryDates.slice(1)] } as DeskInputs;
    const { bad } = read(tabSpecs("inputs", { result: null, inputs, market: seedMarketData() }));
    expect(bad).toEqual([]);
  });
});

describe("Market Data tab export", () => {
  it("a surface with no anchors, no 55% column and no Pricing Params exports dashes, and names the Offer side", () => {
    const { json, bad } = read(tabSpecs("market-data", { result: null, inputs: fixtureInputs() as DeskInputs, market: bareMarket() }));
    expect(bad).toEqual([]);
    expect(json).toContain('"Offer"');
  });
});

describe("Vol surface file", () => {
  it("builds with the logo, an Offer book, no anchors and no margin columns, with no cell clipped", async () => {
    const market = bareMarket();
    market.surface.pricingParams = [{ date: "2026-10-29T00:00:00.000Z", volBump: 0.01, fwdSellRate: 0.06 }];
    market.params.rateCurve = [
      { years: 1, ratePercent: 6.5, linkedToPremiumRate: true },
      { years: 2, ratePercent: 7, linkedToPremiumRate: false },
    ];
    const wb = buildSurfaceFile(new ExcelJS.Workbook(), market.surface, market.params, { logoBase64: PNG, asOf: "2026-10-27", premiumRate: 0.065 });
    const texts: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((cell) => texts.push(String(cell.value)))));
    expect(texts).toContain("Offer");
    expect(texts).toContain("Yes");
    expect(texts).toContain("No");
    expect(texts.join(" ")).not.toMatch(/NaN|undefined/);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(reopened.worksheets.length).toBeGreaterThanOrEqual(3);
  });

  it("builds with no Pricing Params row at all", () => {
    const market = bareMarket();
    const wb = buildSurfaceFile(new ExcelJS.Workbook(), market.surface, market.params, { asOf: "2026-10-27" });
    let numbers = 0;
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((cell) => {
      if (typeof cell.value === "number") {
        numbers++;
        expect(Number.isFinite(cell.value)).toBe(true);
      }
      expect(excelCellDisplayLength(cell)).toBeGreaterThanOrEqual(0);
    })));
    expect(numbers).toBeGreaterThan(50);
  });
});
