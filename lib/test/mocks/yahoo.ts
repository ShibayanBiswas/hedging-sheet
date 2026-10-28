/**
 * Deterministic Yahoo chart data for TEST_MODE=mock and the API tests.
 * Fixed spots, a seeded one-year history of weekday closes ending on the last completed session,
 * and today's partial bar, so the desk close rule and the volatility window behave as in production.
 */

/** 28-Oct-2026 10:00 IST, a Wednesday during the cash session. */
export const MOCK_NOW_ISO = "2026-10-28T04:30:00.000Z";

export const MOCK_SPOTS: Record<string, number> = { "^BSESN": 76835.78, "^NSEI": 23500.0 };

/** Daily volatility of the seeded returns before sampling noise. */
export const MOCK_DAILY_VOL = 0.009;

const BAR_UTC_HOUR = 3;
const BAR_UTC_MINUTE = 45;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
}

function normals(count: number, seed: number): number[] {
  const u = seeded(seed);
  const out: number[] = [];
  while (out.length < count) {
    const a = u();
    const b = u();
    const r = Math.sqrt(-2 * Math.log(a));
    out.push(r * Math.cos(2 * Math.PI * b), r * Math.sin(2 * Math.PI * b));
  }
  return out.slice(0, count);
}

/** Weekday session timestamps, oldest first, from `fromYmd` to `toYmd` inclusive. */
function sessions(fromYmd: string, toYmd: string): number[] {
  const out: number[] = [];
  const d = new Date(`${fromYmd}T00:00:00Z`);
  const end = new Date(`${toYmd}T00:00:00Z`).getTime();
  while (d.getTime() <= end) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), BAR_UTC_HOUR, BAR_UTC_MINUTE) / 1000);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export type MockBar = { ts: number; close: number };

/** Completed closes to the session before `now`, ending exactly on the fixed spot, plus today's partial bar. */
export function mockBars(symbol: string, now = new Date(MOCK_NOW_ISO)): MockBar[] {
  const spot = MOCK_SPOTS[symbol] ?? 10000;
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const stamps = sessions("2024-09-02", yesterday);
  const shocks = normals(stamps.length, symbol === "^BSESN" ? 11 : 29);
  const closes = new Array<number>(stamps.length);
  closes[stamps.length - 1] = spot;
  for (let i = stamps.length - 1; i > 0; i--) closes[i - 1] = closes[i]! / Math.exp(MOCK_DAILY_VOL * shocks[i]!);
  const bars = stamps.map((ts, i) => ({ ts, close: Math.round(closes[i]! * 100) / 100 }));
  const todayTs = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), BAR_UTC_HOUR, BAR_UTC_MINUTE) / 1000;
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (wd !== 0 && wd !== 6 && now.getTime() / 1000 > todayTs) bars.push({ ts: todayTs, close: Math.round(spot * 1.0012 * 100) / 100 });
  return bars;
}

/** A Yahoo v8 chart response for a chart URL, with range or period1 and period2. */
export function mockChartResponse(url: string, now = new Date(MOCK_NOW_ISO)) {
  const u = new URL(url);
  const symbol = decodeURIComponent(u.pathname.split("/").pop() ?? "");
  const all = mockBars(symbol, now);
  const nowSec = now.getTime() / 1000;
  let from = 0;
  let to = Infinity;
  const range = u.searchParams.get("range");
  if (range) from = nowSec - (range === "1mo" ? 31 : range === "1y" ? 366 : 92) * 86_400;
  const p1 = u.searchParams.get("period1");
  const p2 = u.searchParams.get("period2");
  if (p1) from = Number(p1);
  if (p2) to = Number(p2);
  const bars = all.filter((b) => b.ts >= from && b.ts <= to);
  const last = bars[bars.length - 1];
  return {
    chart: {
      result: [
        {
          meta: { regularMarketPrice: last?.close, chartPreviousClose: bars[0]?.close, previousClose: bars[bars.length - 2]?.close },
          timestamp: bars.map((b) => b.ts),
          indicators: { quote: [{ close: bars.map((b) => b.close) }] },
        },
      ],
      error: null,
    },
  };
}

export function isMockMode(): boolean {
  return typeof process !== "undefined" && process.env.TEST_MODE === "mock";
}

/** fetch for Yahoo hosts: the real network, or the deterministic chart in mock mode. */
export async function yahooFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isMockMode()) return fetch(url, init);
  return new Response(JSON.stringify(mockChartResponse(url, new Date(process.env.TEST_NOW ?? MOCK_NOW_ISO))), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
