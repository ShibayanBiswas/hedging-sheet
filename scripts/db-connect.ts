import { MongoClient } from "mongodb";

import { resolveMongoConfig } from "../lib/db/config";
import { loadEnv } from "./load-env";

/** A client for one-off scripts, from .env.local. --db <name> picks another database, such as hedging_sheet_preview. */
export async function connectForScript() {
  loadEnv();
  const config = resolveMongoConfig();
  if (!config) throw new Error("Set MONGODB_URI or MONGODB_HOST in .env.local");
  const at = process.argv.indexOf("--db");
  const dbName = at > 0 ? process.argv[at + 1]! : config.dbName;
  const client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 10_000, ignoreUndefined: true });
  await client.connect();
  return { client, db: client.db(dbName) };
}

export function failSafely(err: unknown): never {
  console.error(err instanceof Error ? err.message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>") : err);
  process.exit(1);
}
