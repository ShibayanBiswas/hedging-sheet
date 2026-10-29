import { expect, test } from "./fixtures";
import { TAB_IDS } from "./pages";
import { footerRightGap, inputsBottomGap, longTableProblems, stickyLeftCells, tintedBackgrounds, WIDTHS, wrappedCells } from "./support/layout";

const PAGES = TAB_IDS.filter((t) => t !== "inputs");

for (const width of WIDTHS) {
  test.describe(`layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: "reduce" });

    test("white surfaces, single line cells, no pinned columns, scroll boxes and tight gaps on every tab", async ({ page, inputs, nav }) => {
      test.setTimeout(240_000);
      await inputs.goto("default");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(await inputsBottomGap(page), "gap under Inputs before Run").toBeLessThanOrEqual(24);
      expect(await footerRightGap(page), "space right of the footer").toBeLessThanOrEqual(24);
      expect(await tintedBackgrounds(page), "Inputs backgrounds").toEqual([]);

      await inputs.run();
      for (const tab of PAGES) {
        await nav.go(tab);
        await page.waitForTimeout(300);
        expect(await stickyLeftCells(page), `${tab}: pinned cells`).toEqual([]);
        expect((await wrappedCells(page)).slice(0, 10), `${tab}: wrapped cells`).toEqual([]);
        expect((await tintedBackgrounds(page)).slice(0, 10), `${tab}: backgrounds`).toEqual([]);
        expect(await longTableProblems(page), `${tab}: long tables`).toEqual([]);
      }

      await nav.go("inputs");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(await inputsBottomGap(page), "gap under Inputs after Run").toBeLessThanOrEqual(24);
    });
  });
}
