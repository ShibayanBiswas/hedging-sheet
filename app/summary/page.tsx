"use client";

import { Gauge, LayoutDashboard } from "lucide-react";

import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { headlineTable, summaryTables } from "@/lib/tables";

export default function SummaryPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Summary Sheet" subtitle="Terms, the solved Inbuilt, Greeks, the option legs and the vega hedge." />
      <ResultGate>
        {(r) => {
          const s = r.summary;
          return (
            <>
              <Panel>
                <SectionTitle icon={Gauge}>Headline</SectionTitle>
                <TableCard
                  spec={headlineTable("summary-headline", "Headline", [
                    { label: "Actual Inbuilt", value: s.actualInbuilt, kind: "percent" },
                    { label: "Option Premium in Crore", value: s.totalPremiumCr, kind: "crore" },
                    { label: "Maturity Payout in Crore", value: r.productDescription.maturityCr, kind: "crore" },
                    { label: "Margin Requirement", value: s.margin, kind: "percent" },
                    { label: "Hedge Quantity", value: r.dayOneVegaHedge.quantity, kind: "number" },
                    { label: "Net Vega in Crore", value: s.vegaCr, kind: "crore" },
                    { label: "Net Delta", value: s.deltaContracts, kind: "number", digits: 0 },
                    { label: "Internal Rate of Return", value: s.irr, kind: "percent" },
                  ])}
                />
              </Panel>
              {summaryTables(r).blocks.map((block, i) => (
                <Panel key={block.id} index={i + 1}>
                  <SectionTitle icon={LayoutDashboard}>{block.title}</SectionTitle>
                  {"items" in block ? <KeyValueCard spec={block} /> : <TableCard spec={block} />}
                </Panel>
              ))}
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
