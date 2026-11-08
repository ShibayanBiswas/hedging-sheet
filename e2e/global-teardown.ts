import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Fragments that appear only on browsers Playwright installed, never on a person's own Chrome. */
const PLAYWRIGHT_BROWSER = /ms-playwright|chrome-headless-shell/;

type ProcessEntry = { pid: number; ppid: number; command: string };

/** One process a line: its id, its parent's id, then its name and path or its command line. */
export function parseProcessList(stdout: string): ProcessEntry[] {
  return stdout.split("\n").flatMap((line) => {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*?)\s*$/.exec(line);
    return m ? [{ pid: Number(m[1]), ppid: Number(m[2]), command: m[3]! }] : [];
  });
}

/**
 * The Playwright browsers no running process owns: on Windows the parent is no longer in the list, elsewhere process 1 has
 * adopted it. A browser with a live parent may be another session's, so it is left alone. A parent id reused by another
 * program counts as live, which leaves that browser running rather than risk someone else's.
 */
export function orphanBrowsers(processes: ProcessEntry[], platform: NodeJS.Platform): number[] {
  const live = new Set(processes.map((p) => p.pid));
  const orphaned = (p: ProcessEntry) => (platform === "win32" ? !live.has(p.ppid) : p.ppid === 1);
  return processes.filter((p) => PLAYWRIGHT_BROWSER.test(p.command) && orphaned(p)).map((p) => p.pid);
}

async function processList(): Promise<string> {
  if (process.platform === "win32") {
    // By executable path, not command line: the command line of this very script holds the words it looks for.
    const script = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.Name) $($_.ExecutablePath)" }';
    // A hung WMI never answers, so the list is given up after 30 s rather than holding the run's report.
    return (await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], { windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  }
  return (await execFileAsync("ps", ["-eo", "pid=,ppid=,args="], { maxBuffer: 16 * 1024 * 1024 })).stdout;
}

/**
 * Playwright closes its browsers and the server it started; this also ends any browser a crashed worker left behind,
 * and only on a local machine: CI runners are discarded, and killing them can race the artifact upload.
 * The e2e server stops its own in-memory database, and npm run clean:dev catches anything else.
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.CI) return;
  try {
    for (const pid of orphanBrowsers(parseProcessList(await processList()), process.platform)) {
      if (pid === process.pid) continue;
      try {
        process.kill(pid);
      } catch {
        // already gone
      }
    }
  } catch {
    // ps or powershell unavailable; the run itself already finished
  }
}
