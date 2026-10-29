import { describe, expect, it } from "vitest";

import { bsPrice } from "@/lib/engine/black-scholes";
import { annualVolFromDaily, dailyVolFromAnnual } from "@/lib/engine/hedging-sheet";
import { EXPIRY_WEEKDAY, expiryForMonth, medianExpiryIndex, rawExpiryDate } from "@/lib/engine/schedule";
import { bookReturn, clientReturn, deriveTerms, payoffLevels, validateStructure } from "@/lib/engine/structure";
import type { HedgeInputs, Underlying } from "@/lib/engine/types";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import { fieldTestId, groupBySection, INPUT_SECTIONS, numberFieldRules, requiredFields, validateDeskInputs } from "@/lib/inputs/validate";

import defaults from "../fixtures/default-inputs.json";
import invalid from "../fixtures/invalid-cases.json";
import { blankFillInputs, priceLikeTheApp } from "../helpers/mock-market";

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
    for (const key of ["underlying", "valuationDate", "spot", "nbfcRate", "coupon", "decay", "floorUnits", "tenorDays", "startLevelUplift", "expiryCount", "spreadOptionTypes.0", "spreadOptionTypes.1", "notionalCr", "transactionCost", "dailyVol", "stressSigmas", "stressDays", "stressVolMultiplier", "exposureMargin", "futuresMargin"]) {
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

describe("Blank Inputs suite, unit level", () => {
  const filled = blankFillInputs();
  const errorsFor = (patch: Partial<HedgeInputs>) => validateDeskInputs({ ...filled, ...patch }, { today: TODAY });

  it("B2.1 the required field list covers every field, month row, strike and typed participation", () => {
    const fields = requiredFields(6, 2).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["underlying", "valuationDate", "expiryCount", "spreadOptionTypes.0", "spreadOptionTypes.1", "participations.0"]));
    for (const r of numberFieldRules(filled)) expect(fields, r.field).toContain(r.field);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("B2.1 clearing any one required field leaves exactly that field in the list", () => {
    for (const { field } of requiredFields(6, 2)) {
      if (["underlying", "expiryCount"].includes(field)) continue;
      const [base, index] = field.split(".");
      const patch: Record<string, unknown> =
        index != null
          ? { [base!]: (filled[base as keyof HedgeInputs] as number[]).map((v, i) => (i === Number(index) ? NaN : v)) }
          : { [field]: field === "valuationDate" ? "" : NaN };
      const errors = errorsFor(patch as Partial<HedgeInputs>);
      expect(errors.map((e) => e.field), field).toEqual([field]);
      expect(errors[0]!.kind).toBe("required");
    }
  });

  it("B3.8 an invalid date and a future valuation date are rejected", () => {
    for (const valuationDate of ["2026-02-30", "2026-13-01", "28-10-2026"]) {
      expect(errorsFor({ valuationDate }).find((e) => e.field === "valuationDate")?.message).toContain("not a valid date");
    }
    expect(errorsFor({ valuationDate: "2026-10-29" }).find((e) => e.field === "valuationDate")?.message).toContain("future");
    expect(errorsFor({ valuationDate: TODAY })).toEqual([]);
  });

  it("B4.1 strikes out of order at each adjacent pair name both strikes", () => {
    for (let i = 0; i < 5; i++) {
      const k = [...filled.strikePercents];
      k[i + 1] = k[i]! + 1;
      const hit = errorsFor({ strikePercents: k }).find((e) => e.field === `strikePercents.${i + 1}`);
      expect(hit?.message, `pair ${i + 1} and ${i + 2}`).toContain(`Strike ${i + 2}`);
      expect(hit?.message).toContain(`Strike ${i + 1}`);
      expect(hit?.code).toBe("strike-order");
    }
  });

  it("B4.2 equal strikes are rejected", () => {
    const k = [...filled.strikePercents];
    k[3] = k[2]!;
    expect(errorsFor({ strikePercents: k }).find((e) => e.field === "strikePercents.3")?.message).toContain("strictly descending");
  });

  it("B4.3 a strike of zero or below is rejected", () => {
    for (const v of [0, -10]) {
      const k = [...filled.strikePercents];
      k[5] = v;
      expect(errorsFor({ strikePercents: k }).find((e) => e.field === "strikePercents.5")?.kind).toBe("invalid");
    }
  });

  it("B5.2 months that do not increase or repeat are rejected", () => {
    for (const months of [[41, 44, 43, 50, 53, 56], [41, 44, 44, 50, 53, 56]]) {
      expect(errorsFor({ expiryMonths: months }).find((e) => e.field === "expiryMonths.2")?.code).toBe("expiry-order");
    }
  });

  it("B5.5 the option expiry is the median, the lower middle one for an even count", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(medianExpiryIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  describe("B6.1 expiry weekday rule", () => {
    /** Independent of the engine: search the seven days around the raw date for the weekday. */
    const expected = (valuation: string, month: number, weekday: number) => {
      const raw = new Date(`${valuation}T00:00:00Z`);
      raw.setUTCDate(raw.getUTCDate() + Math.round(month * 30.5));
      for (let shift = -3; shift <= 3; shift++) {
        const d = new Date(raw);
        d.setUTCDate(d.getUTCDate() + shift);
        if (d.getUTCDay() === weekday) return { date: d.toISOString().slice(0, 10), shift };
      }
      throw new Error("no weekday within 3 days");
    };
    const months = [1, 3, 6, 12, 24, 36, 48, 60];
    const valuations = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
    for (const u of ["Sensex", "Nifty"] as Underlying[]) {
      it(`${u} expires on ${u === "Sensex" ? "Thursday" : "Tuesday"} for months ${months.join(", ")}`, () => {
        const shifts = new Set<number>();
        for (const v of valuations) {
          for (const m of months) {
            const e = expected(v, m, EXPIRY_WEEKDAY[u]);
            shifts.add(e.shift);
            expect(expiryForMonth(v, m, EXPIRY_WEEKDAY[u]), `${u} ${v} month ${m}`).toBe(e.date);
          }
        }
        expect([...shifts].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
      });
    }
    it("hand-checked: 28-Oct-2026 month 1 is raw 28-Nov-2026, a Saturday", () => {
      expect(rawExpiryDate("2026-10-28", 1)).toBe("2026-11-28");
      expect(expiryForMonth("2026-10-28", 1, EXPIRY_WEEKDAY.Sensex)).toBe("2026-11-26");
      expect(expiryForMonth("2026-10-28", 1, EXPIRY_WEEKDAY.Nifty)).toBe("2026-12-01");
    });
  });

  it("B7.4 and B7.5 spreads share their strikes, so a sell level not above the buy level is a strike order error and no gap can open", () => {
    const terms = deriveTerms(filled);
    expect(terms.spreads[0]!.sell).toBeCloseTo(terms.spreads[1]!.buy, 12);
    const k = [...filled.strikePercents];
    k[1] = k[2]!;
    expect(validateStructure({ ...filled, strikePercents: k }).map((e) => e.code)).toEqual(["strike-order"]);
  });

  it("B7.6 a participation of zero or below is rejected", () => {
    for (const p of [0, -1]) expect(errorsFor({ participations: [p, null] }).find((e) => e.field === "participations.0")?.kind).toBe("invalid");
  });

  it("B8.2 put-call parity holds on a single leg", () => {
    const args = { spot: 76835.78, strike: 70000, days: 1500, growth: 0.055, discount: 0.065, vol: 0.18 };
    const call = bsPrice({ ...args, type: "C" });
    const put = bsPrice({ ...args, type: "P" });
    const fwd = args.spot * Math.exp((args.growth * args.days) / 365);
    const df = Math.exp((-args.discount * args.days) / 365);
    expect(call - put).toBeCloseTo((fwd - args.strike) * df, 6);
  });

  it("B9.1 an unreachable coupon is reported on the Coupon with a suggestion", () => {
    // Overridden top participation that falls short, and a lower spread that alone pays more than the coupon.
    for (const participations of [[1, 2], [60, null]] as Array<Array<number | null>>) {
      const hit = errorsFor({ participations }).find((e) => e.code === "coupon-unreachable");
      expect(hit?.field, JSON.stringify(participations)).toBe("coupon");
      expect(hit?.fix).toBeTruthy();
    }
  });

  it("B9.2 a coupon at the reachable boundary converges with a residual below 1e-9", () => {
    const lower = deriveTerms(filled).spreads[0]!;
    const coupon = (lower.sell - lower.buy) * lower.participation + 1e-4;
    expect(errorsFor({ coupon })).toEqual([]);
    const r = priceLikeTheApp({ ...filled, coupon });
    expect(r.diagnostics.goalSeekResidual).toBeLessThan(1e-9);
  });

  it("B10.1 to B10.5 protection, floor, floor units and start uplift rules", () => {
    const n = 2;
    const withStrike = (i: number, v: number) => filled.strikePercents.map((x, j) => (j === i ? v : x));
    expect(errorsFor({ strikePercents: [137, 127, 125, 101, 100, 70] }).map((e) => e.code)).toContain("protection");
    // A floor at or above protection less the step sits at or above Strike 5, so the strike order catches it first.
    for (const floor of [84, 90]) {
      expect(errorsFor({ strikePercents: withStrike(n + 3, floor) }).map((e) => e.code), `floor ${floor}`).toContain("strike-order");
    }
    expect(errorsFor({ strikePercents: withStrike(n + 3, 83.5) })).toEqual([]);
    expect(errorsFor({ floorUnits: 1.7 }).map((e) => e.code)).toContain("floor-units");
    expect(deriveTerms({ ...filled, strikePercents: withStrike(n + 3, 65) }).floorLevel).toBeCloseTo(0.65, 12);
    expect(errorsFor({ startLevelUplift: 0 })).toEqual([]);
    expect(errorsFor({ startLevelUplift: -0.01 }).find((e) => e.field === "startLevelUplift")?.kind).toBe("invalid");
  });

  it("B11.1 and B11.2 annual volatility is daily times the square root of 365, both ways", () => {
    for (const daily of [0.005, 0.008737487838572993, 0.02]) {
      expect(Math.abs(annualVolFromDaily(daily) - daily * Math.sqrt(365))).toBeLessThan(1e-12);
      expect(Math.abs(dailyVolFromAnnual(annualVolFromDaily(daily)) - daily)).toBeLessThan(1e-12);
    }
  });

  it("B15.1 payoff levels: every strike, protection and 0.01% below it, zero and every 5% between, sorted", () => {
    const r = priceLikeTheApp(filled);
    const levels = payoffLevels(r.inputs, r.structure.strikes);
    const terms = deriveTerms(r.inputs);
    const has = (x: number) => levels.some((l) => Math.abs(l - x) < 1e-9);
    for (const s of r.structure.strikes) expect(has(s.percent / 100 - 1), `strike ${s.percent}`).toBe(true);
    expect(has(-terms.protection)).toBe(true);
    expect(has(-terms.protection - 0.0001)).toBe(true);
    expect(has(0)).toBe(true);
    for (let x = -0.5; x <= terms.target + 1e-9; x += 0.05) expect(has(Math.round(x * 1e6) / 1e6), `step ${x}`).toBe(true);
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);
  });

  it("B15.4 the payoff at every kink equals the option book payoff", () => {
    const r = priceLikeTheApp(filled);
    const terms = deriveTerms(r.inputs);
    for (const k of r.structure.strikes) {
      const p = k.strike / r.structure.startLevel - 1;
      if (p > -terms.protection - terms.outflowWidth - 1e-9 && p < -terms.protection) continue;
      expect(Math.abs(bookReturn(r.inputs, r.structure.strikes, r.structure.startLevel, p) - clientReturn(r.inputs, p)), `kink ${k.percent}`).toBeLessThan(1e-9);
    }
  });

  it("B16.1 and B16.2 the stress grids have 15 rows from −50% to +20% and their rows sum", () => {
    const r = priceLikeTheApp(filled);
    const moves = Array.from({ length: 15 }, (_, i) => Math.round((-0.5 + 0.05 * i) * 100) / 100);
    expect(r.markToMarket.rows.map((m) => Math.round(m.move * 100) / 100)).toEqual(moves);
    expect(r.dayOneVegaHedge.margin.map((m) => Math.round(m.move * 100) / 100)).toEqual(moves);
    for (const m of r.markToMarket.rows) expect(Math.abs(m.futuresMarginCr + m.markToMarketCr + m.optionsMarginCr - m.totalRequirementCr)).toBeLessThan(1e-9);
    for (const m of r.dayOneVegaHedge.margin) expect(Math.abs(m.initialMarginCr + m.exposureMarginCr - m.totalMarginCr)).toBeLessThan(1e-9);
  });
});
