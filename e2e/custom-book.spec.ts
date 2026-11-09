import type { Page } from "@playwright/test";

import { FILL, chromiumOnly } from "./blank/helpers";
import { expect, test } from "./fixtures";
import type { InputsPage, NavBar } from "./pages";
import { hook } from "./pipeline/helpers";
import { readCells } from "./support/tables";

// Rules and numbers read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const NOT_USED = "Not Used In Custom Option Book";
/** Fields a Custom Option Book does not have, and the product strike rows. */
const PRODUCT_ONLY = /^input-(spreadCount|strikePercents|strikeOptionTypes|strikeSides|participations|coupon|decay|floorUnits)(-|$)/;

type Leg = { percent: string; type: "P" | "C"; side: "B" | "S"; quantity: string };

async function pickCustom(page: Page) {
  await page.getByTestId("book-mode-custom").click();
  await expect(page.getByTestId("book-mode")).toHaveAttribute("data-value", "custom");
}

/** Types one leg by hand: Level %, Put or Call, Buy or Sell, then the Quantity. */
async function typeLeg(inputs: InputsPage, i: number, leg: Leg) {
  await inputs.fill(`input-customLegs-${i}-percent`, leg.percent);
  await inputs.page.getByTestId(`input-customLegs-${i}-optionType-${leg.type}`).click();
  await inputs.page.getByTestId(`input-customLegs-${i}-side-${leg.side}`).click();
  await inputs.fill(`input-customLegs-${i}-quantity`, leg.quantity);
}

/** The product numbers a switch back must leave alone. */
async function productNumbers(page: Page) {
  const r = (await hook(page)).result!;
  return {
    premium: r.pricer.header.premium,
    inbuilt: r.summary.actualInbuilt,
    delta: r.pricer.header.delta,
    vega: r.summary.vegaCr,
    hedge: r.dayOneVegaHedge.quantity,
    worst: r.markToMarket.worstCase.totalRequirementCr,
    payoff: r.productDescription.payoff.map((p) => [p.performance, p.clientReturn]),
    strikes: r.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side}`),
  };
}

/** The Leg Grid row for one field, as rendered, one cell per live leg. */
async function gridCells(page: Page, label: string) {
  const cells = await readCells(page, "pricer-legs");
  return Object.entries(cells)
    .filter(([key]) => key.startsWith(`${label}::`) && key.includes("#"))
    .map(([, c]) => c);
}
const gridRow = async (page: Page, label: string) => (await gridCells(page, label)).map((c) => c.text);

/** Client Return in the Payoff Scenarios table at a move, from its raw value. */
async function payoffAt(page: Page, move: string): Promise<number> {
  const cell = page.locator(`[data-testid="table-pd-payoff"] [data-cell="${move}::Client Return"]`);
  return Number(await cell.getAttribute("data-value"));
}

async function expectSummaryBook(page: Page, nav: NavBar) {
  await nav.go("summary");
  const spec = await readCells(page, "summary-spec");
  expect(spec["Book::Value"]?.text).toBe("Custom Option Book");
  for (const label of ["Coupon", "Protection", "Decay", "Internal Rate Of Return", "Spreads And Participation Rates"]) expect(spec[`${label}::Value`]?.text, label).toBe(NOT_USED);
  expect(spec["Actual Inbuilt::Value"]?.value).not.toBeNull();
  const head = await readCells(page, "summary-headline");
  expect(Object.entries(head).find(([k]) => k.endsWith("::Book"))?.[1].text).toBe("Custom Option Book");
  await expect(page.getByTestId("table-summary-options")).not.toContainText("Futures Adjustment");
}

test.describe("Custom Option Book", () => {
  test("C1 Default Values: a bull call spread by hand, an iron condor by template, then Product Payoff prices as before", async ({ page, inputs, nav, consoleErrors }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(300_000);
    await inputs.goto();
    await expect(page.getByTestId("book-mode-product")).toHaveAttribute("aria-checked", "true");
    await inputs.run();
    const before = await productNumbers(page);

    // A bull call spread typed by hand: buy the 100% call, sell the 105% call.
    await nav.go("inputs");
    await pickCustom(page);
    await expect(page.getByTestId("terms-not-used")).toContainText(NOT_USED);
    await expect(inputs.field("coupon")).toHaveCount(0);
    await expect(page.getByTestId("leg-row-0")).toBeVisible();
    await typeLeg(inputs, 0, { percent: "100", type: "C", side: "B", quantity: "1" });
    await page.getByTestId("custom-add-leg").click();
    await typeLeg(inputs, 1, { percent: "105", type: "C", side: "S", quantity: "1" });
    await expect(inputs.field("input-customLegs-1-level")).toHaveValue("81,165");
    await inputs.run();
    await expectSummaryBook(page, nav);

    await nav.go("pricer");
    expect(await gridRow(page, "Option Type")).toEqual(Array.from({ length: 12 }, () => "Call"));
    expect(await gridRow(page, "Action")).toEqual([...Array.from({ length: 6 }, () => "Buy"), ...Array.from({ length: 6 }, () => "Sell")]);
    const signs = (await gridCells(page, "Contracts")).map((c) => Math.sign(c.value!));
    expect(signs).toEqual([...Array.from({ length: 6 }, () => 1), ...Array.from({ length: 6 }, () => -1)]);
    await expect(page.getByTestId("table-pricer-legs")).toContainText("Leg 2 · 105% · 81,165");
    const pots = await readCells(page, "pricer-pots");
    expect(pots["Book::Value"]?.text).toBe("Custom Option Book");
    expect(pots["Achieved Coupon::Value"]?.text).toBe(NOT_USED);
    const r = (await hook(page)).result!;
    expect(r.pricer.header.futuresAdjustment).toBe(0);
    expect(r.pricer.header.delta).toBeGreaterThan(0);

    await nav.go("product");
    expect(await payoffAt(page, "-10.00%")).toBeCloseTo(0, 12);
    expect(await payoffAt(page, "0.00%")).toBeCloseTo(0, 12);
    expect(await payoffAt(page, "5.00%")).toBeCloseTo(0.05, 12);
    expect(await payoffAt(page, "20.00%")).toBeCloseTo(0.05, 12);
    await expect(page.getByTestId("table-pd-payoff")).not.toContainText("Protection");
    await expect(page.getByTestId("payoff-chart")).not.toContainText("Protection Band");
    await expect(page.getByTestId("table-pd-term-sheet")).toContainText("Buy 1 Call At 100%");
    await expect(page.getByTestId("table-pd-term-sheet")).toContainText("Sell 1 Call At 105%");

    // An iron condor from the template menu.
    await nav.go("inputs");
    await page.getByTestId("custom-template").selectOption("iron-condor");
    await expect(page.getByTestId("custom-book-note")).toContainText("Iron Condor: Buy 1 Call At 110%, Sell 1 Call At 105%, Sell 1 Put At 95%, Buy 1 Put At 90%.");
    await expect(page.getByTestId("custom-book-chip")).toContainText("4 Legs");
    await inputs.run();
    await nav.go("product");
    for (const [move, payoff] of [["-30.00%", -0.05], ["-10.00%", -0.05], ["0.00%", 0], ["10.00%", -0.05], ["40.00%", -0.05]] as const) {
      expect(await payoffAt(page, move), move).toBeCloseTo(payoff, 12);
    }
    const condor = (await hook(page)).result!;
    expect(condor.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side} ${s.units}`)).toEqual(["110 C B 1", "105 C S -1", "95 P S -1", "90 P B 1"]);
    expect(condor.pricer.header.premium).toBeGreaterThan(0);

    // Back to Product Payoff: today's numbers, to the last digit.
    await nav.go("inputs");
    await page.getByTestId("book-mode-product").click();
    await expect(inputs.field("strikePercents-0")).toHaveValue("137.000");
    await expect(inputs.field("coupon")).toHaveValue("102.500");
    await inputs.run();
    expect(await productNumbers(page)).toEqual(before);
    await expect(page.getByTestId("table-summary-spec")).not.toContainText(NOT_USED);

    // A reload starts again as today: Product Payoff with the default strikes.
    // The reload is on Summary: the results go with it, as today, and Inputs starts again.
    await page.reload();
    await expect(page.getByTestId("run-gate")).toBeVisible();
    await nav.go("inputs");
    await expect(inputs.heading).toBeVisible();
    await expect(page.getByTestId("book-mode-product")).toHaveAttribute("aria-checked", "true");
    await expect(inputs.field("strikePercents-0")).toHaveValue("137.000");
    await expect(page.getByTestId("leg-row-0")).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });

  test("C2 Blank Inputs: the product, then a long straddle typed leg by leg, then the product again", async ({ page, inputs, nav, consoleErrors }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(300_000);
    await inputs.goto("blank");
    await inputs.fillAll(FILL);
    await inputs.dialog.dismissAll();
    await inputs.run();
    const before = await productNumbers(page);

    await nav.go("inputs");
    await pickCustom(page);
    await expect(page.getByTestId("legs-empty")).toHaveText("Select Number Of Legs");
    // With no legs, or an empty one, the later steps wait on Strikes And Spreads, as they do on the strikes.
    await expect(page.getByTestId("group-5")).toHaveAttribute("data-locked", "true");
    await page.getByTestId("input-legCount-plus").click();
    await expect(inputs.field("input-customLegs-0-percent")).toHaveValue("");
    await expect(page.getByTestId("group-5")).toHaveAttribute("data-locked", "true");
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
    await expect(inputs.dialog.groups).toContainText("Leg 1 Option Type: Select Put or Call.");
    await expect(inputs.dialog.groups).not.toContainText("Coupon");
    await inputs.dialog.dismissAll();
    await typeLeg(inputs, 0, { percent: "100", type: "P", side: "B", quantity: "1" });
    await page.getByTestId("custom-add-leg").click();
    await expect(inputs.field("input-customLegs-1-percent")).toHaveValue("");
    await typeLeg(inputs, 1, { percent: "100", type: "C", side: "B", quantity: "1" });
    await expect(page.getByTestId("group-5")).not.toHaveAttribute("data-locked");
    await inputs.run();
    await expectSummaryBook(page, nav);

    const r = (await hook(page)).result!;
    expect(r.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side} ${s.units}`)).toEqual(["100 P B 1", "100 C B 1"]);
    expect(r.pricer.legs.every((l) => l.contracts > 0 && l.action === "Buy")).toBe(true);
    expect(r.pricer.header.gamma).toBeGreaterThan(0);
    expect(r.pricer.header.vega).toBeGreaterThan(0);
    await nav.go("pricer");
    expect(await gridRow(page, "Option Type")).toEqual([...Array.from({ length: 6 }, () => "Put"), ...Array.from({ length: 6 }, () => "Call")]);
    await nav.go("product");
    for (const [move, payoff] of [["-10.00%", 0.1], ["0.00%", 0], ["10.00%", 0.1], ["-50.00%", 0.5]] as const) {
      expect(await payoffAt(page, move), move).toBeCloseTo(payoff, 12);
    }

    await nav.go("inputs");
    await page.getByTestId("book-mode-product").click();
    await expect(inputs.field("coupon")).toHaveValue("102.500");
    await inputs.run();
    expect(await productNumbers(page)).toEqual(before);

    // A reload goes back to Default Values and Product Payoff, as today.
    // The reload is on Summary: the results go with it, as today, and Inputs starts again.
    await page.reload();
    await expect(page.getByTestId("run-gate")).toBeVisible();
    await nav.go("inputs");
    await expect(inputs.heading).toBeVisible();
    await expect(page.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("book-mode-product")).toHaveAttribute("aria-checked", "true");
    expect(consoleErrors).toEqual([]);
  });

  test("C3 Blank Inputs: Custom from the start never waits on a product term", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(240_000);
    await inputs.goto("blank");
    const steps12 = FILL.filter(([id]) => /^input-(underlying|valuationDate|spot|expiryCount|expiryDates-\d+)$/.test(id));
    await inputs.fillAll(steps12);
    await pickCustom(page);
    await page.getByTestId("custom-template").selectOption("short-strangle");
    await expect(page.getByTestId("group-5")).not.toHaveAttribute("data-locked");
    await inputs.fillAll(FILL.filter(([id]) => !steps12.some(([s]) => s === id) && !PRODUCT_ONLY.test(id)));
    await inputs.dialog.dismissAll();
    await inputs.run();
    const r = (await hook(page)).result!;
    expect(r.inputs.bookMode).toBe("custom");
    expect(r.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side}`)).toEqual(["105 C S", "95 P S"]);
    expect(r.pricer.header.vega).toBeLessThan(0);
    expect(r.pricer.header.gamma).toBeLessThan(0);
  });
});
