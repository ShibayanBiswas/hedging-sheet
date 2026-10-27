import { NextResponse } from "next/server";

import { COLLECTIONS, getDb, writeWithRetry } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Saved named input sets. */
export async function GET() {
  const db = await getDb();
  if (!db) return NextResponse.json({ products: [], persisted: false });
  const docs = await db
    .collection(COLLECTIONS.savedProducts)
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
  return NextResponse.json({ products: docs, persisted: true });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: unknown; inputs?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name || !body?.inputs || typeof body.inputs !== "object") {
    return NextResponse.json({ error: "Give the input set a name." }, { status: 400 });
  }
  const db = await getDb();
  if (!db) return NextResponse.json({ ok: true, persisted: false });
  await writeWithRetry("saved product", async (acknowledged) => {
    const wc = acknowledged ? undefined : { writeConcern: { w: 1 as const } };
    await db
      .collection(COLLECTIONS.savedProducts)
      .updateOne({ name }, { $set: { name, inputs: body.inputs, updatedAt: new Date() } }, { upsert: true, ...wc });
  });
  return NextResponse.json({ ok: true, persisted: true });
}
