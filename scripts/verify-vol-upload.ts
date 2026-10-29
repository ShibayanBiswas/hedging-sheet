/**
 * Round trip of the vol surface file: build it from the built in seed in the Download Surface layout,
 * parse it as an upload, and check the grid, the forward Pricing Params and the surface parameters survive.
 * Also parses the public sample file.
 */
import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import { istTodayYmd } from "../lib/engine/dates";
import { seedMarketData } from "../lib/engine/defaults";
import { forwardMarket } from "../lib/engine/vol-surface";
import { buildSurfaceFile } from "../lib/excel/build-surface-file";
import { parseVolSurfaceFile } from "../lib/excel/parse-vol-surface";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const today = istTodayYmd();
  const market = seedMarketData();
  const live = forwardMarket(market, today);
  const wb = buildSurfaceFile(new ExcelJS.Workbook(), market.surface, market.params, { asOf: today });
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const parsed = parseVolSurfaceFile(buffer, market.surface.monthKey);

  check("Strike Change columns", JSON.stringify(parsed.surface.moneyness) === JSON.stringify(market.surface.moneyness), `${parsed.surface.moneyness.length}`);
  check("Expiry rows", parsed.surface.expiries.length === market.surface.expiries.length, `${parsed.surface.expiries.length}`);
  const volGap = Math.max(...parsed.surface.volsPercent.flatMap((row, r) => row.map((v, c) => Math.abs(v - Math.round(market.surface.volsPercent[r]![c]! * 100) / 100))));
  check("Volatility grid", volGap < 1e-9, `largest gap ${volGap.toExponential(2)}`);
  check("Forward Pricing Params grid", parsed.surface.pricingParams.length === live.surface.pricingParams.length, `${parsed.surface.pricingParams.length} rows`);
  check("Reference prices", parsed.surface.referenceSensexPrice === market.surface.referenceSensexPrice, String(parsed.surface.referenceSensexPrice));
  check("Bid or Offer", parsed.params.bidOffer === market.params.bidOffer, String(parsed.params.bidOffer));
  check("Rate Cap While Buying Forward", Math.abs((parsed.params.rateCapBuyingForward ?? 0) - market.params.rateCapBuyingForward) < 1e-12, String(parsed.params.rateCapBuyingForward));
  check("Dividend Bid or Offer Factor", parsed.params.dividendBidOfferMultiplier === market.params.dividendBidOfferMultiplier, String(parsed.params.dividendBidOfferMultiplier));
  check("Rate curve tenors", parsed.params.rateCurve?.length === market.params.rateCurve.length, `${parsed.params.rateCurve?.length}`);
  check("Future dividends", parsed.params.dividends?.length === live.params.dividends.length, `${parsed.params.dividends?.length}`);

  const sample = path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx");
  if (fs.existsSync(sample)) {
    const buf = fs.readFileSync(sample);
    const s = parseVolSurfaceFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    check("Public sample parses", s.surface.expiries.length > 0 && s.surface.moneyness.length > 0, `${s.surface.label}`);
  }
  console.log(failures ? `${failures} check${failures === 1 ? "" : "s"} failed` : "All checks passed");
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
