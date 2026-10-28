"use client";

import { BarChart3, Gauge } from "lucide-react";

import { TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { headlineTable, marginTable } from "@/lib/tables";

export default function MarginPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Mark to Market and Margin Requirement"
        subtitle="The cash the desk must post as the underlying moves from minus 50 to plus 20 percent: futures margin, cumulative mark to market and option margin."
      />
      <ResultGate>
        {(r) => {
          const zero = r.markToMarket.zeroRow;
          const worst = r.markToMarket.worstCase;
          return (
            <>
              <Panel>
                <SectionTitle icon={Gauge}>Headline</SectionTitle>
                <TableCard
                  spec={headlineTable("margin-headline", "Headline", [
                    { label: "Requirement At 0 Percent in Crore", value: zero.totalRequirementCr, kind: "crore" },
                    { label: "Worst Case Requirement in Crore", value: worst.totalRequirementCr, kind: "crore" },
                    { label: "Worst Case Move", value: worst.move, kind: "percent", digits: 0 },
                    { label: "Margin Funded In The Pricer", value: r.summary.margin, kind: "percent" },
                    { label: "Product Requirement At 0 Percent in Lakh", value: zero.productRequirementLakh, kind: "number", digits: 4 },
                    { label: "Residual Futures At 0 Percent in Lakh", value: zero.residualFuturesLakh, kind: "number", digits: 4 },
                  ])}
                />
              </Panel>
              <Panel index={1}>
                <SectionTitle
                  icon={BarChart3}
                  subtitle="The highlighted 0 percent row feeds the Summary margin. Each move reprices the book with the spot bumped, then the bump is reset to zero."
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
