import { expect, type Page } from "@playwright/test";

import { copyViolations } from "../../lib/format/copy-rules";
import schema from "../../tests/fixtures/table-schema.json";
import { NavBar } from "../pages";

export type TabId = keyof typeof schema.tabs;
export const OUTPUT_TAB_IDS = Object.keys(schema.tabs) as TabId[];
export type SchemaTable = (typeof schema.tabs)[TabId][number];

export type CellRead = { text: string; value: number | null; hasInput: boolean };

/** Every keyed cell of one table: shown text and the raw number behind it. */
export async function readCells(page: Page, tableId: string): Promise<Record<string, CellRead>> {
  const entries = await page.locator(`[data-testid="table-${tableId}"] [data-cell]`).evaluateAll((els) =>
    els.map((el) => {
      const e = el as HTMLElement;
      const raw = e.dataset.value;
      return [e.dataset.cell!, { text: (e.textContent ?? "").replace(/\s+/g, " ").trim(), value: raw == null ? null : Number(raw), hasInput: Boolean(e.querySelector("input")) }];
    }),
  );
  return Object.fromEntries(entries) as Record<string, CellRead>;
}

/** Header rows and row labels as rendered. */
export async function readShape(page: Page, tableId: string): Promise<{ headers: string[][]; rowLabels: string[] }> {
  const root = page.locator(`[data-testid="table-${tableId}"]`);
  const headers = await root.locator("thead tr").evaluateAll((rows) =>
    rows.map((r) => Array.from(r.querySelectorAll("th")).map((th) => (th.textContent ?? "").replace(/\s+/g, " ").trim())),
  );
  const rowLabels = await root.locator("tbody tr[data-row]").evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.row!));
  return { headers, rowLabels };
}

/** Test ids of the tables on the page, in order. */
export async function tableIdsOnPage(page: Page): Promise<string[]> {
  return page.locator('main [data-testid^="table-"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid!.replace(/^table-/, "")));
}

/** Relative closeness, with an absolute floor for values at or near zero. */
export function close(actual: number, expected: number, rel = 1e-6): boolean {
  return Math.abs(actual - expected) <= rel * Math.max(Math.abs(expected), 1e-9) + 1e-12;
}

export async function readAllOutputs(page: Page): Promise<Record<string, Record<string, CellRead>>> {
  const nav = new NavBar(page);
  const out: Record<string, Record<string, CellRead>> = {};
  for (const tab of OUTPUT_TAB_IDS) {
    await nav.go(tab);
    for (const t of schema.tabs[tab]) {
      await expect(page.getByTestId(`table-${t.id}`)).toBeAttached();
      out[t.id] = await readCells(page, t.id);
    }
  }
  return out;
}

/** Problems with one rendered table against the schema: B14.1 to B14.4. */
export async function tableProblems(page: Page, t: SchemaTable): Promise<string[]> {
  const problems: string[] = [];
  const shape = await readShape(page, t.id);
  if (JSON.stringify(shape.headers) !== JSON.stringify(t.headers)) problems.push(`${t.id} headers ${JSON.stringify(shape.headers)} != ${JSON.stringify(t.headers)}`);
  if (JSON.stringify(shape.rowLabels) !== JSON.stringify(t.rowLabels)) problems.push(`${t.id} row labels ${JSON.stringify(shape.rowLabels)} != ${JSON.stringify(t.rowLabels)}`);
  const cells = await readCells(page, t.id);
  const keys = Object.keys(cells);
  if (keys.length !== t.cellCount) problems.push(`${t.id} has ${keys.length} cells, expected ${t.cellCount}`);
  const na = new Set(t.notApplicable);
  for (const [key, c] of Object.entries(cells)) {
    if (c.hasInput) continue;
    for (const v of copyViolations(c.text, "cell")) problems.push(`${t.id} ${key}: ${v}`);
    if (c.text === "-" && !na.has(key)) problems.push(`${t.id} ${key} shows - but the schema expects a value`);
    if (c.text !== "-" && na.has(key)) problems.push(`${t.id} ${key} shows "${c.text}" but the schema marks it not applicable`);
  }
  const widths = await page.locator(`[data-testid="table-${t.id}"] table`).evaluate((table) => {
    const rail = table.parentElement!;
    return { table: table.getBoundingClientRect().width, rail: rail.clientWidth };
  });
  if (widths.table < 0.98 * widths.rail) problems.push(`${t.id} is ${widths.table}px wide in a ${widths.rail}px rail`);
  return problems;
}

/** B14 for one output tab: exactly the schema tables, each with its headers, row labels, cells and full width. */
export async function tabProblems(page: Page, tab: TabId): Promise<string[]> {
  await new NavBar(page).go(tab);
  const expected = schema.tabs[tab];
  await expect(page.getByTestId(`table-${expected[0]!.id}`)).toBeVisible();
  const problems: string[] = [];
  const ids = await tableIdsOnPage(page);
  if (JSON.stringify(ids) !== JSON.stringify(expected.map((t) => t.id))) problems.push(`${tab} tables ${ids.join(", ")} != ${expected.map((t) => t.id).join(", ")}`);
  for (const t of expected) problems.push(...(await tableProblems(page, t)));
  return problems;
}

export { schema };
