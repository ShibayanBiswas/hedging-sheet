/**
 * Read-only inventory of the desk database. Writes a section of docs/db-audit-report.md.
 * Usage: npx tsx scripts/db-audit.ts [--label before|after]
 */
import { istTodayYmd } from "../lib/engine/dates";
import { connectForScript, failSafely } from "./db-connect";
import { writeReportSection } from "./db-report";
import { inspectDatabase, renderReport } from "./db-inspect";

async function main() {
  const label = process.argv.includes("--label") ? process.argv[process.argv.indexOf("--label") + 1]! : "before";
  const { client, db } = await connectForScript();
  try {
    const report = await inspectDatabase(client, db, istTodayYmd().slice(0, 7));
    const title = label === "after" ? "Inventory After Cleanup" : "Inventory Before Cleanup";
    writeReportSection(`audit-${label}`, renderReport(report, title));
    for (const c of report.collections) {
      console.log(`${c.name.padEnd(18)} ${String(c.count).padStart(5)} docs  ${c.indexes.length} indexes  junk ${c.junk.length}  ${c.kept ? "kept" : "not in design"}`);
    }
    for (const t of report.testDatabases) console.log(`test database ${t.name}: ${t.collections.map((c) => `${c.name} ${c.count}`).join(", ") || "empty"}`);
    console.log(`Report section audit-${label} written to docs/db-audit-report.md`);
  } finally {
    await client.close();
  }
}

main().catch(failSafely);
