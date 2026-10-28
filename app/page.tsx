"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import {
  CostsSection,
  ExpiriesSection,
  ProductTermsSection,
  RatesSection,
  SpreadsSection,
  StrikesSection,
  UnderlyingSection,
  VolatilitySection,
} from "@/components/inputs/input-sections";
import { PageIntro } from "@/components/ui/panel";
import { RunSimulationButton } from "@/components/ui/run-simulation-button";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useDesk } from "@/lib/context/desk-provider";

/** Edge cases that open a blocking popup the moment they appear. Missing live data waits for the run. */
const POPUP_CODES = new Set([
  "strike-order",
  "strike-positive",
  "spread-order",
  "spread-overlap",
  "spread-gap",
  "participation",
  "coupon-unreachable",
  "protection",
  "floor-level",
  "floor-units",
  "spread-count",
  "expiry-order",
  "expiry-maturity",
  "tenor",
]);

function useEdgeCasePopups() {
  const { issues } = useDesk();
  const { alert } = useDeskDialog();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const current = issues.errors.filter((e) => e.code && POPUP_CODES.has(e.code));
    const keys = new Set(current.map((e) => `${e.code}:${e.field}`));
    // Forget fixed issues so they can pop again if they come back.
    for (const k of [...shown.current]) if (!keys.has(k)) shown.current.delete(k);
    const fresh = current.filter((e) => !shown.current.has(`${e.code}:${e.field}`));
    if (!fresh.length) return;
    const id = window.setTimeout(() => {
      const first = fresh[0]!;
      for (const e of fresh) shown.current.add(`${e.code}:${e.field}`);
      alert(first.message, { variant: "error", title: "Please Fix This Input", fix: first.fix });
    }, 900);
    return () => window.clearTimeout(id);
  }, [alert, issues.errors]);
}

export default function InputsPage() {
  const { resetToDefaults } = useDesk();
  const router = useRouter();
  useEdgeCasePopups();

  return (
    <div className="flex w-full flex-col gap-4 pb-28">
      <PageIntro
        title="Inputs"
        subtitle="Set the product and market inputs, then run the simulation. Spot, valuation date and daily volatility load from live data."
        aside={
          <button type="button" className="btn-animated btn-motion btn-accent" onClick={resetToDefaults} data-testid="reset-defaults">
            <span className="btn-shine" aria-hidden />
            <span className="relative z-10 inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset To Defaults
            </span>
          </button>
        }
      />
      <UnderlyingSection index={0} />
      <RatesSection index={1} />
      <ProductTermsSection index={2} />
      <ExpiriesSection index={3} />
      <StrikesSection index={4} />
      <SpreadsSection index={5} />
      <CostsSection index={6} />
      <VolatilitySection index={7} />
      <div className="hs-run-bar">
        <RunSimulationButton onDone={() => router.push("/summary")} />
      </div>
    </div>
  );
}
