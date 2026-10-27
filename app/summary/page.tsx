"use client";

import { LayoutDashboard } from "lucide-react";

import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { IssueList } from "@/components/ui/fields";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { summaryTables } from "@/lib/tables";

export default function SummaryPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Summary Sheet" subtitle="The control panel of the workbook: terms, the solved Inbuilt, Greeks, the option legs and the vega hedge." />
      <ResultGate>
        {(r, recalculating) => {
          const s = r.summary;
          const blocks = summaryTables(r).blocks;
          return (
            <>
              <KpiRail
                recalculating={recalculating}
                items={[
                  { label: "Actual Inbuilt", value: s.actualInbuilt, format: (v) => fmtPercent(v), accent: "maroon" },
                  { label: "Option Premium", value: s.totalPremiumCr, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Maturity Payout", value: r.productDescription.maturityCr, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Margin Requirement", value: s.margin, format: (v) => fmtPercent(v), hint: `${fmtCrore(-r.markToMarket.zeroRow.totalRequirementCr)} Cr at the 0 percent move` },
                  { label: "Hedge Quantity", value: r.dayOneVegaHedge.quantity, format: (v) => fmtNumber(v, 2) },
                  { label: "Net Vega", value: s.vegaCr, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Net Delta", value: s.deltaContracts, format: (v) => fmtNumber(v, 0) },
                  { label: "Internal Rate of Return", value: s.irr, format: (v) => fmtPercent(v) },
                ]}
              />
              <IssueList errors={[]} warnings={r.warnings} />
              {blocks.map((block, i) => (
                <Panel key={block.id} index={i} recalculating={recalculating}>
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
