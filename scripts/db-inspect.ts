/** Read-only inspection shared by the audit and the cleanup. Nothing here writes. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Db, Document, MongoClient } from "mongodb";

import { COLLECTIONS, RETENTION_MONTHS } from "../lib/db/collections";
import { PRODUCTION_DB } from "../lib/db/config";
import { maskSample } from "./db-report";

const KEPT = new Set<string>(Object.values(COLLECTIONS));
const TEST_MARK = /\b(test|tests|debug|fixture|e2e|mock|dummy|sample|parity|scratch)\b/i;
/** Fields that are bookkeeping from older versions; the reference documents no longer carry them. */
export const LEGACY_FIELDS = ["isActive", "key"] as const;

type Junk = { id: unknown; reason: string };

type CollectionReport = {
  name: string;
  kept: boolean;
  count: number;
  sizeBytes: number;
  storageBytes: number;
  indexes: Array<{ name: string; key: string; sizeBytes: number }>;
  sample: unknown;
  fields: Array<{ path: string; present: number; types: string[] }>;
  variations: string[];
  codeRefs: string[];
  junk: Junk[];
  legacyFieldDocs: number;
};

export type DatabaseReport = {
  dbName: string;
  at: string;
  collections: CollectionReport[];
  testDatabases: Array<{ name: string; collections: Array<{ name: string; count: number }> }>;
  otherDatabases: number;
};

function bsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (v instanceof Date) return "date";
  if (typeof v === "object" && (v as { _bsontype?: string })._bsontype) return (v as { _bsontype: string })._bsontype.toLowerCase();
  return typeof v;
}

/** Top-level fields with how many documents carry them and the types seen. */
function fieldStats(docs: Document[]) {
  const map = new Map<string, { present: number; types: Set<string> }>();
  for (const doc of docs) {
    for (const [k, v] of Object.entries(doc)) {
      const entry = map.get(k) ?? { present: 0, types: new Set<string>() };
      entry.present += 1;
      entry.types.add(bsonType(v));
      map.set(k, entry);
    }
  }
  return [...map.entries()].map(([p, e]) => ({ path: p, present: e.present, types: [...e.types].sort() })).sort((a, b) => a.path.localeCompare(b.path));
}

/** Runtime code that names the collection: the app, its library and its components. */
function codeReferences(name: string): string[] {
  const roots = ["app", "lib", "components"];
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(full, "utf8").includes(`"${name}"`)) hits.push(full.replace(/\\/g, "/"));
    }
  };
  for (const r of roots) if (fs.existsSync(r)) walk(r);
  return hits;
}

function contentHash(doc: Document): string {
  const { _id, at, updatedAt, ...rest } = doc;
  void _id;
  void at;
  void updatedAt;
  return crypto.createHash("sha1").update(JSON.stringify(rest)).digest("hex");
}

function monthsBefore(monthKey: string, months: number): string {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 - months, 1));
  return d.toISOString().slice(0, 7);
}

/** Documents in a kept collection that should not be there, newest first wins on duplicates. */
function junkInKept(name: string, docs: Document[], surfaceMonths: Set<string>, todayMonth: string): Junk[] {
  const out: Junk[] = [];
  const cutoff = monthsBefore(todayMonth, RETENTION_MONTHS);
  const byMonth = new Map<string, Document[]>();
  for (const doc of docs) {
    const mk = typeof doc.monthKey === "string" ? doc.monthKey.trim() : "";
    const source = [doc.source, doc.label, doc.filename].filter((s) => typeof s === "string").join(" ");
    if (!mk || !/^\d{4}-\d{2}$/.test(mk)) out.push({ id: doc._id, reason: "monthKey is missing or empty" });
    else if (TEST_MARK.test(source)) out.push({ id: doc._id, reason: `test or debug document, source "${source}"` });
    else {
      const list = byMonth.get(mk) ?? [];
      list.push(doc);
      byMonth.set(mk, list);
    }
  }
  const months = [...byMonth.keys()].sort();
  const latestCurrent = months.filter((m) => m <= todayMonth).at(-1);
  for (const [mk, list] of byMonth) {
    const sorted = [...list].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    for (const dup of sorted.slice(1)) out.push({ id: dup._id, reason: `duplicate of month ${mk}, an older copy` });
    if (mk < cutoff && mk !== latestCurrent) out.push({ id: sorted[0]!._id, reason: `older than the ${RETENTION_MONTHS} month retention` });
    if (name === COLLECTIONS.pricingParams && ![...surfaceMonths].some((s) => s <= mk) && surfaceMonths.size) {
      out.push({ id: sorted[0]!._id, reason: `orphan: no surface on or before ${mk}` });
    }
  }
  return out;
}

export async function inspectDatabase(client: MongoClient, db: Db, todayMonth: string): Promise<DatabaseReport> {
  const infos = (await db.listCollections({}, { nameOnly: false }).toArray()).filter((c) => c.type !== "view" && !c.name.startsWith("system."));
  const all = new Map<string, Document[]>();
  for (const info of infos) all.set(info.name, await db.collection(info.name).find({}).toArray());
  const surfaceMonths = new Set((all.get(COLLECTIONS.volSurfaces) ?? []).map((d) => String(d.monthKey ?? "")).filter(Boolean));

  const collections: CollectionReport[] = [];
  for (const info of infos.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = info.name;
    const docs = all.get(name)!;
    const stats = (await db.command({ collStats: name })) as { size?: number; storageSize?: number; indexSizes?: Record<string, number> };
    const indexes = (await db.collection(name).indexes()).map((ix) => ({
      name: String(ix.name),
      key: JSON.stringify(ix.key),
      sizeBytes: stats.indexSizes?.[String(ix.name)] ?? 0,
    }));
    const fields = fieldStats(docs);
    const variations = [
      ...fields.filter((f) => f.present < docs.length).map((f) => `${f.path} is in ${f.present} of ${docs.length} documents`),
      ...fields.filter((f) => f.types.length > 1).map((f) => `${f.path} has mixed types: ${f.types.join(", ")}`),
    ];
    const kept = KEPT.has(name);
    let junk: Junk[];
    if (kept) junk = junkInKept(name, docs, surfaceMonths, todayMonth);
    else {
      const seen = new Map<string, unknown>();
      junk = docs.map((d) => {
        const h = contentHash(d);
        const dupOf = seen.get(h);
        seen.set(h, d._id);
        return { id: d._id, reason: dupOf ? "duplicate document" : "collection is not part of the design" };
      });
    }
    collections.push({
      name,
      kept,
      count: docs.length,
      sizeBytes: stats.size ?? 0,
      storageBytes: stats.storageSize ?? 0,
      indexes,
      sample: docs[0] ? maskSample(docs[0]) : null,
      fields,
      variations,
      codeRefs: codeReferences(name),
      junk,
      legacyFieldDocs: kept ? docs.filter((d) => LEGACY_FIELDS.some((f) => f in d)).length : 0,
    });
  }

  // Leftover databases from local test runs against the live cluster. Other projects' databases are only counted.
  const testDatabases: DatabaseReport["testDatabases"] = [];
  let otherDatabases = 0;
  try {
    const list = await client.db().admin().listDatabases({ nameOnly: true });
    for (const d of list.databases) {
      if (d.name === db.databaseName || ["admin", "local", "config"].includes(d.name)) continue;
      if (/^hedging_sheet_(test|e2e|dev|development|local)\b/.test(d.name)) {
        const other = client.db(d.name);
        const cols = await other.listCollections({}, { nameOnly: true }).toArray();
        testDatabases.push({
          name: d.name,
          collections: await Promise.all(cols.map(async (c) => ({ name: c.name, count: await other.collection(c.name).countDocuments() }))),
        });
      } else if (!d.name.startsWith(PRODUCTION_DB)) otherDatabases += 1;
    }
  } catch {
    // The user may not be allowed to list databases.
  }

  return { dbName: db.databaseName, at: new Date().toISOString(), collections, testDatabases, otherDatabases };
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

export function renderReport(r: DatabaseReport, title: string): string {
  const lines: string[] = [`## ${title}`, "", `Database \`${r.dbName}\`, inspected ${r.at}.`, ""];
  lines.push("| Collection | Documents | Data | Storage | Indexes | Used By Code | Junk |", "|---|---|---|---|---|---|---|");
  for (const c of r.collections) {
    lines.push(
      `| \`${c.name}\` | ${c.count} | ${kb(c.sizeBytes)} | ${kb(c.storageBytes)} | ${c.indexes.length} | ${c.codeRefs.length ? "Yes" : "No"} | ${c.junk.length} |`,
    );
  }
  if (!r.collections.length) lines.push("| - | - | - | - | - | - | - |");
  for (const c of r.collections) {
    lines.push("", `### \`${c.name}\``, "");
    lines.push(`- **Design:** ${c.kept ? "kept reference data" : "not part of the design"}.`);
    lines.push(`- **Code:** ${c.codeRefs.length ? c.codeRefs.map((f) => `\`${f}\``).join(", ") : "no runtime code reads or writes it"}.`);
    lines.push(`- **Indexes:** ${c.indexes.map((i) => `\`${i.name}\` on ${i.key}, ${kb(i.sizeBytes)}`).join("; ") || "-"}.`);
    lines.push(`- **Schema variations:** ${c.variations.length ? c.variations.join("; ") : "none"}.`);
    if (c.legacyFieldDocs) lines.push(`- **Legacy fields:** ${c.legacyFieldDocs} documents still carry ${LEGACY_FIELDS.join(" or ")}.`);
    lines.push(`- **Findings:** ${c.junk.length ? c.junk.map((j) => `\`${String(j.id)}\` ${j.reason}`).join("; ") : "no duplicates, orphans, test documents, empty keys or expired months"}.`);
    lines.push("", "Sample document, masked and shortened:", "", "```json", JSON.stringify(c.sample, null, 2), "```");
  }
  lines.push("", "### Other Databases On The Cluster", "");
  if (r.testDatabases.length) {
    for (const t of r.testDatabases) {
      lines.push(`- \`${t.name}\`: left over from local test runs; ${t.collections.map((c) => `\`${c.name}\` ${c.count}`).join(", ") || "empty"}.`);
    }
  } else lines.push("- No leftover test databases from this app.");
  lines.push(`- ${r.otherDatabases} databases belong to other projects and are not touched.`);
  return lines.join("\n");
}
