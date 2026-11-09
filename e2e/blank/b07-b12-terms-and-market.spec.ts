import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { hook } from "../pipeline/helpers";
import { OUTPUT_TAB_IDS, readCells, schema } from "../support/tables";
import { chromiumOnly, expectCorrected, fillBlank } from "./helpers";

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

  test("B7.2 editing a strike moves its spread, and a typed top participation that misses the Coupon goes back to Calculated", async ({ page, inputs }) => {
    await inputs.fill("strikePercents-0", "140");
    await expect(page.getByTestId("input-spreads-1-sell")).toHaveText("40.00%");
    expect(await value(page, "input-target")).toBeCloseTo(0.4, 12);
    await expectCorrected(page, "input-participations-1", "8", { value: (1.025 - 0.02) / 0.13, note: "Back To Calculated, 7.73" });
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Calculated");
  });

  test("B7.3 the rate that reaches the Coupon exactly pins the top spread, Edited, and Reset To Calculated puts it back", async ({ page, inputs }) => {
    // The field already shows 10.05, so the same text would be no edit at all: 10.050 is the same rate, typed.
    await inputs.fill("participations-1", "10.050");
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Edited");
    await page.getByTestId("spread-1-reset").click();
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Calculated");
    expect(await value(page, "input-participations-1")).toBeCloseTo((1.025 - 0.02) / 0.1, 9);
  });

  test("B7.4 a sell level at its buy level is raised one point above it, and the run goes ahead", async ({ page, inputs, outputs }) => {
    // Spread 1 sells at Strike 2 and buys at Strike 3: equal strikes would leave it no width.
    await expectCorrected(page, "input-strikePercents-1", "125", { value: 126, note: "Raised Above Strike 3, 126.000%" });
    await expect(page.getByTestId("input-spreads-0-sell")).toHaveText("26.00%");
    await inputs.run();
    await outputs.summary.expectResults();
  });

  test("B7.5 spreads share their boundary strike, so they can neither overlap nor leave a gap", async ({ page, inputs }) => {
    await inputs.fill("strikePercents-1", "128");
    await expect(page.getByTestId("input-spreads-0-sell")).toHaveText("28.00%");
    await expect(page.getByTestId("input-spreads-1-buy")).toHaveText("28.00%");
  });

  test("B7.6 a participation of zero takes the default and a negative one is made positive", async ({ page }) => {
    await expectCorrected(page, "input-participations-0", "0", { value: 1, note: "Set To The Default, 1.00" });
    await expectCorrected(page, "input-participations-0", "-1.5", { value: 1.5, note: "Made Positive, 1.50" });
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
  test("B9.1 a participation that leaves the top spread nothing is lowered to the most that leaves it a share", async ({ page, inputs }) => {
    await fillBlank(inputs);
    // Spread 1 is 2 points wide: at 51.25 it alone would pay the 102.5% Coupon.
    await expectCorrected(page, "input-participations-0", "60", { value: 51.24, note: "Lowered To Leave Room For The Top Spread, 51.24" });
    await expect(inputs.field("coupon")).not.toHaveAttribute("aria-invalid", "true");
    expect(await value(page, "input-participations-1")).toBeGreaterThan(0);
  });

  test("B9.2 a coupon at the reachable boundary converges with a residual below 1e-9; Run sets the side the payoff then needs", async ({ page, inputs }) => {
    await fillBlank(inputs);
    await inputs.fill("coupon", "2.01");
    // Just above the 2% the lower spread pays, the top participation is 0.001, so Strike 2 must now be sold. The Buy typed
    // in Strike And Spreads is not this commit's to change: it shows under the strike, and Run corrects it with a note.
    await expect(page.getByTestId("strike-error-1")).toHaveText("This Strike Must Be A Sell To Give The Product Payoff");
    await expect(inputs.runButton).toBeEnabled();
    await inputs.run();
    const r = (await hook(page)).result!;
    expect(Math.abs(r.diagnostics.goalSeekResidual)).toBeLessThan(1e-9);
    expect((await hook(page)).inputs.strikeSides[1]).toBe("S");
  });

  test("B9.3 a coupon below what the lower spreads pay is raised just above it", async ({ page, inputs }) => {
    await fillBlank(inputs);
    await expectCorrected(page, "input-coupon", "1", { value: 0.02001, note: "Raised Above What The Lower Spreads Pay, 2.001%" });
  });
});

test.describe("B10 Protection and floor", () => {
  test.beforeEach(async ({ inputs }) => {
    await fillBlank(inputs);
  });

  test("B10.1 protection below 0% is raised to 0%, a product with no protection; one past the floor keeps the strikes in order", async ({ page, inputs }) => {
    await expectCorrected(page, "input-protection", "-5", { value: 0, note: "Raised To The Minimum, 0.000%" });
    await inputs.fill("protection", "0");
    await expect(inputs.field("protection")).not.toHaveAttribute("aria-invalid", "true");
    // The outflow strike sits one point below protection and must stay above the 70% floor: 72% and 71% is as low as it goes.
    await expectCorrected(page, "input-protection", "30", { value: 0.28, note: "Lowered To Keep The Strikes In Order, 28.000%" });
    expect(await value(page, "input-strikePercents-3")).toBeCloseTo(72, 9);
    expect(await value(page, "input-strikePercents-4")).toBeCloseTo(71, 9);
  });

  test("B10.2 a floor at or above the outflow strike is lowered one point below it", async ({ page }) => {
    await expectCorrected(page, "input-floorLevel", "84", { value: 0.83, note: "Lowered Below Strike 5, 83.000%" });
    expect(await value(page, "input-strikePercents-5")).toBeCloseTo(83, 9);
  });

  test("B10.3 a Decay Reduction Below Floor above the Decay is lowered to the Decay, and a Decay below it raised to it", async ({ page }) => {
    await expectCorrected(page, "input-floorUnits", "2", { value: 1.6, note: "Lowered To The Decay, 1.60" });
    await expectCorrected(page, "input-decay", "1.2", { value: 1.6, note: "Raised To The Decay Reduction Below Floor, 1.60" });
  });

  test("B10.4 the Decay Floor Level is Strike 6, both ways", async ({ page, inputs }) => {
    await inputs.fill("floorLevel", "65");
    expect(await value(page, "input-strikePercents-5")).toBeCloseTo(65, 9);
    await inputs.fill("strikePercents-5", "72");
    expect(await value(page, "input-floorLevel")).toBeCloseTo(0.72, 12);
  });

  test("B10.5 a start level uplift of zero is accepted and a negative one is raised to 0%", async ({ page, inputs }) => {
    await inputs.fill("startLevelUplift", "0");
    await expect(inputs.field("startLevelUplift")).not.toHaveAttribute("aria-invalid", "true");
    await expectCorrected(page, "input-startLevelUplift", "-1", { value: 0, note: "Raised To The Minimum, 0.000%" });
  });
});

test.describe("B11 Volatility", () => {
  test("B11.1 to B11.3 Compute From History fills both volatilities; editing either moves the other and tags the card Edited", async ({ page, inputs }) => {
    // Volatility is step 6, open once the strikes are in.
    await fillBlank(inputs);
    await page.getByTestId("compute-volatility").click();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    const daily = await value(page, "input-dailyVol");
    expect(daily).toBeGreaterThan(0);
    expect(Math.abs((await value(page, "input-annualVol")) - daily * Math.sqrt(365))).toBeLessThan(1e-9);
    await inputs.fill("annualVol", "20");
    expect(Math.abs((await value(page, "input-dailyVol")) - 0.2 / Math.sqrt(365))).toBeLessThan(1e-12);
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Edited");
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
    await expect(inputs.field("spot")).toHaveValue("76,835.78");
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
