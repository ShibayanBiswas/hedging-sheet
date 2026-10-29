import { NextResponse } from "next/server";

import { loadActiveSurface, ReferenceDataError, saveReferenceData } from "@/lib/data/load";
import type { VolSurface } from "@/lib/engine/types";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";
import { guardWrite, readJsonBody } from "@/lib/server/write-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;

export async function GET() {
  const { surface, source } = await loadActiveSurface();
  return NextResponse.json({ surface, source }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(req: Request) {
  const blocked = guardWrite(req, MAX_BYTES);
  if (blocked) return blocked;
  const read = await readJsonBody(req, MAX_BYTES);
  if (!read.ok) return read.response;
  if (!read.body || typeof read.body !== "object") {
    return NextResponse.json({ error: "Volatility Surface is incomplete", issues: ["Keep at least one expiry row before saving."] }, { status: 400 });
  }
  try {
    const persisted = await saveReferenceData({ surface: read.body as VolSurface }, "desk edit");
    return NextResponse.json({ ok: true, surface: normalizeVolSurface(read.body as VolSurface), persisted });
  } catch (err) {
    if (err instanceof ReferenceDataError) return NextResponse.json({ error: "Volatility Surface is incomplete", issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: "The Volatility Surface could not be saved.", issues: ["Nothing was saved. Try again."] }, { status: 500 });
  }
}
