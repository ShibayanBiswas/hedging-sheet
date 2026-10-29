import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { TAB_IDS, type TabId } from "./pages/nav-bar";

const CLICKABLE = [
  "main button",
  "main a[href]",
  "main [role=tab]",
  "main [role=radio]",
  "header button",
  "header a[href]:not([data-testid^='nav-'])",
  "footer button",
  "footer a[href]",
].join(", ");

const PATH: Record<TabId, string> = {
  inputs: "/",
  summary: "/summary",
  pricer: "/pricer",
  product: "/product",
  "vega-hedge": "/vega-hedge",
  margin: "/margin",
  "market-data": "/market-data",
  "logic-atlas": "/logic-atlas",
};

/** Close whatever a click opened: popups, the palette, menus. */
async function closeOverlays(page: Page) {
  for (let i = 0; i < 5; i++) {
    const open = (await page.locator("[role=dialog]:visible, [data-testid='desk-dialog']:visible").count()) > 0;
    if (!open) return;
    const ok = page.getByTestId("desk-dialog-ok").first();
    if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 2_000 }).catch(() => undefined);
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
}

/** Layout shift since the last reset, user input excluded. */
const readShift = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const resetShift = (page: Page) => page.evaluate(() => ((window as unknown as { __cls: number }).__cls = 0));

test("every button and link on every tab: no console error, no failed response, no layout shift above 0.1", async ({ page, inputs, nav, consoleErrors }) => {
  test.setTimeout(600_000);
  const failed: string[] = [];
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.host === new URL(page.url() || "http://localhost").host && res.status() >= 400) failed.push(`${res.status()} ${url.pathname}`);
  });
  page.on("filechooser", (chooser) => void chooser.setFiles([]).catch(() => undefined));
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });

  await inputs.goto("default");
  await inputs.run();
  const shifts: string[] = [];
  let clicked = 0;

  for (const tab of TAB_IDS) {
    await resetShift(page);
    await nav.go(tab);
    await page.waitForTimeout(1_200);
    const shift = await readShift(page);
    if (shift > 0.1) shifts.push(`${tab}: ${shift.toFixed(3)}`);

    const count = await page.locator(CLICKABLE).count();
    for (let i = 0; i < count; i++) {
      const target = page.locator(CLICKABLE).nth(i);
      if (!(await target.isVisible().catch(() => false)) || !(await target.isEnabled().catch(() => false))) continue;
      await target.click({ timeout: 3_000 }).catch(() => undefined);
      clicked++;
      await page.waitForTimeout(150);
      await closeOverlays(page);
      if (new URL(page.url()).pathname !== PATH[tab]) await nav.go(tab);
    }
  }

  // The command palette opens from the keyboard.
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  expect(clicked).toBeGreaterThan(60);
  expect(shifts).toEqual([]);
  expect(failed).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
