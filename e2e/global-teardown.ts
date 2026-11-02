import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Fragments that appear only on browsers Playwright installed, never on a person's own Chrome. */
const PLAYWRIGHT_BROWSER = /ms-playwright|chrome-headless-shell/;

/**
 * Playwright closes its browsers and the server it started; this also ends any browser a crashed worker left behind,
 * and only on a local machine: CI runners are discarded, and killing them can race the artifact upload.
 * The e2e server stops its own in-memory database, and npm run clean:dev catches anything else.
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.CI) return;
  try {
    if (process.platform === "win32") {
      // By executable path, not command line: this script's own command line holds the words it looks for.
      const script =
        "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome-headless-shell.exe' -or ([string]$_.ExecutablePath -match 'ms-playwright') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
      await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], { windowsHide: true });
      return;
    }
    const { stdout } = await execFileAsync("ps", ["-eo", "pid=,args="]);
    for (const line of stdout.split("\n")) {
      if (!PLAYWRIGHT_BROWSER.test(line)) continue;
      const pid = Number(line.trim().split(/\s+/, 1)[0]);
      if (!Number.isFinite(pid) || pid <= 1 || pid === process.pid) continue;
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  } catch {
    // ps or powershell unavailable; the run itself already finished
  }
}
