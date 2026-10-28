"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { MarketStrip } from "@/components/layout/market-strip";
import { moveFocusWithArrows } from "@/lib/keyboard";
import { activeNav, NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/cn";

/** Primary SP Dashboard tab bar: pill shell, sliding active pill, icon hover. Tabs share the full width. */
export function SiteNav() {
  const pathname = usePathname();
  const section = activeNav(pathname);
  const reduce = useReducedMotion();

  return (
    <div className="border-t border-[color:var(--ar-border)]">
      <MarketStrip />
      <nav aria-label="Sections" className="mx-auto max-w-full px-4 py-2 lg:px-6">
        <div
          className="nav-pill-shell flex w-full items-stretch gap-1 overflow-x-auto rounded-2xl border p-1 shadow-sm"
          onKeyDown={(e) => moveFocusWithArrows(e, "a[data-testid^='nav-']")}
        >
          {NAV_ITEMS.map((item) => {
            const active = section.id === item.id;
            const Icon = item.icon;
            return (
              <motion.div key={item.id} className="flex min-w-max flex-1" whileTap={reduce ? undefined : { scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-testid={`nav-${item.id}`}
                  className={cn(
                    "relative flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 font-ui text-sm font-semibold transition-all",
                    active ? "btn-nav-active text-ink" : "text-muted hover:bg-[color:var(--ar-panel)] hover:text-ink",
                  )}
                >
                  {active ? (
                    <motion.span
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-gold/25 to-maroon/20 shadow-lg shadow-gold/10 dark:from-gold/6 dark:to-transparent dark:shadow-none"
                      layoutId={reduce ? undefined : "main-nav-active"}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    />
                  ) : null}
                  <motion.span
                    className="relative inline-flex"
                    whileHover={reduce ? undefined : { scale: 1.12, rotate: -4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.span>
                  <span className="relative">{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
