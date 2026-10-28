import { expect, type Page, type TestInfo } from "@playwright/test";

import blankFill from "../../tests/fixtures/blank-valid-fill.json";
import type { InputsPage } from "../pages";

export const FILL = blankFill.fill as Array<[string, string]>;

/** The typed value of a field in the valid fill, by test id. */
export function fillValue(testId: string): string | undefined {
  return FILL.find(([id]) => id === testId)?.[1];
}

/**
 * Checks of input rules and numbers, which do not depend on the browser engine, run once on desktop Chromium;
 * the cross-browser projects run the flows, keyboard and layout checks.
 */
export function chromiumOnly(testInfo: TestInfo) {
  testInfo.skip(testInfo.project.name !== "chromium", "Rule and number checks run once, on desktop Chromium.");
}

/** Blank Inputs with the valid fill typed in, except the given test ids. */
export async function fillBlank(inputs: InputsPage, except: string[] = []) {
  await inputs.goto("blank");
  await inputs.fillAll(FILL.filter(([id]) => !except.includes(id) && !(except.includes("input-expiryCount") && id.startsWith("input-expiryMonths-"))));
  await inputs.dialog.dismissAll();
}

/** Put one field back to its valid fill value. Hedge Strike goes back to following the spot. */
export async function restoreField(page: Page, inputs: InputsPage, testId: string) {
  if (testId === "input-hedgeStrike") {
    await page.getByTestId("input-hedgeStrikeAuto").check();
    return;
  }
  const value = fillValue(testId);
  if (value == null) throw new Error(`No fill value for ${testId}`);
  await inputs.fill(testId, value);
}

/** The items of the validation popup, as "Label: message". */
export async function dialogItems(page: Page): Promise<string[]> {
  return page.getByTestId("desk-dialog-groups").locator("li").allTextContents().then((t) => t.map((x) => x.trim()));
}

export async function expectNotRun(page: Page) {
  await expect(page.getByTestId("strip-simulation")).toHaveText("Not Run");
  await expect(page).toHaveURL(/\/$/);
}

/** The engine flags an invalid number at once; a bad parse flags the field itself. */
export async function expectFlagged(page: Page, testId: string, text: string) {
  const field = page.getByTestId(testId);
  await field.fill(text);
  await field.blur();
  await expect(field, `${testId} = ${text}`).toHaveAttribute("aria-invalid", "true");
}

export async function expectAccepted(page: Page, testId: string, text: string) {
  const field = page.getByTestId(testId);
  await field.fill(text);
  await field.blur();
  await expect(field, `${testId} = ${text}`).not.toHaveAttribute("aria-invalid", "true");
}

/** Escape a label for a regular expression. */
export const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
