import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const WORKSTATION = "https://sp-workstation.vercel.app";

// The stand-in parent is a public https origin framing this test server on localhost, which Chromium blocks by default.
test.use({ reducedMotion: "reduce", launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] } });

/** A stand-in for SP Workstation: a page served at its real origin (or another) that frames this app. */
async function framed(page: Page, parentOrigin: string, app: string) {
  await page.route(`${parentOrigin}/frame`, (route) =>
    route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body style="margin:0"><iframe id="app" title="Hedging Sheet" src="${app}/" style="width:100vw;height:100vh;border:0"></iframe></body></html>` }),
  );
  await page.goto(`${parentOrigin}/frame`);
  const frame = page.frameLocator("#app");
  await expect(frame.getByTestId("input-spot")).not.toHaveValue("", { timeout: 30_000 });
  await expect(frame.getByTestId("input-dailyVol")).not.toHaveValue("", { timeout: 30_000 });
  return frame;
}

const post = (page: Page, message: unknown) => page.evaluate((m) => (document.getElementById("app") as HTMLIFrameElement).contentWindow!.postMessage(m, "*"), message);
const frameUrl = (page: Page) => page.evaluate(() => (document.getElementById("app") as HTMLIFrameElement).contentWindow?.location.pathname).catch(() => null);

test.describe("Embed navigation in SP Workstation", () => {
  test("a message from the Workstation changes tab inside the frame, and the run survives with no reload", async ({ page, baseURL }) => {
    const app = page.frameLocator("#app");
    const frame = await framed(page, WORKSTATION, baseURL!);
    await frame.getByTestId("run-simulation").click();
    await expect(app.getByRole("heading", { level: 1, name: "Summary Sheet" })).toBeVisible({ timeout: 30_000 });
    await expect(app.getByTestId("table-summary-headline")).toBeVisible();
    const handle = page.frames().find((f) => f !== page.mainFrame())!;
    await handle.evaluate(() => void ((window as unknown as { sentinel: number }).sentinel = 1));

    for (const [path, heading] of [
      ["/pricer", "Pricer"],
      ["/margin", "Mark To Market And Margin Requirement"],
      ["/summary", "Summary Sheet"],
    ] as const) {
      await post(page, { type: "hedging-sheet:navigate", path });
      await expect(app.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(app.getByTestId("run-gate")).toHaveCount(0);
    }
    expect(await handle.evaluate(() => (window as unknown as { sentinel?: number }).sentinel), "the frame was not reloaded").toBe(1);
  });

  test("a message from any other origin, or with any other path, does nothing", async ({ page, baseURL }) => {
    await framed(page, "https://evil.example", baseURL!);
    await post(page, { type: "hedging-sheet:navigate", path: "/pricer" });
    await page.waitForTimeout(800);
    expect(await frameLocation(page)).toBe("/");
  });

  test("the Workstation cannot send the frame to a path outside the app's routes", async ({ page, baseURL }) => {
    await framed(page, WORKSTATION, baseURL!);
    for (const path of ["/api/health", "/pricer/", "//evil.example", "javascript:alert(1)"]) await post(page, { type: "hedging-sheet:navigate", path });
    await page.waitForTimeout(800);
    expect(await frameLocation(page)).toBe("/");
  });

  test("framed at 768 by 1024 the footer ends inside the frame, nothing clipped", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const app = page.frameLocator("#app");
    await framed(page, WORKSTATION, baseURL!);
    const report = await app.getByTestId("desk-footer").evaluate((footer) => {
      const cells = [...footer.querySelectorAll(".footer-cell")].filter((c) => c.getBoundingClientRect().width > 0);
      return {
        windowWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        rightmost: Math.max(...cells.flatMap((c) => [...c.children].map((e) => e.getBoundingClientRect().right))),
        cellCount: cells.length,
      };
    });
    expect(report.cellCount).toBe(8);
    expect(report.pageWidth).toBeLessThanOrEqual(report.windowWidth);
    expect(report.rightmost).toBeLessThanOrEqual(report.windowWidth);
  });
});

async function frameLocation(page: Page) {
  const frame = page.frames().find((f) => f !== page.mainFrame())!;
  return new URL(frame.url()).pathname;
}
