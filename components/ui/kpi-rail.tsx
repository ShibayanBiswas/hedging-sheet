"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";
import { deskEase } from "@/lib/motion";

export type Kpi = {
  label: string;
  value: number | null;
  format: (v: number) => string;
  hint?: string;
  accent?: "maroon" | "gold";
};

/** Animated count-up whenever the value recomputes. */
function CountUp({ value, format }: { value: number | null; format: (v: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(value);
  const fromRef = useRef<number | null>(value);

  useEffect(() => {
    const from = fromRef.current;
    const animate =
      !reduce && value != null && Number.isFinite(value) && from != null && Number.isFinite(from) && from !== value;
    const start = performance.now();
    const duration = 550;
    let frame = 0;
    const step = (t: number) => {
      if (!animate || value == null) {
        setShown(value);
        fromRef.current = value;
        return;
      }
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      setShown(from! + (value - from!) * eased);
      if (k < 1) frame = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = value;
    };
  }, [value, reduce]);

  if (shown == null || !Number.isFinite(shown)) return <span title="The value could not be computed">-</span>;
  return <span>{format(shown)}</span>;
}

export function KpiRail({ items, recalculating }: { items: Kpi[]; recalculating?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="horizontal-rail horizontal-rail-fill mb-4 w-full pb-2" role="list" aria-label="Headline metrics">
      <div className="horizontal-rail-fill-inner flex w-full gap-3">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            role="listitem"
            data-testid={`kpi-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            className={cn("kpi-card kpi-card-dense rail-card rail-card-fill min-w-[11rem] flex-1", recalculating && "hs-recalc")}
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: Math.min(i, 10) * 0.05, duration: 0.4, ease: deskEase }}
          >
            <div className="kpi-card-label">{item.label}</div>
            <div
              className={cn(
                "kpi-card-value mt-1",
                item.accent === "maroon" && "!bg-none text-maroon dark:text-gold",
              )}
              style={item.accent === "maroon" ? { background: "none", WebkitBackgroundClip: "unset" } : undefined}
            >
              <CountUp value={item.value} format={item.format} />
            </div>
            {item.hint ? <div className="mt-1 font-ui text-[11px] text-muted">{item.hint}</div> : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
