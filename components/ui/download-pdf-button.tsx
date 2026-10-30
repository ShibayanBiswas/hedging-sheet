"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useDesk } from "@/lib/context/desk-provider";
import { istTodayYmd } from "@/lib/engine/dates";
import { EXPORT_TABS, type ExportTab } from "@/lib/exports/tab-specs";
import { cn } from "@/lib/cn";

/** Download the whole tab as a PDF. Output tabs need a current run; Inputs, Market Data and Logic Atlas download any time. */
export function DownloadPdfButton({ tab, className }: { tab: ExportTab; className?: string }) {
  const { inputs, market, lastRun, staleInputs } = useDesk();
  const { toast } = useDeskDialog();
  const [busy, setBusy] = useState(false);
  const meta = EXPORT_TABS.find((t) => t.id === tab)!;
  const run = lastRun && !staleInputs ? lastRun : null;
  const disabled = busy || (meta.needsRun && !run);
  return (
    <button
      type="button"
      data-testid={`download-pdf-${tab}`}
      disabled={disabled}
      title={disabled && !busy ? "Run the simulation first" : `Download ${meta.name} As A PDF`}
      className={cn("btn-animated btn-motion btn-ghost btn-compact inline-flex shrink-0 items-center gap-2", className)}
      onClick={async () => {
        setBusy(true);
        try {
          const [{ createElement }, { pdf }, { TabPdfDocument }, { pdfFileName, tabPdfProps }] = await Promise.all([
            import("react"),
            import("@react-pdf/renderer"),
            import("@/lib/pdf/tab-pdf"),
            import("@/lib/pdf/tab-pdf-props"),
          ]);
          // The page on screen: a current run matches these inputs, and Market Data shows the market as it is now.
          const props = tabPdfProps(tab, { result: run?.result ?? null, inputs, market, runAt: run?.at ?? null, now: new Date() });
          const blob = await pdf(createElement(TabPdfDocument, props)).toBlob();
          const name = pdfFileName(tab, inputs.valuationDate, istTodayYmd());
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
        } catch {
          toast("The PDF Could Not Be Built", { variant: "error" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {busy ? <Loader2 className="icon-sm animate-spin" aria-hidden /> : <FileDown className="icon-sm" aria-hidden />}
        Download PDF
      </span>
    </button>
  );
}
