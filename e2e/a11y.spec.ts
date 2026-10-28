import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { TAB_IDS } from "./pages";

// axe judges the settled page; with motion on, a fade-in caught mid-way reads as low contrast.
test.use({ reducedMotion: "reduce" });

/** Wait until no finite animation is running, so colours are read at their final opacity. */
async function settle(page: Page) {
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity), undefined, {
      timeout: 10_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

/** Serious and critical axe violations on the current page, as readable lines. */
async function violations(page: Page, where: string): Promise<string[]> {
  await settle(page);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${where}: [${v.impact}] ${v.id} · ${v.help} · ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} (${n.any[0]?.message ?? ""})`).join(" | ")}`);
}

test("no serious or critical axe violations on any page after a run", async ({ page, inputs, nav }) => {
  await inputs.goto();
  await inputs.run();
  const found: string[] = [];
  for (const id of TAB_IDS) {
    await nav.go(id);
    found.push(...(await violations(page, id)));
  }
  expect(found, found.join("\n")).toEqual([]);
});

test("no serious or critical axe violations on Blank Inputs with errors and the validation popup", async ({ page, inputs }) => {
  await inputs.goto("blank");
  await inputs.expectValidationDialog();
  const found = await violations(page, "validation popup");
  await inputs.dialog.dismissAll();
  found.push(...(await violations(page, "blank inputs with errors")));
  expect(found, found.join("\n")).toEqual([]);
});

test("no serious or critical axe violations in the dark theme", async ({ page, inputs, nav }) => {
  await inputs.goto();
  await inputs.run();
  await nav.themeToggle.click();
  const found: string[] = [];
  for (const id of ["inputs", "summary", "pricer"] as const) {
    await nav.go(id);
    found.push(...(await violations(page, `dark ${id}`)));
  }
  expect(found, found.join("\n")).toEqual([]);
});
