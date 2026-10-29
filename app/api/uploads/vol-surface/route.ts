import { NextResponse } from "next/server";

import { deskMonthKey, loadActiveParams, ReferenceDataError, saveReferenceData } from "@/lib/data/load";
import { monthKeySchema, pricingParamsSchema, schemaIssues, volSurfaceSchema } from "@/lib/db/schemas";
import { deepMismatchCount, normalizeVolSurface } from "@/lib/engine/vol-surface";
import { guardWrite } from "@/lib/server/write-guard";
import { looksLikeExcel, MAX_UPLOAD_BYTES, uploadProblem } from "@/lib/upload-limits";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORM_OVERHEAD = 64 * 1024;

const bad = (issue: string, status = 400) => NextResponse.json({ error: issue, issues: [issue] }, { status });

/**
 * Reads an uploaded surface workbook. With mode=preview the parsed surface is checked and returned and nothing is written;
 * without it the surface, and any surface parameters in the file, replace this month in one transaction.
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
      { surface: parsed.surface, params: params ? { values: params, monthKey: deskMonthKey() } : undefined },
      source,
    );
    return NextResponse.json({ ok: true, surface, params, persisted, summary });
  } catch (err) {
    if (err instanceof ReferenceDataError) return NextResponse.json({ error: "The Excel file is not a complete surface.", issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: "The Volatility Surface could not be saved.", issues: ["Nothing was saved. Try again."] }, { status: 500 });
  }
}
