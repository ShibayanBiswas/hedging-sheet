import type { HedgingResult } from "../lib/engine/types";
import { expect, test } from "./fixtures";
import { hook } from "./pipeline/helpers";

/** The side each default strike must take: 137 Sell, 127 Buy, 125 Buy, 85 Sell, 84 Buy, 70 Buy. */
const SIDES = ["S", "B", "B", "S", "B", "B"] as const;
const flip = (s: "B" | "S") => (s === "B" ? "S" : "B");

test.describe("per strike Option Type and Buy Or Sell", () => {
  test("each strike on the wrong side shows the error under it and blocks Run, and the right side clears it", async ({ page, inputs }) => {
    test.setTimeout(180_000);
    await inputs.goto("default");
    for (let i = 0; i < SIDES.length; i++) {
      await expect(page.getByTestId(`input-strikeSides-${i}`)).toHaveAttribute("data-value", SIDES[i]);
      await inputs.fill(`input-strikeSides-${i}`, flip(SIDES[i]));
      await expect(page.getByTestId(`strike-error-${i}`)).toHaveText(`This Strike Must Be A ${SIDES[i] === "B" ? "Buy" : "Sell"} To Give The Product Payoff`);
      await expect(inputs.runButton).toBeDisabled();
      await expect(inputs.dialog.root).toHaveCount(0);
      await inputs.fill(`input-strikeSides-${i}`, SIDES[i]);
      await expect(page.getByTestId(`strike-error-${i}`)).toHaveCount(0);
      await expect(inputs.runButton).toBeEnabled();
    }
  });

  test("a mixed Call and Put book prices as the all Put book, and every leg shows its own type", async ({ page, inputs, nav }) => {
    test.setTimeout(180_000);
    await inputs.goto("default");
    await inputs.run();
    const puts = (await hook(page)).result as HedgingResult;

    await nav.go("inputs");
    for (const i of [0, 2, 4]) await inputs.fill(`input-strikeOptionTypes-${i}`, "C");
    await inputs.run();
    const mixed = (await hook(page)).result as HedgingResult;
    expect(mixed.structure.strikes.map((s) => s.optionType)).toEqual(["C", "P", "C", "P", "C", "P"]);
    expect(Math.abs(mixed.summary.actualInbuilt - puts.summary.actualInbuilt)).toBeLessThan(1e-9);
    expect(Math.abs(mixed.summary.totalPremiumCr - puts.summary.totalPremiumCr)).toBeLessThan(1e-6);
    expect(mixed.summary.futuresAdjustmentCr).not.toBe(0);

    await nav.go("summary");
    await expect(page.locator("main")).toContainText("Futures Adjustment For Call Strikes");
    await expect(page.locator("main th", { hasText: "Buy Or Sell" }).first()).toBeVisible();
  });

  test("removing a strike and adding one at 100% keep the payoff priceable", async ({ page, inputs }) => {
    test.setTimeout(180_000);
    await inputs.goto("default");
    await page.getByTestId("remove-strike-1").click();
    await expect(page.locator('[data-testid^="strike-row-"]')).toHaveCount(5);
    await page.getByTestId("input-newStrike").fill("100");
    await page.getByTestId("add-strike").click();
    await expect(page.locator('[data-testid^="strike-row-"]')).toHaveCount(6);
    await expect(page.locator('[data-testid^="strike-error-"]')).toHaveCount(0);
    await inputs.run();
    const r = (await hook(page)).result as HedgingResult;
    expect(r.structure.strikes.map((s) => s.percent)).toContain(100);
    expect(r.structure.strikes.every((s, i) => s.side === r.inputs.strikeSides[i])).toBe(true);
  });
});
