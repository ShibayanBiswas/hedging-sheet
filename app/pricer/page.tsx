"use client";

import { Calculator, Gauge, Grid3X3, RotateCcw, Sigma } from "lucide-react";

import { GridCard, KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { useDesk } from "@/lib/context/desk-provider";
import { headlineTable, pricerGrid, pricerHeaderTable, pricerPayoutTable } from "@/lib/tables";

export default function PricerPage() {
  const { inputs, setInputs } = useDesk();
  const overrideCount = Object.keys(inputs.legVolOverrides).length;
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Pricer"
        subtitle="The option book that replicates the payoff. Every leg is priced on the vol surface and the Inbuilt is solved so the three pots reach the target payout."
      />
      <ResultGate>
        {(r) => {
          const h = r.pricer.header;
          return (
            <>
              <Panel>
                <SectionTitle icon={Gauge}>Headline</SectionTitle>
                <TableCard
                  spec={headlineTable("pricer-headline", "Headline", [
                    { label: `Start ${r.underlyingLabel} Level`, value: h.startLevel, kind: "number", digits: 0 },
                    { label: "Actual Inbuilt", value: h.actualInbuilt, kind: "percent" },
                    { label: "Premium in Crore", value: h.premium / 1e7, kind: "crore" },
                    { label: "Maturity Payout in Crore", value: h.payout / 1e7, kind: "crore" },
                    { label: "Achieved Coupon", value: h.achievedCoupon, kind: "percent" },
                    { label: "Delta in Contracts", value: h.delta, kind: "number", digits: 0 },
                    { label: "Internal Rate of Return", value: h.irr, kind: "percent" },
                  ])}
                />
              </Panel>
              <Panel index={1}>
                <SectionTitle icon={Calculator}>Pot Computation</SectionTitle>
                <TableCard spec={pricerHeaderTable(r)} />
              </Panel>
              <Panel index={2}>
                <SectionTitle icon={Sigma}>Payout Construction</SectionTitle>
                <KeyValueCard spec={pricerPayoutTable(r)} />
              </Panel>
              <Panel index={3}>
                <SectionTitle
                  icon={Grid3X3}
                  subtitle="One column per live leg, grouped by strike. Volatility defaults to the surface; type over any cell to override that leg, then run the simulation again."
                  aside={
                    overrideCount ? (
                      <button type="button" className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" onClick={() => setInputs({ legVolOverrides: {} })} data-testid="reset-leg-vols">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset {overrideCount} Volatility {overrideCount === 1 ? "Override" : "Overrides"}
                      </button>
                    ) : null
                  }
                >
                  Leg Grid
                </SectionTitle>
                <GridCard
                  spec={pricerGrid(r)}
                  edit={{
                    rowLabel: "Volatility",
                    onChange: (key, value) =>
                      setInputs((prev) => {
                        const next = { ...prev.legVolOverrides };
                        if (value == null) delete next[key];
                        else next[key] = value;
                        return { legVolOverrides: next };
                      }),
                  }}
                />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
