import { fillBlank } from "../blank/helpers";
import { expect, test } from "../fixtures";
import { TAB_IDS } from "../pages";
import { audit, headingLines, label } from "./audit";
import { settle } from "./helpers";
import { contextFor, VIEWPORTS } from "./viewports";

for (const v of VIEWPORTS) {
  test.describe(`${v.name} ${v.width}x${v.height}`, () => {
    test.use(contextFor(v));

    for (const mode of ["default", "blank"] as const) {
      test(`R1 to R7 on every page in ${mode} mode after a run`, async ({ page, inputs, nav }) => {
        test.setTimeout(300_000);
        if (mode === "blank") await fillBlank(inputs);
        else await inputs.goto();
        await inputs.run();
        const found: string[] = [];
        for (const id of TAB_IDS) {
          await nav.go(id);
          await page.evaluate(() => window.scrollTo(0, 0));
          await settle(page);
          found.push(...(await audit(page, `${label(v, mode)} ${id}`, { touch: v.kind !== "desktop", headingsOneLine: v.width === 1280 })));
        }
        expect(found, found.join("\n")).toEqual([]);
      });
    }
  });
}

test.describe("360 px", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("R7 every heading takes at most two lines", async ({ page, inputs, nav }) => {
    await inputs.goto();
    await inputs.run();
    const found: string[] = [];
    for (const id of TAB_IDS) {
      await nav.go(id);
      await settle(page);
      found.push(...(await headingLines(page, id)));
    }
    expect(found, found.join("\n")).toEqual([]);
  });
});
