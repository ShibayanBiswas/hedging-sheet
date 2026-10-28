import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = path.join("test-results", "screens");
const isRemote = Boolean(process.env.BASE_URL);

const OUTPUT_TABS = [
  { id: "summary", heading: "Summary Sheet" },
  { id: "pricer", heading: "Pricer" },
  { id: "product", heading: "Product Description" },
  { id: "vega-hedge", heading: "Day 1 Vega Hedge" },
  { id: "margin", heading: "Mark to Market and Margin Requirement" },
];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

function heading(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name }).or(page.getByRole("heading", { level: 2, name })).first();
}

/** Close every queued popup. Each one is waited out of the DOM, so an exiting popup is never clicked. */
async function dismissDialogs(page: Page) {
  for (let i = 0; i < 5; i++) {
    const dialog = page.getByTestId("desk-dialog");
    try {
      await dialog.waitFor({ state: "visible", timeout: 1_500 });
    } catch {
      return;
    }
    const title = (await dialog.locator("#desk-dialog-title").textContent()) ?? "";
    const message = ((await dialog.locator("p.whitespace-pre-wrap").textContent()) ?? "").slice(0, 60);
    await dialog.getByTestId("desk-dialog-ok").click();
    await expect(page.getByTestId("desk-dialog").filter({ hasText: title }).filter({ hasText: message })).toHaveCount(0);
  }
}

/** Load Inputs and wait for the live close so the run is not blocked on spot. */
async function fresh(page: Page) {
  await page.goto("/");
  await expect(heading(page, "Inputs")).toBeVisible();
  await expect(page.getByTestId("spot")).not.toHaveValue("", { timeout: 30_000 });
}

async function runSimulation(page: Page) {
  await page.getByTestId("run-simulation").click();
  await expect(page.getByTestId("desk-toast").or(page.getByTestId("desk-dialog")).first()).toBeVisible({ timeout: 30_000 });
  await dismissDialogs(page);
  await expect(page).toHaveURL(/\/summary$/, { timeout: 15_000 });
}

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

test("output tabs ask for a run, then show results without console errors", async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await page.screenshot({ path: path.join(SHOTS, "light-inputs.png") });
  for (const tab of OUTPUT_TABS) {
    await page.getByTestId(`nav-${tab.id}`).click();
    await expect(page.getByTestId("run-gate")).toBeVisible();
    await expect(page.getByText("Run The Simulation To See Results")).toBeVisible();
  }
  for (const id of ["market-data", "logic-atlas"]) {
    await page.getByTestId(`nav-${id}`).click();
    await expect(page.getByTestId("run-gate")).toHaveCount(0);
  }
  await page.getByTestId("nav-summary").click();
  await page.getByTestId("go-to-inputs").click();
  await expect(heading(page, "Inputs")).toBeVisible();

  await runSimulation(page);
  for (const tab of OUTPUT_TABS) {
    await page.getByTestId(`nav-${tab.id}`).click();
    await expect(heading(page, tab.heading)).toBeVisible();
    await expect(page.getByTestId("run-gate")).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `light-${tab.id}.png`) });
  }
  for (const id of ["market-data", "logic-atlas"]) {
    await page.getByTestId(`nav-${id}`).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `light-${id}.png`) });
  }
  expect(errors.filter((e) => !/Download the React DevTools/.test(e))).toEqual([]);
});

test("the Summary headline is a table and changed inputs mark the run stale", async ({ page }) => {
  await fresh(page);
  await runSimulation(page);
  await expect(page.getByTestId("table-summary-headline")).toContainText("Actual Inbuilt");
  await expect(page.getByTestId("stale-banner")).toHaveCount(0);
  await page.getByTestId("nav-inputs").click();
  await page.getByTestId("coupon").fill("100");
  await page.getByTestId("coupon").blur();
  await page.getByTestId("nav-summary").click();
  await expect(page.getByTestId("stale-banner")).toBeVisible();
});

test("expiries fall on the underlying weekday and Nifty renames every label", async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId("expiry-weekday")).toContainText("Thursday");
  await page.getByTestId("underlying-Nifty").click();
  await expect(page.getByTestId("underlying-badge")).toHaveText("Nifty");
  await expect(page.getByTestId("expiry-weekday")).toContainText("Tuesday");
  await expect(page.getByText("Nifty Daily Volatility")).toBeVisible();
  await expect(page.getByTestId("spot")).not.toHaveValue("", { timeout: 30_000 });
  await runSimulation(page);
  for (const tab of OUTPUT_TABS) {
    await page.getByTestId(`nav-${tab.id}`).click();
    await expect(page.locator("main")).toContainText("Nifty");
    await expect(page.locator("main")).not.toContainText("Sensex");
  }
});

test("strikes out of order open a popup with a fix and block the run", async ({ page }) => {
  await fresh(page);
  await page.getByTestId("strike-2").fill("128");
  await page.getByTestId("strike-2").blur();
  await expect(page.getByTestId("desk-dialog")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("desk-dialog")).toContainText("strictly descending");
  await expect(page.getByTestId("desk-dialog")).toContainText("How To Fix");
  await page.screenshot({ path: path.join(SHOTS, "popup-strike-order.png") });
  await dismissDialogs(page);
  await page.getByTestId("run-simulation").click();
  await expect(page.getByTestId("desk-dialog")).toContainText("Cannot Run The Simulation");
  await dismissDialogs(page);
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("reset-defaults").click();
  await expect(page.getByTestId("strike-2")).toHaveValue(/125/);
});

test("spreads follow the strikes and participation resets to derived", async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId("max-coupon")).toContainText("102.50%");
  await expect(page.getByTestId("spread-1-participation-status")).toContainText("Derived");
  await page.getByTestId("spread-1-participation").fill("12");
  await page.getByTestId("spread-1-participation").blur();
  await expect(page.getByTestId("spread-1-participation-status")).toContainText("Overridden");
  await dismissDialogs(page);
  await page.getByTestId("spread-1-reset").click();
  await expect(page.getByTestId("spread-1-participation-status")).toContainText("Derived");
  await page.getByTestId("spread-count-plus").click();
  await expect(page.getByTestId("spread-card-2")).toBeVisible();
  await expect(page.getByTestId("strike-card-6")).toBeVisible();
  await page.getByTestId("spread-count-minus").click();
  await expect(page.getByTestId("spread-card-2")).toHaveCount(0);
  await page.getByTestId("reset-defaults").click();
  await expect(page.getByTestId("max-coupon")).toContainText("102.50%");
});

test("a Pricer volatility override is badged and resets", async ({ page }) => {
  await fresh(page);
  await runSimulation(page);
  await page.getByTestId("nav-pricer").click();
  const cell = page.locator('[data-testid^="grid-edit-"]').first();
  await cell.fill("30");
  await cell.blur();
  await expect(page.getByTestId("stale-banner")).toBeVisible();
  await expect(page.getByTestId("reset-leg-vols")).toBeVisible();
  await page.getByTestId("reset-leg-vols").click();
  await expect(page.getByTestId("reset-leg-vols")).toHaveCount(0);
});

test("vol surface upload with the sample file", async ({ page }) => {
  test.skip(isRemote, "Uploads are only exercised against the local scratch database.");
  await fresh(page);
  await page.getByTestId("nav-market-data").click();
  const sample = path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx");
  await page.getByTestId("surface-file").setInputFiles(sample);
  await expect(page.getByTestId("desk-dialog")).toContainText(/replaced the active surface/, { timeout: 30_000 });
  await dismissDialogs(page);
  await expect(page.getByTestId("vol-grid")).toContainText("24-Apr-2031");
});

test("Excel download is enabled after a run and has the five sheets", async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId("download-excel")).toBeDisabled();
  await runSimulation(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-excel").click()]);
  expect(download.suggestedFilename()).toMatch(/^SP-Hedging-Sheet-Sensex-\d{2}-[A-Z][a-z]{2}-\d{4}\.xlsx$/);
  const file = path.join("test-results", download.suggestedFilename());
  await download.saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  expect(wb.worksheets.map((s) => s.name)).toEqual(["Summary Sheet", "Pricer", "Product Description", "Day 1 Vega Hedge", "Mark to Market and Margin"]);
});

test("dark theme and mobile rails", async ({ page }) => {
  await fresh(page);
  await runSimulation(page);
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const id of ["summary", "vega-hedge", "logic-atlas"]) {
    await page.getByTestId(`nav-${id}`).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `dark-${id}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("nav-summary").click();
  const scroller = page.locator(".desk-table-scroll").first();
  const overflow = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(true);
  await page.screenshot({ path: path.join(SHOTS, "mobile-summary.png") });
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
