import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import pricingSeed from "@/lib/data/pricing-params-seed.json";
import volSeed from "@/lib/data/vol-surface-seed.json";
import { EXPIRY_WEEKDAY, seedMarketData, workbookDefaultInputs } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { normCdf } from "@/lib/engine/normal";
import { expiryDates, resizeList } from "@/lib/engine/schedule";
import { parseVolSurfaceWorkbook } from "@/lib/workbook/parse-vol-surface";
import { buildVolSurfaceSample } from "@/scripts/build-sample-inputs";

describe("normal distribution", () => {
  it("matches reference values", () => {
    expect(normCdf(0)).toBe(0.5);
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 15);
    expect(normCdf(-1)).toBeCloseTo(0.15865525393145707, 15);
    expect(normCdf(2)).toBeCloseTo(0.9772498680518208, 15);
    expect(normCdf(-5)).toBeCloseTo(2.866515718791939e-7, 20);
  });
});

describe("expiry schedule", () => {
  it("maps the default month numbers to the workbook dates", () => {
    const inputs = workbookDefaultInputs();
    expect(inputs.expiryMonths).toEqual([41, 44, 47, 50, 53, 56]);
    expect(expiryDates(inputs)).toEqual(["2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24"]);
  });

  it("keeps earlier values when the count changes", () => {
    expect(resizeList([41, 44, 47], 5, NaN).slice(0, 3)).toEqual([41, 44, 47]);
    expect(resizeList([41, 44, 47, 50], 2, NaN)).toEqual([41, 44]);
  });

  it("uses the last Tuesday for Nifty", () => {
    const inputs = { ...workbookDefaultInputs(), expiryWeekday: EXPIRY_WEEKDAY.Nifty };
    expect(expiryDates(inputs)[0]).toBe("2030-01-29");
  });
});

describe("validation", () => {
  it("blocks pricing when the strike count differs from the expiry count", () => {
    const base = workbookDefaultInputs();
    const inputs = { ...base, expiryCount: 3, expiryMonths: base.expiryMonths.slice(0, 3), expiryOverrides: [null, null, null] };
    const r = computeHedgingSheet(inputs, seedMarketData());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "strikes")).toBe(true);
  });

  it("rejects month numbers that are not strictly increasing", () => {
    const base = workbookDefaultInputs();
    const r = computeHedgingSheet({ ...base, expiryMonths: [41, 44, 44, 50, 53, 56] }, seedMarketData());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes("strictly increasing"))).toBe(true);
  });

  it("rejects an expiry after maturity", () => {
    const base = workbookDefaultInputs();
    const r = computeHedgingSheet({ ...base, expiryMonths: [41, 44, 47, 50, 53, 70] }, seedMarketData());
    expect(r.ok).toBe(false);
  });

  it("warns when the spreads do not tie to the coupon", () => {
    const base = workbookDefaultInputs();
    const r = computeHedgingSheet({ ...base, autoParticipation: false, spreads: base.spreads.map((s) => ({ ...s, participation: 5 })) }, seedMarketData());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.field === "spreads")).toBe(true);
  });

  it("prices a Nifty book with every number finite", () => {
    const base = workbookDefaultInputs();
    const r = computeHedgingSheet(
      { ...base, underlying: "Nifty", spot: 24000, hedgeStrike: 24000, expiryWeekday: EXPIRY_WEEKDAY.Nifty },
      seedMarketData(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Number.isFinite(r.summary.actualInbuilt)).toBe(true);
      expect(r.pricer.legs.every((l) => Number.isFinite(l.price))).toBe(true);
      expect(r.productDescription.title).toContain("Nifty");
    }
  });
});

describe("vol surface upload", () => {
  it("reads the generated sample back to the seed", async () => {
    const dir = path.join(process.cwd(), "test-results", "samples");
    const file = await buildVolSurfaceSample(dir);
    const buf = fs.readFileSync(file);
    const parsed = parseVolSurfaceWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "2026-08");
    expect(parsed.surface.moneyness).toEqual(volSeed.moneyness);
    expect(parsed.surface.expiries).toEqual(volSeed.expiries);
    expect(parsed.surface.referenceSensexPrice).toBeCloseTo(volSeed.referenceSensexPrice, 6);
    parsed.surface.volsPercent.forEach((row, r) =>
      row.forEach((v, c) => expect(v).toBeCloseTo(Math.round(volSeed.volsPercent[r]![c]! * 100) / 100, 6)),
    );
    expect(parsed.surface.pricingParams.length).toBe(volSeed.pricingParams.length);
    expect(parsed.params.rateCapBuyingForward).toBeCloseTo(pricingSeed.rateCapBuyingForward, 9);
    expect(parsed.params.rateCurve?.length).toBe(pricingSeed.rateCurve.length);
    expect(parsed.params.dividends?.length).toBe(pricingSeed.dividends.length);
  });
});
