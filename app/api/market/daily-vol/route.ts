import { NextResponse } from "next/server";

import { fetchDailyVolatility } from "@/lib/market-data";
import { UNDERLYINGS } from "@/lib/underlyings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const underlying = UNDERLYINGS.find((u) => u === params.get("underlying"));
  if (!underlying) return NextResponse.json({ error: `Choose an underlying: ${UNDERLYINGS.join(" or ")}.` }, { status: 400 });
  const windowDays = Math.min(Math.max(Number(params.get("windowDays")) || 365, 30), 3650);
  const result = await fetchDailyVolatility(underlying, windowDays);
  if (result.dailyVol == null) {
    return NextResponse.json({ ...result, error: "Not enough Yahoo closes for that window." }, { status: 502 });
  }
  return NextResponse.json({ underlying, windowDays, ...result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
