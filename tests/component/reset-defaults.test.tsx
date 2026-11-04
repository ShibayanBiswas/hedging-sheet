// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InputsPage from "@/app/page";
import { DeskDialogProvider } from "@/lib/context/desk-dialog-provider";
import { DeskProvider } from "@/lib/context/desk-provider";
import { formatDate } from "@/lib/engine/dates";
import { autoHedgeStrike, defaultExpiryDates } from "@/lib/engine/defaults";

import pricingParams from "../fixtures/pricing-params.json";
import surface from "../fixtures/surface.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

/** A Nifty close where the two hedge strike rules part: spot + 150 gives 23,800, spot × 1.006 gives 23,700. */
const NIFTY = 23555;

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("/api/market/levels")
        ? { valuationDate: "2026-10-28", sensexLevel: 76835.78, niftyLevel: NIFTY, sessionPhase: "open", fetchedAt: "2026-10-28T04:30:00Z", source: "yahoo" }
        : url.includes("/api/market/daily-vol")
          ? { dailyVol: 0.0087, observations: 260, from: "2025-10-28", to: "2026-10-27" }
          : { surface, params: pricingParams, surfaceSource: "database" };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

const value = (id: string) => (screen.getByTestId(id) as HTMLInputElement).value;

describe("Reset To Defaults", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-28T04:30:00Z"));
    stubFetch();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps Nifty's own rules: last Tuesday expiries and the spot plus 150 hedge strike", async () => {
    render(
      <DeskDialogProvider>
        <DeskProvider today="2026-10-28">
          <InputsPage />
        </DeskProvider>
      </DeskDialogProvider>,
    );
    await waitFor(() => expect(value("input-spot")).toBe("76,835.78"));
    fireEvent.change(screen.getByTestId("input-underlying"), { target: { value: "Nifty" } });
    await waitFor(() => expect(value("input-spot")).toBe("23,555.00"));

    const tuesdays = defaultExpiryDates("2026-10-28", "Nifty").map(formatDate);
    const hedge = autoHedgeStrike(NIFTY, "Nifty").toLocaleString("en-IN");
    expect(tuesdays.map((_, i) => value(`input-expiryDates-${i}`))).toEqual(tuesdays);
    expect(value("input-hedgeStrike")).toBe(hedge);

    fireEvent.click(screen.getByTestId("reset-inputs"));
    await waitFor(() => expect(value("input-underlying")).toBe("Nifty"));
    expect(value("input-spot")).toBe("23,555.00");
    expect(tuesdays.map((_, i) => value(`input-expiryDates-${i}`))).toEqual(tuesdays);
    expect(value("input-hedgeStrike")).toBe(hedge);
  });
});
