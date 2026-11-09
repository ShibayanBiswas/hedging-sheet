import type { Page } from "@playwright/test";

import { MOCK_SPOTS } from "../../lib/test/mocks/yahoo";
import { correctNumber } from "../../lib/validation/corrections";
import { numberFieldRules } from "../../lib/validation/inputRules";
import { expect, test } from "../fixtures";
import type { InputsPage } from "../pages";
import { hook } from "../pipeline/helpers";
import { expectCorrected, FILL, fillValue } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const ctx = { today: "2026-10-28", spot: MOCK_SPOTS["^BSESN"] };
/** Fields typed as a % that are not in the rule table: they correct through the strikes or the daily volatility. */
const PERCENT_ALIASES = new Set(["target", "protection", "floorLevel", "annualVol"]);
const fieldOf = (testId: string) => testId.replace(/^input-/, "").replace(/-(\d+)$/, ".$1");
const noteOf = (testId: string) => `note-${testId.replace(/^input-/, "")}`;

/**
 * Type a value that breaks a rule into a field of the page as it stands: the field takes what lib/validation/corrections
 * makes of it, with its note and no popup. Then the fill's own value, which clears the note.
 */
async function badThenGood(page: Page, inputs: InputsPage, testId: string, bad: string, good = fillValue(testId)) {
  const field = fieldOf(testId);
  const current = (await hook(page)).inputs;
  const percent = PERCENT_ALIASES.has(field) || Boolean(numberFieldRules(current).find((r) => r.field === field)?.percent);
  const fix = correctNumber(current, field, Number(bad) / (percent ? 100 : 1), ctx);
  expect(fix, `${testId} = ${bad} is corrected`).not.toBeNull();
  await expectCorrected(page, testId, bad, fix!);
  if (good != null) {
    await inputs.fill(testId, good);
    await expect(page.getByTestId(noteOf(testId)), `${testId}: typing again clears the note`).toHaveCount(0);
  }
  return fix!;
}

/** Type the fill's values for these test ids, in fill order. */
const fillIds = (inputs: InputsPage, pick: (id: string) => boolean) => inputs.fillAll(FILL.filter(([id]) => pick(id)));

test.describe("B24 Auto-correct in Blank Inputs", () => {
  test("B24.1 group by group with a bad value in every group: each is corrected with a note, nothing pops up, and Run goes straight through", async ({ page, inputs, nav, outputs }) => {
    test.setTimeout(600_000);
    await inputs.goto("blank");

    // 1 Underlying And Market.
    await inputs.fill("input-underlying", "Sensex");
    await inputs.fill("input-valuationDate", "2026-11-15");
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
    await expect(page.getByTestId("note-valuationDate")).toHaveText("Moved To Today, 28-Oct-2026");
    await badThenGood(page, inputs, "input-spot", "-76835.78");
    expect((await badThenGood(page, inputs, "input-hedgeStrike", "77333", "77300")).note).toBe("Rounded To The Nearest 100, 77,300");

    // 2 Observation Expiries: Expiry 3 before Expiry 2, and Expiry 6 before Expiry 5, each move after the one before.
    await inputs.fill("input-expiryCount", "6");
    await fillIds(inputs, (id) => /^input-expiryDates-[01]$/.test(id));
    await inputs.fill("input-expiryDates-2", "2030-06-01");
    await expect(inputs.field("expiryDates-2")).toHaveValue("29-Aug-2030");
    await expect(page.getByTestId("expiry-note-2")).toHaveText("Moved After Expiry 2, 29-Aug-2030");
    await fillIds(inputs, (id) => /^input-expiryDates-[2-4]$/.test(id));
    await inputs.fill("input-expiryDates-5", "2029-01-01");
    await expect(inputs.field("expiryDates-5")).toHaveValue("29-May-2031");
    await expect(page.getByTestId("expiry-note-5")).toHaveText("Moved After Expiry 5, 29-May-2031");
    await inputs.fill("input-expiryDates-5", fillValue("input-expiryDates-5")!);

    // 3 Strikes And Spreads: Strike 2 above Strike 1, a floor of zero, a negative participation.
    await inputs.fill("input-spreadCount", "2");
    await inputs.fill("input-strikePercents-0", fillValue("input-strikePercents-0")!);
    expect((await badThenGood(page, inputs, "input-strikePercents-1", "140")).note).toBe("Lowered Below Strike 1, 136.000%");
    await fillIds(inputs, (id) => /^input-strikePercents-[2-4]$/.test(id));
    expect((await badThenGood(page, inputs, "input-strikePercents-5", "0")).note).toBe("Set To The Default, 70.000%");
    await fillIds(inputs, (id) => /^input-strike(OptionTypes|Sides)-/.test(id));
    expect((await badThenGood(page, inputs, "input-participations-0", "-1")).note).toBe("Made Positive, 1.00");

    // 4 Rates.
    expect((await badThenGood(page, inputs, "input-nbfcRate", "-8")).note).toBe("Raised To The Minimum, 0.000%");
    expect((await badThenGood(page, inputs, "input-premiumRate", "150")).note).toBe("Lowered To The Maximum, 100.000%");
    await fillIds(inputs, (id) => id === "input-marginGrowthRate");

    // 5 Product Terms: the Coupon of zero takes the default, which is the fill's value, so its note stays.
    await inputs.fill("input-coupon", "0");
    await expect(page.getByTestId("note-coupon")).toHaveText("Set To The Default, 102.500%");
    await badThenGood(page, inputs, "input-decay", "-1.6");
    expect((await badThenGood(page, inputs, "input-floorUnits", "2")).note).toBe("Lowered To The Decay, 1.60");
    expect((await badThenGood(page, inputs, "input-target", "-10", "37")).note).toBe("Raised Above Strike 2, 28.000%");
    expect((await badThenGood(page, inputs, "input-protection", "-5", "15")).note).toBe("Raised To The Minimum, 0.000%");
    expect((await badThenGood(page, inputs, "input-floorLevel", "90", "70")).note).toBe("Lowered Below Strike 5, 83.000%");
    expect((await badThenGood(page, inputs, "input-tenorDays", "1940.6")).note).toBe("Rounded To A Whole Number, 1,941");
    expect((await badThenGood(page, inputs, "input-tenorDays", "100")).note).toMatch(/^Raised To Reach Expiry 6, [\d,]+$/);
    await badThenGood(page, inputs, "input-startLevelUplift", "-0.6");
    expect((await badThenGood(page, inputs, "input-notionalCr", "0")).note).toBe("Set To The Default, 100.00");

    // 6 Volatility.
    expect((await badThenGood(page, inputs, "input-dailyVol", "0")).note).toBe("Set To The Default, 0.900%");
    await badThenGood(page, inputs, "input-annualVol", "500", "16.693");

    // 7 Margin And Desk Terms.
    // Each bad value corrects to something other than the fill's value, so typing the fill's value is an edit that clears the note.
    expect((await badThenGood(page, inputs, "input-stressDays", "3.4")).note).toBe("Rounded To A Whole Number, 3");
    await badThenGood(page, inputs, "input-exposureMargin", "150");
    expect((await badThenGood(page, inputs, "input-stressSigmas", "-7")).note).toBe("Made Positive, 7");
    const typed = new Set(["input-stressDays", "input-exposureMargin", "input-stressSigmas"]);
    await fillIds(inputs, (id) => /^input-(transactionCost|issuanceCost|marginCost|exchange|stressed|stressVol|futuresMargin)/.test(id) && !typed.has(id));
    await fillIds(inputs, (id) => id === "input-dailyVol");

    // Nothing has popped up, and Run goes straight through.
    await expect(inputs.dialog.root).toHaveCount(0);
    await inputs.run();
    await outputs.summary.expectResults();
    // The notes stay until their field is edited again.
    await nav.go("inputs");
    await expect(page.getByTestId("note-coupon")).toHaveText("Set To The Default, 102.500%");
    await expect(page.getByTestId("note-valuationDate")).toHaveText("Moved To Today, 28-Oct-2026");
  });

  test("B24.2 a rule broken across fields after the commits never blocks Run: Run corrects it and notes the field", async ({ page, inputs, nav }) => {
    await inputs.goto("blank");
    await inputs.fillAll(FILL);
    await inputs.dialog.dismissAll();
    // A Coupon just above the 2% the lower spread pays leaves the top spread 0.001: Strike 2, typed as a Buy, must now be sold.
    await inputs.fill("input-coupon", "2.01");
    await expect(page.getByTestId("strike-error-1")).toHaveText("This Strike Must Be A Sell To Give The Product Payoff");
    await expect(inputs.runButton).toBeEnabled();
    await inputs.run();
    expect((await hook(page)).inputs.strikeSides[1]).toBe("S");
    await nav.go("inputs");
    await expect(page.getByTestId("note-strikeSides-1")).toHaveText("Set To Sell, The Payoff Needs It");
    await expect(page.getByTestId("strike-error-1")).toHaveCount(0);
  });

  test("B24.3 a Custom Option Book in Blank Inputs: a leg's Level % and Quantity are corrected, and the book runs", async ({ page, inputs }) => {
    test.setTimeout(240_000);
    await inputs.goto("blank");
    await fillIds(inputs, (id) => /^input-(underlying|valuationDate|spot|expiryCount|expiryDates-\d+)$/.test(id));
    await page.getByTestId("book-mode-custom").click();
    await page.getByTestId("input-legCount-plus").click();
    await expectCorrected(page, "input-customLegs-0-percent", "-105", { value: 105, note: "Made Positive, 105.000%" });
    await expectCorrected(page, "input-customLegs-0-quantity", "0", { value: 1, note: "Set To The Default, 1.00" });
    await page.getByTestId("input-customLegs-0-optionType-C").click();
    await page.getByTestId("input-customLegs-0-side-S").click();
    await page.getByTestId("custom-add-leg").click();
    await expectCorrected(page, "input-customLegs-1-percent", "900", { value: 500, note: "Lowered To The Maximum, 500.000%" });
    await inputs.fill("input-customLegs-1-percent", "95");
    await expect(page.getByTestId("note-customLegs-1-percent")).toHaveCount(0);
    await expectCorrected(page, "input-customLegs-1-quantity", "-2", { value: 2, note: "Made Positive, 2.00" });
    await page.getByTestId("input-customLegs-1-optionType-P").click();
    await page.getByTestId("input-customLegs-1-side-S").click();
    await inputs.fillAll(FILL.filter(([id]) => /^input-(nbfcRate|premiumRate|marginGrowthRate|tenorDays|startLevelUplift|notionalCr|dailyVol|transactionCost|issuanceCost|marginCost|exchange|stressed|stressSigmas|stressDays|stressVolMultiplier|exposureMargin|futuresMargin)/.test(id)));
    await expect(inputs.dialog.root).toHaveCount(0);
    await inputs.run();
    const r = (await hook(page)).result!;
    expect(r.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side} ${s.units}`)).toEqual(["105 C S -1", "95 P S -2"]);
  });
});
