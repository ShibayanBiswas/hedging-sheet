import { expect, test } from "./fixtures";

/** The mock server stays on 28-Oct-2026; only the browser's clock moves. */
const CLOCKS = [
  { name: "a day ahead", at: "2026-10-29T04:30:00.000Z" },
  { name: "a day behind", at: "2026-10-27T04:30:00.000Z" },
];
const PAGES = ["/", "/pricer", "/summary", "/logic-atlas", "/market-data"];

test.describe("First render when the browser's IST date differs from the server's", () => {
  for (const clock of CLOCKS) {
    test(`no hydration error with the browser's clock ${clock.name}, and the valuation date stays the server's`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(clock.at));
      const errors: string[] = [];
      // WebKit reports a fetch cut short by the next page.goto as an access control failure; the app catches every fetch, and
      // it never asks another origin for anything, so only those are left out.
      page.on("pageerror", (e) => {
        if (!/due to access control checks\.$/.test(e.message)) errors.push(e.message);
      });
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByTestId("strip-valuation")).toHaveText("28-Oct-2026");
        await page.waitForLoadState("networkidle");
      }
      expect(errors).toEqual([]);
    });
  }
});
