/**
 * Builds public/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx from the built in seed, in the same layout as
 * Download Surface on Market Data.
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

import { istTodayYmd } from "../lib/engine/dates";
import { seedMarketData } from "../lib/engine/defaults";
import { labelSurfaceForDeskMonth } from "../lib/engine/vol-surface";
import { buildSurfaceFile } from "../lib/excel/build-surface-file";

export const SAMPLE_FILE = "Hedging_Sheet_Vol_Surface_Sample.xlsx";

export async function buildVolSurfaceSample(outDir = path.join(process.cwd(), "public", "samples")): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const today = istTodayYmd();
  const market = seedMarketData();
  const surface = labelSurfaceForDeskMonth(market.surface, today.slice(0, 7), {
    nifty: market.surface.referenceUnderlyingPrice ?? null,
    sensex: market.surface.referenceSensexPrice ?? null,
  });
  const logoPath = path.join(process.cwd(), "public/brand/arwl-logo.png");
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString("base64") : null;
  const wb = buildSurfaceFile(new ExcelJS.Workbook(), surface, market.params, { logoBase64, asOf: today });
  const out = path.join(outDir, SAMPLE_FILE);
  await wb.xlsx.writeFile(out);
  return out;
}

if (process.argv[1] && /build-sample-inputs/.test(process.argv[1])) {
  void buildVolSurfaceSample().then((out) => console.log("Wrote", path.relative(process.cwd(), out)));
}
