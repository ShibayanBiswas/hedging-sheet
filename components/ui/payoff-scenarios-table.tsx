"use client";

import { motion, useReducedMotion } from "framer-motion";

import { deriveTerms } from "@/lib/engine/structure";
import type { HedgingResult } from "@/lib/engine/types";
import { cn } from "@/lib/cn";
import { fmtCrore, fmtPercent } from "@/lib/format";
import { deskEase } from "@/lib/motion";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function Badge({ tone, children }: { tone: "sky" | "violet" | "emerald" | "rose"; children: string }) {
  const tones = {
    sky: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    violet: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    emerald: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    rose: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  };
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tones[tone])}>{children}</span>;
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
        <div className="desk-table-scroll horizontal-rail max-h-[min(56vh,560px)] overflow-auto !rounded-t-none">
          <table className="data-table-premium data-table-fill payoff-scenarios-table">
            <thead>
              <tr className="hs-head-row">
                <th className="col-pinned">{u} Performance</th>
                <th className="text-right">Client Return</th>
                <th className="text-right">Maturity Value in Crore</th>
                <th className="text-right">Pre Tax Internal Rate of Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const initial = near(p.performance, 0);
                const target = near(p.performance, terms.target);
                const protection = near(p.performance, -terms.protection);
                const floor = near(p.performance, terms.floorLevel - 1);
                return (
                  <tr
                    key={p.performance}
                    className={cn(
                      i % 2 === 1 && "data-table-row-alt",
                      initial && "bg-sky-50/80 dark:bg-sky-950/25",
                      target && "bg-violet-50/80 dark:bg-violet-950/30",
                    )}
                  >
                    <td className="col-pinned font-semibold">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span>{fmtPercent(p.performance, 2)}</span>
                        {initial ? <Badge tone="sky">Initial</Badge> : null}
                        {target ? <Badge tone="violet">Target</Badge> : null}
                        {protection ? <Badge tone="emerald">Protection</Badge> : null}
                        {floor ? <Badge tone="rose">Floor</Badge> : null}
                      </span>
                    </td>
                    <td className="text-right font-bold text-emerald-800 dark:text-emerald-300">{fmtPercent(p.clientReturn, 2)}</td>
                    <td className="text-right">{fmtCrore(p.maturityValueCr)}</td>
                    <td className="text-right">{fmtPercent(p.preTaxIrr, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 font-ui text-xs italic text-muted">
        Levels: every strike, the protection level and 0.01% below it, zero, and every 5% in between.
      </p>
    </motion.div>
  );
}
