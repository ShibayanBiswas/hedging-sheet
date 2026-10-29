/** Applies the $jsonSchema validators, strict, so the database rejects bad documents. Usage: npx tsx scripts/db-apply-validators.ts [--db name] */
import { applyValidators } from "../lib/db/setup";
import { connectForScript, failSafely } from "./db-connect";

async function main() {
  const { client, db } = await connectForScript();
  try {
    for (const line of await applyValidators(db)) console.log(`${db.databaseName}.${line}`);
  } finally {
    await client.close();
  }
}

main().catch(failSafely);
