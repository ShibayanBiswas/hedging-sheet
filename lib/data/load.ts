import { CACHE_TAGS, cachedRead, expireTags, SHARED_SURFACE_REVALIDATE_SECONDS } from "@/lib/cache";
import { withTransaction } from "@/lib/db/client";
import { readParamsOnOrBefore, replaceParams } from "@/lib/db/pricing-params";
import { pricingParamsSchema, volSurfaceSchema } from "@/lib/db/schemas";
import { readUnwindingSurface, sharedGrid, writeUnwindingSurface, type SharedGrid } from "@/lib/db/unwinding-surface";
import { readSurfaceOnOrBefore, replaceSurface } from "@/lib/db/vol-surfaces";
import { istTodayYmd } from "@/lib/engine/dates";
import { normalizePricingParams, seedPricingParams } from "@/lib/engine/defaults";
import type { PricingParamPoint, PricingParams, VolSurface } from "@/lib/engine/types";
import { DEFAULT_FWD_SELL_RATE, labelSurfaceForDeskMonth, normalizeVolSurface, pricingRowForMonth, SEED_SURFACE } from "@/lib/engine/vol-surface";
import { fetchIndexAtDate } from "@/lib/market-data";

/** shared: the grid is the Unwinding Calculator's active surface. database: this desk's own month document. */
export type DatasetSource = "shared" | "database" | "runtime" | "seed";

/** Same-instance copy of the last save when the database is unreachable. */
let runtimeSurface: VolSurface | null = null;
let runtimeParams: PricingParams | null = null;

export function deskMonthKey(today = istTodayYmd()): string {
  return today.slice(0, 7);
}

const cachedSurface = cachedRead((monthKey: string) => readSurfaceOnOrBefore(monthKey), ["surface-on-or-before"], [CACHE_TAGS.surface]);
const cachedParams = cachedRead((monthKey: string) => readParamsOnOrBefore(monthKey), ["params-on-or-before"], [CACHE_TAGS.surface]);
const cachedUnwinding = cachedRead((monthKey: string) => readUnwindingSurface(monthKey), ["unwinding-surface"], [CACHE_TAGS.surface], SHARED_SURFACE_REVALIDATE_SECONDS);

const anchorCache = new Map<string, { nifty: number | null; sensex: number | null }>();

/** Yahoo Nifty and Sensex closes on or before the 1st of a month: that month's 100 percent anchors. */
async function monthAnchors(monthKey: string): Promise<{ nifty: number | null; sensex: number | null }> {
  const cached = anchorCache.get(monthKey);
  if (cached) return cached;
  const levels = await fetchIndexAtDate(`${monthKey}-01`);
  const anchors = { nifty: levels.niftyLevel, sensex: levels.sensexLevel };
  if (anchors.nifty != null && anchors.sensex != null && `${monthKey}-01` < istTodayYmd()) anchorCache.set(monthKey, anchors);
  return anchors;
}

/**
 * Show the current month; carry the previous grid when there is no upload. The Reference Nifty and Sensex Prices are
 * always the Yahoo closes on or before the 1st of the month, for an uploaded surface as for a carried one; the
 * surface's own prices stand only when Yahoo has none. This is the Unwinding Calculator's presentation too.
 */
async function presentSurfaceForDeskMonth(surface: VolSurface): Promise<VolSurface> {
  const todayMonth = deskMonthKey();
  if (surface.monthKey < todayMonth) return labelSurfaceForDeskMonth(surface, todayMonth, await monthAnchors(todayMonth));
  const anchors = await monthAnchors(surface.monthKey);
  return normalizeVolSurface({
    ...surface,
    referenceUnderlyingPrice: anchors.nifty ?? surface.referenceUnderlyingPrice ?? undefined,
    referenceSensexPrice: anchors.sensex ?? surface.referenceSensexPrice ?? undefined,
  });
}

const gridKey = (s: SharedGrid) => JSON.stringify(sharedGrid(s));

/**
 * Keeps this desk's month document on the shared grid, so the desk database always holds what is priced.
 * The cache is expired after the write, so the next read sees the mirrored document and writes nothing.
 */
async function mirrorSharedGrid(surface: VolSurface, own: VolSurface | null, from: string): Promise<void> {
  if (own && own.monthKey === surface.monthKey && gridKey(normalizeVolSurface(own)) === gridKey(surface)) return;
  try {
    if (await withTransaction((db, session) => replaceSurface(db, session, surface, `unwinding ${from}`))) expireTags([CACHE_TAGS.surface]);
  } catch (err) {
    console.error("[load] surface mirror:", err instanceof Error ? err.message : "write failed");
  }
}

/**
 * The grid is the Unwinding Calculator's active surface; the Pricing Params grid, with its bump, margins and
 * forward sell rates, is this desk's own. Without a shared surface the desk's own month document is used.
 */
export async function loadActiveSurface(): Promise<{ surface: VolSurface; source: DatasetSource }> {
  const month = deskMonthKey();
  let own: VolSurface | null = null;
  try {
    own = await cachedSurface(month);
  } catch (err) {
    console.error("[load] vol surface:", err instanceof Error ? err.message : "read failed");
  }
  let shared: SharedGrid | null = null;
  try {
    shared = await cachedUnwinding(month);
  } catch (err) {
    console.error("[load] shared surface:", err instanceof Error ? err.message : "read failed");
  }
  if (shared) {
    const pricingParams = (own ?? runtimeSurface ?? SEED_SURFACE).pricingParams;
    const surface = await presentSurfaceForDeskMonth(normalizeVolSurface({ ...shared, pricingParams }));
    await mirrorSharedGrid(surface, own, shared.monthKey);
    return { surface, source: "shared" };
  }
  if (own) return { surface: await presentSurfaceForDeskMonth(normalizeVolSurface(own)), source: "database" };
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

/**
 * One month's surface parameters and Pricing Params grid for the editor: that month's documents, or the latest
 * earlier ones a new month starts from. The active ones when the database cannot be read.
 */
export async function loadMonthParams(monthKey: string): Promise<{ params: PricingParams; pricingParams: PricingParamPoint[]; storedMonth: string | null }> {
  try {
    const [stored, surface] = await Promise.all([readParamsOnOrBefore(monthKey), readSurfaceOnOrBefore(monthKey)]);
    if (stored || surface) {
      return {
        params: stored ? normalizePricingParams(stored.params) : (await loadActiveParams()).params,
        pricingParams: surface ? normalizeVolSurface(surface).pricingParams : (await loadActiveSurface()).surface.pricingParams,
        storedMonth: stored?.monthKey ?? null,
      };
    }
  } catch (err) {
    console.error("[load] month params:", err instanceof Error ? err.message : "read failed");
  }
  const [{ params }, { surface }] = await Promise.all([loadActiveParams(), loadActiveSurface()]);
  return { params, pricingParams: surface.pricingParams, storedMonth: null };
}

export class ReferenceDataError extends Error {
  constructor(readonly issues: string[]) {
    super(issues[0] ?? "The data is not valid.");
  }
}

/** The Unwinding Calculator's one point Pricing Params for a month: this desk's row of that month. */
function unwindingMonthPoint(surface: VolSurface): PricingParamPoint {
  const [y, m] = surface.monthKey.split("-").map(Number) as [number, number];
  const row = pricingRowForMonth(surface.pricingParams, `${surface.monthKey}-01`);
  return { date: new Date(Date.UTC(y, m, 0)).toISOString(), volBump: row?.volBump ?? 0, fwdSellRate: row?.fwdSellRate ?? DEFAULT_FWD_SELL_RATE };
}

/**
 * Saves a surface, surface parameters or both in one transaction, after checking the whole of each,
 * then expires the surface cache. Returns false when there is no database: the save then lasts for this instance only.
 * With shareGrid, an uploaded or edited grid also becomes the Unwinding Calculator's active surface, in the same transaction.
 */
export async function saveReferenceData(
  change: { surface?: VolSurface; params?: { values: PricingParams; monthKey: string }; shareGrid?: boolean },
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

  const written = await withTransaction(async (db, session, unwinding) => {
    if (surface) await replaceSurface(db, session, surface, source);
    if (surface && change.shareGrid) await writeUnwindingSurface(unwinding, session, surface, `hedging sheet ${source}`, unwindingMonthPoint(surface));
    if (params) await replaceParams(db, session, params, change.params!.monthKey, source);
    return true;
  });
  if (surface) runtimeSurface = surface;
  if (params) runtimeParams = params;
  expireTags([CACHE_TAGS.surface], ["/"]);
  return written === true;
}
