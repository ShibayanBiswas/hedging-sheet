import type { Page } from "@playwright/test";

/** Let finite animations finish, so sizes and positions are read at rest. */
export async function settle(page: Page) {
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity), undefined, { timeout: 8_000 })
    .catch(() => undefined);
  await page.waitForTimeout(150);
}

/** Masks for anything that changes between runs: the clock, fetch time, live closes and the fading run toast. */
export function masks(page: Page) {
  return [
    page.getByTestId("desk-footer"),
    page.getByTestId("market-strip"),
    page.getByTestId("fetched-at"),
    page.getByTestId("input-spot"),
    page.getByTestId("input-valuationDate"),
    page.getByTestId("desk-toast"),
  ];
}
