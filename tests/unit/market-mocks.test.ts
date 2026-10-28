import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mockBars, mockChartResponse, MOCK_DAILY_VOL, MOCK_NOW_ISO } from "@/lib/test/mocks/yahoo";

import defaults from "../fixtures/default-inputs.json";

describe("deterministic Yahoo mock", () => {
  beforeAll(() => {
    process.env.TEST_MODE = "mock";
    process.env.TEST_NOW = MOCK_NOW_ISO;
  });
  afterAll(() => {
    delete process.env.TEST_MODE;
    delete process.env.TEST_NOW;
  });

  it("ends the completed closes on the fixed spots and adds today's partial bar", () => {
    const sensex = mockBars("^BSESN");
    expect(sensex.at(-2)!.close).toBe(76835.78);
    expect(new Date(sensex.at(-1)!.ts * 1000).toISOString().slice(0, 10)).toBe("2026-10-28");
    expect(mockBars("^NSEI").at(-2)!.close).toBe(23500);
    expect(mockBars("^BSESN")).toEqual(sensex);
  });

  it("serves range and period queries", () => {
    const month = mockChartResponse("https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN?interval=1d&range=1mo");
    expect(month.chart.result[0]!.timestamp.length).toBeGreaterThan(18);
    const p1 = Date.UTC(2026, 9, 1) / 1000;
    const p2 = Date.UTC(2026, 9, 3) / 1000;
    const window = mockChartResponse(`https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&period1=${p1}&period2=${p2}`);
    expect(window.chart.result[0]!.timestamp.length).toBe(2);
  });

  it("feeds the desk close rule and the volatility window through the market data functions", async () => {
    const { fetchLiveMarketLevels, fetchDailyVolatility } = await import("@/lib/market-data");
    const levels = await fetchLiveMarketLevels();
    expect(levels.sensexLevel).toBe(76835.78);
    expect(levels.niftyLevel).toBe(23500);
    expect(levels.sessionPhase).toBe("open");
    expect(levels.valuationDate).toBe("2026-10-28");
    const vol = await fetchDailyVolatility("Sensex", 365);
    expect(vol.dailyVol).toBeCloseTo(defaults.inputs.dailyVol, 12);
    expect(Math.abs(vol.dailyVol! - MOCK_DAILY_VOL)).toBeLessThan(0.001);
  });
});
