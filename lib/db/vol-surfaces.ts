import type { ClientSession, Db } from "mongodb";

import { DatabaseUnavailableError, getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { volSurfaceDocSchema, type VolSurfaceDoc } from "@/lib/db/schemas";
import type { VolSurface } from "@/lib/engine/types";

const collection = (db: Db) => db.collection<VolSurfaceDoc>(COLLECTIONS.volSurfaces);

/** The surface of the latest month on or before monthKey, without database fields. Throws when the database is down. */
export async function readSurfaceOnOrBefore(monthKey: string): Promise<VolSurface | null> {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const doc = await collection(db).find({ monthKey: { $lte: monthKey } }, { projection: { _id: 0, source: 0, updatedAt: 0 } }).sort({ monthKey: -1 }).limit(1).next();
  return (doc as VolSurface | null) ?? null;
}

/** Replaces the whole month in one write, so a reader never sees half a surface. */
export async function replaceSurface(db: Db, session: ClientSession, surface: VolSurface, source: string): Promise<void> {
  const doc = volSurfaceDocSchema.parse({ ...surface, source, updatedAt: new Date() });
  await collection(db).replaceOne({ monthKey: doc.monthKey }, doc, { upsert: true, session });
}

export async function surfaceSummary(db: Db): Promise<{ count: number; latestMonth: string | null }> {
  const [count, latest] = await Promise.all([
    collection(db).countDocuments(),
    collection(db).find({}, { projection: { monthKey: 1 } }).sort({ monthKey: -1 }).limit(1).next(),
  ]);
  return { count, latestMonth: latest?.monthKey ?? null };
}
