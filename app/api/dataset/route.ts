import { NextResponse } from "next/server";

import { loadActiveParams, loadActiveSurface } from "@/lib/data/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [{ surface, source: surfaceSource }, { params, source: paramsSource }] = await Promise.all([
    loadActiveSurface(),
    loadActiveParams(),
  ]);
  return NextResponse.json(
    { surface, params, surfaceSource, paramsSource },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
