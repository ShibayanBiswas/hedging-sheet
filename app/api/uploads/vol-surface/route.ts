import { NextResponse } from "next/server";

import { deskMonthKey, loadActiveParams, ReferenceDataError, saveReferenceData } from "@/lib/data/load";
import { monthKeySchema } from "@/lib/db/schemas";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";
import { guardWrite } from "@/lib/server/write-guard";
import { parseVolSurfaceWorkbook } from "@/lib/workbook/parse-vol-surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const FORM_OVERHEAD = 64 * 1024;
const EXCEL_NAME = /\.(xlsx|xlsm|xls)$/i;

/** Zip for xlsx and xlsm, OLE for xls. */
function looksLikeExcel(bytes: Uint8Array): boolean {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return zip || ole;
}

const bad = (issue: string, status = 400) => NextResponse.json({ error: issue, issues: [issue] }, { status });

export async function POST(req: Request) {
  const blocked = guardWrite(req, MAX_BYTES + FORM_OVERHEAD);
  if (blocked) return blocked;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Choose an Excel workbook to upload.");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return bad("Choose an Excel workbook to upload.");
  if (!EXCEL_NAME.test(file.name || "")) return bad("Upload an Excel workbook: xlsx, xlsm or xls.");
  if (file.size > MAX_BYTES) return bad("Keep the upload under 8 megabytes.", 413);
  const buffer = await file.arrayBuffer();
  if (!buffer.byteLength) return bad("The workbook is empty.");
  if (!looksLikeExcel(new Uint8Array(buffer.slice(0, 4)))) return bad("The file is not an Excel workbook.");

  const month = monthKeySchema.safeParse(String(form.get("monthKey") || "") || deskMonthKey());
  if (!month.success) return bad("Choose the month as YYYY-MM.");

  let parsed;
  try {
    parsed = parseVolSurfaceWorkbook(buffer, month.data);
  } catch (err) {
    return bad(err instanceof Error ? err.message : "The workbook could not be read.");
  }

  const source = `upload ${file.name.replace(/[^\w .-]/g, "").slice(0, 120)}`;
  const params = Object.keys(parsed.params).length ? { ...(await loadActiveParams()).params, ...parsed.params } : null;
  try {
    const persisted = await saveReferenceData(
      { surface: parsed.surface, params: params ? { values: params, monthKey: deskMonthKey() } : undefined },
      source,
    );
    const surface = normalizeVolSurface(parsed.surface);
    return NextResponse.json({
      ok: true,
      surface,
      params,
      persisted,
      summary: { expiries: surface.expiries.length, strikePercents: surface.moneyness.length },
    });
  } catch (err) {
    if (err instanceof ReferenceDataError) return NextResponse.json({ error: "The workbook is not a complete surface.", issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: "The Volatility Surface could not be saved.", issues: ["Nothing was saved. Try again."] }, { status: 500 });
  }
}
