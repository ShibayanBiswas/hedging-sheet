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
  return <span suppressHydrationWarning>Desk Clock {now ? now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</span>;
}

export function DeskFooter() {
  const { result, market, inputs, datasetSource } = useDesk();
  const legs = result.ok ? result.pricer.legs.length * result.pricer.halves : 0;
  const source = inputs.mode === "workbook" ? "Workbook Seed" : datasetSource === "database" ? "Desk Database" : "Built In Seed";
  return (
    <footer className="relative z-10 mt-8 border-t border-[color:var(--ar-border)] bg-[color:var(--ar-header-bg)] font-ui backdrop-blur-xl">
      <div className="mx-auto flex max-w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px] text-stone-500 dark:text-stone-400 lg:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-gold" aria-hidden />
            Anand Rathi Wealth · Hedging Sheet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-gold-light" aria-hidden />
            {legs} Option Leg Columns
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <DeskClock />
          </span>
        </div>
        <p className="max-w-xl truncate text-right italic">
          {market.surface.label} · {source}
        </p>
      </div>
    </footer>
  );
}
