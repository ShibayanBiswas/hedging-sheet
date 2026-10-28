/** Seeds the built in vol surface and surface parameters into the desk database. */
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
  const surfaceOk = await persistActiveSurface(surface, "built-in-seed");
  const paramsOk = await persistActiveParams(seedPricingParams(), "built-in-seed");
  console.log(`Vol surface ${surface.monthKey}: ${surfaceOk ? "saved" : "not saved, database unavailable"}`);
  console.log(`Surface parameters: ${paramsOk ? "saved" : "not saved, database unavailable"}`);
  await closeDb();
  if (!surfaceOk || !paramsOk) process.exit(1);
}

void main();
