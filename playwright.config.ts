import { defineConfig, devices } from "@playwright/test";

/**
 * Mock mode by default: scripts/e2e-server.ts runs Next with TEST_MODE=mock against an in-memory Mongo.
 * With BASE_URL set, only the read-only prod project runs against that deployment.
 */
const external = process.env.BASE_URL;
/** Protected preview deployments need Vercel's automation bypass; the secret comes from the environment only. */
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const port = Number(process.env.E2E_PORT ?? 3006);
const ci = Boolean(process.env.CI);

/** Specs that need one engine (Chrome DevTools metrics, pixel baselines) or a live deployment. */
const CHROMIUM_ONLY = [/visual\//, /perf\.spec/, /responsive\//, /market-data\.spec/, /layout\.spec/, /numbers\.spec/, /buttons\.spec/, /pipeline\//];
const desktop = { viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" } },
  fullyParallel: false,
  // One browser at a time, locally and in each CI shard, so a laptop does not collect a browser per file.
  workers: 1,
  globalTeardown: "./e2e/global-teardown.ts",
  retries: ci ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit-e2e.xml" }],
  ],
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "e2e/visual/__screenshots__/{projectName}/{platform}/{arg}{ext}",
  // Baselines are Linux only, made and compared in CI, so font rendering on other systems never fails them.
  ignoreSnapshots: process.platform !== "linux",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : undefined,
  },
  projects: external
    ? [
        { name: "prod", testMatch: /prod-smoke\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...desktop } },
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
        // A second local run attaches to the server already on this port instead of starting another Next and Mongo.
        reuseExistingServer: !ci,
        timeout: 240_000,
        // SIGTERM lets e2e-server stop the in-memory database. The default is SIGKILL, which skips that cleanup.
        gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
        env: { E2E_PORT: String(port) },
      },
});
