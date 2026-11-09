import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lastThursday, lastWeekdayOfMonth, snapToLastWeekday } from "@/lib/dates";
import { defaultExpiryDates } from "@/lib/engine/defaults";
import { continuationMonths, EXPIRY_WEEKDAY, expiriesEvery, expiryForMonth, quarterlyExpiries, snapExpiry } from "@/lib/engine/schedule";

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

  it("drop the half day of an odd month as Excel reads Summary H4 = H2 + 41 × 30.5, so they never cross into the next month", () => {
    // Rounding the half day up would land on 01-Oct-2030 and 01-Jul-2029; the workbook's helper dates are 30-Sep-2030 and 30-Jun-2029.
    expect(expiryForMonth("2026-10-28", 47, "Sensex")).toBe("2030-09-26");
    expect(expiryForMonth("2026-10-28", 47, "Nifty")).toBe("2030-09-24");
    expect(expiryForMonth("2026-01-27", 41, "Sensex")).toBe("2029-06-28");
    expect(expiryForMonth("2026-01-27", 41, "Nifty")).toBe("2029-06-26");
    expect(defaultExpiryDates("2026-08-04", "Nifty")).toEqual(["2030-01-29", "2030-04-30", "2030-07-30", "2030-10-29", "2031-01-28", "2031-04-29"]);
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
    expect(quarterlyExpiries("2030-01-29", 6, "Nifty")).toEqual(["2030-01-29", "2030-04-30", "2030-07-30", "2030-10-29", "2031-01-28", "2031-04-29"]);
    expect(expiriesEvery(3, "2030-11-28", 3, "Sensex")).toEqual(quarterlyExpiries("2030-11-28", 3, "Sensex"));
  });

  it("generate monthly expiries from the first one across the year end: last Thursday for Sensex, last Tuesday for Nifty", () => {
    expect(expiriesEvery(1, "2030-11-28", 4, "Sensex")).toEqual(["2030-11-28", "2030-12-26", "2031-01-30", "2031-02-27"]);
    expect(expiriesEvery(1, "2030-11-26", 4, "Nifty")).toEqual(["2030-11-26", "2030-12-31", "2031-01-28", "2031-02-25"]);
    // The first date counts by its month, so it lands on that month's expiry too.
    expect(expiriesEvery(1, "2030-12-02", 2, "Sensex")).toEqual(["2030-12-26", "2031-01-30"]);
    expect(expiriesEvery(1, "2030-04-10", 1, "Sensex")).toEqual(["2030-04-25"]);
  });

  it("step whole months, each the month's last expiry weekday, as a property", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2026, max: 2040 }),
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom(1, 3),
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom("Sensex" as const, "Nifty" as const),
        (y, m, step, count, u) => {
          const dates = expiriesEvery(step, `${y}-${String(m).padStart(2, "0")}-15`, count, u);
          expect(dates).toHaveLength(count);
          dates.forEach((d, i) => {
            const at = day(d);
            expect(at.getUTCFullYear() * 12 + at.getUTCMonth(), d).toBe(y * 12 + m - 1 + step * i);
            expect(at.getUTCDay(), d).toBe(EXPIRY_WEEKDAY[u]);
            expect(plusDays(d, 7).slice(0, 7), d).not.toBe(d.slice(0, 7));
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it("continue new rows monthly only after two expiries a month apart, the year end included, otherwise quarterly", () => {
    expect(continuationMonths("2030-11-28", "2030-12-26")).toBe(1);
    expect(continuationMonths("2030-12-26", "2031-01-30")).toBe(1);
    expect(continuationMonths("2030-01-31", "2030-04-25")).toBe(3);
    expect(continuationMonths("2030-01-31", "2030-03-28")).toBe(3);
    expect(continuationMonths("2030-04-25", "2030-04-25")).toBe(3);
    expect(continuationMonths(undefined, "2030-01-31")).toBe(3);
    expect(continuationMonths("", "2030-01-31")).toBe(3);
  });
});
