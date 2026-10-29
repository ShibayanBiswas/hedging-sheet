/** An in-memory replica set, so writes run in transactions as on Atlas, with the production validators and indexes. */
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { COLLECTIONS } from "../../lib/db/collections";
import { applyValidators, ensureIndexes } from "../../lib/db/setup";
import pricingParams from "../fixtures/pricing-params.json";
import surface from "../fixtures/surface.json";

export const TEST_DESK_KEY = "test-desk-key";

/** Puts the fixture surface and surface parameters in, as the only documents. */
export async function seedFixtures(db: Db): Promise<void> {
  const updatedAt = new Date();
  await db.collection(COLLECTIONS.volSurfaces).deleteMany({});
  await db.collection(COLLECTIONS.pricingParams).deleteMany({});
  await db.collection(COLLECTIONS.volSurfaces).insertOne({ ...surface, source: "fixture", updatedAt });
  await db.collection(COLLECTIONS.pricingParams).insertOne({ ...pricingParams, source: "fixture", updatedAt });
}

export async function startTestDatabase(dbName: string) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await applyValidators(db);
  await ensureIndexes(db);
  await seedFixtures(db);
  return {
    uri,
    db,
    async stop() {
      await client.close();
      await replSet.stop();
    },
  };
}
