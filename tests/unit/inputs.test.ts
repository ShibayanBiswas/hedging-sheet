import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import pricingSeed from "@/lib/data/pricing-params-seed.json";
import volSeed from "@/lib/data/vol-surface-seed.json";
import { istTodayYmd } from "@/lib/engine/dates";
import { seedMarketData } from "@/lib/engine/defaults";
import { normCdf } from "@/lib/engine/normal";
import type { VolSurface } from "@/lib/engine/types";
import { deepMismatchCount, forwardMarket, normalizeVolSurface } from "@/lib/engine/vol-surface";
import { resizeList } from "@/lib/engine/schedule";
import { checkInputShape } from "@/lib/engine/input-schema";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";
import { buildVolSurfaceSample } from "@/scripts/build-sample-inputs";

import { fixtureInputs } from "../helpers/fixture";

describe("normal distribution", () => {
  it("matches reference values", () => {
    expect(normCdf(0)).toBe(0.5);
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 15);
    expect(normCdf(-1)).toBeCloseTo(0.15865525393145707, 15);
    expect(normCdf(2)).toBeCloseTo(0.9772498680518208, 15);
    expect(normCdf(-5)).toBeCloseTo(2.866515718791939e-7, 20);
  });
});

describe("input lists", () => {
  it("keeps earlier values when the count changes", () => {
    expect(resizeList([41, 44, 47], 5, NaN).slice(0, 3)).toEqual([41, 44, 47]);
    expect(resizeList([41, 44, 47, 50], 2, NaN)).toEqual([41, 44]);
  });

  it("accepts the default inputs through the schema", () => {
    expect(checkInputShape(fixtureInputs())).toEqual([]);
  });
});

describe("Deep volatility", () => {
  it("equals the 55% volatility on every row, and a different Deep in a file is set to it and counted", () => {
    const changed = { ...volSeed, volsPercent: volSeed.volsPercent.map((row, r) => (r < 3 ? [row[0]! + 5, ...row.slice(1)] : row)) } as unknown as VolSurface;
    expect(deepMismatchCount(volSeed as unknown as VolSurface)).toBe(0);
    expect(deepMismatchCount(changed)).toBe(3);
    const normal = normalizeVolSurface(changed);
    const col55 = normal.moneyness.indexOf(0.55) + 1;
    expect(col55).toBe(1);
    normal.volsPercent.forEach((row) => expect(row[0]).toBe(row[col55]));
  });
});

describe("vol surface upload", () => {
  it("reads the generated sample back to the seed", async () => {
    const dir = path.join(process.cwd(), "test-results", "samples");
    const file = await buildVolSurfaceSample(dir);
    const buf = fs.readFileSync(file);
    const parsed = parseVolSurfaceFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "2026-10");
    expect(parsed.surface.moneyness).toEqual(volSeed.moneyness);
    expect(parsed.surface.expiries).toEqual(volSeed.expiries);
    expect(parsed.surface.referenceSensexPrice).toBeCloseTo(volSeed.referenceSensexPrice, 6);
    parsed.surface.volsPercent.forEach((row, r) =>
      row.forEach((v, c) => expect(v).toBeCloseTo(Math.round(volSeed.volsPercent[r]![c]! * 100) / 100, 6)),
    );
    // The file carries the forward Pricing Params grid and future dividends only.
    const live = forwardMarket(seedMarketData(), istTodayYmd());
    expect(parsed.surface.pricingParams).toEqual(live.surface.pricingParams.map((p) => ({ ...p, date: p.date.slice(0, 10) + "T00:00:00.000Z" })));
    expect(parsed.params.rateCapBuyingForward).toBeCloseTo(pricingSeed.rateCapBuyingForward, 9);
    expect(parsed.params.dividendBidOfferMultiplier).toBe(pricingSeed.dividendBidOfferMultiplier);
    expect(parsed.params.bidOffer).toBe("B");
    expect(parsed.params.rateCurve?.length).toBe(pricingSeed.rateCurve.length);
    expect(parsed.params.rateCurve?.every((p) => typeof p.years === "number")).toBe(true);
    expect(parsed.params.dividends?.length).toBe(live.params.dividends.length);
  });
});
