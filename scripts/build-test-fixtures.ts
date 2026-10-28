/**
 * Writes the deterministic test fixtures: the surface and surface parameters the mock database is seeded with,
 * and the default inputs at the mock clock. Run once; the files are reviewed and committed.
 *
 *   npx tsx scripts/build-test-fixtures.ts
 */
import fs from "node:fs";
import path from "node:path";

import { defaultInputs, seedMarketData } from "../lib/engine/defaults";
import { MOCK_NOW_ISO, MOCK_SPOTS } from "../lib/test/mocks/yahoo";

async function main() {
  process.env.TEST_MODE = "mock";
  process.env.TEST_NOW = MOCK_NOW_ISO;
  const { fetchDailyVolatility } = await import("../lib/market-data");
  const dir = path.join(process.cwd(), "tests", "fixtures");
  fs.mkdirSync(dir, { recursive: true });
  const write = (name: string, data: unknown) => {
    fs.writeFileSync(path.join(dir, name), `${JSON.stringify(data, null, 2)}\n`);
    console.log("Wrote", `tests/fixtures/${name}`);
  };

  const market = seedMarketData();
  write("surface.json", {
    ...market.surface,
    monthKey: "2026-10",
    label: "October 2026 Volatility Surface",
    referenceSensexPrice: MOCK_SPOTS["^BSESN"],
  });
  write("pricing-params.json", { ...market.params, monthKey: "2026-10" });

  const vol = await fetchDailyVolatility("Sensex", 365, new Date(MOCK_NOW_ISO));
  write("default-inputs.json", {
    note: "Default Values mode at the mock clock, 28-Oct-2026 10:00 IST, with the mock Sensex close and mock volatility.",
    inputs: defaultInputs({ valuationDate: "2026-10-28", spot: MOCK_SPOTS["^BSESN"], dailyVol: vol.dailyVol ?? undefined }),
    dailyVolObservations: vol.observations,
  });
}

void main();
