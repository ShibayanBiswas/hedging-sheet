"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { TabActions } from "@/components/ui/tab-actions";
import type { ExportTab } from "@/lib/exports/tab-specs";
import { cn } from "@/lib/cn";

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
  return (
    <section id={id} className={cn("glass section-pad hs-enter w-full min-w-0 rounded-2xl", recalculating && "hs-recalc", className)} style={{ "--enter-step": Math.min(index, 4) } as CSSProperties}>
      {children}
    </section>
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
      {aside ? <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{aside}</div> : null}
    </div>
  );
}

export function PageIntro({ title, subtitle, tab }: { title: string; subtitle?: string; tab: ExportTab }) {
  return (
    <div className="tab-heading mb-4">
      <div className="tab-heading-title">
        <p className="label-chip">Hedging Sheet</p>
        <h1 className="mt-1 font-bold tracking-tight text-ink text-h1">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl font-ui text-body text-muted">{subtitle}</p> : null}
      </div>
      <TabActions tab={tab} />
    </div>
  );
}
