/**
 * First load JavaScript of every page, gzipped, against the 250 KB limit. Run it after npm run build.
 *
 *   npm run bundle:report    # one line per page, exits 1 over the limit
 *   npm run analyze          # next analyze: the module treemap, for finding what to split
 *
 * Next's own build lists each page's first load chunks in .next/diagnostics/route-bundle-stats.json; this gzips those files.
 * @next/bundle-analyzer is a Webpack plugin and reports nothing under Turbopack, which is what this repo builds with.
 */
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const LIMIT_BYTES = 250 * 1024;
const STATS = path.join(".next", "diagnostics", "route-bundle-stats.json");

type RouteStats = { route: string; firstLoadUncompressedJsBytes: number; firstLoadChunkPaths: string[] };

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function main() {
  if (!fs.existsSync(STATS)) {
    console.error(`${STATS} is missing. Run npm run build first.`);
    process.exit(1);
  }
  const routes = (JSON.parse(fs.readFileSync(STATS, "utf8")) as RouteStats[]).filter((r) => !r.route.startsWith("/api/") && !r.route.startsWith("/_"));
  const gzipped = new Map<string, number>();
  const size = (file: string) => {
    if (!gzipped.has(file)) gzipped.set(file, gzipSync(fs.readFileSync(file), { level: 9 }).length);
    return gzipped.get(file)!;
  };
  const rows = routes.map((r) => {
    const total = r.firstLoadChunkPaths.filter((f) => f.endsWith(".js")).reduce((sum, f) => sum + size(f), 0);
    return { route: r.route, total, raw: r.firstLoadUncompressedJsBytes, chunks: r.firstLoadChunkPaths.length };
  });
  for (const row of rows) console.log(`${row.route.padEnd(14)} ${kb(row.total).padStart(9)} gzipped   ${kb(row.raw).padStart(9)} raw   ${row.chunks} files`);
  const largest = Math.max(...rows.map((r) => r.total));
  console.log(`Largest ${kb(largest)} of ${kb(LIMIT_BYTES)}`);
  if (largest > LIMIT_BYTES) process.exit(1);
}

main();
