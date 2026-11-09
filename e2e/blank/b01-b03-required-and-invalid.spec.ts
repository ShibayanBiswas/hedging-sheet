import { blankInputs } from "../../lib/inputs/draft";
import { correctNumber, correctValuationDate } from "../../lib/validation/corrections";
import { fieldTestId, INPUT_SECTIONS, numberFieldRules, requiredFields, validateDeskInputs, type NumberFieldRule } from "../../lib/validation/inputRules";
import { blankFillInputs } from "../../tests/helpers/mock-market";
import { expect, test } from "../fixtures";
import { OUTPUT_TAB_IDS } from "../support/tables";
import { chromiumOnly, dialogItems, expectAccepted, expectCorrected, expectFlagged, expectNotRun, fillBlank, fillValue, re, restoreField } from "./helpers";

// Data and rule checks read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const TODAY = "2026-10-28";
const filled = blankFillInputs();
/** What a typed value becomes on the filled page, from lib/validation/corrections: the mock close is the fill's spot. */
const corrected = (field: string, v: number) => correctNumber(filled, field, v, { today: TODAY, spot: filled.spot });
/** Choices rather than typed numbers: three selects and the per-strike segmented controls of the first and last strike. */
const SELECTS = new Set(["underlying", "expiryCount", "spreadCount", "strikeOptionTypes.0", "strikeSides.5"]);
const isSegmented = (field: string) => /^strike(OptionTypes|Sides)\./.test(field);

test.describe("B1 Empty state", () => {
  test("B1.1 every input is empty and every field shows a placeholder", async ({ inputs, page }) => {
    await inputs.goto("blank");
    // No counts are picked yet, so no expiry or strike rows exist; every other field is empty with a placeholder.
    const fields = page.locator('main input[data-testid^="input-"]:not([type="checkbox"]):not([disabled])');
    await expect(page.locator('[data-testid^="input-strikePercents-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="input-expiryDates-"]')).toHaveCount(0);
    expect(await fields.count()).toBeGreaterThan(20);
    const report = await fields.evaluateAll((els) =>
      els.map((e) => ({ id: (e as HTMLInputElement).dataset.testid, value: (e as HTMLInputElement).value, placeholder: (e as HTMLInputElement).placeholder })),
    );
    expect(report.filter((r) => r.value !== "")).toEqual([]);
    expect(report.filter((r) => !/^Eg /.test(r.placeholder))).toEqual([]);
    for (const field of SELECTS) {
      // The strike choices appear once the Number Of Spreads is picked.
      if (isSegmented(field)) await expect(page.getByTestId(fieldTestId(field))).toHaveCount(0);
      else await expect(page.getByTestId(fieldTestId(field)).locator("option:checked")).toHaveText(/^Select/);
    }
  });

  test("B1.2 every output tab shows the run gate", async ({ inputs, outputs }) => {
    await inputs.goto("blank");
    for (const out of Object.values(outputs)) {
      await out.open();
      await out.expectGate();
    }
    expect(Object.keys(outputs)).toHaveLength(OUTPUT_TAB_IDS.length);
  });

  test("B1.3 Run with everything empty lists every required field by section and focuses the first", async ({ inputs, page }) => {
    await inputs.goto("blank");
    const expected = validateDeskInputs(blankInputs(), { today: TODAY });
    await inputs.expectValidationDialog({ count: expected.length });
    expect(await dialogItems(page)).toEqual(expected.map((e) => `${e.label}: ${e.message}`));
    const sections = await page.getByTestId("desk-dialog-groups").locator(":scope > div > p").allTextContents();
    expect(sections).toEqual([...new Set(expected.map((e) => e.section))]);
    await inputs.dialog.close();
    await expect(inputs.field("underlying")).toBeFocused();
    await expectNotRun(page);
  });
});

test.describe("B2 One required field missing", () => {
  const required = requiredFields(filled.expiryCount, filled.strikePercents.length - 4);

  test("B2.1 each required field cleared in turn is the only field listed, is marked invalid and keeps outputs gated", async ({ inputs, page }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(600_000);
    await fillBlank(inputs);
    for (const f of required.filter((r) => !SELECTS.has(r.field) && !isSegmented(r.field))) {
      const testId = fieldTestId(f.field);
      await test.step(`${f.field}`, async () => {
        const [base, index] = f.field.split(".");
        const patch =
          index != null
            ? { [base!]: (filled[base as "strikePercents"] as number[]).map((v, i) => (i === Number(index) ? NaN : v)) }
            : { [f.field]: f.field === "valuationDate" ? "" : NaN };
        const expected = validateDeskInputs({ ...filled, ...patch }, { today: TODAY });
        expect(expected.map((e) => e.field)).toEqual([f.field]);
        await inputs.clear(testId);
        await inputs.runButton.click();
        await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
        expect(await dialogItems(page)).toEqual([`${expected[0]!.label}: ${expected[0]!.message}`]);
        await inputs.dialog.close();
        await expect(page.getByTestId(testId)).toHaveAttribute("aria-invalid", "true");
        await expectNotRun(page);
        await restoreField(page, inputs, testId);
        await expect(page.getByTestId(testId)).not.toHaveAttribute("aria-invalid", "true");
      });
    }
    expect(required.length).toBeGreaterThan(35);
  });

  /** The step each choice completes: until it is made, the next group says "Complete Step N First". */
  const STEP: Record<string, number> = { underlying: 1, expiryCount: 2, spreadCount: 3, "strikeOptionTypes.0": 3, "strikeSides.5": 3 };

  for (const select of SELECTS) {
    test(`B2.1 ${select} left unselected keeps the later steps locked and is listed first`, async ({ inputs, page }, testInfo) => {
      chromiumOnly(testInfo);
      await fillBlank(inputs, [fieldTestId(select)]);
      const step = STEP[select]!;
      await expect(page.getByTestId(`group-${step + 1}-locked`)).toHaveText(`Complete Step ${step} First`);
      await inputs.runButton.click();
      await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
      const label = required.find((r) => r.field === select)!.label;
      // In the steps that were open, this choice is the only thing missing.
      const groups = await page.getByTestId("desk-dialog-groups").locator(":scope > div").evaluateAll((divs) =>
        divs.map((d) => ({ title: d.querySelector("p")?.textContent ?? "", items: Array.from(d.querySelectorAll("li > span.flex-1")).map((s) => s.textContent?.trim() ?? "") })),
      );
      // The auto hedge strike follows the underlying, so without one it is missing too.
      const follows = select === "underlying" ? /^Hedge Strike:/ : null;
      const open = groups
        .filter((g) => INPUT_SECTIONS.indexOf(g.title as (typeof INPUT_SECTIONS)[number]) < step)
        .flatMap((g) => g.items)
        .filter((i) => !follows?.test(i));
      expect(open, JSON.stringify(groups)).toHaveLength(1);
      expect(open[0]).toMatch(re(label));
      await inputs.dialog.close();
      await expect(page.getByTestId(fieldTestId(select))).toHaveAttribute("aria-invalid", "true");
      await expectNotRun(page);
    });
  }
});

// A value that breaks a rule is corrected, with a note; only text that is no number still reverts with a popup.
test.describe("B3 Invalid values in every number field", () => {
  const rules = numberFieldRules(filled);
  const idOf = (r: NumberFieldRule) => fieldTestId(r.field);
  /** A number as it is typed: percent fields in % points. */
  const typed = (r: NumberFieldRule, v: number) => String(+(r.percent ? v * 100 : v).toFixed(8));

  test.beforeEach(async ({ inputs }, testInfo) => {
    chromiumOnly(testInfo);
    test.setTimeout(300_000);
    await fillBlank(inputs);
  });

  const each = async (page: Parameters<typeof restoreField>[0], inputs: Parameters<typeof restoreField>[1], pick: (r: NumberFieldRule) => boolean, check: (r: NumberFieldRule, id: string) => Promise<void>) => {
    let n = 0;
    for (const r of rules.filter(pick)) {
      await test.step(r.field, async () => {
        await check(r, idOf(r));
        await restoreField(page, inputs, idOf(r));
      });
      n += 1;
    }
    expect(n).toBeGreaterThan(0);
  };

  test('B3.1 text such as "abc" is flagged', async ({ page, inputs }) => {
    await each(page, inputs, () => true, (_, id) => expectFlagged(page, id, "abc"));
  });

  test('B3.2 "1e999" and "NaN" are flagged', async ({ page, inputs }) => {
    await each(page, inputs, () => true, async (_, id) => {
      await expectFlagged(page, id, "1e999");
      await expectFlagged(page, id, "NaN");
    });
  });

  /** A value the rules correct: the field takes what lib/validation/corrections makes of it, with its note. */
  const expectFixed = async (page: Parameters<typeof expectCorrected>[0], r: NumberFieldRule, id: string, v: number) => {
    const fix = corrected(r.field, v);
    if (!fix) await expectAccepted(page, id, typed(r, v));
    else await expectCorrected(page, id, typed(r, v), fix);
  };

  test("B3.3 a negative value is made positive where only positive makes sense, and raised to 0 where 0 is allowed", async ({ page, inputs }) => {
    await each(page, inputs, () => true, async (r, id) => {
      const v = -Math.max(r.min, 0.05 * r.max, 1);
      expect(corrected(r.field, v), r.field).not.toBeNull();
      await expectFixed(page, r, id, v);
    });
  });

  test("B3.4 zero takes the default where zero is not allowed, and is accepted where it is", async ({ page, inputs }) => {
    await each(page, inputs, () => true, (r, id) => (r.minInclusive && r.min === 0 ? expectAccepted(page, id, "0") : expectFixed(page, r, id, 0)));
  });

  test("B3.5 a value above the maximum is lowered to it, and one below the minimum is raised or made positive", async ({ page, inputs }) => {
    await each(page, inputs, () => true, async (r, id) => {
      await expectFixed(page, r, id, r.max + (r.integer || !r.percent ? 1 : 0.01));
      await restoreField(page, inputs, id);
      await expectFixed(page, r, id, r.min - (r.integer || !r.percent ? 1 : 0.01));
    });
  });

  test("B3.6 decimals are accepted at the allowed precision; whole-number fields round them", async ({ page, inputs }) => {
    await each(page, inputs, () => true, async (r, id) => {
      const base = fillValue(id) ?? "76800";
      const decimal = base.includes(".") ? `${base}5` : `${base}.25`;
      if (r.integer || r.step) await expectFixed(page, r, id, Number(decimal) / (r.percent ? 100 : 1));
      else {
        await expectAccepted(page, id, decimal);
        const expected = Number(decimal) / (r.percent ? 100 : 1);
        expect(Number(await page.getByTestId(id).getAttribute("data-value"))).toBeCloseTo(expected, 12);
      }
    });
  });

  test("B3.7 pasted values with thousands separators are accepted", async ({ page, inputs }) => {
    await each(page, inputs, () => true, async (r, id) => {
      const base = Number(fillValue(id) ?? "76800");
      const grouped = base.toLocaleString("en-IN", { maximumFractionDigits: 8 });
      await expectAccepted(page, id, grouped);
      expect(Number(await page.getByTestId(id).getAttribute("data-value"))).toBeCloseTo(base / (r.percent ? 100 : 1), 12);
    });
    await expectAccepted(page, "input-spot", "1,23,456.78");
    expect(await page.getByTestId("input-spot").getAttribute("data-value")).toBe("123456.78");
  });

  test("B3.8 a future valuation date moves to today with a note; text that is no real date reverts with a popup", async ({ page, inputs }) => {
    const fix = correctValuationDate(filled, "2026-10-29", { today: TODAY })!;
    expect(fix).toEqual({ value: TODAY, note: "Moved To Today, 28-Oct-2026" });
    await inputs.fill("valuationDate", "2026-10-29");
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
    await expect(page.getByTestId("note-valuationDate")).toHaveText(fix.note);
    await expect(inputs.field("valuationDate")).not.toHaveAttribute("aria-invalid", "true");
    await expect(inputs.dialog.root).toHaveCount(0);
    // The field reads 31-Oct-2026 and only ever commits a real date: 30 February goes back to the last value with a popup.
    await inputs.fill("valuationDate", "30-Feb-2026");
    await inputs.dialog.expectTitle("Valuation Date Reverted");
    await inputs.dialog.close();
    await expect(inputs.field("valuationDate")).toHaveValue("28-Oct-2026");
  });
});
