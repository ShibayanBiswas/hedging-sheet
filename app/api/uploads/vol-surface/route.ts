import { NextResponse } from "next/server";

import { deskMonthKey, loadActiveParams, loadActiveSurface, ReferenceDataError, saveReferenceData } from "@/lib/data/load";
import { monthKeySchema, pricingParamsSchema, schemaIssues, volSurfaceSchema } from "@/lib/db/schemas";
import { deepMismatchCount, normalizeVolSurface, withMonthScalars } from "@/lib/engine/vol-surface";
import { guardWrite } from "@/lib/server/write-guard";
import { looksLikeExcel, MAX_UPLOAD_BYTES, uploadProblem } from "@/lib/upload-limits";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORM_OVERHEAD = 64 * 1024;

const bad = (issue: string, status = 400) => NextResponse.json({ error: issue, issues: [issue] }, { status });

/**
 * Reads an uploaded surface workbook. With mode=preview the parsed surface is checked and returned and nothing is written;
 * without it the surface, and any surface parameters in the file, replace this month in one transaction, and the
 * grid becomes the Unwinding Calculator's active surface, so one file feeds both desks.
 */
export async function POST(req: Request) {
  const blocked = guardWrite(req, MAX_UPLOAD_BYTES + FORM_OVERHEAD);
  if (blocked) return blocked;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Choose An Excel File.");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return bad("Choose An Excel File.");
  const problem = uploadProblem({ name: file.name || "", size: file.size });
  if (problem) return bad(problem, file.size > MAX_UPLOAD_BYTES ? 413 : 400);
  const buffer = await file.arrayBuffer();
  if (!looksLikeExcel(new Uint8Array(buffer.slice(0, 4)))) return bad("The File Is Not In Excel Format.");

  const month = monthKeySchema.safeParse(String(form.get("monthKey") || "") || deskMonthKey());
  if (!month.success) return bad("Choose the month as YYYY-MM.");

  let parsed;
  try {
    parsed = parseVolSurfaceFile(buffer, month.data);
  } catch (err) {
    return bad(err instanceof Error ? err.message : "The Excel file could not be read.");
  }

  const params = Object.keys(parsed.params).length ? { ...(await loadActiveParams()).params, ...parsed.params } : null;
  // A file with one Surface Parameters point, the Unwinding Calculator's layout, keeps the desk's dated
  // Pricing Params grid and sets that point's bump and forward sell rate from its month onward.
  if (parsed.surface.pricingParams.length === 1) {
    const { volBump, fwdSellRate } = parsed.surface.pricingParams[0]!;
    parsed.surface.pricingParams = withMonthScalars((await loadActiveSurface()).surface.pricingParams, parsed.surface.monthKey, { volBump, fwdSellRate });
  }
  const surface = normalizeVolSurface(parsed.surface);
  const summary = { expiries: surface.expiries.length, strikePercents: surface.moneyness.length, deepAdjusted: deepMismatchCount(parsed.surface) };

  if (form.get("mode") === "preview") {
    const issues = [
      ...(volSurfaceSchema.safeParse(parsed.surface).error ? schemaIssues(volSurfaceSchema.safeParse(parsed.surface).error!) : []),
      ...(params && pricingParamsSchema.safeParse(params).error ? schemaIssues(pricingParamsSchema.safeParse(params).error!) : []),
    ];
    if (issues.length) return NextResponse.json({ error: "The Excel file is not a complete surface.", issues }, { status: 400 });
    return NextResponse.json({ ok: true, preview: true, surface, params, persisted: false, summary });
  }

  const source = `upload ${file.name.replace(/[^\w .-]/g, "").slice(0, 120)}`;
  try {
    const persisted = await saveReferenceData(
      { surface: parsed.surface, params: params ? { values: params, monthKey: deskMonthKey() } : undefined, shareGrid: true },
      source,
    );
    return NextResponse.json({ ok: true, surface, params, persisted, summary });
  } catch (err) {
    if (err instanceof ReferenceDataError) return NextResponse.json({ error: "The Excel file is not a complete surface.", issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: "The Volatility Surface could not be saved.", issues: ["Nothing was saved. Try again."] }, { status: 500 });
  }
}
