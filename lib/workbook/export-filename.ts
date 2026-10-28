import { formatDate } from "@/lib/engine/dates";

/** Strip characters that break download filenames on Windows, macOS and browsers. */
function sanitizeExportToken(value: string | undefined | null, fallback = "export"): string {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

/** Desk naming: SP-{Screen}-{Id}-{DD-MMM-YYYY}.{ext} */
export function buildDeskExportFilename(options: { screen: string; id: string; asOf: string; extension: "xlsx" }): string {
  const screen = sanitizeExportToken(options.screen, "Desk");
  const id = sanitizeExportToken(options.id, "product");
  const stamp = sanitizeExportToken(formatDate(options.asOf), "date");
  return `SP-${screen}-${id}-${stamp}.${options.extension}`;
}
