/**
 * Clears caches so the next request rebuilds from source.
 *
 *   npx tsx scripts/clear-caches.ts --local                  # .next, node_modules/.cache, reports and coverage; then run npm ci and npm run build
 *   npx tsx scripts/clear-caches.ts --app https://host       # expires the surface and history tags on a running deployment; needs DESK_WRITE_KEY
 *   npx tsx scripts/clear-caches.ts --vercel                 # purges the Vercel CDN and data cache of the linked project
 *
 * A production build without the build cache: set VERCEL_FORCE_NO_BUILD_CACHE=1 on the project, redeploy, then remove it.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { DESK_KEY_HEADER } from "../lib/desk-key";
import { loadEnv } from "./load-env";

loadEnv();

const LOCAL = [".next", "node_modules/.cache", "playwright-report", "test-results", "coverage", ".lighthouseci"];

function clearLocal() {
  for (const dir of LOCAL) {
    if (!fs.existsSync(dir)) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`removed ${dir}`);
  }
  console.log("Now run npm ci and npm run build for a clean install and build.");
}

async function clearApp(base: string) {
  const key = process.env.DESK_WRITE_KEY?.trim();
  if (!key) throw new Error("Set DESK_WRITE_KEY in .env.local to expire the app caches.");
  const res = await fetch(new URL("/api/admin/revalidate", base), { method: "POST", headers: { [DESK_KEY_HEADER]: key } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body.error ?? "revalidate failed"}`);
  console.log(`expired ${body.expired.join(", ")} on ${base}`);
}

function clearVercel() {
  const run = spawnSync("npx", ["vercel", "cache", "purge", "--type", "all", "--yes"], { stdio: "inherit", shell: process.platform === "win32" });
  if (run.status !== 0) throw new Error("vercel cache purge failed; run vercel login and vercel link first.");
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log("Choose --local, --app <url> or --vercel.");
    process.exit(1);
  }
  if (args.includes("--local")) clearLocal();
  if (args.includes("--vercel")) clearVercel();
  const at = args.indexOf("--app");
  if (at >= 0) await clearApp(args[at + 1] ?? "https://hedging-sheet.vercel.app");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
