import ExcelJS from "exceljs";

import { expect, test } from "./fixtures";
import { TAB_IDS } from "./pages";
import { downloadExcel } from "./support/excel";

/** Columns and tables taken off the display; the data behind them still prices every leg. */
const REMOVED = ["Used In", "Linked To Premium Growth Rate", "Rate Used", "Pricing Params Forward Grid", "Pricing Parameters By Expiry", "Rate Curve As Read", "Implied Dividends"];

for (const width of [1440, 390] as const) {
  test.describe(`removed columns and tables at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: "reduce" });

    test("no tab shows them, nothing scrolls sideways, and each page ends within 24 px of the footer", async ({ page, inputs, nav }) => {
      test.setTimeout(180_000);
      await inputs.goto("default");
      await inputs.run();
      for (const tab of TAB_IDS) {
        await nav.go(tab);
        await page.waitForTimeout(300);
        const text = await page.locator("body").innerText();
        for (const gone of REMOVED) expect(text, `${tab}: "${gone}"`).not.toContain(gone);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${tab}: sideways scroll`).toBeLessThanOrEqual(0);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const gap = await page.evaluate(() => {
          const footer = document.querySelector<HTMLElement>("[data-testid='desk-footer']")!;
          const main = document.querySelector<HTMLElement>("main")!;
          const bottoms = Array.from(main.querySelectorAll<HTMLElement>("section, [data-testid='run-simulation']")).map((el) => el.getBoundingClientRect().bottom);
          return Math.round(footer.getBoundingClientRect().top - Math.max(...bottoms));
        });
        expect(gap, `${tab}: gap above the footer`).toBeLessThanOrEqual(24);
      }
    });
  });
}

test("the Excel file has no sheet, header or cell with them", async ({ page, inputs }) => {
  test.setTimeout(120_000);
  await inputs.goto("default");
  await inputs.run();
  const { file } = await downloadExcel(page);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const texts: string[] = [];
  wb.eachSheet((ws) => {
    texts.push(ws.name);
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        const v = cell.value;
        if (v == null) return;
        if (typeof v !== "object" || v instanceof Date) texts.push(String(v));
        else if ("richText" in v) texts.push(v.richText.map((t) => t.text).join(""));
        else if ("result" in v) texts.push(String(v.result ?? ""));
      }),
    );
  });
  for (const gone of REMOVED) expect(texts.filter((t) => t.includes(gone)), gone).toEqual([]);
});
