"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, FileSpreadsheet, Loader2, Search, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { BrandLogo } from "@/components/layout/brand-logo";
import { CommandPalette } from "@/components/layout/command-palette";
import { DeskFooter } from "@/components/layout/desk-footer";
import { MarketStrip } from "@/components/layout/market-strip";
import { SiteNav } from "@/components/layout/site-nav";
import { useDesk } from "@/lib/context/desk-provider";
import { useSurfaceUpload } from "@/lib/context/surface-upload-provider";
import { fmtDeskClock } from "@/lib/format";
import { underlyingName } from "@/lib/inputs/draft";
import { useScrollRails } from "@/lib/hooks/use-scroll-rails";
import { cn } from "@/lib/cn";

function DownloadExcelButton() {
  const { lastRun, staleInputs } = useDesk();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const disabled = !lastRun || staleInputs || busy;
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
        title={!lastRun ? "Run the simulation first" : staleInputs ? "The inputs have changed; run the simulation again" : "Download every tab as one Excel file"}
        aria-label="Download Excel"
        className={cn("btn-animated btn-motion btn-primary btn-compact", disabled && "pointer-events-none opacity-50")}
        onClick={async () => {
          if (!lastRun) return;
          setBusy(true);
          setStatus(null);
          try {
            const { downloadHedgingExcel } = await import("@/lib/excel/excel-runtime");
            setStatus(`Saved ${await downloadHedgingExcel(lastRun.result, { market: lastRun.market, runAt: fmtDeskClock(new Date(lastRun.at)) })}`);
          } catch {
            setStatus("Download Failed");
          } finally {
            setBusy(false);
            window.setTimeout(() => setStatus(null), 5_000);
          }
        }}
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          {busy ? <Loader2 className="icon-xs animate-spin" /> : <Download className="icon-xs" />}
          <span className="hidden xl:inline">Download Excel</span>
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
        className="btn-animated btn-motion btn-accent btn-compact max-sm:hidden"
        title="Upload Surface"
        aria-label="Upload Surface"
        data-testid="header-upload"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          <Upload className="icon-xs" />
          <FileSpreadsheet className="hidden icon-xs xl:inline" />
          <span className="hidden xl:inline">{busy ? "Uploading" : "Upload Surface"}</span>
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
      <header className="brand-header sticky top-0 z-50 font-ui" data-testid="site-header">
        <div className="brand-header-glow" />
        <div className="brand-header-row">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <BrandLogo />
            <p className="brand-title border-l border-[color:var(--ar-border)] pl-3">Hedging Sheet</p>
            <span className="hs-chip hs-chip-maroon hidden sm:inline-flex" data-testid="underlying-badge">
              {underlyingName(inputs)}
            </span>
          </div>
          <MarketStrip />
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button className="btn-ghost btn-animated btn-compact inline-flex items-center gap-2" type="button" onClick={() => setPaletteOpen(true)}>
              <Search className="icon-sm" aria-hidden />
              <span className="sr-only">Search</span>
              <kbd className="hidden rounded border border-stone-200 px-1 font-mono text-caption text-stone-600 xl:inline">Ctrl K</kbd>
            </button>
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
