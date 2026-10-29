import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { paramsSummary } from "@/lib/db/pricing-params";
import { surfaceSummary } from "@/lib/db/vol-surfaces";
import { fetchLiveMarketLevels } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Database connectivity, document counts and the latest market close date. No secrets, and nothing is written. */
export async function GET() {
  const [db, levels] = await Promise.all([getDb(), fetchLiveMarketLevels().catch(() => null)]);
  let database: Record<string, unknown> = { connected: false };
  if (db) {
    try {
      const [surfaces, params] = await Promise.all([surfaceSummary(db), paramsSummary(db)]);
      database = {
        connected: true,
        name: db.databaseName,
        collections: { vol_surfaces: surfaces.count, pricing_params: params.count },
        latestSurfaceMonth: surfaces.latestMonth,
        latestParamsMonth: params.latestMonth,
      };
    } catch {
      database = { connected: false, name: db.databaseName };
    }
  }
  const market = { source: levels?.source ?? "unavailable", latestCloseDate: levels?.priceAsOfDate ?? null };
  const ok = database.connected === true && market.source === "yahoo";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", environment: process.env.VERCEL_ENV ?? (process.env.TEST_MODE === "mock" ? "test" : "local"), database, market, checkedAt: new Date().toISOString() },
    { status: database.connected ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
