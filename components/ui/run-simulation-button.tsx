"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, Play } from "lucide-react";

import { SIMULATION_STEPS, useDesk } from "@/lib/context/desk-provider";
import { cn } from "@/lib/cn";
import { deskEase } from "@/lib/motion";

/** Gradient run button with a step progress state, in the Primary and Unwinding run style. */
export function RunSimulationButton({ className, compact, onDone }: { className?: string; compact?: boolean; onDone?: () => void }) {
  const { simulation, runSimulation, lastRun, stale } = useDesk();
  const reduce = useReducedMotion();
  const running = simulation.running;
  const label = running ? SIMULATION_STEPS[Math.max(0, simulation.step)] : lastRun && !stale ? "Run Simulation Again" : "Run Simulation";
  const progress = running ? ((simulation.step + 1) / SIMULATION_STEPS.length) * 100 : 0;

  return (
    <motion.button
      type="button"
      data-testid={compact ? "run-simulation-compact" : "run-simulation"}
      disabled={running}
      onClick={async () => {
        const ok = await runSimulation();
        if (ok) onDone?.();
      }}
      whileHover={reduce || running ? undefined : { scale: 1.01, y: -1 }}
      whileTap={reduce || running ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "btn-animated btn-motion btn-primary relative w-full overflow-hidden",
        compact ? "!py-2.5" : "!py-4 text-base",
        running && "cursor-wait",
        className,
      )}
    >
      <span className="btn-shine" aria-hidden />
      {running ? (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-white/20"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: deskEase }}
        />
      ) : null}
      <span className="relative z-10 inline-flex items-center justify-center gap-2.5 font-bold">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={running ? "running" : "idle"}
            className="inline-flex"
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : lastRun && !stale ? <CheckCircle2 className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
          </motion.span>
        </AnimatePresence>
        <span>{label}</span>
        {running ? (
          <span className="font-ui text-xs font-semibold opacity-80">
            Step {simulation.step + 1} Of {SIMULATION_STEPS.length}
          </span>
        ) : null}
      </span>
    </motion.button>
  );
}
