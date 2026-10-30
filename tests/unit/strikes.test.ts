import { describe, expect, it } from "vitest";

import { MAX_SPREADS, spreadCount } from "@/lib/engine/structure";
import type { DeskInputs } from "@/lib/inputs/draft";
import { canRemoveStrike, insertStrike, removeStrike, setSpreadCount } from "@/lib/inputs/strikes";

import { fixtureInputs } from "../helpers/fixture";

/** The desk book: 137, 127, 125, 85, 84, 70 with two spreads. */
const book = () => fixtureInputs() as DeskInputs;

describe("insert a strike", () => {
  it("refuses a level that is not a number, repeats a strike, or sits at or below the protection strike", () => {
    const b = book();
    expect(insertStrike(b, Number.NaN, "default")).toBeNull();
    expect(insertStrike(b, b.strikePercents[1]!, "default")).toBeNull();
    expect(insertStrike(b, b.strikePercents[spreadCount(b) + 1]!, "default")).toBeNull();
    expect(insertStrike(b, 1, "default")).toBeNull();
  });

  it("refuses a seventh spread", () => {
    const full = { ...book(), ...setSpreadCount(book(), MAX_SPREADS, "default") };
    expect(spreadCount(full)).toBe(MAX_SPREADS);
    expect(insertStrike(full, 200, "default")).toBeNull();
  });

  it("adds a new top with a derived participation, keeping the old top as a typed 1", () => {
    const b = book();
    const next = insertStrike(b, 150, "default")!;
    expect(next.strikePercents[0]).toBe(150);
    expect(next.participations.at(-1)).toBeNull();
    expect(next.participations.at(-2)).toBe(1);
  });

  it("adds a bottom spread just above the protection strike with a participation of 1", () => {
    const b = book();
    const n = spreadCount(b);
    const level = (b.strikePercents[n]! + b.strikePercents[n + 1]!) / 2;
    const next = insertStrike(b, level, "default")!;
    expect(next.strikePercents[n + 1]).toBe(level);
    expect(next.participations[0]).toBe(1);
  });

  it("splits a spread in two, both pieces keeping its rate, and in Blank Inputs waits for the type and side", () => {
    const b = book();
    const mid = (b.strikePercents[1]! + b.strikePercents[2]!) / 2;
    const next = insertStrike(b, mid, "blank")!;
    expect(next.strikePercents[2]).toBe(mid);
    expect(next.strikeOptionTypes[2]).toBe("");
    expect(next.strikeSides[2]).toBe("");
  });

  it("keeps the sides as they are when a term is not filled yet", () => {
    const b = { ...book(), coupon: Number.NaN };
    const next = insertStrike(b, 150, "default")!;
    expect(next.strikeSides[0]).toBe("");
  });
});

describe("remove a strike", () => {
  it("only removes a spread level, and never the last spread", () => {
    const b = book();
    expect(canRemoveStrike(b, spreadCount(b) + 1)).toBe(false);
    const one = { ...b, ...setSpreadCount(b, 1, "default") };
    expect(removeStrike(one, 0, "default")).toBeNull();
  });

  it("drops the top, drops the bottom, or joins two spreads in the middle", () => {
    const four = { ...book(), ...setSpreadCount(book(), 4, "default") };
    const n = spreadCount(four);
    for (const i of [0, n, 2]) {
      const next = removeStrike(four, i, "default")!;
      expect(spreadCount(next)).toBe(n - 1);
      expect(next.participations.at(-1)).toBeNull();
    }
  });
});

describe("number of spreads", () => {
  it("with every strike filled grows on top and shrinks from the top", () => {
    const b = book();
    const up = setSpreadCount(b, 5, "default");
    expect(spreadCount(up)).toBe(5);
    expect(up.strikePercents.slice(-4)).toEqual(b.strikePercents.slice(-4));
    expect(spreadCount(setSpreadCount({ ...b, ...up }, 1, "default"))).toBe(1);
  });

  it("from no strikes makes empty rows, typed Put in Default Values and blank in Blank Inputs", () => {
    const empty = { ...book(), strikePercents: [], participations: [], strikeOptionTypes: [], strikeSides: [] };
    expect(setSpreadCount(empty, 2, "default").strikeOptionTypes).toEqual(Array.from({ length: 6 }, () => "P"));
    expect(setSpreadCount(empty, 2, "blank").strikeOptionTypes).toEqual(Array.from({ length: 6 }, () => ""));
  });

  it("with some strikes empty adds or drops rows at the top, keeping what was typed below", () => {
    const b = book();
    const partial = { ...b, strikePercents: [Number.NaN, ...b.strikePercents.slice(1)] };
    const up = setSpreadCount(partial, 3, "blank");
    expect(up.strikePercents).toHaveLength(7);
    expect(up.strikeOptionTypes[0]).toBe("");
    expect(up.strikePercents.slice(2)).toEqual(partial.strikePercents.slice(1));
    const down = setSpreadCount(partial, 1, "default");
    expect(down.strikePercents).toEqual(partial.strikePercents.slice(1));
    expect(down.participations).toEqual([null]);
  });
});
