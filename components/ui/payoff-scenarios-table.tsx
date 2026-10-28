"use client";

import { motion, useReducedMotion } from "framer-motion";

import { deriveTerms } from "@/lib/engine/structure";
import type { HedgingResult } from "@/lib/engine/types";
import { cn } from "@/lib/cn";
import { fmtCrore, fmtPercent } from "@/lib/format";
import { cellKey } from "@/lib/tables";
import { headStyle } from "@/components/ui/desk-table";
import { deskEase } from "@/lib/motion";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const finiteOrUndefined = (v: number) => (Number.isFinite(v) ? v : undefined);

function Badge({ tone, children }: { tone: "sky" | "violet" | "emerald" | "rose"; children: string }) {
  const tones = {
    sky: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    violet: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    emerald: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    rose: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  };
  return <span className={cn("rounded px-2 py-1 text-caption font-semibold uppercase tracking-wide", tones[tone])}>{children}</span>;
}

/** Payoff scenarios in the Primary SP Dashboard style, with Initial, Target, Protection and Floor rows marked. */
export function PayoffScenariosTable({ result }: { result: HedgingResult }) {
  const reduce = useReducedMotion();
  const terms = deriveTerms(result.inputs);
  const u = result.underlyingLabel;
  const rows = result.productDescription.payoff;
  return (
    <motion.div
      className="w-full min-w-0"
      data-testid="table-pd-payoff"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, ease: deskEase }}
    >
      <div className="overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-maroon via-gold to-maroon/70" aria-hidden />
        <div className="desk-table-scroll horizontal-rail max-h-[min(56dvh,560px)] overflow-auto !rounded-t-none" tabIndex={0} role="region" aria-label="Payoff Scenarios">
          <table className="data-table-premium data-table-fill payoff-scenarios-table">
            <thead>
              <tr className="hs-head-row">
                <th className="col-pinned">{u} Performance</th>
                <th className="text-right">Client Return</th>
                <th className="text-right" style={headStyle("Maturity Value In Crore")}>
                  Maturity Value In Crore
                </th>
                <th className="text-right" style={headStyle("Pre Tax Internal Rate Of Return")}>
                  Pre Tax Internal Rate Of Return
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const initial = near(p.performance, 0);
                const target = near(p.performance, terms.target);
                const protection = near(p.performance, -terms.protection);
                const floor = near(p.performance, terms.floorLevel - 1);
                const row = fmtPercent(p.performance, 2);
                return (
                  <tr
                    key={p.performance}
                    data-row={row}
                    className={cn(
                      i % 2 === 1 && "data-table-row-alt",
                      initial && "bg-sky-50/80 dark:bg-sky-950/25",
                      target && "bg-violet-50/80 dark:bg-violet-950/30",
                    )}
                  >
                    <td className="col-pinned font-semibold" data-cell={cellKey(row, `${u} Performance`)} data-value={p.performance}>
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span>{fmtPercent(p.performance, 2)}</span>
                        {initial ? <Badge tone="sky">Initial</Badge> : null}
                        {target ? <Badge tone="violet">Target</Badge> : null}
                        {protection ? <Badge tone="emerald">Protection</Badge> : null}
                        {floor ? <Badge tone="rose">Floor</Badge> : null}
                      </span>
                    </td>
                    <td className="text-right font-bold text-emerald-800 dark:text-emerald-300" data-cell={cellKey(row, "Client Return")} data-value={finiteOrUndefined(p.clientReturn)}>
                      {fmtPercent(p.clientReturn, 2)}
                    </td>
                    <td className="text-right" data-cell={cellKey(row, "Maturity Value In Crore")} data-value={finiteOrUndefined(p.maturityValueCr)}>
                      {fmtCrore(p.maturityValueCr)}
                    </td>
                    <td className="text-right" data-cell={cellKey(row, "Pre Tax Internal Rate Of Return")} data-value={finiteOrUndefined(p.preTaxIrr)}>
                      {fmtPercent(p.preTaxIrr, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 font-ui text-caption italic text-muted">
        Levels: every strike, the protection level and 0.01% below it, zero, and every 5% in between.
      </p>
    </motion.div>
  );
}
