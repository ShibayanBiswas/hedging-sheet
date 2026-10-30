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
  // Rows a count creates cannot be filled while the count is left unpicked, and a step stays locked until the ones before it are complete.
  const rowsOf = (id: string) =>
    (except.includes("input-expiryCount") && id.startsWith("input-expiryDates-")) ||
    (except.includes("input-spreadCount") && /^input-(strikePercents|strikeOptionTypes|strikeSides|participations)-/.test(id));
  for (const [id, value] of FILL.filter(([id]) => !except.includes(id) && !rowsOf(id))) {
    if (except.length) {
      // With a choice left out, later steps stay locked and the rows of an unpicked count never appear.
      const shown = await inputs.page
        .getByTestId(id)
        .waitFor({ state: "attached", timeout: 1_500 })
        .then(() => true)
        .catch(() => false);
      if (!shown || (await inputs.page.locator(`[data-locked] [data-testid="${id}"]`).count())) continue;
    }
    await inputs.fill(id, value);
  }
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
  return page.getByTestId("desk-dialog-groups").locator("li > span.flex-1").allTextContents().then((t) => t.map((x) => x.trim()));
}

export async function expectNotRun(page: Page) {
  await expect(page.getByTestId("strip-simulation")).toHaveText("Not Run");
  await expect(page).toHaveURL(/\/$/);
}

/** An invalid value never sticks: leaving the field opens a "Reverted" popup and puts the last valid value back. */
export async function expectFlagged(page: Page, testId: string, text: string) {
  const field = page.getByTestId(testId);
  const before = await field.getAttribute("data-value");
  await field.fill(text);
  await field.blur();
  const dialog = page.getByTestId("desk-dialog");
  await expect(dialog, `${testId} = ${text}`).toBeVisible();
  await expect(dialog.locator("#desk-dialog-title")).toHaveText(/ Reverted$/);
  await page.getByTestId("desk-dialog-ok").click();
  await expect(dialog).toHaveCount(0);
  expect(await field.getAttribute("data-value"), `${testId} = ${text}`).toBe(before);
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
}

export async function expectAccepted(page: Page, testId: string, text: string) {
  const field = page.getByTestId(testId);
  await field.fill(text);
  await field.blur();
  await expect(field, `${testId} = ${text}`).not.toHaveAttribute("aria-invalid", "true");
}

/** Escape a label for a regular expression. */
export const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
