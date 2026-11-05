/**
 * The Unwinding Calculator's vol_surfaces collection: the one desk Volatility Surface both apps price on.
 * Its documents carry the grid, the Nifty and Sensex anchors, a one point pricingParams and isActive.
 */
import type { ClientSession, Db } from "mongodb";

import { DatabaseUnavailableError, getUnwindingDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { PricingParamPoint, VolSurface } from "@/lib/engine/types";

/** The grid fields both apps share. The Pricing Params grid stays with each app. */
export type SharedGrid = Omit<VolSurface, "pricingParams" | "niftyAnchorAsOf">;

type UnwindingDoc = SharedGrid & { pricingParams?: PricingParamPoint[]; bidAskSpread?: number | null; isActive?: boolean; source?: string; updatedAt?: Date };

const collection = (db: Db) => db.collection<UnwindingDoc>(COLLECTIONS.volSurfaces);

export function sharedGrid(surface: SharedGrid): SharedGrid {
  return {
    monthKey: surface.monthKey,
    label: surface.label,
    deepStrike: surface.deepStrike,
    moneyness: surface.moneyness,
    strikes: surface.strikes,
    expiries: surface.expiries,
    volsPercent: surface.volsPercent,
    referenceUnderlyingPrice: surface.referenceUnderlyingPrice,
    referenceSensexPrice: surface.referenceSensexPrice,
  };
}

/**
 * The Unwinding Calculator's own rule: this month's surface when it has a grid, else the latest earlier month with one.
 * Null when it stores none. Throws when the database is down.
 */
export async function readUnwindingSurface(monthKey: string): Promise<SharedGrid | null> {
  const db = await getUnwindingDb();
  if (!db) throw new DatabaseUnavailableError();
  const doc = await collection(db)
    .find({ monthKey: { $lte: monthKey }, "expiries.0": { $exists: true } }, { projection: { _id: 0 } })
    .sort({ monthKey: -1 })
    .limit(1)
    .next();
  return doc ? sharedGrid(doc) : null;
}

/**
 * Writes a grid as the Unwinding Calculator's active surface, the way its own upload does: other months
 * lose isActive, the month keeps its own Pricing Params point when it has one, and the upload is logged.
 */
export async function writeUnwindingSurface(db: Db, session: ClientSession, surface: VolSurface, source: string, monthPoint: PricingParamPoint): Promise<void> {
  const col = collection(db);
  const existing = await col.findOne({ monthKey: surface.monthKey }, { session, projection: { pricingParams: 1 } });
  await col.updateMany({ monthKey: { $ne: surface.monthKey }, isActive: true }, { $set: { isActive: false } }, { session });
  await col.updateOne(
    { monthKey: surface.monthKey },
    { $set: { ...sharedGrid(surface), pricingParams: existing?.pricingParams?.length ? existing.pricingParams : [monthPoint], isActive: true, source, updatedAt: new Date() } },
    { upsert: true, session },
  );
  await db.collection("upload_logs").insertOne({ type: "vol_surface", filename: source, monthKey: surface.monthKey, at: new Date() }, { session });
}
