import { describe, expect, it } from "vitest";

import { copyViolations, type CopyKind } from "@/lib/format/copy-rules";
import { isTitleCase } from "@/lib/format/title-case";
import { INPUT_MODES } from "@/lib/inputs/draft";
import { INPUT_SECTIONS, requiredFields, validateDeskInputs } from "@/lib/validation/inputRules";
import { NAV_ITEMS } from "@/lib/navigation";
import { outputTables, specCells, specHeaders, specRowLabels } from "@/lib/tables";
import { SHEET_NAMES } from "@/lib/excel/build-hedging-excel";

import invalid from "../fixtures/invalid-cases.json";
import { blankFillInputs, mockDefaultInputs, priceLikeTheApp } from "../helpers/mock-market";
import { atlasCopy } from "../helpers/atlas-copy";

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

  it("Logic Atlas: titles, types, rules and labels are labels; descriptions and insights are prose; values are cells", () => {
    const copy = atlasCopy(r);
    const items: Array<[string, CopyKind]> = [
      ...copy.labels.map((t): [string, CopyKind] => [t, "label"]),
      ...copy.prose.map((t): [string, CopyKind] => [t, "prose"]),
      ...copy.cells.map((t): [string, CopyKind] => [t, "cell"]),
    ];
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
