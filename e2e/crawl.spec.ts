import { expect, test } from "./fixtures";
import { TAB_IDS } from "./pages/nav-bar";

/** The widths every browser is checked at. */
const WIDTHS = [1440, 1280, 1024, 768, 414, 390];

/** A navigation that replaces an in-flight prefetch cancels it; that is not a failure. */
const CANCELLED = /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|Load request cancelled/i;

for (const width of WIDTHS) {
  test(`Crawl · ${width} px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll`, async ({ page, inputs, nav, consoleErrors }) => {
    // A development server compiles each page on its first visit.
    test.setTimeout(240_000);
    const failed: string[] = [];
    page.on("requestfailed", (req) => {
      if (!CANCELLED.test(req.failure()?.errorText ?? "")) failed.push(`${req.method()} ${req.url()} ${req.failure()?.errorText}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
    });
    await page.setViewportSize({ width, height: 900 });
    await inputs.goto();
    await inputs.run();
    // The run's warning popups follow one another; on a slow engine the last can open a few seconds later.
    await inputs.dialog.dismissAll(4_000);
    for (const id of TAB_IDS) {
      await nav.go(id);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${id} scrolls sideways at ${width} px`).toBeLessThanOrEqual(1);
    }
    expect(consoleErrors).toEqual([]);
    expect(failed).toEqual([]);
  });
}
