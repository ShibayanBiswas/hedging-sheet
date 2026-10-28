"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Server } from "lucide-react";

import { useDesk } from "@/lib/context/desk-provider";

function DeskClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>Desk clock {now ? now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</span>;
}

export function DeskFooter() {
  const { market, lastRun, datasetSource, datasetLoading } = useDesk();
  const legs = lastRun ? lastRun.result.pricer.legs.length * lastRun.result.pricer.halves : 0;
  const source = datasetLoading ? "Loading desk data" : datasetSource === "database" ? "Desk database" : "Built in surface";
  return (
    <footer className="relative z-10 mt-8 border-t border-stone-200 bg-white/90 font-ui backdrop-blur-xl dark:border-[var(--ar-border)] dark:bg-[color-mix(in_srgb,var(--ar-surface)_92%,transparent)]">
      <div className="mx-auto flex max-w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px] text-stone-500 dark:text-stone-400 lg:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-gold" />
            Anand Rathi Wealth · Hedging Sheet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-gold-light" />
            {lastRun ? `${legs} option leg columns` : "Simulation not run"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-400" />
            <DeskClock />
          </span>
        </div>
        <p className="max-w-xl truncate text-right italic text-stone-500" suppressHydrationWarning>
          {market.surface.label} · {source}
        </p>
      </div>
    </footer>
  );
}
