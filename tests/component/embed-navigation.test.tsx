// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmbedNavigation } from "@/components/layout/embed-navigation";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const send = (origin: string, data: unknown, source: MessageEventSource | null = window.parent) => window.dispatchEvent(new MessageEvent("message", { origin, data, source }));

describe("EmbedNavigation", () => {
  afterEach(() => {
    cleanup();
    replace.mockClear();
  });

  it("opens the route with the client router when the Workstation asks", () => {
    render(<EmbedNavigation />);
    send("https://sp-workstation.vercel.app", { type: "hedging-sheet:navigate", path: "/pricer" });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/pricer");
  });

  it("ignores any other origin or path", () => {
    render(<EmbedNavigation />);
    send("https://evil.example", { type: "hedging-sheet:navigate", path: "/pricer" });
    send("https://sp-workstation.vercel.app", { type: "hedging-sheet:navigate", path: "//evil.example" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("stops listening when it unmounts", () => {
    const { unmount } = render(<EmbedNavigation />);
    unmount();
    send("https://sp-workstation.vercel.app", { type: "hedging-sheet:navigate", path: "/pricer" });
    expect(replace).not.toHaveBeenCalled();
  });
});
