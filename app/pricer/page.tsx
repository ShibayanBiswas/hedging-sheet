"use client";

import { Calculator, Grid3X3, Sigma } from "lucide-react";

import { GridCard, KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { pricerGrid, pricerHeaderTable, pricerPayoutTable } from "@/lib/tables";

export default function PricerPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Pricer"
        subtitle="The option book that replicates the payoff. Every leg is priced on the vol surface and the Inbuilt is solved so the three pots reach the target payout."
      />
      <ResultGate>
        {(r, recalculating) => {
          const h = r.pricer.header;
          return (
            <>
              <KpiRail
                recalculating={recalculating}
                items={[
                  { label: `Start ${r.underlyingLabel} Level`, value: h.startLevel, format: (v) => fmtNumber(v, 0) },
                  { label: "Actual Inbuilt", value: h.actualInbuilt, format: (v) => fmtPercent(v), accent: "maroon" },
                  { label: "Premium", value: h.premium / 1e7, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Maturity Payout", value: h.payout / 1e7, format: (v) => `${fmtCrore(v)} Cr` },
                  { label: "Achieved Coupon", value: h.achievedCoupon, format: (v) => fmtPercent(v) },
                  { label: "Delta in Contracts", value: h.delta, format: (v) => fmtNumber(v, 0) },
                  { label: "Internal Rate of Return", value: h.irr, format: (v) => fmtPercent(v) },
                ]}
              />
              <Panel index={0} recalculating={recalculating}>
                <SectionTitle icon={Calculator}>Pot Computation</SectionTitle>
                <TableCard spec={pricerHeaderTable(r)} />
              </Panel>
              <Panel index={1} recalculating={recalculating}>
                <SectionTitle icon={Sigma}>Payout Construction</SectionTitle>
                <KeyValueCard spec={pricerPayoutTable(r)} />
              </Panel>
              <Panel index={2} recalculating={recalculating}>
                <SectionTitle icon={Grid3X3} subtitle="One column per live leg, grouped by strike. Rows follow the workbook order.">
                  Leg Grid
                </SectionTitle>
                <GridCard spec={pricerGrid(r)} />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
