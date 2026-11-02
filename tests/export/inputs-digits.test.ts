import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { tabSpecs } from "@/lib/exports/tab-specs";
import type { DeskInputs } from "@/lib/inputs/draft";
import { cellKey, displayCell, type AnySpec } from "@/lib/tables";

import { fixtureInputs, priced } from "../helpers/fixture";

const market = seedMarketData();

/** The Inputs tab of the default book as commit 7c799d4 printed it. */
const DEFAULT_BOOK: Record<string, string> = {
  "Underlying::Value": "Sensex",
  "Valuation Date::Value": "27-Oct-2026",
  "Sensex Spot::Value": "82,000.00",
  "Start Level::Value": "82,500",
  "Hedge Strike::Value": "82,500",
  "Hedge Strike Source::Value": "Auto From Spot",
  "Expiry 1 · Observation::Expiry": "Expiry 1 · Observation",
  "Expiry 1 · Observation::Date": "28-Mar-2030",
  "Expiry 2 · Observation::Expiry": "Expiry 2 · Observation",
  "Expiry 2 · Observation::Date": "27-Jun-2030",
  "Expiry 3 · Observation And Hedge Option Expiry::Expiry": "Expiry 3 · Observation And Hedge Option Expiry",
  "Expiry 3 · Observation And Hedge Option Expiry::Date": "26-Sep-2030",
  "Expiry 4 · Observation::Expiry": "Expiry 4 · Observation",
  "Expiry 4 · Observation::Date": "26-Dec-2030",
  "Expiry 5 · Observation::Expiry": "Expiry 5 · Observation",
  "Expiry 5 · Observation::Date": "24-Apr-2031",
  "Expiry 6 · Observation::Expiry": "Expiry 6 · Observation",
  "Expiry 6 · Observation::Date": "31-Jul-2031",
  "Strike 1::Strike": "Strike 1",
  "Strike 1::Level %": "137.00",
  "Strike 1::Level In Points": "113,025",
  "Strike 1::Option Type": "Put",
  "Strike 1::Buy Or Sell": "Sell",
  "Strike 1::Units": "-10.050",
  "Strike 2::Strike": "Strike 2",
  "Strike 2::Level %": "127.00",
  "Strike 2::Level In Points": "104,775",
  "Strike 2::Option Type": "Put",
  "Strike 2::Buy Or Sell": "Buy",
  "Strike 2::Units": "9.050",
  "Strike 3::Strike": "Strike 3",
  "Strike 3::Level %": "125.00",
  "Strike 3::Level In Points": "103,125",
  "Strike 3::Option Type": "Put",
  "Strike 3::Buy Or Sell": "Buy",
  "Strike 3::Units": "1.000",
  "Strike 4::Strike": "Strike 4",
  "Strike 4::Level %": "85.00",
  "Strike 4::Level In Points": "70,125",
  "Strike 4::Option Type": "Put",
  "Strike 4::Buy Or Sell": "Sell",
  "Strike 4::Units": "-25.600",
  "Strike 5::Strike": "Strike 5",
  "Strike 5::Level %": "84.00",
  "Strike 5::Level In Points": "69,300",
  "Strike 5::Option Type": "Put",
  "Strike 5::Buy Or Sell": "Buy",
  "Strike 5::Units": "24.000",
  "Strike 6::Strike": "Strike 6",
  "Strike 6::Level %": "70.00",
  "Strike 6::Level In Points": "57,750",
  "Strike 6::Option Type": "Put",
  "Strike 6::Buy Or Sell": "Buy",
  "Strike 6::Units": "1.000",
  "Spread 1::Spread": "Spread 1",
  "Spread 1::Buy Level": "25.00%",
  "Spread 1::Sell Level": "27.00%",
  "Spread 1::Participation Rate": "1.00",
  "Spread 2::Spread": "Spread 2",
  "Spread 2::Buy Level": "27.00%",
  "Spread 2::Sell Level": "37.00%",
  "Spread 2::Participation Rate": "10.05",
  "NBFC Rate::Value": "8.00%",
  "Premium Growth Rate::Value": "6.50%",
  "Margin Growth Rate::Value": "6.579%",
  "Target Sensex Rise::Value": "37.00%",
  "Coupon::Value": "102.50%",
  "Protection::Value": "15.00%",
  "Decay::Value": "1.60",
  "Decay Floor Level::Value": "70%",
  "Decay Reduction Below Floor::Value": "1.00",
  "Tenor In Days::Value": "1,940",
  "Start Level Uplift::Value": "0.60%",
  "Notional In Crore::Value": "100.00",
  "Sensex Daily Volatility::Value": "0.900%",
  "Sensex Annual Volatility::Value": "17.194%",
  "Volatility Source::Value": "Calculated",
  "History Window In Days::Value": "365",
  "Transaction Cost::Value": "2.25%",
  "Issuance Cost::Value": "0.13%",
  "Margin Cost::Value": "0.00%",
  "Exposure Margin::Value": "5.00%",
  "Futures Margin::Value": "20.00%",
  "Exchange Forward Rate::Value": "3.48%",
  "Exchange Discount Rate::Value": "3.48%",
  "Stressed Forward Rate::Value": "3.48%",
  "Stressed Discount Rate::Value": "3.48%",
  "Shock Sigmas::Value": "6.00",
  "Shock Days::Value": "2",
  "Volatility Multiplier::Value": "1.25",
};

/** Every cell of the Inputs tab as it prints, by row and column label. */
function printed(specs: AnySpec[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of specs) {
    if ("items" in spec) for (const item of spec.items) out[cellKey(item.label, "Value")] = displayCell(item.value, item.kind, item.digits).text;
    else if ("columns" in spec)
      for (const row of spec.rows) for (const c of spec.columns) out[cellKey(String(row[spec.columns[0]!.key]), c.label)] = displayCell(row[c.key] ?? null, c.kind, c.digits).text;
  }
  return out;
}

const inputsTab = (inputs: Partial<DeskInputs>) => printed(tabSpecs("inputs", { result: null, inputs: fixtureInputs(inputs as never) as DeskInputs, market }));

describe("Inputs tab export prints what the field holds", () => {
  it("does not round a typed Decay Floor Level of 72.5% to 73%", () => {
    expect(inputsTab({ strikePercents: [137, 127, 125, 85, 84, 72.5] })[cellKey("Decay Floor Level", "Value")]).toBe("72.5%");
  });

  it("prints typed percents and numbers to their third decimal, in all of the groups", () => {
    const out = inputsTab({
      spot: 76835.125,
      nbfcRate: 0.06125,
      premiumRate: 0.06525,
      coupon: 1.02125,
      decay: 1.625,
      floorUnits: 0.875,
      startLevelUplift: 0.00625,
      notionalCr: 100.125,
      transactionCost: 0.02255,
      issuanceCost: 0.00135,
      exposureMargin: 0.05125,
      futuresMargin: 0.20125,
      exchangeForwardRate: 0.03485,
      stressSigmas: 6.125,
      stressVolMultiplier: 1.125,
    });
    expect(out).toMatchObject({
      [cellKey("Sensex Spot", "Value")]: "76,835.125",
      [cellKey("NBFC Rate", "Value")]: "6.125%",
      [cellKey("Premium Growth Rate", "Value")]: "6.525%",
      [cellKey("Coupon", "Value")]: "102.125%",
      [cellKey("Decay", "Value")]: "1.625",
      [cellKey("Decay Reduction Below Floor", "Value")]: "0.875",
      [cellKey("Start Level Uplift", "Value")]: "0.625%",
      [cellKey("Notional In Crore", "Value")]: "100.125",
      [cellKey("Transaction Cost", "Value")]: "2.255%",
      [cellKey("Issuance Cost", "Value")]: "0.135%",
      [cellKey("Exposure Margin", "Value")]: "5.125%",
      [cellKey("Futures Margin", "Value")]: "20.125%",
      [cellKey("Exchange Forward Rate", "Value")]: "3.485%",
      [cellKey("Shock Sigmas", "Value")]: "6.125",
      [cellKey("Volatility Multiplier", "Value")]: "1.125",
    });
  });

  it("widens the strike and spread columns for a typed strike or participation, and terms derived from them", () => {
    const out = inputsTab({ strikePercents: [137.125, 127, 125, 85, 84.5, 70], participations: [1.125, null] });
    expect(out[cellKey("Strike 1", "Level %")]).toBe("137.125");
    expect(out[cellKey("Strike 2", "Level %")]).toBe("127.000");
    expect(out[cellKey("Spread 1", "Sell Level")]).toBe("27.000%");
    expect(out[cellKey("Spread 2", "Sell Level")]).toBe("37.125%");
    expect(out[cellKey("Spread 1", "Participation Rate")]).toBe("1.125");
    expect(out[cellKey(`Target Sensex Rise`, "Value")]).toBe("37.125%");
    expect(out[cellKey("Protection", "Value")]).toBe("15.00%");
    expect(inputsTab({ strikePercents: [137, 127, 125, 84.5, 83, 70] })[cellKey("Protection", "Value")]).toBe("15.50%");
  });

  it("stops at 3 decimals for a value with more", () => {
    expect(inputsTab({ nbfcRate: 0.0612345 })[cellKey("NBFC Rate", "Value")]).toBe("6.123%");
  });

  it("keeps a calculated top spread participation to its usual 2 decimals, as the page shows it", () => {
    const value = inputsTab({})[cellKey("Spread 2", "Participation Rate")]!;
    expect(value).toMatch(/^\d+\.\d{2}$/);
  });

  it("writes the same decimals to Excel, with the value in full", () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, priced({ strikePercents: [137, 127, 125, 85, 84, 72.5] }), null);
    let cell: ExcelJS.Cell | undefined;
    wb.getWorksheet("Inputs")!.eachRow((row) => {
      if (row.getCell(1).value === "Decay Floor Level") cell = row.getCell(2);
    });
    expect(cell!.value).toBeCloseTo(0.725, 12);
    expect(cell!.numFmt).toBe("0.0%");
  });

  it("the default book prints as it always has", () => {
    expect(inputsTab({})).toEqual(DEFAULT_BOOK);
  });
});
