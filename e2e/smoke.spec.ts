import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = path.join("test-results", "screens");
const isRemote = Boolean(process.env.BASE_URL);

const PAGES = [
  { path: "/", heading: "Inputs" },
  { path: "/summary", heading: "Summary Sheet" },
  { path: "/pricer", heading: "Pricer" },
  { path: "/product", heading: "Product Description" },
  { path: "/vega-hedge", heading: "Day 1 Vega Hedge" },
  { path: "/margin", heading: "Mark to Market and Margin Requirement" },
  { path: "/market-data", heading: "Market Data" },
  { path: "/logic-atlas", heading: "Logic Atlas" },
];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function fresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/");
  await expect(page.getByTestId("mode-badge")).toHaveText("Workbook Defaults");
}

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

test("every page renders without console errors", async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  for (const p of PAGES) {
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1, name: p.heading }).or(page.getByRole("heading", { level: 2, name: p.heading })).first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `light${p.path === "/" ? "-inputs" : p.path.replace(/\//g, "-")}.png`), fullPage: false });
  }
  expect(errors.filter((e) => !/Download the React DevTools/.test(e))).toEqual([]);
});

test("workbook defaults reproduce the saved KPIs", async ({ page }) => {
  await fresh(page);
  await page.goto("/summary");
  await expect(page.getByTestId("kpi-actual-inbuilt")).toContainText("7.95%");
  await expect(page.getByTestId("kpi-option-premium")).toContainText("50.67");
  await expect(page.getByTestId("kpi-maturity-payout")).toContainText("202.50");
  await expect(page.getByTestId("kpi-margin-requirement")).toContainText("32.31%");
  await expect(page.getByTestId("kpi-hedge-quantity")).toContainText("12,809.67");
  await expect(page.getByTestId("kpi-internal-rate-of-return")).toContainText("14.20%");
  await page.goto("/margin");
  await expect(page.getByTestId("table-mtm")).toContainText("-32.31");
  await expect(page.getByTestId("kpi-worst-case-requirement")).toContainText("-72.10");
});

test("switching to Nifty renames every label", async ({ page }) => {
  await fresh(page);
  await page.getByTestId("underlying-Nifty").click();
  await expect(page.getByTestId("underlying-badge")).toHaveText("Nifty");
  await expect(page.getByText("Nifty Daily Volatility")).toBeVisible();
  for (const p of ["/summary", "/pricer", "/product", "/vega-hedge", "/margin"]) {
    await page.goto(p);
    await expect(page.locator("main")).toContainText("Nifty");
    await expect(page.locator("main")).not.toContainText("Sensex");
  }
  await page.goto("/");
  await page.getByTestId("underlying-Sensex").click();
  await expect(page.getByTestId("underlying-badge")).toHaveText("Sensex");
});

test("changing the expiry count checks the strike count", async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId("strike-count-error")).toHaveCount(0);
  for (let i = 0; i < 3; i++) await page.getByTestId("expiry-count-minus").click();
  await expect(page.getByTestId("expiry-month-3")).toHaveCount(0);
  await expect(page.getByTestId("strike-count-error")).toBeVisible();
  await page.goto("/summary");
  await expect(page.getByText("Pricing Is Blocked")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("expiry-count-input")).toHaveValue("3");
  for (let i = 0; i < 7; i++) await page.getByTestId("expiry-count-plus").click();
  await expect(page.getByTestId("expiry-month-9")).toBeVisible();
  await expect(page.getByTestId("expiry-month-0")).toHaveValue("41");
  await expect(page.getByTestId("strike-count-error")).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "expiries-ten.png") });
  await page.getByTestId("reset-defaults").click();
  await expect(page.getByTestId("strike-count-error")).toHaveCount(0);
  await expect(page.getByTestId("expiry-date-2")).toHaveText("25-Jul-2030");
});

test("adding and removing spreads", async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId("max-coupon")).toContainText("102.50%");
  await page.getByTestId("spread-count-plus").click();
  await expect(page.getByTestId("spread-card-2")).toBeVisible();
  await page.getByTestId("spread-count-minus").click();
  await expect(page.getByTestId("spread-card-2")).toHaveCount(0);
  await page.getByTestId("reset-defaults").click();
  await expect(page.getByTestId("max-coupon")).toContainText("102.50%");
});

test("vol surface upload with the sample file", async ({ page }) => {
  test.skip(isRemote, "Uploads are only exercised against the local scratch database.");
  await fresh(page);
  await page.goto("/market-data");
  const sample = path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx");
  await page.getByTestId("surface-file").setInputFiles(sample);
  await expect(page.getByTestId("upload-status")).toContainText(/replaced the active surface|this session only/);
  await expect(page.getByTestId("vol-grid")).toContainText("24-Apr-2031");
});

test("Excel download has the five sheets in order", async ({ page }) => {
  await fresh(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-excel").click()]);
  expect(download.suggestedFilename()).toBe("SP-Hedging-Sheet-Sensex-04-Aug-2026.xlsx");
  const file = path.join("test-results", download.suggestedFilename());
  await download.saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  expect(wb.worksheets.map((s) => s.name)).toEqual([
    "Summary Sheet",
    "Pricer",
    "Product Description",
    "Day 1 Vega Hedge",
    "Mark to Market and Margin",
  ]);
});

test("dark theme and mobile rails", async ({ page }) => {
  await fresh(page);
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const p of ["/summary", "/vega-hedge", "/logic-atlas"]) {
    await page.goto(p);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `dark${p.replace(/\//g, "-")}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/summary");
  const rail = page.locator(".horizontal-rail").first();
  const overflow = await rail.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(true);
  await page.screenshot({ path: path.join(SHOTS, "mobile-summary.png") });
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
