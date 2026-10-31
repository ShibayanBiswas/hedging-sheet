import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Fragments that appear only on browsers Playwright installed, never on a person's own Chrome. */
const PLAYWRIGHT_BROWSER = /ms-playwright|chrome-headless-shell/;

/**
 * Workers close the browsers they launch. A crashed worker can leave Chromium, Firefox or WebKit
 * running after the report is written. This stops only those leftover Playwright browsers, and only
 * on a local machine: CI runners are discarded, and killing them can race the artifact upload.
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.CI) return;
  try {
    if (process.platform === "win32") {
      const script = [
        "Get-CimInstance Win32_Process |",
        "Where-Object { $_.CommandLine -match 'ms-playwright' } |",
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ].join(" ");
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
