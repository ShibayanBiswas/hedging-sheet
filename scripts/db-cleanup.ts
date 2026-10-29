/**
 * Removes junk from the desk database: legacy and duplicate documents, test and debug documents,
 * collections outside the design, and leftover test databases. Dry run by default.
 *
 *   npx tsx scripts/db-cleanup.ts            # prints exactly what would change
 *   npx tsx scripts/db-cleanup.ts --apply    # backs every affected collection up to backups/<date>/, then changes it
 */
import fs from "node:fs";
import path from "node:path";

import { BSON, type Db, type Document } from "mongodb";

import { COLLECTIONS } from "../lib/db/collections";
import { pricingParamsDocSchema, volSurfaceDocSchema } from "../lib/db/schemas";
import { istTodayYmd } from "../lib/engine/dates";
import { connectForScript, failSafely } from "./db-connect";
import { writeReportSection } from "./db-report";
import { inspectDatabase, LEGACY_FIELDS } from "./db-inspect";

type Step =
  | { kind: "delete"; db: string; collection: string; ids: unknown[]; reasons: string[] }
  | { kind: "unset"; db: string; collection: string; count: number }
  | { kind: "drop-collection"; db: string; collection: string; count: number }
  | { kind: "drop-database"; db: string; count: number };

const SCHEMAS: Record<string, { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } }> = {
  [COLLECTIONS.volSurfaces]: volSurfaceDocSchema,
  [COLLECTIONS.pricingParams]: pricingParamsDocSchema,
};

function describe(step: Step): string {
  switch (step.kind) {
    case "delete":
      return `delete ${step.ids.length} from ${step.db}.${step.collection}: ${step.ids.map((id, i) => `${String(id)} (${step.reasons[i]})`).join(", ")}`;
    case "unset":
      return `remove the legacy fields ${LEGACY_FIELDS.join(" and ")} from ${step.count} documents in ${step.db}.${step.collection}`;
    case "drop-collection":
      return `drop ${step.db}.${step.collection}, ${step.count} documents: not part of the design`;
    case "drop-database":
      return `drop the test database ${step.db}, ${step.count} documents: left over from local test runs`;
  }
}

async function backupCollection(db: Db, collection: string, dir: string): Promise<number> {
  const docs = await db.collection(collection).find({}).toArray();
  const file = path.join(dir, `${db.databaseName}.${collection}.json`);
  fs.writeFileSync(file, BSON.EJSON.stringify(docs, undefined, 2, { relaxed: false }));
  const back = BSON.EJSON.parse(fs.readFileSync(file, "utf8")) as Document[];
  if (back.length !== docs.length) throw new Error(`Backup of ${collection} is incomplete; nothing was changed.`);
  return docs.length;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { client, db } = await connectForScript();
  const lines: string[] = [];
  const say = (line: string) => {
    lines.push(line);
    console.log(line);
  };
  try {
    const report = await inspectDatabase(client, db, istTodayYmd().slice(0, 7));
    const steps: Step[] = [];
    for (const c of report.collections) {
      if (!c.kept) {
        steps.push({ kind: "drop-collection", db: db.databaseName, collection: c.name, count: c.count });
        continue;
      }
      if (c.junk.length) steps.push({ kind: "delete", db: db.databaseName, collection: c.name, ids: c.junk.map((j) => j.id), reasons: c.junk.map((j) => j.reason) });
      if (c.legacyFieldDocs) steps.push({ kind: "unset", db: db.databaseName, collection: c.name, count: c.legacyFieldDocs });
    }
    for (const t of report.testDatabases) {
      steps.push({ kind: "drop-database", db: t.name, count: t.collections.reduce((s, c) => s + c.count, 0) });
    }

    say(`${apply ? "Applying" : "Dry run"} on ${db.databaseName}, ${new Date().toISOString()}`);
    if (!steps.length) say("Nothing to change.");
    for (const step of steps) say(`- ${describe(step)}`);

    // Documents that stay must match the schema, or the validators would block their next update.
    for (const c of report.collections.filter((x) => x.kept)) {
      const junk = new Set(c.junk.map((j) => String(j.id)));
      const docs = await db.collection(c.name).find({}).toArray();
      for (const d of docs.filter((x) => !junk.has(String(x._id)))) {
        const { _id, ...rest } = d;
        for (const f of LEGACY_FIELDS) delete (rest as Record<string, unknown>)[f];
        const checked = SCHEMAS[c.name]!.safeParse(rest);
        say(`- keep ${db.databaseName}.${c.name} ${String(_id)}, month ${String(d.monthKey)}: ${checked.success ? "matches the schema" : `does not match: ${checked.error!.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`}`);
      }
    }

    if (apply && steps.length) {
      const dir = path.join("backups", istTodayYmd());
      fs.mkdirSync(dir, { recursive: true });
      const affected = new Map<string, Set<string>>();
      for (const s of steps) {
        if (s.kind === "drop-database") {
          const cols = await client.db(s.db).listCollections({}, { nameOnly: true }).toArray();
          affected.set(s.db, new Set(cols.map((c) => c.name)));
        } else {
          affected.set(s.db, (affected.get(s.db) ?? new Set()).add(s.collection));
        }
      }
      for (const [name, cols] of affected) {
        for (const col of cols) say(`- backed up ${name}.${col}: ${await backupCollection(client.db(name), col, dir)} documents to ${dir}`);
      }
      for (const s of steps) {
        const target = client.db(s.db);
        if (s.kind === "delete") await target.collection(s.collection).deleteMany({ _id: { $in: s.ids as never[] } });
        if (s.kind === "unset") await target.collection(s.collection).updateMany({}, { $unset: Object.fromEntries(LEGACY_FIELDS.map((f) => [f, ""])) });
        if (s.kind === "drop-collection") await target.collection(s.collection).drop();
        if (s.kind === "drop-database") await target.dropDatabase();
      }
      say("Done.");
    }

    const counts = await Promise.all(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(async (c) => `${c.name} ${await db.collection(c.name).countDocuments()}`),
    );
    say(`Counts ${apply ? "after" : "now"}: ${counts.sort().join(", ") || "no collections"}`);
    writeReportSection(apply ? "cleanup-apply" : "cleanup-dry-run", [`## Cleanup ${apply ? "Applied" : "Dry Run"}`, "", "```text", ...lines, "```"].join("\n"));
  } finally {
    await client.close();
  }
}

main().catch(failSafely);
