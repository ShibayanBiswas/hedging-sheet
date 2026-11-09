// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function renderDesk() {
  return render(
    <DeskDialogProvider>
      <DeskProvider today="2026-10-28">
        <InputsPage />
      </DeskProvider>
    </DeskDialogProvider>,
  );
}

const value = (id: string) => (screen.getByTestId(id) as HTMLInputElement).value;
const picked = (id: string) => screen.getByTestId(id).getAttribute("data-value");
const rows = () => screen.queryAllByTestId(/^leg-row-\d+$/);
const leg = (i: number) => `${value(`input-customLegs-${i}-percent`)} ${picked(`input-customLegs-${i}-optionType`)} ${picked(`input-customLegs-${i}-side`)} ${value(`input-customLegs-${i}-quantity`)}`;

async function toCustom() {
  fireEvent.click(screen.getByTestId("book-mode-custom"));
  await waitFor(() => expect(screen.getByTestId("book-mode")).toHaveAttribute("data-value", "custom"));
}

describe("Custom Option Book on the Inputs page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-28T04:30:00Z"));
    stubFetch();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts on Product Payoff with today's strikes and spreads, and switches to one leg of 100% Put Buy 1", async () => {
    renderDesk();
    await waitFor(() => expect(value("input-spot")).toBe("76,835.78"));
    expect(screen.getByTestId("book-mode")).toHaveAttribute("data-value", "product");
    expect(screen.getByTestId("book-mode-product")).toHaveAttribute("aria-checked", "true");
    expect(value("input-strikePercents-0")).toBe("137.000");
    expect(screen.getByTestId("max-coupon")).toBeInTheDocument();
    await toCustom();
    expect(rows()).toHaveLength(1);
    expect(leg(0)).toBe("100.000 P B 1.00");
    // Level In Points from the start level of 77,300.
    expect(value("input-customLegs-0-level")).toBe("77,300");
    expect(screen.getByTestId("custom-book-chip")).toHaveTextContent("Custom Option Book · 1 Leg");
    expect(screen.getByRole("table", { name: "Legs" })).toHaveTextContent(/Leg.*Level %.*Level In Points.*Option Type.*Buy Or Sell.*Quantity/);
    for (const gone of ["input-strikePercents-0", "input-spreadCount", "input-participations-0", "max-coupon", "strike-count"]) expect(screen.queryByTestId(gone), gone).toBeNull();
  });

  it("marks the product terms Not Used and keeps tenor, uplift, notional and every other group", async () => {
    renderDesk();
    await toCustom();
    expect(screen.getByTestId("terms-not-used")).toHaveTextContent(
      "Target Rise, Coupon, Protection, Decay, Decay Floor Level And Decay Reduction Below Floor: Not Used In Custom Option Book",
    );
    for (const gone of ["input-target", "input-coupon", "input-protection", "input-decay", "input-floorLevel", "input-floorUnits"]) expect(screen.queryByTestId(gone), gone).toBeNull();
    for (const kept of ["input-tenorDays", "input-startLevelUplift", "input-notionalCr", "input-nbfcRate", "input-dailyVol", "input-futuresMargin"]) expect(screen.getByTestId(kept), kept).toBeInTheDocument();
  });

  it("adds and removes legs between 1 and 10, by button and by the Number Of Legs stepper", async () => {
    renderDesk();
    await toCustom();
    expect(screen.getByTestId("custom-remove-leg-0")).toBeDisabled();
    fireEvent.click(screen.getByTestId("custom-add-leg"));
    expect(rows()).toHaveLength(2);
    expect(leg(1)).toBe("100.000 P B 1.00");
    fireEvent.change(screen.getByTestId("input-customLegs-1-percent"), { target: { value: "110" } });
    fireEvent.click(screen.getByTestId("input-customLegs-1-optionType-C"));
    fireEvent.click(screen.getByTestId("input-customLegs-1-side-S"));
    fireEvent.change(screen.getByTestId("input-customLegs-1-quantity"), { target: { value: "2.5" } });
    fireEvent.blur(screen.getByTestId("input-customLegs-1-quantity"));
    expect(leg(1)).toBe("110.000 C S 2.50");
    fireEvent.click(screen.getByTestId("custom-remove-leg-0"));
    expect(rows()).toHaveLength(1);
    expect(screen.getByTestId("input-customLegs-0-optionType")).toHaveAttribute("data-value", "C");
    fireEvent.click(screen.getByTestId("input-legCount-plus"));
    fireEvent.change(screen.getByTestId("input-legCount"), { target: { value: "10" } });
    expect(rows()).toHaveLength(10);
    expect(screen.getByTestId("custom-add-leg")).toBeDisabled();
    expect(screen.getByTestId("input-legCount-plus")).toBeDisabled();
    expect(screen.getByTestId("custom-book-chip")).toHaveTextContent("10 Legs");
    fireEvent.change(screen.getByTestId("input-legCount"), { target: { value: "3" } });
    expect(rows()).toHaveLength(3);
    expect(screen.getByTestId("input-customLegs-0-optionType")).toHaveAttribute("data-value", "C");
  });

  it("types a Level In Points back to the Level %", async () => {
    renderDesk();
    await toCustom();
    fireEvent.change(screen.getByTestId("input-customLegs-0-level"), { target: { value: "81165" } });
    fireEvent.blur(screen.getByTestId("input-customLegs-0-level"));
    expect(value("input-customLegs-0-percent")).toBe("105.000");
  });

  it("fills a template around 100% and names its legs until one is edited", async () => {
    renderDesk();
    await toCustom();
    const note = screen.getByTestId("custom-book-note");
    expect(note).toHaveTextContent(/a call is a real call/);
    fireEvent.change(screen.getByTestId("custom-template"), { target: { value: "iron-condor" } });
    expect(rows().map((_, i) => leg(i))).toEqual(["110.000 C B 1.00", "105.000 C S 1.00", "95.000 P S 1.00", "90.000 P B 1.00"]);
    expect(note).toHaveTextContent("Iron Condor: Buy 1 Call At 110%, Sell 1 Call At 105%, Sell 1 Put At 95%, Buy 1 Put At 90%.");
    expect(value("custom-template")).toBe("");
    fireEvent.change(screen.getByTestId("custom-template"), { target: { value: "call-ratio-spread" } });
    expect(rows().map((_, i) => leg(i))).toEqual(["105.000 C S 2.00", "100.000 C B 1.00"]);
    expect(note).toHaveTextContent("Call Ratio Spread 1×2: Sell 2 Call At 105%, Buy 1 Call At 100%.");
    fireEvent.click(screen.getByTestId("input-customLegs-1-side-S"));
    expect(note).toHaveTextContent(/a call is a real call/);
  });

  it("pastes whole legs in Bulk Edit Strikes and applies them only when every row reads", async () => {
    renderDesk();
    await toCustom();
    fireEvent.click(screen.getByTestId("strikes-bulk"));
    const dialog = await screen.findByTestId("bulk-strikes");
    expect(dialog).toHaveTextContent("Bulk Edit Strikes");
    const text = within(dialog).getByTestId("bulk-strikes-text");
    expect((text as HTMLTextAreaElement).value).toBe("100\tPut\tBuy\t1");
    fireEvent.change(text, { target: { value: "100\tCall\tBuy\n100\tPut\tSideways" } });
    expect(within(dialog).getByTestId("bulk-strikes-row-1")).toHaveTextContent("Buy Or Sell must be Buy or Sell.");
    expect(within(dialog).getByTestId("bulk-strikes-apply")).toBeDisabled();
    fireEvent.change(text, { target: { value: "100\tCall\tBuy\n100\tPut\tBuy\t3" } });
    fireEvent.click(within(dialog).getByTestId("bulk-strikes-apply"));
    await waitFor(() => expect(screen.queryByTestId("bulk-strikes")).toBeNull());
    expect(rows().map((_, i) => leg(i))).toEqual(["100.000 C B 1.00", "100.000 P B 3.00"]);
  });

  it("keeps each book's entries across a switch back to Product Payoff and again", async () => {
    renderDesk();
    await waitFor(() => expect(value("input-spot")).toBe("76,835.78"));
    fireEvent.change(screen.getByTestId("input-coupon"), { target: { value: "103" } });
    fireEvent.blur(screen.getByTestId("input-coupon"));
    await toCustom();
    fireEvent.change(screen.getByTestId("custom-template"), { target: { value: "long-straddle" } });
    fireEvent.click(screen.getByTestId("book-mode-product"));
    await waitFor(() => expect(screen.getByTestId("book-mode")).toHaveAttribute("data-value", "product"));
    expect(value("input-coupon")).toBe("103.000");
    expect(value("input-strikePercents-5")).toBe("70.000");
    expect(screen.queryByTestId("terms-not-used")).toBeNull();
    await toCustom();
    expect(rows().map((_, i) => leg(i))).toEqual(["100.000 C B 1.00", "100.000 P B 1.00"]);
  });

  it("in Blank Inputs starts Custom with no legs, unlocks the later steps on the legs alone, and asks for none of the product terms", async () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("mode-blank"));
    fireEvent.click(await screen.findByTestId("confirm-switch-mode"));
    await waitFor(() => expect(screen.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true"));
    fireEvent.change(screen.getByTestId("input-underlying"), { target: { value: "Sensex" } });
    const date = screen.getByTestId("input-valuationDate");
    fireEvent.focus(date);
    fireEvent.change(date, { target: { value: "28-Oct-2026" } });
    fireEvent.blur(date);
    fireEvent.change(screen.getByTestId("input-expiryCount"), { target: { value: "1" } });
    const expiry = screen.getByTestId("input-expiryDates-0");
    fireEvent.focus(expiry);
    fireEvent.change(expiry, { target: { value: "28-Mar-2030" } });
    fireEvent.blur(expiry);
    await waitFor(() => expect(screen.getByTestId("group-3")).not.toHaveAttribute("data-locked"));
    expect(screen.getByTestId("group-5")).toHaveAttribute("data-locked");
    await toCustom();
    expect(screen.getByTestId("legs-empty")).toHaveTextContent("Select Number Of Legs");
    expect(value("input-legCount")).toBe("");
    fireEvent.click(screen.getByTestId("input-legCount-plus"));
    expect(leg(0)).toBe("   ");
    expect(screen.getByTestId("group-5")).toHaveAttribute("data-locked");
    fireEvent.change(screen.getByTestId("custom-template"), { target: { value: "bull-call-spread" } });
    await waitFor(() => expect(screen.getByTestId("group-5")).not.toHaveAttribute("data-locked"));
    expect(screen.getByTestId("terms-not-used")).toBeInTheDocument();
    // Run asks for the shared terms, and none of the product's.
    await act(async () => {
      fireEvent.click(screen.getByTestId("run-simulation"));
    });
    const groups = await screen.findByTestId("desk-dialog-groups");
    expect(groups).toHaveTextContent("Tenor In Days: Tenor In Days is required.");
    expect(groups).not.toHaveTextContent(/Coupon|Decay|Number Of Spreads/);
  });
});
