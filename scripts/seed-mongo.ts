/** Seeds the built in vol surface and surface parameters into the desk database, in one transaction. */
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const [{ deskMonthKey, saveReferenceData }, { seedPricingParams }, { SEED_SURFACE }, { closeDb }] = await Promise.all([
    import("../lib/data/load"),
    import("../lib/engine/defaults"),
    import("../lib/engine/vol-surface"),
    import("../lib/db/client"),
  ]);
  const saved = await saveReferenceData({ surface: SEED_SURFACE, params: { values: seedPricingParams(), monthKey: deskMonthKey() } }, "built-in seed");
  console.log(saved ? `Vol surface ${SEED_SURFACE.monthKey} and surface parameters saved` : "Not saved: the database is unavailable");
  await closeDb();
  if (!saved) process.exit(1);
}

void main();
