"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { pageEnter } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Page-level entrance — wrap each route's main content once. */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={cn("desk-page-enter", className)} {...pageEnter}>
      {children}
    </motion.div>
  );
}
