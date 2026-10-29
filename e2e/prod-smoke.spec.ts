import { expect, test } from "@playwright/test";

import { InputsPage, NavBar, TAB_IDS, outputPages } from "./pages";

/**
 * Read-only checks against a live deployment: BASE_URL=https://hedging-sheet.vercel.app npm run e2e:prod.
 * Nothing is uploaded or saved, so the desk database is never written.
 */
test.skip(!process.env.BASE_URL, "Set BASE_URL to the deployment under test.");

test("every page loads and the live close fills Inputs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const inputs = new InputsPage(page);
  await inputs.goto();
  await expect(page.getByTestId("footer-market-status")).toContainText(/Market (Open|Pre Open|Closed|Holiday|Weekend)/);
  const nav = new NavBar(page);
  for (const id of TAB_IDS) await nav.go(id);
  expect(errors).toEqual([]);
});

test("Default Values runs and every output tab shows results", async ({ page }) => {
  const inputs = new InputsPage(page);
  await inputs.goto();
  await inputs.run();
  for (const out of Object.values(outputPages(page))) {
    await out.open();
    await out.expectResults();
  }
});

test("Blank Inputs blocks the run with the grouped popup", async ({ page }) => {
  const inputs = new InputsPage(page);
  await inputs.goto("blank");
  await inputs.expectValidationDialog({ contains: ["Underlying And Market"] });
  await inputs.dialog.dismissAll();
  await expect(inputs.field("underlying")).toBeFocused();
});

test("read-only APIs answer", async ({ request }) => {
  const levels = await (await request.get("/api/market/levels")).json();
  expect(Number(levels.sensexLevel)).toBeGreaterThan(0);
  const dataset = await (await request.get("/api/dataset")).json();
  expect(dataset.surface?.expiries?.length ?? 0).toBeGreaterThan(0);
});

test("health: the database is connected and holds only the reference collections", async ({ request }) => {
  const res = await request.get("/api/health");
  const text = await res.text();
  expect(res.status(), text).toBe(200);
  const health = JSON.parse(text);
  expect(health.database.connected).toBe(true);
  expect(Object.keys(health.database.collections).sort()).toEqual(["pricing_params", "vol_surfaces"]);
  expect(health.database.collections.vol_surfaces).toBeGreaterThan(0);
  expect(health.market.latestCloseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  if (/hedging-sheet\.vercel\.app/.test(process.env.BASE_URL ?? "")) expect(health.database.name).toBe("hedging_sheet");
  expect(text).not.toMatch(/mongodb(\+srv)?:\/\//);
});

test("writes without the Desk Key are refused", async ({ request }) => {
  expect((await request.post("/api/surface", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/params", { data: {} })).status()).toBe(401);
});
