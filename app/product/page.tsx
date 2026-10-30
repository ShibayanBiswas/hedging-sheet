"use client";

import { BookOpenText, ChartLine, Coins, FileText, Gauge, Landmark, Percent, Sigma } from "lucide-react";

import { PayoffUnderlyingChart } from "@/components/charts/payoff-underlying-chart";
import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { PayoffScenariosTable } from "@/components/ui/payoff-scenarios-table";
import { ResultGate } from "@/components/ui/result-gate";
import { productHeadline, productTables } from "@/lib/tables";

export default function ProductPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro tab="product" title="Product Description" subtitle="A term sheet generated from the inputs, the three pots, the Greeks and the payoff at every level." />
      <ResultGate>
        {(r) => {
          const pd = productTables(r);
          return (
            <>
              <Panel>
                <SectionTitle icon={Gauge}>Headline</SectionTitle>
                <TableCard spec={productHeadline(r)} />
              </Panel>
              <Panel index={1}>
                <SectionTitle icon={FileText} subtitle={r.productDescription.title}>
                  Term Sheet
                </SectionTitle>
                <KeyValueCard spec={pd.termSheet} />
              </Panel>
              <Panel index={2}>
                <SectionTitle icon={Coins}>{pd.details.title}</SectionTitle>
                <KeyValueCard spec={pd.details} />
              </Panel>
              <Panel index={3}>
                <SectionTitle icon={Landmark}>{pd.maturity.title}</SectionTitle>
                <KeyValueCard spec={pd.maturity} />
              </Panel>
              <Panel index={4}>
                <SectionTitle icon={Sigma}>{pd.greeks.title}</SectionTitle>
                <KeyValueCard spec={pd.greeks} />
              </Panel>
              <Panel index={5}>
                <SectionTitle icon={Percent}>{pd.rates.title}</SectionTitle>
                <KeyValueCard spec={pd.rates} />
              </Panel>
              <Panel index={6}>
                <SectionTitle icon={ChartLine} subtitle="Type a move to read the level and the client return at that point.">
                  Payoff And {r.underlyingLabel}
                </SectionTitle>
                <PayoffUnderlyingChart result={r} />
              </Panel>
              <Panel index={7}>
                <SectionTitle icon={BookOpenText}>{pd.payoff.title}</SectionTitle>
                <PayoffScenariosTable result={r} />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
