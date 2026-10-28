"use client";

import { CalendarDays, Coins, Gauge, LayoutDashboard, Layers, ShieldCheck, Sigma, SlidersHorizontal, TrendingUp } from "lucide-react";

import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { summaryHeadline, summaryTables } from "@/lib/tables";

const ICONS: Record<string, typeof Gauge> = {
  "summary-market": TrendingUp,
  "summary-spec": LayoutDashboard,
  "summary-expiries": CalendarDays,
  "summary-greeks": Sigma,
  "summary-costs": Coins,
  "summary-options": Layers,
  "summary-hedge": ShieldCheck,
  "summary-vol": SlidersHorizontal,
};

export default function SummaryPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Summary Sheet" subtitle="Terms, the solved Inbuilt, Greeks, the option legs and the vega hedge." />
      <ResultGate>
        {(r) => (
          <>
            <Panel>
              <SectionTitle icon={Gauge}>Headline</SectionTitle>
              <TableCard spec={summaryHeadline(r)} />
            </Panel>
            {summaryTables(r).map((block, i) => (
              <Panel key={block.id} index={i + 1}>
                <SectionTitle icon={ICONS[block.id] ?? LayoutDashboard}>{block.title}</SectionTitle>
                {"items" in block ? <KeyValueCard spec={block} /> : <TableCard spec={block} />}
              </Panel>
            ))}
          </>
        )}
      </ResultGate>
    </div>
  );
}
