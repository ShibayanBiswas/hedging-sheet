import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { OUTPUT_TAB_IDS, readCells, schema } from "../support/tables";
import { chromiumOnly, dialogItems, fillBlank } from "./helpers";

const value = async (page: Page, testId: string) => Number(await page.getByTestId(testId).getAttribute("data-value"));

/** The Pricer headline premium, read from its raw value. */
const pricerPremium = async (page: Page) => Number(await page.locator('[data-testid="table-pricer-headline"] [data-cell$="::Premium In Crore"]').getAttribute("data-value"));

/** Every cell in a row or column called Option Type, on every output tab. */
async function optionTypeCells(page: Page, nav: { go: (id: (typeof OUTPUT_TAB_IDS)[number]) => Promise<void> }): Promise<string[]> {
  const texts: string[] = [];
  for (const tab of OUTPUT_TAB_IDS) {
    await nav.go(tab);
    for (const t of schema.tabs[tab]) {
      await expect(page.getByTestId(`table-${t.id}`)).toBeAttached();
      const cells = await readCells(page, t.id);
      for (const [key, c] of Object.entries(cells)) {
        const [row, col] = key.split("::");
        // Skip labels: the Option Type row label, and the Total marker of the options table's total row.
        if ((row === "Option Type" || col === "Option Type") && c.text !== "Option Type" && c.text !== "Total") texts.push(c.text);
      }
    }
  }
  return texts;
}

test.describe("B7 Spreads", () => {
  test.beforeEach(async ({ inputs }) => {
    await fillBlank(inputs);
  });

  test("B7.1 spread levels are derived from the strikes", async ({ page }) => {
    expect(await value(page, "input-spreads-0-buy")).toBeCloseTo(0.25, 12);
    expect(await value(page, "input-spreads-0-sell")).toBeCloseTo(0.27, 12);
    expect(await value(page, "input-spreads-1-buy")).toBeCloseTo(0.27, 12);
    expect(await value(page, "input-spreads-1-sell")).toBeCloseTo(0.37, 12);
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Derived");
  });

  test("B7.2 editing a spread moves its strike, and a typed participation shows Overridden", async ({ page, inputs }) => {
    await inputs.fill("spreads-1-sell", "40");
    expect(await value(page, "input-strikePercents-0")).toBeCloseTo(140, 9);
    expect(await value(page, "input-target")).toBeCloseTo(0.4, 12);
    await inputs.fill("participations-1", "8");
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Overridden");
  });

  test("B7.3 Reset To Derived puts the top participation back", async ({ page, inputs }) => {
    await inputs.fill("participations-1", "8");
    await inputs.dialog.dismissAll(3_000);
    await page.getByTestId("spread-1-reset").click();
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Derived");
    expect(await value(page, "input-participations-1")).toBeCloseTo((1.025 - 0.02) / 0.1, 9);
  });

  test("B7.4 a sell level not above its buy level is rejected", async ({ page, inputs }) => {
    await inputs.fill("spreads-0-sell", "25");
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("strictly descending");
    await inputs.dialog.close();
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
    await inputs.dialog.close();
    await expect(page.getByTestId("strip-simulation")).toHaveText("Not Run");
  });

  test("B7.5 spreads share their boundary strike, so they can neither overlap nor leave a gap", async ({ page, inputs }) => {
    await inputs.fill("spreads-1-buy", "28");
    expect(await value(page, "input-spreads-0-sell")).toBeCloseTo(0.28, 12);
    await inputs.fill("spreads-0-sell", "29");
    expect(await value(page, "input-spreads-1-buy")).toBeCloseTo(0.29, 12);
  });

  test("B7.6 a participation of zero or below is rejected", async ({ page, inputs }) => {
    for (const v of ["0", "-1"]) {
      await inputs.fill("participations-0", v);
      await expect(inputs.field("participations-0")).toHaveAttribute("aria-invalid", "true");
    }
    await inputs.runButton.click();
    expect((await dialogItems(page)).join("\n")).toContain("Spread 1 Participation Rate: Spread 1 Participation Rate must be above 0");
    await inputs.dialog.close();
  });
});

test.describe("B8 Option Type", () => {
  test("B8.1 and B8.2 every Option Type cell follows the choice, and a call book prices differently", async ({ page, inputs, nav }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(180_000);
    await fillBlank(inputs);
    await inputs.run();
    const puts = await optionTypeCells(page, nav);
    expect(puts.length).toBeGreaterThan(3);
    expect(new Set(puts)).toEqual(new Set(["Put"]));
    await nav.go("pricer");
    const putPremium = await pricerPremium(page);

    await nav.go("inputs");
    await inputs.fill("optionType", "C");
    await inputs.run();
    const calls = await optionTypeCells(page, nav);
    expect(calls.length).toBe(puts.length);
    expect(new Set(calls)).toEqual(new Set(["Call"]));
    await nav.go("pricer");
    expect(await pricerPremium(page)).not.toBeCloseTo(putPremium, 6);
  });
});

test.describe("B9 Coupon and solver", () => {
  test("B9.1 an unreachable coupon opens Coupon Not Reachable with a suggestion", async ({ inputs }) => {
    await fillBlank(inputs);
    await inputs.fill("participations-0", "60");
    await inputs.dialog.expectTitle("Coupon Not Reachable");
    await expect(inputs.dialog.root).toContainText("How To Fix");
    await expect(inputs.dialog.root).toContainText("Raise the Coupon");
    await inputs.dialog.close();
    await expect(inputs.field("coupon")).toHaveAttribute("aria-invalid", "true");
  });

  test("B9.2 a coupon at the reachable boundary converges with a residual below 1e-9", async ({ page, inputs, atlas }) => {
    await fillBlank(inputs);
    await inputs.fill("coupon", "2.01");
    await inputs.run();
    await atlas.open();
    await atlas.debugDrawer.click();
    const residual = await page.locator('[data-cell$="::Goal Seek Residual"]').textContent();
    expect(Number(residual)).toBeLessThan(1e-9);
  });
});

test.describe("B10 Protection and floor", () => {
  test.beforeEach(async ({ inputs }) => {
    await fillBlank(inputs);
  });

  test("B10.1 protection that puts the strike at or above 100% is rejected", async ({ inputs }) => {
    for (const v of ["0", "-5"]) {
      await inputs.fill("protection", v);
      await expect(inputs.field("protection")).toHaveAttribute("aria-invalid", "true");
      await inputs.dialog.dismissAll(3_000);
    }
  });

  test("B10.2 a floor at or above protection less the step is rejected", async ({ inputs }) => {
    await inputs.fill("floorLevel", "84");
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("Strike 6 at 84% is not below Strike 5");
    await inputs.dialog.close();
    await expect(inputs.field("strikePercents-5")).toHaveAttribute("aria-invalid", "true");
  });

  test("B10.3 floor units above the Decay are rejected", async ({ inputs }) => {
    await inputs.fill("floorUnits", "2");
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("exceed the Decay");
    await inputs.dialog.close();
    await expect(inputs.field("floorUnits")).toHaveAttribute("aria-invalid", "true");
  });

  test("B10.4 the Decay Floor Level is Strike 6, both ways", async ({ page, inputs }) => {
    await inputs.fill("floorLevel", "65");
    expect(await value(page, "input-strikePercents-5")).toBeCloseTo(65, 9);
    await inputs.fill("strikePercents-5", "72");
    expect(await value(page, "input-floorLevel")).toBeCloseTo(0.72, 12);
  });

  test("B10.5 a start level uplift of zero is accepted and a negative one is rejected", async ({ inputs }) => {
    await inputs.fill("startLevelUplift", "0");
    await expect(inputs.field("startLevelUplift")).not.toHaveAttribute("aria-invalid", "true");
    await inputs.fill("startLevelUplift", "-1");
    await expect(inputs.field("startLevelUplift")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("B11 Volatility", () => {
  test("B11.1 to B11.3 Compute From History fills both volatilities; editing either moves the other and shows Overridden", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await inputs.fill("underlying", "Sensex");
    await page.getByTestId("compute-volatility").click();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    const daily = await value(page, "input-dailyVol");
    expect(daily).toBeGreaterThan(0);
    expect(Math.abs((await value(page, "input-annualVol")) - daily * Math.sqrt(365))).toBeLessThan(1e-9);
    await inputs.fill("annualVol", "20");
    expect(Math.abs((await value(page, "input-dailyVol")) - 0.2 / Math.sqrt(365))).toBeLessThan(1e-12);
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Overridden");
    await inputs.fill("dailyVol", "1");
    expect(Math.abs((await value(page, "input-annualVol")) - 0.01 * Math.sqrt(365))).toBeLessThan(1e-12);
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Overridden");
  });

  test("B11.4 the Day 1 fair volatility and a leg volatility override flow into the outputs", async ({ page, inputs, outputs }) => {
    await fillBlank(inputs);
    await inputs.run();
    await outputs.pricer.open();
    const premiumBefore = await pricerPremium(page);

    await outputs.vegaHedge.open();
    await outputs.vegaHedge.hedgeVolOverride.fill("25");
    await outputs.vegaHedge.hedgeVolOverride.blur();
    await page.getByTestId("run-simulation-compact").click();
    await inputs.dialog.dismissAll(3_000);
    await expect(page.locator('[data-cell$="::Fair Volatility"]').first()).toHaveAttribute("data-value", "0.25");

    await outputs.pricer.open();
    await outputs.pricer.gridCell(0).fill("30");
    await outputs.pricer.gridCell(0).blur();
    await page.getByTestId("run-simulation-compact").click();
    await inputs.dialog.dismissAll(3_000);
    await expect(page.locator('[data-testid="table-pricer-legs"] [data-cell^="Volatility::"][data-value]').first()).toHaveAttribute("data-value", "0.3");
    expect(await pricerPremium(page)).not.toBeCloseTo(premiumBefore, 6);
  });
});

test.describe("B12 Fetch buttons", () => {
  test("B12.1 Fetch Live Spot fills the spot and nothing else", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await inputs.fill("underlying", "Sensex");
    await page.getByTestId("fetch-live-spot").click();
    await expect(inputs.field("spot")).toHaveValue("76835.78");
    for (const id of ["valuationDate", "coupon", "nbfcRate", "dailyVol", "notionalCr", "tenorDays"]) await expect(inputs.field(id)).toHaveValue("");
  });

  test("B12.2 a failed fetch opens an error popup and the spot stays empty", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await inputs.fill("underlying", "Sensex");
    await page.route("**/api/market/levels", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Yahoo is down" }) }));
    await page.getByTestId("fetch-live-spot").click();
    await inputs.dialog.expectTitle("Fetch Failed");
    await inputs.dialog.close();
    await expect(inputs.field("spot")).toHaveValue("");
  });
});
