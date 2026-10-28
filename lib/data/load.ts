import { COLLECTIONS, getDb, writeWithRetry } from "@/lib/db/mongo";
import { istTodayYmd } from "@/lib/engine/dates";
import { normalizePricingParams, seedPricingParams } from "@/lib/engine/defaults";
import type { PricingParams, VolSurface } from "@/lib/engine/types";
import { labelSurfaceForDeskMonth, normalizeVolSurface, SEED_SURFACE } from "@/lib/engine/vol-surface";
import { fetchIndexAtDate } from "@/lib/market-data";

export type DatasetSource = "database" | "runtime" | "seed";

/** Same-instance cache when Mongo is unreachable. */
let runtimeSurface: VolSurface | null = null;
let runtimeParams: PricingParams | null = null;

function stripMeta<T>(doc: T & { _id?: unknown; isActive?: unknown; source?: unknown; updatedAt?: unknown }): T {
  const { _id, isActive, source, updatedAt, ...rest } = doc;
  void _id;
  void isActive;
  void source;
  void updatedAt;
  return rest as T;
}

export function looksLikeSurface(value: unknown): value is VolSurface {
  if (!value || typeof value !== "object") return false;
  const s = value as VolSurface;
  return Array.isArray(s.expiries) && s.expiries.length > 0 && Array.isArray(s.volsPercent) && Array.isArray(s.moneyness);
}

export function looksLikeParams(value: unknown): value is PricingParams {
  if (!value || typeof value !== "object") return false;
  const p = value as PricingParams;
  return Array.isArray(p.rateCurve) && Array.isArray(p.dividends) && Number.isFinite(Number(p.rateCapBuyingForward));
}

export function deskMonthKey(today = istTodayYmd()): string {
  return today.slice(0, 7);
}

const anchorCache = new Map<string, { nifty: number | null; sensex: number | null }>();

/** Yahoo Nifty and Sensex closes on or before the 1st of a month: that month's 100 percent anchors. */
async function monthAnchors(monthKey: string): Promise<{ nifty: number | null; sensex: number | null }> {
  const cached = anchorCache.get(monthKey);
  if (cached) return cached;
  const levels = await fetchIndexAtDate(`${monthKey}-01`).catch(() => null);
  const anchors = { nifty: levels?.niftyLevel ?? null, sensex: levels?.sensexLevel ?? null };
  if (anchors.nifty != null && anchors.sensex != null && `${monthKey}-01` < istTodayYmd()) anchorCache.set(monthKey, anchors);
  return anchors;
}

/** Show the current month; carry the previous grid with this month's anchors when there is no upload. */
export async function presentSurfaceForDeskMonth(surface: VolSurface): Promise<VolSurface> {
  const todayMonth = deskMonthKey();
  if (surface.monthKey >= todayMonth) return surface;
  return labelSurfaceForDeskMonth(surface, todayMonth, await monthAnchors(todayMonth));
}

export async function loadActiveSurface(): Promise<{ surface: VolSurface; source: DatasetSource }> {
  const db = await getDb();
  if (db) {
    try {
      const monthKey = deskMonthKey();
      const col = db.collection(COLLECTIONS.volSurfaces);
      const doc = await col
        .find({ monthKey: { $lte: monthKey }, "expiries.0": { $exists: true } })
        .sort({ monthKey: -1 })
        .limit(1)
        .next();
      if (doc) {
        const surface = normalizeVolSurface(stripMeta(doc as unknown as VolSurface));
        return { surface: await presentSurfaceForDeskMonth(surface), source: "database" };
      }
    } catch (err) {
      console.error("[load] vol surface", err instanceof Error ? err.message : err);
    }
  }
  if (runtimeSurface) return { surface: await presentSurfaceForDeskMonth(runtimeSurface), source: "runtime" };
  return { surface: await presentSurfaceForDeskMonth(normalizeVolSurface(SEED_SURFACE)), source: "seed" };
}

/** Surface parameters are saved per month; the latest month on or before today is active. */
export async function loadActiveParams(): Promise<{ params: PricingParams; source: DatasetSource; monthKey: string | null }> {
  const db = await getDb();
  if (db) {
    try {
      const col = db.collection(COLLECTIONS.pricingParams);
      const monthly = await col
        .find({ monthKey: { $lte: deskMonthKey() } })
        .sort({ monthKey: -1 })
        .limit(1)
        .next();
      const doc = monthly ?? (await col.findOne({ isActive: true }));
      if (doc && looksLikeParams(doc)) {
        const { monthKey, key, ...rest } = stripMeta(doc as unknown as PricingParams & { monthKey?: string; key?: string });
        void key;
        return { params: normalizePricingParams(rest), source: "database", monthKey: monthKey ?? null };
      }
    } catch (err) {
      console.error("[load] pricing params", err instanceof Error ? err.message : err);
    }
  }
  if (runtimeParams) return { params: runtimeParams, source: "runtime", monthKey: null };
  return { params: seedPricingParams(), source: "seed", monthKey: null };
}

export async function persistActiveSurface(surface: VolSurface, source: string): Promise<boolean> {
  const plain = normalizeVolSurface(surface);
  runtimeSurface = plain;
  const db = await getDb();
  if (!db) return false;
  await writeWithRetry("vol surface", async (acknowledged) => {
    const wc = acknowledged ? undefined : { writeConcern: { w: 1 as const } };
    await db.collection(COLLECTIONS.volSurfaces).updateMany({}, { $set: { isActive: false } }, wc);
    await db
      .collection(COLLECTIONS.volSurfaces)
      .updateOne(
        { monthKey: plain.monthKey },
        { $set: { ...plain, isActive: true, source, updatedAt: new Date() } },
        { upsert: true, ...wc },
      );
    await db
      .collection(COLLECTIONS.uploadLogs)
      .insertOne({ type: "vol_surface", filename: source, monthKey: plain.monthKey, at: new Date() }, wc);
  });
  return true;
}

export async function persistActiveParams(raw: PricingParams, source: string, monthKey = deskMonthKey()): Promise<boolean> {
  const params = normalizePricingParams(raw);
  runtimeParams = params;
  const db = await getDb();
  if (!db) return false;
  await writeWithRetry("pricing params", async (acknowledged) => {
    const wc = acknowledged ? undefined : { writeConcern: { w: 1 as const } };
    await db.collection(COLLECTIONS.pricingParams).updateMany({}, { $set: { isActive: false } }, wc);
    await db
      .collection(COLLECTIONS.pricingParams)
      .updateOne(
        { monthKey },
        { $set: { ...params, monthKey, key: `month:${monthKey}`, isActive: true, source, updatedAt: new Date() } },
        { upsert: true, ...wc },
      );
    await db.collection(COLLECTIONS.uploadLogs).insertOne({ type: "pricing_params", filename: source, monthKey, at: new Date() }, wc);
  });
  return true;
}
