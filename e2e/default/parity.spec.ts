import regression from "../../tests/fixtures/regression-expected.json";
import { chromiumOnly } from "../blank/helpers";
import { expect, test } from "../fixtures";
import { expectExcelMatches } from "../support/excel";
import { restoreMarketFixtures } from "../support/market";
import { close, OUTPUT_TAB_IDS, readAllOutputs, readCells, schema, tabProblems } from "../support/tables";

const expected = regression.mock.default;
const tabOf = (tableId: string) => OUTPUT_TAB_IDS.find((t) => schema.tabs[t].some((x) => x.id === tableId))!;

test.describe("Default Values parity", () => {
  test("D1 on load every field is filled, the spot is the mock close and the date is today in India", async ({ page, inputs }) => {
    await inputs.goto();
    await expect(page.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
    await expect(inputs.field("spot")).toHaveValue("76835.78");
    await expect(inputs.field("valuationDate")).toHaveValue("2026-10-28");
    const empty = await page.locator('main input[data-testid^="input-"]:not([type="checkbox"])').evaluateAll((els) =>
      els.filter((e) => !(e as HTMLInputElement).value && (e as HTMLInputElement).dataset.testid !== "input-participations-1").map((e) => (e as HTMLInputElement).dataset.testid),
    );
    expect(empty).toEqual([]);
  });

  test("D2 the headline numbers match the frozen regression for the mock spot", async ({ page, inputs, nav }) => {
    await inputs.goto();
    await inputs.run();
    const problems: string[] = [];
    for (const [table, cells] of Object.entries(expected.cells)) {
      await nav.go(tabOf(table));
      const ui = await readCells(page, table);
      for (const [key, v] of Object.entries(cells)) {
        const got = ui[key];
        if (!got) problems.push(`${table} ${key} is missing`);
        else if (typeof v === "number" ? got.value == null || !close(got.value, v) : got.text !== v) problems.push(`${table} ${key}: ${got.value ?? got.text} vs ${v}`);
      }
    }
    expect(problems).toEqual([]);
  });

  for (const tab of OUTPUT_TAB_IDS) {
    test(`D3 ${tab} passes the output table checks`, async ({ page, inputs }, testInfo) => {
      chromiumOnly(testInfo);
      await inputs.goto();
      await inputs.run();
      expect(await tabProblems(page, tab)).toEqual([]);
    });
  }

  test("D4 the Excel export passes the workbook checks", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    await inputs.goto();
    await inputs.run();
    await expectExcelMatches(page, await readAllOutputs(page));
  });

  test("D5 changing one input shows Inputs Changed and the gate returns", async ({ inputs, nav, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.summary.expectResults();
    await nav.go("inputs");
    await inputs.fill("coupon", "100");
    await inputs.dialog.dismissAll();
    for (const out of Object.values(outputs)) {
      await out.open();
      await out.expectGate();
      await expect(out.staleBanner).toContainText("Inputs Changed");
    }
  });

  test("D6 the footer shows both spots, Fetched At and the market status", async ({ inputs, footer }) => {
    await inputs.goto();
    await expect(footer.sensex).toContainText("76,835.78");
    await expect(footer.nifty).toContainText("23,500.00");
    await expect(footer.fetched).toContainText(/Fetched At/i);
    await expect(footer.marketStatus).toContainText("Market Open");
  });

  test.describe("D7 surface parameters", () => {
    test.afterEach(async ({ request }) => {
      await restoreMarketFixtures(request);
    });

    test("D7 the editor loads this month's defaults, and an edit changes the outputs after a run", async ({ page, inputs, marketData, nav }) => {
      await inputs.goto();
      await inputs.run();
      await nav.go("pricer");
      const before = Number(await page.locator('[data-testid="table-pricer-headline"] [data-cell$="::Premium In Crore"]').getAttribute("data-value"));

      await marketData.open();
      await expect(marketData.paramsTable).toContainText("Bid Or Offer");
      await marketData.editParams.click();
      const vol = marketData.param("param-vol-bump");
      await expect(vol).toHaveValue(/^0(\.0+)?$/);
      await vol.fill("2");
      await vol.blur();
      await marketData.saveParams.click();
      await inputs.dialog.dismissAll();
      await expect(page.getByTestId("strip-simulation")).toHaveText("Inputs Changed");

      await nav.go("inputs");
      await inputs.run();
      await nav.go("pricer");
      const after = Number(await page.locator('[data-testid="table-pricer-headline"] [data-cell$="::Premium In Crore"]').getAttribute("data-value"));
      expect(after).not.toBeCloseTo(before, 6);
    });
  });
});
