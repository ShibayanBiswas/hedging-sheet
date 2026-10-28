/**
 * Bake the built in seed from a desk surface file in the upload layout.
 *
 *   npm run bake:vol -- "<surface.xlsx>" [YYYY-MM]
 *
 * The file is read by the same parser as the Market Data upload, so the seed and an
 * upload of the same file always agree. Writes lib/data/vol-surface-seed.json and
 * lib/data/pricing-params-seed.json.
 */
import fs from "node:fs";
import path from "node:path";

import { istTodayYmd } from "../lib/engine/dates";
import { normalizePricingParams, seedPricingParams } from "../lib/engine/defaults";
import { parseVolSurfaceWorkbook } from "../lib/workbook/parse-vol-surface";

const [src, monthArg] = process.argv.slice(2);
const monthKey = monthArg ?? istTodayYmd().slice(0, 7);
if (!src || !/^\d{4}-\d{2}$/.test(monthKey)) {
  console.error('Usage: npm run bake:vol -- "<surface.xlsx>" [YYYY-MM]');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`Surface file missing: ${src}`);
  process.exit(1);
}

const buf = fs.readFileSync(src);
const parsed = parseVolSurfaceWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), monthKey);
const params = normalizePricingParams({ ...seedPricingParams(), ...parsed.params });

const write = (rel: string, data: unknown) => {
  fs.writeFileSync(path.join(process.cwd(), rel), `${JSON.stringify(data, null, 2)}\n`);
  console.log("Wrote", rel);
};
write("lib/data/vol-surface-seed.json", parsed.surface);
write("lib/data/pricing-params-seed.json", params);
console.log({
  label: parsed.surface.label,
  expiries: parsed.surface.expiries.length,
  firstExpiry: parsed.surface.expiries[0]?.slice(0, 10),
  lastExpiry: parsed.surface.expiries.at(-1)?.slice(0, 10),
  strikeChangeColumns: parsed.surface.moneyness.length,
  bidOffer: params.bidOffer,
  rateCurvePoints: params.rateCurve.length,
});
