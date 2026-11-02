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

  test("a Chrome performance trace of a default run shows no main thread task over 200 ms", async ({ page, browser, inputs }) => {
    await inputs.goto();
    await browser.startTracing(page, { categories: ["toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline"] });
    const start = Date.now();
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/, { timeout: 10_000 });
    const ms = Date.now() - start;
    await expect(page.getByTestId("table-summary-headline")).toBeVisible();
    const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: Array<{ name: string; ph: string; pid: number; tid: number; dur?: number; args?: { name?: string } }> };
    const main = new Set(trace.traceEvents.filter((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain").map((e) => `${e.pid}:${e.tid}`));
    const tasks = trace.traceEvents.filter((e) => e.ph === "X" && /RunTask$/.test(e.name) && main.has(`${e.pid}:${e.tid}`)).map((e) => (e.dur ?? 0) / 1_000);
    const longestTaskMs = Math.round(Math.max(0, ...tasks));
    test.info().annotations.push({ type: "trace", description: JSON.stringify({ ms, longestTaskMs, tasksOver50Ms: tasks.filter((t) => t > 50).length, tasks: tasks.length }) });
    expect(tasks.length, "the trace holds the renderer's tasks").toBeGreaterThan(0);
    if (prod) {
      expect(ms).toBeLessThan(1_500);
      expect(longestTaskMs).toBeLessThan(200);
    }
  });
});
