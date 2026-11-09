import type { Page } from "@playwright/test";

import { formatDate } from "../../lib/engine/dates";
import { correctExpiryDate, correctNumber } from "../../lib/validation/corrections";
import { blankFillInputs } from "../../tests/helpers/mock-market";
import { expect, test } from "../fixtures";
import { readShape } from "../support/tables";
import { chromiumOnly, expectCorrected, fillBlank, fillValue } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const STRIKES = [0, 1, 2, 3, 4, 5].map((i) => Number(fillValue(`input-strikePercents-${i}`)));
const filled = blankFillInputs();
/** What lib/validation/corrections makes of a strike typed on the filled page. */
const strikeFix = (i: number, v: number) => correctNumber(filled, `strikePercents.${i}`, v, { today: "2026-10-28", spot: filled.spot })!;

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

  // Strikes keep their row's role, so one out of order is clamped one point inside the neighbour it crossed, not re-sorted.
  test("B4.1 a strike typed above the strike before is clamped below it at each adjacent pair, with a note and no popup", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    for (let i = 0; i < 5; i++) {
      await test.step(`Strike ${i + 2} above Strike ${i + 1}`, async () => {
        const fix = strikeFix(i + 1, STRIKES[i]! + 1);
        // The protection strike stops at 100%, zero protection, before it meets Strike 3.
        expect(fix.note).toMatch(i === 2 ? /^Lowered To Zero Protection, / : new RegExp(`^Lowered Below Strike ${i + 1}, `));
        await expectCorrected(page, `input-strikePercents-${i + 1}`, String(STRIKES[i]! + 1), fix);
        expect(fix.value).toBeLessThan(STRIKES[i]!);
        await inputs.fill(`strikePercents-${i + 1}`, String(STRIKES[i + 1]));
      });
    }
  });

  test("B4.2 a strike equal to the one before is clamped one point below it", async ({ page }) => {
    const fix = strikeFix(2, STRIKES[1]!);
    expect(fix).toEqual({ value: STRIKES[1]! - 1, note: `Lowered Below Strike 2, ${(STRIKES[1]! - 1).toFixed(3)}%` });
    await expectCorrected(page, "input-strikePercents-2", String(STRIKES[1]), fix);
  });

  test("B4.3 a floor strike of zero takes its default, and a negative one is made positive", async ({ page }) => {
    await expectCorrected(page, "input-strikePercents-5", "0", { value: 70, note: "Set To The Default, 70.000%" });
    await expectCorrected(page, "input-strikePercents-5", "-5", { value: 5, note: "Made Positive, 5.000%" });
  });

  test("B4.4 a strike out of order never blocks the run", async ({ page, inputs, outputs }) => {
    await expectCorrected(page, "input-strikePercents-2", "128", strikeFix(2, 128));
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

  test("B5.2 a date that does not fall after the one before moves to the first expiry after it, with a note", async ({ page, inputs }) => {
    await fillBlank(inputs);
    // 01-Jun-2030 moves to 27-Jun-2030 and 10-Jul-2030 to 25-Jul-2030, neither after Expiry 2, so both become 29-Aug-2030.
    for (const v of ["2030-06-01", "2030-07-10"]) {
      const fix = correctExpiryDate(filled, 2, v);
      expect(fix).toEqual({ value: "2030-08-29", note: "Moved After Expiry 2, 29-Aug-2030" });
      await inputs.fill("expiryDates-2", v);
      await expect(page.getByTestId("input-expiryDates-2")).toHaveValue("29-Aug-2030");
      await expect(page.getByTestId("expiry-note-2")).toHaveText(fix.note);
      await expect(inputs.dialog.root).toHaveCount(0);
    }
  });

  test("B5.3 an expiry beyond the surface runs with no popup and a note on the Pricer; expiries inside it have no note", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/);
    await expect(page.getByTestId("desk-toast")).toHaveText("Simulation Completed");
    await expect(inputs.dialog.root).toHaveCount(0);
    await nav.go("pricer");
    await expect(page.getByTestId("surface-coverage-note")).toContainText("after the last surface row");
    await nav.go("inputs");
    await pasteExpiries(page, ["2027-01-28", "2027-04-29", "2027-07-29", "2027-10-28", "2028-01-27", "2028-04-27"]);
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/);
    await expect(inputs.dialog.root).toHaveCount(0);
    await nav.go("pricer");
    await expect(page.getByTestId("surface-coverage-note")).toHaveCount(0);
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
      await expect(page.getByTestId(`expiry-card-${median}`).getByTestId("expiry-hedge-badge")).toHaveText("Hedge Option Expiry");
    }
    await pasteExpiries(page, QUARTERLY.slice(0, 6));
    await inputs.run();
    await nav.go("vega-hedge");
    await expect(page.locator('[data-cell$="::Option Expiry"]').first()).toHaveText(formatDate(QUARTERLY[2]));
  });

  test("B5.6 Monthly From First Expiry fills each month's last expiry day across the year end, and added rows keep the step", async ({ page, inputs }) => {
    const months = (from: string, n: number, step: number) =>
      Array.from({ length: n }, (_, i) => {
        const m = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1 + step * i;
        return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`;
      });
    const expectDates = async (firsts: string[], weekday: number) => {
      for (const [i, d] of firsts.entries()) await expect(inputs.field(`expiryDates-${i}`), `Expiry ${i + 1}`).toHaveAttribute("data-value", lastWeekday(d, weekday));
    };
    for (const [underlying, weekday] of [
      ["Sensex", 4],
      ["Nifty", 2],
    ] as const) {
      await inputs.goto("blank");
      await inputs.fill("underlying", underlying);
      await inputs.fill("valuationDate", "2026-10-28");
      await inputs.fill("expiryCount", "4");
      const monthly = page.getByTestId("expiries-monthly");
      await expect(monthly).toHaveText("Monthly From First Expiry");
      await expect(monthly).toHaveAttribute("title", "Every Expiry One Month After The One Before");
      // The same rule as Quarterly: off until Expiry 1 is a date.
      await expect(monthly).toBeDisabled();
      await expect(page.getByTestId("expiries-quarterly")).toBeDisabled();
      await inputs.fill("expiryDates-0", "2030-11-05");
      await expect(monthly).toBeEnabled();
      await monthly.click();
      await expectDates(months("2030-11", 4, 1), weekday);

      // One more row, then three more, each a month after the one before.
      await page.getByTestId("input-expiryCount-plus").click();
      await inputs.fill("expiryCount", "8");
      await expectDates(months("2030-11", 8, 1), weekday);

      // Quarterly from the same first expiry, and an added row then continues quarterly.
      await inputs.fill("expiryCount", "3");
      await page.getByTestId("expiries-quarterly").click();
      await inputs.fill("expiryCount", "5");
      await expectDates(months("2030-11", 5, 3), weekday);
    }
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
        await expect(page.getByTestId(`input-expiryDates-${i}`), `${underlying} ${typed}`).toHaveValue(formatDate(snapped));
        await expect(page.getByTestId(`expiry-note-${i}`)).toHaveText(`Moved To The Last ${name}, ${formatDate(snapped)}`);
      }
    }
  });

  test("B6.2 switching the underlying moves every date to the new expiry day", async ({ page, inputs }) => {
    await fillBlank(inputs);
    const sensex = await Promise.all([0, 1, 2, 3, 4, 5].map(async (i) => (await page.getByTestId(`input-expiryDates-${i}`).getAttribute("data-value"))!));
    for (const d of sensex) expect(d).toBe(lastWeekday(d, 4));
    await inputs.fill("underlying", "Nifty");
    await expect(page.getByTestId("expiry-weekday")).toHaveText("Last Tuesday Of The Month");
    for (const [i, d] of sensex.entries()) await expect(page.getByTestId(`input-expiryDates-${i}`)).toHaveValue(formatDate(lastWeekday(d, 2)));
  });
});
