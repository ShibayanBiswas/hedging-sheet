"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/engine/dates";
import type { Underlying, VolSurface } from "@/lib/engine/types";
import { referencePriceForUnderlying } from "@/lib/engine/vol-surface";
import { fmtNumber } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

/** Volatility cells are in %; anything outside this range is a typing error. */
const MAX_VOL = 200;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UNDERLYINGS: Underlying[] = ["Nifty", "Sensex"];

/** One sequential scale: faint for the lowest volatility, strongest for the highest. The hue follows the theme. */
export function heatAlpha(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return 0.05 + 0.4 * Math.min(1, Math.max(0, (value - min) / (max - min)));
}

const heat = (alpha: number) => (alpha > 0 ? `rgb(var(--heat-rgb) / ${alpha.toFixed(3)})` : undefined);

/** "Jun 26" on phones, so the Expiry column stays narrow. */
function shortDate(ymd: string): string {
  const [y, m] = ymd.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y?.slice(2) ?? ""}`;
}

export function parseVol(text: string): number | null {
  const raw = text.replace(/[%,\s]/g, "");
  if (!/^\d*\.?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && n <= MAX_VOL ? n : null;
}

export function VolSurfaceGrid({
  surface,
  asOf,
  editing = false,
  draft = [],
  loading = false,
  error = null,
  onCellChange,
  onInvalidChange,
  testId = "vol-grid",
}: {
  surface: VolSurface;
  /** Expiry rows before this date are never read by a live leg, so they are hidden. */
  asOf: string;
  editing?: boolean;
  draft?: number[][];
  loading?: boolean;
  error?: string | null;
  onCellChange?: (row: number, col: number, value: number) => void;
  /** How many edited cells do not hold a valid volatility. */
  onInvalidChange?: (count: number) => void;
  testId?: string;
}) {
  const phone = useMediaQuery("(max-width: 639px)");
  const [bad, setBad] = useState<Set<string>>(new Set());
  const { min, max } = useMemo(() => {
    const all = surface.volsPercent.flat().filter((v) => Number.isFinite(v));
    return all.length ? { min: Math.min(...all), max: Math.max(...all) } : { min: 0, max: 0 };
  }, [surface]);
  const rows = surface.expiries.map((expiry, r) => ({ expiry, r })).filter((row) => row.expiry.slice(0, 10) >= asOf);
  const hidden = surface.expiries.length - rows.length;
  const span = surface.moneyness.length + 2;
  const empty = !loading && surface.expiries.length === 0;
  const deep = Number.isFinite(surface.deepStrike) && surface.deepStrike > 0 ? fmtNumber(surface.deepStrike, 2) : "-";

  const markCell = (key: string, ok: boolean) => {
    if (ok === !bad.has(key)) return;
    const next = new Set(bad);
    if (ok) next.delete(key);
    else next.add(key);
    setBad(next);
    onInvalidChange?.(next.size);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="data-table-premium-wrap desk-table-scroll vol-grid-box" data-testid={testId} tabIndex={0} role="region" aria-label="Volatility Surface">
        <table className={cn("data-table-premium vol-grid min-w-full", editing && "vol-grid--editing")}>
          <thead>
            <tr>
              <th rowSpan={2} scope="col">
                Expiry
              </th>
              <th className="vol-grid-group text-center" colSpan={span - 1} scope="colgroup">
                Volatility %
              </th>
            </tr>
            <tr>
              <th className="text-right" scope="col">
                Deep
              </th>
              {surface.moneyness.map((m) => (
                <th key={m} className="text-right" scope="col">
                  {Math.round(m * 100)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={span} className="vol-grid-note vol-grid-note--error" role="alert" data-testid={`${testId}-error`}>
                  {error}
                </td>
              </tr>
            ) : null}
            {loading ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={`skeleton-${i}`} data-testid={`${testId}-skeleton`}>
                  <td colSpan={span}>
                    <span className="vol-grid-skeleton" />
                  </td>
                </tr>
              ))
            ) : empty ? (
              <tr>
                <td colSpan={span} className="vol-grid-note" data-testid={`${testId}-empty`}>
                  No Surface Loaded - Upload Surface Or Reload From Desk Database
                </td>
              </tr>
            ) : (
              <>
                <tr className="vol-grid-label">
                  <td colSpan={span}>
                    <span>Reference Strikes</span>
                  </td>
                </tr>
                {UNDERLYINGS.map((u) => {
                  const ref = referencePriceForUnderlying(surface, u);
                  return (
                    <tr key={u} data-testid={`strike-row-${u.toLowerCase()}`}>
                      <td className="font-semibold">{u} Strikes</td>
                      <td className="text-right" data-kind="number" data-testid={`deep-strike-${u.toLowerCase()}`}>
                        {deep}
                      </td>
                      {surface.moneyness.map((m) => (
                        <td key={m} className="text-right" data-kind="number">
                          {ref > 0 ? fmtNumber(m * ref, 2) : "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="vol-grid-label">
                  <td colSpan={span}>
                    <span>Volatility By Expiry</span>
                  </td>
                </tr>
                {rows.map(({ expiry, r }) => (
                  <tr key={expiry}>
                    <td className="font-semibold" data-kind="date" title={formatDate(expiry)}>
                      {phone ? shortDate(expiry) : formatDate(expiry)}
                    </td>
                    {(editing ? (draft[r] ?? []) : (surface.volsPercent[r] ?? [])).map((v, c) => {
                      const key = `${r}:${c}`;
                      const invalid = bad.has(key);
                      return (
                        <td key={c} className="text-right" data-kind="number" style={{ background: editing ? undefined : heat(heatAlpha(v, min, max)) }}>
                          {editing ? (
                            <input
                              className={cn("vol-grid-input", invalid && "vol-grid-input--invalid")}
                              inputMode="decimal"
                              defaultValue={v.toFixed(2)}
                              aria-invalid={invalid || undefined}
                              aria-label={`Volatility For ${formatDate(expiry)} At ${c === 0 ? "Deep" : `${Math.round((surface.moneyness[c - 1] ?? 0) * 100)}%`}`}
                              data-testid={`vol-cell-${r}-${c}`}
                              onChange={(e) => {
                                const n = parseVol(e.target.value);
                                markCell(key, n != null);
                                if (n != null) onCellChange?.(r, c, n);
                              }}
                            />
                          ) : (
                            fmtNumber(v, 2)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
      {!loading && !empty ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-ui text-caption text-muted" data-testid={`${testId}-legend`}>
          <span className="font-semibold text-ink">Volatility Scale</span>
          <span className="inline-flex items-center gap-2">
            Low <span className="tabular-nums text-ink">{fmtNumber(min, 2)}%</span>
            <span className="vol-grid-legend-bar" aria-hidden />
            High <span className="tabular-nums text-ink">{fmtNumber(max, 2)}%</span>
          </span>
          {hidden > 0 ? (
            <span>
              {hidden} expiry {hidden === 1 ? "row" : "rows"} before the valuation date {hidden === 1 ? "is" : "are"} hidden; they stay in the file and are never read by a live leg.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
