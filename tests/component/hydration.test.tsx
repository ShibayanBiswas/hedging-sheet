// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InputsPage from "@/app/page";
import { MarketStrip } from "@/components/layout/market-strip";
import { DeskDialogProvider } from "@/lib/context/desk-dialog-provider";
import { DeskProvider } from "@/lib/context/desk-provider";
import { istTodayYmd } from "@/lib/engine/dates";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

const SERVER_NOW = "2026-10-28T04:30:00.000Z";

let root: Root | undefined;
let box: HTMLElement | undefined;

/** Renders on the server's clock, then hydrates on the browser's, and returns what React had to recover from. */
async function hydrateAt(browserNow: string): Promise<unknown[]> {
  vi.setSystemTime(new Date(SERVER_NOW));
  const tree = (
    <DeskDialogProvider>
      <DeskProvider today={istTodayYmd()}>
        <MarketStrip />
        <InputsPage />
      </DeskProvider>
    </DeskDialogProvider>
  );
  const html = renderToString(tree);
  box = document.createElement("div");
  document.body.appendChild(box);
  box.innerHTML = html;
  vi.setSystemTime(new Date(browserNow));
  const recovered: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(box!, tree, { onRecoverableError: (error) => recovered.push(error) });
  });
  return recovered;
}

describe("first render, server and browser on different IST dates", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The requests stay pending, so nothing but the first render and the browser's own clock moves the page.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    box?.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("hydrates with no mismatch when the browser's clock is a day ahead, on the server's date", async () => {
    const recovered = await hydrateAt("2026-10-29T04:30:00.000Z");
    expect(recovered).toEqual([]);
    expect(screen.getByTestId("strip-valuation")).toHaveTextContent("28-Oct-2026");
    expect((screen.getByTestId("input-valuationDate") as HTMLInputElement).value).toBe("28-Oct-2026");
  });

  it("hydrates with no mismatch when the browser's clock is a day behind, then validates on the browser's clock as it always has", async () => {
    const recovered = await hydrateAt("2026-10-27T04:30:00.000Z");
    expect(recovered).toEqual([]);
    expect(screen.getByTestId("strip-valuation")).toHaveTextContent("28-Oct-2026");
    expect(screen.getByTestId("input-valuationDate")).toHaveAttribute("aria-invalid", "true");
  });

  it("hydrates with no mismatch and no error when the clocks agree", async () => {
    const recovered = await hydrateAt(SERVER_NOW);
    expect(recovered).toEqual([]);
    expect(screen.getByTestId("input-valuationDate")).not.toHaveAttribute("aria-invalid");
  });

  it("does not move the valuation date when the browser's date differs, and the default expiries stay on it", async () => {
    await hydrateAt("2026-11-03T04:30:00.000Z");
    expect((screen.getByTestId("input-valuationDate") as HTMLInputElement).value).toBe("28-Oct-2026");
    expect((screen.getByTestId("input-expiryDates-0") as HTMLInputElement).value).toBe("28-Mar-2030");
  });
});
