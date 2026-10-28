import { fillBlank } from "../blank/helpers";
import { expect, test } from "../fixtures";
import { TAB_IDS } from "../pages";
import { audit } from "./audit";
import { settle } from "./helpers";

const layoutOnly = (lines: string[]) => lines.filter((l) => /: R[123] /.test(l));

test.describe("R10 200% zoom on a 1440 by 900 desktop", () => {
  // Browser zoom halves the CSS viewport and doubles the device pixel ratio.
  test.use({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });

  for (const mode of ["default", "blank"] as const) {
    test(`R1 to R3 hold on every page in ${mode} mode`, async ({ page, inputs, nav }) => {
      test.setTimeout(240_000);
      if (mode === "blank") await fillBlank(inputs);
      else await inputs.goto();
      await inputs.run();
      const found: string[] = [];
      for (const id of TAB_IDS) {
        await nav.go(id);
        await settle(page);
        found.push(...layoutOnly(await audit(page, `zoom 200% ${mode} ${id}`, { touch: false, headingsOneLine: false })));
      }
      expect(found, found.join("\n")).toEqual([]);
    });
  }
});

for (const [name, viewport, touch] of [
  ["phone", { width: 375, height: 667 }, true],
  ["desktop", { width: 1440, height: 900 }, false],
] as const) {
  test.describe(`R10 reduced motion on a ${name}`, () => {
    test.use({ viewport, hasTouch: touch, reducedMotion: "reduce" });

    test("R1 to R3 hold on every page after a run", async ({ page, inputs, nav }) => {
      test.setTimeout(240_000);
      await inputs.goto();
      await inputs.run();
      const found: string[] = [];
      for (const id of TAB_IDS) {
        await nav.go(id);
        await settle(page);
        found.push(...layoutOnly(await audit(page, `reduced motion ${name} ${id}`, { touch, headingsOneLine: false })));
      }
      expect(found, found.join("\n")).toEqual([]);
    });
  });
}
