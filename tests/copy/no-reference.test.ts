import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { totalLossFall } from "@/lib/engine/hedging-sheet";
import { buildHedgingExcel, SHEET_NAMES } from "@/lib/excel/build-hedging-excel";
import { copyViolations } from "@/lib/format/copy-rules";
import { INPUT_MODES } from "@/lib/inputs/draft";
import { INPUT_SECTIONS, requiredFields } from "@/lib/inputs/validate";
import { logicModules } from "@/lib/logic-atlas";
import { NAV_ITEMS } from "@/lib/navigation";
import { outputTables, specCells, specHeaders, specRowLabels } from "@/lib/tables";

import { priced } from "../helpers/fixture";

/** The rule under test: copy never names the spreadsheet the app replaced. */
const referenceHits = (texts: string[]) =>
  texts.flatMap((t) => copyViolations(t, "prose").filter((v) => v.startsWith("names the spreadsheet")).map((v) => `"${t.slice(0, 100)}" ${v}`));

function excelStrings(wb: ExcelJS.Workbook): string[] {
  const out: string[] = [];
  wb.eachSheet((ws) => {
    out.push(ws.name, ws.headerFooter?.oddHeader ?? "", ws.headerFooter?.oddFooter ?? "");
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value as unknown;
        if (typeof v === "string") out.push(v);
        else if (v && typeof v === "object" && "richText" in v) out.push((v as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join(""));
        if (cell.note) out.push(typeof cell.note === "string" ? cell.note : JSON.stringify(cell.note));
      });
    });
  });
  return out.filter(Boolean);
}

/** String literals and JSX text in the page and component sources, without comments, imports or attributes that are not shown. */
function sourceCopy(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) {
        const code = fs
          .readFileSync(full, "utf8")
          .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
          .replace(/^import .*$/gm, "")
          .replace(/\b(className|accept|data-testid|href|src|key|id)=("[^"]*"|\{[^}]*\})/g, "");
        for (const m of code.matchAll(/"([^"\n]{3,})"|'([^'\n]{3,})'|`([^`]{3,})`|>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
          out.push((m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim());
        }
      }
    }
  };
  walk("app");
  walk("components");
  return out.filter(Boolean);
}

describe("no copy names the spreadsheet the app replaced", () => {
  const r = priced();

  it("flags the reference wording it must catch", () => {
    const bad = ["The Workbook Total", "As The Sheet Does", "Source Sheet And Row", "Macro2 Goal Seek", "Pricer!B19", "the xlsm file", "Approval copy"];
    expect(referenceHits(bad)).toHaveLength(bad.length);
    expect(referenceHits(["Hedging Sheet", "Summary Sheet", "Term Sheet", "Download The Excel File"])).toEqual([]);
  });

  it("output tables: titles, headers, row labels, notes and cells", () => {
    const texts = Object.values(outputTables(r))
      .flat()
      .flatMap((spec) => [spec.title, spec.note ?? "", ...specHeaders(spec).flat(), ...specRowLabels(spec), ...specCells(spec).map((c) => c.text)]);
    expect(referenceHits(texts)).toEqual([]);
  });

  it("Logic Atlas: every title, description, formula, insight, output and edge case", () => {
    const texts = logicModules("Sensex", "Thursday").flatMap((m) => [
      m.title,
      m.subtitle,
      m.description,
      ...m.metrics.flatMap((x) => [x.label, x.value]),
      ...m.nodes.flatMap((n) => [n.label, n.description]),
      ...m.formulas.flatMap((f) => [f.name, f.words, f.inputs, f.output, f.value(r)]),
      ...m.outputs.flatMap((o) => [o.label, o.value(r)]),
      ...m.insights(null),
      ...m.insights(r),
      ...m.edgeCases,
    ]);
    expect(referenceHits(texts)).toEqual([]);
  });

  it("the five tab Excel file: sheet names, every text cell, notes, headers and footers", () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, r, null);
    const texts = excelStrings(wb);
    expect(texts.length).toBeGreaterThan(200);
    expect(referenceHits(texts)).toEqual([]);
  });

  it("navigation, modes, sections, sheet names and validation messages", () => {
    const loss = priced({ floorUnits: 0, decay: 1.9 });
    expect(totalLossFall(loss.inputs)).not.toBeNull();
    const texts = [
      ...NAV_ITEMS.map((n) => n.label),
      ...INPUT_MODES.flatMap((m) => [m.label, m.subtitle]),
      ...INPUT_SECTIONS,
      ...SHEET_NAMES,
      ...requiredFields(12, 4).flatMap((e) => [e.label, e.message, e.fix ?? ""]),
      ...loss.warnings.flatMap((w) => [w.message, w.fix ?? ""]),
    ];
    expect(referenceHits(texts)).toEqual([]);
  });

  it("text removed after the live audit stays removed: F1 to F6", () => {
    const removed = [
      "Strikes as a % of the start level, highest first",
      "Units are the change in slope",
      "Protection Outflow Step",
      "Spreads And Option Type",
      "30.5",
      "Computation Primitives",
      "Source Sheet And Row",
      "Workbook Seed",
      "Workbook Defaults",
    ];
    const atlas = logicModules("Sensex", "Thursday").flatMap((m) => [m.title, m.subtitle, m.description, ...m.nodes.map((n) => n.description), ...m.formulas.map((f) => f.words), ...m.edgeCases]);
    const texts = [...sourceCopy(), ...atlas];
    expect(removed.filter((phrase) => texts.some((t) => t.includes(phrase)))).toEqual([]);
  });

  it("text written in the page and component sources", () => {
    const texts = sourceCopy();
    expect(texts.length).toBeGreaterThan(300);
    expect(referenceHits(texts)).toEqual([]);
  });
});
