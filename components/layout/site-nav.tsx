"use client";

import { useEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { m, useReducedMotion } from "framer-motion";

import { moveFocusWithArrows } from "@/lib/keyboard";
import { activeNav, NAV_ITEMS } from "@/lib/navigation";
/** A faint bar under a tab while its page is on the way: every page is rendered per request, so the wait can be felt. */
function PendingHint() {
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-tab-pending" aria-hidden data-testid="nav-pending" /> : null;
}

/** Primary SP Dashboard tab bar: pill shell, sliding active pill, icon hover. Tabs share the full width. */
export function SiteNav() {
  const pathname = usePathname();
  const section = activeNav(pathname);
  const reduce = useReducedMotion();
  const rail = useRef<HTMLDivElement>(null);
  const shownFor = useRef<string | null>(null);

  // On narrow screens the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    const el = rail.current;
    const current = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !current) return;
    // Only a new tab moves the rail; next dev runs this effect twice for one page.
    if (shownFor.current === pathname) return;
    const first = shownFor.current === null;
    shownFor.current = pathname;
    // A press forces hydration and this effect runs inside it, so moving the rail now would pull the tab from under the finger:
    // the press ends on another tab, the click goes to the rail and nothing opens. A rail already scrolled or pressed stays put.
    if (first && (el.scrollLeft > 0 || el.querySelector(":active"))) return;
    const left = current.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + current.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, left - (el.clientWidth - current.offsetWidth) / 2);
    }
  }, [pathname]);

  return (
    <div className="border-t border-[color:var(--ar-border)]">
      <nav aria-label="Sections" className="shell-pad py-1">
        <div
          ref={rail}
          data-testid="nav-rail"
          className="nav-pill-shell nav-rail-no-scrollbar flex w-full items-stretch gap-1 overflow-x-auto rounded-xl border p-1 shadow-sm"
          onKeyDown={(e) => moveFocusWithArrows(e, "a[data-testid^='nav-']")}
        >
          {NAV_ITEMS.map((item) => {
            const active = section.id === item.id;
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex min-w-max flex-1 lg:min-w-min lg:flex-auto">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-testid={`nav-${item.id}`}
                  className="nav-tab glass-control relative flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 font-ui text-body font-semibold lg:gap-1 lg:px-2 lg:text-caption xl:gap-2 xl:px-3 xl:text-body"
                >
                  {active ? (
                    <m.span
                      className="glass-active-pill absolute inset-0 rounded-lg"
                      layoutId={reduce ? undefined : "main-nav-active"}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    />
                  ) : null}
                  <span className="relative inline-flex">
                    <Icon className="icon-nav" aria-hidden />
                  </span>
                  <span className="relative">{item.label}</span>
                  <PendingHint />
                </Link>
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
