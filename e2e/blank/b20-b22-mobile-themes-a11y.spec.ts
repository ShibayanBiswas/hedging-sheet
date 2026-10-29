import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import regression from "../../tests/fixtures/regression-expected.json";
import { expect, test } from "../fixtures";
import { TAB_IDS } from "../pages";
import { close, OUTPUT_TAB_IDS, tabProblems } from "../support/tables";
import { chromiumOnly, fillBlank } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Let finite animations finish so colours and sizes are read at rest. */
async function settle(page: Page) {
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity), undefined, { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(250);
}

async function axe(page: Page, where: string, rules?: string[]): Promise<string[]> {
  await settle(page);
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (rules) builder = builder.withRules(rules);
  const result = await builder.analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${where}: ${v.id} · ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).join(" | ")}`);
}

test.describe("B20 Mobile width, 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("B20.1 to B20.3 the full flow works with no page overflow; tables scroll inside their rails", async ({ page, inputs, nav }) => {
    await inputs.goto("blank");
    await expect(page.getByTestId("mode-blank")).toBeVisible();
    await fillBlank(inputs);
    await inputs.run();
    for (const id of TAB_IDS) {
      await nav.go(id);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${id} page overflow`).toBeLessThanOrEqual(1);
    }
    await nav.go("summary");
    const rails = await page.locator(".desk-table-scroll").evaluateAll((els) => els.map((e) => e.scrollWidth > e.clientWidth));
    expect(rails.some(Boolean)).toBe(true);
    await expect(page.getByTestId("table-summary-headline")).toBeVisible();
  });
});

test.describe("B21 White theme", () => {
  test("B21.1 the valid fill matches the regression and every output tab passes the table checks", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    await inputs.goto("blank");
    await fillBlank(inputs);
    await inputs.run();
    const ib = Number(await page.locator('[data-testid="table-summary-headline"] [data-cell$="::Actual Inbuilt"]').getAttribute("data-value"));
    expect(close(ib, regression.mock.blankFill.headline.actualInbuilt)).toBe(true);
    for (const tab of OUTPUT_TAB_IDS) expect(await tabProblems(page, tab)).toEqual([]);
  });

  test("B21.2 axe colour contrast passes on every page, and there is no theme toggle", async ({ page, inputs, nav }) => {
    await inputs.goto("blank");
    await expect(page.getByTestId("theme-toggle")).toHaveCount(0);
    await fillBlank(inputs);
    await inputs.run();
    const found: string[] = [];
    for (const id of TAB_IDS) {
      await nav.go(id);
      found.push(...(await axe(page, id, ["color-contrast"])));
    }
    expect(found, found.join("\n")).toEqual([]);
  });
});

test.describe("B22 Accessibility", () => {
  test("B22.1 axe passes on every page in Blank Inputs before a run, after a run and with a popup open", async ({ page, inputs, nav }) => {
    test.setTimeout(240_000);
    const found: string[] = [];
    await inputs.goto("blank");
    for (const id of TAB_IDS) {
      await nav.go(id);
      found.push(...(await axe(page, `before ${id}`)));
    }
    await nav.go("inputs");
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
    found.push(...(await axe(page, "validation popup")));
    await inputs.dialog.close();
    await fillBlank(inputs);
    await inputs.run();
    for (const id of TAB_IDS) {
      await nav.go(id);
      found.push(...(await axe(page, `after ${id}`)));
    }
    expect(found, found.join("\n")).toEqual([]);
  });
});
