import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import invalidCases from "../../tests/fixtures/invalid-cases.json";
import { defaultInputs } from "../../lib/engine/defaults";
import { MOCK_SPOTS } from "../../lib/test/mocks/yahoo";
import { correctExpiryDate, correctNumber, correctValuationDate } from "../../lib/validation/corrections";

/** What lib/validation/corrections makes of a value typed into Default Values at the mock close. */
function expectedFix(id: string, typed: string): { value: number | string | null; note: string } {
  const inputs = defaultInputs({ valuationDate: "2026-10-28", spot: MOCK_SPOTS["^BSESN"] });
  const ctx = { today: "2026-10-28", spot: MOCK_SPOTS["^BSESN"] };
  if (id === "input-valuationDate") return correctValuationDate(inputs, typed, ctx)!;
  const expiry = /^input-expiryDates-(\d+)$/.exec(id);
  if (expiry) return correctExpiryDate(inputs, Number(expiry[1]), typed);
  const percent = id === "input-protection" || id === "input-coupon";
  const field = id.replace(/^input-/, "").replace("-", ".");
  return correctNumber(inputs, field, Number(typed) / (percent ? 100 : 1), ctx)!;
}
import { expect, test } from "../fixtures";
import { restoreMarketFixtures } from "../support/market";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const OUT = path.join("test-results", "downloads");

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test.describe("Default Values mode", () => {
  test("loads the mock close, today and the calculated volatility", async ({ inputs, page, footer }) => {
    await inputs.goto();
    await expect(page.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
    await expect(inputs.field("underlying")).toHaveValue("Sensex");
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
    await expect(inputs.field("spot")).toHaveValue("76,835.78");
    await expect(page.getByTestId("daily-vol-status")).toContainText("Calculated");
    await expect(page.getByTestId("expiry-weekday")).toContainText("Thursday");
    await expect(page.getByTestId("fetch-live-spot")).toHaveCount(0);
    await expect(page.getByTestId("compute-volatility")).toHaveCount(0);
    await expect(footer.marketStatus).toContainText(/Market\s*Open/);
    await expect(footer.sensex).toContainText("76,835.78");
  });

  test("output tabs show the run gate, then results after a run, without console errors", async ({ inputs, nav, outputs, consoleErrors }) => {
    await inputs.goto();
    for (const out of Object.values(outputs)) {
      await out.open();
      await out.expectGate();
    }
    await nav.go("market-data");
    await expect(outputs.summary.gate).toHaveCount(0);
    await nav.go("inputs");
    await inputs.run();
    for (const out of Object.values(outputs)) {
      await out.open();
      await out.expectResults();
    }
    expect(consoleErrors).toEqual([]);
  });

  test("a changed input brings the gate back with Inputs Changed", async ({ inputs, nav, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await expect(outputs.summary.table("summary-headline")).toContainText("Actual Inbuilt");
    await nav.go("inputs");
    await inputs.fill("coupon", "100");
    await inputs.dialog.dismissAll();
    await outputs.summary.open();
    await outputs.summary.expectGate();
    await expect(outputs.summary.staleBanner).toContainText("Inputs Changed");
  });

  test("a Pricer volatility override keeps results and shows the banner", async ({ inputs, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.pricer.open();
    await outputs.pricer.gridCell(0).fill("30");
    await outputs.pricer.gridCell(0).blur();
    await expect(outputs.pricer.staleBanner).toBeVisible();
    await expect(outputs.pricer.gate).toHaveCount(0);
    await outputs.pricer.resetLegVols.click();
    await expect(outputs.pricer.resetLegVols).toHaveCount(0);
  });

  test("Nifty renames every label and moves the expiry weekday", async ({ inputs, nav, outputs, page }) => {
    await inputs.goto();
    await inputs.fill("underlying", "Nifty");
    await expect(nav.underlyingBadge).toHaveText("Nifty");
    await expect(page.getByTestId("expiry-weekday")).toContainText("Tuesday");
    await expect(inputs.field("spot")).toHaveValue("23,500.00");
    await inputs.run();
    for (const out of Object.values(outputs)) {
      await out.open();
      await expect(page.locator("main")).toContainText("Nifty");
      await expect(page.locator("main")).not.toContainText("Sensex");
    }
  });

  // A value that breaks a rule is corrected on leaving the field, with a note under it: no popup, and Run stays on.
  for (const c of invalidCases.cases.filter((c) => c.fill.length)) {
    test(`invalid input is corrected with a note and never blocks the run: ${c.name}`, async ({ inputs, page }) => {
      await inputs.goto();
      const [id, typed] = c.fill[0]!;
      const expected = expectedFix(id!, typed!);
      await inputs.fill(id!, typed!);
      const expiry = /^input-expiryDates-(\d+)$/.exec(id!);
      await expect(page.getByTestId(expiry ? `expiry-note-${expiry[1]}` : `note-${id!.replace(/^input-/, "")}`)).toHaveText(expected.note);
      if (typeof expected.value === "number") expect(Number(await page.getByTestId(id!).getAttribute("data-value"))).toBeCloseTo(expected.value, 9);
      if (typeof expected.value === "string") await expect(page.getByTestId(id!)).toHaveAttribute("data-value", expected.value);
      await expect(page.getByTestId(id!)).not.toHaveAttribute("aria-invalid", "true");
      await expect(inputs.dialog.root).toHaveCount(0);
      await expect(inputs.runButton).toBeEnabled();
    });
  }

  test("corrected values run straight away", async ({ inputs, outputs }) => {
    await inputs.goto();
    await inputs.fill("input-strikePercents-2", "128");
    await inputs.fill("input-floorUnits", "2");
    await inputs.fill("input-participations-1", "2");
    await inputs.run();
    await outputs.summary.expectResults();
  });

  test("spreads follow the strikes and participation resets to calculated", async ({ inputs, page }) => {
    await inputs.goto();
    await expect(page.getByTestId("max-coupon")).toContainText("102.50%");
    await expect(page.getByTestId("spread-1-participation-status")).toContainText("Calculated");
    // Only the rate that reaches the Coupon exactly can be typed into the top spread: it pins it, Edited. The field shows
    // 10.05 already, so it is typed as 10.050 to be an edit.
    await inputs.fill("participations-1", "10.050");
    await expect(page.getByTestId("spread-1-participation-status")).toContainText("Edited");
    await page.getByTestId("spread-1-reset").click();
    await expect(page.getByTestId("spread-1-participation-status")).toContainText("Calculated");
    await page.getByTestId("input-spreadCount-plus").click();
    await expect(page.getByTestId("spread-card-2")).toBeVisible();
    await page.getByTestId("input-spreadCount-minus").click();
    await expect(page.getByTestId("spread-card-2")).toHaveCount(0);
  });

  test("Excel download after a run has one title-case sheet per tab, the Audit sheet and no pivots", async ({ inputs, nav }) => {
    await inputs.goto();
    await expect(nav.downloadExcel).toBeDisabled();
    await inputs.run();
    const [download] = await Promise.all([nav.downloadExcel.page().waitForEvent("download"), nav.downloadExcel.click()]);
    expect(download.suggestedFilename()).toMatch(/^SP-Hedging-Sheet-Sensex-28-Oct-2026\.xlsx$/);
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);
    expect(fs.readFileSync(file).toString("latin1").includes("pivotTable")).toBe(false);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Inputs", "Summary Sheet", "Pricer", "Product Description", "Day 1 Vega Hedge", "Mark To Market", "Market Data", "Logic Atlas", "Audit"]);
  });

  test("Product payoff reads the client return at a typed move", async ({ inputs, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await outputs.product.open();
    await expect(outputs.product.table("pd-greeks")).toContainText("Residual Futures To Be Done");
    await expect(outputs.product.table("pd-payoff")).toContainText("Initial");
    await outputs.product.payoffMove.fill("-20");
    await expect(outputs.product.payoffReturn).toContainText(/[-−]32\.00%/);
  });
});

test.describe("Market Data", () => {
  test.afterEach(async ({ request }) => {
    await restoreMarketFixtures(request);
  });

  test("surface edit validates cells, and the surface downloads in the upload layout", async ({ inputs, marketData, dialog }) => {
    await inputs.goto();
    await marketData.open();
    await marketData.editSurface.click();
    const cell = marketData.volCell(1);
    await cell.fill("abc");
    await expect(cell).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.root).toHaveCount(0);
    await expect(marketData.saveSurface).toBeDisabled();
    await marketData.discardSurface.click();
    await expect(marketData.editSurface).toBeVisible();
    const [download] = await Promise.all([marketData.downloadSurface.page().waitForEvent("download"), marketData.downloadSurface.click()]);
    expect(download.suggestedFilename()).toMatch(/^Hedging_Sheet_Vol_Surface_2026-10\.xlsx$/);
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Vol Surface", "Surface Parameters", "Rate Curve", "Dividends"]);
  });

  test("surface parameters save for the month and reset", async ({ inputs, marketData, dialog, page }) => {
    await inputs.goto();
    await marketData.open();
    await marketData.editParams.click();
    await marketData.param("param-cap-buying").fill("6.9");
    await marketData.param("param-cap-buying").blur();
    await marketData.saveParams.click();
    await marketData.enterDeskKey();
    await expect(page.getByTestId("desk-toast").or(dialog.root).first()).toContainText(/Saved/);
    await dialog.dismissAll();
    await expect(marketData.paramsTable).toContainText("6.90%");
    await expect(page.getByTestId("params-status")).toContainText("Saved To Desk Database");
    await page.reload();
    await expect(marketData.paramsTable).toContainText("6.90%", { timeout: 30_000 });
    await marketData.resetParams.click();
    await dialog.dismissAll();
  });

  test("surface upload with the sample file: preview, confirm, then an inline status and no popup", async ({ inputs, marketData, dialog, page }) => {
    await inputs.goto();
    await marketData.open();
    await marketData.surfaceFile.setInputFiles(path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx"));
    await marketData.enterDeskKey();
    const preview = page.getByTestId("upload-preview");
    await expect(preview).toContainText("Hedging_Sheet_Vol_Surface_Sample.xlsx", { timeout: 30_000 });
    await expect(page.getByTestId("table-upload-preview")).toContainText("18");
    await page.getByTestId("confirm-upload").click();
    await expect(page.getByTestId("market-status")).toContainText("Saved To Desk Database", { timeout: 30_000 });
    await expect(preview).toHaveCount(0);
    await expect(dialog.root).toHaveCount(0);
    // Phones show "Apr 31"; the full date is in the title at every width.
    await expect(marketData.volGrid.locator('td[title="24-Apr-2031"]')).toHaveCount(1);
  });

  test("a save asks for the Desk Key, refuses a wrong one, and Cancel saves nothing", async ({ inputs, marketData, page }) => {
    await inputs.goto();
    await marketData.open();
    await marketData.editParams.click();
    await marketData.param("param-cap-buying").fill("7.1");
    await marketData.param("param-cap-buying").blur();
    await marketData.saveParams.click();
    await page.getByTestId("desk-key-input").fill("wrong key");
    await page.getByTestId("desk-key-submit").click();
    await expect(page.getByTestId("desk-key-dialog")).toContainText("That Desk Key is not right");
    await page.getByTestId("desk-key-cancel").click();
    await expect(page.getByTestId("desk-key-dialog")).toBeHidden();
    await expect(page.getByTestId("desk-toast")).toHaveCount(0);
    const stored = await (await page.request.get("/api/params")).json();
    expect(stored.params.rateCapBuyingForward).not.toBeCloseTo(0.071, 6);
  });
});
