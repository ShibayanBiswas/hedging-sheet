"use client";

import { BookOpenText, ChartLine, Coins, FileText, Gauge, Landmark, Sigma } from "lucide-react";

import { PayoffChart } from "@/components/charts/payoff-chart";
import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { formatDate } from "@/lib/engine/dates";
import { deriveTerms } from "@/lib/engine/structure";
import type { HedgingResult } from "@/lib/engine/types";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { headlineTable, optionTypeLabel, productTables, type KeyValueSpec } from "@/lib/tables";

function termSheet(r: HedgingResult): KeyValueSpec {
  const i = r.inputs;
  const u = r.underlyingLabel;
  const terms = deriveTerms(i);
  const items: KeyValueSpec["items"] = [
    { label: "Underlying", value: u, kind: "text" },
    { label: "Notional", value: `${fmtCrore(i.notionalCr)} Crore`, kind: "text" },
    { label: "Trade Date", value: i.valuationDate, kind: "date" },
    { label: "Maturity Date", value: r.schedule.maturityDate, kind: "date" },
    { label: "Tenor", value: `${fmtNumber(i.tenorDays, 0)} Days`, kind: "text" },
    { label: `Start ${u} Level`, value: r.structure.startLevel, kind: "number", digits: 0 },
    { label: "Maximum Coupon", value: i.coupon, kind: "percent" },
    { label: `Target ${u} Rise`, value: terms.target, kind: "percent", digits: 0 },
  ];
  terms.spreads.forEach((s, j) => {
    items.push({
      label: `Spread ${j + 1}`,
      value: `${fmtPercent(s.buy, 0)} To ${fmtPercent(s.sell, 0)} At ${fmtNumber(s.participation, 2)} Times`,
      kind: "text",
    });
  });
  items.push(
    { label: "Capital Protection", value: `Down To Minus ${fmtPercent(terms.protection, 0)}`, kind: "text" },
    { label: "Downside Decay", value: `${fmtNumber(i.decay, 2)} Times Below Protection`, kind: "text" },
    { label: "Decay Floor", value: `${fmtPercent(terms.floorLevel, 0)} Of Start Level`, kind: "text" },
    { label: "Option Type", value: optionTypeLabel(i.optionType), kind: "text" },
    { label: "Observation Expiries", value: r.schedule.expiries.map((d) => formatDate(d)).join(", "), kind: "text" },
    { label: "Client Internal Rate of Return", value: r.productDescription.irr, kind: "percent" },
  );
  return { id: "pd-term-sheet", title: "Term Sheet", items };
}

export default function ProductPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Product Description" subtitle="A term sheet generated from the inputs, the accelerator pots, and the payoff at every level." />
      <ResultGate>
        {(r) => {
          const pd = productTables(r);
          return (
            <>
              <Panel>
                <SectionTitle icon={Gauge}>Headline</SectionTitle>
                <TableCard
                  spec={headlineTable("product-headline", "Headline", [
                    { label: "Maturity Value in Crore", value: r.productDescription.maturityCr, kind: "crore" },
                    { label: "Internal Rate of Return", value: r.productDescription.irr, kind: "percent" },
                    { label: "Amount With NBFC in Crore", value: r.productDescription.nbfcCr, kind: "crore" },
                    { label: "Premium in Crore", value: r.productDescription.premiumCr, kind: "crore" },
                    { label: "Margin in Crore", value: r.productDescription.marginCr, kind: "crore" },
                  ])}
                />
              </Panel>
              <Panel index={1}>
                <SectionTitle icon={FileText} subtitle={r.productDescription.title}>
                  Term Sheet
                </SectionTitle>
                <KeyValueCard spec={termSheet(r)} />
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
                <p className="mt-2 font-ui text-xs italic text-muted">
                  Vega hedge done using the {fmtNumber(r.summary.hedgeStrike, 0)} {optionTypeLabel(r.inputs.optionType)} expiring {formatDate(r.summary.hedgeExpiry)}.
                </p>
              </Panel>
              <Panel index={5}>
                <SectionTitle icon={Landmark}>{pd.rates.title}</SectionTitle>
                <KeyValueCard spec={pd.rates} />
              </Panel>
              <Panel index={6}>
                <SectionTitle icon={ChartLine}>Payoff Chart</SectionTitle>
                <PayoffChart inputs={r.inputs} />
              </Panel>
              <Panel index={7}>
                <SectionTitle icon={BookOpenText} subtitle="Levels are generated from every strike, the protection step, zero, and every 5 percent in between.">
                  {pd.payoff.title}
                </SectionTitle>
                <TableCard spec={pd.payoff} />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
