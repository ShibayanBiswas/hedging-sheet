"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { deskEase } from "@/lib/motion";

export function Panel({
  children,
  className,
  recalculating,
  index = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  recalculating?: boolean;
  index?: number;
  id?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={cn("glass section-pad w-full min-w-0 rounded-2xl", recalculating && "hs-recalc", className)}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: deskEase, delay: Math.min(index, 8) * 0.05 }}
    >
      {children}
    </motion.section>
  );
}

export function SectionTitle({
  children,
  icon: Icon,
  aside,
  subtitle,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  aside?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-bold tracking-tight text-ink text-h2">
          {Icon ? <Icon className="icon-md text-gold" aria-hidden /> : null}
          <span className="min-w-0">{children}</span>
        </h2>
        {subtitle ? <p data-desc className="mt-1 font-ui text-caption text-muted">{subtitle}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}

export function PageIntro({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="mb-4 flex flex-wrap items-end justify-between gap-3"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: deskEase }}
    >
      <div>
        <p className="label-chip">Hedging Sheet</p>
        <h1 className="mt-1 font-bold tracking-tight text-ink text-h1">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl font-ui text-body text-muted">{subtitle}</p> : null}
      </div>
      {aside}
    </motion.div>
  );
}
