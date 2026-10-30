import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { defaultInputs } from "@/lib/engine/defaults";
import { spreadCount } from "@/lib/engine/structure";
import { parseExpiryPaste, parsePastedDate, parseStrikePaste } from "@/lib/inputs/bulk";
import { blankInputs } from "@/lib/inputs/draft";
import { setSpreadCount } from "@/lib/inputs/strikes";
import { checkFieldEdit, numberFieldRules, unlockedSteps, validateDeskInputs } from "@/lib/validation/inputRules";

const TODAY = "2026-10-28";
const ctx = { valuationDate: TODAY, underlying: "Sensex" as const };

describe("pasted dates", () => {
  it("reads the common sheet formats", () => {
    expect(parsePastedDate("2030-04-25")).toBe("2030-04-25");
    expect(parsePastedDate("25-Apr-2030")).toBe("2030-04-25");
    expect(parsePastedDate("25 April 30")).toBe("2030-04-25");
    expect(parsePastedDate("25/04/2030")).toBe("2030-04-25");
    expect(parsePastedDate("31-Feb-2030")).toBeNull();
    expect(parsePastedDate("soon")).toBeNull();
  });
});

describe("Bulk Edit Expiries", () => {
  it("takes dates down or across, and moves each to the last Thursday", () => {
    const down = parseExpiryPaste("25-Apr-2030\n1-Jul-2030\n31-Oct-2030", ctx);
    expect(down.ok).toBe(true);
    expect(down.rows.map((r) => r.value)).toEqual(["2030-04-25", "2030-07-25", "2030-10-31"]);
    expect(down.rows[1]!.note).toBe("Moved To 25-Jul-2030");
    const across = parseExpiryPaste("2030-04-25\t2030-07-25", ctx);
    expect(across.rows.map((r) => r.value)).toEqual(["2030-04-25", "2030-07-25"]);
  });

  it("rejects more than 10 rows outright", () => {
    const text = Array.from({ length: 11 }, (_, i) => `2030-${String((i % 12) + 1).padStart(2, "0")}-01`).join("\n");
    const r = parseExpiryPaste(text, ctx);
    expect(r.ok).toBe(false);
    expect(r.rows).toEqual([]);
    expect(r.error).toMatch(/At most 10 expiries/);
  });

  it("flags a date on or before the Valuation Date, out of order, or not a date", () => {
    // 15-Sep-2026 moves to 24-Sep-2026, before the Valuation Date; 01-Oct-2026 would move to 29-Oct-2026 and pass.
    expect(parseExpiryPaste("2026-10-01", ctx).ok).toBe(true);
    const r = parseExpiryPaste("2026-09-15\n2030-07-25\n2030-04-25\nlater", ctx);
    expect(r.ok).toBe(false);
    expect(r.rows.map((x) => x.error ?? null)).toEqual([
      "Falls on or before the Valuation Date.",
      null,
      "Does not fall after the expiry above.",
      "Not a date. Use 25-Apr-2030 or 2030-04-25.",
    ]);
  });
});

describe("Bulk Edit Strikes", () => {
  it("takes Level %, Option Type and Buy Or Sell, for 5 to 10 rows", () => {
    const r = parseStrikePaste("137\tPut\tSell\n127\tPut\tBuy\n125\tPut\tBuy\n85\tCall\tSell\n84\tPut\tBuy\n70%\tP\tB");
    expect(r.ok).toBe(true);
    expect(r.rows.map((x) => x.value)).toEqual([
      { percent: 137, optionType: "P", side: "S" },
      { percent: 127, optionType: "P", side: "B" },
      { percent: 125, optionType: "P", side: "B" },
      { percent: 85, optionType: "C", side: "S" },
      { percent: 84, optionType: "P", side: "B" },
      { percent: 70, optionType: "P", side: "B" },
    ]);
  });

  it("defaults to Put and leaves the side to the payoff", () => {
    const r = parseStrikePaste("137\n127\n125\n85\n84\n70");
    expect(r.ok).toBe(true);
    expect(r.rows[0]!.value).toEqual({ percent: 137, optionType: "P", side: "" });
  });

  it("rejects too few, too many, rising levels and bad words", () => {
    expect(parseStrikePaste("137\n127\n125\n85").error).toMatch(/Paste 5 to 10 strikes/);
    expect(parseStrikePaste(Array.from({ length: 11 }, (_, i) => String(200 - i)).join("\n")).error).toMatch(/At most 10 strikes/);
    const r = parseStrikePaste("137\n140\n125\t Swap\n85\t Put\t Hold\n84\n70");
    expect(r.rows.map((x) => x.error ?? null)).toEqual([null, "Levels must fall from one row to the next.", "Option Type must be Put or Call.", "Buy Or Sell must be Buy or Sell.", null, null]);
  });
});

describe("Number Of Spreads drives the strikes", () => {
  it("makes n + 4 strikes for 1 to 6 spreads from the desk product, keeping the payoff below the target", () => {
    const base = defaultInputs({ valuationDate: TODAY });
    for (let n = 1; n <= 6; n++) {
      const next = setSpreadCount(base, n, "default");
      expect(next.strikePercents).toHaveLength(n + 4);
      expect(spreadCount(next)).toBe(n);
      expect(next.participations).toHaveLength(n);
      expect(next.participations[n - 1]).toBeNull();
      expect(next.strikePercents.slice(-4)).toEqual(base.strikePercents.slice(-4));
    }
  });

  it("starts blank rows in Blank Inputs", () => {
    const next = setSpreadCount(blankInputs(), 3, "blank");
    expect(next.strikePercents).toHaveLength(7);
    expect(next.strikePercents.every(Number.isNaN)).toBe(true);
    expect(next.strikeOptionTypes.every((t) => t === "")).toBe(true);
    expect(next.participations).toEqual([NaN, NaN, null]);
  });

  it("Blank Inputs asks for the count before any strike", () => {
    const errors = validateDeskInputs(blankInputs(), { today: TODAY });
    expect(errors.find((e) => e.field === "spreadCount")).toMatchObject({ kind: "required", message: "Pick the number of spreads." });
    expect(errors.some((e) => e.field.startsWith("strikePercents."))).toBe(false);
  });
});

describe("Field edits: an invalid value reverts, a valid one sticks", () => {
  const inputs = defaultInputs({ valuationDate: TODAY, spot: 76835.78 });
  const rules = numberFieldRules(inputs);

  it("every rule keeps an in-range value and reverts an out-of-range one", () => {
    for (const rule of rules) {
      fc.assert(
        fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
          const lo = rule.minInclusive ? rule.min : rule.min + (rule.max - rule.min) * 1e-6;
          let v = lo + (rule.max - lo) * t;
          if (rule.integer) v = Math.min(rule.max, Math.max(Math.ceil(lo), Math.round(v)));
          if (rule.step) v = Math.max(rule.step, Math.round(v / rule.step) * rule.step);
          if (v > rule.max) return;
          expect(checkFieldEdit(inputs, rule.field, v), `${rule.field} = ${v}`).toBeNull();
        }),
        { numRuns: 40 },
      );
      fc.assert(
        fc.property(fc.double({ min: 1e-6, max: 1e6, noNaN: true }), (gap) => {
          const result = checkFieldEdit(inputs, rule.field, rule.max + gap);
          expect(result, `${rule.field} = max + ${gap}`).not.toBeNull();
          expect(result!.range).toBeTruthy();
        }),
        { numRuns: 20 },
      );
      expect(checkFieldEdit(inputs, rule.field, rule.min - 1)).not.toBeNull();
    }
  });

  it("the hedge strike must be a multiple of 100, and a blank field is kept for Run to report", () => {
    expect(checkFieldEdit(inputs, "hedgeStrike", 77300)).toBeNull();
    expect(checkFieldEdit(inputs, "hedgeStrike", 77350)?.message).toBe("Hedge Strike must be a multiple of 100.");
    expect(checkFieldEdit(inputs, "hedgeStrike", NaN)).toBeNull();
  });

  it("an expiry must fall after the Valuation Date and keep the order", () => {
    expect(checkFieldEdit(inputs, "expiryDates.1", "2026-10-01")?.message).toBe("Expiry 2 must fall after the Valuation Date.");
    expect(checkFieldEdit(inputs, "expiryDates.1", inputs.expiryDates[0]!)?.message).toBe("Expiry 2 must fall after Expiry 1.");
    expect(checkFieldEdit(inputs, "expiryDates.1", inputs.expiryDates[2]!)?.message).toBe("Expiry 2 must fall before Expiry 3.");
    expect(checkFieldEdit(inputs, "expiryDates.1", inputs.expiryDates[1]!)).toBeNull();
  });
});

describe("Fill order", () => {
  it("opens step 2 after the Underlying and Valuation Date, step 3 after the expiries, then the rest", () => {
    let d = blankInputs();
    expect(unlockedSteps(validateDeskInputs(d, { today: TODAY }))).toBe(1);
    d = { ...d, underlying: "Sensex", valuationDate: TODAY };
    expect(unlockedSteps(validateDeskInputs(d, { today: TODAY }))).toBe(2);
    d = { ...d, expiryCount: 2, expiryDates: ["2030-04-25", "2030-07-25"] };
    expect(unlockedSteps(validateDeskInputs(d, { today: TODAY }))).toBe(3);
    const full = defaultInputs({ valuationDate: TODAY });
    d = { ...d, strikePercents: full.strikePercents, participations: full.participations, strikeOptionTypes: full.strikeOptionTypes, strikeSides: full.strikeSides };
    expect(unlockedSteps(validateDeskInputs(d, { today: TODAY }))).toBe(7);
  });

  it("a broken rule across fields never locks a later step", () => {
    const full = defaultInputs({ valuationDate: TODAY });
    const broken = { ...full, strikePercents: Object.assign([...full.strikePercents], { 1: 140 }) };
    const errors = validateDeskInputs(broken, { today: TODAY });
    expect(errors.some((e) => e.section === "Strikes And Spreads" && e.kind === "invalid")).toBe(true);
    expect(unlockedSteps(errors)).toBe(7);
  });
});
