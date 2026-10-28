import { NextResponse } from "next/server";

import { loadActiveParams, looksLikeParams, persistActiveParams } from "@/lib/data/load";
import { normalizePricingParams } from "@/lib/engine/defaults";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { params, source } = await loadActiveParams();
  return NextResponse.json({ params, source }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Surface parameters: Bid or Offer, the rate curve tenors and the rate caps. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!looksLikeParams(body)) {
    return NextResponse.json({ error: "Surface parameters are incomplete", issues: ["Keep at least one rate curve point."] }, { status: 400 });
  }
  const params = normalizePricingParams(body);
  try {
    const persisted = await persistActiveParams(params, "desk-edit");
    return NextResponse.json({ ok: true, params, persisted });
  } catch (err) {
    return NextResponse.json(
      { error: "The surface parameters could not be saved.", issues: [err instanceof Error ? err.message : "Write failed"] },
      { status: 500 },
    );
  }
}
