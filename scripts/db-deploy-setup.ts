/**
 * Runs on every Vercel build (package.json vercel-build): the indexes and validators of the database this
 * deployment uses, so production, previews and development each match the code. Skips when no database is configured.
 */
import { MongoClient } from "mongodb";

import { resolveMongoConfig } from "../lib/db/config";
import { applyValidators, ensureIndexes } from "../lib/db/setup";
import { failSafely } from "./db-connect";
import { loadEnv } from "./load-env";

async function main() {
  loadEnv();
  const config = resolveMongoConfig();
  if (!config) {
    console.log("db setup: no database configured, skipped");
    return;
  }
  const client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  try {
    const db = client.db(config.dbName);
    for (const line of [...(await ensureIndexes(db)), ...(await applyValidators(db))]) console.log(`db setup: ${db.databaseName}.${line}`);
  } finally {
    await client.close();
  }
}

main().catch(failSafely);
