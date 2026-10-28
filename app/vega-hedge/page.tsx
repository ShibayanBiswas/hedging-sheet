"use client";

import { Activity, Gauge, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";

import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { FieldRow, NumberInput } from "@/components/ui/fields";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { useDesk } from "@/lib/context/desk-provider";
import { vegaHeadline, vegaHedgeInputs, vegaHedgeMarginTable, vegaHedgePriceTable } from "@/lib/tables";

export default function VegaHedgePage() {
  const { inputs, setInputs } = useDesk();
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Day 1 Vega Hedge"
        subtitle="Listed options are sold so their vega cancels the book's vega, then valued three ways and margined under spot shocks."
      />
      <ResultGate>
        {(r) => {
          const zero = r.dayOneVegaHedge.fair.find((h) => h.move === 0)!;
          const overridden = inputs.hedgeVolOverride != null;
          return (
            <>
              <Panel>
                <SectionTitle icon={Gauge}>Headline</SectionTitle>
                <TableCard spec={vegaHeadline(r)} />
              </Panel>
              <Panel index={1}>
                <SectionTitle icon={SlidersHorizontal} subtitle="The fair volatility defaults to the surface at the hedge strike and expiry. Override it here, then run the simulation again.">
                  Hedge Fair Volatility
                </SectionTitle>
                <FieldRow
                  label="Hedge Fair Volatility"
                  hint={overridden ? "Overridden. Clear the field or reset to return to the surface." : "Using the surface volatility at the hedge strike and expiry."}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <NumberInput
                        kind="percent"
                        digits={2}
                        suffix="%"
                        value={inputs.hedgeVolOverride ?? zero.volatility}
                        onChange={(v) => setInputs({ hedgeVolOverride: v })}
                        onBlankChange={() => setInputs({ hedgeVolOverride: null })}
                        testId="hedge-vol-override"
                      />
                    </div>
                    <span className={overridden ? "hs-overridden-badge" : "hs-chip"} data-testid="hedge-vol-status">
                      {overridden ? "Overridden" : "Surface"}
                    </span>
                    {overridden ? (
                      <button type="button" className="btn-ghost btn-animated" onClick={() => setInputs({ hedgeVolOverride: null })}>
                        Reset To Surface
                      </button>
                    ) : null}
                  </div>
                </FieldRow>
              </Panel>
              <Panel index={2}>
                <SectionTitle icon={Gauge}>Hedge Inputs</SectionTitle>
                <KeyValueCard spec={vegaHedgeInputs(r)} />
              </Panel>
              <Panel index={3}>
                <SectionTitle icon={ShieldCheck}>Margin Computation</SectionTitle>
                <TableCard spec={vegaHedgeMarginTable(r)} />
              </Panel>
              <Panel index={4}>
                <SectionTitle icon={Activity}>Fair Price Computation</SectionTitle>
                <TableCard spec={vegaHedgePriceTable(r, "fair")} />
              </Panel>
              <Panel index={5}>
                <SectionTitle icon={Activity}>Exchange Price Computation</SectionTitle>
                <TableCard spec={vegaHedgePriceTable(r, "exchange")} />
              </Panel>
              <Panel index={6}>
                <SectionTitle icon={Zap}>Stressed Price Computation</SectionTitle>
                <TableCard spec={vegaHedgePriceTable(r, "stressed")} />
              </Panel>
            </>
          );
        }}
      </ResultGate>
    </div>
  );
}
