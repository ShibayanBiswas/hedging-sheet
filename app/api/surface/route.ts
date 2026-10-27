import { NextResponse } from "next/server";

import { loadActiveSurface, looksLikeSurface, persistActiveSurface } from "@/lib/data/load";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { surface, source } = await loadActiveSurface();
  return NextResponse.json({ surface, source }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!looksLikeSurface(body)) {
    return NextResponse.json(
      { error: "Volatility Surface is incomplete", issues: ["Keep at least one expiry row and the Deep strike column before saving."] },
      { status: 400 },
    );
  }
  const surface = normalizeVolSurface(body);
  try {
    const persisted = await persistActiveSurface(surface, "desk-edit");
    return NextResponse.json({ ok: true, surface, persisted });
  } catch (err) {
    return NextResponse.json(
      { error: "The Volatility Surface could not be saved.", issues: [err instanceof Error ? err.message : "Write failed"] },
      { status: 500 },
    );
  }
}
