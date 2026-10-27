import { z } from "zod";

import { MAX_EXPIRIES } from "@/lib/engine/schedule";
import type { HedgeInputs, ValidationIssue } from "@/lib/engine/types";

const finite = (label: string) => z.number({ error: `${label} must be a number.` }).refine(Number.isFinite, `${label} must be a number.`);
const rate = (label: string) => finite(label).min(-0.5, `${label} looks too low.`).max(1, `${label} looks too high.`);

export const hedgeInputSchema = z.object({
  mode: z.enum(["workbook", "live"]),
  underlying: z.enum(["Nifty", "Sensex"]),
  valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the Valuation Date as a calendar date."),
  spot: finite("Spot").positive("Spot must be above zero."),
  startLevelUplift: finite("Start Level Uplift").min(0).max(0.2),
  startLevelRounding: finite("Start Level Rounding").positive(),
  nbfcRate: rate("NBFC Rate"),
  premiumRate: rate("Premium Growth Rate"),
  marginGrowthRate: rate("Margin Growth Rate"),
  target: finite("Target").positive("Target must be above zero."),
  coupon: finite("Coupon").positive("Coupon must be above zero."),
  protection: finite("Protection").gt(0, "Protection must be above zero.").lt(1, "Protection must be below 100 percent."),
  decay: finite("Decay").positive("Decay must be above zero."),
  tenorDays: z.number().int("Tenor in Days must be a whole number.").positive("Tenor in Days must be above zero."),
  expiryCount: z
    .number()
    .int("The Number Of Expiry Dates must be a whole number.")
    .min(1, "Enter at least one expiry date.")
    .max(MAX_EXPIRIES, `Use at most ${MAX_EXPIRIES} expiry dates.`),
  // Blank month fields are NaN; the schedule check names them with a friendly message.
  expiryMonths: z.array(z.union([z.number(), z.nan()])),
  expiryOverrides: z.array(z.string().nullable()),
  expiryWeekday: z.number().int().min(0).max(6),
  hedgeExpiryIndex: z.number().int().min(0).nullable(),
  spreads: z
    .array(
      z.object({
        buy: finite("Buy Level"),
        sell: finite("Sell Level"),
        participation: finite("Participation Rate"),
      }),
    )
    .min(1, "Add at least one spread."),
  autoParticipation: z.boolean(),
  outflowWidth: finite("Outflow Width").positive(),
  floorLevel: finite("Decay Floor Level").gt(0).lt(1),
  floorUnits: finite("Floor Units"),
  notionalCr: finite("Notional in Crore").positive("Notional in Crore must be above zero."),
  transactionCost: rate("Transaction Cost"),
  issuanceCost: rate("Issuance Cost"),
  marginCost: rate("Margin Cost"),
  dailyVol: finite("Daily Volatility").positive("Daily Volatility must be above zero.").max(0.2),
  exposureMargin: rate("Exposure Margin"),
  futuresMargin: rate("Futures Margin"),
  hedgeStrike: finite("Hedge Strike").positive("Hedge Strike must be above zero."),
  hedgeStrikeAuto: z.boolean(),
  exchangeForwardRate: rate("Exchange Forward Rate"),
  exchangeDiscountRate: rate("Exchange Discount Rate"),
  stressedForwardRate: rate("Stressed Forward Rate"),
  stressedDiscountRate: rate("Stressed Discount Rate"),
  stressSigmas: finite("Stress Sigmas").min(0),
  stressDays: finite("Stress Days").min(0),
  stressVolMultiplier: finite("Stress Volatility Multiplier").positive(),
  volBump: finite("Volatility Bump"),
  bidOffer: z.enum(["B", "O"]),
});

export function checkInputShape(inputs: HedgeInputs): ValidationIssue[] {
  const parsed = hedgeInputSchema.safeParse(inputs);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
}
