import type { BrowserContext } from "@playwright/test";

import { expect, test } from "./fixtures";

const FROZEN_NOW = new Date("2026-10-28T04:30:00.000Z");

/** Opens `from` on a slow phone, clicks a tab as soon as its link exists, and says where the page ended up. */
async function clickAsSoonAsThere(context: BrowserContext, from: string, tab: string): Promise<string | null> {
  const page = await context.newPage();
  await page.clock.setFixedTime(FROZEN_NOW);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.goto(from, { waitUntil: "commit" });
  const link = page.getByTestId(`nav-${tab}`);
  await link.waitFor({ state: "attached", timeout: 60_000 });
  await link.click();
  const landed = await page
    .waitForURL(`**/${tab}`, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const at = landed ? null : `${from} to ${tab}: stayed on ${new URL(page.url()).pathname}`;
  await page.close();
  return at;
}

test.describe("A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });

  test("a tab scrolled into view on the rail is still there when the page hydrates", async ({ context, browserName }) => {
    test.skip(browserName !== "chromium", "CPU throttling needs Chrome DevTools");
    test.setTimeout(420_000);
    const missed: string[] = [];
    for (let round = 0; round < 6; round++) {
      for (const tab of ["market-data", "logic-atlas", "margin", "vega-hedge"]) {
        const miss = await clickAsSoonAsThere(context, "/", tab);
        if (miss) missed.push(miss);
      }
    }
    expect(missed).toEqual([]);
  });

  test("a tab clicked on a page whose own tab starts out of view lands too", async ({ context, browserName }) => {
    test.skip(browserName !== "chromium", "CPU throttling needs Chrome DevTools");
    test.setTimeout(240_000);
    const missed: string[] = [];
    for (let round = 0; round < 6; round++) {
      for (const tab of ["summary", "pricer"]) {
        const miss = await clickAsSoonAsThere(context, "/market-data", tab);
        if (miss) missed.push(miss);
      }
    }
    expect(missed).toEqual([]);
  });

  test("the rail stays where it was scrolled to when the page hydrates, and shows the open tab if it was not", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CPU throttling needs Chrome DevTools");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.goto("/", { waitUntil: "commit" });
    const rail = page.getByTestId("nav-rail");
    await rail.waitFor({ state: "attached" });
    await rail.evaluate((el) => {
      el.scrollLeft = 300;
    });
    await page.waitForLoadState("networkidle");
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBe(300);

    await page.goto("/logic-atlas");
    await page.waitForLoadState("networkidle");
    const inView = await page.getByTestId("nav-logic-atlas").evaluate((a) => {
      const box = a.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth;
    });
    expect(inView).toBe(true);
  });
});
