import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lastThursday, lastWeekdayOfMonth, snapToLastWeekday } from "@/lib/dates";
import { defaultExpiryDates } from "@/lib/engine/defaults";
import { quarterlyExpiries, snapExpiry } from "@/lib/engine/schedule";

const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const plusDays = (ymd: string, n: number) => new Date(day(ymd).getTime() + n * 86_400_000).toISOString().slice(0, 10);

describe("lastThursday", () => {
  it("is a Thursday in its month, and a week later is the next month, for every month from 2026 to 2035", () => {
    for (let y = 2026; y <= 2035; y++) {
      for (let m = 1; m <= 12; m++) {
        const d = lastThursday(y, m);
        expect(day(d).getUTCDay(), d).toBe(4);
        expect(d.slice(0, 7)).toBe(`${y}-${String(m).padStart(2, "0")}`);
        expect(plusDays(d, 7).slice(0, 7), d).not.toBe(d.slice(0, 7));
      }
    }
  });

  it("gives the workbook's typed expiries", () => {
    expect([lastThursday(2030, 1), lastThursday(2030, 4), lastThursday(2030, 7), lastThursday(2030, 10), lastThursday(2031, 1), lastThursday(2031, 4)]).toEqual([
      "2030-01-31",
      "2030-04-25",
      "2030-07-25",
      "2030-10-31",
      "2031-01-30",
      "2031-04-24",
    ]);
  });

  it("keeps the 31st when it is a Thursday: January 2030", () => {
    expect(lastThursday(2030, 1)).toBe("2030-01-31");
  });

  it("handles February in leap and other years", () => {
    // 29-Feb-2028 is a Tuesday; 28-Feb-2030 is a Thursday; 26-Feb-2026 is a Thursday.
    expect(lastThursday(2028, 2)).toBe("2028-02-24");
    expect(lastThursday(2030, 2)).toBe("2030-02-28");
    expect(lastThursday(2026, 2)).toBe("2026-02-26");
  });

  it("works for any weekday, as a property", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2000, max: 2100 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 6 }), (y, m, w) => {
        const d = lastWeekdayOfMonth(y, m, w);
        expect(day(d).getUTCDay()).toBe(w);
        expect(d.slice(0, 7)).toBe(`${y}-${String(m).padStart(2, "0")}`);
        expect(plusDays(d, 7).slice(0, 7)).not.toBe(d.slice(0, 7));
      }),
      { numRuns: 300 },
    );
  });
});

describe("expiries from the rule", () => {
  it("default to the workbook's six dates for its 04-Aug-2026 trade date, with Expiry 3 on 25-Jul-2030", () => {
    const dates = defaultExpiryDates("2026-08-04", "Sensex");
    expect(dates).toEqual(["2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24"]);
    expect(dates[2]).toBe("2030-07-25");
  });

  it("snap a typed date to the last expiry weekday of its month, Thursday for Sensex and Tuesday for Nifty", () => {
    expect(snapExpiry("2030-04-02", "Sensex")).toBe("2030-04-25");
    expect(snapExpiry("2030-04-30", "Sensex")).toBe("2030-04-25");
    expect(snapExpiry("2030-04-02", "Nifty")).toBe("2030-04-30");
    expect(snapToLastWeekday("2030-01-31", 4)).toBe("2030-01-31");
  });

  it("generate quarterly expiries from the first one: January, April, July and October", () => {
    expect(quarterlyExpiries("2030-01-31", 6, "Sensex")).toEqual(["2030-01-31", "2030-04-25", "2030-07-25", "2030-10-31", "2031-01-30", "2031-04-24"]);
    expect(quarterlyExpiries("2030-11-28", 3, "Sensex")).toEqual(["2030-11-28", "2031-02-27", "2031-05-29"]);
  });
});
