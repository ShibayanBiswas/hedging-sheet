"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eraser, Sparkles } from "lucide-react";

import { useDesk } from "@/lib/context/desk-provider";
import { moveFocusWithArrows } from "@/lib/keyboard";
import { INPUT_MODES } from "@/lib/inputs/draft";
import { cn } from "@/lib/cn";

const ICONS = { default: Sparkles, blank: Eraser } as const;

/** Full-width segmented pill in the Primary SP Dashboard nav style. Switching asks to confirm and clears the results. */
export function InputModeSwitch() {
  const { mode, requestMode } = useDesk();
  const reduce = useReducedMotion();
  return (
    <div
      className="nav-pill-shell flex w-full items-stretch gap-1 rounded-2xl border p-1 shadow-sm"
      role="tablist"
      aria-label="Input Mode"
      data-testid="mode-switch"
      onKeyDown={(e) => moveFocusWithArrows(e, '[role="tab"]')}
    >
      {INPUT_MODES.map((m) => {
        const active = mode === m.id;
        const Icon = ICONS[m.id];
        return (
          <motion.button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-testid={`mode-${m.id}`}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2.5 text-center transition-colors",
              active ? "text-white" : "text-muted hover:bg-[color:var(--ar-panel)] hover:text-ink",
            )}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={() => requestMode(m.id)}
          >
            {active ? (
              <motion.span
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-gold-dark via-[#9a4a2a] to-maroon shadow-lg shadow-maroon/20"
                layoutId={reduce ? undefined : "input-mode-active"}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                data-testid="mode-active"
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2 font-ui text-sm font-bold">
              <Icon className="h-4 w-4" aria-hidden />
              {m.label}
            </span>
            <span className={cn("relative font-ui text-[11px]", active ? "text-white/85" : "text-muted")}>{m.subtitle}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
