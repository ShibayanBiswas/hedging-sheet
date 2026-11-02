import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { tabSpecs } from "@/lib/exports/tab-specs";
import type { DeskInputs } from "@/lib/inputs/draft";
import { tabPdfProps } from "@/lib/pdf/tab-pdf-props";

import { fixtureInputs, priced } from "../helpers/fixture";

const market = seedMarketData();
const history = { observations: 245, from: "2025-10-27", to: "2026-10-26" };
const CALCULATED = "calculated from 245 daily returns from 27-Oct-2025 to 26-Oct-2026.";
const EDITED = "as edited on the Inputs tab.";

/** The Logic Atlas Volatility stage's description, wherever the export has it. */
const volatilityDescription = (specs: ReturnType<typeof tabSpecs>) => {
  const flows = specs.find((s) => s.id === "atlas-flows") as Extract<(typeof specs)[number], { columns: unknown }>;
  return String(flows.rows.find((row) => row.title === "Volatility")!.description);
};

describe("Logic Atlas export names the volatility source as the page does", () => {
  const calculated = fixtureInputs() as DeskInputs;

  it("the specs say calculated from the history for a calculated volatility", () => {
    expect(calculated.dailyVolSource).toBe("calculated");
    expect(volatilityDescription(tabSpecs("logic-atlas", { result: null, inputs: calculated, market, history }))).toContain(CALCULATED);
  });

  it("the specs still say edited for an edited volatility, with the history known", () => {
    const edited = { ...calculated, dailyVolSource: "overridden" } as DeskInputs;
    expect(volatilityDescription(tabSpecs("logic-atlas", { result: null, inputs: edited, market, history }))).toContain(EDITED);
  });

  it("the PDF props carry the same words", () => {
    const props = tabPdfProps("logic-atlas", { result: null, inputs: calculated, market, history, runAt: null, now: new Date("2026-10-28T04:30:00.000Z") });
    expect(JSON.stringify(props.blocks)).toContain(CALCULATED);
  });

  it("the Excel Logic Atlas sheet carries the same words", () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, priced(), null, { market, history, runAt: "28-Oct-2026 · 10:00:00 am IST" });
    const texts: string[] = [];
    wb.getWorksheet("Logic Atlas")!.eachRow((row) => row.eachCell((cell) => texts.push(String(cell.value))));
    expect(texts.join(" ")).toContain(CALCULATED);
    expect(texts.join(" ")).not.toContain(EDITED);
  });
});
