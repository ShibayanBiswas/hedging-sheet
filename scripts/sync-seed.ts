/** Seeds the workbook vol surface and pricing parameters into the desk database. */
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const [{ persistActiveParams, persistActiveSurface }, { seedPricingParams }, { normalizeVolSurface, SEED_SURFACE }, { closeDb }] =
    await Promise.all([
      import("../lib/data/load"),
      import("../lib/engine/defaults"),
      import("../lib/engine/vol-surface"),
      import("../lib/db/mongo"),
    ]);
  const surface = normalizeVolSurface(SEED_SURFACE);
  const surfaceOk = await persistActiveSurface(surface, "workbook-seed");
  const paramsOk = await persistActiveParams(seedPricingParams(), "workbook-seed");
  console.log(`Vol surface ${surface.monthKey}: ${surfaceOk ? "saved" : "not saved, database unavailable"}`);
  console.log(`Pricing params: ${paramsOk ? "saved" : "not saved, database unavailable"}`);
  await closeDb();
  if (!surfaceOk || !paramsOk) process.exit(1);
}

void main();
