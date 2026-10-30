import { describe, expect, it, vi } from "vitest";

import { traceEnabled, tracePipeline } from "@/lib/trace";

import { priced } from "../helpers/fixture";

describe("?trace=1", () => {
  it("is on only in a development build with trace=1 in the URL", () => {
    expect(traceEnabled("?trace=1", "development")).toBe(true);
    expect(traceEnabled("?trace=1&x=2", "test")).toBe(true);
    expect(traceEnabled("?trace=1", "production")).toBe(false);
    expect(traceEnabled("", "development")).toBe(false);
    expect(traceEnabled("?trace=0", "development")).toBe(false);
  });

  it("writes each stage to the console in its own collapsed group, and nothing to the page", () => {
    const out = { groupCollapsed: vi.fn(), groupEnd: vi.fn(), table: vi.fn(), log: vi.fn() };
    tracePipeline(priced(), out);
    const titles = out.groupCollapsed.mock.calls.map((c) => c[0]);
    expect(titles).toEqual([
      "Hedging Sheet Trace · Inputs",
      "Hedging Sheet Trace · Schedule",
      "Hedging Sheet Trace · Strikes",
      "Hedging Sheet Trace · Legs",
      "Hedging Sheet Trace · Goal Seek",
      "Hedging Sheet Trace · Pricer Header",
      "Hedging Sheet Trace · Day 1 Vega Hedge",
      "Hedging Sheet Trace · Mark To Market",
      "Hedging Sheet Trace · Timings In Milliseconds",
    ]);
    expect(out.groupEnd).toHaveBeenCalledTimes(titles.length);
    expect(out.table).toHaveBeenCalledTimes(titles.length);
    expect(out.log).toHaveBeenCalledWith("Hedging Sheet Trace · Rate Curve Points", expect.any(Array));
  });
});
