import type { ClientSession, Db } from "mongodb";

import { DatabaseUnavailableError, getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { pricingParamsDocSchema, type PricingParamsDoc } from "@/lib/db/schemas";
import type { PricingParams } from "@/lib/engine/types";

const collection = (db: Db) => db.collection<PricingParamsDoc>(COLLECTIONS.pricingParams);

/** Surface parameters of the latest month on or before monthKey. Throws when the database is down. */
export async function readParamsOnOrBefore(monthKey: string): Promise<{ params: PricingParams; monthKey: string } | null> {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const doc = await collection(db).find({ monthKey: { $lte: monthKey } }, { projection: { _id: 0, source: 0, updatedAt: 0 } }).sort({ monthKey: -1 }).limit(1).next();
  if (!doc) return null;
  const { monthKey: month, ...params } = doc as unknown as PricingParams & { monthKey: string };
  return { params, monthKey: month };
}

/** One document per month: saving the same month again replaces it. */
export async function replaceParams(db: Db, session: ClientSession, params: PricingParams, monthKey: string, source: string): Promise<void> {
  const doc = pricingParamsDocSchema.parse({ ...params, monthKey, source, updatedAt: new Date() });
  await collection(db).replaceOne({ monthKey }, doc, { upsert: true, session });
}

export async function paramsSummary(db: Db): Promise<{ count: number; latestMonth: string | null }> {
  const [count, latest] = await Promise.all([
    collection(db).countDocuments(),
    collection(db).find({}, { projection: { monthKey: 1 } }).sort({ monthKey: -1 }).limit(1).next(),
  ]);
  return { count, latestMonth: latest?.monthKey ?? null };
}
