import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { deriveTerms, derivedSides, startLevel, validateStructure } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import { atlasStages } from "@/lib/logic-atlas";
import { displayCell, strikeLabel, strikeTypesLabel, vegaHedgeInputs } from "@/lib/tables";
import { checkFieldEdit, validateDeskInputs } from "@/lib/validation/inputRules";

import { fixtureInputs, priced } from "../helpers/fixture";

const TODAY = "2026-10-27";

describe("structure rules", () => {
  it("a start level with no rounding step is the uplifted spot itself", () => {
    expect(startLevel({ spot: 76543.21, startLevelUplift: 0, startLevelRounding: 0 })).toBe(76543.21);
  });

  it("terms from too few strikes are blanks, never a crash", () => {
    const t = deriveTerms({ strikePercents: [], participations: [], coupon: 0.1 });
    expect(t.nSpreads).toBe(0);
    expect(Number.isNaN(t.target)).toBe(true);
    expect(Number.isNaN(t.floorLevel)).toBe(true);
  });

  it("names a blank strike and a blank participation as blank", () => {
    const k = [...fixtureInputs().strikePercents];
    k[3] = Number.NaN;
    expect(validateStructure(fixtureInputs({ strikePercents: k }))[0]!.message).toBe("Strike 4 is blank. Every strike must be above zero.");
    const blankRate = validateStructure(fixtureInputs({ participations: [Number.NaN, null] }));
    expect(blankRate.map((e) => e.message)).toContain("Spread 1 has a Participation Rate of blank. It must be above zero.");
  });

  it("names the side each strike needs, Buy or Sell", () => {
    const base = fixtureInputs();
    const flipped = derivedSides(base).map((s) => (s === "B" ? "S" : "B"));
    const messages = validateStructure({ ...base, strikeSides: flipped }).map((e) => e.message);
    expect(messages).toContain("This Strike Must Be A Buy To Give The Product Payoff");
    expect(messages).toContain("This Strike Must Be A Sell To Give The Product Payoff");
  });
});

describe("input rules", () => {
  const desk = () => fixtureInputs() as DeskInputs;

  it("keeps an empty edit, refuses a date that does not exist, and ignores a field it has no rule for", () => {
    expect(checkFieldEdit(desk(), "coupon", "")).toBeNull();
    expect(checkFieldEdit(desk(), "expiryDates.2", "2027-02-30")?.message).toBe("Expiry 3 is not a valid date.");
    expect(checkFieldEdit(desk(), "notAField", 5)).toBeNull();
  });

  it("flags a typed expiry that is not a date, and more than 6 spreads", () => {
    const d = desk();
    const tooMany = { ...d, strikePercents: [200, 190, 180, 170, 160, 150, 140, 120, 100, 90, 80], strikeOptionTypes: Array.from({ length: 11 }, () => "P"), strikeSides: Array.from({ length: 11 }, () => "B") } as DeskInputs;
    const errors = validateDeskInputs({ ...tooMany, expiryDates: ["26-11-2026", ...d.expiryDates.slice(1)] }, { today: TODAY });
    expect(errors.find((e) => e.field === "expiryDates.0")?.message).toBe("Expiry 1 is not a valid date.");
    expect(errors.find((e) => e.field === "spreadCount")?.message).toBe("Use 1 to 6 spreads.");
  });

  it("files a wrong side under the strike, and a typed top participation that pays too much under that participation", () => {
    const d = desk();
    const flipped = derivedSides(d as HedgeInputs).map((s) => (s === "B" ? "S" : "B"));
    const sides = validateDeskInputs({ ...d, strikeSides: flipped }, { today: TODAY });
    expect(sides.find((e) => e.field === "strikeSides.0")).toMatchObject({ label: "Strike 1 Buy Or Sell", section: "Strikes And Spreads" });
    const over = validateDeskInputs({ ...d, participations: [d.participations[0] ?? 1, 99] }, { today: TODAY });
    expect(over.find((e) => e.code === "coupon-exceeded")).toMatchObject({ field: "participations.1", label: "Spread 2 Participation Rate" });
  });
});

describe("tables", () => {
  it("label the option types of a book", () => {
    expect(strikeTypesLabel([])).toBe("Put");
    expect(strikeTypesLabel(["C", "P", "P"])).toBe("Call At Strike 1, Put Elsewhere");
    expect(strikeTypesLabel(["C", "P", "C", "C"])).toBe("Call At Strikes 1, 3 And 4, Put Elsewhere");
  });

  it("show a Greek to 3 decimals at most, and a fractional strike % to 2 places", () => {
    expect(displayCell(0.123456789, "greek").text).toBe("0.123");
    expect(strikeLabel(84.5, 69123)).toBe("84.50% · 69,123");
  });

  it("name an overridden hedge volatility", () => {
    const r = priced({ hedgeVolOverride: 0.2 });
    const items = vegaHedgeInputs(r).items.map((x) => x.label);
    expect(items).toContain("Fair Volatility · Overridden");
  });
});

describe("Logic Atlas stage text", () => {
  const market = seedMarketData();

  it("states one spread in the singular, a typed hedge strike, and the volatility window it was calculated over", () => {
    const i = {
      ...fixtureInputs({ strikePercents: [125, 105, 85, 84, 70], participations: [null] }),
      hedgeStrikeAuto: false,
      hedgeStrike: 90000,
      dailyVolSource: "calculated",
    } as DeskInputs;
    const stages = atlasStages(i, null, { market, history: { observations: 245, from: "2025-10-27", to: "2026-10-26" } });
    const by = (id: string) => stages.find((s) => s.id === id)!;
    expect(by("strikes").description).toMatch(/for 1 spread,/);
    expect(by("vega-hedge").rule).toBe("Typed Hedge Strike: 90,000");
    expect(by("volatility").description).toContain("calculated from 245 daily returns from 27-Oct-2025 to 26-Oct-2026.");
  });

  it("shows dashes for a book with no expiries yet", () => {
    const stages = atlasStages(blankInputs(), null, { market });
    expect(stages.find((s) => s.id === "expiries")!.description).toMatch(/-/);
  });
});
