"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Info, Lightbulb, OctagonAlert } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";
import type { DeskAlertOptions, DeskAlertVariant } from "@/lib/desk-alert";
import { cn } from "@/lib/cn";

export type DeskDialogState = {
  title: string;
  message: string;
  variant: DeskAlertVariant;
  fix?: string;
  actions?: DeskAlertOptions["actions"];
  groups?: DeskAlertOptions["groups"];
  okLabel?: string;
  onClose?: () => void;
};

const VARIANT_META: Record<DeskAlertVariant, { icon: typeof Info; glow: "cyan" | "purple"; accent: string; label: string }> = {
  info: { icon: Info, glow: "cyan", accent: "text-maroon", label: "Desk Notice" },
  warning: { icon: AlertTriangle, glow: "purple", accent: "text-amber-900", label: "Please Note" },
  error: { icon: OctagonAlert, glow: "purple", accent: "text-maroon", label: "Action Required" },
};

/** Blocking desk popup in the Primary SP Dashboard style. */
export function DeskDialog({ open, state, onClose }: { open: boolean; state: DeskDialogState | null; onClose: () => void }) {
  const reduce = useReducedMotion();
  const okRef = useRef<HTMLButtonElement>(null);
  const shown = state ? `${state.title}\n${state.message}` : null;

  useEffect(() => {
    if (open && shown) okRef.current?.focus({ preventScroll: true });
  }, [open, shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const variant = state?.variant ?? "info";
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;

  return (
    <AnimatePresence>
      {open && state ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
          exit={reduce ? undefined : { opacity: 0 }}
          initial={reduce ? false : { opacity: 0 }}
          role="presentation"
        >
          <button aria-label="Close dialog" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" type="button" onClick={onClose} />
          <motion.div
            key={`${state.title}\n${state.message}`}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-labelledby="desk-dialog-title"
            aria-modal="true"
            data-testid="desk-dialog"
            className={cn(
              "desk-sheet glass relative z-10 flex w-full flex-col overflow-hidden border border-gold/30 shadow-[0_24px_80px_-20px_rgba(122,30,44,0.45)] sm:max-w-lg",
              meta.glow === "cyan" ? "glass-glow-cyan" : "glass-glow-purple",
            )}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
            role="alertdialog"
          >
            <div className="h-1 bg-gradient-to-r from-maroon via-gold to-maroon/70" />
            <div className="border-b border-gold/15 bg-gradient-to-r from-maroon/[0.06] via-transparent to-gold/[0.08] px-6 py-4">
              <div className="flex items-start gap-3">
                <BrandLogo compact />
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-bold uppercase tracking-[0.35em] text-gold-dark">{meta.label}</p>
                  <h2 className="font-ui mt-1 font-bold text-ink text-h2" id="desk-dialog-title">
                    {state.title}
                  </h2>
                </div>
                <div className={cn("rounded-xl border border-gold/25 bg-[color:var(--ar-surface)] p-2 shadow-sm", meta.accent)}>
                  <Icon className="icon-md" aria-hidden />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              <p className="whitespace-pre-wrap font-ui text-body leading-7 text-stone-700 dark:text-stone-300">{state.message}</p>
              {state.fix ? (
                <p className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2 font-ui text-caption leading-6 text-stone-700 dark:text-stone-300">
                  <Lightbulb className="mt-1 icon-xs shrink-0 text-gold-dark" aria-hidden />
                  <span>
                    <span className="font-bold text-gold-dark">How To Fix · </span>
                    {state.fix}
                  </span>
                </p>
              ) : null}
              {state.groups?.length ? (
                <div className="max-h-[45dvh] space-y-3 overflow-y-auto pr-1" data-testid="desk-dialog-groups" tabIndex={0} role="region" aria-label="Fields To Fix">
                  {state.groups.map((g) => (
                    <div key={g.title}>
                      <p className="font-ui text-caption font-bold uppercase tracking-[0.18em] text-gold-dark">{g.title}</p>
                      <ul className="mt-1 space-y-1">
                        {g.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 font-ui text-caption leading-5 text-stone-700 dark:text-stone-300">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="sheet-actions flex flex-wrap justify-end gap-2 border-t border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] px-6 py-3">
              {state.actions?.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  data-testid={a.testId}
                  className="btn-animated btn-motion btn-accent"
                  onClick={() => {
                    onClose();
                    a.onClick();
                  }}
                >
                  <span className="relative z-10">{a.label}</span>
                </button>
              ))}
              <button ref={okRef} type="button" className="btn-animated btn-motion btn-primary" onClick={onClose} data-testid="desk-dialog-ok">
                <span className="btn-shine" aria-hidden />
                <span className="relative z-10">{state.okLabel ?? "OK"}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
