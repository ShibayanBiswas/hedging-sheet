import { expect, type Page } from "@playwright/test";

import type { HedgingResult } from "../../lib/engine/types";
import type { DeskInputs } from "../../lib/inputs/draft";

type TestHook = { result: HedgingResult | null; inputs: DeskInputs; stale: boolean; mode: string; runs: number };

/** The desk's test hook, present when the build has NEXT_PUBLIC_E2E=1. */
export async function hook(page: Page): Promise<TestHook> {
  const value = await page.evaluate(() => (window as unknown as { __HS_TEST__?: unknown }).__HS_TEST__ ?? null);
  expect(value, "window.__HS_TEST__ is exposed").not.toBeNull();
  return value as TestHook;
}

/** Output tables on the current page. */
export const outputTableCount = (page: Page) => page.locator('main [data-testid^="table-"]').count();
