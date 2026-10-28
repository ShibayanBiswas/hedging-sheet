// jest-dom matchers for component tests; harmless in the node environment.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom lacks the browser APIs framer-motion and the focus helper use.
if (typeof window !== "undefined") {
  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  });
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (window as unknown as Record<string, unknown>).IntersectionObserver ??= Observer;
  (window as unknown as Record<string, unknown>).ResizeObserver ??= Observer;
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
}
