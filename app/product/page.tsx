"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpenText, ChartLine, Coins, FileText, Landmark, Sigma } from "lucide-react";

import { PayoffChart } from "@/components/charts/payoff-chart";
import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { formatDate } from "@/lib/engine/dates";
import type { HedgingResult } from "@/lib/engine/types";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { deskEase } from "@/lib/motion";
import { productTables } from "@/lib/tables";

function termSheet(r: HedgingResult): Array<{ label: string; value: string }> {
  const i = r.inputs;
  const u = r.underlyingLabel;
  const cards = [
    { label: "Underlying", value: u },
    { label: "Notional", value: `${fmtCrore(i.notionalCr)} Crore` },
    { label: "Trade Date", value: formatDate(i.valuationDate) },
    { label: "Maturity Date", value: formatDate(r.schedule.maturityDate) },
    { label: "Tenor", value: `${fmtNumber(i.tenorDays, 0)} Days` },
    { label: `Start ${u} Level`, value: fmtNumber(r.structure.startLevel, 0) },
    { label: "Maximum Coupon", value: fmtPercent(i.coupon) },
    { label: `Target ${u} Rise`, value: fmtPercent(i.target, 0) },
  ];
  r.inputs.spreads.forEach((s, j) => {
    const sell = j === i.spreads.length - 1 ? i.target : s.sell;
    cards.push({
      label: `Spread ${j + 1}`,
      value: `${fmtPercent(s.buy, 0)} To ${fmtPercent(sell, 0)} At ${fmtNumber(r.structure.spreadParticipations[j], 2)} Times`,
    });
  });
  cards.push(
    { label: "Capital Protection", value: `Down To Minus ${fmtPercent(i.protection, 0)}` },
    { label: "Downside Decay", value: `${fmtNumber(i.decay, 2)} Times Below Protection` },
    { label: "Decay Floor", value: `${fmtPercent(i.floorLevel, 0)} Of Start Level` },
    { label: "Observation Expiries", value: `${r.schedule.expiries.length} Dates` },
    { label: "Client Internal Rate of Return", value: fmtPercent(r.productDescription.irr) },
  );
  return cards;
}

export default function ProductPage() {
  const reduce = useReducedMotion();
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Product Description" subtitle="A term sheet generated from the inputs, the accelerator pots, and the payoff at every level." />
      <ResultGate>
        {(r, recalculating) => {
          const pd = productTables(r);
          return (
            <>
              <KpiRail
                recalculating={recalculating}
                items={[
                  { label: "Maturity Value", value: r.productDescription.maturityCr, format: (v) => `${fmtCrore(v)} Cr`, accent: "maroon" },
                  { label: "Internal Rate of Return", value: r.productDescription.irr, format: (v) => fmtPercent(v) },
                  { label: "Amount With NBFC", value: r.productDescription.nbfcCr, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Premium", value: r.productDescription.premiumCr, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Margin", value: r.productDescription.marginCr, format: (v) => `${fmtCrore(v)} Cr` },
                ]}
              />
              <Panel index={0} recalculating={recalculating}>
                <SectionTitle icon={FileText} subtitle={r.productDescription.title}>
                  Term Sheet
                </SectionTitle>
                <div className="horizontal-rail-spec w-full">
                  <div className="horizontal-rail-spec-inner">
                    {termSheet(r).map((card, i) => (
                      <motion.div
                        key={card.label}
                        className="spec-rail-card spec-rail-item"
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.35, ease: deskEase }}
                      >
                        <p className="spec-rail-label">{card.label}</p>
                        <p className="spec-rail-value">{card.value}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Panel>
              <Panel index={1} recalculating={recalculating}>
                <SectionTitle icon={Coins}>{pd.details.title}</SectionTitle>
                <KeyValueCard spec={pd.details} />
              </Panel>
              <Panel index={2} recalculating={recalculating}>
                <SectionTitle icon={Landmark}>{pd.maturity.title}</SectionTitle>
                <KeyValueCard spec={pd.maturity} />
              </Panel>
              <Panel index={3} recalculating={recalculating}>
                <SectionTitle icon={Sigma}>{pd.greeks.title}</SectionTitle>
                <KeyValueCard spec={pd.greeks} />
                <p className="mt-2 font-ui text-xs italic text-muted">
                  Vega hedge done using the {fmtNumber(r.summary.hedgeStrike, 0)} Put expiring {formatDate(r.summary.hedgeExpiry)}.
                </p>
              </Panel>
              <Panel index={4} recalculating={recalculating}>
                <SectionTitle icon={Landmark}>{pd.rates.title}</SectionTitle>
                <KeyValueCard spec={pd.rates} />
              </Panel>
              <Panel index={5} recalculating={recalculating}>
                <SectionTitle icon={ChartLine}>Payoff Chart</SectionTitle>
                <PayoffChart inputs={r.inputs} />
              </Panel>
              <Panel index={6} recalculating={recalculating}>
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
