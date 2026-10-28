"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Brain, Bug, Calculator, CheckCircle2, ChevronDown, LayoutDashboard, LineChart, Network, Sparkles, Workflow } from "lucide-react";

import { LogicFlowDiagram, type FlowNodeSpec } from "@/components/atlas/logic-flow";
import { HorizontalRail, RailCard } from "@/components/layout/horizontal-rail";
import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/engine/dates";
import { EXPIRY_WEEKDAY, WEEKDAY_NAMES } from "@/lib/engine/schedule";
import { COMPUTATION_PRIMITIVES, logicModules } from "@/lib/logic-atlas";
import { deskEase } from "@/lib/motion";
import { headlineTable, strikeLabel, type KeyValueSpec, type TableSpec } from "@/lib/tables";

const SHELL_TONES = {
  amber: "intel-pipeline-shell--amber",
  cyan: "intel-pipeline-shell--cyan",
  purple: "intel-pipeline-shell--purple",
  green: "intel-pipeline-shell--green",
  rose: "intel-pipeline-shell--rose",
  gold: "intel-pipeline-shell--gold",
} as const;

const CHIP_TONES = { amber: "amber", cyan: "cyan", purple: "purple", green: "green", rose: "rose", gold: "amber" } as const;

export default function LogicAtlasPage() {
  const { inputs, lastRun } = useDesk();
  const reduce = useReducedMotion();
  const weekday = WEEKDAY_NAMES[EXPIRY_WEEKDAY[inputs.underlying]]!;
  const modules = logicModules(inputs.underlying, weekday);
  const [selectedId, setSelectedId] = useState(modules[0]!.id);
  const [activeNode, setActiveNode] = useState<FlowNodeSpec | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const selected = modules.find((m) => m.id === selectedId) ?? modules[0]!;
  const totalStages = modules.reduce((s, m) => s + m.stageCount, 0);
  const totalFormulas = modules.reduce((s, m) => s + m.formulas.length, 0);
  const r = lastRun?.result;

  const formulaTable: TableSpec = {
    id: "atlas-formulas",
    title: "Formulas",
    columns: [
      { key: "name", label: "Formula", kind: "text" },
      { key: "words", label: "In Words", kind: "text" },
      { key: "source", label: "Source Sheet And Row", kind: "text" },
    ],
    rows: selected.formulas.map((f) => ({ name: f.name, words: f.words, source: f.source })),
  };

  const primitivesTable: TableSpec = {
    id: "atlas-primitives",
    title: "Computation Primitives",
    columns: [
      { key: "name", label: "Primitive", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "uses", label: "Uses", kind: "text" },
      { key: "role", label: "Role", kind: "text" },
    ],
    rows: COMPUTATION_PRIMITIVES.map((p) => ({ ...p })),
  };

  return (
    <div className="intel-page flex w-full flex-col gap-4">
      <motion.header className="intel-hero" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: deskEase }}>
        <span className="intel-hero-orb intel-hero-orb--gold" aria-hidden />
        <span className="intel-hero-orb intel-hero-orb--maroon" aria-hidden />
        <p className="intel-hero-kicker relative z-10">Anand Rathi Wealth · Desk Intelligence</p>
        <h2 className="intel-hero-title relative z-10">Logic Atlas</h2>
        <p className="intel-hero-sub relative z-10">
          How the {inputs.underlying} accelerator flows from the inputs through the Pricer, the goal seek, the vega hedge and the stress grid to the Excel file.
        </p>
        <div className="intel-hero-meta relative z-10">
          <motion.span
            className="intel-hero-badge"
            animate={reduce ? undefined : { boxShadow: ["0 0 0 rgba(212,178,76,0)", "0 0 18px rgba(212,178,76,0.35)", "0 0 0 rgba(212,178,76,0)"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {modules.length} Sections · {totalStages} Pipeline Stages
          </motion.span>
          <span className="intel-hero-badge">
            <Network className="h-3.5 w-3.5" />
            {r ? `${r.pricer.legs.length} Live Option Legs In The Last Run` : "No Simulation Run Yet"}
          </span>
        </div>
      </motion.header>

      <Panel>
        <TableCard
          spec={headlineTable("atlas-headline", "Headline", [
            { label: "Sections", value: modules.length, kind: "integer" },
            { label: "Pipeline Stages", value: totalStages, kind: "integer" },
            { label: "Formulas Mapped", value: totalFormulas, kind: "integer" },
            { label: "Live Option Legs", value: r ? r.pricer.legs.length : null, kind: "integer" },
            { label: "Goal Seek Steps", value: r ? r.diagnostics.solverTrace.length : null, kind: "integer" },
            { label: "Last Run", value: lastRun ? new Date(lastRun.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : null, kind: "text" },
          ])}
        />
      </Panel>

      <Panel>
        <SectionTitle icon={LayoutDashboard} subtitle="Scroll sideways to browse every section. Select one to open its flow, formulas, edge cases and outputs.">
          Logic Sections
        </SectionTitle>
        <HorizontalRail className="logic-module-rail mt-2" gap="gap-4">
          {modules.map((module, index) => (
            <RailCard key={module.id} className="logic-module-rail-item">
              <motion.button
                type="button"
                data-testid={`atlas-${module.id}`}
                className={cn("logic-module-card h-full w-full cursor-pointer text-left", `logic-module-card--${module.accent}`, selectedId === module.id && "logic-module-card--selected")}
                initial={reduce ? false : { opacity: 0, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.05, duration: 0.45, ease: deskEase }}
                whileHover={reduce ? undefined : { y: -6, scale: 1.018 }}
                onClick={() => {
                  setSelectedId(module.id);
                  setActiveNode(null);
                }}
              >
                <span className="logic-module-card__sheen" aria-hidden />
                <span className="logic-module-card__orb logic-module-card__orb--primary" aria-hidden />
                <span className="logic-module-card__orb logic-module-card__orb--secondary" aria-hidden />
                <div className="relative z-10">
                  <p className="logic-module-card__kicker">{module.subtitle}</p>
                  <h3 className="logic-module-card__title mt-1.5 font-serif text-lg font-bold md:text-xl">{module.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400 md:text-[13px]">{module.description}</p>
                </div>
                <div className="logic-module-card__footer relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="logic-module-card__connected inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    {module.stageCount} Stages · {module.formulas.length} Formulas
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
            <p className="label-chip">Flows</p>
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
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">{selected.description}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Pipeline Complete
          </span>
        </div>
        <div className={cn("intel-pipeline-shell mt-4", SHELL_TONES[selected.accent])}>
          <LogicFlowDiagram nodes={selected.nodes} activeNodeId={activeNode?.label} onNodeSelect={setActiveNode} />
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={Calculator} subtitle="Each formula in words, with the sheet and row it comes from.">
          Formulas
        </SectionTitle>
        <TableCard spec={formulaTable} />
      </Panel>

      <div className="grid w-full gap-4 lg:grid-cols-2">
        <Panel>
          <SectionTitle icon={Brain}>{activeNode ? activeNode.label : "Insights"}</SectionTitle>
          <AnimatePresence mode="wait">
            {activeNode ? (
              <motion.div key={activeNode.label} className="mt-3 space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} data-testid="atlas-node-detail">
                <span className="hs-chip capitalize">{activeNode.kind}</span>
                <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">{activeNode.description}</p>
              </motion.div>
            ) : (
              <motion.ul key={`insights-${selected.id}`} className="intel-insight-list mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {selected.insights.map((insight, i) => (
                  <motion.li key={insight} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.25 }}>
                    {insight}
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </Panel>
        <Panel>
          <SectionTitle icon={LineChart}>Outputs</SectionTitle>
          <ul className="mt-3 flex flex-wrap gap-2">
            {selected.outputs.map((output, i) => (
              <motion.li
                key={`${selected.id}-${output}`}
                className={cn("intel-output-chip", `intel-output-chip--${CHIP_TONES[selected.accent]}`)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                whileHover={{ x: 4, scale: 1.01 }}
              >
                {output}
              </motion.li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel>
        <SectionTitle icon={AlertTriangle}>Edge Cases</SectionTitle>
        <ul className="intel-insight-list mt-3" data-testid="atlas-edge-cases">
          {selected.edgeCases.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <SectionTitle icon={Workflow} subtitle="Building blocks every section reuses.">
          Computation Primitives
        </SectionTitle>
        <TableCard spec={primitivesTable} />
      </Panel>

      <Panel>
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setDebugOpen((v) => !v)} aria-expanded={debugOpen} data-testid="debug-drawer">
          <SectionTitle icon={Bug} subtitle="Live intermediate values from the last run.">
            Debug Drawer
          </SectionTitle>
          <ChevronDown className={cn("h-5 w-5 text-gold transition-transform", debugOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {debugOpen ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: deskEase }} className="overflow-hidden">
              {r ? <DebugValues result={r} /> : <p className="hs-warning mt-3">Run the simulation to see the live values.</p>}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Panel>
    </div>
  );
}

function DebugValues({ result: r }: { result: NonNullable<ReturnType<typeof useDesk>["lastRun"]>["result"] }) {
  const i = r.inputs;
  const inputsSpec: KeyValueSpec = {
    id: "debug-inputs",
    title: "Inputs Of The Last Run",
    items: [
      { label: "Underlying", value: i.underlying, kind: "text" },
      { label: "Valuation Date", value: i.valuationDate, kind: "date" },
      { label: "Spot", value: i.spot, kind: "number" },
      { label: "Start Level", value: r.structure.startLevel, kind: "number", digits: 0 },
      { label: "Coupon", value: i.coupon, kind: "percent" },
      { label: "Strikes", value: i.strikePercents.map((k) => `${k}%`).join(", "), kind: "text" },
      { label: "Expiries", value: r.schedule.expiries.map((d) => formatDate(d)).join(", "), kind: "text" },
      { label: "Daily Volatility", value: i.dailyVol, kind: "percent", digits: 4 },
      { label: "Option Type", value: i.optionType === "C" ? "Call" : "Put", kind: "text" },
    ],
  };
  const diagnostics = headlineTable("debug-diagnostics", "Diagnostics", [
    { label: "Goal Seek Iterations", value: r.diagnostics.solverIterations, kind: "integer" },
    { label: "Goal Seek Residual", value: r.diagnostics.goalSeekResidual.toExponential(2), kind: "text" },
    { label: "Margin Loop Passes", value: r.diagnostics.loopPasses, kind: "integer" },
    { label: "Loop Residual", value: r.diagnostics.loopResidual.toExponential(2), kind: "text" },
    { label: "Spot Bump After Stress", value: r.diagnostics.spotBumpAfterStress, kind: "number", digits: 0 },
    { label: "Largest Payoff And Book Gap", value: r.diagnostics.payoffBookGap.toExponential(2), kind: "text" },
  ]);
  const solver: TableSpec = {
    id: "debug-solver",
    title: "Goal Seek Steps",
    columns: [
      { key: "step", label: "Step", kind: "integer" },
      { key: "inbuilt", label: "Inbuilt Tried", kind: "percent", digits: 6 },
      { key: "residual", label: "Coupon Residual", kind: "text" },
    ],
    rows: r.diagnostics.solverTrace.map((t, k) => ({ step: k + 1, inbuilt: t.inbuilt, residual: t.residual.toExponential(3) })),
  };
  const legs: TableSpec = {
    id: "debug-legs",
    title: "Per Leg Values",
    columns: [
      { key: "strike", label: "Strike", kind: "text" },
      { key: "expiry", label: "Expiry", kind: "date" },
      { key: "growth", label: "Forward Growth", kind: "percent", digits: 4 },
      { key: "forward", label: "Forward", kind: "number" },
      { key: "discount", label: "Discount Yield", kind: "percent", digits: 4 },
      { key: "vol", label: "Volatility", kind: "percent", digits: 4 },
      { key: "upper", label: "Upper Maturity", kind: "date" },
      { key: "lower", label: "Lower Maturity", kind: "date" },
    ],
    rows: r.pricer.legs.map((l) => ({
      strike: strikeLabel(l.strikePercent, l.strike),
      expiry: l.maturity,
      growth: l.forwardGrowth,
      forward: l.forward,
      discount: l.discountYield,
      vol: l.volatility,
      upper: l.upperMaturity,
      lower: l.lowerMaturity,
    })),
  };
  const curve: TableSpec = {
    id: "debug-curve",
    title: "Rate Curve Points Used",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "rate", label: "Rate", kind: "percent", digits: 4 },
    ],
    rows: r.diagnostics.curvePoints.map((p) => ({ date: p.date, rate: p.rate })),
  };
  return (
    <div className="mt-3 flex w-full flex-col gap-4" data-testid="debug-values">
      <TableCard spec={diagnostics} />
      <KeyValueCard spec={inputsSpec} />
      <TableCard spec={solver} />
      <TableCard spec={legs} />
      <TableCard spec={curve} />
    </div>
  );
}
