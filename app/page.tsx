"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eraser, RotateCcw } from "lucide-react";

import { InputGroups } from "@/components/inputs/input-sections";
import { InputModeSwitch } from "@/components/inputs/input-mode-switch";
import { DownloadPdfButton } from "@/components/ui/download-pdf-button";
import { RunSimulationButton } from "@/components/ui/run-simulation-button";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { focusField, useDesk } from "@/lib/context/desk-provider";
import { INLINE_ONLY_CODES } from "@/lib/validation/inputRules";

/** Rules across fields open a popup the moment a typed value breaks them. Empty fields wait for Run Simulation. */
function useEdgeCasePopups() {
  const { fieldErrors } = useDesk();
  const { alert } = useDeskDialog();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const current = fieldErrors.filter((e) => e.kind === "invalid" && e.code && !INLINE_ONLY_CODES.has(e.code));
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
  const { mode, resetInputs, staleInputs } = useDesk();
  const router = useRouter();
  useEdgeCasePopups();

  return (
    // The Run bar sits flush on the page's bottom edge: the negative margin takes back the main padding below it.
    <div className="-mb-6 flex w-full flex-col gap-2">
      <div className="inputs-intro">
        <h1 className="font-bold tracking-tight text-ink text-h1">Inputs</h1>
        <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:max-w-md sm:flex-1">
          <InputModeSwitch />
        </div>
        <DownloadPdfButton tab="inputs" className="ml-auto sm:ml-0" />
        <button type="button" className="btn-animated btn-motion btn-ghost btn-compact" onClick={resetInputs} data-testid="reset-inputs">
          <span className="relative z-10 inline-flex items-center gap-2">
            {mode === "default" ? <RotateCcw className="icon-sm" /> : <Eraser className="icon-sm" />}
            {mode === "default" ? "Reset To Defaults" : "Clear All Inputs"}
          </span>
        </button>
      </div>
      <InputGroups />
      <div className="hs-run-bar">
        {staleInputs ? (
          <span className="hs-chip hs-chip-maroon shrink-0" data-testid="stale-chip">
            Inputs Changed · Run Again
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <RunSimulationButton slim onDone={() => router.push("/summary")} />
        </div>
      </div>
    </div>
  );
}
