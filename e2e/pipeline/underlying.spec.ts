import ExcelJS from "exceljs";

import { EXPIRY_WEEKDAY, WEEKDAY_NAMES } from "../../lib/engine/schedule";
import type { Underlying } from "../../lib/engine/types";
import { UNDERLYINGS } from "../../lib/underlyings";
import { expect, test } from "../fixtures";
import { downloadExcel } from "../support/excel";
import { hook } from "./helpers";

/** The mock closes the e2e server answers with. */
const SPOT: Record<Underlying, number> = { Sensex: 76835.78, Nifty: 23500 };

const roundUp = (x: number, step: number) => Math.ceil(x / step - 1e-9) * step;

for (const u of UNDERLYINGS) {
  const other = UNDERLYINGS.find((x) => x !== u)!;

  test(`${u}: everything that depends on the underlying follows it`, async ({ page, inputs, nav }) => {
    test.setTimeout(180_000);
    await inputs.goto("default");
    if (u !== "Sensex") await inputs.fill("input-underlying", u);
    await expect.poll(async () => Number((await inputs.field("spot").inputValue()).replace(/,/g, ""))).toBeCloseTo(SPOT[u], 2);

    const start = roundUp(SPOT[u] * 1.006, 100);
    await expect(inputs.field("strikeLevel-0")).toHaveAttribute("data-value", String(Math.round(start * 1.37)));

    await inputs.run();
    const r = (await hook(page)).result!;
    // Spot, start level, hedge strike and every expiry's weekday.
    expect(r.underlyingLabel).toBe(u);
    expect(r.inputs.spot).toBeCloseTo(SPOT[u], 6);
    expect(r.structure.startLevel).toBe(start);
    // The auto hedge strike: Sensex spot × 1.006, Nifty spot + 150, rounded up to the next 100.
    expect(r.inputs.hedgeStrike).toBe(roundUp(u === UNDERLYINGS[1] ? SPOT[u] * 1.006 : SPOT[u] + 150, 100));
    for (const d of r.schedule.expiries) expect(new Date(`${d}T00:00:00Z`).getUTCDay(), d).toBe(EXPIRY_WEEKDAY[u]);
    // Strikes in points.
    expect(r.structure.strikes[0]!.strike).toBe(Math.round(start * 1.37));

    // Labels on the output tabs.
    await nav.go("product");
    await expect(page.locator("main th", { hasText: `${u} Performance` }).first()).toBeVisible();
    await expect(page.locator("main th", { hasText: `${other} Performance` })).toHaveCount(0);

    // The footer puts this underlying's close first.
    const order = await page.locator('[data-testid="desk-footer"] [data-testid^="footer-"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid));
    expect(order.indexOf(`footer-${u.toLowerCase()}`)).toBeLessThan(order.indexOf(`footer-${other.toLowerCase()}`));

    // The surface anchor on Market Data.
    await nav.go("market-data");
    await expect(page.getByTestId("table-market-headline")).toContainText(`Reference ${u} Price`);

    // The Logic Atlas copy names the underlying and its expiry weekday.
    await nav.go("logic-atlas");
    const atlas = (await page.locator("main").textContent()) ?? "";
    expect(atlas).toContain(u);
    expect(atlas).toContain(WEEKDAY_NAMES[EXPIRY_WEEKDAY[u]]!);
    expect(atlas).not.toContain(`${other} Performance`);

    // The Excel file's text.
    const { file, name } = await downloadExcel(page);
    expect(name).toContain(u);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const text: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => text.push(String(c.value ?? "")))));
    expect(text.some((t) => t.includes(`${u} Performance`))).toBe(true);
    expect(text.some((t) => t.includes(`${other} Performance`))).toBe(false);
  });
}
