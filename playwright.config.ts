import { defineConfig, devices } from "@playwright/test";

const external = process.env.BASE_URL;
const port = 3006;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/playwright",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: external
    ? undefined
    : {
        command: `npx next dev --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 180_000,
        // Uploads in the smoke run go to a scratch database, never the live desk surface.
        env: { MONGODB_DB: "hedging_sheet_e2e" },
      },
});
