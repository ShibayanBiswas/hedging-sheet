import { expect, test } from "../fixtures";
import { TAB_IDS } from "../pages";
import { masks, settle } from "../responsive/helpers";

/**
 * The one set of pixel baselines: the 8 tabs at 1440, 768 and 390 px, light theme, after a run.
 * Clocks, fetch times and live spots are masked and motion is reduced. Baselines are Linux only, from CI.
 */
const WIDTHS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const w of WIDTHS) {
  test.describe(`${w.name} ${w.width}`, () => {
    test.use({ viewport: { width: w.width, height: w.height }, reducedMotion: "reduce" });

    test(`visual baselines ${w.name} every tab after a run`, async ({ page, inputs, nav }) => {
      test.setTimeout(240_000);
      await inputs.goto();
      await inputs.run();
      await expect(page.getByTestId("desk-toast")).toHaveCount(0, { timeout: 15_000 });
      for (const id of TAB_IDS) {
        await nav.go(id);
        await page.evaluate(() => window.scrollTo(0, 0));
        await settle(page);
        await expect(page).toHaveScreenshot(`${w.name}-${id}.png`, { mask: masks(page) });
      }
    });
  });
}

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
