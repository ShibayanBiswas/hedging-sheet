import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { hook } from "./pipeline/helpers";

// The Atlas reads the settled page.
test.use({ reducedMotion: "reduce" });

const STAGES = [
  "Inputs",
  "Live Close",
  "Expiries",
  "Strikes And Spreads",
  "Volatility",
  "Surface Lookup",
  "Forwards",
  "Option Pricing",
  "Goal Seek Inbuilt",
  "Pots",
  "Day 1 Vega Hedge",
  "Mark To Market And Margin",
  "Payoff",
];

/** The displayed value beside a label in a stage's Last Run block. */
async function lastRunValue(page: Page, stage: string, label: string): Promise<string> {
  const row = page.getByTestId(`stage-${stage}-last`).locator(".atlas-value", { has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) });
  return ((await row.locator("dd").textContent()) ?? "").trim();
}

/** The displayed text of a headline cell on a result tab. */
async function headlineText(page: Page, table: string, column: string): Promise<string> {
  return ((await page.locator(`[data-testid="table-${table}"] [data-cell$="::${column}"]`).first().textContent()) ?? "").trim();
}

test.describe("Logic Atlas", () => {
  test("only Flows, Insights and Outputs: no Formulas, no Debug Drawer, no Computation Primitives", async ({ page, atlas }) => {
    await page.goto("/");
    await atlas.open();
    const headings = await page.locator("main h2").allTextContents();
    expect(headings.map((h) => h.trim())).toEqual(["Flows", "Insights", "Outputs"]);
    const text = await page.locator("main").innerText();
    for (const gone of ["Formulas", "Debug Drawer", "Live Intermediate Values", "Computation Primitives", "Each Formula In Words", "Nearest 100"]) expect(text, gone).not.toContain(gone);
  });

  test("before Run: the status waits, every stage waits and Insights shows its empty state", async ({ page, atlas }) => {
    await page.goto("/");
    await atlas.open();
    await expect(atlas.status).toHaveText("Waiting For Run Simulation");
    await expect(page.getByTestId("insights-empty")).toHaveText("Run Simulation To See Insights");
    for (const id of ["inputs", "goal-seek", "payoff"]) await expect(page.getByTestId(`stage-${id}-last`)).toContainText("Waiting For Run Simulation");
  });

  test("Flows: thirteen stages in run order, each with a type, uses, feeds, a rule and a description from the inputs", async ({ page, atlas }) => {
    await page.goto("/");
    await atlas.open();
    const titles = await atlas.flows.locator("article h3").allTextContents();
    expect(titles.map((t) => t.trim())).toEqual(STAGES);
    for (const kind of await atlas.flows.locator('[data-testid$="-kind"]').allTextContents()) expect(["Input", "Calculation", "Check", "Output"]).toContain(kind.trim());
    await expect(page.getByTestId("stage-vega-hedge-rule")).toHaveText("Sensex: Spot Times 1.006, Rounded Up To The Next 100");
    await expect(page.getByTestId("stage-expiries-rule")).toHaveText("Last Thursday Of Each Month");
    await expect(page.getByTestId("stage-live-close-description")).toContainText("76,835.78");
    await expect(page.getByTestId("stage-goal-seek-uses")).toContainText("Option Pricing");
    await expect(page.getByTestId("stage-option-pricing-feeds")).toContainText("Goal Seek Inbuilt");
  });

  test("a Uses link moves to the stage it names", async ({ page, atlas }) => {
    await page.goto("/");
    await atlas.open();
    await page.getByTestId("stage-goal-seek-uses").getByRole("link", { name: "Option Pricing" }).click();
    await expect(page.getByTestId("stage-option-pricing")).toBeFocused();
  });

  test("the rules and the descriptions follow the underlying", async ({ page, inputs, atlas }) => {
    await inputs.goto();
    await inputs.fill("input-underlying", "Nifty");
    await expect(inputs.field("spot")).toHaveValue("23,500.00", { timeout: 30_000 });
    await atlas.open();
    await expect(page.getByTestId("stage-vega-hedge-rule")).toHaveText("Nifty: Spot Plus 150, Rounded Up To The Next 100");
    await expect(page.getByTestId("stage-expiries-rule")).toHaveText("Last Tuesday Of Each Month");
    await expect(page.getByTestId("stage-live-close-description")).toContainText("Nifty close of 23,500.00");
    await expect(atlas.flows).not.toContainText("Sensex");
  });

  test("Blank Inputs: descriptions show a dash for every missing value", async ({ page, inputs, atlas }) => {
    await inputs.goto("blank");
    await atlas.open();
    await expect(page.getByTestId("stage-inputs-description")).toHaveText("Underlying product of - Crore valued on -: coupon -, tenor - days, NBFC rate - and premium growth rate -.");
    await expect(atlas.flows).not.toContainText(/NaN|Infinity|undefined/);
  });

  test("after Run: the run time, every stage's last run, insights and outputs, matching the result tabs", async ({ page, inputs, nav, atlas }) => {
    test.setTimeout(180_000);
    await inputs.goto();
    await inputs.run();
    const r = (await hook(page)).result!;

    await nav.go("pricer");
    const startLevel = await headlineText(page, "pricer-headline", `Start ${r.underlyingLabel} Level`);
    await nav.go("vega-hedge");
    const hedgeStrike = await headlineText(page, "vega-headline", "Hedge Strike");
    const hedgeQuantity = await headlineText(page, "vega-headline", "Hedge Quantity");
    await nav.go("summary");
    const premium = await headlineText(page, "summary-headline", "Option Premium In Crore");

    await atlas.open();
    await expect(atlas.status).toHaveText("Last Run · 28-Oct-2026 · 10:00 am IST");
    for (const id of ["inputs", "live-close", "expiries", "strikes", "volatility", "surface", "forwards", "option-pricing", "goal-seek", "pots", "vega-hedge", "margin", "payoff"]) {
      await expect(page.getByTestId(`stage-${id}-last`), id).not.toContainText("Waiting");
    }
    expect(await lastRunValue(page, "live-close", "Start Level")).toBe(startLevel);
    expect(await lastRunValue(page, "vega-hedge", "Hedge Strike")).toBe(hedgeStrike);
    expect(await lastRunValue(page, "vega-hedge", "Hedge Quantity")).toBe(hedgeQuantity);
    expect(await lastRunValue(page, "option-pricing", "Premium In Crore")).toBe(`${premium} Crore`);
    expect(await lastRunValue(page, "option-pricing", "Legs")).toBe(String(r.pricer.legs.length));
    expect(await lastRunValue(page, "goal-seek", "Inbuilt")).toBe(`${(r.summary.actualInbuilt * 100).toFixed(3)}%`);

    await expect(atlas.insights.locator("article")).toHaveCount(5);
    await expect(page.getByTestId("insight-hedge-strike")).toContainText(hedgeStrike);
    for (const tab of ["summary", "pricer", "product", "vega-hedge", "margin"]) await expect(page.getByTestId(`output-${tab}`).locator(".atlas-value")).toHaveCount(4);
    await expect(page.getByTestId("output-summary")).toContainText(premium);
    // No value carries more than 3 decimals, a negative zero or a broken number.
    const shown = await page.locator("main").innerText();
    expect(shown).not.toMatch(/\d\.\d{4,}|-0\.0+\b(?!\d)|NaN|Infinity/);

    await page.getByTestId("output-pricer-open").click();
    await expect(page).toHaveURL(/\/pricer$/);
  });

  test("a change after Run shows Inputs Changed · Run Again and hides the old values", async ({ page, inputs, nav, atlas }) => {
    await inputs.goto();
    await inputs.run();
    await nav.go("inputs");
    await inputs.fill("input-coupon", "103");
    await atlas.open();
    await expect(atlas.status).toHaveText("Inputs Changed · Run Again");
    await expect(page.getByTestId("stage-goal-seek-last")).toHaveText(/Inputs Changed · Run Again/);
    await expect(page.getByTestId("insights-empty")).toBeVisible();
  });

  for (const [width, columns] of [
    [1440, 3],
    [1024, 2],
    [390, 1],
  ] as const) {
    test(`Flows lay out ${columns} a row at ${width} px with no overlap`, async ({ page, inputs, atlas }) => {
      await page.setViewportSize({ width, height: 900 });
      // After hydration, so the nav has settled its scroll before the Logic Atlas tab is clicked.
      await inputs.goto();
      await atlas.open();
      const boxes = await atlas.flows.locator("article").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: r.y, r: r.right, b: r.bottom })));
      expect(new Set(boxes.slice(0, 6).map((b) => b.x)).size).toBe(columns);
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!,
            c = boxes[j]!;
          const overlap = Math.min(a.r, c.r) - Math.max(a.x, c.x) > 1 && Math.min(a.b, c.b) - Math.max(a.y, c.y) > 1;
          expect(overlap, `cards ${i + 1} and ${j + 1}`).toBe(false);
        }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
