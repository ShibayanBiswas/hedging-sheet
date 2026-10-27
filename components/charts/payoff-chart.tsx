"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { clientReturn, effectiveSpreads, resolveParticipations } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";
import { fmtPercent } from "@/lib/format";

export function PayoffChart({ inputs }: { inputs: HedgeInputs }) {
  const reduce = useReducedMotion();
  const data = useMemo(() => {
    const parts = resolveParticipations({ ...inputs, spreads: effectiveSpreads(inputs) });
    const top = Math.max(inputs.target + 0.15, 0.2);
    const points = new Set<number>();
    for (let x = -0.6; x <= top + 1e-9; x += 0.005) points.add(Math.round(x * 10000) / 10000);
    points.add(-inputs.protection);
    points.add(Math.round((-inputs.protection - 0.0001) * 10000) / 10000);
    return [...points]
      .sort((a, b) => a - b)
      .map((p) => ({ performance: p, value: clientReturn(inputs, parts, p) }));
  }, [inputs]);

  return (
    <div className="chart-stage h-[340px] w-full" data-testid="payoff-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ar-chart-border)" />
          <XAxis
            dataKey="performance"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => fmtPercent(v, 0)}
            stroke="var(--ar-chart-tick)"
            tick={{ fontSize: 11 }}
          />
          <YAxis tickFormatter={(v: number) => fmtPercent(v, 0)} stroke="var(--ar-chart-tick)" tick={{ fontSize: 11 }} width={64} />
          <ReferenceLine y={0} stroke="var(--ar-chart-border)" />
          <ReferenceLine x={0} stroke="var(--ar-chart-border)" />
          <Tooltip
            wrapperClassName="chart-tooltip-animated"
            contentStyle={{
              background: "var(--ar-surface)",
              border: "1px solid rgba(212,178,76,0.35)",
              borderRadius: 14,
              fontFamily: "var(--font-sans)",
              fontSize: 12,
            }}
            labelFormatter={(v) => `${inputs.underlying} Performance ${fmtPercent(Number(v))}`}
            formatter={(v) => [fmtPercent(Number(v)), "Client Return"]}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke="#b8860b"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={!reduce}
            animationDuration={900}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
