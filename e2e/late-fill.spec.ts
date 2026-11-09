import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.use({ reducedMotion: "reduce" });

/** Holds every request to a route until release() is called, as a slow server would. */
async function hold(page: Page, url: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

/** The page has hydrated, so typing reaches React. */
const hydrated = (page: Page) => page.waitForFunction(() => (window as unknown as { __HS_TEST__?: unknown }).__HS_TEST__ != null);

test.describe("A late automatic fill never overwrites what was typed", () => {
  test("a Valuation Date, Spot and Hedge Strike typed before the close arrives are kept", async ({ page, inputs }) => {
    const release = await hold(page, "**/api/market/levels");
    await page.goto("/");
    await hydrated(page);
    await expect(inputs.field("spot")).toHaveValue("");
    await inputs.fill("input-valuationDate", "2026-10-26");
    await inputs.fill("input-spot", "75000");
    await inputs.fill("input-hedgeStrike", "75100");
    const landed = page.waitForResponse("**/api/market/levels");
    release();
    await landed;
    // The close has arrived: Fetched At shows it, and the typed values stand.
    await expect(page.getByTestId("spot-fetched-at")).not.toHaveText("-");
    await page.waitForLoadState("networkidle");
    await expect(inputs.field("valuationDate")).toHaveValue("26-Oct-2026");
    await expect(inputs.field("spot")).toHaveValue("75,000.00");
    await expect(inputs.field("hedgeStrike")).toHaveValue("75,100");
    await expect(page.getByTestId("hedge-strike-status")).toHaveText("Edited");
  });

  test("with nothing typed, the same late close fills the Spot, the Hedge Strike and the date", async ({ page, inputs }) => {
    const release = await hold(page, "**/api/market/levels");
    await page.goto("/");
    await hydrated(page);
    const landed = page.waitForResponse("**/api/market/levels");
    release();
    await landed;
    await expect(inputs.field("spot")).toHaveValue("76,835.78");
    await expect(inputs.field("hedgeStrike")).toHaveValue("77,300");
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
  });

  test("a Daily Volatility typed before the history arrives is kept, and the card says Edited", async ({ page, inputs }) => {
    const release = await hold(page, "**/api/market/daily-vol**");
    await page.goto("/");
    await hydrated(page);
    await inputs.fill("input-dailyVol", "1.25");
    const landed = page.waitForResponse("**/api/market/daily-vol**");
    release();
    await landed;
    await page.waitForLoadState("networkidle");
    await expect(inputs.field("dailyVol")).toHaveValue("1.250");
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Edited");
  });

  test("a volatility typed while a new underlying's history is on its way is kept", async ({ page, inputs }) => {
    await inputs.goto();
    await page.waitForLoadState("networkidle");
    const release = await hold(page, "**/api/market/daily-vol**");
    await inputs.fill("input-underlying", "Nifty");
    await inputs.fill("input-dailyVol", "1.1");
    const landed = page.waitForResponse("**/api/market/daily-vol**");
    release();
    await landed;
    await page.waitForLoadState("networkidle");
    await expect(inputs.field("dailyVol")).toHaveValue("1.100");
  });
});
