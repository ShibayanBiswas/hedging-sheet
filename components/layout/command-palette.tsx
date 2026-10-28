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
    <div className="fixed inset-0 z-[300] flex items-start justify-center p-4 pt-[min(12vh,6rem)]" role="presentation">
      <button aria-label="Close search" className="absolute inset-0 bg-stone-950/55 backdrop-blur-[3px]" type="button" onClick={close} />
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-labelledby={titleId}
        aria-modal="true"
        className="glass relative z-10 w-full max-w-xl overflow-hidden rounded-2xl shadow-[0_28px_80px_-24px_rgba(17,17,17,0.55)]"
        initial={{ opacity: 0, scale: 0.97, y: -14 }}
        role="dialog"
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        <div className="flex items-center gap-3 border-b border-[color:var(--ar-border)] px-4 py-3">
          <Command className="h-4 w-4 shrink-0 text-gold-dark" aria-hidden />
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent font-ui text-sm text-ink outline-none placeholder:text-stone-400"
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
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[min(50vh,28rem)] overflow-y-auto p-2">
          <p className="px-3 py-1 font-ui text-[10px] font-bold uppercase tracking-widest text-stone-500">Navigate</p>
          {results.map((route) => {
            const Icon = route.icon;
            return (
              <button
                key={route.href}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-ui text-sm text-stone-700 hover:bg-gold/10 hover:text-ink dark:text-stone-300"
                type="button"
                onClick={() => {
                  router.push(route.href);
                  close();
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gold-dark" aria-hidden />
                  {route.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 opacity-40" />
              </button>
            );
          })}
          {!results.length ? <p className="px-3 py-6 text-center font-ui text-sm text-stone-500">No matches.</p> : null}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
