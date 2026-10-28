import blankFill from "../tests/fixtures/blank-valid-fill.json";
import { expect, test } from "./fixtures";

const FILL = blankFill.fill as [string, string][];

test.describe("Blank Inputs mode", () => {
  test("every field starts empty with an Eg placeholder and selects ask to choose", async ({ inputs, page }) => {
    await inputs.goto("blank");
    await expect(page.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true");
    for (const id of ["spot", "nbfcRate", "coupon", "decay", "tenorDays", "notionalCr", "dailyVol", "stressSigmas"]) {
      await expect(inputs.field(id)).toHaveValue("");
      await expect(inputs.field(id)).toHaveAttribute("placeholder", /^Eg /);
    }
    await expect(inputs.field("valuationDate")).toHaveValue("");
    for (const id of ["underlying", "optionType", "expiryCount"]) {
      await expect(inputs.field(id).locator("option:checked")).toHaveText(/^Select/);
    }
    await expect(page.locator('[data-testid^="input-expiryMonths-"]')).toHaveCount(0);
    await expect(page.getByTestId("expiry-weekday")).toContainText("-");
    await expect(inputs.resetButton).toHaveText(/Clear All Inputs/);
  });

  test("the expiry count adds that many empty month rows with dates shown as -", async ({ inputs, page }) => {
    await inputs.goto("blank");
    await inputs.fill("expiryCount", "3");
    await expect(page.locator('[data-testid^="input-expiryMonths-"]')).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(page.getByTestId(`expiry-date-${i}`)).toHaveText("-");
    await inputs.fill("underlying", "Sensex");
    await inputs.fill("valuationDate", "2026-10-28");
    await inputs.fill("expiryMonths-0", "41");
    await expect(page.getByTestId("expiry-date-0")).not.toHaveText("-");
  });

  test("Fetch Live Spot and Compute Volatility fill only their own fields", async ({ inputs, page }) => {
    await inputs.goto("blank");
    await inputs.fill("underlying", "Sensex");
    await page.getByTestId("fetch-live-spot").click();
    await expect(inputs.field("spot")).toHaveValue("76835.78");
    await expect(page.getByTestId("fetch-live-spot-done")).toBeVisible();
    await expect(inputs.field("coupon")).toHaveValue("");
    await expect(inputs.field("dailyVol")).toHaveValue("");
    await page.getByTestId("compute-volatility").click();
    await expect(inputs.field("dailyVol")).not.toHaveValue("");
    await expect(inputs.field("nbfcRate")).toHaveValue("");
  });

  test("Run with empty fields lists them by section and focuses the first", async ({ inputs, page }) => {
    await inputs.goto("blank");
    await inputs.expectValidationDialog({ contains: ["Underlying And Market", "Underlying", "Rates", "Product Terms"] });
    await inputs.dialog.action("go-to-first-field");
    await expect(inputs.field("underlying")).toBeFocused();
    await expect(inputs.field("underlying")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
  });

  test("closing the validation popup focuses the first invalid field", async ({ inputs }) => {
    await inputs.goto("blank");
    await inputs.fillAll(FILL.filter(([id]) => id !== "input-coupon"));
    await inputs.dialog.dismissAll();
    await inputs.expectValidationDialog({ count: 1, contains: ["Coupon"] });
    await inputs.dialog.ok.click();
    await expect(inputs.field("coupon")).toBeFocused();
  });

  test("a complete fill runs, and a later edit brings the gate back", async ({ inputs, nav, outputs }) => {
    await inputs.goto("blank");
    await inputs.fillAll(FILL);
    await inputs.dialog.dismissAll();
    await inputs.run();
    await outputs.summary.expectResults();
    await expect(outputs.summary.table("summary-headline")).toContainText("Actual Inbuilt");
    await nav.go("inputs");
    await inputs.fill("coupon", "101");
    await inputs.dialog.dismissAll();
    await outputs.summary.open();
    await outputs.summary.expectGate();
    await expect(outputs.summary.staleBanner).toContainText("Inputs Changed");
  });

  test("switching mode asks first, then clears inputs and results", async ({ inputs, nav, outputs, page }) => {
    await inputs.goto();
    await inputs.run();
    await nav.go("inputs");
    await page.getByTestId("mode-blank").click();
    await inputs.dialog.expectTitle("Switch Mode And Clear Results");
    await inputs.dialog.ok.click();
    await expect(page.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
    await inputs.setMode("blank");
    await expect(inputs.field("spot")).toHaveValue("");
    await outputs.summary.open();
    await outputs.summary.expectGate();
    await nav.go("inputs");
    await inputs.setMode("default");
    await expect(inputs.field("spot")).toHaveValue("76835.78");
  });
});
