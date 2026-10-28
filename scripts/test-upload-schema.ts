/** Builds the vol surface sample, parses it as an upload and prints what the desk would receive. */
import fs from "node:fs";
import path from "node:path";

import { parseVolSurfaceWorkbook } from "../lib/workbook/parse-vol-surface";
import { buildVolSurfaceSample } from "./build-sample-inputs";

async function main() {
  const file = await buildVolSurfaceSample(path.join(process.cwd(), "test-results", "samples"));
  const buf = fs.readFileSync(file);
  const parsed = parseVolSurfaceWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const s = parsed.surface;
  const ok = s.expiries.length > 0 && s.moneyness.length > 0 && s.volsPercent.every((row) => row.length === s.strikes.length);
  console.log(`${ok ? "PASS" : "FAIL"}  ${path.basename(file)}`);
  console.log({
    label: s.label,
    expiries: s.expiries.length,
    strikeChangeColumns: s.moneyness.length,
    referenceNifty: s.referenceUnderlyingPrice,
    referenceSensex: s.referenceSensexPrice,
    bidOffer: parsed.params.bidOffer,
    rateCurvePoints: parsed.params.rateCurve?.length ?? 0,
    dividendPoints: parsed.params.dividends?.length ?? 0,
  });
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
