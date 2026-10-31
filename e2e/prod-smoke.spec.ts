import { expect, test } from "@playwright/test";

import { InputsPage } from "./pages";

/**
 * Five read-only checks against BASE_URL. Nothing is uploaded or saved.
 *   BASE_URL=https://hedging-sheet.vercel.app npm run test:prod
 */
test.skip(!process.env.BASE_URL, "Set BASE_URL to the deployment under test.");

test("health endpoint", async ({ request }) => {
  const res = await request.get("/api/health");
  const text = await res.text();
  expect(res.status(), text).toBe(200);
  const health = JSON.parse(text) as { status: string; database: { connected: boolean; name?: string } };
  expect(health.status).toBe("ok");
  expect(health.database.connected).toBe(true);
  expect(text).not.toMatch(/mongodb(\+srv)?:\/\//);
});

test("the app loads", async ({ page }) => {
  const inputs = new InputsPage(page);
  await inputs.goto();
  await expect(inputs.heading).toBeVisible();
  await expect(inputs.runButton).toBeVisible();
});

test("Run works", async ({ page }) => {
  const inputs = new InputsPage(page);
  await inputs.goto();
  await inputs.run();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.getByTestId("run-gate")).toHaveCount(0);
});

test("one Excel download", async ({ page }) => {
  const inputs = new InputsPage(page);
  await inputs.goto();
  await inputs.run();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-excel").click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});

test("writes without the Desk Key are refused", async ({ request }) => {
  expect((await request.post("/api/surface", { data: {} })).status()).toBe(401);
});
