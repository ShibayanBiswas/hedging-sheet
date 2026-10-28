/**
 * Prices the default product on the built in seed and checks the engine invariants.
 *
 *   npm run verify:calculations -- [spot] [YYYY-MM-DD]
 */
import { defaultInputs, seedMarketData } from "../lib/engine/defaults";
import { computeHedgingSheet } from "../lib/engine/hedging-sheet";

const spot = Number(process.argv[2] ?? 82000);
const valuationDate = process.argv[3] ?? "2026-10-27";

const r = computeHedgingSheet(defaultInputs({ valuationDate, spot, dailyVol: 0.009 }), seedMarketData());
if (!r.ok) {
  console.error("Blocked:", r.errors.map((e) => `${e.code}: ${e.message}`).join("\n"));
  process.exit(1);
}

const checks: Array<[string, boolean, string]> = [
  ["Inbuilt solves to the coupon", Math.abs(r.pricer.header.achievedCoupon - r.inputs.coupon) < 1e-8, (r.pricer.header.achievedCoupon - r.inputs.coupon).toExponential(2)],
  ["Option book matches the payoff at every kink", r.diagnostics.payoffBookGap < 1e-9, r.diagnostics.payoffBookGap.toExponential(2)],
  ["Spot bump is reset after the stress grid", r.diagnostics.spotBumpAfterStress === 0, String(r.diagnostics.spotBumpAfterStress)],
  ["Lower Maturity resolves for every leg", r.pricer.legs.every((l) => l.lowerMaturity != null), `${r.pricer.legs.length} legs`],
  ["Every leg price is finite", r.pricer.legs.every((l) => Number.isFinite(l.price)), ""],
  ["Stress grid has 15 moves", r.markToMarket.rows.length === 15, String(r.markToMarket.rows.length)],
];

console.log(`Start level ${r.structure.startLevel}, Actual Inbuilt ${(r.summary.actualInbuilt * 100).toFixed(4)} percent`);
for (const [label, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
if (r.warnings.length) console.log("Warnings:", r.warnings.map((w) => w.code).join(", "));
if (checks.some(([, ok]) => !ok)) process.exit(1);
