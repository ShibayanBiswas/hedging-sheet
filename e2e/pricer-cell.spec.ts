import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** The overrides the desk holds and whether the run still matches them. */
const deskState = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as { __HS_TEST__: { inputs: { legVolOverrides: Record<string, number> }; stale: boolean } }).__HS_TEST__;
    return { overrides: state.inputs.legVolOverrides, stale: state.stale };
  });

test.describe("Pricer leg volatility cell", () => {
  test("tabbing through the cells stores no override, adds no badge and leaves the run current", async ({ page, inputs, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    await outputs.pricer.gridCell(0).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    await expect(outputs.pricer.gridCell(0)).not.toBeFocused();
    expect(await deskState(page)).toEqual({ overrides: {}, stale: false });
    await expect(outputs.pricer.staleBanner).toHaveCount(0);
    await expect(outputs.pricer.resetLegVols).toHaveCount(0);
    await expect(page.getByText("Overridden ×")).toHaveCount(0);
  });

  test("a typed 14.275 keeps its third decimal through a later untouched blur", async ({ page, inputs, nav, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    const cell = outputs.pricer.gridCell(0);
    await cell.fill("14.275");
    await page.keyboard.press("Tab");
    const typed = Object.values((await deskState(page)).overrides);
    expect(typed).toHaveLength(1);
    expect(typed[0]).toBeCloseTo(0.14275, 12);

    await cell.focus();
    await page.keyboard.press("Tab");
    expect(Object.values((await deskState(page)).overrides)[0]).toBeCloseTo(0.14275, 12);

    // The reopened tab shows the cell to 2 decimals; leaving it must not store the rounded text.
    await nav.go("inputs");
    await inputs.run();
    await outputs.pricer.open();
    await cell.focus();
    await page.keyboard.press("Tab");
    const after = await deskState(page);
    expect(Object.values(after.overrides)[0]).toBeCloseTo(0.14275, 12);
    expect(after.stale).toBe(false);
  });

  test("Reset brings the surface value back into a typed cell, before and after a run", async ({ page, inputs, nav, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    const cell = outputs.pricer.gridCell(0);
    const surface = await cell.inputValue();

    await cell.fill("30");
    await page.keyboard.press("Tab");
    await outputs.pricer.resetLegVols.click();
    await expect(cell).toHaveValue(surface);

    await cell.fill("30");
    await page.keyboard.press("Tab");
    await nav.go("inputs");
    await inputs.run();
    await outputs.pricer.open();
    await expect(cell).toHaveValue("30.00");
    await outputs.pricer.resetLegVols.click();
    await expect(cell).toHaveValue(surface);
    expect((await deskState(page)).overrides).toEqual({});
  });

  test("Reset clears the badge and the highlight at once, and the banner says the results are the last run's", async ({ page, inputs, nav, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    const cell = outputs.pricer.gridCell(0);
    await cell.fill("30");
    await page.keyboard.press("Tab");
    await nav.go("inputs");
    await inputs.run();
    await outputs.pricer.open();
    const box = cell.locator("xpath=ancestor::td");
    await expect(page.getByText("Overridden ×")).toHaveCount(1);
    await expect(box).toHaveClass(/hs-overridden-cell/);
    await expect(outputs.pricer.staleBanner).toHaveCount(0);

    await outputs.pricer.resetLegVols.click();
    await expect(page.getByText("Overridden ×")).toHaveCount(0);
    await expect(box).not.toHaveClass(/hs-overridden-cell/);
    await expect(outputs.pricer.staleBanner).toContainText("These results use the last run");
  });

  test("6,5 goes back to the value the cell had and stores nothing", async ({ page, inputs, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    const cell = outputs.pricer.gridCell(0);
    const surface = await cell.inputValue();
    await cell.fill("6,5");
    await page.keyboard.press("Tab");
    await expect(cell).toHaveValue(surface);
    expect(await deskState(page)).toEqual({ overrides: {}, stale: false });
  });
});
