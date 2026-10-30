import fc from "fast-check";
import { describe, it } from "vitest";

import { annualVolFromDaily, dailyVolFromAnnual } from "@/lib/engine/hedging-sheet";
import type { DeskInputs } from "@/lib/inputs/draft";
import { splitKeys } from "@/lib/inputs/run-keys";
import { checkFieldEdit, numberFieldRules } from "@/lib/validation/inputRules";

import { fixtureInputs } from "../helpers/fixture";

const desk = () => fixtureInputs() as DeskInputs;

describe("properties", () => {
  it("Annual equals Daily times the square root of 365, and back", () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-6, max: 0.1, noNaN: true }), (daily) => {
        const annual = annualVolFromDaily(daily);
        return Math.abs(annual - daily * Math.sqrt(365)) < 1e-12 && Math.abs(dailyVolFromAnnual(annual) - daily) < 1e-12;
      }),
      { numRuns: 1000 },
    );
  });

  it("an invalid value reverts and a valid one sticks, for every number field", () => {
    const rules = numberFieldRules(desk());
    fc.assert(
      fc.property(fc.constantFrom(...rules), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 1e-6, max: 1e6, noNaN: true }), (rule, t, beyond) => {
        // A valid value inside the range, on the rule's step and whole when it must be.
        let inside = rule.min + (rule.max - rule.min) * (0.01 + 0.98 * t);
        if (rule.step) inside = Math.max(rule.step, Math.round(inside / rule.step) * rule.step);
        else if (rule.integer) inside = Math.max(Math.ceil(rule.min) + (rule.minInclusive ? 0 : 1), Math.round(inside));
        const above = rule.max + beyond;
        const below = rule.minInclusive ? rule.min - beyond : rule.min - beyond / 2;
        return checkFieldEdit(desk(), rule.field, inside) === null && checkFieldEdit(desk(), rule.field, above) !== null && checkFieldEdit(desk(), rule.field, below) !== null;
      }),
      { numRuns: 1000 },
    );
  });

  it("a change to any input marks the last run stale, and an output tab override does not", () => {
    const base = desk();
    const fields = numberFieldRules(base)
      .map((r) => r.field)
      .filter((f) => !f.includes("."));
    fc.assert(
      fc.property(fc.constantFrom(...fields), fc.double({ min: 1e-3, max: 10, noNaN: true }), (field, bump) => {
        const changed = { ...base, [field]: (base[field as keyof DeskInputs] as number) + bump };
        const overridden = { ...base, hedgeVolOverride: 0.2 + bump / 100 };
        return splitKeys(changed).inputsKey !== splitKeys(base).inputsKey && splitKeys(overridden).inputsKey === splitKeys(base).inputsKey;
      }),
      { numRuns: 500 },
    );
  });
});
