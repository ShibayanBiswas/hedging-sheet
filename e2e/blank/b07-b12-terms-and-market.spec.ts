import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { OUTPUT_TAB_IDS, readCells, schema } from "../support/tables";
import { chromiumOnly, expectFlagged, fillBlank } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

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
        // Skip labels: the Option Type row label, and the markers of the options table's futures adjustment and total rows.
        // The Product Description's Option Type item describes the whole book; it is checked on its own below.
        const marker = ["Option Type", "Total", "Futures Adjustment For Call Strikes"].includes(c.text);
        const bookSummary = row === "Option Type" && col === "Value";
        if ((row === "Option Type" || col === "Option Type") && !marker && !bookSummary) texts.push(c.text);
      }
    }
  }
  return texts;
}

test.describe("B7 Spreads", () => {
  test.beforeEach(async ({ inputs }) => {
    await fillBlank(inputs);
  });

  test("B7.1 spread levels are read from the strikes and shown read-only", async ({ page }) => {
    await expect(page.getByTestId("input-spreads-0-buy")).toHaveText("25.00%");
    await expect(page.getByTestId("input-spreads-0-sell")).toHaveText("27.00%");
    await expect(page.getByTestId("input-spreads-1-buy")).toHaveText("27.00%");
    await expect(page.getByTestId("input-spreads-1-sell")).toHaveText("37.00%");
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Calculated");
  });

  test("B7.2 editing a strike moves its spread, and a typed participation shows Edited", async ({ page, inputs }) => {
    await inputs.fill("strikePercents-0", "140");
    await expect(page.getByTestId("input-spreads-1-sell")).toHaveText("40.00%");
    expect(await value(page, "input-target")).toBeCloseTo(0.4, 12);
    await inputs.fill("participations-1", "8");
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Edited");
  });

  test("B7.3 Reset To Calculated puts the top participation back", async ({ page, inputs }) => {
    await inputs.fill("participations-1", "8");
    await inputs.dialog.dismissAll(3_000);
    await page.getByTestId("spread-1-reset").click();
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Calculated");
    expect(await value(page, "input-participations-1")).toBeCloseTo((1.025 - 0.02) / 0.1, 9);
  });

  test("B7.4 a sell level not above its buy level is rejected", async ({ page, inputs }) => {
    // Spread 1 sells at Strike 2 and buys at Strike 3: equal strikes leave it no width.
    await inputs.fill("strikePercents-1", "125");
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("strictly descending");
    await inputs.dialog.close();
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
    await inputs.dialog.close();
    await expect(page.getByTestId("strip-simulation")).toHaveText("Not Run");
  });

  test("B7.5 spreads share their boundary strike, so they can neither overlap nor leave a gap", async ({ page, inputs }) => {
    await inputs.fill("strikePercents-1", "128");
    await expect(page.getByTestId("input-spreads-0-sell")).toHaveText("28.00%");
    await expect(page.getByTestId("input-spreads-1-buy")).toHaveText("28.00%");
  });

  test("B7.6 a participation of zero or below reverts with a popup", async ({ page }) => {
    for (const v of ["0", "-1"]) await expectFlagged(page, "input-participations-0", v);
    expect(await value(page, "input-participations-0")).toBe(1);
  });
});

test.describe("B8 Option Type", () => {
  test("B8.1 and B8.2 each strike takes its own Option Type, the hedge stays a put, and calls replicate the put book's premium", async ({ page, inputs, nav }, testInfo) => {
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
    for (const i of [0, 1, 2]) await inputs.fill(`strikeOptionTypes-${i}`, "C");
    await inputs.run();
    const calls = await optionTypeCells(page, nav);
    expect(calls.length).toBe(puts.length);
    expect(new Set(calls)).toEqual(new Set(["Call", "Put"]));
    await nav.go("pricer");
    expect(await pricerPremium(page)).toBeCloseTo(putPremium, 6);
    await nav.go("product");
    await expect(page.locator('[data-cell="Option Type::Value"]').first()).toHaveText("Call At Strikes 1, 2 And 3, Put Elsewhere");
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
    // Just above the 2% the lower spread pays, the top participation is 0.001, so Strike 2 must now be sold.
    await expect(page.getByTestId("strike-error-1")).toHaveText("This Strike Must Be A Sell To Give The Product Payoff");
    await expect(inputs.runButton).toBeDisabled();
    await inputs.fill("input-strikeSides-1", "S");
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

  test("B10.1 protection that puts the strike above 100% is rejected; 0% is a product with no protection", async ({ inputs }) => {
    await inputs.fill("protection", "-5");
    await expect(inputs.field("protection")).toHaveAttribute("aria-invalid", "true");
    await inputs.dialog.dismissAll(3_000);
    await inputs.fill("protection", "0");
    await expect(inputs.field("protection")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("B10.2 a floor at or above protection less the step is rejected", async ({ inputs }) => {
    await inputs.fill("floorLevel", "84");
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("Strike 6 at 84% is not below Strike 5");
    await inputs.dialog.close();
    await expect(inputs.field("strikePercents-5")).toHaveAttribute("aria-invalid", "true");
  });

  test("B10.3 a Decay Reduction Below Floor above the Decay is rejected", async ({ inputs }) => {
    await inputs.fill("floorUnits", "2");
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("A Decay Reduction Below Floor of 2 exceeds the Decay of 1.6");
    await inputs.dialog.close();
    await expect(inputs.field("floorUnits")).toHaveAttribute("aria-invalid", "true");
  });

  test("B10.4 the Decay Floor Level is Strike 6, both ways", async ({ page, inputs }) => {
    await inputs.fill("floorLevel", "65");
    expect(await value(page, "input-strikePercents-5")).toBeCloseTo(65, 9);
    await inputs.fill("strikePercents-5", "72");
    expect(await value(page, "input-floorLevel")).toBeCloseTo(0.72, 12);
  });

  test("B10.5 a start level uplift of zero is accepted and a negative one reverts", async ({ page, inputs }) => {
    await inputs.fill("startLevelUplift", "0");
    await expect(inputs.field("startLevelUplift")).not.toHaveAttribute("aria-invalid", "true");
    await expectFlagged(page, "input-startLevelUplift", "-1");
    expect(await value(page, "input-startLevelUplift")).toBe(0);
  });
});

test.describe("B11 Volatility", () => {
  test("B11.1 to B11.3 Compute From History fills both volatilities; editing either moves the other and tags both Edited", async ({ page, inputs }) => {
    // Volatility is step 6, open once the strikes are in.
    await fillBlank(inputs);
    await page.getByTestId("compute-volatility").click();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    await expect(page.getByTestId("annual-vol-status")).toHaveText("Calculated");
    const daily = await value(page, "input-dailyVol");
    expect(daily).toBeGreaterThan(0);
    expect(Math.abs((await value(page, "input-annualVol")) - daily * Math.sqrt(365))).toBeLessThan(1e-9);
    await inputs.fill("annualVol", "20");
    expect(Math.abs((await value(page, "input-dailyVol")) - 0.2 / Math.sqrt(365))).toBeLessThan(1e-12);
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Edited");
    await expect(page.getByTestId("annual-vol-status")).toHaveText("Edited");
    await inputs.fill("dailyVol", "1");
    expect(Math.abs((await value(page, "input-annualVol")) - 0.01 * Math.sqrt(365))).toBeLessThan(1e-12);
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Edited");
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
