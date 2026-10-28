/** Runs every input edge case through the engine and prints the popup message and fix the desk would see. */
import { defaultInputs, seedMarketData } from "../lib/engine/defaults";
import { computeHedgingSheet } from "../lib/engine/hedging-sheet";
import type { HedgeInputs } from "../lib/engine/types";

const base = defaultInputs({ valuationDate: "2026-10-27", spot: 82000, dailyVol: 0.009 });
const cases: Array<[string, Partial<HedgeInputs>]> = [
  ["strike-order", { strikePercents: [137, 127, 128, 85, 84, 70] }],
  ["strike-positive", { strikePercents: [137, 127, 125, 85, 84, 0] }],
  ["participation", { participations: [-1, null] }],
  ["coupon-unreachable", { participations: [1, 2] }],
  ["protection", { strikePercents: [137, 127, 125, 101, 100, 70] }],
  ["floor-units", { floorUnits: 2 }],
  ["spread-count", { strikePercents: [137, 85, 84], participations: [] }],
  ["expiry-order", { expiryMonths: [41, 44, 44, 50, 53, 56] }],
  ["expiry-maturity", { expiryMonths: [41, 44, 47, 50, 53, 70] }],
  ["tenor", { tenorDays: 0 }],
];

let failed = 0;
for (const [code, overrides] of cases) {
  const r = computeHedgingSheet({ ...base, ...overrides }, seedMarketData());
  const issue = r.ok ? undefined : r.errors.find((e) => e.code === code);
  if (!issue?.fix) failed++;
  console.log(`${issue?.fix ? "PASS" : "FAIL"}  ${code}`);
  if (issue) console.log(`      ${issue.message}\n      Fix: ${issue.fix}`);
}
if (failed) process.exit(1);
