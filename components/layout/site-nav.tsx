"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { activeNav, NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/cn";

export function SiteNav() {
  const pathname = usePathname();
  const active = activeNav(pathname);
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Sections"
      className="border-t border-[color:var(--ar-border)] bg-[color:var(--ar-subnav-bg)] backdrop-blur-xl"
    >
      <div className="hs-nav-rail mx-auto flex max-w-full items-center gap-1 overflow-x-auto px-4 py-2 lg:px-6">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active.id;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              data-testid={`nav-${item.id}`}
              className={cn(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
                isActive ? "btn-nav-active text-ink" : "text-muted hover:bg-[color:var(--ar-panel)] hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{item.label}</span>
              {isActive ? (
                <motion.span
                  className="hs-tab-underline"
                  layoutId={reduce ? undefined : "hs-tab-underline"}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
