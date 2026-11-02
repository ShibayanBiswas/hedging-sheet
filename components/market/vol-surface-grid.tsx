"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/engine/dates";
import type { VolSurface } from "@/lib/engine/types";
import { DEEP_MONEYNESS, referencePriceForUnderlying } from "@/lib/engine/vol-surface";
import { fmtNumber, ungroup, volText } from "@/lib/format";
import { UNDERLYINGS } from "@/lib/underlyings";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

/** Volatility cells are in %; anything outside this range is a typing error. */
const MAX_VOL = 200;
/**
 * An uploaded surface is the one table with no ceiling on its rows, so only it is virtualised, and only past this many.
 * Every other table tops out at 42 rows, measured on the largest book. Downloads read the surface data, not the page.
 */
const VIRTUAL_ABOVE = 100;
/** 11 + 20 + 11 px and a 1 px rule. */
const ROW_PX = 43;
/** The rows above the first expiry scroll too; these extra rows cover their height. */
const OVERSCAN = 12;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** One sequential scale: faint for the lowest volatility, strongest for the highest. The hue follows the theme. */
function heatAlpha(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return 0.05 + 0.4 * Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Text colour on the white grid: stone for the lowest volatility to maroon for the highest, both above 4.5 to 1. */
const LOW_RGB = [87, 83, 78];
const HIGH_RGB = [122, 30, 44];
const heatColor = (alpha: number) => {
  if (!(alpha > 0)) return undefined;
  const t = (alpha - 0.05) / 0.4;
  return `rgb(${LOW_RGB.map((lo, i) => Math.round(lo + (HIGH_RGB[i]! - lo) * t)).join(" ")})`;
};

/** "Jun 26" on phones, so the Expiry column stays narrow. */
function shortDate(ymd: string): string {
  const [y, m] = ymd.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y?.slice(2) ?? ""}`;
}

function parseVol(text: string): number | null {
  const raw = ungroup(text.replace(/[%\s]/g, ""));
  if (raw == null || !/^\d*\.?\d+$/.test(raw)) return null;
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
  const box = useRef<HTMLDivElement>(null);
  // While editing every row stays mounted: a cell scrolled away would lose what was typed in it.
  const virtual = rows.length > VIRTUAL_ABOVE && !editing && !loading && !error;
  // eslint-disable-next-line react-hooks/incompatible-library -- only this component reads the virtualizer, and the build does not use the React Compiler
  const virtualizer = useVirtualizer({ count: virtual ? rows.length : 0, getScrollElement: () => box.current, estimateSize: () => ROW_PX, overscan: OVERSCAN });
  const items = virtualizer.getVirtualItems();
  const shownRows = virtual ? items.map((item) => ({ ...rows[item.index]!, index: item.index })) : rows.map((row, index) => ({ ...row, index }));
  const spacerAbove = virtual && items.length ? items[0]!.start : 0;
  const spacerBelow = virtual && items.length ? virtualizer.getTotalSize() - items.at(-1)!.end : 0;
  /** Two header rows, the Reference Strikes label and its rows, the Volatility By Expiry label. */
  const rowsBefore = 2 + 1 + UNDERLYINGS.length + 1;
  const hidden = surface.expiries.length - rows.length;
  const span = surface.moneyness.length + 2;
  const empty = !loading && surface.expiries.length === 0;
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
      <div className="relative min-w-0">
      <div ref={box} className="data-table-premium-wrap desk-table-scroll vol-grid-box" data-testid={testId} tabIndex={0} role="region" aria-label="Volatility Surface">
        <table className={cn("data-table-premium vol-grid min-w-full", editing && "vol-grid--editing")} aria-rowcount={virtual ? rowsBefore + rows.length : undefined}>
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
                  // Deep reads the 55% column, so it shows the 55% strike.
                  const deep = surface.moneyness.find((m) => Math.abs(m - DEEP_MONEYNESS) < 1e-9) ?? surface.moneyness[0] ?? NaN;
                  return (
                    <tr key={u} data-testid={`strike-row-${u.toLowerCase()}`}>
                      <td className="font-semibold">{u} Strikes</td>
                      <td className="text-right" data-kind="number" data-testid={`deep-strike-${u.toLowerCase()}`}>
                        {ref > 0 && Number.isFinite(deep) ? fmtNumber(deep * ref, 2) : "-"}
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
                {spacerAbove > 0 ? (
                  <tr aria-hidden style={{ height: spacerAbove }}>
                    <td colSpan={span} />
                  </tr>
                ) : null}
                {shownRows.map(({ expiry, r, index }) => (
                  <tr key={expiry} aria-rowindex={virtual ? rowsBefore + index + 1 : undefined}>
                    <td className="font-semibold" data-kind="date" title={formatDate(expiry)}>
                      {phone ? shortDate(expiry) : formatDate(expiry)}
                    </td>
                    {(editing ? (draft[r] ?? []) : (surface.volsPercent[r] ?? [])).map((v, c) => {
                      const key = `${r}:${c}`;
                      const invalid = bad.has(key);
                      // Deep copies the 55% column, so it is read only.
                      const editable = editing && c > 0;
                      return (
                        <td key={c} className="text-right" data-kind="number" style={editable ? undefined : { color: heatColor(heatAlpha(v, min, max)), fontWeight: heatAlpha(v, min, max) > 0.3 ? 700 : 500 }}>
                          {editable ? (
                            <input
                              className={cn("vol-grid-input", invalid && "vol-grid-input--invalid")}
                              inputMode="decimal"
                              defaultValue={volText(v).text}
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
                            volText(v).text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {spacerBelow > 0 ? (
                  <tr aria-hidden style={{ height: spacerBelow }}>
                    <td colSpan={span} />
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
      </div>
      </div>
      {!loading && !empty ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-ui text-caption text-muted" data-testid={`${testId}-legend`}>
          <span className="font-semibold text-ink">Volatility Scale</span>
          <span className="inline-flex items-center gap-2">
            Low{" "}
            <span className="tabular-nums" style={{ color: heatColor(0.05), fontWeight: 500 }}>
              {volText(min).text}%
            </span>
            to High{" "}
            <span className="tabular-nums" style={{ color: heatColor(0.45), fontWeight: 700 }}>
              {volText(max).text}%
            </span>
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
