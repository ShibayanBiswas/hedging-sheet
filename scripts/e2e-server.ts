/**
 * Deterministic server for the Playwright suite.
 *
 * Starts an in-memory Mongo replica set with the production validators and indexes, seeded from tests/fixtures,
 * then runs Next with TEST_MODE=mock so Yahoo answers from lib/test/mocks/yahoo.ts and the server clock is frozen at TEST_NOW.
 *
 *   npx tsx scripts/e2e-server.ts              # next dev on E2E_PORT (3006)
 *   E2E_PROD=1 npx tsx scripts/e2e-server.ts   # next start, after npm run build
 *
 * Never touches the live database: MONGODB_URI is replaced by the in-memory server.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { MOCK_NOW_ISO } from "../lib/test/mocks/yahoo";
import { E2E_DESK_KEY } from "../e2e/support/desk-key";
import { startTestDatabase } from "../tests/helpers/test-database";

const PORT = process.env.E2E_PORT ?? "3006";
const DB = "hedging_sheet_e2e";

async function main() {
  // next start keeps cached reads on disk, and an expired tag does not survive a restart. This database is new, so anything cached
  // came from an older one: a surface parameter a test saved would otherwise price the next run.
  fs.rmSync(path.join(process.cwd(), ".next", "cache", "fetch-cache"), { recursive: true, force: true });

  const database = await startTestDatabase(DB);
  console.log(`e2e: in-memory Mongo replica set seeded (${DB})`);

  const args = process.env.E2E_PROD === "1" ? ["next", "start", "--port", PORT] : ["next", "dev", "--port", PORT];
  const child = spawn("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      MONGODB_URI: database.uri,
      MONGODB_DB: DB,
      TEST_MODE: "mock",
      TEST_NOW: process.env.TEST_NOW ?? MOCK_NOW_ISO,
      DESK_WRITE_KEY: E2E_DESK_KEY,
      DESK_WRITE_LIMIT: "100000",
      NEXT_PUBLIC_E2E: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  const stop = async (code = 0) => {
    child.kill();
    await database.stop();
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
