import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { DEFAULT_FWD_SELL_RATE } from "@/lib/engine/vol-surface";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";

type Cell = string | number | Date | null;

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

function book(sheets: Record<string, Cell[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const SURFACE: Cell[][] = [
  ["Expiry", "Deep", 55, 100, 120],
  [day("2026-11-26"), 30, 30, 20, 15],
  [day("2027-02-25"), 28, 28, 19, 14],
];

describe("surface sheet layouts", () => {
  it("reads strike headers as percents and fills one Pricing Params row for the month when there is no parameters sheet", () => {
    const { surface, params } = parseVolSurfaceFile(book({ Surface: SURFACE }), "2026-10");
    expect(surface.moneyness).toEqual([0.55, 1, 1.2]);
    expect(surface.expiries).toEqual(["2026-11-26T00:00:00.000Z", "2027-02-25T00:00:00.000Z"]);
    expect(surface.pricingParams).toEqual([{ date: "2026-10-31T00:00:00.000Z", volBump: 0, fwdSellRate: DEFAULT_FWD_SELL_RATE }]);
    expect(params).toEqual({});
  });

  it("reads strike headers as decimals under a Strike Change % label, and expiries as Excel serials or text", () => {
    const rows: Cell[][] = [
      ["Volatility Surface"],
      ["Strike Change %", "Deep", 0.55, 1, 1.2],
      [46352, 30, 30, 20, 15],
      ["2027-02-25", 28, 28, 19, 14],
      ["26-May-2027", 27, 27, 18, 13],
      [null, null, null, null, null],
      ["Date", "Notes"],
    ];
    const { surface } = parseVolSurfaceFile(book({ "Vol Surface": rows }), "2026-10");
    expect(surface.moneyness).toEqual([0.55, 1, 1.2]);
    expect(surface.expiries).toEqual(["2026-11-26T00:00:00.000Z", "2027-02-25T00:00:00.000Z", "2027-05-26T00:00:00.000Z"]);
  });

  it("skips a second header row and numeric rows above the first expiry", () => {
    const rows: Cell[][] = [
      ["Expiry", "Deep", 55, 100, 120],
      ["Expiry Date", "Strike", null, null, null],
      [null, 500, 44000, 80000, 96000],
      [day("2026-11-26"), 30, 30, 20, 15],
    ];
    const { surface } = parseVolSurfaceFile(book({ Surface: rows }), "2026-10");
    expect(surface.expiries).toEqual(["2026-11-26T00:00:00.000Z"]);
    expect(surface.volsPercent[0]).toEqual([30, 30, 20, 15]);
  });

  it("prefers a Market Data or surface tab over a parameters or summary tab", () => {
    const { surface } = parseVolSurfaceFile(book({ Summary: [["Pricer"]], "Market Data": SURFACE }), "2026-10");
    expect(surface.expiries).toHaveLength(2);
  });

  it("refuses a sheet with no header row, no strike columns or no expiries", () => {
    expect(() => parseVolSurfaceFile(book({ Surface: [["Hello"], ["World"]] }))).toThrow("The Strike Change header row was not found on the Volatility Surface Sheet.");
    expect(() => parseVolSurfaceFile(book({ Surface: [["Strike", "Deep", "x", "y"], [day("2026-11-26"), 1, 2, 3]] }))).toThrow("No Strike Change % columns were found.");
    expect(() => parseVolSurfaceFile(book({ Surface: [SURFACE[0]!, ["Total", 1, 2, 3, 4]] }))).toThrow("No expiry rows were found on the Volatility Surface Sheet.");
  });
});

describe("surface parameters", () => {
  it("reads key and value rows", () => {
    const params: Cell[][] = [
      ["Volatility Bump", 0.5],
      ["Forward Sell Rate", 5.75],
      ["Reference Sensex Price", 80000],
      ["Reference Nifty Price", 24000],
      ["Rate Cap Buying Forward", 0.07],
      ["Dividend Bid Offer Multiplier", 0.9],
      ["Bid Or Offer", "Offer"],
    ];
    const { surface, params: p } = parseVolSurfaceFile(book({ Surface: SURFACE, Parameters: params }), "2026-10");
    expect(surface.referenceSensexPrice).toBe(80000);
    expect(surface.referenceUnderlyingPrice).toBe(24000);
    expect(surface.pricingParams).toEqual([{ date: "2026-10-31T00:00:00.000Z", volBump: 0.5, fwdSellRate: 0.0575 }]);
    expect(p).toEqual({ forwardSellRate: 0.0575, rateCapBuyingForward: 0.07, dividendBidOfferMultiplier: 0.9, bidOffer: "O" });
  });

  it("reads a dated table with Vol Bump, Fwd Sell Rate and the margin columns, stopping at the first gap", () => {
    const params: Cell[][] = [
      ["Pricing Params"],
      [null, "Date", "Vol Bump", "Fwd Sell Rate", "Inc. Margin", "Full Margin", "Margin Cost"],
      [null, day("2026-10-29"), 0.01, 5.5, 6, 12, 3],
      [null, day("2026-11-26"), "x", "y", 6, 12, 3],
      [null, null, null, null, null, null, null],
      [null, day("2027-01-28"), 0.03, 6, 6, 12, 3],
    ];
    const { surface } = parseVolSurfaceFile(book({ Surface: SURFACE, Parameters: params }), "2026-10");
    expect(surface.pricingParams).toEqual([
      { date: "2026-10-29T00:00:00.000Z", volBump: 0.01, fwdSellRate: 0.055, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03 },
      { date: "2026-11-26T00:00:00.000Z", volBump: 0, fwdSellRate: DEFAULT_FWD_SELL_RATE, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03 },
    ]);
  });

  it("reads a Date and Vol Bump table with no rate column, taking the forward sell rate from its key row", () => {
    const params: Cell[][] = [
      ["Forward Sell Rate", 0.06],
      ["Month", "Volatility Bump"],
      [day("2026-10-29"), 0.02],
    ];
    const { surface } = parseVolSurfaceFile(book({ Surface: SURFACE, Parameters: params }), "2026-10");
    expect(surface.pricingParams).toEqual([{ date: "2026-10-29T00:00:00.000Z", volBump: 0.02, fwdSellRate: 0.06 }]);
  });

  it("ignores a reference price below 10 and a bad multiplier", () => {
    const params: Cell[][] = [
      ["Reference Sensex Price", 5],
      ["Dividend Bid Offer Factor", "none"],
      ["Bid Or Offer", null],
    ];
    const { surface, params: p } = parseVolSurfaceFile(book({ Surface: SURFACE, Parameters: params }), "2026-10");
    expect(surface.referenceSensexPrice).toBeUndefined();
    expect(p).toEqual({ dividendBidOfferMultiplier: 1, bidOffer: "B" });
  });
});

describe("rate curve and implied dividends", () => {
  it("reads the curve in percent or as a fraction with its Linked flag, and the dividends by date", () => {
    const curve: Cell[][] = [
      ["Rate Curve"],
      ["Tenor In Years", "Rate In Percent", "Linked To Premium Rate"],
      [0.5, 6.5, "Yes"],
      [1, 0.068, "No"],
      [2, 7, null],
      ["Total", "-", null],
    ];
    const dividends: Cell[][] = [
      ["Date", "Implied Dividend"],
      ["Note", "x"],
      [day("2026-12-18"), 120.5],
      [day("2027-03-19"), 98],
      ["End", null],
    ];
    const { params } = parseVolSurfaceFile(book({ Surface: SURFACE, Curve: curve, Dividends: dividends }), "2026-10");
    expect(params.rateCurve).toEqual([
      { years: 0.5, ratePercent: 6.5, linkedToPremiumRate: true },
      { years: 1, ratePercent: expect.closeTo(6.8, 9), linkedToPremiumRate: false },
      { years: 2, ratePercent: 7, linkedToPremiumRate: false },
    ]);
    expect(params.dividends).toEqual([
      { date: "2026-12-18T00:00:00.000Z", amount: 120.5 },
      { date: "2027-03-19T00:00:00.000Z", amount: 98 },
    ]);
  });

  it("reads a curve with no Linked column as not linked", () => {
    const curve: Cell[][] = [["Tenor", "Rate %"], [1, 6.5]];
    const { params } = parseVolSurfaceFile(book({ Surface: SURFACE, Curve: curve }), "2026-10");
    expect(params.rateCurve).toEqual([{ years: 1, ratePercent: 6.5, linkedToPremiumRate: false }]);
  });
});
