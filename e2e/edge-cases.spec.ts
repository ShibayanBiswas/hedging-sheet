import { expect, test } from "./fixtures";
import { hook } from "./pipeline/helpers";

/** Titles of every popup that opens, closing each in turn. */
async function popupTitles(page: import("@playwright/test").Page): Promise<string[]> {
  const titles: string[] = [];
  const root = page.getByTestId("desk-dialog");
  for (let i = 0; i < 6; i++) {
    try {
      await root.first().waitFor({ state: "visible", timeout: 2_000 });
    } catch {
      break;
    }
    const title = ((await root.first().locator("#desk-dialog-title").textContent()) ?? "").trim();
    titles.push(title);
    await page.getByTestId("desk-dialog-ok").first().click();
    await expect(root.filter({ hasText: title })).toHaveCount(0);
  }
  return titles;
}

test.describe("Edge · Run", () => {
  test("Clicking Run Several Times Fast Runs Once", async ({ page, inputs }) => {
    await inputs.goto();
    expect((await hook(page)).runs).toBe(0);
    await page.getByTestId("run-simulation").evaluate((button: HTMLButtonElement) => {
      for (let i = 0; i < 5; i++) button.click();
    });
    await expect(page).toHaveURL(/\/summary$/, { timeout: 30_000 });
    await inputs.dialog.dismissAll();
    await expect.poll(async () => (await hook(page)).runs).toBe(1);
  });

  test("A Missing Field Shows The Problem Dialog And Stays On Inputs", async ({ inputs }) => {
    await inputs.goto();
    await inputs.clear("coupon");
    await inputs.expectValidationDialog({ contains: ["Coupon: Coupon is required."] });
  });

  test("Changing Inputs During A Run Prices The Inputs As They Stand When It Finishes", async ({ page, inputs }) => {
    await inputs.goto();
    await page.route("**/api/dataset**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await inputs.runButton.click();
    await expect(inputs.runButton).toBeDisabled();
    await inputs.fill("notionalCr", "150");
    await expect(page).toHaveURL(/\/summary$/, { timeout: 30_000 });
    await inputs.dialog.dismissAll();
    const after = await hook(page);
    expect(after.result?.inputs.notionalCr).toBe(150);
    expect(after.stale).toBe(false);
  });

  test("Losing The Network Mid Run Prices On The Loaded Surface And Says So", async ({ page, inputs }) => {
    await inputs.goto();
    await page.route("**/api/dataset**", (route) => route.abort("internetdisconnected"));
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/, { timeout: 30_000 });
    expect(await popupTitles(page)).toContain("Priced On The Loaded Surface");
    expect((await hook(page)).result).not.toBeNull();
  });
});

test.describe("Edge · Goal Seek", () => {
  test("A 100% Premium Growth Rate Shows Could Not Solve With A Reason, And No Result", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.fill("premiumRate", "100");
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Could Not Solve");
    await expect(inputs.dialog.root).toContainText(/Could Not Solve: (no Inbuilt makes|the Inbuilt that pays)/);
    await expect(inputs.dialog.root).toContainText("How To Fix");
    await expect(page).toHaveURL(/\/$/);
    expect((await hook(page)).result).toBeNull();
  });
});

test.describe("Edge · Hedge Strike", () => {
  test("Switching The Underlying After An Override Follows The New Index's Rule", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.fill("hedgeStrike", "90000");
    await expect.poll(async () => (await hook(page)).inputs.hedgeStrike).toBe(90000);
    await inputs.fill("underlying", "Nifty");
    // The Nifty mock close is 23,500: plus 150 is 23,650, rounded up to 23,700.
    await expect.poll(async () => (await hook(page)).inputs.hedgeStrike, { timeout: 30_000 }).toBe(23700);
    expect((await hook(page)).inputs.hedgeStrikeAuto).toBe(true);
  });
});

test.describe("Edge · Volatility", () => {
  test("Editing Daily Then Annual Quickly Keeps The Two In Step", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.field("dailyVol").fill("1.2");
    await inputs.field("annualVol").fill("20");
    await inputs.field("annualVol").blur();
    await expect.poll(async () => (await hook(page)).inputs.dailyVol).toBeCloseTo(0.2 / Math.sqrt(365), 9);
    await expect(inputs.field("annualVol")).toHaveValue(/^20(\.0+)?$/);
  });
});

test.describe("Edge · Expiries", () => {
  test("Going From 10 Down To 1 And Back Up Keeps Expiry 1 And Refills Quarterly From It", async ({ page, inputs }) => {
    await inputs.goto();
    const first = (await hook(page)).inputs.expiryDates[0];
    for (const n of ["10", "1", "10"]) await inputs.fill("expiryCount", n);
    const dates = (await hook(page)).inputs.expiryDates;
    expect(dates).toHaveLength(10);
    expect(dates[0]).toBe(first);
    const month = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
    for (let i = 1; i < 10; i++) expect(month(dates[i]!) - month(dates[i - 1]!), `Expiry ${i + 1}`).toBe(3);
  });
});

test.describe("Edge · Downloads", () => {
  test("Before Run, Excel And The Output Tab PDFs Are Off With The Reason, And Inputs Can Still Be Printed", async ({ page, inputs, nav }) => {
    await inputs.goto();
    await expect(nav.downloadExcel).toBeDisabled();
    await expect(page.getByTestId("download-pdf-inputs")).toBeEnabled();
    await nav.go("summary");
    await expect(page.getByTestId("download-pdf-summary")).toBeDisabled();
    await expect(page.getByTestId("download-pdf-summary")).toHaveAttribute("title", "Run the simulation first");
  });
});
