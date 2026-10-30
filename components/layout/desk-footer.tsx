"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Activity, CircleDot, Clock, Database, Server, TrendingUp, Zap } from "lucide-react";

import { useDesk } from "@/lib/context/desk-provider";
import { cn } from "@/lib/cn";
import { fmtDeskClock, fmtIstTime, fmtNumber } from "@/lib/format";
import type { SessionPhase } from "@/lib/market-data";
import { LEVEL_FIELD, UNDERLYINGS } from "@/lib/underlyings";

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

/** A coloured ring, not a filled dot, so nothing but white sits behind the footer. */
const STATUS_TONE: Record<string, string> = {
  Open: "border-emerald-600",
  "Pre Open": "border-amber-600",
  Closed: "border-stone-500",
  Holiday: "border-rose-600",
  Weekend: "border-sky-600",
  Unknown: "border-stone-400",
};

/** One footer cell: the label with its value right beside it. The grid spreads the cells edge to edge. */
function Cell({ icon, label, value, testId, extra }: { icon: ReactNode; label: string; value?: ReactNode; testId?: string; extra?: boolean }) {
  return (
    <div className={cn("footer-cell", extra && "footer-extra")} data-testid={testId}>
      <span className="footer-label inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      {value != null ? <span className="footer-value tabular-nums font-semibold text-ink">{value}</span> : null}
    </div>
  );
}

export function DeskFooter() {
  const { inputs, levels, datasetSource, datasetLoading } = useDesk();
  const now = useNow();
  const status = marketStatusLabel(levels?.sessionPhase, now);
  const database = datasetLoading ? "Checking" : datasetSource === "database" ? "Connected" : "Unavailable";
  const fetched = levels?.fetchedAt ? fmtIstTime(levels.fetchedAt) : "-";
  const icons = [Zap, TrendingUp];
  const spots = UNDERLYINGS.map((name, i) => {
    const Icon = icons[i] ?? TrendingUp;
    return { name, value: levels?.[LEVEL_FIELD[name]], icon: <Icon className="icon-xs text-stone-500" aria-hidden /> };
  });
  // The chosen underlying's close comes first.
  spots.sort((a, b) => Number(b.name === inputs.underlying) - Number(a.name === inputs.underlying));

  return (
    <footer className="relative z-10 border-t border-[color:var(--ar-border)] bg-white font-ui" data-testid="desk-footer">
      <div className="desk-footer-grid px-4 py-2 text-caption text-stone-600 md:px-6">
        <Cell extra icon={<Server className="icon-xs text-stone-500" aria-hidden />} label="Anand Rathi Wealth · Hedging Sheet" testId="footer-brand" />
        {spots.map((s) => (
          <Cell key={s.name} icon={s.icon} label={s.name} value={s.value != null ? fmtNumber(s.value, 2) : "-"} testId={`footer-${s.name.toLowerCase()}`} />
        ))}
        <Cell icon={<Clock className="icon-xs text-stone-500" aria-hidden />} label="Fetched At" value={fetched} testId="footer-fetched" />
        <Cell icon={<span className={cn("hs-status-dot border-2", STATUS_TONE[status])} aria-hidden />} label="Market" value={status} testId="footer-market-status" />
        <Cell extra icon={<CircleDot className="icon-xs text-stone-500" aria-hidden />} label="Data Source" value={levels?.source === "yahoo" ? "Yahoo Finance" : "Unavailable"} testId="footer-source" />
        <Cell
          extra
          icon={<Database className={cn("icon-xs", database === "Connected" ? "text-emerald-700" : "text-rose-700")} aria-hidden />}
          label="Database"
          value={database}
          testId="footer-mongo"
        />
        <Cell
          extra
          icon={<Activity className="icon-xs text-stone-500" aria-hidden />}
          label="Desk Clock"
          value={<span suppressHydrationWarning>{now ? fmtDeskClock(now) : "-"}</span>}
          testId="footer-clock"
        />
      </div>
    </footer>
  );
}
