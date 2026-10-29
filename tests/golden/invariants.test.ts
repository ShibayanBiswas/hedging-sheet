import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { totalLossFall } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs, OptionType } from "@/lib/engine/types";

import { G0_OPTIONS, product, run } from "./cases";
import { bookPayoff, numbersIn, termSheetPayoff, thirtyLevels } from "./independent";

const RUNS = 200;

/** Each case prices whole books; yielding between cases keeps the test worker responsive to the runner. */
const yieldToRunner = () => new Promise<void>((resolve) => setImmediate(resolve));

/** A random valid product: 1 to 4 spreads above the start, a protection strike at or below 100, any option types. */
const products = fc
  .record({
    spreads: fc.integer({ min: 1, max: 4 }),
    bottom: fc.integer({ min: 101, max: 115 }),
    gaps: fc.array(fc.integer({ min: 2, max: 12 }), { minLength: 4, maxLength: 4 }),
    protectionStrike: fc.integer({ min: 70, max: 100 }),
    floorGap: fc.integer({ min: 2, max: 25 }),
    decay: fc.double({ min: 1, max: 2, noNaN: true }),
    floorShare: fc.double({ min: 0, max: 1, noNaN: true }),
    topParticipation: fc.double({ min: 0.5, max: 12, noNaN: true }),
    callMask: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
  })
  .map((g): HedgeInputs => {
    const levels = [g.bottom];
    for (let j = 0; j < g.spreads; j++) levels.push(levels[j]! + g.gaps[j]!);
    const strikePercents = [...levels.reverse(), g.protectionStrike, g.protectionStrike - 1, g.protectionStrike - 1 - g.floorGap];
    const widths = levels
      .slice()
      .reverse()
      .slice(1)
      .map((sell, j, arr) => (sell - (j === 0 ? g.bottom : arr[j - 1]!)) / 100);
    const lower = widths.slice(0, -1).reduce((s, w) => s + w, 0);
    const coupon = lower + widths[widths.length - 1]! * g.topParticipation;
    return product({
      strikePercents,
      participations: [...widths.slice(0, -1).map(() => 1), null],
      coupon,
      decay: g.decay,
      floorUnits: g.decay * g.floorShare,
      strikeOptionTypes: strikePercents.map((_, i): OptionType => (g.callMask[i] ? "C" : "P")),
    });
  });

describe("invariants on random products", () => {
  it(`the option book gives the product payoff, gap below 1e-6, over ${RUNS} products`, async () => {
    await fc.assert(
      fc.asyncProperty(products, async (inputs) => {
        await yieldToRunner();
        const r = run(inputs, undefined, G0_OPTIONS);
        const fall = totalLossFall(inputs);
        expect(r.warnings.some((w) => w.code === "loss-cap")).toBe(fall != null);
        if (fall == null) expect(r.diagnostics.payoffBookGap).toBeLessThan(1e-6);
        for (const p of thirtyLevels(inputs).filter((x) => fall == null || x > -fall)) {
          expect(Math.abs(bookPayoff(r, p) - Math.max(-1, termSheetPayoff(inputs, p)))).toBeLessThan(1e-6);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it(`the solver converges on every one of ${RUNS} products`, async () => {
    await fc.assert(
      fc.asyncProperty(products, async (inputs) => {
        await yieldToRunner();
        const r = run(inputs, undefined, G0_OPTIONS);
        expect(Math.abs(r.diagnostics.goalSeekResidual)).toBeLessThan(1e-6);
      }),
      { numRuns: RUNS },
    );
  });

  it(`Inbuilt falls as the coupon rises, over ${RUNS} products`, async () => {
    await fc.assert(
      fc.asyncProperty(products, fc.double({ min: 0.01, max: 0.5, noNaN: true }), async (inputs, step) => {
        await yieldToRunner();
        const lower = run(inputs, undefined, G0_OPTIONS);
        const higher = run(product({ ...inputs, coupon: inputs.coupon + step, strikeSides: undefined }), undefined, G0_OPTIONS);
        expect(higher.summary.actualInbuilt).toBeLessThan(lower.summary.actualInbuilt);
      }),
      { numRuns: RUNS },
    );
  });

  it(`no NaN and no Infinity reach the result, over ${RUNS} products`, async () => {
    await fc.assert(
      fc.asyncProperty(products, async (inputs) => {
        await yieldToRunner();
        const r = run(inputs, undefined, G0_OPTIONS);
        expect(numbersIn(r).filter(([, n]) => !Number.isFinite(n)).map(([p]) => p)).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  });
});
