import fs from "node:fs";
import path from "node:path";

/** Production and this project's previews on Vercel: the only hosts that may receive the bypass secret. */
const TRUSTED_HOST = /^hedging-sheet(-[a-z0-9-]+-shibayan-biswas-projects)?\.vercel\.app$/;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * What a test run may do with a deployment URL: "trusted" sends the secret, "local" runs without it, "refused" does not
 * run. A URL can come from a deployment event, so it is parsed rather than matched as text.
 */
export function bypassTarget(rawUrl: string): "trusted" | "local" | "refused" {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "refused";
  }
  if (url.username || url.password) return "refused";
  if (url.protocol === "https:" && !url.port && TRUSTED_HOST.test(url.hostname)) return "trusted";
  if (url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname)) return "local";
  return "refused";
}

/**
 * Playwright quotes request and response headers in the error of a failed API call, and that text reaches the JUnit file
 * and error-context.md. This takes the secret and Vercel's bypass cookie out of every file in a report folder before it
 * can be uploaded, and returns how many files changed.
 */
export function scrubSecret(folder: string, secret: string): number {
  const value = Buffer.from(secret).toString("latin1");
  let changed = 0;
  for (const name of fs.readdirSync(folder, { recursive: true, encoding: "utf8" })) {
    const file = path.join(folder, name);
    if (!fs.statSync(file).isFile()) continue;
    // Latin-1 maps each byte to one character and back, so screenshots and videos come through unchanged.
    const text = fs.readFileSync(file, "latin1");
    const clean = text.split(value).join("[redacted]").replace(/_vercel_jwt=[^;\s"'\\]+/g, "_vercel_jwt=[redacted]");
    if (clean === text) continue;
    fs.writeFileSync(file, clean, "latin1");
    changed += 1;
  }
  return changed;
}
