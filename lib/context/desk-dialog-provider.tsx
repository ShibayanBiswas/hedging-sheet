"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, OctagonAlert } from "lucide-react";

import { DeskDialog, type DeskDialogState } from "@/components/ui/desk-dialog";
import { cn } from "@/lib/cn";
import { deskAlert, registerDeskAlert, type DeskAlertOptions } from "@/lib/desk-alert";

type ToastVariant = "success" | "error";

type DeskDialogContextValue = {
  alert: (message: string, options?: DeskAlertOptions) => void;
  toast: (message: string, options?: { variant?: ToastVariant }) => void;
};

const DeskDialogContext = createContext<DeskDialogContextValue | null>(null);

export function DeskDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DeskDialogState[]>([]);
  const [toastState, setToastState] = useState<{ id: number; text: string; variant: ToastVariant; lift: number } | null>(null);
  const toastId = useRef(0);
  const reduce = useReducedMotion();
  const state = queue[0] ?? null;
  /** Where focus was before the first popup opened; it goes back there when the last one closes. */
  const returnFocus = useRef<HTMLElement | null>(null);

  /** Close the open popup. `after` replaces the usual hand-back of focus, for a link that takes the user elsewhere. */
  const close = useCallback((after?: () => void) => {
    setQueue((current) => {
      const closing = current[0];
      const rest = current.slice(1);
      window.setTimeout(() => {
        if (after) return after();
        if (!rest.length && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
        closing?.onClose?.();
      }, 0);
      return rest;
    });
  }, []);

  const alert = useCallback((message: string, options?: DeskAlertOptions) => {
    if (typeof document !== "undefined" && !document.querySelector('[data-testid="desk-dialog"]')) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    const variant = options?.variant ?? "info";
    const title = options?.title ?? (variant === "error" ? "Cannot Continue" : variant === "warning" ? "Data Notice" : "Hedging Sheet");
    const next: DeskDialogState = {
      title,
      message,
      variant,
      fix: options?.fix,
      actions: options?.actions,
      groups: options?.groups,
      okLabel: options?.okLabel,
      onClose: options?.onClose,
    };
    setQueue((current) => (current.some((row) => row.title === next.title && row.message === next.message) ? current : [...current, next]));
  }, []);

  const toast = useCallback((message: string, options?: { variant?: ToastVariant }) => {
    // One toast at a time: a new one replaces the last. It sits above the Run bar while the bar is on screen.
    const bar = document.querySelector(".hs-run-bar")?.getBoundingClientRect();
    const lift = bar && bar.bottom >= window.innerHeight - 1 ? window.innerHeight - bar.top : 0;
    const id = ++toastId.current;
    setToastState({ id, text: message, variant: options?.variant ?? "success", lift });
    // Only this toast's own timer clears it, so a repeat of the same message gets its full time.
    window.setTimeout(() => setToastState((current) => (current?.id === id ? null : current)), 4_000);
  }, []);

  useEffect(() => {
    registerDeskAlert(alert);
    return () => registerDeskAlert(null);
  }, [alert]);

  const value = useMemo(() => ({ alert, toast }), [alert, toast]);

  return (
    <DeskDialogContext.Provider value={value}>
      {children}
      <DeskDialog open={state != null} state={state} onClose={close} />
      <AnimatePresence>
        {toastState ? (
          <motion.div
            key={toastState.id}
            role={toastState.variant === "error" ? "alert" : "status"}
            data-testid="desk-toast"
            data-variant={toastState.variant}
            style={{ "--toast-lift": `${toastState.lift}px` } as CSSProperties}
            className={cn(
              "desk-toast glass flex items-center gap-2 rounded-2xl border px-4 py-3 font-ui text-body font-semibold shadow-xl",
              toastState.variant === "error" ? "border-rose-400/50 text-rose-900" : "border-emerald-400/40 text-emerald-900",
            )}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            {toastState.variant === "error" ? <OctagonAlert className="icon-sm shrink-0 text-rose-600" aria-hidden /> : <CheckCircle2 className="icon-sm shrink-0 text-emerald-600" aria-hidden />}
            <span className="min-w-0">{toastState.text}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DeskDialogContext.Provider>
  );
}

export function useDeskDialog(): DeskDialogContextValue {
  const context = useContext(DeskDialogContext);
  return context ?? { alert: deskAlert, toast: () => undefined };
}
