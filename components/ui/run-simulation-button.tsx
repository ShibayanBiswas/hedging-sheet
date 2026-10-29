"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, Play } from "lucide-react";

import { SIMULATION_STEPS, useDesk } from "@/lib/context/desk-provider";
import { INLINE_ONLY_CODES } from "@/lib/inputs/validate";
import { cn } from "@/lib/cn";
import { deskEase } from "@/lib/motion";

/** Gradient run button with a step progress state, in the Primary and Unwinding run style. */
export function RunSimulationButton({ className, compact, onDone }: { className?: string; compact?: boolean; onDone?: () => void }) {
  const { simulation, runSimulation, lastRun, stale, fieldErrors } = useDesk();
  // Shown inline under the participation; Run stays off until it is fixed.
  const blocked = fieldErrors.some((e) => e.code != null && INLINE_ONLY_CODES.has(e.code));
  const reduce = useReducedMotion();
  const running = simulation.running;
  const label = running ? SIMULATION_STEPS[Math.max(0, simulation.step)] : lastRun && !stale ? "Run Simulation Again" : "Run Simulation";
  const progress = running ? ((simulation.step + 1) / SIMULATION_STEPS.length) * 100 : 0;

  return (
    <motion.button
      type="button"
      data-testid={compact ? "run-simulation-compact" : "run-simulation"}
      disabled={running || blocked}
      onClick={async () => {
        const ok = await runSimulation();
        if (ok) onDone?.();
      }}
      whileHover={reduce || running ? undefined : { scale: 1.01, y: -1 }}
      whileTap={reduce || running ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "btn-animated btn-motion btn-primary hs-run-btn relative w-full overflow-hidden",
        compact ? "!py-3" : "!py-4 text-body",
        running && "cursor-wait",
        className,
      )}
    >
      {running ? (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-white/20"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: deskEase }}
        />
      ) : null}
      <span className="relative z-10 inline-flex items-center justify-center gap-3 font-bold">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={running ? "running" : "idle"}
            className="inline-flex"
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
          >
            {running ? <Loader2 className="icon-md animate-spin" /> : lastRun && !stale ? <CheckCircle2 className="icon-md" /> : <Play className="icon-md fill-current" />}
          </motion.span>
        </AnimatePresence>
        <span>{label}</span>
        {running ? (
          <span className="font-ui text-caption font-semibold opacity-80">
            Step {simulation.step + 1} Of {SIMULATION_STEPS.length}
          </span>
        ) : null}
      </span>
    </motion.button>
  );
}
