import type { Page } from "@playwright/test";

import type { HedgingResult } from "../lib/engine/types";
import { outputTables, specCells, type OutputTab } from "../lib/tables";
import { expect, test } from "./fixtures";
import { readCells } from "./support/tables";

/** The last run, exposed by the desk only when the build has NEXT_PUBLIC_E2E=1. */
async function lastResult(page: Page): Promise<HedgingResult> {
  const result = await page.evaluate(() => (window as unknown as { __HS_TEST__?: { result: unknown } }).__HS_TEST__?.result ?? null);
  expect(result, "window.__HS_TEST__ holds the last result").not.toBeNull();
  return result as HedgingResult;
}

/** Problems with one rendered cell: its text and raw value against the result, and the number format rules. */
function cellProblems(where: string, expected: { text: string; value: unknown }, shown: { text: string; value: number | null; hasInput: boolean }): string[] {
  const out: string[] = [];
  const number = typeof expected.value === "number" && Number.isFinite(expected.value) ? expected.value : null;
  // A payoff level can carry a badge such as Target or Floor after its value.
  const badge = shown.text.startsWith(expected.text) && /^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(shown.text.slice(expected.text.length));
  if (!shown.hasInput && shown.text !== expected.text && !badge) out.push(`${where}: shows "${shown.text}", the result gives "${expected.text}"`);
  if (number != null && (shown.value == null || Math.abs(shown.value - number) > 1e-9 * Math.max(1, Math.abs(number)))) {
    out.push(`${where}: holds ${shown.value}, the result gives ${number}`);
  }
  if (!shown.hasInput) {
    if (/\d\.\d{4,}/.test(shown.text)) out.push(`${where}: "${shown.text}" has more than 3 decimals`);
    if (number == null && expected.value !== "" && typeof expected.value !== "string" && shown.text !== "-") out.push(`${where}: a missing value shows "${shown.text}", not "-"`);
    if (number != null && Math.abs(number) >= 1000 && /^\D*\d{4,}/.test(shown.text.replace(/^-/, ""))) out.push(`${where}: "${shown.text}" has no thousands separator`);
    if (/NaN|Infinity|undefined/.test(shown.text)) out.push(`${where}: shows "${shown.text}"`);
  }
  return out;
}

async function crawlEveryTab(page: Page, nav: { go: (id: OutputTab) => Promise<void> }): Promise<{ problems: string[]; cells: number }> {
  const tables = outputTables(await lastResult(page));
  const problems: string[] = [];
  let cells = 0;
  for (const [tab, specs] of Object.entries(tables) as Array<[OutputTab, (typeof tables)[OutputTab]]>) {
    await nav.go(tab);
    for (const spec of specs) {
      await expect(page.getByTestId(`table-${spec.id}`)).toBeAttached();
      const shown = await readCells(page, spec.id);
      for (const c of specCells(spec)) {
        const where = `${tab} ${spec.id} ${c.key}`;
        const s = shown[c.key];
        if (!s) {
          problems.push(`${where}: not rendered`);
          continue;
        }
        cells++;
        problems.push(...cellProblems(where, c, s));
      }
    }
    const loose = await page.locator("main").evaluate((m) => {
      const found: string[] = [];
      const walker = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) found.push(...((n.textContent ?? "").match(/\d\.\d{4,}/g) ?? []));
      return found;
    });
    if (loose.length) problems.push(`${tab}: text outside the tables has more than 3 decimals: ${loose.slice(0, 5).join(", ")}`);
  }
  return { problems, cells };
}

test.describe("every number on every output tab matches the result and the number rules", () => {
  test("Sensex, Default Values", async ({ page, inputs, nav, consoleErrors }) => {
    test.setTimeout(240_000);
    await inputs.goto("default");
    await inputs.run();
    const { problems, cells } = await crawlEveryTab(page, nav);
    expect(problems.slice(0, 40)).toEqual([]);
    expect(cells).toBeGreaterThan(3000);
    expect(consoleErrors).toEqual([]);
  });

  test("Nifty, Default Values", async ({ page, inputs, nav, consoleErrors }) => {
    test.setTimeout(240_000);
    await inputs.goto("default");
    await inputs.fill("input-underlying", "Nifty");
    await expect(inputs.field("spot")).not.toHaveValue("", { timeout: 30_000 });
    await inputs.run();
    expect((await lastResult(page)).underlyingLabel).toBe("Nifty");
    const { problems } = await crawlEveryTab(page, nav);
    expect(problems.slice(0, 40)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
