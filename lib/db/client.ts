import { MongoClient, type ClientSession, type Db } from "mongodb";

import { resolveMongoConfig } from "@/lib/db/config";

type Cached = { uri: string; dbName: string; client: Promise<MongoClient | null> };

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("The desk database is not available.");
  }
}

/** One client per server instance, kept on globalThis so dev reloads reuse it. */
const store = globalThis as typeof globalThis & { __hedgingMongo?: Cached };

const CLIENT_OPTIONS = {
  appName: "hedging-sheet",
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 6_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  retryWrites: true,
  writeConcern: { w: "majority" as const },
  // Optional fields left undefined are omitted rather than stored as null.
  ignoreUndefined: true,
};

/** Repair truncated Atlas write-concern names such as w=majorit. */
function sanitizeMongoUri(uri: string): string {
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

async function connect(uri: string): Promise<MongoClient | null> {
  const client = new MongoClient(uri, CLIENT_OPTIONS);
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.error("[mongo] connection failed:", err instanceof Error ? err.message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>") : "unknown error");
    await client.close().catch(() => undefined);
    return null;
  }
}

/** The desk database, or null when it is not configured or cannot be reached. Never throws. */
export async function getDb(): Promise<Db | null> {
  const config = resolveMongoConfig();
  if (!config) return null;
  const uri = sanitizeMongoUri(config.uri);
  let cached = store.__hedgingMongo;
  if (!cached || cached.uri !== uri || cached.dbName !== config.dbName) {
    if (cached) void cached.client.then((c) => c?.close()).catch(() => undefined);
    cached = { uri, dbName: config.dbName, client: connect(uri) };
    store.__hedgingMongo = cached;
  }
  const client = await cached.client;
  if (!client) {
    // A failed connection is not cached, so the next request tries again.
    if (store.__hedgingMongo === cached) store.__hedgingMongo = undefined;
    return null;
  }
  return client.db(cached.dbName);
}

/** Runs every write in one transaction, so a reader never sees half a change. Null when there is no database. */
export async function withTransaction<T>(work: (db: Db, session: ClientSession) => Promise<T>): Promise<T | null> {
  const db = await getDb();
  const client = await store.__hedgingMongo?.client;
  if (!db || !client) return null;
  const session = client.startSession();
  try {
    let out: T | undefined;
    await session.withTransaction(async () => {
      out = await work(db, session);
    });
    return out as T;
  } finally {
    await session.endSession();
  }
}

export async function closeDb(): Promise<void> {
  const cached = store.__hedgingMongo;
  store.__hedgingMongo = undefined;
  const client = await cached?.client;
  if (client) await client.close().catch(() => undefined);
}
