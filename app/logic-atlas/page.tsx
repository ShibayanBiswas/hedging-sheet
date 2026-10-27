"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bug, CheckCircle2, ChevronDown, LayoutDashboard, Lightbulb, Network, Sparkles } from "lucide-react";

import { LogicFlowDiagram } from "@/components/atlas/logic-flow";
import { HorizontalRail, RailCard } from "@/components/layout/horizontal-rail";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { cn } from "@/lib/cn";
import { logicModules } from "@/lib/logic-atlas";
import { deskEase } from "@/lib/motion";

const SHELL_TONES = {
  amber: "intel-pipeline-shell--amber",
  cyan: "intel-pipeline-shell--cyan",
  purple: "intel-pipeline-shell--purple",
  green: "intel-pipeline-shell--green",
  rose: "intel-pipeline-shell--rose",
  gold: "intel-pipeline-shell--gold",
} as const;

export default function LogicAtlasPage() {
  const { inputs, result } = useDesk();
  const reduce = useReducedMotion();
  const modules = logicModules(inputs.underlying);
  const [selectedId, setSelectedId] = useState(modules[0]!.id);
  const [debugOpen, setDebugOpen] = useState(false);
  const selected = modules.find((m) => m.id === selectedId) ?? modules[0]!;
  const totalStages = modules.reduce((s, m) => s + m.stageCount, 0);

  return (
    <div className="intel-page flex w-full flex-col gap-4">
      <motion.header
        className="intel-hero"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: deskEase }}
      >
        <span className="intel-hero-orb intel-hero-orb--gold" aria-hidden />
        <span className="intel-hero-orb intel-hero-orb--maroon" aria-hidden />
        <p className="intel-hero-kicker relative z-10">Anand Rathi Wealth · Desk Intelligence</p>
        <h2 className="intel-hero-title relative z-10">Logic Atlas</h2>
        <p className="intel-hero-sub relative z-10">How the {inputs.underlying} accelerator is hedged, priced and margined.</p>
        <div className="intel-hero-meta relative z-10">
          <span className="intel-hero-badge">
            <Sparkles className="h-3.5 w-3.5" />
            {modules.length} Modules · {totalStages} Pipeline Stages
          </span>
          <span className="intel-hero-badge">
            <Network className="h-3.5 w-3.5" />
            {result.ok ? `${result.pricer.legs.length * result.pricer.halves} Leg Columns` : "Pricing Blocked"}
          </span>
        </div>
      </motion.header>

      <Panel>
        <SectionTitle icon={LayoutDashboard} subtitle="Scroll sideways to browse every module. Select one to open its pipeline.">
          Logic Modules
        </SectionTitle>
        <HorizontalRail className="logic-module-rail mt-2" gap="gap-4">
          {modules.map((module, index) => (
            <RailCard key={module.id} className="logic-module-rail-item">
              <motion.button
                type="button"
                data-testid={`atlas-${module.id}`}
                className={cn(
                  "logic-module-card h-full w-full cursor-pointer text-left",
                  `logic-module-card--${module.accent}`,
                  selectedId === module.id && "logic-module-card--selected",
                )}
                initial={reduce ? false : { opacity: 0, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.06, duration: 0.45, ease: deskEase }}
                whileHover={reduce ? undefined : { y: -6, scale: 1.018 }}
                onClick={() => setSelectedId(module.id)}
              >
                <span className="logic-module-card__sheen" aria-hidden />
                <span className="logic-module-card__orb logic-module-card__orb--primary" aria-hidden />
                <span className="logic-module-card__orb logic-module-card__orb--secondary" aria-hidden />
                <div className="relative z-10">
                  <p className="logic-module-card__kicker">{module.subtitle}</p>
                  <h3 className="logic-module-card__title mt-1.5 font-serif text-lg font-bold md:text-xl">{module.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400 md:text-[13px]">{module.purpose}</p>
                </div>
                <div className="logic-module-card__footer relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="logic-module-card__connected inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    {module.stageCount} Stages
                  </span>
                  {module.metrics.map((m) => (
                    <span key={m.label} className="logic-module-metric">
                      <span className="logic-module-metric__label">{m.label}:</span> {m.value}
                    </span>
                  ))}
                </div>
              </motion.button>
            </RailCard>
          ))}
        </HorizontalRail>
      </Panel>

      <Panel>
        <div className="intel-section-head">
          <div>
            <p className="label-chip">Active Pipeline</p>
            <AnimatePresence mode="wait">
              <motion.h3
                key={selected.id}
                className="mt-1 font-serif text-xl font-bold tracking-tight text-ink md:text-2xl"
                initial={reduce ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.28 }}
              >
                {selected.title}
              </motion.h3>
            </AnimatePresence>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">{selected.purpose}</p>
          </div>
        </div>
        <div className={cn("intel-pipeline-shell mt-4", SHELL_TONES[selected.accent])}>
          <LogicFlowDiagram nodes={selected.nodes} />
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="label-chip mb-2">Flows</p>
            <div className="flex flex-wrap gap-2">
              {selected.flows.map((f) => (
                <span key={f} className="hs-chip">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="label-chip mb-2">Insights</p>
            <ul className="flex flex-col gap-1.5">
              {selected.insights.map((s) => (
                <li key={s} className="flex items-start gap-2 font-ui text-sm text-stone-600 dark:text-stone-300">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-chip mb-2">Outputs</p>
            <div className="flex flex-wrap gap-2">
              {selected.outputs.map((o) => (
                <span key={o} className="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 font-ui text-[11px] font-semibold text-gold-dark dark:text-gold">
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setDebugOpen((v) => !v)}
          aria-expanded={debugOpen}
          data-testid="debug-drawer"
        >
          <SectionTitle icon={Bug}>Debug Drawer</SectionTitle>
          <ChevronDown className={cn("h-5 w-5 text-gold transition-transform", debugOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {debugOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: deskEase }}
              className="overflow-hidden"
            >
              {result.ok ? (
                <div className="flex flex-wrap gap-2 font-ui text-xs" data-testid="debug-values">
                  <span className="hs-chip">Margin Loop Passes {result.diagnostics.loopPasses}</span>
                  <span className="hs-chip">Loop Residual {result.diagnostics.loopResidual.toExponential(2)}</span>
                  <span className="hs-chip">Solver Iterations {result.diagnostics.solverIterations}</span>
                  <span className="hs-chip">Achieved Coupon Gap {(result.pricer.header.achievedCoupon - result.inputs.coupon).toExponential(2)}</span>
                </div>
              ) : (
                <p className="hs-warning">The book is not priced, so there is nothing to show.</p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Panel>
    </div>
  );
}
