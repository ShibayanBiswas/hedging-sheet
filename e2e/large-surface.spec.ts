import fs from "node:fs";

import ExcelJS from "exceljs";

import { expect, test } from "./fixtures";
import surface from "../tests/fixtures/surface.json";

const ROWS = 150;
/** One expiry a month from Nov 2026, so none is hidden as before the valuation date. */
const expiries = Array.from({ length: ROWS }, (_, i) => new Date(Date.UTC(2026, 10 + i, 26)).toISOString().slice(0, 10));
const last = expiries.at(-1)!;

test.describe("A surface over 100 rows", () => {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/dataset", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const row = body.surface.volsPercent[0];
      await route.fulfill({ response, json: { ...body, surface: { ...body.surface, expiries, volsPercent: expiries.map(() => row) } } });
    });
  });

  test("renders a window of rows, scrolls to the last one under a sticky header, and every cell stays on one line", async ({ page, inputs, marketData }) => {
    await inputs.goto();
    await marketData.open();
    await expect(page.getByTestId("vol-grid")).toBeVisible();
    await expect(page.getByTestId("vol-grid-legend")).toBeVisible();
    const box = page.getByTestId("vol-grid");
    const dateCell = (ymd: string) => box.locator(`td[data-kind="date"]`).filter({ hasText: new RegExp(`-${ymd.slice(0, 4)}$`) });

    const mounted = await box.locator('td[data-kind="date"]').count();
    expect(mounted, "only a window of the 150 rows is in the page").toBeLessThan(50);
    expect(mounted).toBeGreaterThan(5);

    await box.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(dateCell(last).last()).toBeVisible();
    expect(await box.locator('td[data-kind="date"]').count(), "still a window at the bottom").toBeLessThan(50);

    const report = await box.evaluate((el) => {
      const th = el.querySelector("thead tr:nth-child(2) th")!;
      const thBox = th.getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      const rows = [...el.querySelectorAll<HTMLTableRowElement>("tbody tr:not([aria-hidden])")];
      return {
        sticky: getComputedStyle(th).position,
        headerInView: thBox.top >= frame.top - 1 && thBox.bottom <= frame.bottom + 1,
        tallest: Math.max(...rows.map((r) => r.getBoundingClientRect().height)),
        rowCount: el.querySelector("table")!.getAttribute("aria-rowcount"),
      };
    });
    expect(report.sticky).toBe("sticky");
    expect(report.headerInView).toBe(true);
    expect(report.tallest, "single-line rows").toBeLessThanOrEqual(44);
    expect(report.rowCount).toBe(String(ROWS + 6));
  });

  test("editing keeps every row in the page, so nothing typed is lost to scrolling", async ({ page, inputs, marketData }) => {
    await inputs.goto();
    await marketData.open();
    await marketData.editSurface.click();
    await expect(page.locator(`[data-testid="vol-cell-${ROWS - 1}-1"]`)).toBeAttached();
    await marketData.discardSurface.click();
  });

  test("the Excel download holds all 150 rows, not the ones on screen", async ({ page, inputs, marketData }) => {
    await inputs.goto();
    await marketData.open();
    await expect(page.getByTestId("vol-grid")).toBeVisible();
    fs.mkdirSync("test-results/downloads", { recursive: true });
    const [download] = await Promise.all([page.waitForEvent("download"), marketData.downloadSurface.click()]);
    const file = `test-results/downloads/large-${download.suggestedFilename()}`;
    await download.saveAs(file);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(file);
    const dates = new Set<string>();
    book.worksheets.forEach((sheet) =>
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          const v = cell.value;
          const ymd = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
          if (ymd && expiries.includes(ymd)) dates.add(ymd);
        }),
      ),
    );
    expect(dates.size).toBe(ROWS);
  });

  test("a surface of 100 rows or fewer is not virtualised", async ({ page, inputs, marketData }) => {
    await page.unroute("**/api/dataset");
    await inputs.goto();
    await marketData.open();
    await expect(page.getByTestId("vol-grid-legend")).toBeVisible();
    const box = page.getByTestId("vol-grid");
    await expect(box.locator("table")).not.toHaveAttribute("aria-rowcount");
    expect(await box.locator('td[data-kind="date"]').count()).toBe(surface.expiries.filter((e: string) => e.slice(0, 10) >= "2026-10-28").length);
  });
});
