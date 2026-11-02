"use client";

import { ArrowRight, Cpu, LineChart, Search, ShieldCheck, type LucideIcon } from "lucide-react";

import type { AtlasStage, StageKind } from "@/lib/logic-atlas";
import { cn } from "@/lib/cn";

const KIND: Record<StageKind, { icon: LucideIcon; tone: string }> = {
  Input: { icon: Search, tone: "atlas-card--input" },
  Calculation: { icon: Cpu, tone: "atlas-card--calculation" },
  Check: { icon: ShieldCheck, tone: "atlas-card--check" },
  Output: { icon: LineChart, tone: "atlas-card--output" },
};

function StageLinks({ label, ids, titles, testId }: { label: string; ids: string[]; titles: Record<string, string>; testId: string }) {
  return (
    <div className="atlas-card__links" data-testid={testId}>
      <span className="atlas-card__label">{label}</span>
      {ids.length ? (
        ids.map((id) => (
          <a
            key={id}
            href={`#stage-${id}`}
            className="atlas-link"
            onClick={(e) => {
              const target = document.getElementById(`stage-${id}`);
              if (!target) return;
              e.preventDefault();
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              target.focus({ preventScroll: true });
            }}
          >
            {titles[id]}
          </a>
        ))
      ) : (
        <span className="text-muted">-</span>
      )}
    </div>
  );
}

/** One pipeline stage, in the Primary SP Dashboard flow node style, with what it reads, what it feeds and its last run. */
export function StageCard({ stage, step, titles, pending }: { stage: AtlasStage; step: number; titles: Record<string, string>; pending: string }) {
  const kind = KIND[stage.kind];
  const Icon = kind.icon;
  return (
    <article id={`stage-${stage.id}`} tabIndex={-1} data-testid={`stage-${stage.id}`} className={cn("atlas-card", kind.tone)}>
      {step > 1 ? (
        <span className="atlas-arrow" aria-hidden>
          <ArrowRight className="icon-sm" />
        </span>
      ) : null}
      <header className="flex items-start gap-3">
        <span className="atlas-card__icon">
          <Icon className="icon-sm" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="atlas-chip" data-testid={`stage-${stage.id}-kind`}>
              {stage.kind}
            </span>
            <span className="atlas-card__step">Step {step}</span>
          </div>
          <h3 className="mt-1 font-ui text-h3 font-bold text-ink">{stage.title}</h3>
        </div>
      </header>
      <p data-desc className="atlas-card__text" data-testid={`stage-${stage.id}-description`}>
        {stage.description}
      </p>
      <StageLinks label="Uses" ids={stage.uses} titles={titles} testId={`stage-${stage.id}-uses`} />
      <StageLinks label="Feeds" ids={stage.feeds} titles={titles} testId={`stage-${stage.id}-feeds`} />
      <div className="atlas-card__rule">
        <span className="atlas-card__label">Rule</span>
        <span data-testid={`stage-${stage.id}-rule`}>{stage.rule}</span>
      </div>
      <div className="atlas-card__last" data-testid={`stage-${stage.id}-last`}>
        <span className="atlas-card__label">Last Run</span>
        {stage.lastRun ? (
          <dl className="atlas-values">
            {stage.lastRun.map((v) => (
              <div key={v.label} className="atlas-value">
                <dt>{v.label}</dt>
                <dd className="tabular-nums">{v.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <span className="text-muted">{pending}</span>
        )}
      </div>
    </article>
  );
}
