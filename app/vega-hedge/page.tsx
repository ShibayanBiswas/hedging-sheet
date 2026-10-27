"use client";

import { Activity, Gauge, ShieldCheck, Zap } from "lucide-react";

import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { vegaHedgeInputs, vegaHedgeMarginTable, vegaHedgePriceTable } from "@/lib/tables";

export default function VegaHedgePage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Day 1 Vega Hedge"
        subtitle="Listed puts are sold so their vega cancels the book's vega, then valued three ways and margined under spot shocks."
      />
      <ResultGate>
        {(r, recalculating) => {
          const zero = r.dayOneVegaHedge.fair.find((h) => h.move === 0)!;
          const zeroMargin = r.dayOneVegaHedge.margin.find((m) => m.move === 0)!;
          return (
            <>
              <KpiRail
                recalculating={recalculating}
                items={[
                  { label: "Hedge Quantity", value: r.dayOneVegaHedge.quantity, format: (v) => fmtNumber(v, 2), accent: "maroon" },
                  { label: "Day 1 Fair Price", value: zero.price, format: (v) => fmtNumber(v, 2) },
                  { label: "Hedge Delta", value: zero.delta, format: (v) => fmtNumber(v, 5) },
                  { label: "Hedge Vega", value: zero.vega, format: (v) => fmtNumber(v, 4) },
                  { label: "Fair Volatility", value: zero.volatility, format: (v) => fmtPercent(v) },
                  { label: "Premium Received", value: r.summary.hedgePremiumCr, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Total Margin At 0 Percent", value: zeroMargin.totalMarginCr, format: (v) => `${fmtCrore(v)} Cr` },
                ]}
              />
              <Panel index={0} recalculating={recalculating}>
                <SectionTitle icon={Gauge}>Hedge Inputs</SectionTitle>
                <KeyValueCard spec={vegaHedgeInputs(r)} />
              </Panel>
              <Panel index={1} recalculating={recalculating}>
                <SectionTitle icon={ShieldCheck}>Margin Computation</SectionTitle>
                <TableCard spec={vegaHedgeMarginTable(r)} />
              </Panel>
              <Panel index={2} recalculating={recalculating}>
                <SectionTitle icon={Activity}>Fair Price Computation</SectionTitle>
                <TableCard spec={vegaHedgePriceTable(r, "fair")} />
              </Panel>
              <Panel index={3} recalculating={recalculating}>
                <SectionTitle icon={Activity}>Exchange Price Computation</SectionTitle>
                <TableCard spec={vegaHedgePriceTable(r, "exchange")} />
              </Panel>
              <Panel index={4} recalculating={recalculating}>
                <SectionTitle icon={Zap}>Stressed Price Computation</SectionTitle>
                <TableCard spec={vegaHedgePriceTable(r, "stressed")} />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
