import { NextResponse } from "next/server";

import { deskMonthKey, loadActiveParams, loadActiveSurface, looksLikeParams, persistActiveParams, persistActiveSurface } from "@/lib/data/load";
import { istTodayYmd, parseYmd } from "@/lib/engine/dates";
import { normalizePricingParams } from "@/lib/engine/defaults";
import { pricingRowForMonth } from "@/lib/engine/vol-surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { params, source, monthKey } = await loadActiveParams();
  return NextResponse.json({ params, source, monthKey }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

type GridScalars = { volBump: number; incMargin: number; fullMargin: number; marginCost: number; fwdSellRate: number };

function readGrid(raw: unknown): GridScalars | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const keys = ["volBump", "incMargin", "fullMargin", "marginCost", "fwdSellRate"] as const;
  const out = {} as GridScalars;
  for (const k of keys) {
    const v = Number(g[k]);
    if (!Number.isFinite(v) || v < 0 || v > 1) return null;
    out[k] = v;
  }
  return out;
}

/**
 * Surface parameters for the current month: Bid or Offer, the rate caps, the dividend factor and the rate curve,
 * plus the Pricing Params scalars, which are written to every row of the forward grid of this month's surface.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { params?: unknown; grid?: unknown } | null;
  if (!body || !looksLikeParams(body.params)) {
    return NextResponse.json({ error: "Surface parameters are incomplete", issues: ["Keep at least one rate curve point."] }, { status: 400 });
  }
  const grid = body.grid == null ? null : readGrid(body.grid);
  if (body.grid != null && !grid) {
    return NextResponse.json({ error: "Pricing Params values must be between 0% and 100%." }, { status: 400 });
  }
  const monthKey = deskMonthKey();
  const params = normalizePricingParams(body.params);
  try {
    const paramsOk = await persistActiveParams(params, "desk-edit", monthKey);
    let surfaceOk = true;
    let surface = null;
    if (grid) {
      const active = (await loadActiveSurface()).surface;
      const today = istTodayYmd();
      const row = pricingRowForMonth(active.pricingParams, today);
      const from = row ? parseYmd(row.date).getTime() : -Infinity;
      surface = {
        ...active,
        monthKey,
        pricingParams: active.pricingParams.map((p) => (parseYmd(p.date).getTime() >= from ? { ...p, ...grid } : p)),
      };
      surfaceOk = await persistActiveSurface(surface, "desk-edit");
    }
    return NextResponse.json({ ok: true, params, surface, monthKey, persisted: paramsOk && surfaceOk });
  } catch (err) {
    return NextResponse.json(
      { error: "The surface parameters could not be saved.", issues: [err instanceof Error ? err.message : "Write failed"] },
      { status: 500 },
    );
  }
}
