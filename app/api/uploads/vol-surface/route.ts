import { NextResponse } from "next/server";

import { loadActiveParams, persistActiveParams, persistActiveSurface } from "@/lib/data/load";
import { istTodayYmd } from "@/lib/engine/dates";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";
import { parseVolSurfaceWorkbook } from "@/lib/workbook/parse-vol-surface";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "File required", issues: ["Choose an Excel workbook to upload."] }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "File required", issues: ["Choose an Excel workbook to upload."] }, { status: 400 });
  }
  const buffer = await file.arrayBuffer();
  if (!buffer.byteLength) return NextResponse.json({ error: "The workbook is empty.", issues: ["The workbook is empty."] }, { status: 400 });
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "The workbook is too large.", issues: ["Keep the upload under 8 MB."] }, { status: 400 });
  }
  const monthKey = String(form.get("monthKey") || "") || istTodayYmd().slice(0, 7);

  let parsed;
  try {
    parsed = parseVolSurfaceWorkbook(buffer, monthKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The workbook could not be read.";
    return NextResponse.json({ error: message, issues: [message] }, { status: 400 });
  }

  const surface = normalizeVolSurface(parsed.surface);
  try {
    let persisted = await persistActiveSurface(surface, file.name || "upload.xlsx");
    let params = null;
    if (Object.keys(parsed.params).length) {
      const { params: current } = await loadActiveParams();
      params = { ...current, ...parsed.params };
      persisted = (await persistActiveParams(params, file.name || "upload.xlsx")) && persisted;
    }
    return NextResponse.json({
      ok: true,
      surface,
      params,
      persisted,
      summary: { expiries: surface.expiries.length, strikePercents: surface.moneyness.length },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "The Volatility Surface could not be saved.", issues: [err instanceof Error ? err.message : "Write failed"] },
      { status: 500 },
    );
  }
}
