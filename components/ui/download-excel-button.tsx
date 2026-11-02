"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useDesk } from "@/lib/context/desk-provider";
import { fmtDeskClock } from "@/lib/format";

/** Download every tab as one Excel file. It needs a run that still matches the inputs. */
export function DownloadExcelButton() {
  const { lastRun, staleInputs } = useDesk();
  const { toast } = useDeskDialog();
  const [busy, setBusy] = useState(false);
  const disabled = !lastRun || staleInputs || busy;
  return (
    <button
      type="button"
      data-testid="download-excel"
      disabled={disabled}
      title={!lastRun ? "Run the simulation first" : staleInputs ? "The inputs have changed; run the simulation again" : "Download every tab as one Excel file"}
      className="btn-animated btn-motion btn-ghost btn-compact tab-action"
      onClick={async () => {
        if (!lastRun) return;
        setBusy(true);
        try {
          const { downloadHedgingExcel } = await import("@/lib/excel/excel-runtime");
          toast(`Saved ${await downloadHedgingExcel(lastRun.result, { market: lastRun.market, runAt: fmtDeskClock(new Date(lastRun.at)) })}`);
        } catch {
          toast("The Excel File Could Not Be Built", { variant: "error" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {busy ? <Loader2 className="icon-sm animate-spin" aria-hidden /> : <FileSpreadsheet className="icon-sm" aria-hidden />}
        Download Excel
      </span>
    </button>
  );
}
