import type { Page } from "@playwright/test";

import { formatDate } from "../../lib/engine/dates";
import { expect, test } from "../fixtures";
import { readShape } from "../support/tables";
import { chromiumOnly, expectFlagged, fillBlank, fillValue } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const STRIKES = [0, 1, 2, 3, 4, 5].map((i) => Number(fillValue(`input-strikePercents-${i}`)));

/** Independent of the engine: the last given weekday of a date's month. */
function lastWeekday(ymd: string, weekday: number): string {
  const [y, m] = ymd.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m, 0));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Ten quarterly expiries from Jul 2029, each the last Thursday of its month and all before the 09-Feb-2032 maturity. */
const QUARTERLY = ["2029-07-26", "2029-10-25", "2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24", "2031-07-31", "2031-10-30"];

/** Set the expiries in one go through Bulk Edit, so the order rule never sees a half-typed list. */
async function pasteExpiries(page: Page, dates: string[]) {
  await page.getByTestId("expiries-bulk").click();
  await page.getByTestId("bulk-expiries-text").fill(dates.join("\n"));
  await page.getByTestId("bulk-expiries-apply").click();
  await expect(page.getByTestId("input-expiryCount")).toHaveValue(String(dates.length));
}

test.describe("B4 Strikes", () => {
  test.beforeEach(async ({ inputs }) => {
    await fillBlank(inputs);
  });

  test("B4.1 strikes out of order at each adjacent pair open a popup naming both strikes", async ({ inputs }, testInfo) => {
    chromiumOnly(testInfo);
    for (let i = 0; i < 5; i++) {
      await test.step(`Strike ${i + 2} above Strike ${i + 1}`, async () => {
        await inputs.fill(`strikePercents-${i + 1}`, String(STRIKES[i]! + 1));
        await inputs.dialog.expectTitle("Please Fix This Input");
        await expect(inputs.dialog.root).toContainText(`Strike ${i + 2} at`);
        await expect(inputs.dialog.root).toContainText(`below Strike ${i + 1} at`);
        await inputs.dialog.close();
        await expect(inputs.field(`strikePercents-${i + 1}`)).toHaveAttribute("aria-invalid", "true");
        await inputs.fill(`strikePercents-${i + 1}`, String(STRIKES[i + 1]));
      });
    }
  });

  test("B4.2 equal strikes are rejected", async ({ inputs }) => {
    await inputs.fill("strikePercents-3", String(STRIKES[2]));
    await inputs.dialog.expectTitle("Please Fix This Input");
    await expect(inputs.dialog.root).toContainText("strictly descending");
    await inputs.dialog.close();
    await expect(inputs.field("strikePercents-3")).toHaveAttribute("aria-invalid", "true");
  });

  test("B4.3 a strike of zero or below reverts with a popup", async ({ page }) => {
    for (const v of ["0", "-5"]) await expectFlagged(page, "input-strikePercents-5", v);
    await expect(page.getByTestId("input-strikePercents-5")).toHaveAttribute("data-value", String(STRIKES[5]));
  });

  test("B4.4 fixing the order clears the error and the run goes ahead", async ({ inputs, outputs }) => {
    await inputs.fill("strikePercents-2", "128");
    await inputs.dialog.dismissAll(3_000);
    await expect(inputs.field("strikePercents-2")).toHaveAttribute("aria-invalid", "true");
    await inputs.fill("strikePercents-2", String(STRIKES[2]));
    await expect(inputs.field("strikePercents-2")).not.toHaveAttribute("aria-invalid", "true");
    await inputs.run();
    await outputs.summary.expectResults();
  });
});

test.describe("B5 Expiries", () => {
  test("B5.1 the count runs from 1 to 10 and that many date rows render", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await inputs.fill("underlying", "Sensex");
    await inputs.fill("valuationDate", "2026-10-28");
    const options = await inputs.field("expiryCount").locator("option:not([disabled])").allTextContents();
    expect(options).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    for (const n of [1, 6, 10, 3]) {
      await inputs.fill("expiryCount", String(n));
      await expect(page.locator('[data-testid^="input-expiryDates-"]')).toHaveCount(n);
    }
  });

  test("B5.2 a date that does not fall after the one before reverts with a popup", async ({ page, inputs }) => {
    await fillBlank(inputs);
    const before = await page.getByTestId("input-expiryDates-2").inputValue();
    // 01-Jun-2030 moves to 27-Jun-2030, before Expiry 2; 10-Jul-2030 moves to 25-Jul-2030, equal to it.
    for (const v of ["2030-06-01", "2030-07-10"]) {
      await inputs.fill("expiryDates-2", v);
      await inputs.dialog.expectTitle("Expiry 3 Reverted");
      await expect(inputs.dialog.root).toContainText("Expiry 3 must fall after Expiry 2.");
      await inputs.dialog.close();
      await expect(page.getByTestId("input-expiryDates-2")).toHaveValue(before);
    }
  });

  test("B5.3 an expiry beyond the surface runs with a warning; expiries inside it run without one", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Expiries Beyond The Surface");
    await inputs.dialog.dismissAll();
    await expect(page).toHaveURL(/\/summary$/);
    await nav.go("inputs");
    await pasteExpiries(page, ["2027-01-28", "2027-04-29", "2027-07-29", "2027-10-28", "2028-01-27", "2028-04-27"]);
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/);
    await expect(page.getByTestId("desk-toast")).toHaveText("Simulation Completed");
    await expect(inputs.dialog.root).toHaveCount(0);
  });

  test("B5.4 for each count the Pricer shows one column per strike and expiry", async ({ page, inputs, nav }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(400_000);
    await fillBlank(inputs);
    for (let n = 1; n <= 10; n++) {
      await test.step(`${n} expiries`, async () => {
        await nav.go("inputs");
        await pasteExpiries(page, QUARTERLY.slice(0, n));
        await inputs.run();
        await nav.go("pricer");
        const { headers } = await readShape(page, "pricer-legs");
        expect(headers[1]!.length - 1, `${n} expiries`).toBe(STRIKES.length * n);
      });
    }
  });

  test("B5.5 the hedge option expiry is the median expiry, the lower middle one for an even count", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    for (const [n, median] of [
      [5, 2],
      [6, 2],
      [8, 3],
    ] as const) {
      await pasteExpiries(page, QUARTERLY.slice(0, n));
      await expect(inputs.field("hedgeExpiryIndex").locator("option:checked")).toHaveText(`Median · Expiry ${median + 1}`);
      await expect(page.getByTestId(`expiry-note-${median}`)).toHaveText("Observation And Hedge Option Expiry");
    }
    await pasteExpiries(page, QUARTERLY.slice(0, 6));
    await inputs.run();
    await nav.go("vega-hedge");
    await expect(page.locator('[data-cell$="::Option Expiry"]').first()).toHaveText(formatDate(QUARTERLY[2]));
  });
});

test.describe("B6 Weekday rule", () => {
  /** A date in each of twelve months, none of them an expiry day. */
  const TYPED = ["2030-01-03", "2030-02-12", "2030-03-09", "2030-04-01", "2030-05-15", "2030-06-02", "2030-07-07", "2030-08-19", "2030-09-04", "2030-10-10"];

  test("B6.1 a typed date moves to the last Thursday for Sensex and the last Tuesday for Nifty", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    for (const [underlying, weekday, name] of [
      ["Sensex", 4, "Thursday"],
      ["Nifty", 2, "Tuesday"],
    ] as const) {
      await inputs.goto("blank");
      await inputs.fill("underlying", underlying);
      await inputs.fill("valuationDate", "2026-10-28");
      await inputs.fill("expiryCount", String(TYPED.length));
      await expect(page.getByTestId("expiry-weekday")).toHaveText(`Last ${name} Of The Month`);
      for (const [i, typed] of TYPED.entries()) {
        await inputs.fill(`expiryDates-${i}`, typed);
        const snapped = lastWeekday(typed, weekday);
        await expect(page.getByTestId(`input-expiryDates-${i}`), `${underlying} ${typed}`).toHaveValue(snapped);
        await expect(page.getByTestId(`expiry-note-${i}`)).toHaveText(`Moved To The Last ${name}, ${formatDate(snapped)}`);
      }
    }
  });

  test("B6.2 switching the underlying moves every date to the new expiry day", async ({ page, inputs }) => {
    await fillBlank(inputs);
    const sensex = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => page.getByTestId(`input-expiryDates-${i}`).inputValue()));
    for (const d of sensex) expect(d).toBe(lastWeekday(d, 4));
    await inputs.fill("underlying", "Nifty");
    await expect(page.getByTestId("expiry-weekday")).toHaveText("Last Tuesday Of The Month");
    for (const [i, d] of sensex.entries()) await expect(page.getByTestId(`input-expiryDates-${i}`)).toHaveValue(lastWeekday(d, 2));
  });
});
