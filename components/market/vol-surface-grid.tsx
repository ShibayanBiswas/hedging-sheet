"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/engine/dates";
import type { Underlying, VolSurface } from "@/lib/engine/types";
import { referencePriceForUnderlying } from "@/lib/engine/vol-surface";
import { fmtNumber } from "@/lib/format";

/** Volatility cells are % points; anything outside this range is a typing error. */
const MAX_VOL_POINTS = 200;

function heat(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || max <= min) return "transparent";
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  // Gold for low vols through maroon for high vols, kept faint so text stays readable.
  const alpha = 0.08 + 0.32 * t;
  return t < 0.5 ? `rgba(212, 178, 76, ${alpha})` : `rgba(122, 30, 44, ${alpha * 0.85})`;
}

export function VolSurfaceGrid({
  surface,
  underlying,
  asOf,
  editing,
  draft,
  onCellChange,
  onInvalid,
}: {
  surface: VolSurface;
  underlying: Underlying;
  /** Expiry rows before this date are never read by a live leg, so they are hidden. */
  asOf: string;
  editing: boolean;
  draft: number[][];
  onCellChange: (row: number, col: number, value: number) => void;
  onInvalid: (message: string) => void;
}) {
  const [bad, setBad] = useState<Set<string>>(new Set());
  const { min, max } = useMemo(() => {
    const all = surface.volsPercent.flat().filter((v) => Number.isFinite(v));
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [surface]);
  const ref = referencePriceForUnderlying(surface, underlying);
  const rows = surface.expiries.map((expiry, r) => ({ expiry, r })).filter((row) => row.expiry.slice(0, 10) >= asOf);
  const hidden = surface.expiries.length - rows.length;

  return (
    <div className="desk-table-scroll desk-table-scroll--book w-full" data-testid="vol-grid" tabIndex={0} role="region" aria-label="Volatility Surface">
      <table className="data-table-premium data-table-fill vol-grid">
        <thead>
          <tr>
            <th className="col-pinned">Strike Change</th>
            <th className="text-right">Deep</th>
            {surface.moneyness.map((m) => (
              <th key={m} className="text-right">
                {Math.round(m * 100)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="data-table-row-alt">
            <td className="col-pinned font-semibold">{underlying} Strikes</td>
            <td className="text-right">500</td>
            {surface.moneyness.map((m) => (
              <td key={m} className="text-right" title={ref > 0 ? undefined : "No reference price for this underlying"}>
                {ref > 0 ? fmtNumber(m * ref, 2) : "-"}
              </td>
            ))}
          </tr>
          {rows.map(({ expiry, r }) => (
            <tr key={expiry}>
              <td className="col-pinned font-semibold">{formatDate(expiry)}</td>
              {(editing ? (draft[r] ?? []) : (surface.volsPercent[r] ?? [])).map((v, c) => {
                const key = `${r}:${c}`;
                return (
                  <td key={c} className={cn("hs-heat text-right", editing && "p-1")} style={{ background: editing ? undefined : heat(v, min, max) }}>
                    {editing ? (
                      <input
                        className={cn(
                          "w-20 rounded-lg border bg-[color:var(--ar-input-bg)] px-2 py-1 text-right font-ui text-caption tabular-nums outline-none focus:border-gold",
                          bad.has(key) ? "border-rose-500" : "border-[color:var(--ar-border)]",
                        )}
                        inputMode="decimal"
                        defaultValue={v.toFixed(2)}
                        aria-invalid={bad.has(key) || undefined}
                        aria-label={`Volatility for ${formatDate(expiry)} column ${c + 1}`}
                        data-testid={`vol-cell-${r}-${c}`}
                        onBlur={(e) => {
                          const raw = e.target.value.replace(/[%,\s]/g, "");
                          const n = Number(raw);
                          const ok = raw !== "" && Number.isFinite(n) && n > 0 && n <= MAX_VOL_POINTS;
                          setBad((prev) => {
                            const next = new Set(prev);
                            if (ok) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                          if (ok) onCellChange(r, c, n);
                          else
                            onInvalid(
                              `The volatility for ${formatDate(expiry)} at ${c === 0 ? "the Deep strike" : `${Math.round((surface.moneyness[c - 1] ?? 0) * 100)}%`} must be a number above 0 and at most ${MAX_VOL_POINTS} % points.`,
                            );
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
        </tbody>
      </table>
      {hidden > 0 ? (
        <p className="px-3 py-2 font-ui text-caption italic text-muted">
          {hidden} expiry {hidden === 1 ? "row" : "rows"} before the valuation date {hidden === 1 ? "is" : "are"} hidden; they stay in the file and are never read by a live leg.
        </p>
      ) : null}
    </div>
  );
}
