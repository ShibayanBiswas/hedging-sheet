// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteNav } from "@/components/layout/site-nav";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

let root: Root | undefined;
let box: HTMLElement | undefined;

/** Server HTML, then whatever the person did before the scripts arrived, then hydration, in Strict Mode as next dev runs it. */
async function hydrateAfter(before: (rail: HTMLElement) => void): Promise<HTMLElement> {
  const tree = (
    <StrictMode>
      <SiteNav />
    </StrictMode>
  );
  box = document.createElement("div");
  document.body.appendChild(box);
  box.innerHTML = renderToString(tree);
  const rail = box.querySelector<HTMLElement>('[data-testid="nav-rail"]')!;
  // jsdom lays nothing out, so the rail has room for one tab and every later tab sits beyond it.
  Object.defineProperty(rail, "clientWidth", { value: 100, configurable: true });
  box.querySelectorAll<HTMLElement>('a[data-testid^="nav-"]').forEach((a, i) => {
    Object.defineProperty(a, "offsetLeft", { value: i * 100, configurable: true });
    Object.defineProperty(a, "offsetWidth", { value: 100, configurable: true });
  });
  before(rail);
  await act(async () => {
    root = hydrateRoot(box!, tree);
  });
  return rail;
}

describe("Tab rail when the page hydrates", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    box?.remove();
    vi.restoreAllMocks();
    route.pathname = "/";
  });

  it("stays where it was scrolled to before hydration, even with effects run twice", async () => {
    const rail = await hydrateAfter((el) => {
      el.scrollLeft = 300;
    });
    expect(rail.scrollLeft).toBe(300);
  });

  it("stays put while a tab is being pressed, even when the open tab is out of view", async () => {
    route.pathname = "/logic-atlas";
    const realQuery = Element.prototype.querySelector;
    vi.spyOn(Element.prototype, "querySelector").mockImplementation(function (this: Element, selector: string) {
      return selector === ":active" ? document.createElement("a") : realQuery.call(this, selector);
    });
    const rail = await hydrateAfter(() => undefined);
    expect(rail.scrollLeft).toBe(0);
  });

  it("brings the open tab into view when nothing has touched the rail", async () => {
    route.pathname = "/logic-atlas";
    const rail = await hydrateAfter(() => undefined);
    expect(rail.scrollLeft).toBeGreaterThan(0);
  });

  it("still brings the open tab into view on a later change of tab", async () => {
    const rail = await hydrateAfter((el) => {
      el.scrollLeft = 0;
    });
    expect(rail.scrollLeft).toBe(0);
    route.pathname = "/logic-atlas";
    await act(async () => {
      root!.render(
        <StrictMode>
          <SiteNav />
        </StrictMode>,
      );
    });
    expect(rail.scrollLeft).toBeGreaterThan(0);
  });
});
