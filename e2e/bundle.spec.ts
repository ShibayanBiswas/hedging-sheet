import { expect, test } from "./fixtures";
import { TAB_IDS, type TabId } from "./pages/nav-bar";

/** First load JavaScript, as sent over the wire (gzip or brotli), must stay under 250 KB on every tab. */
const BUDGET_BYTES = 250 * 1024;
const PATHS: Record<TabId, string> = {
  inputs: "/",
  summary: "/summary",
  pricer: "/pricer",
  product: "/product",
  "vega-hedge": "/vega-hedge",
  margin: "/margin",
  "market-data": "/market-data",
  "logic-atlas": "/logic-atlas",
};

/** Sizes only hold on a production build (E2E_PROD=1); the dev server ships unminified code. */
test.skip(process.env.E2E_PROD !== "1" && !process.env.BASE_URL, "Needs a production build");

for (const tab of TAB_IDS) {
  test(`Bundle · ${tab}: first load JavaScript under 250 KB compressed`, async ({ page }) => {
    const scripts: Array<Promise<{ url: string; bytes: number }>> = [];
    page.on("requestfinished", (req) => {
      if (req.resourceType() !== "script") return;
      scripts.push(req.sizes().then((s) => ({ url: req.url(), bytes: s.responseBodySize + s.responseHeadersSize })));
    });
    await page.goto(PATHS[tab]);
    await page.waitForLoadState("networkidle");
    const loaded = await Promise.all(scripts);
    const total = loaded.reduce((a, s) => a + s.bytes, 0);
    test.info().annotations.push({ type: "first load JS", description: `${(total / 1024).toFixed(1)} KB in ${loaded.length} files` });
    const largest = [...loaded].sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((s) => `${(s.bytes / 1024).toFixed(1)} KB ${new URL(s.url).pathname}`);
    expect(total, `largest: ${largest.join("; ")}`).toBeLessThan(BUDGET_BYTES);
  });
}
