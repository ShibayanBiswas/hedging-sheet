/** Prints the database name, collection counts and sizes, and cluster storage. Never the URI. */
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const { closeDb, getDb } = await import("../lib/db/mongo");
  const db = await getDb();
  if (!db) {
    console.log("Mongo unavailable: check MONGODB_URI or MONGODB_HOST in .env.local");
    process.exit(1);
  }
  console.log(`Database ${db.databaseName}`);
  const collections = await db.listCollections().toArray();
  for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const stats = (await db.command({ collStats: c.name })) as { count?: number; size?: number; storageSize?: number };
    console.log(
      `  ${c.name.padEnd(18)} ${String(stats.count ?? 0).padStart(6)} documents  ${((stats.storageSize ?? 0) / 1024).toFixed(1)} KB stored`,
    );
  }
  try {
    const admin = db.admin();
    const list = (await admin.listDatabases()) as { databases: Array<{ name: string; sizeOnDisk?: number }>; totalSize?: number };
    const total = list.totalSize ?? list.databases.reduce((s, d) => s + (d.sizeOnDisk ?? 0), 0);
    console.log(`Cluster storage used ${(total / 1024 / 1024).toFixed(1)} MB across ${list.databases.length} databases`);
  } catch {
    console.log("Cluster storage: the user cannot list databases");
  }
  await closeDb();
}

void main();
