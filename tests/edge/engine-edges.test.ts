import ExcelJS from "exceljs";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { annualVolFromDaily } from "@/lib/engine/volatility";
import { autoHedgeStrike, seedMarketData } from "@/lib/engine/defaults";
import { expiryForMonth, resizeList, snapExpiry, validateSchedule } from "@/lib/engine/schedule";
import { derivedSides, validateStructure } from "@/lib/engine/structure";
import type { HedgeInputs, HedgingResult, MarketData } from "@/lib/engine/types";
import { deepMismatchCount, DEEP_MONEYNESS, normalizeVolSurface } from "@/lib/engine/vol-surface";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { excelCellDisplayLength } from "@/lib/excel/export-theme";
import { croreText, numberText, percentText } from "@/lib/format";
import type { DeskInputs } from "@/lib/inputs/draft";
import { removeStrike, setSpreadCount } from "@/lib/inputs/strikes";
import { checkFieldEdit, validateDeskInputs } from "@/lib/validation/inputRules";

import { FIXTURE_DATE, fixtureInputs } from "../helpers/fixture";

const solver = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/engine/solver", async (original) => {
  const real = await original<typeof import("@/lib/engine/solver")>();
  return {
    brentSolve: (...args: Parameters<typeof real.brentSolve>) => (solver.fail ? { root: Number.NaN, iterations: 61, converged: false } : real.brentSolve(...args)),
  };
});

const desk = (overrides: Partial<HedgeInputs> = {}) => fixtureInputs(overrides) as DeskInputs;
const run = (inputs: HedgeInputs, market: MarketData = seedMarketData()) => computeHedgingSheet(inputs, market);

/** Every number anywhere in a result, with its path. */
function badNumbers(value: unknown, path = "result", out: string[] = []): string[] {
  if (typeof value === "number" && !Number.isFinite(value)) out.push(`${path} = ${value}`);
  else if (Array.isArray(value)) value.forEach((v, i) => badNumbers(v, `${path}.${i}`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) badNumbers(v, `${path}.${k}`, out);
  return out;
}

function expectPriced(r: ReturnType<typeof run>): HedgingResult {
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  expect(badNumbers(r).slice(0, 5)).toEqual([]);
  return r;
}

/** Ten monthly expiries from the fixture date, all before maturity. */
const tenExpiries = Array.from({ length: 10 }, (_, i) => expiryForMonth(FIXTURE_DATE, (i + 1) * 3, "Sensex"));

/** The largest book the desk allows: 10 expiries and 6 spreads, so 10 strikes. */
function maximumBook(): HedgeInputs {
  const base = fixtureInputs({ expiryCount: 10, expiryDates: tenExpiries });
  const strikes = setSpreadCount(base as DeskInputs, 6, "default");
  const merged = { ...base, ...strikes } as HedgeInputs;
  return { ...merged, strikeOptionTypes: merged.strikePercents.map(() => "P"), strikeSides: derivedSides(merged) };
}

describe("Edge · Spot", () => {
  it("Exactly A Multiple Of 100 After Times 1.006 Stays On It: 74,600 / 1.006 Gives 74,600", () => {
    expect(autoHedgeStrike(74600 / 1.006, "Sensex")).toBe(74600);
  });

  it("Nifty 22,850 Plus 150 Lands On 23,000 Exactly", () => {
    expect(autoHedgeStrike(22850, "Nifty")).toBe(23000);
  });

  it("Missing Is Kept For Run To Report, And Run Lists It As Required", () => {
    expect(checkFieldEdit(desk(), "spot", Number.NaN)).toBeNull();
    const errors = validateDeskInputs({ ...desk(), spot: Number.NaN }, { today: FIXTURE_DATE });
    expect(errors.find((e) => e.field === "spot")).toMatchObject({ kind: "required" });
  });

  it("0, Negative And Non Numeric Are Reverted With The Allowed Range", () => {
    for (const value of [0, -76000, "abc"]) {
      const r = checkFieldEdit(desk(), "spot", value);
      expect(r?.message, String(value)).toMatch(/Sensex Spot (must be above 0|is required)/);
      expect(r?.range).toBe("Above 0 To 10,00,000");
    }
  });

  it("0 Or Negative Never Reaches The Engine As NaN: The Engine Refuses It", () => {
    for (const spot of [0, -1]) {
      const r = run(fixtureInputs({ spot, hedgeStrike: 100 }));
      expect(r.ok, String(spot)).toBe(false);
    }
  });
});

describe("Edge · Hedge Strike", () => {
  it("A Floating Point Product Just Above A Multiple Of 100 Rounds To That Multiple, Never The Next", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 2000 }), (hundreds) => autoHedgeStrike((hundreds * 100) / 1.006, "Sensex") === hundreds * 100),
      { numRuns: 400 },
    );
  });

  it("A Manual Override That Is Not A Multiple Of 100, Or Is Negative, Is Reverted", () => {
    expect(checkFieldEdit(desk(), "hedgeStrike", 76850)?.message).toBe("Hedge Strike must be a multiple of 100.");
    expect(checkFieldEdit(desk(), "hedgeStrike", -76800)?.message).toMatch(/Hedge Strike must be above 0/);
    expect(checkFieldEdit(desk(), "hedgeStrike", 76900)).toBeNull();
  });
});

describe("Edge · Expiries", () => {
  it("A Month Whose 31st Is A Thursday Keeps The 31st: January 2030", () => {
    expect(snapExpiry("2030-01-09", "Sensex")).toBe("2030-01-31");
  });

  it("February In A Leap Year And In Other Years", () => {
    expect(snapExpiry("2024-02-05", "Sensex")).toBe("2024-02-29");
    expect(snapExpiry("2028-02-10", "Sensex")).toBe("2028-02-24");
    expect(snapExpiry("2027-02-10", "Sensex")).toBe("2027-02-25");
  });

  it("A Typed Mid Month Date Snaps To The Last Thursday, Or The Last Tuesday For Nifty", () => {
    expect(snapExpiry("2027-03-15", "Sensex")).toBe("2027-03-25");
    expect(snapExpiry("2027-03-15", "Nifty")).toBe("2027-03-30");
  });

  it("An Expiry On Or Before The Valuation Date Is Refused", () => {
    for (const d of [FIXTURE_DATE, "2026-09-24"]) {
      expect(checkFieldEdit(desk(), "expiryDates.0", d)?.message).toBe("Expiry 1 must fall after the Valuation Date.");
      const codes = validateSchedule(fixtureInputs({ expiryDates: [d, ...fixtureInputs().expiryDates.slice(1)] })).errors.map((e) => e.code);
      expect(codes).toContain("expiry-past");
    }
  });

  it("Duplicates And A Non Ascending Order Are Refused", () => {
    const dates = fixtureInputs().expiryDates;
    const duplicate = validateSchedule(fixtureInputs({ expiryDates: [dates[0]!, dates[0]!, ...dates.slice(2)] })).errors;
    expect(duplicate.map((e) => e.code)).toContain("expiry-order");
    const swapped = validateSchedule(fixtureInputs({ expiryDates: [dates[1]!, dates[0]!, ...dates.slice(2)] })).errors;
    expect(swapped.map((e) => e.code)).toContain("expiry-order");
    expect(checkFieldEdit(desk(), "expiryDates.1", dates[0]!)?.message).toBe("Expiry 2 must fall after Expiry 1.");
  });

  it("A Count Of 1 And A Count Of 10 Both Price With No NaN", () => {
    expectPriced(run(fixtureInputs({ expiryCount: 1, expiryDates: [tenExpiries[4]!], hedgeExpiryIndex: null })));
    const ten = expectPriced(run(fixtureInputs({ expiryCount: 10, expiryDates: tenExpiries, hedgeExpiryIndex: null })));
    expect(ten.schedule.expiries).toHaveLength(10);
  });

  it("Going From 10 Down To 1 Keeps Expiry 1, And Back Up Leaves The New Rows To Fill", () => {
    const down = resizeList(tenExpiries, 1, "");
    expect(down).toEqual([tenExpiries[0]]);
    expect(resizeList(down, 10, "")).toEqual([tenExpiries[0], ...Array.from({ length: 9 }, () => "")]);
  });
});

describe("Edge · Strikes And Spreads", () => {
  it("A Strike % Of 0, Negative Or Very Large Is Reverted", () => {
    expect(checkFieldEdit(desk(), "strikePercents.2", 0)?.message).toBe("Strike 3 must be above 0 and at most 500.");
    expect(checkFieldEdit(desk(), "strikePercents.2", -10)?.message).toBe("Strike 3 must be above 0 and at most 500.");
    expect(checkFieldEdit(desk(), "strikePercents.2", 10_000)?.message).toBe("Strike 3 must be above 0 and at most 500.");
  });

  it("Duplicate Strikes Are Refused As Out Of Order", () => {
    const k = [...fixtureInputs().strikePercents];
    k[2] = k[1]!;
    const issues = validateStructure(fixtureInputs({ strikePercents: k }));
    expect(issues.map((i) => i.code)).toContain("strike-order");
  });

  it("A Spread Never Points To A Deleted Strike: Removing One Joins Its Two Spreads", () => {
    const book = maximumBook();
    const removed = removeStrike(book as DeskInputs, 3, "default")!;
    expect(removed.strikePercents).toHaveLength(book.strikePercents.length - 1);
    expect(removed.participations).toHaveLength(book.participations.length - 1);
    expect(removed.participations.at(-1)).toBeNull();
    expectPriced(run({ ...book, ...removed } as HedgeInputs));
  });

  it("All Calls, All Puts And Mixed Buy And Sell All Price With No NaN", () => {
    const n = fixtureInputs().strikePercents.length;
    expectPriced(run(fixtureInputs({ strikeOptionTypes: Array.from({ length: n }, () => "C") })));
    expectPriced(run(fixtureInputs({ strikeOptionTypes: Array.from({ length: n }, () => "P") })));
    const sides = fixtureInputs().strikeSides;
    expect(new Set(sides).size).toBe(2);
  });

  it("10 Strikes With 6 Spreads And 10 Expiries, The Largest Book, Prices With No NaN", () => {
    const book = maximumBook();
    expect(book.strikePercents).toHaveLength(10);
    const r = expectPriced(run(book));
    expect(r.pricer.legs).toHaveLength(10 * 10);
  });
});

describe("Edge · Volatility", () => {
  it("Daily Or Annual At 0, Negative Or Extreme Such As 500% Is Reverted", () => {
    for (const v of [0, -0.01, 5]) {
      expect(checkFieldEdit(desk(), "dailyVol", v)?.message, `daily ${v}`).toMatch(/Sensex Daily Volatility must be above 0% and at most 10%/);
      expect(checkFieldEdit(desk(), "annualVol", v)?.message, `annual ${v}`).toMatch(/Sensex Annual Volatility must be above 0% and at most 191\.05%/);
    }
    expect(checkFieldEdit(desk(), "annualVol", annualVolFromDaily(0.009))).toBeNull();
  });
});

describe("Edge · Rates And Terms", () => {
  it("A 0% Rate Prices With No NaN", () => {
    expect(checkFieldEdit(desk(), "nbfcRate", 0)).toBeNull();
    expectPriced(run(fixtureInputs({ nbfcRate: 0, premiumRate: 0, marginGrowthRate: 0 })));
  });

  it("A 100% NBFC Rate Prices; A 100% Premium Or Margin Growth Rate Is Could Not Solve, Never A Huge Number", () => {
    expect(checkFieldEdit(desk(), "nbfcRate", 1)).toBeNull();
    const nbfc = expectPriced(run(fixtureInputs({ nbfcRate: 1 })));
    expect(Math.abs(nbfc.summary.actualInbuilt)).toBeLessThanOrEqual(1);
    for (const patch of [{ premiumRate: 1 }, { marginGrowthRate: 1 }, { nbfcRate: 1, premiumRate: 1, marginGrowthRate: 1 }]) {
      const r = run(fixtureInputs(patch));
      expect(r.ok, JSON.stringify(patch)).toBe(false);
      if (!r.ok) expect(r.errors[0]).toMatchObject({ code: "goal-seek", message: expect.stringMatching(/^Could Not Solve: /) });
    }
  });

  it("Any Rate From 0% To 100% Either Prices An Inbuilt Within The Notional Or Is Could Not Solve", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom("nbfcRate", "premiumRate", "marginGrowthRate"), (rate, key) => {
        const r = run(fixtureInputs({ [key]: rate }));
        if (!r.ok) return r.errors[0]!.code === "goal-seek";
        return Math.abs(r.summary.actualInbuilt) <= 1 && badNumbers(r).length === 0;
      }),
      { numRuns: 40 },
    );
  });

  it("A Tenor Of 0 Is Refused", () => {
    expect(checkFieldEdit(desk(), "tenorDays", 0)?.message).toBe("Tenor In Days must be at least 1 and at most 3,650.");
    const r = run(fixtureInputs({ tenorDays: 0 }));
    expect(r.ok).toBe(false);
  });

  it("A Tenor Longer Than The Surface Prices, Reads The Last Row And Is Flagged", () => {
    const market = seedMarketData();
    const last = market.surface.expiries.at(-1)!.slice(0, 10);
    const later = expiryForMonth(last, 3, "Sensex");
    const dates = [...fixtureInputs().expiryDates.slice(0, 5), later];
    const r = expectPriced(run(fixtureInputs({ tenorDays: 3650, expiryDates: dates }), market));
    expect(r.warnings.find((w) => w.code === "expiry-surface")?.message).toMatch(/after the last surface row/);
  });

  it("A Coupon Of 0 And A Decay Of 0 Are Reverted", () => {
    expect(checkFieldEdit(desk(), "coupon", 0)?.message).toBe("Coupon must be above 0% and at most 1000%.");
    expect(checkFieldEdit(desk(), "decay", 0)?.message).toBe("Decay must be above 0 and at most 10.");
  });
});

describe("Edge · Surface", () => {
  it("Deep Equal To The 55% Column Needs No Adjustment, And Any Other Deep Is Set To It", () => {
    const surface = seedMarketData().surface;
    expect(deepMismatchCount(surface)).toBe(0);
    const col = surface.moneyness.findIndex((m) => Math.abs(m - DEEP_MONEYNESS) < 1e-9) + 1;
    const off = { ...surface, volsPercent: surface.volsPercent.map((row) => [row[col]! + 7, ...row.slice(1)]) };
    expect(deepMismatchCount(off)).toBe(surface.expiries.length);
    expect(normalizeVolSurface(off).volsPercent.every((row) => row[0] === row[col])).toBe(true);
  });

  it("Tenors Before The First Row Are Clamped To It And Flagged", () => {
    const market = seedMarketData();
    const surface = { ...market.surface, expiries: market.surface.expiries.slice(8), volsPercent: market.surface.volsPercent.slice(8) };
    const first = surface.expiries[0]!.slice(0, 10);
    const early = expiryForMonth(FIXTURE_DATE, 1, "Sensex");
    expect(early < first).toBe(true);
    const dates = [early, ...fixtureInputs().expiryDates.slice(1)];
    const r = expectPriced(run(fixtureInputs({ expiryDates: dates }), { ...market, surface }));
    expect(r.warnings.find((w) => /before the first surface row/.test(w.message))).toBeTruthy();
  });
});

describe("Edge · Goal Seek", () => {
  it("No Solution In Range Shows Could Not Solve With A Reason, And Returns At Once", () => {
    solver.fail = true;
    try {
      const started = performance.now();
      const r = run(fixtureInputs());
      expect(performance.now() - started).toBeLessThan(2000);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors[0]).toMatchObject({ field: "coupon", code: "goal-seek" });
      expect(r.errors[0]!.message).toMatch(/^Could Not Solve: no Inbuilt makes the achieved coupon equal the target of \d+\.\d{2}% after \d+ tries\.$/);
    } finally {
      solver.fail = false;
    }
  });

  it("Any Reachable Coupon Either Solves To A Finite Inbuilt Or Fails With A Named Reason, Never Hanging", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 0.5, noNaN: true }), (coupon) => {
        const r = run(fixtureInputs({ coupon, strikeSides: undefined }));
        if (r.ok) return Number.isFinite(r.summary.actualInbuilt);
        return r.errors.length > 0 && r.errors.every((e) => e.message.length > 0);
      }),
      { numRuns: 25 },
    );
  });
});

describe("Edge · Downloads", () => {
  it("The Largest Book Builds Every Sheet, And No Cell Is Clipped: Each Fits Its Column Or Wraps", async () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, expectPriced(run(maximumBook())), null);
    const clipped: string[] = [];
    wb.eachSheet((ws) =>
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          if (cell.isMerged || cell.value == null) return;
          const width = ws.getColumn(cell.col).width ?? 10;
          if (excelCellDisplayLength(cell) <= width) return;
          if (typeof cell.value === "string" && cell.alignment?.wrapText) return;
          clipped.push(`${ws.name}!${cell.address} (${excelCellDisplayLength(cell)} > ${width})`);
        }),
      ),
    );
    expect(clipped.slice(0, 10)).toEqual([]);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(reopened.worksheets.length).toBeGreaterThan(5);
  });
});

describe("Edge · Display", () => {
  it("Never Shows NaN, Infinity, An Exponent, -0.000 Or More Than 3 Decimals, For Any Number", () => {
    fc.assert(
      fc.property(fc.oneof(fc.double(), fc.constantFrom(-0, -1e-12, 1e-12, 1e15, -1e15, Number.MAX_VALUE)), fc.integer({ min: 0, max: 6 }), (v, digits) =>
        [numberText(v, digits), percentText(v, digits), croreText(v, digits)].every(({ text }) => {
          if (text === "-") return !Number.isFinite(v);
          return !/NaN|Infinity|e[+-]|^-0(\.0+)?%?$|₹ -0(\.0+)?$|\.\d{4,}/.test(text);
        }),
      ),
      { numRuns: 2000 },
    );
  });

  it("Very Large And Very Small Numbers Read In Full With Indian Grouping", () => {
    expect(numberText(1_23_45_67_890.1234, 3).text).toBe("1,23,45,67,890.123");
    expect(numberText(0.0004, 3).text).toBe("0.000");
    expect(numberText(-0.0004, 3).text).toBe("0.000");
  });
});
