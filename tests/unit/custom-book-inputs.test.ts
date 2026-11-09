import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { CustomLeg, HedgeInputs, HedgingResult } from "@/lib/engine/types";
import { buildHedgingExcel } from "@/lib/excel/build-hedging-excel";
import { tabSpecs } from "@/lib/exports/tab-specs";
import { copyViolations, type CopyKind } from "@/lib/format/copy-rules";
import { parseLegPaste } from "@/lib/inputs/bulk";
import { addLeg, legsText, newLeg, removeLeg, setLegCount, switchBook, TEMPLATES } from "@/lib/inputs/custom-legs";
import { blankInputs, isPriceable, type DeskInputs } from "@/lib/inputs/draft";
import { splitKeys } from "@/lib/inputs/run-keys";
import { atlasInsights, atlasStages } from "@/lib/logic-atlas";
import { tabPdfProps } from "@/lib/pdf/tab-pdf-props";
import { NOT_USED, outputTables, pricerGrid, pricerHeadline, pricerPotTable, productTables, specCells, specHeaders, specRowLabels, summaryHeadline, summaryTables, type KeyValueSpec, type TableSpec } from "@/lib/tables";
import { checkFieldEdit, fieldSection, fieldTestId, numberFieldRules, unlockedSteps, validateDeskInputs } from "@/lib/validation/inputRules";

import { atlasCopy } from "../helpers/atlas-copy";
import { fixtureInputs } from "../helpers/fixture";

const TODAY = "2026-10-28";
const market = seedMarketData();
const condor = TEMPLATES.find((t) => t.id === "iron-condor")!.legs;

function customRun(legs: CustomLeg[] = condor): HedgingResult {
  const r = computeHedgingSheet({ ...fixtureInputs(), bookMode: "custom", customLegs: legs }, market);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

const item = (spec: KeyValueSpec, label: string) => spec.items.find((i) => i.label === label);

describe("switching the book", () => {
  const defaults = fixtureInputs() as DeskInputs;

  it("starts Custom in Default Values with one leg, 100% Put Buy 1, and in Blank Inputs with none", () => {
    expect(switchBook(defaults, "custom", "default")).toEqual({ bookMode: "custom", customLegs: [{ percent: 100, optionType: "P", side: "B", quantity: 1 }], legVolOverrides: {} });
    expect(switchBook(blankInputs(), "custom", "blank")).toEqual({ bookMode: "custom", customLegs: [], legVolOverrides: {} });
  });

  it("keeps each book's entries across a switch and does nothing when the book is already picked", () => {
    const legs = [{ percent: 95, optionType: "C" as const, side: "S" as const, quantity: 3 }];
    const inCustom = { ...defaults, bookMode: "custom" as const, customLegs: legs };
    const back = { ...inCustom, ...switchBook(inCustom, "product", "default") };
    expect(back.bookMode).toBe("product");
    expect(back.customLegs).toBe(legs);
    expect(back.strikePercents).toEqual(defaults.strikePercents);
    expect({ ...back, ...switchBook(back, "custom", "default") }.customLegs).toBe(legs);
    expect(switchBook(defaults, "product", "default")).toEqual({});
    expect(switchBook(inCustom, "custom", "default")).toEqual({});
  });

  it("drops leg volatility overrides, which are keyed by strike slot, and marks the last run stale", () => {
    const withOverride = { ...defaults, legVolOverrides: { "0-0": 0.2 } };
    expect(switchBook(withOverride, "custom", "default").legVolOverrides).toEqual({});
    const switched = { ...defaults, ...switchBook(defaults, "custom", "default") };
    expect(splitKeys(switched).inputsKey).not.toBe(splitKeys(defaults).inputsKey);
  });

  it("leaves Product Payoff inputs as they always were: no book keys until the switch is used", () => {
    expect("bookMode" in defaults).toBe(false);
    expect("customLegs" in defaults).toBe(false);
    expect("bookMode" in blankInputs()).toBe(false);
  });
});

describe("Number Of Legs, Add Leg and Remove Leg", () => {
  const one = [newLeg("default")];

  it("adds legs at the end, filled in Default Values and empty in Blank Inputs, from 1 to 10", () => {
    expect(addLeg(one, "default")).toHaveLength(2);
    expect(addLeg(one, "blank")[1]).toEqual({ percent: NaN, optionType: "", side: "", quantity: NaN });
    const ten = setLegCount(one, 10, "default");
    expect(ten).toHaveLength(10);
    expect(addLeg(ten, "default")).toBe(ten);
    expect(setLegCount(ten, 12, "default")).toHaveLength(10);
    expect(setLegCount([], 0, "blank")).toHaveLength(1);
  });

  it("keeps the earlier legs when the count changes and never removes the last one", () => {
    const legs = [{ ...newLeg("default"), percent: 90 }, { ...newLeg("default"), percent: 110 }, { ...newLeg("default"), percent: 120 }];
    expect(setLegCount(legs, 2, "default").map((l) => l.percent)).toEqual([90, 110]);
    expect(removeLeg(legs, 1).map((l) => l.percent)).toEqual([90, 120]);
    expect(removeLeg(one, 0)).toBe(one);
  });

  it("states a template's legs in words", () => {
    expect(legsText(condor)).toBe("Buy 1 Call At 110%, Sell 1 Call At 105%, Sell 1 Put At 95%, Buy 1 Put At 90%");
  });
});

describe("Bulk Edit Strikes in Custom", () => {
  it("reads Level %, Put Or Call, Buy Or Sell and Quantity in any order, 1 when the quantity is left out", () => {
    const r = parseLegPaste("105\tCall\tSell\t2\n100,c,b\n100;Put;Buy;1.5\n95% P S");
    expect(r.ok).toBe(false);
    const fixed = parseLegPaste("105\tCall\tSell\t2\n100,c,b\n100;Put;Buy;1.5");
    expect(fixed.ok).toBe(true);
    expect(fixed.rows.map((x) => x.value)).toEqual([
      { percent: 105, optionType: "C", side: "S", quantity: 2 },
      { percent: 100, optionType: "C", side: "B", quantity: 1 },
      { percent: 100, optionType: "P", side: "B", quantity: 1.5 },
    ]);
  });

  it("names the cell that is wrong", () => {
    const errors = (text: string) => parseLegPaste(text).rows.map((x) => x.error ?? null);
    expect(errors("abc\tPut\tBuy")).toEqual(["The level is not a number."]);
    expect(errors("0\tPut\tBuy")).toEqual(["The level must be above 0% and at most 500%."]);
    expect(errors("100\tStraddle\tBuy")).toEqual(["Option Type must be Put or Call."]);
    expect(errors("100\tPut")).toEqual(["Buy Or Sell must be Buy or Sell."]);
    expect(errors("100\tPut\tBuy\t-1")).toEqual(["The quantity must be above 0 and at most 1000; Buy Or Sell gives the sign."]);
    expect(parseLegPaste("").error).toMatch(/^Paste one leg per line/);
    expect(parseLegPaste(Array.from({ length: 11 }, () => "100\tPut\tBuy").join("\n")).error).toBe("At most 10 legs can be pasted; this paste has 11.");
  });
});

describe("input rules in Custom", () => {
  const blankCustom = (patch: Partial<DeskInputs> = {}): DeskInputs => ({ ...blankInputs(), bookMode: "custom", customLegs: [], ...patch });
  const fields = (d: DeskInputs) => validateDeskInputs(d, { today: TODAY });

  it("asks for the number of legs, never for a spread count, coupon, decay or floor units", () => {
    const errors = fields(blankCustom());
    expect(errors.find((e) => e.field === "legCount")).toMatchObject({ kind: "required", section: "Strikes And Spreads", message: "Pick the number of legs." });
    for (const field of ["spreadCount", "coupon", "decay", "floorUnits"]) expect(errors.map((e) => e.field)).not.toContain(field);
    expect(errors.map((e) => e.field)).toEqual(expect.arrayContaining(["tenorDays", "startLevelUplift", "notionalCr", "nbfcRate", "dailyVol", "stressSigmas"]));
  });

  it("asks every empty leg for its Level %, Option Type, Buy Or Sell and Quantity", () => {
    const errors = fields(blankCustom({ customLegs: [newLeg("blank")] })).filter((e) => e.field.startsWith("customLegs"));
    expect(errors.map((e) => `${e.label}: ${e.message}`)).toEqual([
      "Leg 1 Level %: Leg 1 Level % is required.",
      "Leg 1 Option Type: Select Put or Call.",
      "Leg 1 Buy Or Sell: Select Buy or Sell.",
      "Leg 1 Quantity: Leg 1 Quantity is required.",
    ]);
    expect(errors.every((e) => e.kind === "required" && e.section === "Strikes And Spreads")).toBe(true);
  });

  it("opens the steps after Strikes And Spreads once the legs are complete, whatever the product fields hold", () => {
    const filled = { ...blankCustom(), underlying: "Sensex" as const, valuationDate: TODAY, expiryCount: 1, expiryDates: ["2030-03-28"] };
    expect(unlockedSteps(fields(filled))).toBe(3);
    expect(unlockedSteps(fields({ ...filled, customLegs: [newLeg("blank")] }))).toBe(3);
    expect(unlockedSteps(fields({ ...filled, customLegs: [newLeg("default")] }))).toBe(7);
    // The same inputs in Product Payoff wait on the spread count.
    expect(unlockedSteps(fields({ ...filled, bookMode: "product", customLegs: [newLeg("default")] }))).toBe(3);
  });

  it("checks a typed Level % and Quantity against their range, and maps each leg field to its group and test id", () => {
    const d = { ...fixtureInputs(), bookMode: "custom", customLegs: [newLeg("default")] } as DeskInputs;
    expect(checkFieldEdit(d, "customLegs.0.quantity", 0)?.message).toBe("Leg 1 Quantity must be above 0 and at most 1,000.");
    expect(checkFieldEdit(d, "customLegs.0.quantity", 2.5)).toBeNull();
    expect(checkFieldEdit(d, "customLegs.0.percent", 600)?.message).toBe("Leg 1 Level % must be above 0 and at most 500.");
    expect(numberFieldRules(d).map((r) => r.field)).toEqual(expect.arrayContaining(["customLegs.0.percent", "customLegs.0.quantity"]));
    expect(fields({ ...d, customLegs: [{ ...newLeg("default"), quantity: 2000 }] }).map((e) => `${e.field} ${e.kind}`)).toEqual(["customLegs.0.quantity invalid"]);
    expect(fields(d)).toEqual([]);
    expect(fieldSection("customLegs.3.side")).toBe("Strikes And Spreads");
    expect(fieldSection("legCount")).toBe("Strikes And Spreads");
    expect(fieldTestId("customLegs.3.side")).toBe("input-customLegs-3-side");
    expect(fieldTestId("legCount")).toBe("input-legCount");
  });

  it("prices once every leg has its type and side, ignoring the product strikes left behind", () => {
    const d = { ...blankCustom(), underlying: "Sensex" as const, strikeOptionTypes: ["", ""], strikeSides: ["", ""] } as DeskInputs;
    expect(isPriceable(d)).toBe(false);
    expect(isPriceable({ ...d, customLegs: [newLeg("blank")] })).toBe(false);
    expect(isPriceable({ ...d, customLegs: [newLeg("default")] })).toBe(true);
    expect(isPriceable({ ...d, bookMode: "product", customLegs: [newLeg("default")] })).toBe(false);
  });
});

describe("Custom Option Book output tables", () => {
  const r = customRun();
  const tabs = outputTables(r);

  it("names the book in the headlines and leaves the coupon return blank", () => {
    const head = summaryHeadline(r);
    expect(head.columns.at(-1)!.label).toBe("Book");
    expect(head.rows[0]![head.columns.at(-1)!.key]).toBe("Custom Option Book");
    expect(head.rows[0]![head.columns.find((c) => c.label === "Internal Rate Of Return")!.key]).toBeNull();
    const pricer = pricerHeadline(r);
    expect(pricer.rows[0]![pricer.columns.find((c) => c.label === "Achieved Coupon")!.key]).toBeNull();
    expect(pricer.columns.at(-1)!.label).toBe("Book");
  });

  it("lists Not Used In Custom Option Book for every product term on Summary, Pricer and Product Description", () => {
    const spec = summaryTables(r).find((s) => s.id === "summary-spec") as KeyValueSpec;
    expect(item(spec, "Book")?.value).toBe("Custom Option Book");
    expect(item(spec, "Number Of Legs")?.value).toBe(4);
    for (const label of ["Target Sensex Rise", "Coupon", "Internal Rate Of Return", "Spreads And Participation Rates", "Protection", "Decay"]) expect(item(spec, label)?.value, label).toBe(NOT_USED);
    expect(typeof item(spec, "Actual Inbuilt")?.value).toBe("number");
    const pots = pricerPotTable(r);
    expect(pots.items[0]).toEqual({ label: "Book", value: "Custom Option Book", kind: "text" });
    for (const label of ["Coupon", "Achieved Coupon", "Internal Rate Of Return"]) expect(item(pots, label)?.value, label).toBe(NOT_USED);
    expect(typeof item(pots, "Premium In Rupees")?.value).toBe("number");
    const pd = productTables(r);
    for (const label of ["Maximum Coupon", "Target Sensex Rise", "Capital Protection", "Downside Decay", "Decay Floor", "Client Internal Rate Of Return"]) {
      expect(item(pd.termSheet, label)?.value, label).toBe(NOT_USED);
    }
    expect(pd.termSheet.items.filter((x) => x.label.startsWith("Leg ")).map((x) => x.value)).toEqual(["Buy 1 Call At 110%", "Sell 1 Call At 105%", "Sell 1 Put At 95%", "Buy 1 Put At 90%"]);
    expect(item(pd.greeks, "Leverage")?.value).toBe(NOT_USED);
    expect(item(pd.greeks, "Target Level")?.value).toBe(NOT_USED);
    expect(item(pd.maturity, "Internal Rate Of Return")?.value).toBe(NOT_USED);
  });

  it("drops the futures adjustment row, since a call is a real call, and names each leg on the Leg Grid", () => {
    const options = summaryTables(r).find((s) => s.id === "summary-options")!;
    const rows = "rows" in options ? options.rows : [];
    expect(rows.map((x) => x.option)).toEqual(["Call", "Call", "Put", "Put", "Total"]);
    expect(rows.map((x) => x.side).slice(0, 4)).toEqual(["Buy", "Sell", "Sell", "Buy"]);
    expect(rows.at(-1)!.premium).toBeCloseTo(r.pricer.header.premium / 1e7, 9);
    const grid = pricerGrid(r);
    expect(grid.groups.map((g) => g.label.split(" · ")[0])).toEqual(["Leg 1", "Leg 2", "Leg 3", "Leg 4"]);
    expect(grid.rows.find((x) => x.label === "Option Type")!.values.slice(0, 1)).toEqual(["Call"]);
  });

  it("follows the copy rules in every title, header, row, note and cell", () => {
    const items: Array<[string, CopyKind]> = [];
    for (const spec of Object.values(tabs).flat()) {
      items.push([spec.title, "label"], ...specHeaders(spec).flat().map((h): [string, CopyKind] => [h, "label"]));
      items.push(...specRowLabels(spec).filter((l) => !/^[-−]?[\d,.]+%?$/.test(l)).map((l): [string, CopyKind] => [l, "label"]));
      if (spec.note) items.push([spec.note, "prose"]);
      items.push(...specCells(spec).map((c): [string, CopyKind] => [c.text, "cell"]));
    }
    const copy = atlasCopy(r);
    items.push(...copy.labels.map((t): [string, CopyKind] => [t, "label"]), ...copy.prose.map((t): [string, CopyKind] => [t, "prose"]), ...copy.cells.map((t): [string, CopyKind] => [t, "cell"]));
    expect(items.flatMap(([text, kind]) => copyViolations(text, kind).map((v) => `${kind} "${text}": ${v}`))).toEqual([]);
  });
});

describe("Custom Option Book exports and Logic Atlas", () => {
  const r = customRun();
  const inputs = r.inputs as DeskInputs;

  it("lists the legs on the Inputs tab in place of strikes and spreads, and marks the product terms Not Used", () => {
    const specs = tabSpecs("inputs", { result: null, inputs, market });
    expect(specs.map((s) => s.id)).not.toContain("inputs-spreads");
    const strikes = specs.find((s) => s.id === "inputs-strikes") as TableSpec;
    expect(strikes.title).toBe("3 Strikes And Spreads · Custom Option Book");
    expect(strikes.columns.map((c) => c.label)).toEqual(["Leg", "Level %", "Level In Points", "Option Type", "Buy Or Sell", "Quantity"]);
    expect(strikes.rows.map((x) => `${x.leg} ${x.level} ${x.type} ${x.side} ${x.quantity}`)).toEqual(["Leg 1 110 Call Buy 1", "Leg 2 105 Call Sell 1", "Leg 3 95 Put Sell 1", "Leg 4 90 Put Buy 1"]);
    const terms = specs.find((s) => s.id === "inputs-terms") as KeyValueSpec;
    expect(terms.items.slice(0, 6).map((x) => x.value)).toEqual(Array.from({ length: 6 }, () => NOT_USED));
    expect(item(terms, "Notional In Crore")?.value).toBe(100);
  });

  it("writes the book to Excel: the legs, Not Used and the book in the header", () => {
    const wb = new ExcelJS.Workbook();
    buildHedgingExcel(wb, r, null);
    const text = (name: string) => {
      const out: string[] = [];
      wb.getWorksheet(name)!.eachRow((row) => row.eachCell((c) => out.push(String(c.value))));
      return out;
    };
    // Section titles print in capitals.
    expect(text("Inputs")).toEqual(expect.arrayContaining(["Leg 1", "Leg 4", NOT_USED, "3 STRIKES AND SPREADS · CUSTOM OPTION BOOK"]));
    expect(text("Inputs")).not.toContain("SPREADS");
    expect(text("Summary Sheet")).toEqual(expect.arrayContaining(["Book", "Custom Option Book", NOT_USED]));
    expect(text("Summary Sheet")).not.toContain("Futures Adjustment For Call Strikes");
    expect(text("Product Description").join(" ")).toContain("5 Year Sensex Custom Option Book For ₹100 Crore");
    expect(text("Pricer").some((t) => t.includes("Custom Option Book"))).toBe(true);
  });

  it("names the book in the PDF subtitle", () => {
    const props = tabPdfProps("summary", { result: r, inputs, market, runAt: null, now: new Date("2026-10-28T04:30:00Z") });
    expect(props.subtitle).toBe("Sensex · Custom Option Book · Valuation Date 27-Oct-2026 · Spot 82,000.00");
  });

  it("words the Logic Atlas for the legs", () => {
    const stages = atlasStages(inputs, { result: r, market }, { market });
    const by = (id: string) => stages.find((s) => s.id === id)!;
    expect(by("inputs").description).toMatch(/^Sensex custom option book of 100\.00 Crore .*: 4 legs,/);
    expect(by("inputs").lastRun![0]).toEqual({ label: "Book", value: "Custom Option Book" });
    expect(by("strikes").description).toBe("4 custom option book legs, from 110.00% down to 90.00% of the start level: 2 call and 2 put, 2 bought and 2 sold.");
    expect(by("goal-seek").description).toMatch(/pots return the notional/);
    expect(by("goal-seek").lastRun!.map((v) => v.label)).toEqual(["Inbuilt", "Iterations"]);
    expect(by("payoff").rule).toBe("Book Payoff: Each Leg's Units Times Its Payoff At Expiry, Summed; No Coupon, Protection Or Decay");
    expect(by("payoff").lastRun!.map((v) => v.label)).toEqual(["Return At 0%", "Lowest Return Shown", "Highest Return Shown"]);
    expect(atlasInsights({ result: r, market }).find((x) => x.id === "inbuilt")!.text).toMatch(/custom option book pays its own payoff/);
    const before = atlasStages({ ...inputs, customLegs: [] }, null, { market });
    expect(before.find((s) => s.id === "strikes")!.description).toBe("No legs until the number of legs is picked.");
  });
});

describe("Product Payoff keeps its tables when legs sit in the inputs", () => {
  it("shows the same tables with the book switched back", () => {
    const product = computeHedgingSheet(fixtureInputs(), market);
    const back = computeHedgingSheet({ ...fixtureInputs(), bookMode: "product", customLegs: condor } as HedgeInputs, market);
    if (!product.ok || !back.ok) throw new Error("did not price");
    const texts = (x: HedgingResult) => Object.values(outputTables(x)).flat().flatMap((s) => specCells(s).map((c) => `${c.key} ${c.text}`));
    expect(texts(back)).toEqual(texts(product));
    expect(tabSpecs("inputs", { result: null, inputs: back.inputs as DeskInputs, market })).toEqual(tabSpecs("inputs", { result: null, inputs: product.inputs as DeskInputs, market }));
  });
});
