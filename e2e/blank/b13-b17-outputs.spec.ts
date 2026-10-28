import { clientReturn } from "../../lib/engine/structure";
import regression from "../../tests/fixtures/regression-expected.json";
import { blankFillInputs } from "../../tests/helpers/mock-market";
import { expect, test } from "../fixtures";
import { expectExcelMatches } from "../support/excel";
import { close, OUTPUT_TAB_IDS, readAllOutputs, readCells, schema, tabProblems, type CellRead, type TabId } from "../support/tables";
import { copyProblems } from "../support/copy";
import { chromiumOnly, FILL, fillBlank } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const expected = regression.mock.blankFill;
const tabOf = (tableId: string) => OUTPUT_TAB_IDS.find((t) => schema.tabs[t].some((x) => x.id === tableId))!;

/** Cells that differ from the frozen values: numbers within 1e-6 relative, text exactly. */
function mismatches(table: string, ui: Record<string, CellRead>, want: Record<string, number | string>): string[] {
  const out: string[] = [];
  for (const [key, v] of Object.entries(want)) {
    const got = ui[key];
    if (!got) out.push(`${table} ${key} is missing`);
    else if (typeof v === "number" ? got.value == null || !close(got.value, v) : got.text !== v) out.push(`${table} ${key}: page ${got.value ?? got.text}, expected ${v}`);
  }
  return out;
}

test.describe("B13 Full valid fill", () => {
  test("B13.1 and B13.2 the valid fill runs and every headline number matches the frozen regression", async ({ page, inputs, nav, outputs }) => {
    await fillBlank(inputs);
    await inputs.run();
    await outputs.summary.expectResults();
    const problems: string[] = [];
    for (const [table, cells] of Object.entries(expected.cells)) {
      await nav.go(tabOf(table));
      problems.push(...mismatches(table, await readCells(page, table), cells));
    }
    expect(problems).toEqual([]);

    const find = async (table: string, col: string) => {
      await nav.go(tabOf(table));
      return Number(await page.locator(`[data-testid="table-${table}"] [data-cell$="::${col}"]`).first().getAttribute("data-value"));
    };
    const h = expected.headline;
    expect(close(await find("summary-headline", "Actual Inbuilt"), h.actualInbuilt)).toBe(true);
    expect(close(await find("summary-headline", "Option Premium In Crore"), h.totalPremiumCr)).toBe(true);
    expect(close(await find("summary-headline", "Maturity Payout In Crore"), h.maturityCr)).toBe(true);
    expect(close(await find("summary-headline", "Margin Requirement"), h.margin)).toBe(true);
    expect(close(await find("summary-headline", "Hedge Quantity"), h.hedgeQuantity)).toBe(true);
    expect(close(await find("margin-headline", "Worst Case Requirement In Crore"), h.worstMtmCr)).toBe(true);
    for (const [label, v] of Object.entries(expected.greekDetails)) {
      await nav.go("product");
      const got = Number(await page.locator(`[data-testid="table-pd-greeks"] [data-cell="${label}::Value"]`).getAttribute("data-value"));
      expect(close(got, v as number), `${label}: ${got} vs ${v}`).toBe(true);
    }
  });

  test("B13.3 typing the Default Values into Blank Inputs gives identical outputs", async ({ page, inputs, nav }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(240_000);
    await inputs.goto();
    await inputs.run();
    const fromDefaults = await readAllOutputs(page);
    await nav.go("inputs");
    await inputs.setMode("blank");
    await inputs.fillAll(FILL);
    await page.getByTestId("compute-volatility").click();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    await inputs.dialog.dismissAll();
    await inputs.run();
    const fromBlank = await readAllOutputs(page);
    const diffs: string[] = [];
    for (const [table, cells] of Object.entries(fromDefaults)) {
      for (const [key, c] of Object.entries(cells)) {
        const b = fromBlank[table]?.[key];
        if (!b || b.text !== c.text || b.value !== c.value) diffs.push(`${table} ${key}: ${c.value ?? c.text} vs ${b?.value ?? b?.text}`);
      }
    }
    expect(diffs.slice(0, 20)).toEqual([]);
  });
});

test.describe("B14 Output tables", () => {
  for (const tab of OUTPUT_TAB_IDS) {
    test(`B14.1 to B14.5 ${tab}: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules`, async ({ page, inputs }, testInfo) => {
      chromiumOnly(testInfo);
      await fillBlank(inputs);
      await inputs.run();
      expect(await tabProblems(page, tab as TabId)).toEqual([]);
      expect(await copyProblems(page, tab)).toEqual([]);
    });
  }
});

test.describe("B15 Payoff", () => {
  test("B15.1 to B15.4 payoff levels, kink markers, no Description column, and kink values", async ({ page, inputs, outputs }) => {
    await fillBlank(inputs);
    await inputs.run();
    await outputs.product.open();
    const table = page.getByTestId("table-pd-payoff");
    const levels = await table.locator("tbody tr").evaluateAll((rows) => rows.map((r) => Number((r.querySelector("[data-cell]") as HTMLElement).dataset.value)));
    const i = blankFillInputs();
    const has = (x: number) => levels.some((l) => Math.abs(l - x) < 1e-9);
    for (const k of i.strikePercents) expect(has(k / 100 - 1), `strike ${k}`).toBe(true);
    expect(has(-0.15)).toBe(true);
    expect(has(-0.1501)).toBe(true);
    expect(has(0)).toBe(true);
    for (let x = -0.5; x <= 0.37 + 1e-9; x += 0.05) expect(has(Math.round(x * 1e6) / 1e6), `step ${x}`).toBe(true);
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);

    await expect(page.getByTestId("payoff-chart").locator(".recharts-reference-dot")).toHaveCount(i.strikePercents.length);
    expect((await table.locator("th").allTextContents()).some((t) => /Description/.test(t))).toBe(false);

    const cells = await readCells(page, "pd-payoff");
    for (const k of i.strikePercents) {
      const p = k / 100 - 1;
      const row = Object.entries(cells).find(([key, c]) => key.endsWith("Performance") && c.value != null && Math.abs(c.value - p) < 1e-9)![0].split("::")[0];
      const shown = cells[`${row}::Client Return`]!.value!;
      expect(Math.abs(shown - clientReturn(i, p)), `kink ${k}%`).toBeLessThan(1e-9);
    }
  });
});

test.describe("B16 Fixed grids", () => {
  test("B16.1 and B16.2 the Mark To Market and Day 1 margin grids have 15 rows from −50% to +20% and their rows sum", async ({ page, inputs, outputs }) => {
    await fillBlank(inputs);
    await inputs.run();
    const moves = Array.from({ length: 15 }, (_, k) => Math.round((-0.5 + 0.05 * k) * 100) / 100);
    const rows = (cells: Record<string, CellRead>, col: string) =>
      Object.entries(cells)
        .filter(([key]) => key.endsWith(`::${col}`))
        .map(([key, c]) => ({ row: key.split("::")[0]!, value: c.value! }));

    await outputs.margin.open();
    const mtm = await readCells(page, "mtm");
    expect(rows(mtm, "Move").map((r) => Math.round(r.value * 100) / 100)).toEqual(moves);
    for (const { row } of rows(mtm, "Move")) {
      const v = (c: string) => mtm[`${row}::${c}`]!.value!;
      expect(Math.abs(v("Futures Margin In Crore") + v("Mark To Market In Crore") + v("Options Margin In Crore") - v("Total Of Futures Margin, Mark To Market And Options Margin"))).toBeLessThan(1e-9);
    }

    await outputs.vegaHedge.open();
    const d1 = await readCells(page, "d1-margin");
    expect(rows(d1, "Move").map((r) => Math.round(r.value * 100) / 100)).toEqual(moves);
    for (const { row } of rows(d1, "Move")) {
      const v = (c: string) => d1[`${row}::${c}`]!.value!;
      expect(Math.abs(v("Initial Margin In Crore") + v("Exposure Margin In Crore") - v("Total Margin In Crore"))).toBeLessThan(1e-9);
    }
  });
});

test.describe("B17 Excel", () => {
  test("B17.1 to B17.6 name, five sheets, no pivots, headers and values match the page, no Workbook text, capitals", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    await fillBlank(inputs);
    await inputs.run();
    const ui = await readAllOutputs(page);
    await expectExcelMatches(page, ui);
  });
});

