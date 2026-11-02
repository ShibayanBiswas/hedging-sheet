import { describe, expect, it } from "vitest";

import { formatDate } from "@/lib/engine/dates";
import { fmtDeskClock, fmtIstTime, fmtRunStamp } from "@/lib/format";

describe("run stamps and the desk clock", () => {
  it("print September as Sep, as every date field does", () => {
    expect(fmtRunStamp("2026-09-15T08:40:00.000Z")).toBe("15-Sep-2026 · 2:10 pm IST");
    expect(fmtDeskClock(new Date("2026-09-15T08:40:05.000Z"))).toBe("15-Sep-2026 · 2:10:05 pm IST");
  });

  it("match the date fields in all twelve months", () => {
    for (let month = 1; month <= 12; month++) {
      const ymd = `2026-${String(month).padStart(2, "0")}-05`;
      const at = `${ymd}T06:30:00.000Z`;
      expect(fmtRunStamp(at).split(" · ")[0]).toBe(formatDate(ymd));
      expect(fmtDeskClock(new Date(at)).split(" · ")[0]).toBe(formatDate(ymd));
    }
  });

  it("keep the 12 hour clock in lower case around midnight and noon", () => {
    expect(fmtRunStamp("2026-10-30T18:35:00.000Z")).toBe("31-Oct-2026 · 12:05 am IST");
    expect(fmtDeskClock(new Date("2026-10-30T06:41:30.000Z"))).toBe("30-Oct-2026 · 12:11:30 pm IST");
    expect(fmtIstTime("2026-10-30T06:41:30.000Z")).toBe("12:11 pm IST");
  });
});
