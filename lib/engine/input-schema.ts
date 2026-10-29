import { z } from "zod";

import type { HedgeInputs, ValidationIssue } from "@/lib/engine/types";

const finite = (label: string) => z.number({ error: `${label} must be a number.` }).refine(Number.isFinite, `${label} must be a number.`);
const rate = (label: string) => finite(label).min(-0.5, `${label} looks too low.`).max(1, `${label} looks too high.`);

/** Types and ranges only. Business rules, with popup codes, live in the schedule and structure checks. */
const hedgeInputSchema = z.object({
  underlying: z.enum(["Nifty", "Sensex"]),
  valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the Valuation Date as a calendar date."),
  // NaN until the live close arrives; the positive check names it.
  spot: z.union([z.number(), z.nan()]),
  startLevelUplift: finite("Start Level Uplift").min(0).max(0.2),
  startLevelRounding: finite("Start Level Rounding").positive(),
  nbfcRate: rate("NBFC Rate"),
  premiumRate: rate("Premium Growth Rate"),
  marginGrowthRate: rate("Margin Growth Rate"),
  coupon: z.union([z.number(), z.nan()]),
  decay: z.union([z.number(), z.nan()]),
  tenorDays: z.union([z.number(), z.nan()]),
  strikePercents: z.array(z.union([z.number(), z.nan()])),
  participations: z.array(z.union([z.number(), z.nan(), z.null()])),
  floorUnits: finite("Decay Reduction Below Floor"),
  // A spread without an entry is a put spread.
  spreadOptionTypes: z.array(z.enum(["P", "C"])),
  expiryCount: z.number().int(),
  expiryMonths: z.array(z.union([z.number(), z.nan()])),
  hedgeExpiryIndex: z.number().int().min(0).nullable(),
  notionalCr: z.union([z.number(), z.nan()]),
  transactionCost: rate("Transaction Cost"),
  issuanceCost: rate("Issuance Cost"),
  marginCost: rate("Margin Cost"),
  dailyVol: z.union([z.number(), z.nan()]),
  dailyVolSource: z.enum(["calculated", "overridden", "fallback"]),
  historyWindowDays: z.number().int().min(30).max(3650),
  exposureMargin: rate("Exposure Margin"),
  futuresMargin: rate("Futures Margin"),
  hedgeStrike: z.union([z.number(), z.nan()]),
  hedgeStrikeAuto: z.boolean(),
  exchangeForwardRate: rate("Exchange Forward Rate"),
  exchangeDiscountRate: rate("Exchange Discount Rate"),
  stressedForwardRate: rate("Stressed Forward Rate"),
  stressedDiscountRate: rate("Stressed Discount Rate"),
  stressSigmas: finite("Shock Sigmas").min(0),
  stressDays: finite("Shock Days").min(0),
  stressVolMultiplier: finite("Volatility Multiplier").positive(),
  legVolOverrides: z.record(z.string(), z.number()),
  hedgeVolOverride: z.number().nullable(),
});

export function checkInputShape(inputs: HedgeInputs): ValidationIssue[] {
  const parsed = hedgeInputSchema.safeParse(inputs);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message, code: "shape" }));
}
