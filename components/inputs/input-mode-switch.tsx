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
      className="nav-pill-shell flex w-full items-stretch gap-1 rounded-xl border p-1 shadow-sm"
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
            title={m.subtitle}
            className={cn("glass-control relative flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-center transition-colors")}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={() => requestMode(m.id)}
          >
            {active ? (
              <motion.span
                className="glass-active-pill absolute inset-0 rounded-lg"
                layoutId={reduce ? undefined : "input-mode-active"}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                data-testid="mode-active"
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2 whitespace-nowrap font-ui text-body font-bold">
              <Icon className="icon-sm" aria-hidden />
              {m.label}
            </span>
            <span className="sr-only">{m.subtitle}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
