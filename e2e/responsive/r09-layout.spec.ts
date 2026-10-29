import { fillBlank } from "../blank/helpers";
import { expect, test } from "../fixtures";
import { settle } from "./helpers";
import { contextFor, VIEWPORTS } from "./viewports";

const expectedColumns = (width: number) => (width >= 1920 ? 4 : width >= 1280 ? 3 : width >= 640 ? 2 : 1);

for (const v of VIEWPORTS) {
  test.describe(`${v.name} ${v.width}x${v.height}`, () => {
    test.use(contextFor(v));

    test("R9 and layout: mode switch, sticky run bar, field grid, section tabs, footer and table scrolling", async ({ page, inputs, nav }) => {
      test.setTimeout(180_000);
      await inputs.goto();
      await settle(page);
      const inView = (box: { y: number; height: number } | null) => box != null && box.y >= -1 && box.y + box.height <= v.height + 1;

      await expect(page.getByTestId("mode-switch")).toBeVisible();
      expect(inView(await inputs.runButton.boundingBox()), "Run Simulation in view at the top").toBe(true);

      // R9: the run bar stays in view while the form scrolls.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await settle(page);
      expect(inView(await inputs.runButton.boundingBox()), "Run Simulation in view halfway down").toBe(true);

      // Input sections: one column on phones, two on tablets, three on desktop, four on wide screens.
      const columns = await page.locator(".field-grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      expect(columns, "field grid columns").toBe(expectedColumns(v.width));

      // Section tabs: the full pill bar from 1024 px; below that the bar scrolls sideways.
      const rail = await page.locator("nav .nav-pill-shell").evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      if (v.width >= 1024) expect(rail.scroll, "every tab visible from 1024 px").toBeLessThanOrEqual(rail.client + 1);

      // The footer: two lines on phones, fully visible at the end of the page, never covered.
      if (v.kind === "phone") {
        const rows = await page.getByTestId("desk-footer").evaluate((el) => {
          const boxes = Array.from(el.querySelectorAll<HTMLElement>("[data-testid^='footer-']"))
            .map((n) => n.getBoundingClientRect())
            .filter((r) => r.height > 0)
            .sort((a, b) => a.top - b.top);
          let count = 0;
          let bottom = -Infinity;
          for (const r of boxes) {
            if (r.top >= bottom - 1) count += 1;
            bottom = Math.max(bottom, r.bottom);
          }
          return count;
        });
        expect(rows, "footer lines on a phone").toBeLessThanOrEqual(2);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await settle(page);
      const footer = await page.getByTestId("desk-footer").evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12));
        return { top: r.top, bottom: r.bottom, uncovered: Boolean(hit && el.contains(hit)) };
      });
      expect(footer.bottom, "footer ends inside the window").toBeLessThanOrEqual(v.height + 1);
      expect(footer.uncovered, "nothing covers the footer").toBe(true);

      // R9: a wide table scrolls sideways inside its own box, whole; no column is pinned and the page never scrolls sideways.
      await inputs.run();
      await nav.go("pricer");
      const rails = page.locator('[data-testid="table-pricer-legs"] .desk-table-scroll');
      await rails.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await settle(page);
      const scrolled = await rails.evaluate((el) => {
        const cell = el.querySelector<HTMLElement>("tbody td")!;
        return { rail: el.getBoundingClientRect().left, cell: cell.getBoundingClientRect().left, scrolled: el.scrollLeft, sticky: getComputedStyle(cell).position };
      });
      expect(scrolled.sticky, "first column is not pinned").not.toBe("sticky");
      if (scrolled.scrolled > 0) expect(scrolled.cell, "first column scrolls away").toBeLessThan(scrolled.rail - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "no page-level sideways scroll").toBeLessThanOrEqual(0);
    });

    test("popups are bottom sheets on phones and centred dialogs from 640 px", async ({ page, inputs }) => {
      await fillBlank(inputs, ["input-coupon"]);
      await inputs.runButton.click();
      await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
      await settle(page);
      const box = (await inputs.dialog.root.boundingBox())!;
      if (v.width < 640) {
        expect(Math.abs(box.y + box.height - v.height), "sheet sits on the bottom edge").toBeLessThan(2);
        expect(box.height, "sheet is full height").toBeGreaterThan(v.height - 2);
      } else {
        expect(box.y, "dialog is clear of the top").toBeGreaterThan(0);
        expect(box.y + box.height, "dialog is clear of the bottom").toBeLessThan(v.height);
        expect(Math.abs(box.x + box.width / 2 - v.width / 2), "dialog is centred").toBeLessThan(2);
      }
      const scrolls = await page.getByTestId("desk-dialog").evaluate((el) => {
        const body = el.querySelector<HTMLElement>(".overflow-y-auto")!;
        return getComputedStyle(body).overflowY === "auto";
      });
      expect(scrolls, "popup content scrolls inside").toBe(true);
    });
  });
}
