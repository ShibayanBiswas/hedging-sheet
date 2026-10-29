import type { Workbook } from "exceljs";

import type { HedgingResult, MarketData } from "@/lib/engine/types";
import { buildDeskExportFilename } from "@/lib/excel/export-filename";

type ExcelJsModule = typeof import("exceljs");

let excelModule: Promise<ExcelJsModule> | null = null;

/** Lazy-load ExcelJS only when a download is requested. */
function loadExcelJS(): Promise<ExcelJsModule> {
  excelModule ??= import("exceljs");
  return excelModule;
}

async function createWorkbook(): Promise<Workbook> {
  const mod = await loadExcelJS();
  const candidate = (mod as ExcelJsModule & { default?: ExcelJsModule }).default ?? mod;
  const Ctor = (candidate as unknown as { Workbook: new () => Workbook }).Workbook;
  const wb = new Ctor();
  wb.creator = "Hedging Sheet · Anand Rathi Wealth";
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

export function hedgingExportFilename(result: HedgingResult): string {
  return buildDeskExportFilename({
    screen: "Hedging-Sheet",
    id: result.underlyingLabel,
    asOf: result.inputs.valuationDate,
    extension: "xlsx",
  });
}

/** Build the five sheet workbook in the browser and start the download. */
export async function downloadHedgingExcel(result: HedgingResult): Promise<string> {
  const [{ buildHedgingExcel }, { fetchBrandLogoBase64 }] = await Promise.all([
    import("@/lib/excel/build-hedging-excel"),
    import("@/lib/excel/export-branding"),
  ]);
  const wb = await createWorkbook();
  const logo = await fetchBrandLogoBase64();
  buildHedgingExcel(wb, result, logo);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const name = hedgingExportFilename(result);
  saveBlob(blob, name);
  return name;
}

/** The active vol surface in the upload layout, so the desk can edit it offline and upload it back. */
export async function downloadSurfaceFile(market: MarketData, asOf: string, premiumRate: number): Promise<string> {
  const [{ buildSurfaceFile, surfaceFileName }, { fetchBrandLogoBase64 }] = await Promise.all([
    import("@/lib/excel/build-surface-file"),
    import("@/lib/excel/export-branding"),
  ]);
  const wb = await createWorkbook();
  const logo = await fetchBrandLogoBase64();
  buildSurfaceFile(wb, market.surface, market.params, { logoBase64: logo, asOf, premiumRate });
  const buffer = await wb.xlsx.writeBuffer();
  const name = surfaceFileName(market.surface);
  saveBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
  return name;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
