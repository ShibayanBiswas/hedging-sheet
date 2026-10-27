"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, Moon, Sun } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { DeskFooter } from "@/components/layout/desk-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { useDesk } from "@/lib/context/desk-provider";
import { useTheme } from "@/lib/context/theme-provider";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

function fetchedAtText(iso: string | undefined, loading: boolean): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return loading ? "Fetching" : "Yahoo Unavailable";
  return `Fetched At ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}`;
}

function DownloadExcelButton() {
  const { result } = useDesk();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const disabled = !result.ok || busy;
  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {status ? (
          <motion.span
            key={status}
            className="hs-chip hidden md:inline-flex"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            {status}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        data-testid="download-excel"
        disabled={disabled}
        title={result.ok ? "Download the five sheet workbook" : "Fix the input errors before downloading"}
        className={cn("btn-animated btn-motion btn-primary", disabled && "pointer-events-none opacity-50")}
        onClick={async () => {
          if (!result.ok) return;
          setBusy(true);
          setStatus(null);
          try {
            const { downloadHedgingExcel } = await import("@/lib/workbook/excel-runtime");
            const name = await downloadHedgingExcel(result);
            setStatus(`Saved ${name}`);
          } catch {
            setStatus("Download Failed");
          } finally {
            setBusy(false);
            window.setTimeout(() => setStatus(null), 5_000);
          }
        }}
      >
        <span className="btn-shine" aria-hidden />
        <span className="relative z-10 inline-flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download Excel
        </span>
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { inputs, levels, levelsLoading } = useDesk();
  const { theme, toggle } = useTheme();
  const live = inputs.underlying === "Sensex" ? levels?.sensexLevel : levels?.niftyLevel;

  return (
    <div className="relative flex min-h-screen flex-col bg-mesh font-serif">
      <div className="desk-ambient-orbs" aria-hidden>
        <span className="desk-ambient-orb desk-ambient-orb--gold" />
        <span className="desk-ambient-orb desk-ambient-orb--maroon" />
      </div>
      <header className="brand-header sticky top-0 z-50 font-ui">
        <div className="brand-header-glow" />
        <div className="brand-header-row">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <BrandLogo />
            <div className="min-w-0 border-l border-[color:var(--ar-border)] pl-4">
              <h1 className="brand-title">Hedging Sheet</h1>
            </div>
            <span className="hs-chip hs-chip-maroon" data-testid="underlying-badge">
              {inputs.underlying}
            </span>
            <span className="hs-chip" data-testid="live-spot" title="Last completed session close from Yahoo Finance">
              Live {inputs.underlying} {live != null ? fmtNumber(live, 2) : "-"}
              <span className="text-muted">· {fetchedAtText(levels?.fetchedAt, levelsLoading || !levels)}</span>
            </span>
            <span className="hs-chip" data-testid="mode-badge">
              {inputs.mode === "workbook" ? "Workbook Defaults" : "Live Market"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs"
              aria-label="Toggle theme"
              data-testid="theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <DownloadExcelButton />
          </div>
        </div>
        <SiteNav />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-full flex-1 px-4 py-5 lg:px-6">{children}</main>
      <DeskFooter />
    </div>
  );
}
