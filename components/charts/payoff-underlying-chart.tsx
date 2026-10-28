"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Area, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { clientReturn, deriveTerms } from "@/lib/engine/structure";
import type { HedgingResult } from "@/lib/engine/types";
import { fmtNumber, fmtPercent } from "@/lib/format";

const PAYOFF = "#b8860b";
const UNDERLYING = "#7a1e2c";

type TooltipRow = { name?: string; value?: number; color?: string; dataKey?: string };

function PayoffTooltip({ active, payload, label, underlying }: { active?: boolean; payload?: TooltipRow[]; label?: number | string; underlying: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip chart-tooltip-animated whitespace-nowrap">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-dark">
        {underlying} Move {fmtPercent(Number(label), 1)}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-1 font-ui text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.dataKey === "level" ? fmtNumber(entry.value ?? 0, 0) : fmtPercent(entry.value ?? 0, 2)}
        </p>
      ))}
    </div>
  );
}

/** Payoff and underlying chart in the Primary SP Dashboard style: gradient payoff area, kink markers, protection band. */
export function PayoffUnderlyingChart({ result }: { result: HedgingResult }) {
  const reduce = useReducedMotion();
  const inputs = result.inputs;
  const start = result.structure.startLevel;
  const u = result.underlyingLabel;
  const terms = useMemo(() => deriveTerms(inputs), [inputs]);
  const [moveText, setMoveText] = useState("0");
  const move = Number.isFinite(Number.parseFloat(moveText)) ? Number.parseFloat(moveText) / 100 : 0;

  const data = useMemo(() => {
    const top = Math.max(terms.target + 0.2, 0.3);
    const points = new Set<number>();
    for (let x = -0.6; x <= top + 1e-9; x += 0.005) points.add(Math.round(x * 10000) / 10000);
    for (const s of result.structure.strikes) points.add(Math.round((s.percent / 100 - 1) * 10000) / 10000);
    points.add(Math.round((-terms.protection - 0.0001) * 10000) / 10000);
    return [...points]
      .sort((a, b) => a - b)
      .map((z) => ({ z, payoff: clientReturn(inputs, z), level: start * (1 + z) }));
  }, [inputs, result.structure.strikes, start, terms]);

  const kinks = useMemo(
    () => result.structure.strikes.map((s) => s.percent / 100 - 1).filter((z) => z >= -0.6),
    [result.structure.strikes],
  );

  return (
    <div className="flex w-full flex-col gap-3" data-testid="payoff-chart">
      <div className="grid w-full gap-2 sm:grid-cols-3">
        <div>
          <p className="label-chip mb-1.5">{u} Move %</p>
          <div className="relative">
            <input
              className="hs-input w-full pr-8"
              inputMode="decimal"
              value={moveText}
              aria-label={`${u} Move %`}
              data-testid="payoff-move"
              onChange={(e) => {
                if (e.target.value === "" || /^-?\d*\.?\d*$/.test(e.target.value)) setMoveText(e.target.value);
              }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-ui text-sm font-semibold text-muted">%</span>
          </div>
        </div>
        <div>
          <p className="label-chip mb-1.5">{u} Level</p>
          <p className="hs-output" data-testid="payoff-level">{fmtNumber(start * (1 + move), 0)}</p>
        </div>
        <div>
          <p className="label-chip mb-1.5">Client Return</p>
          <p className="hs-output" data-testid="payoff-return">{fmtPercent(clientReturn(inputs, move))}</p>
        </div>
      </div>
      <div className="chart-shell w-full p-2">
        <div className="chart-plot-surface h-[min(52vh,420px)] min-h-[300px] w-full rounded-2xl">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 58, left: 20, bottom: 36 }}>
              <defs>
                <linearGradient id="hsPayoffGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={PAYOFF} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={PAYOFF} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <ReferenceArea
                x1={-terms.protection}
                x2={0}
                yAxisId="payoff"
                fill="#10b981"
                fillOpacity={0.08}
                stroke="#10b981"
                strokeOpacity={0.25}
                label={{ value: "Protection", position: "insideTop", fill: "#047857", fontSize: 10, fontWeight: 600 }}
              />
              <ReferenceLine y={0} yAxisId="payoff" stroke="var(--ar-chart-border)" strokeDasharray="4 4" />
              <ReferenceLine x={move} yAxisId="payoff" stroke={UNDERLYING} strokeOpacity={0.5} strokeDasharray="4 4" />
              <XAxis
                dataKey="z"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v: number) => fmtPercent(v, 0)}
                stroke="var(--ar-chart-tick)"
                tick={{ fontSize: 10 }}
                label={{ value: `${u} Performance`, position: "insideBottom", offset: -18, fill: "var(--ar-chart-tick)", fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                yAxisId="payoff"
                tickFormatter={(v: number) => fmtPercent(v, 0)}
                stroke={PAYOFF}
                tick={{ fontSize: 10, fill: PAYOFF }}
                width={58}
                label={{ value: "Client Return", angle: -90, position: "insideLeft", fill: PAYOFF, fontSize: 10, fontWeight: 600 }}
              />
              <YAxis
                yAxisId="level"
                orientation="right"
                tickFormatter={(v: number) => fmtNumber(v, 0)}
                stroke={UNDERLYING}
                tick={{ fontSize: 10, fill: UNDERLYING }}
                width={64}
                label={{ value: `${u} Level`, angle: 90, position: "insideRight", fill: UNDERLYING, fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip content={<PayoffTooltip underlying={u} />} cursor={{ stroke: "var(--ar-chart-border)" }} isAnimationActive={false} />
              {kinks.map((z) => (
                <ReferenceDot key={z} x={z} y={clientReturn(inputs, z)} yAxisId="payoff" r={5} fill={PAYOFF} stroke="#fff" strokeWidth={2} />
              ))}
              <Area
                yAxisId="payoff"
                type="linear"
                dataKey="payoff"
                name="Client Return"
                stroke={PAYOFF}
                strokeWidth={2.5}
                fill="url(#hsPayoffGradient)"
                isAnimationActive={!reduce}
                animationDuration={900}
                activeDot={{ r: 5, fill: PAYOFF, stroke: "#fff", strokeWidth: 2 }}
              />
              <Line
                yAxisId="level"
                type="linear"
                dataKey="level"
                name={`${u} Level`}
                stroke={UNDERLYING}
                strokeWidth={2}
                strokeOpacity={0.75}
                dot={false}
                isAnimationActive={!reduce}
                animationDuration={900}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <motion.div className="flex flex-wrap gap-4 font-ui text-xs text-muted" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-6 rounded-full" style={{ backgroundColor: PAYOFF }} />
          Client Return · Left Axis
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-6 rounded-full" style={{ backgroundColor: UNDERLYING }} />
          {u} Level · Right Axis
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: PAYOFF }} />
          Strikes · Where The Slope Turns
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-emerald-500/20 ring-1 ring-emerald-500/40" />
          Protection Band
        </span>
        <span className="italic">
          Start {u} Level <strong className="not-italic text-ink">{fmtNumber(start, 0)}</strong>
        </span>
      </motion.div>
    </div>
  );
}
