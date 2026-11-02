/**
 * One command per environment, each writing to reports/<timestamp>/ with summary.md.
 *
 *   npm run test:all                       # static checks, then everything test:local runs
 *   npm run test:local                     # production build on port 3000 against a seeded in-memory Mongo, Chromium only
 *   npm run test:local:full                # the same with Firefox, WebKit, mobile and Lighthouse; CI always runs this
 *   npm run test:vercel -- --url <url>     # read-only checks against a deployment
 *
 * The in-memory Mongo is seeded when the server starts and is gone when it stops, so nothing is left behind.
 * test:vercel sends x-vercel-protection-bypass from VERCEL_AUTOMATION_BYPASS_SECRET, read from the environment or
 * .env.local and never printed. It never writes: the deployment's own database is only read.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Mode = "all" | "local" | "vercel";
type Step = { name: string; command: string; env?: Record<string, string>; report?: string };
type Outcome = Step & { ok: boolean; seconds: number };

const mode = process.argv[2] as Mode;
if (!["all", "local", "vercel"].includes(mode)) {
  console.error("Usage: tsx scripts/test-run.ts all | local | vercel --url <url>");
  process.exit(2);
}

const stamp = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})
  .format(new Date())
  .replace(", ", "_")
  .replace(/:/g, "-");
const dir = path.join("reports", `${mode}-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
const rel = (p: string) => path.relative(dir, p).replace(/\\/g, "/");

function urlArg(): string {
  const i = process.argv.indexOf("--url");
  const url = i > 0 ? process.argv[i + 1] : process.env.BASE_URL;
  if (!url || !/^https?:\/\//.test(url)) {
    console.error("test:vercel needs --url https://<deployment>");
    process.exit(2);
  }
  return url.replace(/\/$/, "");
}

/** The bypass secret from the environment or .env.local, without echoing it. */
function bypassSecret(): string | undefined {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!fs.existsSync(".env.local")) return undefined;
  const line = fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("VERCEL_AUTOMATION_BYPASS_SECRET="));
  return line?.slice("VERCEL_AUTOMATION_BYPASS_SECRET=".length).trim().replace(/^["']|["']$/g, "") || undefined;
}

const LOCAL_PORT = "3000";
const local = { E2E_PROD: "1", E2E_PORT: LOCAL_PORT, REPORT_DIR: dir };

const STATIC: Step[] = [
  { name: "Type Check", command: "npx tsc --noEmit" },
  { name: "Lint", command: "npx eslint . --max-warnings 0" },
  // Knip's parser otherwise reserves one large buffer up front, which fails on a laptop short of memory.
  { name: "Unused Code", command: "npx knip --no-progress", env: { KNIP_DISABLE_RAW_TRANSFER: "1" } },
  { name: "Copy Rules", command: "npx vitest run tests/copy tests/unit/copy-rules.test.ts tests/unit/title-case.test.ts" },
  { name: "Workbook Mapping", command: "npx tsx scripts/extract-mapping.ts" },
  { name: "Workbook Audit", command: "npx tsx scripts/audit-workbook.ts" },
];

/** The laptop runs the light suite; every browser, width and Lighthouse run in CI or with --full. */
const full = Boolean(process.env.CI) || process.argv.includes("--full");

const LOCAL: Step[] = [
  { name: "Production Build With The Test Hook", command: "npx next build", env: { NEXT_PUBLIC_E2E: "1" } },
  {
    name: "Unit, Golden, Property, Edge And Integration With Coverage",
    command: `npx vitest run --coverage --coverage.reportsDirectory=${dir}/coverage --reporter=default --reporter=junit --outputFile.junit=${dir}/junit-vitest.xml`,
    report: `${dir}/coverage/index.html`,
  },
  {
    name: full ? "Playwright On Chromium, Firefox, WebKit And Mobile" : "Playwright On Chromium",
    command: "npx playwright test",
    env: full ? { ...local, PW_FULL: "1", E2E_FULL_WIDTHS: "1" } : local,
    report: `${dir}/playwright-html/index.html`,
  },
  ...(full
    ? [
        {
          name: "Lighthouse Desktop",
          command: `npx lhci autorun --collect.url=http://localhost:${LOCAL_PORT}/ --collect.url=http://localhost:${LOCAL_PORT}/pricer --upload.outputDir=${dir}/lighthouse`,
          env: { E2E_PROD: "1", E2E_PORT: LOCAL_PORT },
          report: `${dir}/lighthouse`,
        },
        {
          name: "Lighthouse Mobile",
          command: `npx lhci autorun --config=lighthouserc.mobile.json --collect.url=http://localhost:${LOCAL_PORT}/ --collect.url=http://localhost:${LOCAL_PORT}/pricer --upload.outputDir=${dir}/lighthouse-mobile`,
          env: { E2E_PROD: "1", E2E_PORT: LOCAL_PORT },
          report: `${dir}/lighthouse-mobile`,
        },
      ]
    : []),
];

function vercelSteps(url: string): Step[] {
  const secret = bypassSecret();
  const env: Record<string, string> = { BASE_URL: url, REPORT_DIR: dir, E2E_FULL_WIDTHS: "1", ...(secret ? { VERCEL_AUTOMATION_BYPASS_SECRET: secret } : {}) };
  return [
    { name: "Pages And APIs Answer", command: "npx tsx scripts/e2e-local.ts", env },
    { name: "Playwright Read Only On Chromium, Firefox And WebKit", command: "npx playwright test", env, report: `${dir}/playwright-html/index.html` },
  ];
}

const steps: Step[] = mode === "vercel" ? vercelSteps(urlArg()) : mode === "all" ? [...STATIC, ...LOCAL] : LOCAL;

/** Nothing may be listening on the local port before the run starts its own server. */
function freeLocalPort() {
  if (mode === "vercel") return;
  if (process.platform === "win32") {
    spawnSync("powershell", ["-NoProfile", "-Command", `Get-NetTCPConnection -LocalPort ${LOCAL_PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`], { stdio: "ignore" });
  } else {
    spawnSync("sh", ["-c", `lsof -ti tcp:${LOCAL_PORT} | xargs -r kill -9`], { stdio: "ignore" });
  }
}

const outcomes: Outcome[] = [];
for (const step of steps) {
  freeLocalPort();
  console.log(`\n=== ${step.name}\n`);
  const started = Date.now();
  const r = spawnSync(step.command, { shell: true, stdio: "inherit", env: { ...process.env, ...step.env } });
  outcomes.push({ ...step, ok: r.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}
freeLocalPort();

const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim();
const failed = outcomes.filter((o) => !o.ok);
const lines = [
  `# Test Run · ${mode === "all" ? "All" : mode === "local" ? "Local" : "Vercel"}`,
  "",
  `- **Started:** ${stamp.replace("_", " ").replace(/-(\d\d)-(\d\d)$/, ":$1:$2")} IST`,
  `- **Tests From Commit:** ${sha}`,
  ...(mode === "vercel" ? [`- **Deployment:** ${urlArg()}`, `- **Bypass Header:** ${bypassSecret() ? "Sent" : "Not Set"}`] : [`- **Server:** production build on port ${LOCAL_PORT} with a seeded in-memory Mongo, gone when the run ends`]),
  `- **Result:** ${failed.length ? `${failed.length} of ${outcomes.length} steps failed` : `all ${outcomes.length} steps passed`}`,
  "",
  "| Step | Result | Seconds | Report |",
  "|---|---|---|---|",
  ...outcomes.map((o) => `| ${o.name} | ${o.ok ? "Pass" : "Fail"} | ${o.seconds} | ${o.report && fs.existsSync(o.report) ? `[Open](${rel(o.report)})` : "-"} |`),
  "",
  "JUnit files and traces for failed tests are in this folder.",
  "",
];
fs.writeFileSync(path.join(dir, "summary.md"), lines.join("\n"));
console.log(`\n${lines.join("\n")}\nReports: ${dir}`);
process.exit(failed.length ? 1 : 0);
