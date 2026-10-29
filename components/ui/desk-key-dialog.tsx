"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";

/** Asks for the Desk Key before a save. The key is never stored; it stays in memory until the page reloads. */
export function DeskKeyDialog({ error, onSubmit, onCancel }: { error: string | null; onSubmit: (key: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button aria-label="Close dialog" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" type="button" onClick={onCancel} />
      <form
        aria-labelledby="desk-key-title"
        aria-modal="true"
        role="dialog"
        data-testid="desk-key-dialog"
        className="desk-sheet glass relative z-10 flex w-full flex-col overflow-hidden border border-gold/30 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <div className="h-1 bg-gradient-to-r from-maroon via-gold to-maroon/70" />
        <div className="flex items-start gap-3 border-b border-gold/15 px-6 py-4">
          <BrandLogo compact />
          <div className="min-w-0 flex-1">
            <p className="text-caption font-bold uppercase tracking-[0.35em] text-gold-dark">Saving</p>
            <h2 className="mt-1 font-ui text-h2 font-bold text-ink" id="desk-key-title">
              Desk Key
            </h2>
          </div>
          <KeyRound className="icon-md text-maroon" aria-hidden />
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <p className="font-ui text-body text-stone-700 dark:text-stone-300">
            Saving changes the market data for every desk user. Enter the Desk Key to continue; it is kept only until you reload the page.
          </p>
          <label className="field-label font-ui" htmlFor="desk-key-input">
            Desk Key
          </label>
          <input
            ref={input}
            id="desk-key-input"
            type="password"
            autoComplete="off"
            data-testid="desk-key-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "desk-key-error" : undefined}
            className="input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-body outline-none transition focus:border-gold"
          />
          {error ? (
            <p className="hs-error" id="desk-key-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="sheet-actions flex flex-wrap justify-end gap-2 border-t border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] px-6 py-3">
          <button type="button" className="btn-animated btn-motion btn-ghost" onClick={onCancel} data-testid="desk-key-cancel">
            Cancel
          </button>
          <button type="submit" className="btn-animated btn-motion btn-primary" data-testid="desk-key-submit">
            <span className="relative z-10">Save</span>
          </button>
        </div>
      </form>
    </div>
  );
}
