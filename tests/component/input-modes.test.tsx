// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InputsPage from "@/app/page";
import { ResultGate } from "@/components/ui/result-gate";
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
      <DeskProvider>
        <InputsPage />
        <ResultGate>{() => <p>Results</p>}</ResultGate>
      </DeskProvider>
    </DeskDialogProvider>,
  );
}

describe("Inputs modes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-28T04:30:00Z"));
    stubFetch();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts in Default Values with the live spot and the run gate shown", async () => {
    renderDesk();
    expect(screen.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect((screen.getByTestId("input-spot") as HTMLInputElement).value).toBe("76835.78"));
    expect((screen.getByTestId("input-coupon") as HTMLInputElement).value).toBe("102.50");
    expect(screen.getByTestId("run-gate")).toHaveTextContent("Run The Simulation To See Results");
  });

  it("switches to Blank Inputs after confirming, with every field empty and placeholders shown", async () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("mode-blank"));
    expect(await screen.findByText("Switch Mode And Clear Results")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-switch-mode"));
    await waitFor(() => expect(screen.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true"));
    for (const id of ["input-spot", "input-coupon", "input-strikePercents-0", "input-dailyVol", "input-stressSigmas", "input-notionalCr"]) {
      const input = screen.getByTestId(id) as HTMLInputElement;
      expect(input.value, id).toBe("");
      expect(input.placeholder, id).toMatch(/^Eg /);
    }
    expect((screen.getByTestId("input-underlying") as HTMLSelectElement).value).toBe("");
    for (const j of [0, 5]) {
      expect(screen.getByTestId(`input-strikeOptionTypes-${j}`)).toHaveAttribute("data-value", "");
      expect(screen.getByTestId(`input-strikeSides-${j}`)).toHaveAttribute("data-value", "");
    }
    // No expiry count yet, so no month rows are asked for. Their exit animation is checked in the browser tests.
    expect((screen.getByTestId("input-expiryCount") as HTMLSelectElement).value).toBe("");
    expect(screen.getByTestId("fetch-live-spot")).toBeInTheDocument();
    expect(screen.getByTestId("compute-volatility")).toBeInTheDocument();
  });

  it("blocks Run Simulation in Blank Inputs with the grouped dialog and focuses the first field", async () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("mode-blank"));
    fireEvent.click(await screen.findByTestId("confirm-switch-mode"));
    await waitFor(() => expect(screen.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("run-simulation"));
    });
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Missing Or Invalid Inputs");
    expect(screen.getByTestId("desk-dialog-groups")).toHaveTextContent("Underlying And Market");
    expect(screen.getByTestId("desk-dialog-groups")).toHaveTextContent("Underlying: Select Nifty or Sensex.");
    fireEvent.click(screen.getByTestId("go-to-first-field"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("input-underlying")));
    expect(screen.getByTestId("input-spot")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows month rows once the number of expiries is picked, with dashes for their dates", async () => {
    renderDesk();
    fireEvent.click(screen.getByTestId("mode-blank"));
    fireEvent.click(await screen.findByTestId("confirm-switch-mode"));
    await waitFor(() => expect(screen.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true"));
    fireEvent.change(screen.getByTestId("input-expiryCount"), { target: { value: "3" } });
    expect(screen.getByTestId("input-expiryMonths-2")).toBeInTheDocument();
    expect(screen.getByTestId("expiry-date-0")).toHaveTextContent("-");
  });
});
