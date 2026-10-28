/**
 * Prices the default product and checks every Pricer leg against an independent closed form,
 * put-call parity and the bump-and-reprice Greeks.
 *
 *   npm run verify:pricer -- [spot] [YYYY-MM-DD]
 */
import { bsPrice } from "../lib/engine/black-scholes";
import { formatDate } from "../lib/engine/dates";
import { defaultInputs, seedMarketData } from "../lib/engine/defaults";
import { computeHedgingSheet } from "../lib/engine/hedging-sheet";
import { normCdf } from "../lib/engine/normal";
import { forwardMarket } from "../lib/engine/vol-surface";
import { strikeLabel } from "../lib/tables";

const spot = Number(process.argv[2] ?? 82000);
const valuationDate = process.argv[3] ?? "2026-10-27";
const r = computeHedgingSheet(defaultInputs({ valuationDate, spot, dailyVol: 0.009 }), forwardMarket(seedMarketData(), valuationDate));
if (!r.ok) {
  console.error("Blocked:", r.errors.map((e) => e.message).join("; "));
  process.exit(1);
}

let worstPrice = 0;
let worstParity = 0;
let worstDelta = 0;
let unresolved = 0;
for (const l of r.pricer.legs) {
  const T = l.days / 365;
  const F = l.spot * Math.exp(l.forwardGrowth * T);
  const sd = l.volatility * Math.sqrt(T);
  const d1 = (Math.log(F / l.strike) + 0.5 * sd * sd) / sd;
  const d2 = d1 - sd;
  const df = Math.exp(-l.discountYield * T);
  const put = df * (l.strike * normCdf(-d2) - F * normCdf(-d1));
  const analyticDelta = -df * Math.exp(l.forwardGrowth * T) * normCdf(-d1);
  const args = { spot: l.spot, strike: l.strike, days: l.days, growth: l.forwardGrowth, discount: l.discountYield, vol: l.volatility };
  const parity = bsPrice({ ...args, type: "C" }) - bsPrice({ ...args, type: "P" }) - df * (F - l.strike);
  worstPrice = Math.max(worstPrice, Math.abs(l.price - put) / Math.max(1, put));
  worstParity = Math.max(worstParity, Math.abs(parity));
  worstDelta = Math.max(worstDelta, Math.abs(l.delta - analyticDelta));
  if (!l.lowerMaturity || !l.upperMaturity) unresolved += 1;
}

const checks: Array<[string, boolean, string]> = [
  ["Every leg equals the closed form", worstPrice < 1e-9, `worst relative gap ${worstPrice.toExponential(2)}`],
  ["Put-call parity holds on every leg", worstParity < 1e-6, `worst gap ${worstParity.toExponential(2)}`],
  ["Delta by bump equals the analytic delta", worstDelta < 1e-5, `worst gap ${worstDelta.toExponential(2)}`],
  ["Upper and Lower Maturity resolve on every leg", unresolved === 0, `${r.pricer.legs.length} legs`],
  ["Bid carries no incremental margin", r.pricer.legs.every((l) => l.bidOffer !== "B" || l.incrementalMargin === 0), ""],
];

console.log(`${r.pricer.legs.length} live legs · start level ${r.structure.startLevel}`);
for (const l of r.pricer.legs.filter((l) => l.expiryIndex === 0)) {
  console.log(
    `  ${strikeLabel(l.strikePercent, l.strike).padEnd(18)} ${formatDate(l.maturity)}  vol ${(l.volatility * 100).toFixed(2)}%  price ${l.price.toFixed(2)}  delta ${l.delta.toFixed(4)}  ${l.action}`,
  );
}
for (const [label, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
