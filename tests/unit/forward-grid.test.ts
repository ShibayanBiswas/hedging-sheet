import { describe, expect, it } from "vitest";

import volSeed from "@/lib/data/vol-surface-seed.json";
import { seedMarketData } from "@/lib/engine/defaults";
import type { VolSurface } from "@/lib/engine/types";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";

const days = (surface: VolSurface) => surface.pricingParams.map((p) => p.date.slice(0, 10));

describe("the forward grid has one row per date", () => {
  it("drops the repeated 25-Mar-2027 row of the built in surface", () => {
    const raw = days(volSeed as unknown as VolSurface);
    expect(raw.filter((d) => d === "2027-03-25")).toHaveLength(2);
    const dates = days(seedMarketData().surface);
    expect(dates.filter((d) => d === "2027-03-25")).toHaveLength(1);
    expect(dates).toHaveLength(raw.length - 1);
  });

  it("leaves the dates unique and ascending", () => {
    const dates = days(seedMarketData().surface);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });

  it("keeps the first row when a date repeats with other values", () => {
    const seed = volSeed as unknown as VolSurface;
    const first = { date: "2030-01-31T00:00:00.000Z", volBump: 0.01, fwdSellRate: 0.051 };
    const second = { date: "2030-01-31T00:00:00.000Z", volBump: 0.02, fwdSellRate: 0.052 };
    const grid = normalizeVolSurface({ ...seed, pricingParams: [first, second] }).pricingParams;
    expect(grid).toHaveLength(1);
    expect(grid[0]).toMatchObject({ volBump: 0.01, fwdSellRate: 0.051 });
  });
});
