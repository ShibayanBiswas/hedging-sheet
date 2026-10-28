"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, CalendarClock, Database, Play, TrendingUp, Zap } from "lucide-react";

import { useDesk } from "@/lib/context/desk-provider";
import { formatDate } from "@/lib/engine/dates";
import { fmtNumber } from "@/lib/format";
import { deskEase } from "@/lib/motion";
import { cn } from "@/lib/cn";

export function MarketStrip() {
  const { levels, inputs, market, lastRun, stale, simulation } = useDesk();
  const reduce = useReducedMotion();
  const runState = simulation.running ? "Running" : !lastRun ? "Not Run" : stale ? "Inputs Changed" : "Up To Date";

  const items = [
    { icon: Zap, label: "Nifty", value: levels?.niftyLevel != null ? fmtNumber(levels.niftyLevel, 2) : "-", color: "text-gold" },
    { icon: TrendingUp, label: "Sensex", value: levels?.sensexLevel != null ? fmtNumber(levels.sensexLevel, 2) : "-", color: "text-emerald-800 dark:text-emerald-400" },
    { icon: CalendarClock, label: "Valuation", value: formatDate(inputs.valuationDate), color: "text-violet-700 dark:text-violet-300" },
    { icon: Database, label: "Surface", value: market.surface.label.replace(" Volatility Surface", ""), color: "text-sky-700 dark:text-sky-300" },
    { icon: Play, label: "Simulation", value: runState, color: stale || !lastRun ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300" },
  ];

  return (
    <div className="market-strip market-strip-live overflow-hidden" data-testid="market-strip">
      <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-4 py-1.5 lg:px-6">
        <div className="flex flex-wrap items-center gap-4">
          {items.map((item, index) => (
            <motion.span
              key={item.label}
              className="inline-flex items-center gap-1.5 font-ui text-[11px]"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.35, ease: deskEase }}
              whileHover={reduce ? undefined : { y: -1, scale: 1.04 }}
            >
              <motion.span
                animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: index * 0.15 }}
              >
                <item.icon className={cn("h-3 w-3", item.color)} />
              </motion.span>
              <span className="text-muted">{item.label}</span>
              <span className={cn("font-semibold text-ink", item.color)}>{item.value}</span>
            </motion.span>
          ))}
        </div>
        <motion.p
          className="hidden truncate font-ui text-[10px] text-muted md:block"
          animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Activity className="mr-1 inline h-3 w-3" aria-hidden />
          {levels?.fetchedAt
            ? `Closes fetched ${new Date(levels.fetchedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST`
            : "Fetching closes"}
        </motion.p>
      </div>
    </div>
  );
}
