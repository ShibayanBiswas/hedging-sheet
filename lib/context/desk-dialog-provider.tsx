"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

import { DeskDialog, type DeskDialogState } from "@/components/ui/desk-dialog";
import { deskAlert, registerDeskAlert, type DeskAlertOptions } from "@/lib/desk-alert";

type DeskDialogContextValue = {
  alert: (message: string, options?: DeskAlertOptions) => void;
  toast: (message: string) => void;
};

const DeskDialogContext = createContext<DeskDialogContextValue | null>(null);

export function DeskDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DeskDialogState[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const state = queue[0] ?? null;
  /** Where focus was before the first popup opened; it goes back there when the last one closes. */
  const returnFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setQueue((current) => {
      const closing = current[0];
      const rest = current.slice(1);
      window.setTimeout(() => {
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

  const toast = useCallback((message: string) => {
    setToastText(message);
    window.setTimeout(() => setToastText((current) => (current === message ? null : current)), 4_000);
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
        {toastText ? (
          <motion.div
            key={toastText}
            role="status"
            data-testid="desk-toast"
            className="glass fixed bottom-24 right-6 z-[150] flex items-center gap-2 rounded-2xl border border-emerald-400/40 px-4 py-3 font-ui text-sm font-semibold text-emerald-900 shadow-xl dark:text-emerald-200"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            {toastText}
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
