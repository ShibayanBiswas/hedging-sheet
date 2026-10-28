import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isTitleCase, titleCase, titleCaseViolations } from "@/lib/format/title-case";
import { INPUT_MODES } from "@/lib/inputs/draft";
import { INPUT_SECTIONS } from "@/lib/inputs/validate";
import { COMPUTATION_PRIMITIVES, logicModules } from "@/lib/logic-atlas";
import { NAV_ITEMS } from "@/lib/navigation";
import {
  marginHeadline,
  marginTable,
  pricerGrid,
  pricerHeadline,
  pricerPayoutTable,
  pricerPotTable,
  productHeadline,
  productTables,
  summaryHeadline,
  summaryTables,
  vegaHeadline,
  vegaHedgeInputs,
  vegaHedgeMarginTable,
  vegaHedgePriceTable,
  type GridSpec,
  type KeyValueSpec,
  type TableSpec,
} from "@/lib/tables";
import { SHEET_NAMES } from "@/lib/workbook/build-hedging-excel";

import { priced } from "../helpers/fixture";

function expectAll(labels: string[]) {
  const offenders = labels.filter((l) => !isTitleCase(l)).map((l) => `${l} (${titleCaseViolations(l).join(", ")})`);
  expect(offenders).toEqual([]);
}

describe("title case helper", () => {
  it("capitalises every word, joining words included", () => {
    expect(titleCase("mark to market and margin")).toBe("Mark To Market And Margin");
    expect(titleCase("Rate of Return in Crore")).toBe("Rate Of Return In Crore");
  });

  it("allows units, symbols, numbers, dates and tickers", () => {
    for (const ok of ["Premium ₹ Cr", "Requirement At 0%", "137% · 1,05,901", "28-Oct-2026", "Quantity In L", "BSE And NSE", "−50% To +20%", "Day 1"]) {
      expect(isTitleCase(ok), ok).toBe(true);
    }
    expect(titleCaseViolations("Mark to Market")).toEqual(["to"]);
  });
});

describe("label constants", () => {
  const r = priced();

  it("tables: every title, column, row label, corner and strike band", () => {
    const labels: string[] = [];
    const table = (t: TableSpec) => labels.push(t.title, ...t.columns.map((c) => c.label));
    const kv = (t: KeyValueSpec) => labels.push(t.title, ...t.items.map((i) => i.label));
    const grid = (g: GridSpec) => labels.push(g.title, ...g.corner, ...g.groups.map((x) => x.label), ...g.rows.map((x) => x.label));
    [summaryHeadline(r), pricerHeadline(r), productHeadline(r), vegaHeadline(r), marginHeadline(r), marginTable(r), vegaHedgeMarginTable(r)].forEach(table);
    (["fair", "exchange", "stressed"] as const).forEach((b) => table(vegaHedgePriceTable(r, b)));
    for (const block of summaryTables(r)) {
      if ("items" in block) kv(block);
      else table(block);
    }
    [pricerPotTable(r), pricerPayoutTable(r), vegaHedgeInputs(r)].forEach(kv);
    grid(pricerGrid(r));
    const pd = productTables(r);
    [pd.termSheet, pd.details, pd.maturity, pd.greeks, pd.rates].forEach(kv);
    table(pd.payoff);
    expectAll(labels);
  });

  it("Logic Atlas: section titles, card kickers and metrics, flow steps, formula names and primitives", () => {
    const labels: string[] = [];
    for (const m of logicModules("Sensex", "Thursday")) {
      labels.push(m.title, m.subtitle, ...m.metrics.flatMap((x) => [x.label, x.value]), ...m.nodes.map((n) => n.label), ...m.formulas.map((f) => f.name));
    }
    labels.push(...COMPUTATION_PRIMITIVES.flatMap((p) => [p.name, p.category]));
    expectAll(labels);
  });

  it("tabs, modes, input sections and Excel sheet names", () => {
    expectAll([...NAV_ITEMS.map((n) => n.label), ...INPUT_MODES.flatMap((m) => [m.label, m.subtitle]), ...INPUT_SECTIONS, ...SHEET_NAMES]);
  });

  it("section titles, page titles, field labels, headers and headings in the source", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".tsx")) files.push(p);
      }
    };
    walk("app");
    walk("components");
    const found: string[] = [];
    const patterns = [
      /<SectionTitle\b[^>]*>\s*([^<{]+?)\s*<\/SectionTitle>/g,
      /<PageIntro\s+title="([^"]+)"/g,
      /<FieldRow\s+label="([^"]+)"/g,
      /<SubSection\s+title="([^"]+)"/g,
      /<th\b[^>]*>\s*([^<{]+?)\s*<\/th>/g,
      /<h[1-4]\b[^>]*>\s*([^<{]+?)\s*<\/h[1-4]>/g,
      /title:\s*"([^"]+)"/g,
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const re of patterns) for (const m of src.matchAll(re)) found.push(`${m[1]!.trim()}`);
    }
    expect(found.length).toBeGreaterThan(40);
    expectAll(found);
  });
});
