import { CACHE_TAGS, cachedRead, expireTags } from "@/lib/cache";
import { withTransaction } from "@/lib/db/client";
import { readParamsOnOrBefore, replaceParams } from "@/lib/db/pricing-params";
import { pricingParamsSchema, volSurfaceSchema } from "@/lib/db/schemas";
import { readSurfaceOnOrBefore, replaceSurface } from "@/lib/db/vol-surfaces";
import { istTodayYmd } from "@/lib/engine/dates";
import { normalizePricingParams, seedPricingParams } from "@/lib/engine/defaults";
import type { PricingParams, VolSurface } from "@/lib/engine/types";
import { labelSurfaceForDeskMonth, normalizeVolSurface, SEED_SURFACE } from "@/lib/engine/vol-surface";
import { fetchIndexAtDate } from "@/lib/market-data";

export type DatasetSource = "database" | "runtime" | "seed";

/** Same-instance copy of the last save when the database is unreachable. */
let runtimeSurface: VolSurface | null = null;
let runtimeParams: PricingParams | null = null;

export function deskMonthKey(today = istTodayYmd()): string {
  return today.slice(0, 7);
}

const cachedSurface = cachedRead((monthKey: string) => readSurfaceOnOrBefore(monthKey), ["surface-on-or-before"], [CACHE_TAGS.surface]);
const cachedParams = cachedRead((monthKey: string) => readParamsOnOrBefore(monthKey), ["params-on-or-before"], [CACHE_TAGS.surface]);

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
async function presentSurfaceForDeskMonth(surface: VolSurface): Promise<VolSurface> {
  const todayMonth = deskMonthKey();
  if (surface.monthKey >= todayMonth) return surface;
  return labelSurfaceForDeskMonth(surface, todayMonth, await monthAnchors(todayMonth));
}

export async function loadActiveSurface(): Promise<{ surface: VolSurface; source: DatasetSource }> {
  try {
    const stored = await cachedSurface(deskMonthKey());
    if (stored) return { surface: await presentSurfaceForDeskMonth(normalizeVolSurface(stored)), source: "database" };
  } catch (err) {
    console.error("[load] vol surface:", err instanceof Error ? err.message : "read failed");
  }
  if (runtimeSurface) return { surface: await presentSurfaceForDeskMonth(runtimeSurface), source: "runtime" };
  return { surface: await presentSurfaceForDeskMonth(normalizeVolSurface(SEED_SURFACE)), source: "seed" };
}

/** Surface parameters are saved per month; the latest month on or before today is active. */
export async function loadActiveParams(): Promise<{ params: PricingParams; source: DatasetSource; monthKey: string | null }> {
  try {
    const stored = await cachedParams(deskMonthKey());
    if (stored) return { params: normalizePricingParams(stored.params), source: "database", monthKey: stored.monthKey };
  } catch (err) {
    console.error("[load] pricing params:", err instanceof Error ? err.message : "read failed");
  }
  if (runtimeParams) return { params: runtimeParams, source: "runtime", monthKey: null };
  return { params: seedPricingParams(), source: "seed", monthKey: null };
}

export class ReferenceDataError extends Error {
  constructor(readonly issues: string[]) {
    super(issues[0] ?? "The data is not valid.");
  }
}

/**
 * Saves a surface, surface parameters or both in one transaction, after checking the whole of each,
 * then expires the surface cache. Returns false when there is no database: the save then lasts for this instance only.
 */
export async function saveReferenceData(
  change: { surface?: VolSurface; params?: { values: PricingParams; monthKey: string } },
  source: string,
): Promise<boolean> {
  // The raw data is checked first: normalizing would quietly fill a missing row with zeros.
  const check = (surface: VolSurface | null, params: PricingParams | null) => {
    const issues = [
      ...(surface ? volSurfaceSchema.safeParse(surface).error?.issues ?? [] : []),
      ...(params ? pricingParamsSchema.safeParse(params).error?.issues ?? [] : []),
    ].map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    if (issues.length) throw new ReferenceDataError(issues.slice(0, 8));
  };
  check(change.surface ?? null, change.params?.values ?? null);
  const surface = change.surface ? normalizeVolSurface(change.surface) : null;
  const params = change.params ? normalizePricingParams(change.params.values) : null;
  check(surface, params);

  const written = await withTransaction(async (db, session) => {
    if (surface) await replaceSurface(db, session, surface, source);
    if (params) await replaceParams(db, session, params, change.params!.monthKey, source);
    return true;
  });
  if (surface) runtimeSurface = surface;
  if (params) runtimeParams = params;
  expireTags([CACHE_TAGS.surface], ["/"]);
  return written === true;
}
