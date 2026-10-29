/** Creates the indexes the queries use and drops any other. Runs on deploy. Usage: npx tsx scripts/db-ensure-indexes.ts [--db name] */
import { ensureIndexes } from "../lib/db/setup";
import { connectForScript, failSafely } from "./db-connect";

async function main() {
  const { client, db } = await connectForScript();
  try {
    for (const line of await ensureIndexes(db)) console.log(`${db.databaseName}.${line}`);
  } finally {
    await client.close();
  }
}

main().catch(failSafely);
