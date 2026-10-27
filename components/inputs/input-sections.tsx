"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  Coins,
  Gauge,
  Layers,
  LineChart,
  Percent,
  RefreshCw,
  Save,
  ScrollText,
  Sigma,
  TrendingUp,
} from "lucide-react";

import { FieldRow, IssueList, NumberInput, Segmented, Stepper, TextInput, Toggle } from "@/components/ui/fields";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { autoHedgeStrike, EXPIRY_WEEKDAY, WORKBOOK_SPOT } from "@/lib/engine/defaults";
import { formatDate } from "@/lib/engine/dates";
import { annualVolFromDaily, validateInputs } from "@/lib/engine/hedging-sheet";
import { expiryDates, maturityDate, MAX_EXPIRIES, medianExpiryIndex, resizeList } from "@/lib/engine/schedule";
import { effectiveSpreads, resolveParticipations, startLevel, strikeLevels } from "@/lib/engine/structure";
import type { HedgeInputs, StrikeRole, ValidationIssue } from "@/lib/engine/types";
import { deskEase } from "@/lib/motion";
import { fmtNumber, fmtPercent } from "@/lib/format";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function useIssues(): { errors: ValidationIssue[]; warnings: ValidationIssue[]; errorFor: (field: string) => string | null } {
  const { result, inputs } = useDesk();
  return useMemo(() => {
    let errors = result.ok ? [] : result.errors;
    const warnings = result.ok ? result.warnings : result.warnings;
    // Live feedback for the fields being typed, ahead of the debounced reprice.
    const immediate = validateInputs(inputs);
    if (immediate.errors.length) errors = immediate.errors;
    return {
      errors,
      warnings,
      errorFor: (field: string) => errors.find((e) => e.field === field)?.message ?? null,
    };
  }, [result, inputs]);
}

// ------------------------------------------------------------------ 4.1 Underlying and Market

export function UnderlyingSection({ index }: { index: number }) {
  const { inputs, setInputs, setMode, setUnderlying, levels, levelsLoading, refreshLevels } = useDesk();
  const { errorFor } = useIssues();
  const start = startLevel(inputs);
  return (
    <Panel index={index} id="underlying">
      <SectionTitle icon={LineChart} subtitle="Every label renames with the chosen underlying.">
        Underlying and Market
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Underlying">
          <Segmented
            label="Underlying"
            testId="underlying"
            value={inputs.underlying}
            onChange={setUnderlying}
            options={[
              { value: "Nifty", label: "Nifty" },
              { value: "Sensex", label: "Sensex" },
            ]}
          />
        </FieldRow>
        <FieldRow
          label="Mode"
          hint={
            inputs.mode === "workbook"
              ? `Workbook Defaults price the saved product: Trade Date ${formatDate("2026-08-04")}, spot ${fmtNumber(WORKBOOK_SPOT, 0)}, hedge strike 76,800 and the workbook vol surface.`
              : "Live uses the Yahoo close for the chosen underlying and the active desk vol surface."
          }
        >
          <Segmented
            label="Mode"
            testId="mode"
            value={inputs.mode}
            onChange={setMode}
            options={[
              { value: "workbook", label: "Workbook Defaults" },
              { value: "live", label: "Live" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Valuation Date" htmlFor="valuation-date" error={errorFor("valuationDate")}>
          <TextInput
            id="valuation-date"
            type="date"
            testId="valuation-date"
            value={inputs.valuationDate}
            onChange={(e) => e.target.value && setInputs({ valuationDate: e.target.value })}
          />
        </FieldRow>
        <FieldRow label={`${inputs.underlying} Spot`} error={errorFor("spot")} hint={`Derived Spot equals the fetched spot. Start ${inputs.underlying} Level is ${fmtNumber(start, 0)}.`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <NumberInput value={inputs.spot} onChange={(v) => setInputs({ spot: v })} digits={2} testId="spot" />
            </div>
            <button
              type="button"
              className="btn-animated btn-motion btn-accent shrink-0"
              data-testid="refresh-yahoo"
              onClick={async () => {
                const lv = await refreshLevels();
                const level = inputs.underlying === "Sensex" ? lv?.sensexLevel : lv?.niftyLevel;
                if (lv && level) {
                  setInputs({ mode: "live", spot: level, valuationDate: lv.valuationDate, hedgeStrikeAuto: true });
                }
              }}
            >
              <span className="btn-shine" aria-hidden />
              <span className="relative z-10 inline-flex items-center gap-2">
                <RefreshCw className={levelsLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh From Yahoo
              </span>
            </button>
            <span className="hs-chip" data-testid="fetched-at">
              Fetched At{" "}
              {levels?.fetchedAt
                ? new Date(levels.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "-"}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Hedge Strike" error={errorFor("hedgeStrike")} hint="The listed put sold for the Day 1 Vega Hedge. Auto picks the nearest 100 point strike to the spot.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <NumberInput
                value={inputs.hedgeStrike}
                onChange={(v) => setInputs({ hedgeStrike: v, hedgeStrikeAuto: false })}
                digits={0}
                testId="hedge-strike"
              />
            </div>
            <Toggle
              label="Auto From Spot"
              checked={inputs.hedgeStrikeAuto}
              testId="hedge-strike-auto"
              onChange={(v) => setInputs({ hedgeStrikeAuto: v, hedgeStrike: v ? autoHedgeStrike(inputs.spot) : inputs.hedgeStrike })}
            />
          </div>
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.2 Rates

export function RatesSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const { errorFor } = useIssues();
  return (
    <Panel index={index} id="rates">
      <SectionTitle icon={Percent}>Rates in Percent</SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="NBFC Rate" error={errorFor("nbfcRate")}>
          <NumberInput kind="percent" value={inputs.nbfcRate} onChange={(v) => setInputs({ nbfcRate: v })} suffix="%" testId="nbfc-rate" />
        </FieldRow>
        <FieldRow label="Premium Growth Rate" error={errorFor("premiumRate")} hint="Also the last points of the rate curve and the rate cap while selling forward, as in the workbook.">
          <NumberInput kind="percent" value={inputs.premiumRate} onChange={(v) => setInputs({ premiumRate: v })} suffix="%" testId="premium-rate" />
        </FieldRow>
        <FieldRow label="Margin Growth Rate" error={errorFor("marginGrowthRate")}>
          <NumberInput kind="percent" value={inputs.marginGrowthRate} onChange={(v) => setInputs({ marginGrowthRate: v })} suffix="%" testId="margin-rate" />
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.3 Product Terms

export function ProductTermsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const { errorFor } = useIssues();
  return (
    <Panel index={index} id="terms">
      <SectionTitle icon={ScrollText} aside={<span className="hs-chip" data-testid="maturity-chip">Maturity Date {formatDate(maturityDate(inputs))}</span>}>
        Product Terms
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label={`Target ${inputs.underlying} Rise`} error={errorFor("target")} hint="The Sell Level of the top spread.">
          <NumberInput kind="percent" value={inputs.target} onChange={(v) => setInputs({ target: v })} suffix="%" testId="target" />
        </FieldRow>
        <FieldRow label="Coupon" error={errorFor("coupon")} hint="The maximum coupon paid at or above the Target.">
          <NumberInput kind="percent" value={inputs.coupon} onChange={(v) => setInputs({ coupon: v })} suffix="%" testId="coupon" />
        </FieldRow>
        <FieldRow label="Protection" error={errorFor("protection")}>
          <NumberInput kind="percent" value={inputs.protection} onChange={(v) => setInputs({ protection: v })} suffix="%" testId="protection" />
        </FieldRow>
        <FieldRow label="Decay" error={errorFor("decay")} hint="Downside participation below the protection level.">
          <NumberInput value={inputs.decay} onChange={(v) => setInputs({ decay: v })} digits={2} suffix="Times" testId="decay" />
        </FieldRow>
        <FieldRow label="Tenor in Days" error={errorFor("tenorDays")}>
          <NumberInput kind="integer" value={inputs.tenorDays} onChange={(v) => setInputs({ tenorDays: v })} suffix="Days" testId="tenor" />
        </FieldRow>
        <FieldRow label="Decay Floor Level" error={errorFor("floorLevel")} hint="Strike as percent of the start level where the decay slope eases.">
          <NumberInput kind="percent" digits={0} value={inputs.floorLevel} onChange={(v) => setInputs({ floorLevel: v })} suffix="%" testId="floor-level" />
        </FieldRow>
        <FieldRow label="Floor Units" hint={`Units bought at the floor. Slope below the floor is decay less these units: ${fmtNumber(inputs.decay - inputs.floorUnits, 2)}.`}>
          <NumberInput value={inputs.floorUnits} onChange={(v) => setInputs({ floorUnits: v })} digits={2} testId="floor-units" />
        </FieldRow>
        <FieldRow label="Start Level Uplift" hint="The start level is the spot plus this uplift, rounded up to the next 100.">
          <NumberInput kind="percent" value={inputs.startLevelUplift} onChange={(v) => setInputs({ startLevelUplift: v })} suffix="%" testId="uplift" />
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.4 Observation Expiries

export function ExpiriesSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const { errorFor } = useIssues();
  const reduce = useReducedMotion();
  const dates = expiryDates(inputs);
  const hedgeIdx = inputs.hedgeExpiryIndex ?? medianExpiryIndex(inputs.expiryCount);

  const setCount = (count: number) =>
    setInputs((prev) => ({
      expiryCount: count,
      expiryMonths: resizeList(prev.expiryMonths, count, NaN),
      expiryOverrides: resizeList(prev.expiryOverrides, count, null),
      hedgeExpiryIndex: prev.hedgeExpiryIndex != null && prev.hedgeExpiryIndex < count ? prev.hedgeExpiryIndex : null,
    }));

  return (
    <Panel index={index} id="expiries">
      <SectionTitle
        icon={CalendarClock}
        subtitle="Month numbers count calendar months from the valuation month. Each maps to the last expiry weekday of that month."
      >
        Observation Expiries
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Number Of Expiry Dates" error={errorFor("expiryCount")}>
          <Stepper label="Number Of Expiry Dates" value={inputs.expiryCount} min={1} max={MAX_EXPIRIES} onChange={setCount} testId="expiry-count" />
        </FieldRow>
        <FieldRow
          label="Expiry Weekday"
          hint="Nifty monthly contracts expire on the last Tuesday and Sensex on the last Thursday from 1 September 2025, per NSE circular FAOP 68747 and BSE notice 20250623-59."
        >
          <select
            className="input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none focus:border-gold"
            value={inputs.expiryWeekday}
            data-testid="expiry-weekday"
            onChange={(e) => setInputs({ expiryWeekday: Number(e.target.value) })}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
                {i === EXPIRY_WEEKDAY[inputs.underlying] ? ` · ${inputs.underlying} Default` : ""}
              </option>
            ))}
          </select>
        </FieldRow>
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {Array.from({ length: inputs.expiryCount }, (_, i) => {
              const month = inputs.expiryMonths[i];
              const override = inputs.expiryOverrides[i];
              const date = dates[i];
              return (
                <motion.div
                  key={i}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={reduce ? undefined : { opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.3, ease: deskEase }}
                >
                  <FieldRow label={`Expiry Month ${i + 1}`} error={errorFor(`expiryMonths.${i}`)}>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                      <div className="lg:w-48">
                        <NumberInput
                          kind="integer"
                          value={month ?? NaN}
                          placeholder="Month Number"
                          testId={`expiry-month-${i}`}
                          disabled={Boolean(override)}
                          onChange={(v) =>
                            setInputs((prev) => {
                              const next = [...prev.expiryMonths];
                              next[i] = v;
                              return { expiryMonths: next };
                            })
                          }
                          onBlankChange={() =>
                            setInputs((prev) => {
                              const next = [...prev.expiryMonths];
                              next[i] = NaN;
                              return { expiryMonths: next };
                            })
                          }
                        />
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={date ?? "none"}
                          className="hs-chip"
                          data-testid={`expiry-date-${i}`}
                          initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.2 }}
                        >
                          {date ? formatDate(date) : "Enter A Month Number"}
                          {override ? " · Manual" : ""}
                        </motion.span>
                      </AnimatePresence>
                      <div className="flex items-center gap-2 lg:ml-auto">
                        <span className="font-ui text-[11px] text-muted">Manual Date</span>
                        <TextInput
                          type="date"
                          className="py-2 lg:w-44"
                          value={override ?? ""}
                          testId={`expiry-override-${i}`}
                          onChange={(e) =>
                            setInputs((prev) => {
                              const next = [...prev.expiryOverrides];
                              next[i] = e.target.value || null;
                              return { expiryOverrides: next };
                            })
                          }
                        />
                      </div>
                    </div>
                  </FieldRow>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <FieldRow label="Option Expiry" hint="The expiry of the listed hedge put. It defaults to the median expiry, the lower middle one for an even count.">
          <select
            className="input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none focus:border-gold"
            value={inputs.hedgeExpiryIndex ?? "median"}
            data-testid="option-expiry"
            onChange={(e) => setInputs({ hedgeExpiryIndex: e.target.value === "median" ? null : Number(e.target.value) })}
          >
            <option value="median">Median Expiry · {dates[medianExpiryIndex(inputs.expiryCount)] ? formatDate(dates[medianExpiryIndex(inputs.expiryCount)]) : "-"}</option>
            {dates.map((d, i) => (
              <option key={i} value={i} disabled={!d}>
                Expiry {i + 1} · {d ? formatDate(d) : "-"}
                {i === hedgeIdx && inputs.hedgeExpiryIndex != null ? " · Selected" : ""}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.5 Strikes

const ROLE_LABEL: Record<StrikeRole, string> = {
  spread: "Spread Level",
  protection: "Protection Level",
  outflow: "Protection Outflow Step",
  floor: "Decay Floor",
};

function applyStrikeEdit(prev: HedgeInputs, oldPct: number, roles: StrikeRole[], newPct: number): Partial<HedgeInputs> {
  const patch: Partial<HedgeInputs> = {};
  if (roles.includes("spread")) {
    const oldLevel = oldPct / 100 - 1;
    const newLevel = newPct / 100 - 1;
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    const spreads = effectiveSpreads(prev).map((s) => ({
      ...s,
      buy: near(s.buy, oldLevel) ? newLevel : s.buy,
      sell: near(s.sell, oldLevel) ? newLevel : s.sell,
    }));
    patch.spreads = spreads;
    patch.target = spreads[spreads.length - 1]!.sell;
  }
  if (roles.includes("protection")) patch.protection = 1 - newPct / 100;
  if (roles.includes("outflow")) patch.outflowWidth = (100 * (1 - prev.protection) - newPct) / 100;
  if (roles.includes("floor")) patch.floorLevel = newPct / 100;
  return patch;
}

export function StrikesSection({ index }: { index: number }) {
  const { inputs, setInputs, result } = useDesk();
  const { errorFor } = useIssues();
  const reduce = useReducedMotion();
  const levels = strikeLevels(inputs);
  const unitsByPct = new Map((result.ok ? result.structure.strikes : []).map((s) => [s.percent, s.units]));
  const mismatch = levels.percents.length !== inputs.expiryCount;
  return (
    <Panel index={index} id="strikes">
      <SectionTitle
        icon={Layers}
        subtitle="Autofilled from the spreads, the protection level, one point below it, and the decay floor. Editing a strike edits the term it comes from."
        aside={
          <span className={mismatch ? "hs-chip hs-chip-maroon" : "hs-chip"} data-testid="strike-count">
            {levels.percents.length} Strikes · {inputs.expiryCount} Expiry Dates
          </span>
        }
      >
        Strikes
      </SectionTitle>
      <div className="flex flex-col gap-3">
        {mismatch ? (
          <p className="hs-error" role="alert" data-testid="strike-count-error">
            {errorFor("strikes") ??
              `The Number Of Strikes is ${levels.percents.length} but the Number Of Expiry Dates is ${inputs.expiryCount}. The two counts must be equal before the book can be priced.`}
          </p>
        ) : null}
        <AnimatePresence initial={false}>
          {levels.percents.map((pct, i) => {
            const roles = levels.roles.get(pct) ?? [];
            const units = unitsByPct.get(pct);
            return (
              <motion.div
                key={`${i}-${roles.join("-")}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: 10 }}
                transition={{ duration: 0.28, ease: deskEase }}
              >
                <FieldRow label={`Strike ${i + 1} · ${roles.map((r) => ROLE_LABEL[r]).join(" and ")}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="sm:w-48">
                      <NumberInput
                        value={pct}
                        digits={2}
                        suffix="%"
                        testId={`strike-${i}`}
                        onChange={(v) => setInputs((prev) => applyStrikeEdit(prev, pct, roles, v))}
                      />
                    </div>
                    <span className="hs-chip">Units {units != null ? fmtNumber(units, 2) : "-"}</span>
                    <span className="hs-chip">{units != null ? (units < 0 ? "Sell Puts" : "Buy Puts") : "Not Priced"}</span>
                  </div>
                </FieldRow>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.6 Spreads

export function SpreadsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const { errorFor, warnings } = useIssues();
  const reduce = useReducedMotion();
  const spreads = effectiveSpreads(inputs);
  const parts = resolveParticipations({ ...inputs, spreads });
  const payouts = spreads.map((s, j) => (s.sell - s.buy) * (parts[j] ?? 0));
  const total = payouts.reduce((a, b) => a + b, 0);

  const setCount = (count: number) =>
    setInputs((prev) => {
      const current = effectiveSpreads(prev);
      if (count > current.length) {
        const add = Array.from({ length: count - current.length }, (_, k) => ({
          buy: prev.target + 0.05 * k,
          sell: prev.target + 0.05 * (k + 1),
          participation: 1,
        }));
        const next = [...current, ...add];
        return { spreads: next, target: next[next.length - 1]!.sell };
      }
      const next = current.slice(0, Math.max(1, count));
      return { spreads: next, target: next[next.length - 1]!.sell };
    });

  const updateSpread = (j: number, patch: Partial<{ buy: number; sell: number; participation: number }>) =>
    setInputs((prev) => {
      const next = effectiveSpreads(prev).map((s, k) => (k === j ? { ...s, ...patch } : s));
      return { spreads: next, target: next[next.length - 1]!.sell };
    });

  return (
    <Panel index={index} id="spreads">
      <SectionTitle
        icon={TrendingUp}
        aside={
          <span className={Math.abs(total - inputs.coupon) > 1e-9 ? "hs-chip hs-chip-maroon" : "hs-chip"} data-testid="max-coupon">
            Maximum Upside {fmtPercent(total)}
          </span>
        }
      >
        Spreads
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Number Of Spreads">
          <Stepper label="Number Of Spreads" value={spreads.length} min={1} max={5} onChange={setCount} testId="spread-count" />
        </FieldRow>
        <FieldRow label="Last Spread Participation">
          <Toggle
            label="Derive From The Coupon"
            checked={inputs.autoParticipation}
            testId="auto-participation"
            onChange={(v) => setInputs({ autoParticipation: v })}
          />
        </FieldRow>
        <AnimatePresence initial={false}>
          {spreads.map((s, j) => {
            const last = j === spreads.length - 1;
            return (
              <motion.div
                key={j}
                layout={!reduce}
                className="rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] p-4"
                data-testid={`spread-card-${j}`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: deskEase }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="label-chip">Spread {j + 1}</p>
                  <span className="hs-chip">Pays {fmtPercent(payouts[j])}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Buy Level</p>
                    <NumberInput kind="percent" suffix="%" value={s.buy} onChange={(v) => updateSpread(j, { buy: v })} testId={`spread-${j}-buy`} />
                  </div>
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Sell Level{last ? " · Linked To Target" : ""}</p>
                    <NumberInput kind="percent" suffix="%" value={s.sell} onChange={(v) => updateSpread(j, { sell: v })} testId={`spread-${j}-sell`} />
                  </div>
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Participation Rate{last && inputs.autoParticipation ? " · Derived" : ""}</p>
                    <NumberInput
                      value={parts[j] ?? 0}
                      digits={2}
                      disabled={last && inputs.autoParticipation}
                      onChange={(v) => updateSpread(j, { participation: v })}
                      testId={`spread-${j}-participation`}
                    />
                  </div>
                </div>
                {errorFor(`spreads.${j}`) ? <p className="hs-error mt-2">{errorFor(`spreads.${j}`)}</p> : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <IssueList errors={[]} warnings={warnings.filter((w) => w.field === "spreads")} />
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.7 Notional and Costs

export function CostsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const { errorFor } = useIssues();
  return (
    <Panel index={index} id="costs">
      <SectionTitle icon={Coins}>Notional and Costs</SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Notional in Crore" error={errorFor("notionalCr")}>
          <NumberInput value={inputs.notionalCr} onChange={(v) => setInputs({ notionalCr: v })} digits={2} suffix="₹ Crore" testId="notional" />
        </FieldRow>
        <FieldRow label="Transaction Cost" error={errorFor("transactionCost")}>
          <NumberInput kind="percent" value={inputs.transactionCost} onChange={(v) => setInputs({ transactionCost: v })} suffix="%" testId="transaction-cost" />
        </FieldRow>
        <FieldRow label="Issuance Cost" error={errorFor("issuanceCost")}>
          <NumberInput kind="percent" value={inputs.issuanceCost} onChange={(v) => setInputs({ issuanceCost: v })} suffix="%" testId="issuance-cost" />
        </FieldRow>
        <FieldRow label="Margin Cost" error={errorFor("marginCost")}>
          <NumberInput kind="percent" value={inputs.marginCost} onChange={(v) => setInputs({ marginCost: v })} suffix="%" testId="margin-cost" />
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ 4.8 Volatility and Margin

export function VolatilitySection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const { errorFor } = useIssues();
  const [windowDays, setWindowDays] = useState(365);
  const [history, setHistory] = useState<{ dailyVol: number; from: string; to: string; observations: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a computed history belongs to one underlying
    setHistory(null);
  }, [inputs.underlying]);

  return (
    <Panel index={index} id="volatility">
      <SectionTitle icon={Sigma} aside={<span className="hs-chip" data-testid="annual-vol">Annual Volatility {fmtPercent(annualVolFromDaily(inputs.dailyVol))}</span>}>
        Volatility and Margin
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label={`${inputs.underlying} Daily Volatility`} error={errorFor("dailyVol")} hint="Annual volatility is daily volatility times the square root of 365.">
          <NumberInput kind="percent" digits={4} value={inputs.dailyVol} onChange={(v) => setInputs({ dailyVol: v })} suffix="%" testId="daily-vol" />
        </FieldRow>
        <FieldRow label="Compute Daily Volatility From History" hint="Standard deviation of daily log returns of Yahoo closes. The input keeps its value until you apply the result.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="input-glow rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none focus:border-gold"
              value={windowDays}
              data-testid="history-window"
              onChange={(e) => setWindowDays(Number(e.target.value))}
            >
              <option value={182}>6 Months</option>
              <option value={365}>1 Year</option>
              <option value={730}>2 Years</option>
              <option value={1095}>3 Years</option>
            </select>
            <button
              type="button"
              className="btn-animated btn-motion btn-accent"
              data-testid="compute-history"
              onClick={async () => {
                setLoading(true);
                setHistoryError(null);
                try {
                  const res = await fetch(`/api/market/daily-vol?underlying=${inputs.underlying}&windowDays=${windowDays}`, { cache: "no-store" });
                  const data = await res.json();
                  if (!res.ok || data.dailyVol == null) throw new Error(data.error ?? "No history");
                  setHistory({ dailyVol: data.dailyVol, from: data.from, to: data.to, observations: data.observations });
                } catch (err) {
                  setHistoryError(err instanceof Error ? err.message : "Yahoo history is unavailable.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <span className="btn-shine" aria-hidden />
              <span className="relative z-10 inline-flex items-center gap-2">
                <Gauge className={loading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                Compute
              </span>
            </button>
            {history ? (
              <>
                <span className="hs-chip" data-testid="history-result">
                  {fmtPercent(history.dailyVol, 4)} · {history.observations} Returns · {formatDate(history.from)} To {formatDate(history.to)}
                </span>
                <button type="button" className="btn-ghost btn-animated text-xs" onClick={() => setInputs({ dailyVol: history.dailyVol })} data-testid="apply-history">
                  Apply
                </button>
              </>
            ) : null}
          </div>
          {historyError ? <p className="hs-error mt-2">{historyError}</p> : null}
        </FieldRow>
        <FieldRow label="Exposure Margin" error={errorFor("exposureMargin")} hint="Charged on the shocked level of the sold hedge puts.">
          <NumberInput kind="percent" value={inputs.exposureMargin} onChange={(v) => setInputs({ exposureMargin: v })} suffix="%" testId="exposure-margin" />
        </FieldRow>
        <FieldRow label="Futures Margin" error={errorFor("futuresMargin")} hint="Margin on the notional value of the residual futures.">
          <NumberInput kind="percent" value={inputs.futuresMargin} onChange={(v) => setInputs({ futuresMargin: v })} suffix="%" testId="futures-margin" />
        </FieldRow>
        <FieldRow label="Exchange Price Forward and Discount Rates" hint="Typed from the exchange volatility file, as in the workbook.">
          <div className="grid gap-2 sm:grid-cols-2">
            <NumberInput kind="percent" value={inputs.exchangeForwardRate} onChange={(v) => setInputs({ exchangeForwardRate: v })} suffix="%" testId="exchange-forward" />
            <NumberInput kind="percent" value={inputs.exchangeDiscountRate} onChange={(v) => setInputs({ exchangeDiscountRate: v })} suffix="%" testId="exchange-discount" />
          </div>
        </FieldRow>
        <FieldRow label="Stressed Price Forward and Discount Rates">
          <div className="grid gap-2 sm:grid-cols-2">
            <NumberInput kind="percent" value={inputs.stressedForwardRate} onChange={(v) => setInputs({ stressedForwardRate: v })} suffix="%" testId="stressed-forward" />
            <NumberInput kind="percent" value={inputs.stressedDiscountRate} onChange={(v) => setInputs({ stressedDiscountRate: v })} suffix="%" testId="stressed-discount" />
          </div>
        </FieldRow>
        <FieldRow label="Stress Shock" hint="Spot is shocked down by these daily sigmas over these days, and volatility is scaled by the multiplier.">
          <div className="grid gap-2 sm:grid-cols-3">
            <NumberInput value={inputs.stressSigmas} onChange={(v) => setInputs({ stressSigmas: v })} digits={0} suffix="Sigmas" testId="stress-sigmas" />
            <NumberInput value={inputs.stressDays} onChange={(v) => setInputs({ stressDays: v })} digits={0} suffix="Days" testId="stress-days" />
            <NumberInput value={inputs.stressVolMultiplier} onChange={(v) => setInputs({ stressVolMultiplier: v })} digits={2} suffix="Times" testId="stress-multiplier" />
          </div>
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Saved input sets

type SavedSet = { name: string; inputs: HedgeInputs; updatedAt?: string };

async function fetchSavedSets(): Promise<SavedSet[]> {
  try {
    const res = await fetch("/api/products", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: SavedSet[] };
    return data.products ?? [];
  } catch {
    return [];
  }
}

export function SavedSetsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const [name, setName] = useState("");
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => void fetchSavedSets().then(setSets);

  useEffect(() => {
    void fetchSavedSets().then(setSets);
  }, []);

  return (
    <Panel index={index} id="saved">
      <SectionTitle icon={Save}>Saved Input Sets</SectionTitle>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput placeholder="Name This Input Set" value={name} onChange={(e) => setName(e.target.value)} testId="save-name" />
          <button
            type="button"
            className="btn-animated btn-motion btn-accent shrink-0"
            disabled={!name.trim()}
            onClick={async () => {
              const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, inputs: { ...inputs, expiryMonths: inputs.expiryMonths.map((n) => (Number.isFinite(n) ? n : null)) } }),
              }).catch(() => null);
              const data = res ? await res.json() : null;
              setMessage(data?.persisted ? `Saved ${name}` : "The desk database is unavailable, so the set was not stored.");
              void load();
            }}
          >
            <span className="relative z-10">Save</span>
          </button>
        </div>
        {message ? <p className="hs-warning">{message}</p> : null}
        {sets.length ? (
          <div className="flex flex-wrap gap-2">
            {sets.map((s) => (
              <button
                key={s.name}
                type="button"
                className="hs-chip hover:border-gold"
                onClick={() => setInputs({ ...s.inputs, expiryMonths: s.inputs.expiryMonths.map((n) => (n == null ? NaN : Number(n))) })}
              >
                Load {s.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="font-ui text-xs text-muted">No saved sets yet.</p>
        )}
      </div>
    </Panel>
  );
}
