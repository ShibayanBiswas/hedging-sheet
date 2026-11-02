import { defineConfig, devices } from "@playwright/test";

/**
 * Mock mode by default: scripts/e2e-server.ts runs Next with TEST_MODE=mock against an in-memory Mongo.
 * With BASE_URL set, only the read-only prod projects run against that deployment.
 */
const external = process.env.BASE_URL;
/** Protected preview deployments need Vercel's automation bypass; the secret comes from the environment only. */
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const port = Number(process.env.E2E_PORT ?? 3006);
const ci = Boolean(process.env.CI);
/** scripts/test-run.ts points this at reports/<timestamp>; plain runs keep the usual folders. */
const reports = process.env.REPORT_DIR;

/**
 * The laptop runs Chromium only on 2 workers with no video. Every browser runs in CI, against Vercel, or locally with
 * PW_FULL=1 (npm run test:local:full); E2E_FULL_WIDTHS=1 adds the other device widths, as test:local:full and test:vercel do.
 */
const full = ci || process.env.PW_FULL === "1";

/** Specs that need one engine (Chrome DevTools metrics, pixel baselines) or a live deployment. */
const CHROMIUM_ONLY = [/visual\//, /perf\.spec/, /responsive\//, /market-data\.spec/, /layout\.spec/, /numbers\.spec/, /pipeline\//];
/** Specs that save to the shared test database: they run alone, after every read-only spec. */
const WRITES = [/market-data\.spec/, /default[\\/](default-mode|parity)\.spec/];
const desktop = { viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", caret: "hide" } },
  fullyParallel: false,
  workers: full ? 1 : 2,
  retries: ci ? 1 : 0,
  globalTeardown: "./e2e/global-teardown.ts",
  reporter: [
    ["list"],
    ["html", { outputFolder: reports ? `${reports}/playwright-html` : "playwright-report", open: "never" }],
    ["junit", { outputFile: reports ? `${reports}/junit-e2e.xml` : "test-results/junit-e2e.xml" }],
  ],
  outputDir: reports ? `${reports}/traces` : "test-results/playwright",
  snapshotPathTemplate: "e2e/visual/__screenshots__/{projectName}/{platform}/{arg}{ext}",
  // Baselines are Linux only, made and compared in CI, so font rendering on other systems never fails them.
  ignoreSnapshots: process.platform !== "linux",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    video: full ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    acceptDownloads: true,
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : undefined,
  },
  projects: external
    ? [
        { name: "prod", testMatch: /prod-smoke\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...desktop } },
        // npm run test:prod is the five smoke checks alone; npm run test:vercel runs every project here.
        { name: "prod-live", testMatch: /(market-data|strikes|crawl)\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...desktop } },
        { name: "prod-firefox", testMatch: /crawl\.spec\.ts/, use: { ...devices["Desktop Firefox"], ...desktop } },
        { name: "prod-webkit", testMatch: /crawl\.spec\.ts/, use: { ...devices["Desktop Safari"], ...desktop } },
        // Read-only layout checks on live data; the screenshots need the mock data, so R8 stays local.
        { name: "prod-responsive", testMatch: /responsive[\\/]r(01|09|10|11)[^\\/]*\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...desktop } },
      ]
    : [
        { name: "chromium", testIgnore: [/prod-smoke/, ...WRITES], use: { ...devices["Desktop Chrome"], ...desktop } },
        { name: "chromium-writes", testMatch: WRITES, workers: 1, dependencies: ["chromium"], use: { ...devices["Desktop Chrome"], ...desktop } },
        ...(full
          ? [
              { name: "firefox", testIgnore: [/prod-smoke/, ...CHROMIUM_ONLY], use: { ...devices["Desktop Firefox"], ...desktop } },
              { name: "webkit", testIgnore: [/prod-smoke/, ...CHROMIUM_ONLY], use: { ...devices["Desktop Safari"], ...desktop } },
              { name: "mobile", testIgnore: [/prod-smoke/, ...CHROMIUM_ONLY], use: { ...devices["Pixel 7"] } },
            ]
          : []),
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
