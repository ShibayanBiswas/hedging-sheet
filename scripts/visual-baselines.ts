/**
 * Rewrites the 24 Linux visual baselines with Docker, in the same Playwright image the CI visual job runs in,
 * so baselines made on any machine match CI.
 *
 *   npm run test:visual:linux
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "e2e", "visual", "__screenshots__", "chromium", "linux");
const image = "mcr.microsoft.com/playwright:v1.63.0-noble";

const run = spawnSync(
  "docker",
  ["run", "--rm", "--ipc=host", "-v", `${root}:/src:ro`, "-v", `${out}:/out`, image, "bash", "/src/scripts/visual-baselines.sh"],
  { stdio: "inherit" },
);
process.exit(run.status ?? 1);
