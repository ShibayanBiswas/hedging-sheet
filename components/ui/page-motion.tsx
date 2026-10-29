"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { pageEnter } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Page-level entrance — wrap each route's main content once. */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  // The server cannot know the motion preference and renders the hidden start; the client must still write the end state.
  return (
    <motion.div className={cn("desk-page-enter", className)} {...pageEnter} transition={reduce ? { duration: 0 } : pageEnter.transition}>
      {children}
    </motion.div>
  );
}
