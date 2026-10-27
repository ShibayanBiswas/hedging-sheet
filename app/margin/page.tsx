"use client";

import { BarChart3 } from "lucide-react";

import { TableCard } from "@/components/ui/desk-table";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { marginTable } from "@/lib/tables";

export default function MarginPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Mark to Market and Margin Requirement"
        subtitle="The cash the desk must post as the underlying moves from minus 50 to plus 20 percent: futures margin, cumulative mark to market and option margin."
      />
      <ResultGate>
        {(r, recalculating) => {
          const zero = r.markToMarket.zeroRow;
          const worst = r.markToMarket.worstCase;
          return (
            <>
              <KpiRail
                recalculating={recalculating}
                items={[
                  { label: "Requirement At 0 Percent", value: zero.totalRequirementCr, format: (v) => `${fmtCrore(v)} Cr`, accent: "maroon" },
                  {
                    label: "Worst Case Requirement",
                    value: worst.totalRequirementCr,
                    format: (v) => `${fmtCrore(v)} Cr`,
                    hint: `At a ${fmtPercent(worst.move, 0)} move`,
                  },
                  { label: "Margin Funded In The Pricer", value: r.summary.margin, format: (v) => fmtPercent(v) },
                  { label: "Product Requirement At 0 Percent", value: zero.productRequirementLakh, format: (v) => `${fmtNumber(v, 4)} Lakh` },
                  { label: "Residual Futures At 0 Percent", value: zero.residualFuturesLakh, format: (v) => `${fmtNumber(v, 4)} Lakh` },
                ]}
              />
              <Panel index={0} recalculating={recalculating}>
                <SectionTitle
                  icon={BarChart3}
                  subtitle="The highlighted 0 percent row feeds the Summary margin. The worst case row is shown for reference; the workbook margin uses the 0 percent row."
                >
                  Stress Grid
                </SectionTitle>
                <TableCard spec={marginTable(r)} />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
