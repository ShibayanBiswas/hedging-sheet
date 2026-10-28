"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Sparkles } from "lucide-react";

import { RunSimulationButton } from "@/components/ui/run-simulation-button";
import { useDesk } from "@/lib/context/desk-provider";
import type { HedgingResult } from "@/lib/engine/types";
import { deskEase } from "@/lib/motion";

/**
 * Output tabs show results only after a successful Run Simulation. Before the first run, and again after any
 * input change, a centred popup asks for a run. Overrides made on the output tabs and market data changes
 * keep the results on screen with an Inputs Changed banner.
 */
export function ResultGate({ children }: { children: (result: HedgingResult) => ReactNode }) {
  const { lastRun, stale, staleInputs } = useDesk();
  const reduce = useReducedMotion();

  if (!lastRun || staleInputs) {
    return (
      <div className="flex min-h-[52dvh] w-full items-center justify-center py-8" data-testid="run-gate">
        <motion.div
          className="glass glass-glow-purple relative w-full max-w-xl overflow-hidden rounded-2xl border border-gold/30 text-center shadow-[0_24px_80px_-20px_rgba(122,30,44,0.45)]"
          initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: deskEase }}
        >
          <div className="h-1 bg-gradient-to-r from-maroon via-gold to-maroon/70" />
          <div className="px-6 py-8">
            {staleInputs ? (
              <p
                className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 font-ui text-caption font-bold text-amber-900 dark:text-amber-200"
                data-testid="stale-banner"
              >
                <AlertTriangle className="icon-xs" aria-hidden />
                Inputs Changed
              </p>
            ) : null}
            <motion.span
              className="mx-auto inline-flex rounded-2xl border border-gold/30 bg-gold/10 p-3 text-gold-dark"
              animate={reduce ? undefined : { rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="icon-lg" aria-hidden />
            </motion.span>
            <h2 className="mt-4 font-bold tracking-tight text-ink text-h2">Run The Simulation To See Results</h2>
            <p className="mx-auto mt-2 max-w-md font-ui text-body text-muted">
              {staleInputs
                ? "The inputs changed after the last run, so its results are hidden. Run the simulation again to see results for the new inputs."
                : "Set the inputs, then run the simulation. It fetches the market data, prices every leg, solves the Inbuilt and builds the stress grid."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <RunSimulationButton compact />
              </div>
              <Link href="/" className="btn-animated btn-motion btn-accent inline-flex flex-1 items-center justify-center gap-2 !py-3" data-testid="go-to-inputs">
                <span className="btn-shine" aria-hidden />
                <span className="relative z-10 inline-flex items-center gap-2">
                  <ArrowLeft className="icon-sm" />
                  Go To Inputs
                </span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {stale ? (
          <motion.div
            key="stale"
            data-testid="stale-banner"
            className="mb-4 flex w-full flex-col items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <p className="flex items-center gap-2 font-ui text-body font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="icon-sm" aria-hidden />
              Inputs Changed · These results use the last run. Run the simulation again to apply the overrides.
            </p>
            <div className="w-full sm:w-64">
              <RunSimulationButton compact />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children(lastRun.result)}
    </>
  );
}
