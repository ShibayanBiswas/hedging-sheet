"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Command, X } from "lucide-react";

import { NAV_ITEMS } from "@/lib/navigation";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onOpenChange]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? NAV_ITEMS.filter((r) => r.label.toLowerCase().includes(needle)) : NAV_ITEMS;
  }, [query]);

  if (!open || typeof document === "undefined") return null;

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-start sm:p-4 sm:pt-12" role="presentation">
      <button aria-label="Close search" className="absolute inset-0 bg-stone-950/55 backdrop-blur-[3px]" type="button" onClick={close} />
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-labelledby={titleId}
        aria-modal="true"
        className="desk-sheet glass relative z-10 flex w-full flex-col overflow-hidden shadow-[0_28px_80px_-24px_rgba(17,17,17,0.55)] sm:max-w-xl"
        initial={{ opacity: 0, scale: 0.97, y: -14 }}
        role="dialog"
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        <div className="flex items-center gap-3 border-b border-[color:var(--ar-border)] px-4 py-3">
          <Command className="icon-sm shrink-0 text-gold-dark" aria-hidden />
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent font-ui text-body text-ink outline-none placeholder:text-stone-400"
            id={titleId}
            placeholder="Jump to a page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                router.push(results[0].href);
                close();
              }
            }}
          />
          <button aria-label="Close" className="rounded-lg p-1 text-stone-500 hover:text-ink" type="button" onClick={close}>
            <X className="icon-sm" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-[min(50dvh,28rem)]">
          <p className="px-3 py-1 font-ui text-caption font-bold uppercase tracking-widest text-stone-500">Navigate</p>
          {results.map((route) => {
            const Icon = route.icon;
            return (
              <button
                key={route.href}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left font-ui text-body text-stone-700 hover:bg-gold/10 hover:text-ink"
                type="button"
                onClick={() => {
                  router.push(route.href);
                  close();
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="icon-sm text-gold-dark" aria-hidden />
                  {route.label}
                </span>
                <ArrowRight className="icon-xs opacity-40" />
              </button>
            );
          })}
          {!results.length ? <p className="px-3 py-6 text-center font-ui text-body text-stone-500">No matches.</p> : null}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
