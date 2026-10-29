/** Indexes and validators, applied by scripts on deploy and by the test harness. */
import type { Db, IndexSpecification } from "mongodb";

import { COLLECTIONS, type CollectionName } from "@/lib/db/collections";
import { VALIDATORS } from "@/lib/db/schemas";

/**
 * Only the indexes the queries use. Both collections are read as "latest month on or before",
 * which the unique monthKey index serves in either direction. No collection holds time series, so no TTL index is needed.
 */
export const INDEXES: Record<CollectionName, Array<{ name: string; key: IndexSpecification; unique?: boolean }>> = {
  [COLLECTIONS.volSurfaces]: [{ name: "monthKey_unique", key: { monthKey: 1 }, unique: true }],
  [COLLECTIONS.pricingParams]: [{ name: "monthKey_unique", key: { monthKey: 1 }, unique: true }],
};

async function ensureCollection(db: Db, name: string): Promise<void> {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) await db.createCollection(name);
}

/** Creates the listed indexes and drops any other, apart from _id. Returns what changed. */
export async function ensureIndexes(db: Db): Promise<string[]> {
  const changes: string[] = [];
  for (const [name, wanted] of Object.entries(INDEXES)) {
    await ensureCollection(db, name);
    const col = db.collection(name);
    for (const ix of wanted) {
      await col.createIndex(ix.key, { name: ix.name, unique: ix.unique ?? false });
    }
    const names = new Set(wanted.map((w) => w.name));
    for (const ix of await col.indexes()) {
      if (ix.name && ix.name !== "_id_" && !names.has(ix.name)) {
        await col.dropIndex(ix.name);
        changes.push(`${name}: dropped unused index ${ix.name}`);
      }
    }
    changes.push(`${name}: ${wanted.map((w) => w.name).join(", ")}`);
  }
  return changes;
}

/** Makes the database reject any document that does not match the schema. */
export async function applyValidators(db: Db): Promise<string[]> {
  const changes: string[] = [];
  for (const [name, validator] of Object.entries(VALIDATORS)) {
    await ensureCollection(db, name);
    await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    changes.push(`${name}: $jsonSchema validator, strict, error`);
  }
  return changes;
}
