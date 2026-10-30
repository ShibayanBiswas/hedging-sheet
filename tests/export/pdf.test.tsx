import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { EXPORT_TABS } from "@/lib/exports/tab-specs";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import { specBlocks } from "@/lib/pdf/blocks";
import { TabPdfDocument } from "@/lib/pdf/tab-pdf";
import { pdfFileName, tabPdfProps } from "@/lib/pdf/tab-pdf-props";
import { pricerGrid } from "@/lib/tables";

import { priced } from "../helpers/fixture";

const RUN_AT = "2026-10-28T04:30:00.000Z";

async function pdfText(props: Parameters<typeof TabPdfDocument>[0]): Promise<{ text: string; pages: string[] }> {
  const buffer = await renderToBuffer(<TabPdfDocument {...props} />);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return { text: result.text, pages: result.pages.map((p) => p.text) };
}

describe("Download PDF", () => {
  const r = priced();
  const inputs = r.inputs as DeskInputs;
  const ctx = { result: r, inputs, market: seedMarketData(), runAt: RUN_AT, now: new Date(RUN_AT) };

  it("prints every table of the Day 1 Vega Hedge tab with the band, footer and page numbers", async () => {
    const { text, pages } = await pdfText(tabPdfProps("vega-hedge", ctx));
    const wanted = ["Day 1 Vega Hedge", "Anand Rathi Wealth · Hedging Sheet", "Fair Price Computation", "Exchange Price Computation", "Stressed Price Computation", "Margin Computation"];
    expect(wanted.filter((t) => !text.includes(t))).toEqual([]);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, i) => {
      expect(p).toContain(`Page ${i + 1} Of ${pages.length}`);
      expect(p).toContain("Run 10:00 am IST");
    });
    expect(text).not.toMatch(/NaN|Infinity|undefined|¹/);
    // At most 3 decimals in any number.
    expect(text).not.toMatch(/\d\.\d{4,}/);
  });

  it("repeats the header row of a table on every page it spans", async () => {
    const { pages } = await pdfText(tabPdfProps("margin", ctx));
    const head = "Total Margin In Crore";
    const spanned = pages.filter((p) => p.includes("₹") || /\d/.test(p));
    expect(spanned.length).toBeGreaterThan(0);
    for (const p of pages) if (/-\d{2}\.\d{2}%|\d+\.\d{2}%/.test(p)) expect(p).toContain(head);
  });

  it("splits the Pricer grid into blocks of at most 14 columns that repeat the field column", () => {
    const blocks = specBlocks(pricerGrid(r));
    expect(blocks.length).toBeGreaterThan(1);
    for (const b of blocks) {
      expect(b.head[1]!.length).toBeLessThanOrEqual(14);
      expect(b.rows[0]!.cells[0]).toBe(blocks[0]!.rows[0]!.cells[0]);
    }
  });

  it("offers Inputs, Market Data and Logic Atlas before a run, and prints dashes for what is missing", async () => {
    const blank = { result: null, inputs: blankInputs(), market: seedMarketData(), runAt: null, now: new Date(RUN_AT) };
    for (const tab of EXPORT_TABS) expect(tabPdfProps(tab.id, blank).blocks.length > 0, tab.id).toBe(!tab.needsRun);
    const { text } = await pdfText(tabPdfProps("inputs", blank));
    expect(text).toContain("1 Underlying And Market");
    expect(text).toContain("Generated 10:00 am IST");
    expect(text).toContain("Valuation Date -");
  });

  it("names the file by tab and Valuation Date", () => {
    expect(pdfFileName("vega-hedge", "2026-10-28", "2026-10-30")).toBe("Hedging_Sheet_Day_1_Vega_Hedge_28-Oct-2026.pdf");
    expect(pdfFileName("inputs", "", "2026-10-30")).toBe("Hedging_Sheet_Inputs_30-Oct-2026.pdf");
  });
});
