import { formatDate, isValidYmd } from "@/lib/engine/dates";
import { EXPORT_TABS, tabSpecs, type ExportContext, type ExportTab } from "@/lib/exports/tab-specs";
import { fmtIstTime, fmtNumber } from "@/lib/format";
import { underlyingName } from "@/lib/inputs/draft";
import { specBlocks } from "@/lib/pdf/blocks";
import type { TabPdfProps } from "@/lib/pdf/tab-pdf";

/** Hedging_Sheet_Day_1_Vega_Hedge_28-Oct-2026.pdf: the tab and the Valuation Date. */
export function pdfFileName(tab: ExportTab, valuationDate: string, today: string): string {
  const name = EXPORT_TABS.find((t) => t.id === tab)!.name.replace(/\s+/g, "_");
  return `Hedging_Sheet_${name}_${formatDate(isValidYmd(valuationDate) ? valuationDate : today)}.pdf`;
}

/** Everything the document shows for one tab: the page's tables, a subtitle and the footer with the run time. */
export function tabPdfProps(tab: ExportTab, ctx: ExportContext & { runAt: string | null; now: Date }): TabPdfProps {
  const meta = EXPORT_TABS.find((t) => t.id === tab)!;
  const i = ctx.inputs;
  const valuation = isValidYmd(i.valuationDate) ? formatDate(i.valuationDate) : "-";
  const subtitle = `${underlyingName(i)} · Valuation Date ${valuation} · Spot ${Number.isFinite(i.spot) ? fmtNumber(i.spot, 2) : "-"}`;
  const when = ctx.runAt ? `Run ${fmtIstTime(ctx.runAt)}` : `Generated ${fmtIstTime(ctx.now.toISOString())}`;
  return {
    title: meta.name,
    subtitle,
    footer: `Valuation Date ${valuation} · ${when}`,
    blocks: tabSpecs(tab, ctx).flatMap((spec) => specBlocks(spec)),
  };
}
