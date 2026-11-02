"use client";

import type { ReactNode } from "react";

import { DownloadExcelButton } from "@/components/ui/download-excel-button";
import { DownloadPdfButton } from "@/components/ui/download-pdf-button";
import type { ExportTab } from "@/lib/exports/tab-list";

/**
 * The far right of every tab's heading row, in one order everywhere: anything the tab adds, such as Reset To Defaults,
 * then Download Excel, then Download PDF. On a phone the group wraps to its own row, still right aligned.
 */
export function TabActions({ tab, children }: { tab: ExportTab; children?: ReactNode }) {
  return (
    <div className="tab-actions" role="group" aria-label="Tab Actions" data-testid="tab-actions">
      {children}
      <DownloadExcelButton />
      <DownloadPdfButton tab={tab} />
    </div>
  );
}
