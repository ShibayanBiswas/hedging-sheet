import fs from "node:fs";

import ExcelJS from "exceljs";
import { PDFParse } from "pdf-parse";
import type { Page } from "@playwright/test";

import { EXPORT_TABS } from "../lib/exports/tab-specs";
import { expect, test } from "./fixtures";

const WIDTHS = [1440, 1280, 1024, 768, 414, 390];

// Measurements read the settled page: under the frozen test clock entry animations never finish.
test.use({ reducedMotion: "reduce" });

async function runDefault(page: Page, inputs: { goto: () => Promise<void>; run: () => Promise<void> }) {
  await inputs.goto();
  await inputs.run();
  await expect(page).toHaveURL(/\/summary$/);
}

test.describe("Round 11 · Inputs", () => {
  test("counts: 1 to 10 expiries and 1 to 6 spreads, by dropdown and stepper, nothing below until picked", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await expect(page.getByTestId("input-expiryCount")).toHaveValue("");
    await expect(page.getByTestId("input-expiryDates-0")).toHaveCount(0);
    await expect(page.getByTestId("input-strikePercents-0")).toHaveCount(0);
    await inputs.fill("input-underlying", "Sensex");
    await inputs.fill("input-valuationDate", "2026-10-28");
    for (const n of [1, 10, 4]) {
      await page.getByTestId("input-expiryCount").selectOption(String(n));
      await expect(page.locator('[data-testid^="input-expiryDates-"]')).toHaveCount(n);
    }
    await page.getByTestId("input-expiryCount-plus").click();
    await expect(page.locator('[data-testid^="input-expiryDates-"]')).toHaveCount(5);
    await page.getByTestId("input-expiryCount-minus").click();
    await expect(page.locator('[data-testid^="input-expiryDates-"]')).toHaveCount(4);
    await page.getByTestId("input-expiryCount").selectOption("10");
    await expect(page.getByTestId("input-expiryCount-plus")).toBeDisabled();

    for (const n of [1, 6, 3]) {
      await page.getByTestId("input-spreadCount").selectOption(String(n));
      await expect(page.locator('[data-testid^="strike-row-"]')).toHaveCount(n + 4);
      await expect(page.getByTestId("strike-count")).toHaveText(String(n + 4));
    }
  });

  test("steps open in order: Complete Step 1 First until the Underlying and Valuation Date are in", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await expect(page.getByTestId("group-2-locked")).toHaveText("Complete Step 1 First");
    await inputs.fill("input-underlying", "Sensex");
    await inputs.fill("input-valuationDate", "2026-10-28");
    await expect(page.getByTestId("group-2-locked")).toHaveCount(0);
    await expect(page.getByTestId("group-3-locked")).toHaveText("Complete Step 2 First");
  });

  test("a typed expiry moves to the last Thursday and says so", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.fill("input-expiryDates-0", "2030-04-01");
    await expect(page.getByTestId("input-expiryDates-0")).toHaveValue("2030-04-25");
    await expect(page.getByTestId("expiry-note-0")).toHaveText("Moved To The Last Thursday, 25-Apr-2030");
  });

  test("Bulk Edit pastes expiries with a live preview and rejects more than 10 rows", async ({ page, inputs }) => {
    await inputs.goto();
    await page.getByTestId("expiries-bulk").click();
    const text = page.getByTestId("bulk-expiries-text");
    await text.fill(Array.from({ length: 11 }, (_, i) => `2031-${String(i + 1).padStart(2, "0")}-01`).join("\n"));
    await expect(page.getByTestId("bulk-expiries-error")).toContainText("At most 10 expiries");
    await expect(page.getByTestId("bulk-expiries-apply")).toBeDisabled();
    await text.fill("25-Apr-2030\n1-Jul-2030\t31-Oct-2030");
    await expect(page.getByTestId("bulk-expiries-row-1")).toContainText("Moved To 25-Jul-2030");
    await page.getByTestId("bulk-expiries-apply").click();
    await expect(page.getByTestId("input-expiryCount")).toHaveValue("3");
    await expect(page.getByTestId("input-expiryDates-1")).toHaveValue("2030-07-25");
  });

  test("Bulk Edit pastes strikes and the spread count follows", async ({ page, inputs }) => {
    await inputs.goto();
    await page.getByTestId("strikes-bulk").click();
    await page.getByTestId("bulk-strikes-text").fill("140\n137\n127\n125\n85\n84\n70");
    await expect(page.getByTestId("bulk-strikes-preview")).toBeVisible();
    await page.getByTestId("bulk-strikes-apply").click();
    await expect(page.getByTestId("input-spreadCount")).toHaveValue("3");
    await expect(page.getByTestId("input-strikePercents-0")).toHaveAttribute("data-value", "140");
  });

  test("an invalid edit opens a popup and the field reverts; a valid one sticks", async ({ page, inputs, dialog }) => {
    await inputs.goto();
    const field = page.getByTestId("input-hedgeStrike");
    const before = await field.getAttribute("data-value");
    await inputs.fill("input-hedgeStrike", "77350");
    await dialog.expectTitle("Hedge Strike Reverted");
    await expect(dialog.root).toContainText("multiple of 100");
    await dialog.close();
    await expect(field).toHaveAttribute("data-value", before!);
    await inputs.fill("input-hedgeStrike", "77400");
    await expect(field).toHaveAttribute("data-value", "77400");
    await inputs.fill("input-nbfcRate", "150");
    await dialog.expectTitle("NBFC Rate Reverted");
    await dialog.close();
    await expect(page.getByTestId("input-nbfcRate")).toHaveAttribute("data-value", "0.08");
  });

  test("Run checks everything: the popup lists each problem as a link to its field", async ({ page, inputs, dialog }) => {
    await inputs.goto("blank");
    await page.getByTestId("run-simulation").click();
    await dialog.expectTitle("Missing Or Invalid Inputs");
    await page.getByTestId("fix-input-spot").click();
    await expect(dialog.root).toHaveCount(0);
    await expect(page.getByTestId("input-spot")).toBeFocused();
  });

  test("volatility tags: both Calculated, both Edited after a change, both Calculated after Compute From History", async ({ page, inputs }) => {
    await inputs.goto();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    await expect(page.getByTestId("annual-vol-status")).toHaveText("Calculated");
    await inputs.fill("input-annualVol", "18");
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Edited");
    await expect(page.getByTestId("annual-vol-status")).toHaveText("Edited");
    await page.getByTestId("compute-history").click();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    await expect(page.getByTestId("annual-vol-status")).toHaveText("Calculated");
    await expect(page.getByTestId("vol-history-note")).toHaveText(/^\d+ Daily Returns From \d{2}-[A-Z][a-z]{2}-\d{4} To \d{2}-[A-Z][a-z]{2}-\d{4}$/);
  });

  test("hedge strike helper follows the underlying", async ({ page, inputs }) => {
    await inputs.goto();
    await expect(page.locator("#group-1")).toContainText("Auto From Spot: Spot Times 1.006, Rounded Up To The Next 100");
    await page.getByTestId("input-underlying").selectOption("Nifty");
    await expect(page.locator("#group-1")).toContainText("Auto From Spot: Spot Plus 150, Rounded Up To The Next 100");
    await expect(page.getByTestId("expiry-weekday")).toHaveText("Last Tuesday Of The Month");
  });

  test("a change after Run marks the results stale", async ({ page, inputs, nav }) => {
    await runDefault(page, inputs);
    await nav.go("inputs");
    await inputs.fill("input-coupon", "103");
    await expect(page.getByTestId("stale-chip")).toHaveText("Inputs Changed · Run Again");
  });
});

test.describe("Round 11 · Layout", () => {
  for (const width of WIDTHS) {
    test(`header fits at ${width} px with no overlaps`, async ({ page, inputs }) => {
      await page.setViewportSize({ width, height: 900 });
      await inputs.goto();
      const header = await page.getByTestId("site-header").boundingBox();
      expect(header!.height).toBeLessThanOrEqual(width < 640 ? 120 : 140);
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="site-header"] .brand-header-row > *')]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0)
          .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
      );
      for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.left, `item ${i}`).toBeGreaterThanOrEqual(boxes[i - 1]!.right - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test("footer: Desk Clock and Fetched At formats, labels beside values, the last cell at the right edge", async ({ page, inputs }) => {
    await inputs.goto();
    await expect(page.getByTestId("footer-clock")).toContainText("28-Oct-2026 · 10:00:00 am IST");
    await expect(page.getByTestId("footer-fetched")).toContainText(/\d{1,2}:\d{2} (am|pm) IST/);
    const gaps = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".footer-cell")].filter((c) => (c as HTMLElement).offsetParent);
      const grid = document.querySelector(".desk-footer-grid")!.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(document.querySelector(".desk-footer-grid")!).paddingRight);
      const inner = cells.map((c) => {
        const l = c.querySelector(".footer-label")?.getBoundingClientRect();
        const v = c.querySelector(".footer-value")?.getBoundingClientRect();
        return l && v ? v.left - l.right : 0;
      });
      const right = Math.max(...cells.map((c) => c.getBoundingClientRect().right));
      return { inner: Math.max(...inner), rightGap: grid.right - pad - right };
    });
    expect(gaps.inner).toBeLessThanOrEqual(8);
    expect(gaps.rightGap).toBeLessThanOrEqual(24);
  });

  test("toast: Simulation Completed, bottom right, 24 px in, at most 360 px wide", async ({ page, inputs }) => {
    await inputs.goto();
    await page.getByTestId("run-simulation").click();
    const toast = page.getByTestId("desk-toast");
    await expect(toast).toHaveText("Simulation Completed");
    const box = (await toast.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.width).toBeLessThanOrEqual(360);
    expect(Math.round(vp.width - (box.x + box.width))).toBe(24);
    expect(vp.height - (box.y + box.height)).toBeGreaterThanOrEqual(23);
  });

  test("toast at 390 px spans the bottom with 16 px margins", async ({ page, inputs }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await inputs.goto();
    await page.getByTestId("run-simulation").click();
    const box = (await page.getByTestId("desk-toast").boundingBox())!;
    expect(Math.round(box.x)).toBe(16);
    expect(Math.round(390 - (box.x + box.width))).toBe(16);
  });

  for (const width of [1440, 1024, 768, 390]) {
    test(`single-line table rows stay at or under 44 px at ${width} px`, async ({ page, inputs, nav }) => {
      await page.setViewportSize({ width, height: 900 });
      await runDefault(page, inputs);
      for (const tab of ["summary", "pricer", "product", "vega-hedge", "margin", "market-data", "logic-atlas"] as const) {
        await nav.go(tab);
        await page.waitForTimeout(300);
        const tall = await page.evaluate(() =>
          [...document.querySelectorAll(".data-table-premium tbody tr")]
            .filter((r) => !r.querySelector("input, button") && [...r.querySelectorAll("td")].every((td) => td.scrollHeight <= 30))
            .map((r) => r.getBoundingClientRect().height)
            .filter((h) => h > 44.5),
        );
        expect(tall, tab).toEqual([]);
      }
    });
  }

  test("Market Data: toolbar right-aligned in the heading row, Deep shows the 55% strike, Surface Parameters stacked", async ({ page, nav, inputs }) => {
    await inputs.goto();
    await nav.go("market-data");
    const toolbar = page.getByTestId("surface-toolbar");
    expect(await toolbar.evaluate((e) => getComputedStyle(e).justifyContent)).toBe("flex-end");
    const heading = await page.getByRole("heading", { name: "Volatility Surface" }).boundingBox();
    const bar = (await toolbar.boundingBox())!;
    expect(bar.y).toBeLessThan(heading!.y + heading!.height + 40);
    await expect(page.getByTestId("deep-strike-sensex")).toHaveText(/^[\d,]+\.\d{2}$/);
    const params = await page.getByTestId("surface-params-table").boundingBox();
    const curve = await page.getByTestId("rate-curve-editor").boundingBox();
    expect(curve!.y).toBeGreaterThan(params!.y + params!.height - 1);
    await expect(page.getByText("Every Value The Pricer Reads From The Pricing Parameters. Saving Writes Them To This Month In The Desk Database.")).toBeVisible();
  });

  test("Vega Hedge shows no 30.5 and titles its three price tables; Logic Atlas has one row per stage", async ({ page, inputs, nav }) => {
    await runDefault(page, inputs);
    await nav.go("vega-hedge");
    const cells = await page.locator("td, th, p, span").allTextContents();
    expect(cells.filter((t) => /^\s*30\.50?\s*$/.test(t))).toEqual([]);
    for (const t of ["Fair Price Computation", "Exchange Price Computation", "Stressed Price Computation"]) await expect(page.getByRole("heading", { name: t })).toBeVisible();
    await nav.go("logic-atlas");
    const stages = await page.locator('[data-testid="table-atlas-pipeline"] tbody tr td:first-child').allTextContents();
    expect(stages.map((s) => s.trim())).toEqual(["Inputs", "Expiries", "Strikes", "Surface Lookup", "Forwards", "Black Formula", "Goal Seek Inbuilt", "Pots", "Vega Hedge", "Margin Grid", "Payoff"]);
    await expect(page.locator('[data-testid="table-atlas-pipeline"] tbody tr').first()).not.toContainText(/^-$/);
  });
});

test.describe("Round 11 · Downloads", () => {
  test("PDF on every tab: output tabs wait for Run, the file holds the whole tab", async ({ page, inputs, nav }) => {
    test.setTimeout(240_000);
    await inputs.goto();
    for (const tab of EXPORT_TABS) {
      await nav.go(tab.id);
      const button = page.getByTestId(`download-pdf-${tab.id}`);
      if (tab.needsRun) await expect(button).toBeDisabled();
      else await expect(button).toBeEnabled();
    }
    await nav.go("inputs");
    await inputs.run();
    fs.mkdirSync("test-results/downloads", { recursive: true });
    for (const tab of EXPORT_TABS) {
      await nav.go(tab.id);
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(`download-pdf-${tab.id}`).click()]);
      expect(download.suggestedFilename()).toBe(`Hedging_Sheet_${tab.name.replace(/\s+/g, "_")}_28-Oct-2026.pdf`);
      const file = `test-results/downloads/${download.suggestedFilename()}`;
      await download.saveAs(file);
      const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
      const { text, pages } = await parser.getText();
      await parser.destroy();
      expect(text, tab.id).toContain(tab.name);
      expect(text, tab.id).toContain("Valuation Date 28-Oct-2026");
      expect(pages.at(-1)!.text, tab.id).toContain(`Page ${pages.length} Of ${pages.length}`);
      expect(text, tab.id).not.toMatch(/NaN|undefined|\d\.\d{4,}/);
    }
  });

  test("Excel: one sheet per tab in tab order plus Audit, no frozen panes or filters, gridlines off", async ({ page, inputs }) => {
    await runDefault(page, inputs);
    fs.mkdirSync("test-results/downloads", { recursive: true });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-excel").click()]);
    const file = `test-results/downloads/round11-${download.suggestedFilename()}`;
    await download.saveAs(file);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((s) => s.name)).toEqual([...EXPORT_TABS.map((t) => t.name), "Audit"]);
    for (const s of wb.worksheets) {
      expect(s.views.some((v) => v.state === "frozen"), s.name).toBe(false);
      expect(s.views.every((v) => v.showGridLines === false), s.name).toBe(true);
      expect(s.autoFilter ?? null, s.name).toBeNull();
    }
  });
});
