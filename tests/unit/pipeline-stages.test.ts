import { beforeEach, describe, expect, it, vi } from "vitest";

/** Every stage call in order: the stage name, its inputs and what it returned. */
const calls: Array<{ stage: string; args: unknown[]; out: unknown }> = [];

function spy<F extends (...a: never[]) => unknown>(stage: string, fn: F): F {
  return ((...args: Parameters<F>) => {
    const out = fn(...args);
    calls.push({ stage, args, out });
    return out;
  }) as F;
}

vi.mock("@/lib/engine/schedule", async (load) => {
  const real = await load<typeof import("@/lib/engine/schedule")>();
  return { ...real, validateSchedule: spy("schedule", real.validateSchedule) };
});
vi.mock("@/lib/engine/vol-surface", async (load) => {
  const real = await load<typeof import("@/lib/engine/vol-surface")>();
  return { ...real, interpolateVolPercent: spy("surface", real.interpolateVolPercent) };
});
vi.mock("@/lib/engine/black-scholes", async (load) => {
  const real = await load<typeof import("@/lib/engine/black-scholes")>();
  return { ...real, bsGreeks: spy("legs", real.bsGreeks) };
});
vi.mock("@/lib/engine/solver", async (load) => {
  const real = await load<typeof import("@/lib/engine/solver")>();
  return { ...real, brentSolve: spy("solver", real.brentSolve) };
});

const { priced } = await import("../helpers/fixture");

describe("each engine stage takes only what the stage before it produced", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("runs schedule, surface, legs and then the solver, in that order", () => {
    priced();
    const first = (stage: string) => calls.findIndex((c) => c.stage === stage);
    expect(first("schedule")).toBeGreaterThanOrEqual(0);
    expect(first("schedule")).toBeLessThan(first("surface"));
    expect(first("surface")).toBeLessThan(first("legs"));
    expect(first("legs")).toBeLessThan(first("solver"));
  });

  it("reads the surface only at the dates the schedule produced", () => {
    priced();
    const schedule = calls.find((c) => c.stage === "schedule")!.out as { dates: string[] };
    const surfaceDates = new Set(calls.filter((c) => c.stage === "surface").map((c) => c.args[2] as string));
    for (const d of surfaceDates) expect(schedule.dates).toContain(d);
  });

  it("prices each leg at the volatility the surface stage returned for it", () => {
    const r = priced();
    const surfaceVols = calls.filter((c) => c.stage === "surface").map((c) => (c.out as number) / 100);
    r.pricer.legs.forEach((leg, i) => expect(leg.volatility).toBeCloseTo(surfaceVols[i]! + leg.volBump, 12));
    const legCalls = calls.filter((c) => c.stage === "legs").slice(0, r.pricer.legs.length);
    legCalls.forEach((c, i) => expect((c.args[0] as { vol: number }).vol).toBeCloseTo(r.pricer.legs[i]!.volatility, 12));
  });

  it("reports the Inbuilt the solver stage returned", () => {
    const r = priced();
    const last = calls.filter((c) => c.stage === "solver").at(-1)!.out as { root: number; converged: boolean };
    expect(last.converged).toBe(true);
    expect(r.pricer.header.inbuiltInr).toBeCloseTo(last.root, 6);
  });
});
