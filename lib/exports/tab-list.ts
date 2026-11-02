/**
 * Every tab of the app, in tab order: the Excel file has one sheet each and every tab offers a PDF.
 * Apart from lib/exports/tab-specs.ts so the buttons on every page do not pull in the export tables on first load.
 */
export const EXPORT_TABS = [
  { id: "inputs", name: "Inputs", needsRun: false },
  { id: "summary", name: "Summary Sheet", needsRun: true },
  { id: "pricer", name: "Pricer", needsRun: true },
  { id: "product", name: "Product Description", needsRun: true },
  { id: "vega-hedge", name: "Day 1 Vega Hedge", needsRun: true },
  { id: "margin", name: "Mark To Market", needsRun: true },
  { id: "market-data", name: "Market Data", needsRun: false },
  { id: "logic-atlas", name: "Logic Atlas", needsRun: false },
] as const;

export type ExportTab = (typeof EXPORT_TABS)[number]["id"];
