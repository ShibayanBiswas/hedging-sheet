"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FileSpreadsheet, Loader2, Search, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { BrandLogo } from "@/components/layout/brand-logo";
import { CommandPalette } from "@/components/layout/command-palette";
import { DeskFooter } from "@/components/layout/desk-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDesk } from "@/lib/context/desk-provider";
import { useSurfaceUpload } from "@/lib/context/surface-upload-provider";
import { underlyingName } from "@/lib/inputs/draft";
import { useScrollRails } from "@/lib/hooks/use-scroll-rails";
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
        className={cn("btn-animated btn-motion btn-primary !px-3 !py-2 text-caption", disabled && "pointer-events-none opacity-50")}
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
        <span className="relative z-10 inline-flex items-center gap-2">
          {busy ? <Loader2 className="icon-xs animate-spin" /> : <Download className="icon-xs" />}
          Download Excel
        </span>
      </button>
    </div>
  );
}

/** Unwinding style header upload shortcut. */
function HeaderUploadShortcut() {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { choose, busy } = useSurfaceUpload();
  return (
    <>
      <button
        type="button"
        className="btn-animated btn-motion btn-accent !px-3 !py-2"
        title="Upload Surface"
        aria-label="Upload Surface"
        data-testid="header-upload"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        <span className="btn-shine" aria-hidden />
        <span className="relative z-10 inline-flex items-center gap-2">
          <Upload className="icon-xs" />
          <FileSpreadsheet className="hidden icon-xs sm:inline" />
          <span className="hidden lg:inline">{busy ? "Uploading" : "Upload Surface"}</span>
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
          e.target.value = "";
          if (!file) return;
          // The preview and the outcome show on Market Data.
          if (pathname !== "/market-data") router.push("/market-data");
          void choose(file);
        }}
      />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { inputs } = useDesk();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useScrollRails();

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
    <div className="relative flex min-h-dvh flex-col bg-mesh font-serif">
      <div className="desk-ambient-orbs" aria-hidden>
        <span className="desk-ambient-orb desk-ambient-orb--gold" />
        <span className="desk-ambient-orb desk-ambient-orb--maroon" />
      </div>
      <header className="brand-header sticky top-0 z-50 font-ui">
        <div className="brand-header-glow" />
        <div className="brand-header-row">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <BrandLogo />
            <div className="shrink-0 border-l border-[color:var(--ar-border)] pl-4">
              <p className="brand-title">Hedging Sheet</p>
            </div>
            <span className="hs-chip hs-chip-maroon" data-testid="underlying-badge">
              {underlyingName(inputs)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="btn-ghost btn-animated inline-flex items-center gap-2" type="button" onClick={() => setPaletteOpen(true)}>
              <Search className="icon-sm" aria-hidden />
              <span className="sr-only md:not-sr-only">Search</span>
              <kbd className="hidden rounded border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-caption text-stone-500 dark:border-stone-700 dark:bg-stone-900/80 lg:inline">
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
      <main className="relative z-10 mx-auto w-full max-w-full flex-1 px-4 py-6 md:px-6 xl:px-8">{children}</main>
      <DeskFooter />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
