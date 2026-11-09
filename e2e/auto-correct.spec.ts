import { expect, test } from "./fixtures";
import { hook } from "./pipeline/helpers";
import { expectCorrected } from "./blank/helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

/** Default Values at the mock close: strikes 137, 127, 125, 85, 84, 70, expiries 28-Mar-2030 to 31-Jul-2031. */
test.describe("Auto-correct in Default Values", () => {
  test("a bad value in every group is corrected with a note, no popup opens, and Run goes straight through", async ({ page, inputs, nav, outputs }) => {
    test.setTimeout(240_000);
    await inputs.goto();
    await page.waitForLoadState("networkidle");

    await inputs.fill("input-valuationDate", "2026-12-01");
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
    await expect(page.getByTestId("note-valuationDate")).toHaveText("Moved To Today, 28-Oct-2026");
    await expectCorrected(page, "input-spot", "-74000", { value: 74000, note: "Made Positive, 74,000.00" });
    await expectCorrected(page, "input-hedgeStrike", "74444", { value: 74400, note: "Rounded To The Nearest 100, 74,400" });

    await inputs.fill("input-expiryDates-3", "2030-05-05");
    await expect(inputs.field("expiryDates-3")).toHaveValue("31-Oct-2030");
    await expect(page.getByTestId("expiry-note-3")).toHaveText("Moved After Expiry 3, 31-Oct-2030");

    await expectCorrected(page, "input-strikePercents-2", "130", { value: 126, note: "Lowered Below Strike 2, 126.000%" });
    // Spread 1 now pays 1%, so the top spread reaches the Coupon at 10.15: a typed 9 goes back to Calculated.
    await expectCorrected(page, "input-participations-1", "9", { value: 10.15, note: "Back To Calculated, 10.15" });
    await expect(page.getByTestId("spread-1-participation-status")).toHaveText("Calculated");

    await expectCorrected(page, "input-nbfcRate", "120", { value: 1, note: "Lowered To The Maximum, 100.000%" });
    await expectCorrected(page, "input-floorUnits", "3", { value: 1.6, note: "Lowered To The Decay, 1.60" });
    await expectCorrected(page, "input-protection", "40", { value: 0.28, note: "Lowered To Keep The Strikes In Order, 28.000%" });
    await expectCorrected(page, "input-tenorDays", "-1940", { value: 1940, note: "Made Positive, 1,940" });
    await expectCorrected(page, "input-dailyVol", "15", { value: 0.1, note: "Lowered To The Maximum, 10.000%" });
    await expectCorrected(page, "input-stressDays", "2.6", { value: 3, note: "Rounded To A Whole Number, 3" });

    // A note stays while other fields are edited, and goes when its own field is.
    await inputs.fill("input-decay", "1.7");
    await expect(page.getByTestId("note-floorUnits")).toHaveText("Lowered To The Decay, 1.60");
    await inputs.fill("input-floorUnits", "1");
    await expect(page.getByTestId("note-floorUnits")).toHaveCount(0);

    await expect(inputs.runButton).toBeEnabled();
    await inputs.run();
    await outputs.summary.expectResults();
    const priced = (await hook(page)).result!.inputs;
    expect(priced.strikePercents).toEqual([137, 127, 126, 72, 71, 70]);
    expect(priced.expiryDates[3]).toBe("2030-10-31");
    await nav.go("inputs");
    await expect(page.getByTestId("note-strikePercents-2")).toHaveText("Lowered Below Strike 2, 126.000%");
  });

  test("a Custom Option Book: a leg's Level % and Quantity are corrected, the Level In Points through the Level %", async ({ page, inputs }) => {
    await inputs.goto();
    await page.getByTestId("book-mode-custom").click();
    await page.getByTestId("custom-template").selectOption("short-strangle");
    await expectCorrected(page, "input-customLegs-0-percent", "0", { value: 100, note: "Set To The Default, 100.000%" });
    await expectCorrected(page, "input-customLegs-1-quantity", "-3", { value: 3, note: "Made Positive, 3.00" });
    // A level in points of zero is a Level % of zero, which takes the default 100%; the note sits on the row.
    await inputs.fill("input-customLegs-1-level", "0");
    await expect(page.getByTestId("input-customLegs-1-percent")).toHaveAttribute("data-value", "100");
    await expect(page.getByTestId("note-customLegs-1-percent")).toHaveText("Set To The Default, 100.000%");
    // The product's rules do not apply: the legs may repeat a level.
    await expect(inputs.dialog.root).toHaveCount(0);
    await inputs.run();
    const r = (await hook(page)).result!;
    expect(r.structure.strikes.map((s) => `${s.percent} ${s.optionType} ${s.side} ${s.units}`)).toEqual(["100 C S -1", "100 P S -3"]);
  });

  test("switching mode and reloading clear every note; Blank Inputs stay blank", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.fill("input-floorUnits", "2");
    await expect(page.getByTestId("note-floorUnits")).toHaveText("Lowered To The Decay, 1.60");
    await inputs.setMode("blank");
    await expect(page.locator('[data-testid^="note-"]')).toHaveCount(0);
    await expect(inputs.field("valuationDate")).toHaveValue("");
    await expect(inputs.field("spot")).toHaveValue("");
    // In Blank Inputs a correction falls back on the Default Values value without filling anything else.
    await inputs.fill("input-underlying", "Sensex");
    await inputs.fill("input-valuationDate", "2026-12-01");
    await expect(page.getByTestId("note-valuationDate")).toHaveText("Moved To Today, 28-Oct-2026");
    await expect(inputs.field("spot")).toHaveValue("");
    await inputs.setMode("default");
    await expect(page.locator('[data-testid^="note-"]')).toHaveCount(0);
    await inputs.fill("input-coupon", "0");
    await expect(page.getByTestId("note-coupon")).toHaveText("Set To The Default, 102.500%");
    await page.reload();
    await expect(inputs.heading).toBeVisible();
    await expect(inputs.field("spot")).not.toHaveValue("", { timeout: 30_000 });
    await expect(page.locator('[data-testid^="note-"]')).toHaveCount(0);
    await expect(page.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
  });
});
