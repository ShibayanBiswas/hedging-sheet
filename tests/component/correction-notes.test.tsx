// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InputsPage from "@/app/page";
import { DeskDialogProvider } from "@/lib/context/desk-dialog-provider";
import { DeskProvider } from "@/lib/context/desk-provider";

import pricingParams from "../fixtures/pricing-params.json";
import surface from "../fixtures/surface.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("/api/market/levels")
        ? { valuationDate: "2026-10-28", sensexLevel: 76835.78, niftyLevel: 23500, sessionPhase: "open", fetchedAt: "2026-10-28T04:30:00Z", source: "yahoo" }
        : url.includes("/api/market/daily-vol")
          ? { dailyVol: 0.0087, observations: 260, from: "2025-10-28", to: "2026-10-27" }
          : { surface, params: pricingParams, surfaceSource: "database" };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

const field = (id: string) => screen.getByTestId(id) as HTMLInputElement;

/** Type into a field and leave it, as the desk does. */
function commit(id: string, text: string) {
  const input = field(id);
  act(() => input.focus());
  fireEvent.change(input, { target: { value: text } });
  act(() => input.blur());
}

async function renderDefault() {
  render(
    <DeskDialogProvider>
      <DeskProvider today="2026-10-28">
        <InputsPage />
      </DeskProvider>
    </DeskDialogProvider>,
  );
  await waitFor(() => expect(field("input-spot").value).toBe("76,835.78"));
}

describe("Correction notes under the fields", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-28T04:30:00Z"));
    stubFetch();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("Decay Reduction Below Floor above the Decay becomes the Decay with a note, no popup, and the note goes on the next edit", async () => {
    await renderDefault();
    commit("input-floorUnits", "2");
    expect(field("input-floorUnits").value).toBe("1.60");
    expect(field("input-floorUnits")).toHaveAttribute("data-value", "1.6");
    expect(screen.getByTestId("note-floorUnits")).toHaveTextContent("Lowered To The Decay, 1.60");
    expect(field("input-floorUnits")).not.toHaveAttribute("aria-invalid");
    await act(async () => vi.advanceTimersByTime(1_500));
    expect(screen.queryByTestId("desk-dialog")).toBeNull();
    fireEvent.change(field("input-floorUnits"), { target: { value: "1.2" } });
    expect(screen.queryByTestId("note-floorUnits")).toBeNull();
  });

  it("a strike past its neighbour is clamped inside it, with the note under its row", async () => {
    await renderDefault();
    commit("input-strikePercents-1", "140");
    expect(field("input-strikePercents-1")).toHaveAttribute("data-value", "136");
    expect(screen.getByTestId("note-strikePercents-1")).toHaveTextContent("Lowered Below Strike 1, 136.000%");
    expect(screen.queryByTestId("strike-error-1")).toBeNull();
  });

  it("a typed top participation goes back to Calculated, and Decay below the floor reduction is raised to it", async () => {
    await renderDefault();
    commit("input-participations-1", "8");
    expect(screen.getByTestId("spread-1-participation-status")).toHaveTextContent("Calculated");
    expect(screen.getByTestId("note-participations-1")).toHaveTextContent("Back To Calculated, 10.05");
    commit("input-decay", "0.5");
    expect(field("input-decay")).toHaveAttribute("data-value", "1");
    expect(screen.getByTestId("note-decay")).toHaveTextContent("Raised To The Decay Reduction Below Floor, 1.00");
  });

  it("a future Valuation Date moves to today, and an expiry before the one before moves after it", async () => {
    await renderDefault();
    commit("input-valuationDate", "2026-11-05");
    expect(field("input-valuationDate").value).toBe("28-Oct-2026");
    expect(screen.getByTestId("note-valuationDate")).toHaveTextContent("Moved To Today, 28-Oct-2026");
    commit("input-expiryDates-1", "2030-02-10");
    expect(field("input-expiryDates-1").value).toBe("25-Apr-2030");
    expect(screen.getByTestId("expiry-note-1")).toHaveTextContent("Moved After Expiry 1, 25-Apr-2030");
  });

  it("text that is no number still goes back with a popup", async () => {
    await renderDefault();
    commit("input-decay", "abc");
    expect(field("input-decay").value).toBe("1.60");
    expect(screen.getByTestId("desk-dialog")).toHaveTextContent("Decay Reverted");
  });

  it("switching mode clears every note", async () => {
    await renderDefault();
    commit("input-floorUnits", "2");
    expect(screen.getByTestId("note-floorUnits")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mode-blank"));
    fireEvent.click(screen.getByTestId("confirm-switch-mode"));
    await waitFor(() => expect(field("input-valuationDate").value).toBe(""));
    expect(screen.queryByTestId("note-floorUnits")).toBeNull();
  });
});
