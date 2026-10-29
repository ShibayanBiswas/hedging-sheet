/**
 * The shape of every document the desk stores. Zod checks each write in the app; the matching
 * $jsonSchema validators make the database itself reject anything else (scripts/db-apply-validators.ts).
 */
import { z } from "zod";

import { COLLECTIONS, type CollectionName } from "@/lib/db/collections";

const finite = z.number().finite();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Use an ISO date");
export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month");

const pricingParamPointSchema = z
  .object({
    date: isoDate,
    volBump: finite,
    fwdSellRate: finite,
    incMargin: finite.optional(),
    fullMargin: finite.optional(),
    marginCost: finite.optional(),
  })
  .strict();

const volSurfaceShape = z
  .object({
    monthKey: monthKeySchema,
    label: z.string().min(1),
    deepStrike: finite.positive(),
    moneyness: z.array(finite).min(1),
    strikes: z.array(finite).min(1),
    expiries: z.array(isoDate).min(1),
    volsPercent: z.array(z.array(finite).min(1)).min(1),
    pricingParams: z.array(pricingParamPointSchema),
    referenceUnderlyingPrice: finite.positive().optional(),
    referenceSensexPrice: finite.positive().optional(),
    niftyAnchorAsOf: isoDate.optional(),
  })
  .strict();

type SurfaceGrid = { expiries: string[]; strikes: number[]; volsPercent: number[][] };

function withGridChecks<T extends z.ZodType<SurfaceGrid>>(schema: T) {
  return schema
    .refine((s) => s.volsPercent.length === s.expiries.length, { message: "Each expiry needs one row of volatilities", path: ["volsPercent"] })
    .refine((s) => s.volsPercent.every((row) => row.length === s.strikes.length), {
      message: "Each volatility row needs one value per strike",
      path: ["volsPercent"],
    });
}

export const volSurfaceSchema = withGridChecks(volSurfaceShape);

export const pricingParamsSchema = z
  .object({
    forwardSellRate: finite,
    premiumRateSpread: finite,
    rateCapBuyingForward: finite,
    dividendBidOfferMultiplier: finite,
    bidOffer: z.enum(["B", "O"]),
    rateCurve: z
      .array(z.object({ years: finite.min(0), ratePercent: finite, linkedToPremiumRate: z.boolean().optional() }).strict())
      .min(1),
    dividends: z.array(z.object({ date: isoDate, amount: finite }).strict()),
  })
  .strict();

const meta = { source: z.string().min(1).max(200), updatedAt: z.date() };

/** Stored documents: the reference data plus where it came from and when. */
export const volSurfaceDocSchema = withGridChecks(volSurfaceShape.extend(meta));
export const pricingParamsDocSchema = pricingParamsSchema.extend({ monthKey: monthKeySchema, ...meta });

export type VolSurfaceDoc = z.infer<typeof volSurfaceDocSchema>;
export type PricingParamsDoc = z.infer<typeof pricingParamsDocSchema>;

/** Readable issues for an API response: "volsPercent: Each expiry needs one row of volatilities". */
export function schemaIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}

// MongoDB validators. "number" covers double, int, long and decimal.
const num = { bsonType: "number" };
const dateStr = { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" };
const monthKey = { bsonType: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" };
const metaProps = { _id: { bsonType: "objectId" }, source: { bsonType: "string", minLength: 1 }, updatedAt: { bsonType: "date" } };

export const VALIDATORS: Record<CollectionName, { $jsonSchema: Record<string, unknown> }> = {
  [COLLECTIONS.volSurfaces]: {
    $jsonSchema: {
      bsonType: "object",
      additionalProperties: false,
      required: ["monthKey", "label", "deepStrike", "moneyness", "strikes", "expiries", "volsPercent", "pricingParams", "source", "updatedAt"],
      properties: {
        ...metaProps,
        monthKey,
        label: { bsonType: "string", minLength: 1 },
        deepStrike: num,
        moneyness: { bsonType: "array", minItems: 1, items: num },
        strikes: { bsonType: "array", minItems: 1, items: num },
        expiries: { bsonType: "array", minItems: 1, items: dateStr },
        volsPercent: { bsonType: "array", minItems: 1, items: { bsonType: "array", minItems: 1, items: num } },
        pricingParams: {
          bsonType: "array",
          items: {
            bsonType: "object",
            additionalProperties: false,
            required: ["date", "volBump", "fwdSellRate"],
            properties: { date: dateStr, volBump: num, fwdSellRate: num, incMargin: num, fullMargin: num, marginCost: num },
          },
        },
        referenceUnderlyingPrice: num,
        referenceSensexPrice: num,
        niftyAnchorAsOf: dateStr,
      },
    },
  },
  [COLLECTIONS.pricingParams]: {
    $jsonSchema: {
      bsonType: "object",
      additionalProperties: false,
      required: [
        "monthKey",
        "forwardSellRate",
        "premiumRateSpread",
        "rateCapBuyingForward",
        "dividendBidOfferMultiplier",
        "bidOffer",
        "rateCurve",
        "dividends",
        "source",
        "updatedAt",
      ],
      properties: {
        ...metaProps,
        monthKey,
        forwardSellRate: num,
        premiumRateSpread: num,
        rateCapBuyingForward: num,
        dividendBidOfferMultiplier: num,
        bidOffer: { enum: ["B", "O"] },
        rateCurve: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            additionalProperties: false,
            required: ["years", "ratePercent"],
            properties: { years: num, ratePercent: num, linkedToPremiumRate: { bsonType: "bool" } },
          },
        },
        dividends: {
          bsonType: "array",
          items: { bsonType: "object", additionalProperties: false, required: ["date", "amount"], properties: { date: dateStr, amount: num } },
        },
      },
    },
  },
};
