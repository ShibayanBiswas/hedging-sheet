"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Horizontally laid-out rail: fills the row on wide screens, scrolls sideways when it overflows. */
export function HorizontalRail({ children, className, gap = "gap-4" }: { children: ReactNode; className?: string; gap?: string }) {
  return (
    <div className={cn("horizontal-rail horizontal-rail-fill w-full -mx-1 px-1 pb-2", className)}>
      <div className={cn("horizontal-rail-fill-inner flex w-full snap-x snap-mandatory", gap)}>{children}</div>
    </div>
  );
}

export function RailCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rail-card rail-card-fill w-full snap-start", className)}>{children}</div>;
}
