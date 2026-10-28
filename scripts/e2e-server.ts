/**
 * Deterministic server for the Playwright suite.
 *
 * Starts an in-memory Mongo seeded from tests/fixtures, then runs Next with TEST_MODE=mock so Yahoo
 * answers from lib/test/mocks/yahoo.ts and the server clock is frozen at TEST_NOW.
 *
 *   npx tsx scripts/e2e-server.ts              # next dev on E2E_PORT (3006)
 *   E2E_PROD=1 npx tsx scripts/e2e-server.ts   # next start, after npm run build
 *
 * Never touches the live database: MONGODB_URI is replaced by the in-memory server.
 */
import { spawn } from "node:child_process";

import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import { MOCK_NOW_ISO } from "../lib/test/mocks/yahoo";
import pricingParams from "../tests/fixtures/pricing-params.json";
import surface from "../tests/fixtures/surface.json";

const PORT = process.env.E2E_PORT ?? "3006";
const DB = "hedging_sheet_e2e";

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB);
  await db.collection("vol_surfaces").insertOne({ ...surface, isActive: true, source: "fixture" });
  await db.collection("pricing_params").insertOne({ ...pricingParams, key: "month:2026-10", isActive: true, source: "fixture" });
  await client.close();
  console.log(`e2e: in-memory Mongo seeded (${DB})`);

  const args = process.env.E2E_PROD === "1" ? ["next", "start", "--port", PORT] : ["next", "dev", "--port", PORT];
  const child = spawn("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      MONGODB_URI: uri,
      MONGODB_DB: DB,
      TEST_MODE: "mock",
      TEST_NOW: process.env.TEST_NOW ?? MOCK_NOW_ISO,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  const stop = async (code = 0) => {
    child.kill();
    await mongod.stop();
    process.exit(code);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  child.on("exit", (code) => void stop(code ?? 0));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
