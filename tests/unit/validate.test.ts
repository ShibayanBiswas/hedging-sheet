import { describe, expect, it } from "vitest";

import type { HedgeInputs } from "@/lib/engine/types";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import { fieldTestId, groupBySection, INPUT_SECTIONS, validateDeskInputs } from "@/lib/inputs/validate";

import defaults from "../fixtures/default-inputs.json";
import invalid from "../fixtures/invalid-cases.json";

const TODAY = "2026-10-28";
const base = defaults.inputs as unknown as HedgeInputs;

describe("validateDeskInputs", () => {
  it("passes the Default Values inputs", () => {
    expect(validateDeskInputs(base, { today: TODAY })).toEqual([]);
  });

  it("flags every empty field of Blank Inputs as required, grouped by section in page order", () => {
    const errors = validateDeskInputs(blankInputs(), { today: TODAY });
    expect(errors.every((e) => e.kind === "required")).toBe(true);
    const fields = errors.map((e) => e.field);
    for (const key of ["underlying", "valuationDate", "spot", "nbfcRate", "coupon", "decay", "floorUnits", "tenorDays", "startLevelUplift", "expiryCount", "optionType", "notionalCr", "transactionCost", "dailyVol", "stressSigmas", "stressDays", "stressVolMultiplier", "exposureMargin", "futuresMargin"]) {
      expect(fields).toContain(key);
    }
    for (let i = 0; i < 6; i++) expect(fields).toContain(`strikePercents.${i}`);
    const order = errors.map((e) => INPUT_SECTIONS.indexOf(e.section));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(groupBySection(errors)[0]!.title).toBe("Underlying And Market");
  });

  it("asks for the month rows once the expiry count is picked", () => {
    const draft: DeskInputs = { ...blankInputs(), expiryCount: 3, expiryMonths: [NaN, NaN, NaN] };
    const fields = validateDeskInputs(draft, { today: TODAY }).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["expiryMonths.0", "expiryMonths.1", "expiryMonths.2"]));
    expect(fields).not.toContain("expiryCount");
  });

  for (const c of invalid.cases) {
    it(`catches ${c.name}`, () => {
      const errors = validateDeskInputs({ ...base, ...(c.patch as Partial<HedgeInputs>) }, { today: TODAY });
      const hit = errors.find((e) => e.field === c.field);
      expect(hit, JSON.stringify(errors.map((e) => `${e.field}: ${e.message}`))).toBeDefined();
      expect(hit!.label).toBe(c.label);
      expect(hit!.message).toContain(c.message);
      expect(hit!.kind).toBe("invalid");
    });
  }

  it("rejects a number that is not finite and a date that is not a date", () => {
    const errors = validateDeskInputs({ ...base, spot: Infinity, valuationDate: "2026-13-45" }, { today: TODAY });
    expect(errors.find((e) => e.field === "spot")?.message).toContain("finite");
    expect(errors.find((e) => e.field === "valuationDate")?.message).toContain("not a valid date");
  });

  it("maps fields to their input test ids", () => {
    expect(fieldTestId("spot")).toBe("input-spot");
    expect(fieldTestId("strikePercents.2")).toBe("input-strikePercents-2");
    expect(fieldTestId("spreads.0")).toBe("input-spreads-0-sell");
    expect(fieldTestId("spreadCount")).toBe("input-spreadCount-input");
  });
});
