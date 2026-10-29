import { defineConfig, devices } from "@playwright/test";

/**
 * Mock mode by default: scripts/e2e-server.ts runs Next with TEST_MODE=mock against an in-memory Mongo.
 * With BASE_URL set, only the read-only prod project runs against that deployment.
 */
const external = process.env.BASE_URL;
const port = Number(process.env.E2E_PORT ?? 3006);
const ci = Boolean(process.env.CI);

/** Specs that need one engine (Chrome DevTools metrics, pixel baselines) or a live deployment. */
const CHROMIUM_ONLY = [/visual\//, /perf\.spec/, /responsive\//, /market-data\.spec/];
const desktop = { viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" } },
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit-e2e.xml" }],
  ],
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "e2e/visual/__screenshots__/{projectName}/{platform}/{arg}{ext}",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
  },
  projects: external
    ? [
        { name: "prod", testMatch: /(prod-smoke|market-data)\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...desktop } },
        // Read-only layout checks on live data; the screenshots need the mock data, so R8 stays local.
        { name: "prod-responsive", testMatch: /responsive[\\/]r(01|09|10|11)[^\\/]*\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...desktop } },
      ]
    : [
        { name: "chromium", testIgnore: /prod-smoke/, use: { ...devices["Desktop Chrome"], ...desktop } },
        { name: "firefox", testIgnore: [/prod-smoke/, ...CHROMIUM_ONLY], use: { ...devices["Desktop Firefox"], ...desktop } },
        { name: "webkit", testIgnore: [/prod-smoke/, ...CHROMIUM_ONLY], use: { ...devices["Desktop Safari"], ...desktop } },
        { name: "mobile", testIgnore: [/prod-smoke/, ...CHROMIUM_ONLY], use: { ...devices["Pixel 7"] } },
      ],
  webServer: external
    ? undefined
    : {
        command: "npx tsx scripts/e2e-server.ts",
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 240_000,
        env: { E2E_PORT: String(port) },
      },
});
