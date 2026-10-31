import { spawnSync } from "node:child_process";

/**
 * Playwright closes its browsers and the server it started; this also ends any browser a crashed worker left behind.
 * The e2e server stops its own in-memory database, and npm run clean:dev catches anything else.
 */
export default function globalTeardown() {
  if (process.platform === "win32") {
    const script =
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome-headless-shell.exe' -or ([string]$_.ExecutablePath -match 'ms-playwright') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    spawnSync("powershell", ["-NoProfile", "-Command", script], { stdio: "ignore" });
  } else {
    spawnSync("sh", ["-c", "pkill -f ms-playwright; pkill -f chrome-headless-shell"], { stdio: "ignore" });
  }
}
