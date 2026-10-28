import { expect, test } from "../fixtures";
import { TAB_IDS } from "../pages";
import { masks, settle } from "./helpers";
import { contextFor, VIEWPORTS } from "./viewports";

/** R8: every page at every viewport in both themes. Baselines are per platform; update with npm run e2e:responsive:update. */
for (const v of VIEWPORTS) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${v.name} ${theme}`, () => {
      test.use({ ...contextFor(v), reducedMotion: "reduce" });

      test(`visual baselines R8 ${v.name} ${theme} every page after a run`, async ({ page, inputs, nav }) => {
        test.setTimeout(240_000);
        await inputs.goto();
        if (theme === "dark") await nav.themeToggle.click();
        await inputs.run();
        await expect(page.getByTestId("desk-toast")).toHaveCount(0, { timeout: 15_000 });
        for (const id of TAB_IDS) {
          await nav.go(id);
          await page.evaluate(() => window.scrollTo(0, 0));
          await settle(page);
          await expect(page).toHaveScreenshot(`r8-${v.name}-${theme}-${id}.png`, { mask: masks(page) });
        }
      });
    });
  }
}
