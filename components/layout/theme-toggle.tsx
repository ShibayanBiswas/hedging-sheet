"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/context/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = theme === "dark";
  const reduce = useReducedMotion();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stored theme is only known after mount
    setMounted(true);
  }, []);

  return (
    <button
      aria-label={isDark ? "Switch To Light Mode" : "Switch To Dark Mode"}
      className={cn("btn-ghost btn-animated btn-motion inline-flex items-center gap-2 text-xs", className)}
      data-testid="theme-toggle"
      type="button"
      onClick={toggle}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mounted ? (isDark ? "sun" : "moon") : "pending"}
          className="inline-flex"
          initial={reduce ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.28 }}
        >
          {mounted ? isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 opacity-40" />}
        </motion.span>
      </AnimatePresence>
      <span className="hidden md:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
