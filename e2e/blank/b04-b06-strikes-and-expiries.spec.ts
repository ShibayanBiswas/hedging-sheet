import { formatDate } from "../../lib/engine/dates";
import { expect, test } from "../fixtures";
import { readShape } from "../support/tables";
import { chromiumOnly, dialogItems, fillBlank, fillValue } from "./helpers";

const STRIKES = [0, 1, 2, 3, 4, 5].map((i) => Number(fillValue(`input-strikePercents-${i}`)));

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

  test("B4.3 a strike of zero or below is rejected", async ({ page, inputs }) => {
    for (const v of ["0", "-5"]) {
      await inputs.fill("strikePercents-5", v);
      await expect(inputs.field("strikePercents-5")).toHaveAttribute("aria-invalid", "true");
    }
    await inputs.runButton.click();
    expect((await dialogItems(page)).join("\n")).toMatch(/Strike 6: Strike 6 must be above 0/);
    await inputs.dialog.close();
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
  const MONTHS = [41, 44, 47, 50, 53, 56, 59, 62];

  test("B5.1 the count runs from 1 to 8 and that many month rows render", async ({ page, inputs }) => {
    await inputs.goto("blank");
    const options = await inputs.field("expiryCount").locator("option:not([disabled])").allTextContents();
    expect(options).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 3]) {
      await inputs.fill("expiryCount", String(n));
      await expect(page.locator('[data-testid^="input-expiryMonths-"]')).toHaveCount(n);
      await expect(page.locator('[data-testid^="expiry-date-"]')).toHaveCount(n);
    }
  });

  test("B5.2 months that do not increase or repeat are rejected", async ({ inputs }) => {
    await fillBlank(inputs);
    for (const v of ["44", "43"]) {
      await inputs.fill("expiryMonths-2", v);
      await inputs.dialog.expectTitle("Please Fix This Input");
      await expect(inputs.dialog.root).toContainText("strictly increase");
      await inputs.dialog.close();
      await expect(inputs.field("expiryMonths-2")).toHaveAttribute("aria-invalid", "true");
      await inputs.fill("expiryMonths-2", "47");
      await inputs.dialog.dismissAll();
    }
  });

  test("B5.3 a month beyond the surface runs with a warning; months inside it run without one", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Expiries Beyond The Surface");
    await inputs.dialog.dismissAll();
    await expect(page).toHaveURL(/\/summary$/);
    await nav.go("inputs");
    for (const [i, m] of [12, 18, 24, 30, 36, 42].entries()) await inputs.fill(`expiryMonths-${i}`, String(m));
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/);
    await expect(page.getByTestId("desk-toast")).toContainText("Simulation Complete");
    await expect(inputs.dialog.root).toHaveCount(0);
  });

  test("B5.4 for each count the Pricer shows one column per strike and expiry", async ({ page, inputs, nav }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(300_000);
    await fillBlank(inputs);
    for (let n = 1; n <= 8; n++) {
      await test.step(`${n} expiries`, async () => {
        await nav.go("inputs");
        await inputs.fill("expiryCount", String(n));
        for (let i = 0; i < n; i++) await inputs.fill(`expiryMonths-${i}`, String(MONTHS[i]));
        await inputs.run();
        await nav.go("pricer");
        const { headers } = await readShape(page, "pricer-legs");
        expect(headers[1]!.length - 1, `${n} expiries`).toBe(STRIKES.length * n);
      });
    }
  });

  test("B5.5 the option expiry is the median expiry, the lower middle one for an even count", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    for (const [n, median] of [
      [5, 2],
      [6, 2],
      [8, 3],
    ] as const) {
      await inputs.fill("expiryCount", String(n));
      for (let i = 0; i < n; i++) await inputs.fill(`expiryMonths-${i}`, String(MONTHS[i]));
      const date = (await page.getByTestId(`expiry-date-${median}`).textContent())!.trim();
      await expect(inputs.field("hedgeExpiryIndex").locator("option:checked")).toHaveText(`Median Expiry · ${date}`);
    }
    await inputs.fill("expiryCount", "6");
    const median = (await page.getByTestId("expiry-date-2").textContent())!.trim();
    await inputs.run();
    await nav.go("vega-hedge");
    await expect(page.locator('[data-cell$="::Option Expiry"]').first()).toHaveText(median);
  });
});

test.describe("B6 Weekday rule", () => {
  const MONTHS = [1, 3, 6, 12, 24, 36, 48, 60];
  /** Independent of the engine: search the seven days around valuation date + round(m × 30.5) for the weekday. */
  const expected = (valuation: string, month: number, weekday: number) => {
    const raw = new Date(`${valuation}T00:00:00Z`);
    raw.setUTCDate(raw.getUTCDate() + Math.round(month * 30.5));
    for (let shift = -3; shift <= 3; shift++) {
      const d = new Date(raw);
      d.setUTCDate(d.getUTCDate() + shift);
      if (d.getUTCDay() === weekday) return formatDate(d.toISOString().slice(0, 10));
    }
    throw new Error("no weekday within 3 days");
  };

  async function setUp(inputs: Parameters<typeof fillBlank>[0], underlying: string) {
    await inputs.goto("blank");
    await inputs.fill("underlying", underlying);
    await inputs.fill("expiryCount", "8");
    for (const [i, m] of MONTHS.entries()) await inputs.fill(`expiryMonths-${i}`, String(m));
  }

  test("B6.1 dates on screen match the weekday rule for Sensex and Nifty across a week of valuation dates", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    for (const [underlying, weekday, name] of [
      ["Sensex", 4, "Thursday"],
      ["Nifty", 2, "Tuesday"],
    ] as const) {
      await setUp(inputs, underlying);
      await expect(page.getByTestId("expiry-weekday")).toContainText(name);
      for (const valuation of ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]) {
        await inputs.fill("valuationDate", valuation);
        for (const [i, m] of MONTHS.entries()) {
          await expect(page.getByTestId(`expiry-date-${i}`), `${underlying} ${valuation} month ${m}`).toHaveText(expected(valuation, m, weekday));
        }
      }
    }
  });

  test("B6.2 switching the underlying re-derives every date", async ({ page, inputs }) => {
    await setUp(inputs, "Sensex");
    await inputs.fill("valuationDate", "2026-10-28");
    for (const [i, m] of MONTHS.entries()) await expect(page.getByTestId(`expiry-date-${i}`)).toHaveText(expected("2026-10-28", m, 4));
    await inputs.fill("underlying", "Nifty");
    await expect(page.getByTestId("expiry-weekday")).toContainText("Tuesday");
    for (const [i, m] of MONTHS.entries()) await expect(page.getByTestId(`expiry-date-${i}`)).toHaveText(expected("2026-10-28", m, 2));
  });
});
