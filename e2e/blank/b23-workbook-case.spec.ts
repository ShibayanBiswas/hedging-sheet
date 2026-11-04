import { formatDate } from "../../lib/engine/dates";
import { snapExpiry } from "../../lib/engine/schedule";
import { outputTables, specCells } from "../../lib/tables";
import workbookFill from "../../tests/fixtures/blank-workbook-fill.json";
import surface from "../../tests/fixtures/surface.json";
import saved from "../../tests/golden/fixtures/workbook-values.json";
import { blankFillInputs, priceLikeTheApp } from "../../tests/helpers/mock-market";
import { expect, test } from "../fixtures";
import type { InputsPage } from "../pages";
import { close, readAllOutputs, type CellRead } from "../support/tables";
import { chromiumOnly, expectFlagged } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

/**
 * The reference workbook's own case typed into Blank Inputs the way a desk user would, group by group. G0 proves the
 * engine reproduces the workbook on these inputs; tests/golden/g0-blank-fill.test.ts proves this fill parses to them.
 * Here the page is checked against the workbook for every value that needs no market data, and against the engine on
 * Run's market for the rest: Run reads the valuation month's Forward Sell Rate, 4.45% for August 2026, where the
 * workbook's Pricer B28 reads 'Pricing Params'!H69, 5.50%.
 */
const FILL = workbookFill.fill as Array<[string, string]>;
const TYPED = blankFillInputs(FILL);
const WB = saved as Record<string, Record<string, number | string>>;
const value = (testId: string) => FILL.find(([id]) => id === testId)![1];

/** Every output cell Run should show for the typed inputs, keyed as the pages write data-cell. */
const EXPECTED: Record<string, Record<string, number | string>> = (() => {
  const out: Record<string, Record<string, number | string>> = {};
  for (const spec of Object.values(outputTables(priceLikeTheApp(TYPED))).flat()) {
    out[spec.id] = Object.fromEntries(
      specCells(spec)
        .filter((c) => c.value != null && c.value !== "")
        .map((c) => [c.key, typeof c.value === "number" ? c.value : c.text]),
    );
  }
  return out;
})();

/** A shown number: grouping commas, a % sign and the typographic minus removed. */
const num = (text: string | null) => Number((text ?? "").replace(/[,%\s]/g, "").replace(/−/g, "-"));
const near = (got: number, want: number, dp: number) => Math.abs(got - want) <= 0.5 * 10 ** -dp + 1e-9;

/**
 * Every cell within 1e-6, text exactly. Gamma is price(S + 1) + price(S − 1) − 2 × price(S): about 1e-5 left from prices
 * near 1e4, so a few last-place bits of the browser's and Node's Math.exp and Math.log move its 6th digit. It gets 1e-4.
 */
function differences(want: Record<string, Record<string, number | string>>, got: Record<string, Record<string, CellRead>>): string[] {
  const out: string[] = [];
  for (const [table, cells] of Object.entries(want)) {
    for (const [key, v] of Object.entries(cells)) {
      const c = got[table]?.[key];
      const rel = /Gamma/.test(key) ? 1e-4 : 1e-6;
      if (!c) out.push(`${table} ${key} is missing`);
      else if (typeof v === "number" ? c.value == null || !close(c.value, v, rel) : !c.hasInput && c.text !== v) out.push(`${table} ${key}: page ${c.value ?? c.text}, expected ${v}`);
    }
  }
  return out;
}

async function fillGroup(inputs: InputsPage, from: string, to: string) {
  const a = FILL.findIndex(([id]) => id === from);
  const b = FILL.findIndex(([id]) => id === to);
  for (const [id, v] of FILL.slice(a, b + 1)) await inputs.fill(id, v);
}

test.describe("B23 The workbook's own case through Blank Inputs", () => {
  test("B23.1 typed group by group: the steps unlock in order, derived fields follow the workbook, bad values revert, and Run shows the engine's numbers", async ({ page, inputs, nav, outputs }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(900_000);
    const group = (n: number) => page.getByTestId(`group-${n}`);
    const expectOpen = async (open: number) => {
      for (let n = 1; n <= 7; n++) {
        if (n <= open) await expect(group(n), `group ${n}`).not.toHaveAttribute("data-locked");
        else {
          await expect(group(n), `group ${n}`).toHaveAttribute("data-locked", "true");
          await expect(page.getByTestId(`group-${n}-locked`)).toHaveText(`Complete Step ${open} First`);
        }
      }
    };

    await inputs.goto("blank");
    await expectOpen(1);

    // 1 Underlying And Market: Summary Sheet C2 and C3. Step 2 waits for the Underlying and the Valuation Date only.
    await inputs.fill("input-underlying", "Sensex");
    await expectOpen(1);
    await inputs.fill("input-valuationDate", value("input-valuationDate"));
    await expect(inputs.field("valuationDate")).toHaveValue("04-Aug-2026");
    await expectOpen(2);
    await expectFlagged(page, "input-spot", "-5");
    await inputs.fill("input-spot", value("input-spot"));
    // No workbook rule: H23 is typed. The app's Sensex rule is the Start Level's, ROUNDUP(76,799 × 1.006, −2) = 77,300.
    await expect(inputs.field("hedgeStrike")).toHaveValue("77,300");
    await expect(page.getByTestId("hedge-strike-status")).toHaveText("Calculated");
    await expectFlagged(page, "input-hedgeStrike", "76850");
    await inputs.fill("input-hedgeStrike", value("input-hedgeStrike"));
    await expect(inputs.field("hedgeStrike")).toHaveValue("76,800");
    await expect(page.getByTestId("hedge-strike-status")).toHaveText("Edited");
    // Pricer B5 needs the Start Level Uplift, which sits in step 5.
    await expect(page.getByTestId("start-level")).toHaveText("-");

    // 2 Observation Expiries: the G4 to M4 helper dates move to C12 to H12, each its month's last Thursday.
    await expect(group(2)).toContainText("Select Number Of Expiry Dates");
    // The median for every count, the lower middle one when even: 1, 1, 2, 2, 3, 3, 4, 4, 5, 5.
    for (let n = 1; n <= 10; n++) {
      await inputs.fill("input-expiryCount", String(n));
      await expect(inputs.field("hedgeExpiryIndex").locator("option:checked"), `${n} expiries`).toHaveText(`Median · Expiry ${Math.floor((n - 1) / 2) + 1}`);
    }
    await inputs.fill("input-expiryCount", "6");
    await expect(group(2)).not.toContainText("Select Number Of Expiry Dates");
    // Summary D15 = E12: the median of six is Expiry 3.
    await expect(inputs.field("hedgeExpiryIndex")).toHaveValue("median");
    await expect(inputs.field("hedgeExpiryIndex").locator("option:checked")).toHaveText("Median · Expiry 3");
    for (let i = 0; i < 6; i++) {
      const typed = value(`input-expiryDates-${i}`);
      const snapped = snapExpiry(typed, "Sensex");
      expect(snapped, `Summary ${"CDEFGH"[i]}12`).toBe(WB["Summary Sheet"]![`${"CDEFGH"[i]}12`]);
      if (i === 2) {
        // A date that does not fall after Expiry 2 reverts with a popup.
        const field = inputs.field(`expiryDates-${i}`);
        await field.fill("2030-03-01");
        await field.blur();
        await inputs.dialog.expectTitle("Expiry 3 Reverted");
        await inputs.dialog.close();
        await expect(field).toHaveValue("");
      }
      await inputs.fill(`input-expiryDates-${i}`, typed);
      await expect(inputs.field(`expiryDates-${i}`)).toHaveValue(formatDate(snapped));
      await expect(page.getByTestId(`expiry-note-${i}`)).toHaveText(`Moved To The Last Thursday, ${formatDate(snapped)}`);
      if (i < 5) await expectOpen(2);
    }
    await expectOpen(3);
    const roles = await page.locator('[data-testid^="expiry-role-"]').evaluateAll((els) => els.map((e) => `${e.textContent ?? ""} ${(e as HTMLElement).title}`));
    expect.soft(roles.map((r) => /Hedge Option Expiry/.test(r))).toEqual([false, false, true, false, false, false]);

    // 3 Strikes And Spreads: Pricer B17 to AP17 for two spreads.
    await expect(group(3)).toContainText("Select Number Of Strikes");
    await expect(page.getByTestId("strike-count")).toHaveText("-");
    await inputs.fill("input-spreadCount", "2");
    await expect(group(3)).not.toContainText("Select Number Of Strikes");
    // Number Of Spreads + 4: target, two spread levels, protection, outflow and floor.
    await expect(page.getByTestId("strike-count")).toHaveText("6");
    await expectFlagged(page, "input-strikePercents-0", "600");
    await fillGroup(inputs, "input-strikePercents-0", "input-strikeSides-5");
    await expectOpen(3);
    await expectFlagged(page, "input-participations-0", "0");
    await inputs.fill("input-participations-0", value("input-participations-0"));
    await expectOpen(7);
    // Summary G10 to J10, and L10 = (D10 − (H10 − G10) × K10) ÷ (J10 − I10) once the Coupon is in.
    const spreads = [
      ["25.00%", "27.00%"],
      ["27.00%", "37.00%"],
    ];
    for (const [j, [buy, sell]] of spreads.entries()) {
      await expect(page.getByTestId(`input-spreads-${j}-buy`)).toHaveText(buy!);
      await expect(page.getByTestId(`input-spreads-${j}-sell`)).toHaveText(sell!);
    }
    await expect(page.getByTestId("strike-units-0")).toHaveText("-");

    // 4 Rates: Summary C4 to C6.
    await expectFlagged(page, "input-nbfcRate", "101");
    await fillGroup(inputs, "input-nbfcRate", "input-marginGrowthRate");

    // 5 Product Terms: Summary C10, D10, M10, N10, O10, C15 and Pricer AP17 and AP47.
    await expect(inputs.field("target")).toHaveValue(/^37(\.0+)?$/);
    await expect(inputs.field("protection")).toHaveValue(/^15(\.0+)?$/);
    await expect(inputs.field("floorLevel")).toHaveValue(/^70(\.0+)?$/);
    await expectFlagged(page, "input-tenorDays", "1.5");
    await fillGroup(inputs, "input-coupon", "input-notionalCr");
    await expect(page.getByTestId("start-level")).toHaveText("77,300");
    const pricer = WB["Pricer"]!;
    for (const [i, col] of ["B", "J", "R", "Z", "AH", "AP"].entries()) {
      // Pricer B19 = ROUND(B5 × B17%, 0) and row 47, the units.
      expect(num(await inputs.field(`strikeLevel-${i}`).inputValue()), `Pricer ${col}19`).toBe(pricer[`${col}19`]);
      expect(near(num(await page.getByTestId(`strike-units-${i}`).textContent()), pricer[`${col}47`] as number, 3), `Pricer ${col}47`).toBe(true);
    }
    expect(num(await inputs.field("participations-1").inputValue())).toBeCloseTo(WB["Summary Sheet"]!.L10 as number, 2);
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Calculated");
    // Pricer C13 and C14, and their sum the Coupon.
    expect(num(await page.getByTestId("spread-card-0").locator("output").last().textContent()) / 100).toBeCloseTo(pricer.C13 as number, 6);
    expect(num(await page.getByTestId("spread-card-1").locator("output").last().textContent()) / 100).toBeCloseTo(pricer.C14 as number, 6);
    await expect(page.getByTestId("max-coupon")).toHaveText("Maximum Upside 102.50%");

    // 6 Volatility: Summary I25, and I26 = I25 × √365.
    await expectFlagged(page, "input-dailyVol", "11");
    await inputs.fill("input-dailyVol", value("input-dailyVol"));
    expect(near(num(await inputs.field("annualVol").inputValue()), 100 * (WB["Summary Sheet"]!.I26 as number), 3)).toBe(true);
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Edited");

    // 7 Margin And Desk Terms: Summary C18 to E18 and J29, MTM H2, Day1 Vega Hedge I2 to L3 and the shock terms.
    await expectFlagged(page, "input-exposureMargin", "101");
    await expectFlagged(page, "input-stressDays", "2.5");
    await fillGroup(inputs, "input-transactionCost", "input-stressVolMultiplier");
    await inputs.dialog.dismissAll();

    await inputs.run();
    await outputs.summary.expectResults();
    const shown = await readAllOutputs(page);
    expect(differences(EXPECTED, shown).slice(0, 30)).toEqual([]);

    // Cells that need no market data equal the workbook's saved values.
    const s = WB["Summary Sheet"]!;
    const wb: Array<[string, string, number]> = [
      ["summary-spec", "Internal Rate Of Return::Value", s.F10 as number],
      ["summary-spec", "Spread 2 Participation Rate::Value", s.L10 as number],
      ["pricer-pots", "Start Sensex Level::Value", pricer.B5 as number],
      ["pricer-pots", "Mobilisation In Rupees::Value", pricer.E5 as number],
      ["pricer-pots", "Product Cost::Value", pricer.G5 as number],
      ["pricer-pots", "Transaction Cost In Rupees::Value", pricer.I5 as number],
      ["pricer-pots", "Achieved Coupon::Value", pricer.P5 as number],
      ["pricer-pots", "Internal Rate Of Return::Value", pricer.U5 as number],
    ];
    for (const row of [23, 24, 25, 26, 27, 28]) {
      const strike = (s[`B${row}`] as number).toLocaleString("en-US");
      wb.push(["summary-options", `${strike}::Quantity In Lakh`, s[`D${row}`] as number], ["summary-options", `${strike}::Units`, pricer[`${["B", "J", "R", "Z", "AH", "AP"][row - 23]}47`] as number]);
    }
    const pd = WB["Product Description"]!;
    for (let row = 32; row <= 53; row++) {
      const p = pd[`J${row}`];
      if (typeof p !== "number" || typeof pd[`K${row}`] !== "number") continue;
      const label = `${(p * 100).toFixed(2)}%`;
      if (!shown["pd-payoff"]?.[`${label}::Client Return`]) continue;
      wb.push(["pd-payoff", `${label}::Client Return`, pd[`K${row}`] as number], ["pd-payoff", `${label}::Pre Tax Internal Rate Of Return`, pd[`L${row}`] as number]);
    }
    const off = wb.filter(([t, k, v]) => !close(shown[t]?.[k]?.value ?? NaN, v)).map(([t, k, v]) => `${t} ${k}: page ${shown[t]?.[k]?.value}, workbook ${v}`);
    expect(off).toEqual([]);
    expect(wb.length).toBeGreaterThan(25);
    await nav.go("summary");
    await expect(page.getByTestId("table-summary-hedge")).toContainText("76,800");
    await expect(page.getByTestId("table-summary-hedge")).toContainText(formatDate(s.I23 as string));

    // Market Data shows the surface Run priced on: the workbook's MarketData grid, expiries from the Valuation Date on.
    await nav.go("market-data");
    const grid = page.getByTestId("vol-grid");
    await expect(grid.locator("[data-kind='date']").first()).toBeVisible({ timeout: 30_000 });
    const rows = await grid.locator("tbody tr").evaluateAll((trs) =>
      trs
        .map((tr) => [...tr.querySelectorAll("td")].map((td) => ({ text: (td.textContent ?? "").trim(), title: td.getAttribute("title") })))
        .filter((cells) => cells[0]?.title),
    );
    const want = surface.expiries.map((e, r) => ({ date: formatDate(e), vols: surface.volsPercent[r]! })).filter((x, r) => surface.expiries[r]!.slice(0, 10) >= TYPED.valuationDate);
    expect(rows.map((cells) => cells[0]!.title)).toEqual(want.map((x) => x.date));
    const badVols = rows.flatMap((cells, r) => cells.slice(1).filter((c, k) => !near(num(c.text), want[r]!.vols[k]!, 2)).map((c) => `${cells[0]!.title}: ${c.text}`));
    expect(badVols).toEqual([]);

    // A changed input brings the gate back with Inputs Changed.
    await nav.go("inputs");
    await inputs.fill("input-coupon", "100");
    await inputs.dialog.dismissAll();
    await expect(page.getByTestId("stale-chip")).toContainText("Inputs Changed");
    await outputs.summary.open();
    await outputs.summary.expectGate();
    await expect(outputs.summary.staleBanner).toContainText("Inputs Changed");

    // Clear All Inputs empties every field and locks the steps again; Default Values then prefills.
    await nav.go("inputs");
    await inputs.resetButton.click();
    await expect(inputs.field("underlying")).toHaveValue("");
    await expect(inputs.field("coupon")).toHaveValue("");
    await expectOpen(1);
    await inputs.setMode("default");
    await expect(inputs.field("spot")).toHaveValue("76,835.78");
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
    await outputs.summary.open();
    await outputs.summary.expectGate();
  });

  test("B23.2 Default Values with the workbook's date, close, volatility and hedge strike, and Bulk Edit for the expiries and strikes, gives the same outputs", async ({ page, inputs }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(600_000);
    await inputs.goto();
    for (const id of ["input-valuationDate", "input-spot", "input-hedgeStrike", "input-dailyVol"]) await inputs.fill(id, value(id));

    // Quarterly From First Expiry: Expiry 1 typed as the H4 helper date moves to 31-Jan-2030, then every 3 months is C12 to H12.
    await inputs.fill("input-expiryDates-0", value("input-expiryDates-0"));
    await page.getByTestId("expiries-quarterly").click();
    for (const [i, d] of TYPED.expiryDates.entries()) await expect(inputs.field(`expiryDates-${i}`)).toHaveValue(formatDate(d));

    // Bulk Edit Expiries: the helper dates pasted down a column, each moved to its last Thursday.
    await page.getByTestId("expiries-bulk").click();
    const helpers = [0, 1, 2, 3, 4, 5].map((i) => value(`input-expiryDates-${i}`));
    await page.getByTestId("bulk-expiries-text").fill(helpers.map(formatDate).join("\n"));
    for (const [i, d] of helpers.entries()) await expect(page.getByTestId(`bulk-expiries-row-${i}`)).toContainText(`Moved To ${formatDate(snapExpiry(d, "Sensex"))}`);
    await page.getByTestId("bulk-expiries-apply").click();
    await expect(page.getByTestId("bulk-expiries")).toHaveCount(0);
    for (const [i, d] of TYPED.expiryDates.entries()) await expect(inputs.field(`expiryDates-${i}`)).toHaveValue(formatDate(d));

    // Bulk Edit Strikes with Buy Or Sell left out: the sides follow the payoff, Pricer row 48.
    await page.getByTestId("strikes-bulk").click();
    await page.getByTestId("bulk-strikes-text").fill(TYPED.strikePercents.map((p) => `${p}\tPut`).join("\n"));
    await expect(page.getByTestId("bulk-strikes-preview")).toContainText("Follows Payoff");
    await page.getByTestId("bulk-strikes-apply").click();
    await expect(page.getByTestId("bulk-strikes")).toHaveCount(0);
    for (const [i, side] of TYPED.strikeSides.entries()) await expect(inputs.field(`strikeSides-${i}`)).toHaveAttribute("data-value", side);

    await inputs.dialog.dismissAll();
    await inputs.run();
    expect(differences(EXPECTED, await readAllOutputs(page)).slice(0, 30)).toEqual([]);
  });
});
