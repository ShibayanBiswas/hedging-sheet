import { NextResponse } from "next/server";

import { fetchIndexAtDate } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Pass date as YYYY-MM-DD." }, { status: 400 });
  }
  const levels = await fetchIndexAtDate(date);
  return NextResponse.json(levels, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
