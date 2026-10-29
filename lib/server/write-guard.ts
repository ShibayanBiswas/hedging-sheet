import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { DESK_KEY_HEADER } from "@/lib/desk-key";

const WINDOW_MS = 10 * 60_000;
/** Attempts per address per ten minutes, counted per server instance. */
const limit = () => Number(process.env.DESK_WRITE_LIMIT) || 20;
const attempts = new Map<string, number[]>();

export function resetWriteGuard(): void {
  attempts.clear();
}

function refuse(status: number, error: string, issue: string, headers?: Record<string, string>) {
  return NextResponse.json({ error, issues: [issue] }, { status, headers });
}

function sameKey(given: string, secret: string): boolean {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Every write needs the Desk Key set on the server as DESK_WRITE_KEY. Attempts are rate limited, wrong keys
 * included, and bodies over maxBytes are refused before they are read. Returns a response to send back, or null to go ahead.
 */
export function guardWrite(req: Request, maxBytes: number): NextResponse | null {
  const secret = process.env.DESK_WRITE_KEY?.trim();
  if (!secret) return refuse(503, "Saving Is Turned Off", "This deployment has no Desk Key, so nothing can be saved.");

  const address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const recent = (attempts.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit()) {
    const wait = Math.ceil((WINDOW_MS - (now - recent[0]!)) / 1000);
    return refuse(429, "Too Many Saves", "Wait a few minutes before saving again.", { "Retry-After": String(wait) });
  }
  recent.push(now);
  attempts.set(address, recent);

  if (!sameKey(req.headers.get(DESK_KEY_HEADER) ?? "", secret)) {
    return refuse(401, "Desk Key Required", "Enter the Desk Key to save.");
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) return refuse(413, "Too Large", `Keep the upload under ${Math.round(maxBytes / 1024 / 1024)} megabytes.`);
  return null;
}

/** Reads a JSON body up to maxBytes, whatever the declared length. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const text = await req.text().catch(() => "");
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, response: refuse(413, "Too Large", "The data is too large to save.") };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: refuse(400, "Not Valid", "The data could not be read.") };
  }
}
