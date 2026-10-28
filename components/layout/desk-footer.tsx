"use client";

import { useEffect, useState } from "react";
import { Activity, CircleDot, Clock, Database, Server, TrendingUp, Zap } from "lucide-react";

import { useDesk } from "@/lib/context/desk-provider";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import type { SessionPhase } from "@/lib/market-data";

const IST = "Asia/Kolkata";

function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Open, Pre Open, Closed, Holiday or Weekend for the NSE cash session. */
function marketStatusLabel(phase: SessionPhase | null | undefined, now: Date | null): string {
  if (!phase) return "Unknown";
  if (phase === "open") return "Open";
  if (phase === "pre_open") return "Pre Open";
  if (phase === "closed") return "Closed";
  const weekday = now ? new Intl.DateTimeFormat("en-US", { timeZone: IST, weekday: "short" }).format(now) : "";
  return weekday === "Sat" || weekday === "Sun" ? "Weekend" : "Holiday";
}

const STATUS_TONE: Record<string, string> = {
  Open: "bg-emerald-500",
  "Pre Open": "bg-amber-500",
  Closed: "bg-stone-400",
  Holiday: "bg-rose-500",
  Weekend: "bg-sky-500",
  Unknown: "bg-stone-300",
};

export function DeskFooter() {
  const { levels, datasetSource, datasetLoading } = useDesk();
  const now = useNow();
  const status = marketStatusLabel(levels?.sessionPhase, now);
  const mongo = datasetLoading ? "Checking" : datasetSource === "database" ? "Connected" : "Unavailable";
  const fetched = levels?.fetchedAt
    ? new Date(levels.fetchedAt).toLocaleTimeString("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <footer
      className="relative z-10 mt-8 border-t border-stone-200 bg-white/90 font-ui backdrop-blur-xl dark:border-[var(--ar-border)] dark:bg-[color-mix(in_srgb,var(--ar-surface)_92%,transparent)]"
      data-testid="desk-footer"
    >
      <div className="mx-auto flex max-w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-caption text-stone-500 dark:text-stone-400 md:px-6 xl:px-8">
        {/* Phones: the live closes on one line, Fetched At and the market status on the next. */}
        <div className="grid w-full grid-cols-2 items-center gap-x-4 gap-y-1 sm:flex sm:w-auto sm:flex-wrap sm:gap-4">
          <span className="footer-extra inline-flex items-center gap-2">
            <Server className="icon-xs text-gold" />
            Anand Rathi Wealth · Hedging Sheet
          </span>
          <span className="inline-flex items-center gap-2" data-testid="footer-nifty">
            <Zap className="icon-xs text-gold" />
            Nifty <strong className="inline-block min-w-[9ch] tabular-nums text-ink">{levels?.niftyLevel != null ? fmtNumber(levels.niftyLevel, 2) : "-"}</strong>
          </span>
          <span className="inline-flex items-center gap-2" data-testid="footer-sensex">
            <TrendingUp className="icon-xs text-emerald-700 dark:text-emerald-400" />
            Sensex <strong className="inline-block min-w-[9ch] tabular-nums text-ink">{levels?.sensexLevel != null ? fmtNumber(levels.sensexLevel, 2) : "-"}</strong>
          </span>
          <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2" data-testid="footer-fetched">
            <Clock className="icon-xs text-violet-700 dark:text-violet-300" />
            Fetched At <span className="inline-block min-w-[12ch]">{fetched ? `${fetched} IST` : "-"}</span>
          </span>
          <span className="inline-flex items-center gap-2" data-testid="footer-market-status">
            <span className={cn("hs-status-dot", STATUS_TONE[status])} aria-hidden />
            Market <span className="inline-block min-w-[8ch]">{status}</span>
          </span>
        </div>
        <div className="footer-extra flex flex-wrap items-center gap-3">
          <span className="hs-chip inline-flex items-center gap-2" data-testid="footer-source">
            <CircleDot className="icon-xs text-gold-dark" />
            {levels?.source === "yahoo" ? "Yahoo Finance Closes" : "Closes Unavailable"}
          </span>
          <span className="hs-chip inline-flex items-center gap-2" data-testid="footer-mongo">
            <Database className={cn("icon-xs", mongo === "Connected" ? "text-emerald-700" : "text-rose-600")} />
            Mongo {mongo}
          </span>
          <span className="inline-flex items-center gap-2">
            <Activity className="icon-xs text-emerald-800 dark:text-emerald-400" />
            <span suppressHydrationWarning>
              Desk Clock <span className="inline-block min-w-[22ch] tabular-nums">{now ? now.toLocaleString("en-IN", { timeZone: IST }) : "-"}</span>
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
