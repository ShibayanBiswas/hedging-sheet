"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Brain, CheckCircle2, Clock, LineChart, Network, TriangleAlert } from "lucide-react";

import { StageCard } from "@/components/atlas/stage-card";
import { DownloadPdfButton } from "@/components/ui/download-pdf-button";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { fmtRunStamp } from "@/lib/format";
import { underlyingName } from "@/lib/inputs/draft";
import { atlasInsights, atlasOutputs, atlasStages } from "@/lib/logic-atlas";
import { deskEase } from "@/lib/motion";
import { cn } from "@/lib/cn";

export default function LogicAtlasPage() {
  const { inputs, lastRun, staleInputs, market, dailyVolStatus } = useDesk();
  const reduce = useReducedMotion();
  // A run made with other inputs is never shown: its values no longer describe the product on screen.
  const run = lastRun && !staleInputs ? { result: lastRun.result, market: lastRun.market } : null;
  const stages = atlasStages(inputs, run, { market, history: dailyVolStatus });
  const titles = Object.fromEntries(stages.map((s) => [s.id, s.title]));
  const insights = atlasInsights(run);
  const outputs = atlasOutputs(run?.result ?? null);
  const status = !lastRun ? "Waiting For Run Simulation" : staleInputs ? "Inputs Changed · Run Again" : `Last Run · ${fmtRunStamp(lastRun.at)}`;
  const StatusIcon = !lastRun ? Clock : staleInputs ? TriangleAlert : CheckCircle2;

  return (
    <div className="intel-page flex w-full flex-col gap-4">
      <motion.header className="intel-hero" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: deskEase }}>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="intel-hero-kicker">Anand Rathi Wealth · Desk Intelligence</p>
            <h1 className="intel-hero-title">Logic Atlas</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={cn("hs-chip", staleInputs && "hs-chip-maroon")} data-testid="atlas-status">
              <StatusIcon className="icon-xs" aria-hidden />
              {status}
            </span>
            <DownloadPdfButton tab="logic-atlas" />
          </div>
        </div>
        <p className="intel-hero-sub relative z-10">
          How the {underlyingName(inputs)} product flows from the inputs through pricing, the goal seek and the vega hedge to the margin and the payoff.
        </p>
      </motion.header>

      <Panel id="flows">
        <div data-testid="atlas-section-flows">
          <SectionTitle icon={Network} subtitle="Every stage in the order the simulation runs it, with what it reads, what it feeds, its rule and its last run.">
            Flows
          </SectionTitle>
          <div className="atlas-flow">
            {stages.map((stage, index) => (
              <StageCard key={stage.id} stage={stage} step={index + 1} titles={titles} pending={lastRun && staleInputs ? "Inputs Changed · Run Again" : "Waiting For Run Simulation"} />
            ))}
          </div>
        </div>
      </Panel>

      <Panel id="insights">
        <div data-testid="atlas-section-insights">
          <SectionTitle icon={Brain} subtitle="What the last run says, from its own values.">
            Insights
          </SectionTitle>
          {insights.length ? (
            <div className="atlas-grid">
              {insights.map((insight) => (
                <article key={insight.id} className="atlas-card atlas-card--insight" data-testid={`insight-${insight.id}`}>
                  <h3 className="font-ui text-h3 font-bold text-ink">{insight.title}</h3>
                  <p data-desc className="atlas-card__text">
                    {insight.text}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="atlas-empty" data-testid="insights-empty">
              Run Simulation To See Insights
            </p>
          )}
        </div>
      </Panel>

      <Panel id="outputs">
        <div data-testid="atlas-section-outputs">
          <SectionTitle icon={LineChart} subtitle="The headline numbers of each result tab.">
            Outputs
          </SectionTitle>
          <div className="atlas-grid">
            {outputs.map((o) => (
              <article key={o.tab} className="atlas-card atlas-card--output" data-testid={`output-${o.tab}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-ui text-h3 font-bold text-ink">{o.title}</h3>
                  <Link href={o.href} className="btn-animated btn-motion btn-ghost btn-compact inline-flex shrink-0 items-center gap-1" aria-label={`Open ${o.title}`} data-testid={`output-${o.tab}-open`}>
                    <span className="relative z-10 inline-flex items-center gap-1">
                      Open
                      <ArrowUpRight className="icon-xs" aria-hidden />
                    </span>
                  </Link>
                </div>
                {o.values.length ? (
                  <dl className="atlas-values">
                    {o.values.map((v) => (
                      <div key={v.label} className="atlas-value">
                        <dt>{v.label}</dt>
                        <dd className="tabular-nums">{v.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-muted">{lastRun && staleInputs ? "Inputs Changed · Run Again" : "Waiting For Run Simulation"}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
