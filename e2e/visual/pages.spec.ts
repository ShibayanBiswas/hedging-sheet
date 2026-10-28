import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { TAB_IDS } from "../pages";

/**
 * Pixel baselines per page. Clocks, fetch times and live spots are masked, and animations are disabled.
 * Baselines are per platform: update them with npm run e2e:visual:update on the machine that runs CI.
 */
function masks(page: Page) {
  return [
    page.getByTestId("desk-footer"),
    page.getByTestId("market-strip"),
    page.getByTestId("fetched-at"),
    page.getByTestId("input-spot"),
    page.getByTestId("input-valuationDate"),
  ];
}

test.describe("visual baselines", () => {
  test("every page after a run", async ({ page, inputs, nav }) => {
    await inputs.goto();
    await expect(page).toHaveScreenshot("inputs-default.png", { mask: masks(page), fullPage: false });
    await inputs.run();
    for (const id of TAB_IDS) {
      await nav.go(id);
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${id}.png`, { mask: masks(page), fullPage: false });
    }
  });

  test("Blank Inputs and the validation popup", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await expect(page).toHaveScreenshot("inputs-blank.png", { mask: masks(page) });
    await inputs.expectValidationDialog();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot("validation-popup.png", { mask: masks(page) });
  });
});

test.describe("animation smoke", () => {
  test("the mode pill moves to the chosen mode", async ({ page, inputs }) => {
    await inputs.goto();
    const before = await inputs.modeActive.boundingBox();
    await inputs.setMode("blank");
    await expect
      .poll(async () => (await inputs.modeActive.boundingBox())?.x ?? 0, { timeout: 3_000 })
      .toBeGreaterThan((before?.x ?? 0) + 50);
    await expect(page.getByTestId("mode-blank").getByTestId("mode-active")).toHaveCount(1);
  });

  test("run steps appear in order and results reveal within 1.5 s of the run finishing", async ({ page, inputs }) => {
    await inputs.goto();
    const seen: string[] = [];
    const watcher = (async () => {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const text = await page.evaluate(() => document.querySelector('[data-testid="run-simulation"]')?.textContent ?? "");
        const step = /Step (\d) Of 4/.exec(text)?.[1];
        if (step && seen[seen.length - 1] !== step) seen.push(step);
        if (seen.length && (!text || !step)) return;
        await page.waitForTimeout(40);
      }
    })();
    await inputs.runButton.click();
    await watcher;
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect([...seen].sort()).toEqual(seen);
    const done = Date.now();
    await expect(page).toHaveURL(/\/summary$/);
    await expect(page.getByTestId("table-summary-headline")).toBeVisible({ timeout: 1_500 });
    expect(Date.now() - done).toBeLessThan(1_500);
  });
});
