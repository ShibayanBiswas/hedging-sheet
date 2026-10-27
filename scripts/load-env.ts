import fs from "node:fs";
import path from "node:path";

/** Load .env.local into process.env for scripts. Values are never printed. */
export function loadEnv(file = ".env.local"): void {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]!]) continue;
    process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
