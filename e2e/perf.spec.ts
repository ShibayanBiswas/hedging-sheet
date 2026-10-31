import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

type Vitals = { lcp: number; cls: number; longTaskMs: number };

/** LCP, CLS and the main-thread time spent in long tasks over 50 ms (a TBT estimate), from the browser's own observers. */
async function collectVitals(page: Page): Promise<Vitals> {
  return page.evaluate(
    () =>
      new Promise<Vitals>((resolve) => {
        let lcp = 0;
        let cls = 0;
        let longTaskMs = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longTaskMs += Math.max(0, e.duration - 50);
        }).observe({ type: "longtask", buffered: true });
        setTimeout(() => resolve({ lcp, cls, longTaskMs }), 1_500);
      }),
  );
}

/** Thresholds hold on a production build (E2E_PROD=1); the dev server compiles on first load. */
const prod = process.env.E2E_PROD === "1";

test.describe("performance budgets", () => {
  test("Inputs meets LCP, CLS and TBT budgets", async ({ page, inputs }) => {
    await inputs.goto();
    const v = await collectVitals(page);
    test.info().annotations.push({ type: "vitals", description: JSON.stringify(v) });
    expect(v.cls).toBeLessThan(0.05);
    if (prod) {
      expect(v.lcp).toBeLessThan(2_000);
      expect(v.longTaskMs).toBeLessThan(300);
    }
  });

  test("Pricer meets LCP, CLS and TBT budgets after a run", async ({ page, inputs, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    await outputs.pricer.expectResults();
    await page.reload();
    const v = await collectVitals(page);
    test.info().annotations.push({ type: "vitals", description: JSON.stringify(v) });
    expect(v.cls).toBeLessThan(0.05);
    if (prod) {
      expect(v.lcp).toBeLessThan(2_000);
      expect(v.longTaskMs).toBeLessThan(300);
    }
  });

  test("a run of the default book completes in under 1.5 s, with no main thread task over 200 ms", async ({ page, inputs }) => {
    await inputs.goto();
    await page.evaluate(() => {
      const w = window as unknown as { __longTasks: number[] };
      w.__longTasks = [];
      new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__longTasks.push(e.duration))).observe({ type: "longtask" });
    });
    const start = Date.now();
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/, { timeout: 10_000 });
    const ms = Date.now() - start;
    const longest = await page.evaluate(() => Math.max(0, ...(window as unknown as { __longTasks: number[] }).__longTasks));
    test.info().annotations.push({ type: "run", description: JSON.stringify({ ms, longestTaskMs: Math.round(longest) }) });
    expect(ms).toBeLessThan(prod ? 1_500 : 3_000);
    if (prod) expect(longest).toBeLessThan(200);
  });
});
