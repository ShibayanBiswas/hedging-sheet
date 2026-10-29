import { describe, expect, it } from "vitest";

import { copyViolations, type CopyKind } from "@/lib/format/copy-rules";
import { isTitleCase } from "@/lib/format/title-case";
import { INPUT_MODES } from "@/lib/inputs/draft";
import { INPUT_SECTIONS, requiredFields, validateDeskInputs } from "@/lib/inputs/validate";
import { logicModules } from "@/lib/logic-atlas";
import { NAV_ITEMS } from "@/lib/navigation";
import { outputTables, specCells, specHeaders, specRowLabels } from "@/lib/tables";
import { SHEET_NAMES } from "@/lib/excel/build-hedging-excel";

import invalid from "../fixtures/invalid-cases.json";
import { blankFillInputs, mockDefaultInputs, priceLikeTheApp } from "../helpers/mock-market";

function offenders(items: Array<[string, CopyKind]>): string[] {
  return items.flatMap(([text, kind]) => copyViolations(text, kind).map((v) => `${kind} "${text}": ${v}`));
}

describe("copy rules on the label constants", () => {
  const r = priceLikeTheApp(mockDefaultInputs());
  const tabs = Object.values(outputTables(r)).flat();

  it("output tables: titles, headers and row labels are labels; notes are prose", () => {
    const items: Array<[string, CopyKind]> = [];
    for (const spec of tabs) {
      items.push([spec.title, "label"], ...specHeaders(spec).flat().map((h): [string, CopyKind] => [h, "label"]));
      items.push(...specRowLabels(spec).filter((l) => !/^[-−]?[\d,.]+%?$/.test(l)).map((l): [string, CopyKind] => [l, "label"]));
      if (spec.note) items.push([spec.note, "prose"]);
    }
    expect(offenders(items)).toEqual([]);
  });

  it('every output cell shows a value or "-", never NaN, Infinity or a blank', () => {
    const items = tabs.flatMap((spec) => specCells(spec).map((c): [string, CopyKind] => [c.text, "cell"]));
    expect(items.length).toBeGreaterThan(3000);
    expect(offenders(items)).toEqual([]);
  });

  it("Logic Atlas: titles, metrics and steps are labels; descriptions, insights and edge cases are prose", () => {
    const items: Array<[string, CopyKind]> = [];
    for (const m of logicModules("Sensex", "Thursday")) {
      items.push([m.title, "label"], [m.subtitle, "label"], [m.description, "prose"]);
      for (const x of m.metrics) items.push([x.label, "label"], [x.value, "label"]);
      for (const n of m.nodes) items.push([n.label, "label"], [n.description, "prose"]);
      for (const f of m.formulas) items.push([f.name, "label"], [f.output, "label"], [f.words, "prose"], [f.value(r), "cell"]);
      for (const o of m.outputs) items.push([o.label, "label"], [o.value(r), "cell"]);
      for (const text of [...m.insights(null), ...m.insights(r), ...m.edgeCases]) items.push([text, "prose"]);
    }
    expect(offenders(items)).toEqual([]);
  });

  it("tabs, modes, sections and sheet names are labels in title case", () => {
    const labels = [...NAV_ITEMS.map((n) => n.label), ...INPUT_MODES.map((m) => m.label), ...INPUT_SECTIONS, ...SHEET_NAMES];
    expect(offenders(labels.map((l): [string, CopyKind] => [l, "label"]))).toEqual([]);
    expect(labels.filter((l) => !isTitleCase(l))).toEqual([]);
  });

  it("validation labels are labels; messages and fixes are prose", () => {
    const filled = blankFillInputs();
    const errors = [
      ...requiredFields(8, 4),
      ...invalid.cases.flatMap((c) => validateDeskInputs({ ...filled, ...(c.patch as object) }, { today: "2026-10-28" })),
    ];
    const items = errors.flatMap((e): Array<[string, CopyKind]> => [[e.label, "label"], [e.message, "prose"], ...(e.fix ? [[e.fix, "prose"] as [string, CopyKind]] : [])]);
    expect(offenders(items)).toEqual([]);
  });
});
