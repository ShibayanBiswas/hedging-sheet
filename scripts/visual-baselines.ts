/**
 * The 24 Linux visual baselines, made with Docker in the same Playwright image CI runs in, so they match CI from any machine.
 *
 *   npm run test:visual:linux              # rewrites the baselines
 *   npm run test:visual:linux -- compare   # checks the committed ones; differences land in test-results/visual-compare
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const compare = process.argv[2] === "compare";
const out = compare ? path.join(root, "test-results", "visual-compare") : path.join(root, "e2e", "visual", "__screenshots__", "chromium", "linux");
fs.mkdirSync(out, { recursive: true });
const image = "mcr.microsoft.com/playwright:v1.63.0-noble";

const run = spawnSync(
  "docker",
  ["run", "--rm", "--ipc=host", "-v", `${root}:/src:ro`, "-v", `${out}:/out`, image, "bash", "/src/scripts/visual-baselines.sh", compare ? "compare" : "update"],
  { stdio: "inherit" },
);
process.exit(run.status ?? 1);
