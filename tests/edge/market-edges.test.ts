import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getDailyVol } from "@/app/api/market/daily-vol/route";
import { GET as getLevels } from "@/app/api/market/levels/route";
import { fetchDailyVolatility, fetchLiveMarketLevels } from "@/lib/market-data";

type Bar = [ymd: string, close: number | null];

/** A Yahoo chart answer with one bar per date at 09:15 IST. */
function chart(bars: Bar[], previousClose?: number) {
  return {
    chart: {
      result: [
        {
          meta: { previousClose },
          timestamp: bars.map(([d]) => Date.parse(`${d}T03:45:00Z`) / 1000),
          indicators: { quote: [{ close: bars.map(([, c]) => c) }] },
        },
      ],
    },
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Weekday closes between two dates, walking up by 0.5% a day with a small wobble. */
function weekdays(from: string, to: string): Bar[] {
  const out: Bar[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  let close = 76000;
  for (let i = 0; d <= new Date(`${to}T00:00:00Z`); i++) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      close *= 1 + (i % 2 ? 0.005 : -0.004);
      out.push([d.toISOString().slice(0, 10), Math.round(close * 100) / 100]);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function answer(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** 28-Oct-2026 10:00 IST, a Wednesday during the session. */
const WEDNESDAY_MORNING = new Date("2026-10-28T04:30:00.000Z");

describe("Edge · Spot · Yahoo", () => {
  it("Yahoo Down On Every Host Gives No Level And Says So, Never A 0 Or A NaN", async () => {
    answer(() => json({ error: "down" }, 503));
    const levels = await fetchLiveMarketLevels(WEDNESDAY_MORNING);
    expect(levels).toMatchObject({ source: "unavailable", sensexLevel: null, niftyLevel: null, priceAsOfDate: null });
    const res = await getLevels();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ source: "unavailable", sensexLevel: null });
  });

  it("Yahoo Slow: Each Request Carries A Timeout, And A Host That Times Out Hands Over To The Next", async () => {
    const calls = answer((url) => {
      if (url.includes("query1")) throw new DOMException("The operation timed out.", "TimeoutError");
      return json(chart(weekdays("2026-10-01", "2026-10-28")));
    });
    const levels = await fetchLiveMarketLevels(WEDNESDAY_MORNING);
    expect(levels.source).toBe("yahoo");
    expect(levels.sensexLevel).toBeGreaterThan(0);
    expect(calls.every((c) => c.init?.signal instanceof AbortSignal)).toBe(true);
    expect(calls.some((c) => c.url.includes("query2"))).toBe(true);
  });

  it("A Stale Close On A Weekend Is The Last Session's Close, Marked As Holiday Or Weekend", async () => {
    answer(() => json(chart(weekdays("2026-10-01", "2026-10-30"))));
    const saturday = new Date("2026-10-31T04:30:00.000Z");
    const levels = await fetchLiveMarketLevels(saturday);
    expect(levels).toMatchObject({ priceAsOfDate: "2026-10-30", sessionPhase: "holiday_or_weekend", source: "yahoo" });
  });

  it("A Holiday Close: After The Session With No Bar For Today, The Last Close Is Used And Marked", async () => {
    answer(() => json(chart(weekdays("2026-10-01", "2026-10-27"))));
    const afterClose = new Date("2026-10-28T11:00:00.000Z");
    const levels = await fetchLiveMarketLevels(afterClose);
    expect(levels).toMatchObject({ priceAsOfDate: "2026-10-27", spotKind: "last_close", sessionPhase: "holiday_or_weekend" });
  });

  it("Today's Partial Bar During The Session Is Never Used As The Close", async () => {
    answer(() => json(chart([...weekdays("2026-10-01", "2026-10-27"), ["2026-10-28", 99999]])));
    const levels = await fetchLiveMarketLevels(WEDNESDAY_MORNING);
    expect(levels.priceAsOfDate).toBe("2026-10-27");
    expect(levels.sensexLevel).not.toBe(99999);
  });
});

describe("Edge · Volatility · History", () => {
  it("Fewer Than 2 Closes In The Window Gives No Volatility And A 502 With The Reason", async () => {
    answer(() => json(chart([["2026-10-26", 76000], ["2026-10-27", 76100]])));
    const r = await fetchDailyVolatility("Sensex", 365, WEDNESDAY_MORNING);
    expect(r).toEqual({ dailyVol: null, observations: 1, from: null, to: null });
    vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
    vi.setSystemTime(WEDNESDAY_MORNING);
    const res = await getDailyVol(new Request("http://localhost/api/market/daily-vol?underlying=Sensex&windowDays=365"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Not enough Yahoo closes for that window.");
  });

  it("Gaps In The History, Missing Weeks And Null Closes, Use The Closes That Are There", async () => {
    const full = weekdays("2025-11-01", "2026-10-27");
    const gappy = full.filter((_, i) => i % 17 > 4).map(([d, c], i): Bar => [d, i % 23 === 0 ? null : c]);
    answer(() => json(chart(gappy)));
    const r = await fetchDailyVolatility("Sensex", 365, WEDNESDAY_MORNING);
    const kept = gappy.filter(([d, c]) => c != null && d >= "2025-10-28").length;
    expect(r.observations).toBe(kept - 1);
    expect(Number.isFinite(r.dailyVol)).toBe(true);
    expect(r.dailyVol).toBeGreaterThan(0);
  });
});
