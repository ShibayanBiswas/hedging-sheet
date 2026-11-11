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
import { normalizeVolSurface, SEED_SURFACE, withMonthScalars } from "../lib/engine/vol-surface";
import { parseVolSurfaceFile } from "../lib/excel/parse-vol-surface";

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
const parsed = parseVolSurfaceFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), monthKey);
// A file with one Surface Parameters point, such as a surface with no parameters sheet, keeps the built in dated
// Pricing Params grid and sets that point's bump and forward sell rate from its month onward, as Upload Surface does.
if (parsed.surface.pricingParams.length === 1) {
  const { volBump, fwdSellRate } = parsed.surface.pricingParams[0]!;
  parsed.surface.pricingParams = withMonthScalars(normalizeVolSurface(SEED_SURFACE).pricingParams, monthKey, { volBump, fwdSellRate });
}
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
  pricingParamsRows: parsed.surface.pricingParams.length,
  bidOffer: params.bidOffer,
  rateCurvePoints: params.rateCurve.length,
});
