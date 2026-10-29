/** Shared by the scripts that read the reference workbook. App code never imports this file. */
export const REFERENCE_WORKBOOK = "fixtures/reference/reference-workbook.xlsm";

/** The five sheets whose values reach an output. */
export const OUTPUT_SHEETS = ["Summary Sheet", "Pricer", "Product Description", "Day1 Vega Hedge", "MTM & Margin req"] as const;

/** The value a cell saves: a number, a YYYY-MM-DD date or text. Errors and blanks give undefined. */
export function savedValue(raw: unknown): number | string | undefined {
  if (raw == null) return undefined;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string") return raw.trim() ? raw : undefined;
  if (typeof raw === "boolean") return undefined;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if ("result" in o) return savedValue(o.result);
    if ("richText" in o) return (o.richText as Array<{ text: string }>).map((t) => t.text).join("") || undefined;
  }
  return undefined;
}

export function isFormula(raw: unknown): boolean {
  return raw != null && typeof raw === "object" && ("formula" in (raw as object) || "sharedFormula" in (raw as object));
}
