import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchDailyVolatility, fetchIndexAtDate, fetchLiveMarketLevels, pickDeskClose, type DailyBar } from "@/lib/market-data";

const ist = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+05:30`);
const bars = (...days: string[]): DailyBar[] => days.map((d, i) => ({ dateYmd: d, close: 76000 + i }));

afterEach(() => vi.unstubAllGlobals());

describe("desk close rule", () => {
  it("has no close without a valid bar", () => {
    expect(pickDeskClose([], ist("2026-10-28", "10:00"))).toBeNull();
    expect(pickDeskClose([{ dateYmd: "2026-10-27", close: Number.NaN }, { dateYmd: "2026-10-26", close: 0 }], ist("2026-10-28", "10:00"))).toBeNull();
  });

  it("after the close on a session day takes today's close", () => {
    expect(pickDeskClose(bars("2026-10-27", "2026-10-28"), ist("2026-10-28", "16:00"))).toMatchObject({ priceAsOfDate: "2026-10-28", spotKind: "today_close", sessionPhase: "closed" });
  });

  it("during the session ignores today's bar and takes the prior close", () => {
    expect(pickDeskClose(bars("2026-10-27", "2026-10-28"), ist("2026-10-28", "11:00"))).toMatchObject({ priceAsOfDate: "2026-10-27", spotKind: "prior_close", sessionPhase: "open" });
  });

  it("before the open with today's bar already listed is Pre Open on the prior close", () => {
    expect(pickDeskClose(bars("2026-10-26", "2026-10-27"), ist("2026-10-27", "08:00"))).toMatchObject({ priceAsOfDate: "2026-10-26", sessionPhase: "pre_open" });
  });

  it("before the open with no bar for today is Pre Open on a weekday", () => {
    expect(pickDeskClose(bars("2026-10-26"), ist("2026-10-27", "08:00"))).toMatchObject({ priceAsOfDate: "2026-10-26", sessionPhase: "pre_open" });
  });

  it("on a weekend is Holiday Or Weekend, even with a stray bar for the day", () => {
    expect(pickDeskClose(bars("2026-10-30"), ist("2026-11-01", "11:00"))).toMatchObject({ sessionPhase: "holiday_or_weekend" });
    expect(pickDeskClose(bars("2026-10-30", "2026-10-31"), ist("2026-10-31", "11:00"))).toMatchObject({ priceAsOfDate: "2026-10-30", sessionPhase: "holiday_or_weekend" });
  });

  it("during a session day with only today's bar uses that bar, since nothing earlier is known", () => {
    expect(pickDeskClose(bars("2026-10-28"), ist("2026-10-28", "11:00"))).toMatchObject({ priceAsOfDate: "2026-10-28", spotKind: "prior_close" });
  });

  it("names every weekday of a week correctly", () => {
    const phases = ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"].map(
      (d) => pickDeskClose(bars("2026-10-20"), ist(d, "11:00"))!.sessionPhase,
    );
    expect(phases).toEqual(["holiday_or_weekend", ...Array.from({ length: 5 }, () => "holiday_or_weekend"), "holiday_or_weekend"]);
    const mornings = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"].map((d) => pickDeskClose(bars("2026-10-20"), ist(d, "08:00"))!.sessionPhase);
    expect(mornings).toEqual(Array.from({ length: 5 }, () => "pre_open"));
    expect(pickDeskClose(bars("2026-10-20"), ist("2026-10-25", "08:00"))!.sessionPhase).toBe("holiday_or_weekend");
  });
});

function chart(days: Array<[string, number | null]>, previousClose?: number) {
  return { chart: { result: [{ meta: { previousClose }, timestamp: days.map(([d]) => Date.parse(`${d}T03:45:00Z`) / 1000), indicators: { quote: [{ close: days.map(([, c]) => c) }] } }] } };
}

function serve(body: unknown | ((url: string) => unknown), status = 200) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const payload = typeof body === "function" ? (body as (u: string) => unknown)(url) : body;
    return new Response(JSON.stringify(payload), { status });
  });
  return calls;
}

describe("Yahoo answers", () => {
  it("an answer with no result gives no level", async () => {
    serve({});
    expect(await fetchLiveMarketLevels(ist("2026-10-28", "11:00"))).toMatchObject({ source: "unavailable", sensexLevel: null });
  });

  it("no usable bar falls back to the previous close in the chart's header, marked as the last close", async () => {
    serve(chart([["2026-10-27", null]], 76123.456));
    const levels = await fetchLiveMarketLevels(ist("2026-10-28", "11:00"));
    expect(levels).toMatchObject({ sensexLevel: 76123.46, spotKind: "last_close", sessionPhase: "holiday_or_weekend", source: "yahoo" });
  });

  it("no bar and no header close gives no level", async () => {
    serve(chart([]));
    expect((await fetchLiveMarketLevels(ist("2026-10-28", "11:00"))).sensexLevel).toBeNull();
  });

  it("daily volatility after the close counts today's bar", async () => {
    const days: Array<[string, number]> = [["2026-10-26", 100], ["2026-10-27", 101], ["2026-10-28", 100]];
    serve(chart(days));
    expect((await fetchDailyVolatility("Nifty", 365, ist("2026-10-28", "16:00"))).observations).toBe(2);
    expect((await fetchDailyVolatility("Nifty", 365, ist("2026-10-28", "11:00"))).observations).toBe(1);
  });
});

describe("index at a date", () => {
  it("a date that cannot be read is refused without asking Yahoo", async () => {
    const calls = serve(chart([]));
    expect(await fetchIndexAtDate("2026-13-45")).toMatchObject({ source: "invalid", sensexLevel: null, niftyLevel: null });
    expect(calls).toHaveLength(0);
  });

  it("takes the close on or before the date, from one cached history request per index", async () => {
    const calls = serve(chart([["2025-03-03", 70000], ["2025-03-04", 70100], ["2025-03-06", 70300]]));
    const first = await fetchIndexAtDate("2025-03-05");
    // 5 March has no bar, so the close and its date are 4 March's.
    expect(first).toMatchObject({ sensexLevel: 70100, niftyLevel: 70100, source: "yahoo", priceAsOfDate: "2025-03-04" });
    const asked = calls.length;
    await fetchIndexAtDate("2025-03-05");
    expect(calls.length).toBe(asked);
  });

  it("is Missing when Yahoo has nothing on or before the date, after trying both hosts", async () => {
    const calls = serve({ error: "down" }, 500);
    expect(await fetchIndexAtDate("2024-01-10")).toMatchObject({ source: "missing", sensexLevel: null, niftyLevel: null });
    expect(calls.some((u) => u.includes("query2"))).toBe(true);
  });

  it("a host that throws hands over to the next one", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("query1")) throw new Error("reset");
      return new Response(JSON.stringify(chart([["2024-02-01", 71000]])));
    });
    expect((await fetchIndexAtDate("2024-02-02")).sensexLevel).toBe(71000);
  });
});
