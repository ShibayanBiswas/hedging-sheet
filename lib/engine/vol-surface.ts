import { istTodayYmd, parseYmd } from "@/lib/engine/dates";
import type { MarketData, PricingParamPoint, Underlying, VolSurface } from "@/lib/engine/types";

import volSeed from "@/lib/data/vol-surface-seed.json";

/** Deep column is always ₹500 for Nifty and Sensex. */
export const DEEP_STRIKE = 500;

/** Forward Sell Rate used when a surface carries no Pricing Params point. */
export const DEFAULT_FWD_SELL_RATE = 0.055;

export const SEED_SURFACE = volSeed as VolSurface;

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function monthKey(ymd: string = istTodayYmd()): string {
  return ymd.slice(0, 7);
}

/** "October 2026 Volatility Surface" for a YYYY-MM key. */
export function surfaceMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const name = new Date(Date.UTC(year || 2026, (month || 1) - 1, 1)).toLocaleString("en-IN", {
    month: "long",
    timeZone: "UTC",
  });
  return `${name} ${year} Volatility Surface`;
}

/** Nifty 100 percent anchor from Surface Parameters, falling back to the live spot. */
export function referenceUnderlyingPrice(surface: VolSurface, liveSpot?: number): number {
  if (isPositive(surface.referenceUnderlyingPrice)) return surface.referenceUnderlyingPrice;
  return isPositive(liveSpot) ? liveSpot : 0;
}

/** Sensex 100 percent anchor. */
export function referenceSensexPrice(surface: VolSurface, liveSpot?: number): number {
  if (isPositive(surface.referenceSensexPrice)) return surface.referenceSensexPrice;
  return isPositive(liveSpot) ? liveSpot : 0;
}

export function referencePriceForUnderlying(surface: VolSurface, underlying: Underlying, liveSpot?: number): number {
  return underlying === "Sensex" ? referenceSensexPrice(surface, liveSpot) : referenceUnderlyingPrice(surface, liveSpot);
}

/**
 * The desk shows the current month. When that month has no upload, the previous grid
 * continues under the current month name with that month's anchors.
 */
export function labelSurfaceForDeskMonth(
  surface: VolSurface,
  todayMonth: string,
  anchors?: { nifty?: number | null; sensex?: number | null },
): VolSurface {
  if (!/^\d{4}-\d{2}$/.test(todayMonth) || surface.monthKey >= todayMonth) return surface;
  const nifty = Number(anchors?.nifty);
  const sensex = Number(anchors?.sensex);
  return normalizeVolSurface({
    ...surface,
    monthKey: todayMonth,
    label: surfaceMonthLabel(todayMonth),
    referenceUnderlyingPrice: nifty > 0 ? nifty : surface.referenceUnderlyingPrice,
    referenceSensexPrice: sensex > 0 ? sensex : surface.referenceSensexPrice,
  });
}

/** Linear interpolation of y at x on sorted xs, flat beyond both ends. */
function interp1(xs: number[], ys: number[], x: number): number {
  const n = Math.min(xs.length, ys.length);
  if (n <= 0) return 0;
  if (n === 1 || x <= xs[0]!) return Number(ys[0]) || 0;
  if (x >= xs[n - 1]!) return Number(ys[n - 1]) || 0;
  let i = 0;
  while (i < n - 1 && xs[i + 1]! < x) i += 1;
  const x0 = xs[i]!;
  const x1 = xs[i + 1]!;
  const a = Number(ys[i]);
  const b = Number(ys[i + 1]);
  if (!Number.isFinite(a)) return Number.isFinite(b) ? b : 0;
  if (!Number.isFinite(b) || x1 === x0) return a;
  // FORECAST through two points, the workbook's strike interpolation.
  const slope = (b - a) / (x1 - x0);
  const intercept = (a + b) / 2 - (slope * (x0 + x1)) / 2;
  return intercept + slope * x;
}

/** Sort expiries and strike columns so the bilinear lookup stays correct after edits. */
export function normalizeVolSurface(surface: VolSurface): VolSurface {
  const rows = (surface.expiries ?? [])
    .map((expiry, i) => ({ expiry, vols: [...(surface.volsPercent?.[i] ?? [])] }))
    .filter((row) => !Number.isNaN(parseYmd(row.expiry).getTime()))
    .sort((a, b) => parseYmd(a.expiry).getTime() - parseYmd(b.expiry).getTime());

  const moneyIdx = (surface.moneyness ?? [])
    .map((m, i) => ({ m: Number(m), i }))
    .filter((x) => Number.isFinite(x.m) && x.m > 0)
    .sort((a, b) => a.m - b.m);
  const moneyness = moneyIdx.map((x) => x.m);
  const volsPercent = rows.map((row) => {
    const deep = Number(row.vols[0]);
    return [
      Number.isFinite(deep) ? deep : 0,
      ...moneyIdx.map((x) => {
        const v = Number(row.vols[x.i + 1]);
        return Number.isFinite(v) ? v : 0;
      }),
    ];
  });

  const pricingParams: PricingParamPoint[] = (surface.pricingParams ?? [])
    .filter((p) => !Number.isNaN(parseYmd(p.date).getTime()))
    .map((p) => ({
      ...p,
      volBump: Number.isFinite(p.volBump) ? p.volBump : 0,
      fwdSellRate: Number.isFinite(p.fwdSellRate) ? p.fwdSellRate : DEFAULT_FWD_SELL_RATE,
    }))
    .sort((a, b) => parseYmd(a.date).getTime() - parseYmd(b.date).getTime());

  const key = /^\d{4}-\d{2}$/.test(surface.monthKey ?? "") ? surface.monthKey : monthKey();
  return {
    monthKey: key,
    label: surface.label?.trim() || surfaceMonthLabel(key),
    deepStrike: DEEP_STRIKE,
    moneyness,
    strikes: [DEEP_STRIKE, ...moneyness],
    expiries: rows.map((r) => r.expiry),
    volsPercent,
    pricingParams: pricingParams.length
      ? pricingParams
      : [{ date: rows[0]?.expiry ?? new Date().toISOString(), volBump: 0, fwdSellRate: DEFAULT_FWD_SELL_RATE }],
    referenceUnderlyingPrice: isPositive(surface.referenceUnderlyingPrice) ? surface.referenceUnderlyingPrice : undefined,
    referenceSensexPrice: isPositive(surface.referenceSensexPrice) ? surface.referenceSensexPrice : undefined,
    niftyAnchorAsOf: surface.niftyAnchorAsOf,
  };
}

/** Rupee strike axis: Deep 500, then moneyness times the named index anchor. */
function moneynessStrikes(surface: VolSurface, underlying: Underlying, spot?: number): number[] {
  const anchor = referencePriceForUnderlying(surface, underlying, spot);
  return [DEEP_STRIKE, ...surface.moneyness.map((m) => m * anchor)];
}

/** Expiry row bracket: lower row, upper row, weight in calendar days. Flat beyond the last row. */
function expiryBracket(times: number[], t: number): [number, number, number] {
  if (t <= times[0]!) return [0, 0, 0];
  const last = times.length - 1;
  if (t >= times[last]!) return [last, last, 0];
  let i = 0;
  while (i < last && times[i + 1]! <= t) i += 1;
  const t0 = times[i]!;
  const t1 = times[i + 1]!;
  return [i, i + 1, t1 === t0 ? 0 : (t - t0) / (t1 - t0)];
}

/**
 * Vol in percent points for a strike and expiry: FORECAST across the two strike columns,
 * then linear in calendar days between the two expiry rows, as the worksheet does.
 */
export function interpolateVolPercent(
  surface: VolSurface,
  strike: number,
  expiry: string,
  underlying: Underlying,
  spot?: number,
): number {
  if (!surface.expiries.length) return 0;
  const times = surface.expiries.map((e) => parseYmd(e).getTime());
  const strikes = moneynessStrikes(surface, underlying, spot);
  const [i0, i1, w] = expiryBracket(times, parseYmd(expiry).getTime());
  const v0 = interp1(strikes, surface.volsPercent[i0] ?? [], strike);
  if (w === 0) return v0;
  const v1 = interp1(strikes, surface.volsPercent[i1] ?? [], strike);
  return v0 - (v0 - v1) * w;
}

/** Pricing Params row on or before the date, the workbook VLOOKUP on exact expiry dates. */
export function pricingParamOnOrBefore(params: PricingParamPoint[], date: string): PricingParamPoint | null {
  if (!params.length) return null;
  const t = parseYmd(date).getTime();
  let chosen: PricingParamPoint | null = null;
  for (const p of params) {
    if (parseYmd(p.date).getTime() <= t) chosen = p;
    else break;
  }
  return chosen ?? params[0] ?? null;
}

export function lookupVolBump(params: PricingParamPoint[], date: string): number {
  return pricingParamOnOrBefore(params, date)?.volBump ?? 0;
}

export function lookupFwdSellRate(params: PricingParamPoint[], date: string): number {
  return pricingParamOnOrBefore(params, date)?.fwdSellRate ?? DEFAULT_FWD_SELL_RATE;
}

/**
 * Pricer B28 = 'Pricing Params'!H69: the Forward Sell Rate of the valuation month.
 * The latest row dated in that month; failing that, the first row after it; failing that, the last row before.
 */
export function forwardSellRateForMonth(params: PricingParamPoint[], valuationDate: string): number {
  return pricingRowForMonth(params, valuationDate)?.fwdSellRate ?? DEFAULT_FWD_SELL_RATE;
}

/** The Pricing Params row of the valuation month, the row H69 points at in a sheet saved that month. */
export function pricingRowForMonth(params: PricingParamPoint[], valuationDate: string): PricingParamPoint | null {
  if (!params.length) return null;
  const month = valuationDate.slice(0, 7);
  const inMonth = params.filter((p) => p.date.slice(0, 7) === month);
  if (inMonth.length) return inMonth[inMonth.length - 1]!;
  const t = parseYmd(valuationDate).getTime();
  const after = params.find((p) => parseYmd(p.date).getTime() > t);
  return after ?? params[params.length - 1]!;
}

/**
 * The market a live run reads: Pricing Params from the valuation month row onward (the forward grid)
 * and implied dividends on or after the valuation date. Older rows are never looked up by a live expiry.
 */
export function forwardMarket(market: MarketData, valuationDate: string): MarketData {
  const row = pricingRowForMonth(market.surface.pricingParams, valuationDate);
  const from = row ? parseYmd(row.date).getTime() : -Infinity;
  const pricingParams = market.surface.pricingParams.filter((p) => parseYmd(p.date).getTime() >= from);
  const valuation = parseYmd(valuationDate).getTime();
  const dividends = market.params.dividends.filter((d) => parseYmd(d.date).getTime() >= valuation);
  return {
    surface: { ...market.surface, pricingParams: pricingParams.length ? pricingParams : market.surface.pricingParams },
    params: { ...market.params, dividends },
  };
}
