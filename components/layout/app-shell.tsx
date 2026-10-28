"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FileSpreadsheet, Loader2, Search, Upload } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { CommandPalette } from "@/components/layout/command-palette";
import { DeskFooter } from "@/components/layout/desk-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDesk } from "@/lib/context/desk-provider";
import { useSurfaceUpload } from "@/lib/hooks/use-surface-upload";
import { cn } from "@/lib/cn";

function DownloadExcelButton() {
  const { lastRun, stale } = useDesk();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const disabled = !lastRun || busy;
  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {status ? (
          <motion.span key={status} className="hs-chip hidden md:inline-flex" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            {status}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        data-testid="download-excel"
        disabled={disabled}
        title={!lastRun ? "Run the simulation first" : stale ? "Downloads the last run; the inputs have changed since" : "Download the five sheet workbook"}
        className={cn("btn-animated btn-motion btn-primary !px-3 !py-1.5 text-xs", disabled && "pointer-events-none opacity-50")}
        onClick={async () => {
          if (!lastRun) return;
          setBusy(true);
          setStatus(null);
          try {
            const { downloadHedgingExcel } = await import("@/lib/workbook/excel-runtime");
            setStatus(`Saved ${await downloadHedgingExcel(lastRun.result)}`);
          } catch {
            setStatus("Download Failed");
          } finally {
            setBusy(false);
            window.setTimeout(() => setStatus(null), 5_000);
          }
        }}
      >
        <span className="btn-shine" aria-hidden />
        <span className="relative z-10 inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download Excel
        </span>
      </button>
    </div>
  );
}

/** Unwinding style header upload shortcut. */
function HeaderUploadShortcut() {
  const ref = useRef<HTMLInputElement>(null);
  const { upload, busy } = useSurfaceUpload();
  return (
    <>
      <button
        type="button"
        className="btn-animated btn-motion btn-accent !px-3 !py-1.5 text-xs"
        title="Upload Volatility Surface"
        aria-label="Upload Volatility Surface"
        data-testid="header-upload"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        <span className="btn-shine" aria-hidden />
        <span className="relative z-10 inline-flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          <FileSpreadsheet className="hidden h-3.5 w-3.5 sm:inline" />
          <span className="hidden lg:inline">{busy ? "Uploading" : "Upload Volatility Surface"}</span>
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="hidden"
        data-testid="header-upload-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { inputs } = useDesk();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-mesh font-serif">
      <div className="desk-ambient-orbs" aria-hidden>
        <span className="desk-ambient-orb desk-ambient-orb--gold" />
        <span className="desk-ambient-orb desk-ambient-orb--maroon" />
      </div>
      <header className="brand-header sticky top-0 z-50 font-ui">
        <div className="brand-header-glow" />
        <div className="brand-header-row">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo />
            <div className="min-w-0 border-l border-[color:var(--ar-border)] pl-4">
              <h1 className="brand-title">Hedging Sheet</h1>
            </div>
            <span className="hs-chip hs-chip-maroon" data-testid="underlying-badge">
              {inputs.underlying}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" type="button" onClick={() => setPaletteOpen(true)}>
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search</span>
              <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px] text-stone-500 dark:border-stone-700 dark:bg-stone-900/80">
                Ctrl K
              </kbd>
            </button>
            <ThemeToggle />
            <HeaderUploadShortcut />
            <DownloadExcelButton />
          </div>
        </div>
        <SiteNav />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-full flex-1 px-4 py-5 lg:px-6">{children}</main>
      <DeskFooter />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
