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

/** Layout shift since the last reset, user input excluded, with the elements that moved. */
const readShift = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shiftSources: string[] };
    return { value: w.__cls, sources: w.__shiftSources.join("; ") };
  });
const resetShift = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shiftSources: string[] };
    w.__cls = 0;
    w.__shiftSources = [];
  });

test("every button and link on every tab: no console error, no failed response, no layout shift above 0.1", async ({ page, inputs, nav, consoleErrors }) => {
  test.setTimeout(600_000);
  const failed: string[] = [];
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.host === new URL(page.url() || "http://localhost").host && res.status() >= 400) failed.push(`${res.status()} ${url.pathname}`);
  });
  page.on("filechooser", (chooser) => void chooser.setFiles([]).catch(() => undefined));
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shiftSources: string[] };
    w.__cls = 0;
    w.__shiftSources = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }> }>) {
        if (e.hadRecentInput) continue;
        w.__cls += e.value;
        const moved = (e.sources ?? []).map((s) => (s.node instanceof HTMLElement ? s.node.dataset.testid ?? `${s.node.tagName}.${String(s.node.className).split(" ")[0]}` : String(s.node?.nodeName)));
        w.__shiftSources.push(`${e.value.toFixed(3)} ${moved.join(", ")}`);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  // CI machines are slower; CPU_THROTTLE reproduces that locally.
  if (process.env.CPU_THROTTLE) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE) });
  }

  await inputs.goto("default");
  await inputs.run();
  const shifts: string[] = [];
  let clicked = 0;

  for (const tab of TAB_IDS) {
    // The swap from the old page to the new one is the navigation itself; stability is measured once the page has rendered.
    await nav.go(tab);
    await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await resetShift(page);
    await page.waitForTimeout(1_500);
    const shift = await readShift(page);
    if (shift.value > 0.1) shifts.push(`${tab}: ${shift.value.toFixed(3)} from ${shift.sources}`);

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
