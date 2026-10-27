"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/engine/dates";
import type { VolSurface } from "@/lib/engine/types";
import { fmtNumber } from "@/lib/format";

function heat(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || max <= min) return "transparent";
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  // Gold for low vols through maroon for high vols, kept faint so text stays readable.
  const alpha = 0.08 + 0.32 * t;
  const hue = t < 0.5 ? `rgba(212, 178, 76, ${alpha})` : `rgba(122, 30, 44, ${alpha * 0.85})`;
  return hue;
}

export function VolSurfaceGrid({
  surface,
  editing,
  draft,
  onCellChange,
}: {
  surface: VolSurface;
  editing: boolean;
  draft: number[][];
  onCellChange: (row: number, col: number, value: number) => void;
}) {
  const { min, max } = useMemo(() => {
    const all = surface.volsPercent.flat().filter((v) => Number.isFinite(v));
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [surface]);
  const nifty = surface.referenceUnderlyingPrice;
  const sensex = surface.referenceSensexPrice;

  return (
    <div className="desk-table-scroll desk-table-scroll--book" data-testid="vol-grid">
      <table className="data-table-premium vol-grid">
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
          {[
            { label: "Nifty Strikes", ref: nifty },
            { label: "Sensex Strikes", ref: sensex },
          ].map((row) => (
            <tr key={row.label} className="data-table-row-alt">
              <td className="col-pinned font-semibold">{row.label}</td>
              <td className="text-right">500</td>
              {surface.moneyness.map((m) => (
                <td key={m} className="text-right" title={row.ref ? undefined : "No reference price for this underlying"}>
                  {row.ref ? fmtNumber(m * row.ref, 2) : "-"}
                </td>
              ))}
            </tr>
          ))}
          {surface.expiries.map((expiry, r) => (
            <tr key={expiry}>
              <td className="col-pinned font-semibold">{formatDate(expiry)}</td>
              {(editing ? draft[r] ?? [] : surface.volsPercent[r] ?? []).map((v, c) => (
                <td
                  key={c}
                  className={cn("hs-heat text-right", editing && "p-1")}
                  style={{ background: editing ? undefined : heat(v, min, max) }}
                >
                  {editing ? (
                    <input
                      className="w-20 rounded-lg border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-2 py-1 text-right font-ui text-xs tabular-nums outline-none focus:border-gold"
                      inputMode="decimal"
                      defaultValue={v.toFixed(2)}
                      aria-label={`Volatility for ${formatDate(expiry)} column ${c + 1}`}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && e.target.value.trim()) onCellChange(r, c, n);
                      }}
                    />
                  ) : (
                    fmtNumber(v, 2)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
