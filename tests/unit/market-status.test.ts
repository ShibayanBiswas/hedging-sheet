import { describe, expect, it } from "vitest";

import { pickDeskClose, type DailyBar } from "@/lib/market-data";

/** Weekday closes to Tuesday 27-Oct-2026, plus Wednesday 28-Oct-2026 when today's bar exists. */
function bars(withToday: boolean): DailyBar[] {
  const out: DailyBar[] = [
    { dateYmd: "2026-10-26", close: 76500 },
    { dateYmd: "2026-10-27", close: 76835.78 },
  ];
  if (withToday) out.push({ dateYmd: "2026-10-28", close: 76900 });
  return out;
}

/** IST is UTC + 5:30. */
const ist = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+05:30`);

describe("D6 market status", () => {
  it("is Pre Open before 09:15 IST on a weekday, with the last completed close", () => {
    const picked = pickDeskClose(bars(false), ist("2026-10-28", "08:30"));
    expect(picked?.sessionPhase).toBe("pre_open");
    expect(picked?.close).toBe(76835.78);
  });

  it("is Open during the session and never uses today's partial bar", () => {
    const picked = pickDeskClose(bars(true), ist("2026-10-28", "10:00"));
    expect(picked?.sessionPhase).toBe("open");
    expect(picked?.close).toBe(76835.78);
  });

  it("is Closed after 15:30 IST and uses today's close", () => {
    const picked = pickDeskClose(bars(true), ist("2026-10-28", "16:00"));
    expect(picked?.sessionPhase).toBe("closed");
    expect(picked?.close).toBe(76900);
  });

  it("is Holiday Or Weekend on a Saturday and on a weekday without a bar after the close", () => {
    expect(pickDeskClose(bars(false), ist("2026-10-31", "11:00"))?.sessionPhase).toBe("holiday_or_weekend");
    expect(pickDeskClose(bars(false), ist("2026-10-28", "16:00"))?.sessionPhase).toBe("holiday_or_weekend");
  });
});
