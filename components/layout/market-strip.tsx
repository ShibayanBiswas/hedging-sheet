"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Database, Play } from "lucide-react";

import { useDesk } from "@/lib/context/desk-provider";
import { formatDate } from "@/lib/engine/dates";
import { deskEase } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Valuation date, surface month and simulation status. Live spots and the market status sit in the footer. */
export function MarketStrip() {
  const { inputs, market, lastRun, stale, simulation } = useDesk();
  const reduce = useReducedMotion();
  const runState = simulation.running ? "Running" : !lastRun ? "Not Run" : stale ? "Inputs Changed" : "Up To Date";

  const items = [
    { icon: CalendarClock, label: "Valuation", value: formatDate(inputs.valuationDate), color: "text-violet-700 dark:text-violet-300" },
    { icon: Database, label: "Surface", value: market.surface.label.replace(" Volatility Surface", ""), color: "text-sky-700 dark:text-sky-300" },
    { icon: Play, label: "Simulation", value: runState, color: stale || !lastRun ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300" },
  ];

  return (
    <div className="market-strip market-strip-live overflow-hidden" data-testid="market-strip">
      <div className="mx-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-6 xl:px-8">
        {items.map((item, index) => (
          <motion.span
            key={item.label}
            className="inline-flex items-center gap-2 font-ui text-caption"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.35, ease: deskEase }}
          >
            <item.icon className={cn("icon-xs", item.color)} aria-hidden />
            <span className="text-muted">{item.label}</span>
            <span className={cn("font-semibold text-ink", item.color)} data-testid={`strip-${item.label.toLowerCase()}`}>
              {item.value}
            </span>
          </motion.span>
        ))}
      </div>
    </div>
  );
}
