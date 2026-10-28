"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eraser, RotateCcw } from "lucide-react";

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
import { InputModeSwitch } from "@/components/inputs/input-mode-switch";
import { PageIntro } from "@/components/ui/panel";
import { RunSimulationButton } from "@/components/ui/run-simulation-button";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { focusField, useDesk } from "@/lib/context/desk-provider";

/** Rules across fields open a popup the moment a typed value breaks them. Empty fields wait for Run Simulation. */
function useEdgeCasePopups() {
  const { fieldErrors } = useDesk();
  const { alert } = useDeskDialog();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const current = fieldErrors.filter((e) => e.kind === "invalid" && e.code);
    const keys = new Set(current.map((e) => `${e.code}:${e.field}`));
    // Forget fixed issues so they can pop again if they come back.
    for (const k of [...shown.current]) if (!keys.has(k)) shown.current.delete(k);
    const fresh = current.filter((e) => !shown.current.has(`${e.code}:${e.field}`));
    if (!fresh.length) return;
    const id = window.setTimeout(() => {
      const first = fresh[0]!;
      for (const e of fresh) shown.current.add(`${e.code}:${e.field}`);
      const title = first.code === "coupon-unreachable" ? "Coupon Not Reachable" : "Please Fix This Input";
      alert(first.message, { variant: "error", title, fix: first.fix, onClose: () => focusField(first.field) });
    }, 900);
    return () => window.clearTimeout(id);
  }, [alert, fieldErrors]);
}

export default function InputsPage() {
  const { mode, resetInputs } = useDesk();
  const router = useRouter();
  useEdgeCasePopups();

  return (
    <div className="flex w-full flex-col gap-4 pb-16">
      <PageIntro
        title="Inputs"
        subtitle={
          mode === "default"
            ? "Set the product and market inputs, then run the simulation. Spot, valuation date and daily volatility load from live data."
            : "Every field starts empty. Fill each one, or fetch the live spot and volatility, then run the simulation."
        }
        aside={
          <button type="button" className="btn-animated btn-motion btn-accent" onClick={resetInputs} data-testid="reset-inputs">
            <span className="btn-shine" aria-hidden />
            <span className="relative z-10 inline-flex items-center gap-2">
              {mode === "default" ? <RotateCcw className="icon-sm" /> : <Eraser className="icon-sm" />}
              {mode === "default" ? "Reset To Defaults" : "Clear All Inputs"}
            </span>
          </button>
        }
      />
      <InputModeSwitch />
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
