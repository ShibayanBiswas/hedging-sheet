import { NextResponse } from "next/server";

import { deskMonthKey, loadActiveParams, loadActiveSurface, loadMonthParams, ReferenceDataError, saveReferenceData } from "@/lib/data/load";
import { monthKeySchema, pricingParamsSchema, schemaIssues } from "@/lib/db/schemas";
import { readSurfaceOnOrBefore } from "@/lib/db/vol-surfaces";
import { normalizeVolSurface, surfaceMonthLabel, withMonthScalars } from "@/lib/engine/vol-surface";
import { guardWrite, readJsonBody } from "@/lib/server/write-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;

/** The active surface parameters, or with ?month=YYYY-MM one month's parameters and Pricing Params grid. */
export async function GET(req?: Request) {
  const raw = req ? new URL(req.url).searchParams.get("month") : null;
  if (raw != null) {
    const month = monthKeySchema.safeParse(raw);
    if (!month.success) return NextResponse.json({ error: "Choose the month as YYYY-MM." }, { status: 400 });
    const { params, pricingParams, storedMonth } = await loadMonthParams(month.data);
    return NextResponse.json({ params, pricingParams, monthKey: month.data, storedMonth }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
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
 * Surface parameters for one month, the current month unless monthKey names another: Bid or Offer, the rate caps,
 * the dividend factor and the rate curve, plus the Pricing Params scalars, which are written to the forward grid
 * of that month's surface document from the month's row onward. Both are saved in one transaction.
 */
export async function POST(req: Request) {
  const blocked = guardWrite(req, MAX_BYTES);
  if (blocked) return blocked;
  const read = await readJsonBody(req, MAX_BYTES);
  if (!read.ok) return read.response;
  const body = read.body as { params?: unknown; grid?: unknown; monthKey?: unknown } | null;
  const checked = pricingParamsSchema.safeParse(body?.params);
  if (!checked.success) {
    return NextResponse.json({ error: "Surface parameters are incomplete", issues: schemaIssues(checked.error) }, { status: 400 });
  }
  const grid = body?.grid == null ? null : readGrid(body.grid);
  if (body?.grid != null && !grid) {
    return NextResponse.json({ error: "Pricing Params values must be between 0% and 100%." }, { status: 400 });
  }
  const month = body?.monthKey == null ? { success: true as const, data: deskMonthKey() } : monthKeySchema.safeParse(body.monthKey);
  if (!month.success) return NextResponse.json({ error: "Choose the month as YYYY-MM." }, { status: 400 });
  const monthKey = month.data;
  const params = checked.data;
  let surface = null;
  if (grid) {
    const active = (await loadActiveSurface()).surface;
    const own = monthKey === active.monthKey ? null : await readSurfaceOnOrBefore(monthKey).catch(() => null);
    const base = own ? normalizeVolSurface(own) : active;
    surface = {
      ...active,
      monthKey,
      label: monthKey === active.monthKey ? active.label : surfaceMonthLabel(monthKey),
      pricingParams: withMonthScalars(base.pricingParams, monthKey, grid),
    };
  }
  try {
    const persisted = await saveReferenceData({ params: { values: params, monthKey }, surface: surface ?? undefined }, "desk edit");
    return NextResponse.json({ ok: true, params, surface, monthKey, persisted });
  } catch (err) {
    if (err instanceof ReferenceDataError) return NextResponse.json({ error: "Surface parameters are incomplete", issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: "The surface parameters could not be saved.", issues: ["Nothing was saved. Try again."] }, { status: 500 });
  }
}
