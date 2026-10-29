/**
 * Read-only check of the desk database: the collections, their validators, their indexes, documents that fail
 * the schema, orphans and junk. Exits 1 when anything is off and prints the plan to fix it.
 *
 *   npm run verify:db                                         # the database .env.local names, read only
 *   npm run verify:db -- --db hedging_sheet_preview --apply   # also fixes a preview database
 *
 * --apply never touches the production database: there it only prints the plan.
 */
import { isDeepStrictEqual } from "node:util";

import { COLLECTIONS } from "../lib/db/collections";
import { PRODUCTION_DB } from "../lib/db/config";
import { pricingParamsDocSchema, VALIDATORS, volSurfaceDocSchema } from "../lib/db/schemas";
import { applyValidators, ensureIndexes, INDEXES } from "../lib/db/setup";
import { istTodayYmd } from "../lib/engine/dates";
import { connectForScript, failSafely } from "./db-connect";
import { inspectDatabase } from "./db-inspect";

const SCHEMAS = { [COLLECTIONS.volSurfaces]: volSurfaceDocSchema, [COLLECTIONS.pricingParams]: pricingParamsDocSchema } as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const { client, db } = await connectForScript();
  const production = db.databaseName === PRODUCTION_DB;
  try {
    const report = await inspectDatabase(client, db, istTodayYmd().slice(0, 7));
    const infos = await db.listCollections({}, { nameOnly: false }).toArray();
    const plan: string[] = [];
    const deletions = new Map<string, unknown[]>();
    const drops: string[] = [];

    for (const [name, wanted] of Object.entries(INDEXES)) {
      const info = infos.find((i) => i.name === name) as { options?: { validator?: unknown; validationLevel?: string } } | undefined;
      if (!info) {
        plan.push(`create ${name}, its indexes and its validator`);
        continue;
      }
      const validator = info.options?.validator;
      if (!isDeepStrictEqual(validator, VALIDATORS[name as keyof typeof VALIDATORS])) plan.push(`${name}: apply the $jsonSchema validator`);
      if (info.options?.validationLevel !== "strict") plan.push(`${name}: set validation to strict`);

      const indexes = await db.collection(name).indexes();
      for (const w of wanted) {
        const ix = indexes.find((i) => i.name === w.name);
        if (!ix || !isDeepStrictEqual(ix.key, w.key) || Boolean(ix.unique) !== Boolean(w.unique)) plan.push(`${name}: create index ${w.name}${w.unique ? ", unique" : ""}`);
      }
      for (const ix of indexes) {
        if (ix.name !== "_id_" && !wanted.some((w) => w.name === ix.name)) plan.push(`${name}: drop unused index ${ix.name}`);
        if (ix.expireAfterSeconds != null) plan.push(`${name}: drop TTL index ${ix.name}; reference data is kept by month, not expired`);
      }

      const schema = SCHEMAS[name as keyof typeof SCHEMAS];
      const invalid: unknown[] = [];
      const reasons: string[] = [];
      for (const doc of await db.collection(name).find({}).toArray()) {
        const { _id, ...body } = doc;
        void _id;
        const parsed = schema.safeParse(body);
        if (parsed.success) continue;
        invalid.push(doc._id);
        reasons.push(...parsed.error.issues.slice(0, 3).map((i) => `${String(doc._id)} ${i.path.join(".")}: ${i.message}`));
      }
      if (invalid.length) {
        plan.push(`${name}: delete ${invalid.length} documents that fail the schema: ${invalid.map(String).join(", ")}; ${reasons.join("; ")}`);
        deletions.set(name, [...(deletions.get(name) ?? []), ...invalid]);
      }
    }

    for (const c of report.collections) {
      if (!c.kept) {
        plan.push(`drop ${c.name}, ${c.count} documents: not part of the design`);
        drops.push(c.name);
      } else if (c.junk.length) {
        plan.push(`${c.name}: delete ${c.junk.length} documents: ${c.junk.map((j) => `${String(j.id)} ${j.reason}`).join("; ")}`);
        deletions.set(c.name, [...(deletions.get(c.name) ?? []), ...c.junk.map((j) => j.id)]);
      }
      if (c.legacyFieldDocs) plan.push(`${c.name}: remove legacy fields from ${c.legacyFieldDocs} documents (npm run db:cleanup)`);
    }

    for (const c of report.collections) console.log(`${db.databaseName}.${c.name}: ${c.count} documents, ${c.indexes.length} indexes`);
    console.log("TTL indexes: none expected; every collection holds one reference document per month.");
    if (!plan.length) {
      console.log(`${db.databaseName} is clean: validators strict, unique monthKey indexes, no invalid documents, orphans or junk.`);
      return;
    }
    console.log(`Plan for ${db.databaseName}:\n  ${plan.join("\n  ")}`);
    if (!apply) process.exit(1);
    if (production) {
      console.log("The production database is never changed by this script. Review the plan, then run the db scripts by hand.");
      process.exit(1);
    }
    for (const [name, ids] of deletions) await db.collection(name).deleteMany({ _id: { $in: ids as never[] } });
    for (const name of drops) await db.collection(name).drop();
    for (const line of [...(await ensureIndexes(db)), ...(await applyValidators(db))]) console.log(`applied ${db.databaseName}.${line}`);
  } finally {
    await client.close();
  }
}

main().catch(failSafely);
