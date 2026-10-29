import { NextResponse } from "next/server";

import { CACHE_TAGS, expireTags, historyTag } from "@/lib/cache";
import { guardWrite } from "@/lib/server/write-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_TAGS = [CACHE_TAGS.surface, CACHE_TAGS.history, historyTag("nifty"), historyTag("sensex")];

/** Expires every cached read: the surface, the parameters and the daily history. Needs the Desk Key. */
export async function POST(req: Request) {
  const blocked = guardWrite(req, 1024);
  if (blocked) return blocked;
  expireTags(ALL_TAGS, ["/"]);
  return NextResponse.json({ ok: true, expired: ALL_TAGS, at: new Date().toISOString() });
}
