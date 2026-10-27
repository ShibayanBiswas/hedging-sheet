import { MongoClient, type Db, type WriteConcern } from "mongodb";

import { resolveMongoConfig } from "@/lib/db/mongo-config";

let client: MongoClient | null = null;
let db: Db | null = null;
let connectedUri = "";
let connectTask: Promise<Db | null> | null = null;
let connectTaskUri = "";
let connectEpoch = 0;

const ACKNOWLEDGED: WriteConcern = { w: "majority" };

/** Repair truncated Atlas write-concern names such as w=majorit. */
export function sanitizeMongoUri(uri: string): string {
  return uri.replace(/([?&]w=)([^&]*)/gi, (_full, prefix: string, value: string) => {
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      decoded = value;
    }
    const key = decoded.trim().toLowerCase();
    if (key === "majority" || /^\d+$/.test(key)) return `${prefix}${value}`;
    if (key.startsWith("major")) return `${prefix}majority`;
    return `${prefix}${value}`;
  });
}

export function isWriteConcernError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /write concern mode named/i.test(message) || /wtimeout/i.test(message);
}

export async function closeDb(): Promise<void> {
  connectEpoch += 1;
  connectTask = null;
  connectTaskUri = "";
  const current = client;
  client = null;
  db = null;
  connectedUri = "";
  if (current) await current.close().catch(() => undefined);
}

async function openDb(uri: string, dbName: string): Promise<Db | null> {
  const ticket = connectEpoch;
  const previous = client;
  client = null;
  db = null;
  connectedUri = "";
  if (previous) await previous.close().catch(() => undefined);
  const next = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, writeConcern: ACKNOWLEDGED });
  try {
    await next.connect();
    if (ticket !== connectEpoch) {
      await next.close().catch(() => undefined);
      return null;
    }
    client = next;
    db = next.db(dbName);
    connectedUri = uri;
    return db;
  } catch (err) {
    console.error("[mongo] connection failed", err instanceof Error ? err.message : "unknown error");
    await next.close().catch(() => undefined);
    return null;
  }
}

/** Cached connection. Returns null, never throws, so the desk can run from the seeds. */
export async function getDb(): Promise<Db | null> {
  const config = resolveMongoConfig();
  if (!config) return null;
  const uri = sanitizeMongoUri(config.uri);
  if (db && connectedUri === uri) return db;
  if (connectTask && connectTaskUri === uri) return connectTask;
  const task = openDb(uri, config.dbName);
  connectTask = task;
  connectTaskUri = uri;
  void task.finally(() => {
    if (connectTask === task) {
      connectTask = null;
      connectTaskUri = "";
    }
  });
  return task;
}

/** Retry once with w=1 when the cluster rejects the majority write concern. */
export async function writeWithRetry(label: string, op: (acknowledged: boolean) => Promise<void>): Promise<void> {
  try {
    await op(true);
  } catch (err) {
    if (!isWriteConcernError(err)) {
      throw new Error(err instanceof Error ? err.message : `${label} could not be written to the desk database.`);
    }
    await op(false);
  }
}

export const COLLECTIONS = {
  volSurfaces: "vol_surfaces",
  pricingParams: "pricing_params",
  uploadLogs: "upload_logs",
  savedProducts: "saved_products",
} as const;
