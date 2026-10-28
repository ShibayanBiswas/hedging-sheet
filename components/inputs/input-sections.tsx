"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Check,
  Coins,
  Gauge,
  Landmark,
  Layers,
  LineChart,
  Percent,
  RefreshCw,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Sigma,
  TrendingUp,
  Zap,
} from "lucide-react";

import { FieldRow, NumberInput, Segmented, Stepper, TextInput, Toggle } from "@/components/ui/fields";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { autoHedgeStrike } from "@/lib/engine/defaults";
import { formatDate } from "@/lib/engine/dates";
import { annualVolFromDaily, dailyVolFromAnnual } from "@/lib/engine/hedging-sheet";
import {
  DAYS_PER_MONTH,
  EXPIRY_WEEKDAY,
  expiryDates,
  MAX_EXPIRIES,
  maturityDate,
  medianExpiryIndex,
  MIN_EXPIRIES,
  rawExpiryDate,
  resizeList,
  WEEKDAY_NAMES,
} from "@/lib/engine/schedule";
import { buildStrikes, deriveTerms, MAX_SPREADS, MIN_SPREADS, spreadCount, startLevel } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { deskEase } from "@/lib/motion";
import { cn } from "@/lib/cn";

function useFieldError() {
  const { issues } = useDesk();
  return (field: string) => issues.errors.find((e) => e.field === field)?.message ?? null;
}

function SubSection({ title, icon: Icon, children, subtitle }: { title: string; icon: typeof Activity; children: ReactNode; subtitle?: string }) {
  return (
    <div className="w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] p-4">
      <div className="mb-3">
        <h3 className="flex items-center gap-2 font-ui text-sm font-bold text-ink">
          <span className="inline-flex rounded-lg bg-gradient-to-br from-gold/30 to-maroon/15 p-1.5 text-gold-dark">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h3>
        {subtitle ? <p className="mt-1 font-ui text-[11px] text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function ResetIcon({ onClick, label, testId }: { onClick: () => void; label: string; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold-dark transition hover:rotate-[-30deg] hover:bg-gold/20"
    >
      <RotateCcw className="h-4 w-4" />
    </button>
  );
}

function StatusBadge({ tone, children, testId }: { tone: "ok" | "warn" | "muted"; children: ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-ui text-[10px] font-bold uppercase tracking-wider",
        tone === "ok" && "border-emerald-400/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        tone === "warn" && "border-amber-400/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        tone === "muted" && "border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] text-muted",
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ strike helpers

function withStrike(prev: HedgeInputs, index: number, pct: number): Partial<HedgeInputs> {
  const next = [...prev.strikePercents];
  next[index] = pct;
  return { strikePercents: next };
}

function roleLabel(n: number, i: number): string {
  if (i === 0) return n === 1 ? "Target · Spread 1 Sell Level" : `Target · Spread ${n} Sell Level`;
  if (i < n) return `Spread ${n - i} Sell Level · Spread ${n - i + 1} Buy Level`;
  if (i === n) return "Spread 1 Buy Level";
  if (i === n + 1) return "Protection Level";
  if (i === n + 2) return "Protection Outflow Step";
  return "Decay Floor Level";
}

// ------------------------------------------------------------------ Underlying and Market

export function UnderlyingSection({ index }: { index: number }) {
  const { inputs, setInputs, setUnderlying, levels, levelsLoading, refreshLevels } = useDesk();
  const errorFor = useFieldError();
  const start = Number.isFinite(inputs.spot) ? startLevel(inputs) : NaN;
  return (
    <Panel index={index} id="underlying">
      <SectionTitle icon={LineChart} subtitle="Every label renames with the chosen underlying. Spot is the last completed session close.">
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
        <FieldRow label="Valuation Date" htmlFor="valuation-date" error={errorFor("valuationDate")} hint="Today in India by default.">
          <TextInput
            id="valuation-date"
            type="date"
            testId="valuation-date"
            value={inputs.valuationDate}
            onChange={(e) => e.target.value && setInputs({ valuationDate: e.target.value })}
          />
        </FieldRow>
        <FieldRow
          label={`${inputs.underlying} Spot`}
          error={errorFor("spot")}
          hint={`Derived Spot equals the fetched spot. Start ${inputs.underlying} Level is ${fmtNumber(start, 0)}.`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <NumberInput value={inputs.spot} onChange={(v) => setInputs({ spot: v })} digits={2} testId="spot" placeholder={levelsLoading ? "Fetching The Close" : "Spot"} />
            </div>
            <button
              type="button"
              className="btn-animated btn-motion btn-accent shrink-0"
              data-testid="refresh-yahoo"
              onClick={async () => {
                const lv = await refreshLevels();
                const level = inputs.underlying === "Sensex" ? lv?.sensexLevel : lv?.niftyLevel;
                if (lv && level) setInputs({ spot: level, valuationDate: lv.valuationDate });
              }}
            >
              <span className="btn-shine" aria-hidden />
              <span className="relative z-10 inline-flex items-center gap-2">
                <RefreshCw className={levelsLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh From Yahoo
              </span>
            </button>
            <span className="hs-chip" data-testid="fetched-at">
              {levels?.fetchedAt
                ? `Fetched At ${new Date(levels.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : levelsLoading
                  ? "Fetching"
                  : "Yahoo Unavailable"}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Hedge Strike" error={errorFor("hedgeStrike")} hint="The listed option sold for the Day 1 Vega Hedge. Auto picks the nearest 100 point strike to the spot.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <NumberInput value={inputs.hedgeStrike} onChange={(v) => setInputs({ hedgeStrike: v, hedgeStrikeAuto: false })} digits={0} testId="hedge-strike" />
            </div>
            <Toggle
              label="Auto From Spot"
              checked={inputs.hedgeStrikeAuto}
              testId="hedge-strike-auto"
              onChange={(v) => setInputs({ hedgeStrikeAuto: v, hedgeStrike: v && Number.isFinite(inputs.spot) ? autoHedgeStrike(inputs.spot) : inputs.hedgeStrike })}
            />
          </div>
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Rates

export function RatesSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  return (
    <Panel index={index} id="rates">
      <SectionTitle icon={Percent}>Rates in Percent</SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="NBFC Rate" error={errorFor("nbfcRate")}>
          <NumberInput kind="percent" value={inputs.nbfcRate} onChange={(v) => setInputs({ nbfcRate: v })} suffix="%" testId="nbfc-rate" />
        </FieldRow>
        <FieldRow label="Premium Growth Rate" error={errorFor("premiumRate")} hint="Linked rate curve points and the rate cap while selling forward follow it.">
          <NumberInput kind="percent" value={inputs.premiumRate} onChange={(v) => setInputs({ premiumRate: v })} suffix="%" testId="premium-rate" />
        </FieldRow>
        <FieldRow label="Margin Growth Rate" error={errorFor("marginGrowthRate")}>
          <NumberInput kind="percent" value={inputs.marginGrowthRate} onChange={(v) => setInputs({ marginGrowthRate: v })} suffix="%" testId="margin-rate" />
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Product Terms

export function ProductTermsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const terms = deriveTerms(inputs);
  const n = terms.nSpreads;
  return (
    <Panel index={index} id="terms">
      <SectionTitle
        icon={ScrollText}
        subtitle="Target, Protection and the Decay Floor Level are the strikes in another form; editing one moves its strike."
        aside={<span className="hs-chip" data-testid="maturity-chip">Maturity Date {formatDate(inputs.tenorDays > 0 ? maturityDate(inputs) : null)}</span>}
      >
        Product Terms
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label={`Target ${inputs.underlying} Rise`} error={errorFor("strikes.0")} hint="Strike 1: the Sell Level of the top spread.">
          <NumberInput kind="percent" value={terms.target} onChange={(v) => setInputs((prev) => withStrike(prev, 0, 100 * (1 + v)))} suffix="%" testId="target" />
        </FieldRow>
        <FieldRow label="Coupon" error={errorFor("coupon")} hint="The maximum coupon paid at or above the Target.">
          <NumberInput kind="percent" value={inputs.coupon} onChange={(v) => setInputs({ coupon: v })} suffix="%" testId="coupon" />
        </FieldRow>
        <FieldRow label="Protection" error={errorFor("protection")} hint={`Strike ${n + 2}, with the one point outflow step below it as Strike ${n + 3}.`}>
          <NumberInput
            kind="percent"
            value={terms.protection}
            onChange={(v) =>
              setInputs((prev) => {
                const width = prev.strikePercents[n + 1]! - prev.strikePercents[n + 2]!;
                const next = [...prev.strikePercents];
                next[n + 1] = 100 * (1 - v);
                next[n + 2] = next[n + 1]! - width;
                return { strikePercents: next };
              })
            }
            suffix="%"
            testId="protection"
          />
        </FieldRow>
        <FieldRow label="Decay" error={errorFor("decay")} hint="Downside participation below the protection level.">
          <NumberInput value={inputs.decay} onChange={(v) => setInputs({ decay: v })} digits={2} suffix="Times" testId="decay" />
        </FieldRow>
        <FieldRow label="Decay Floor Level" error={errorFor("floorLevel")} hint={`Strike ${n + 4}, as percent of the start level. Below it the slope is Decay less the Floor Units.`}>
          <NumberInput kind="percent" digits={0} value={terms.floorLevel} onChange={(v) => setInputs((prev) => withStrike(prev, n + 3, 100 * v))} suffix="%" testId="floor-level" />
        </FieldRow>
        <FieldRow label="Floor Units" error={errorFor("floorUnits")} hint={`Units bought at the floor. Slope below the floor: ${fmtNumber(inputs.decay - inputs.floorUnits, 2)}.`}>
          <NumberInput value={inputs.floorUnits} onChange={(v) => setInputs({ floorUnits: v })} digits={2} testId="floor-units" />
        </FieldRow>
        <FieldRow label="Tenor in Days" error={errorFor("tenorDays")}>
          <NumberInput kind="integer" value={inputs.tenorDays} onChange={(v) => setInputs({ tenorDays: v })} suffix="Days" testId="tenor" />
        </FieldRow>
        <FieldRow label="Start Level Uplift" hint="Start level is ROUNDUP of the spot times one plus this uplift, to the next 100.">
          <NumberInput kind="percent" value={inputs.startLevelUplift} onChange={(v) => setInputs({ startLevelUplift: v })} suffix="%" testId="uplift" />
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Observation Expiries

export function ExpiriesSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const reduce = useReducedMotion();
  const dates = expiryDates(inputs);
  const weekday = WEEKDAY_NAMES[EXPIRY_WEEKDAY[inputs.underlying]]!;
  const median = medianExpiryIndex(inputs.expiryCount);

  const setCount = (count: number) =>
    setInputs((prev) => ({
      expiryCount: count,
      expiryMonths: resizeList(prev.expiryMonths, count, NaN),
      hedgeExpiryIndex: prev.hedgeExpiryIndex != null && prev.hedgeExpiryIndex < count ? prev.hedgeExpiryIndex : null,
    }));

  return (
    <Panel index={index} id="expiries">
      <SectionTitle
        icon={CalendarClock}
        subtitle={`Each month number m gives a raw date of the valuation date plus m × ${DAYS_PER_MONTH} days, rounded. The expiry is the ${weekday} nearest to it, never more than 3 days away.`}
        aside={
          <span className="hs-chip hs-chip-maroon" data-testid="expiry-weekday">
            {inputs.underlying} Expiry Weekday · {weekday}
          </span>
        }
      >
        Observation Expiries
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Number Of Expiry Dates" error={errorFor("expiryCount")} hint={`From ${MIN_EXPIRIES} to ${MAX_EXPIRIES}.`}>
          <Stepper label="Number Of Expiry Dates" value={inputs.expiryCount} min={MIN_EXPIRIES} max={MAX_EXPIRIES} onChange={setCount} testId="expiry-count" />
        </FieldRow>
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {Array.from({ length: inputs.expiryCount }, (_, i) => {
              const month = inputs.expiryMonths[i];
              const date = dates[i];
              const raw = Number.isInteger(month) && month! > 0 ? rawExpiryDate(inputs.valuationDate, month!) : null;
              const error = errorFor(`expiryMonths.${i}`);
              return (
                <motion.div
                  key={i}
                  layout={!reduce}
                  className={cn(
                    "rounded-2xl border bg-[color:var(--ar-panel)] p-3",
                    error ? "border-rose-400/60" : "border-[color:var(--ar-border)]",
                  )}
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: deskEase }}
                >
                  <p className="label-chip">Expiry Month {i + 1}</p>
                  <div className="mt-2">
                    <NumberInput
                      kind="integer"
                      value={month ?? NaN}
                      placeholder="Month Number"
                      testId={`expiry-month-${i}`}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      </motion.span>
                    </AnimatePresence>
                    {raw ? <span className="font-ui text-[10px] text-muted">Raw {formatDate(raw)}</span> : null}
                    {i === (inputs.hedgeExpiryIndex ?? median) ? <span className="font-ui text-[10px] font-bold text-gold-dark">Option Expiry</span> : null}
                  </div>
                  {error ? <p className="hs-error mt-2">{error}</p> : null}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <FieldRow label="Option Expiry" hint="The expiry of the listed hedge option: the median expiry, the lower middle one for an even count.">
          <select
            className="input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none focus:border-gold"
            value={inputs.hedgeExpiryIndex ?? "median"}
            data-testid="option-expiry"
            onChange={(e) => setInputs({ hedgeExpiryIndex: e.target.value === "median" ? null : Number(e.target.value) })}
          >
            <option value="median">Median Expiry · {dates[median] ? formatDate(dates[median]) : "-"}</option>
            {dates.map((d, i) => (
              <option key={i} value={i} disabled={!d}>
                Expiry {i + 1} · {d ? formatDate(d) : "-"}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Strikes

export function StrikesSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const reduce = useReducedMotion();
  const n = spreadCount(inputs);
  const start = Number.isFinite(inputs.spot) ? startLevel(inputs) : NaN;
  const ordered = inputs.strikePercents.every((v, i, a) => Number.isFinite(v) && v > 0 && (i === 0 || v < a[i - 1]!));
  const slots = Number.isFinite(start) && ordered ? buildStrikes(inputs, start) : null;
  return (
    <Panel index={index} id="strikes">
      <SectionTitle
        icon={Layers}
        subtitle="Strikes as percent of the start level, highest first. Units are the change in slope of the payoff across each strike."
        aside={<span className="hs-chip">{inputs.strikePercents.length} Strikes</span>}
      >
        Strikes
      </SectionTitle>
      <div className="grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${inputs.strikePercents.length}, minmax(9.5rem, 1fr))`, overflowX: "auto" }}>
        <AnimatePresence initial={false}>
          {inputs.strikePercents.map((pct, i) => {
            const slot = slots?.[i];
            const error = errorFor(`strikes.${i}`);
            return (
              <motion.div
                key={i}
                layout={!reduce}
                data-testid={`strike-card-${i}`}
                className={cn("rounded-2xl border bg-[color:var(--ar-panel)] p-3", error ? "border-rose-400/60" : "border-[color:var(--ar-border)]")}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: deskEase }}
              >
                <p className="font-ui text-sm font-bold text-ink">Strike {i + 1}</p>
                <p className="mb-2 min-h-[2rem] font-ui text-[10px] font-semibold uppercase tracking-wider text-gold-dark">{roleLabel(n, i)}</p>
                <NumberInput value={pct} digits={2} suffix="%" testId={`strike-${i}`} onChange={(v) => setInputs((prev) => withStrike(prev, i, v))} />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="hs-chip" data-testid={`strike-units-${i}`}>
                    Units {slot ? fmtNumber(slot.units, 2) : "-"}
                  </span>
                  <span className={cn("hs-chip", slot && slot.units < 0 && "hs-chip-maroon")}>{slot ? (slot.units < 0 ? "Sell" : "Buy") : "-"}</span>
                </div>
                {error ? <p className="hs-error mt-2">{error}</p> : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Spreads and Option Type

export function SpreadsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const reduce = useReducedMotion();
  const terms = deriveTerms(inputs);
  const n = terms.nSpreads;
  const payouts = terms.spreads.map((s) => (s.sell - s.buy) * s.participation);
  const total = payouts.reduce((a, b) => a + b, 0);

  const setCount = (count: number) =>
    setInputs((prev) => {
      const cur = spreadCount(prev);
      const k = [...prev.strikePercents];
      let parts = [...prev.participations];
      if (count > cur) {
        // New spreads go on top of the old target, five points apart; the old top spread falls back to 1.
        parts = parts.map((p, j) => (j === parts.length - 1 ? 1 : p));
        for (let a = 0; a < count - cur; a++) {
          k.unshift(k[0]! + 5);
          parts.push(a === count - cur - 1 ? null : 1);
        }
      } else if (count < cur) {
        k.splice(0, cur - count);
        parts = parts.slice(0, count);
        parts[parts.length - 1] = null;
      }
      return { strikePercents: k, participations: parts };
    });

  const setLevel = (strikeIndex: number, fraction: number) => setInputs((prev) => withStrike(prev, strikeIndex, 100 * (1 + fraction)));

  return (
    <Panel index={index} id="spreads">
      <SectionTitle
        icon={TrendingUp}
        subtitle="Spreads are derived from the strikes. Editing a level moves its strike; participation is derived from the Coupon at the top spread."
        aside={
          <span className={Math.abs(total - inputs.coupon) > 1e-9 ? "hs-chip hs-chip-maroon" : "hs-chip"} data-testid="max-coupon">
            Maximum Upside {fmtPercent(total)}
          </span>
        }
      >
        Spreads and Option Type
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Option Type" hint="Every leg, the hedge and every Option Type column use it. A call book replicates the same payoff up to futures and cash.">
          <Segmented
            label="Option Type"
            testId="option-type"
            value={inputs.optionType}
            onChange={(v) => setInputs({ optionType: v })}
            options={[
              { value: "P", label: "Put" },
              { value: "C", label: "Call" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Number Of Spreads" error={errorFor("spreads")} hint={`From ${MIN_SPREADS} to ${MAX_SPREADS}. Adding a spread adds a strike on top.`}>
          <Stepper label="Number Of Spreads" value={n} min={MIN_SPREADS} max={MAX_SPREADS} onChange={setCount} testId="spread-count" />
        </FieldRow>
        <AnimatePresence initial={false}>
          {terms.spreads.map((s, j) => {
            const derived = terms.participationDerived[j];
            const isTop = j === n - 1;
            const buyStrike = n - j;
            const sellStrike = n - j - 1;
            const error = errorFor(`spreads.${j}`);
            return (
              <motion.div
                key={j}
                layout={!reduce}
                className="w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] p-4"
                data-testid={`spread-card-${j}`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: deskEase }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="label-chip">
                    Spread {j + 1} · Strike {buyStrike + 1} To Strike {sellStrike + 1}
                  </p>
                  <span className="hs-chip">Pays {fmtPercent(payouts[j])}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Spread {j + 1} Buy Level</p>
                    <NumberInput kind="percent" suffix="%" value={s.buy} onChange={(v) => setLevel(buyStrike, v)} testId={`spread-${j}-buy`} />
                  </div>
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Spread {j + 1} Sell Level</p>
                    <NumberInput kind="percent" suffix="%" value={s.sell} onChange={(v) => setLevel(sellStrike, v)} testId={`spread-${j}-sell`} />
                  </div>
                  <div>
                    <p className="mb-1 flex items-center gap-2 font-ui text-[11px] font-semibold text-muted">
                      Spread {j + 1} Participation Rate
                      {isTop ? (
                        <StatusBadge tone={derived ? "ok" : "warn"} testId={`spread-${j}-participation-status`}>
                          {derived ? "Derived" : "Overridden"}
                        </StatusBadge>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <NumberInput
                          value={s.participation}
                          digits={2}
                          onChange={(v) =>
                            setInputs((prev) => {
                              const parts = [...prev.participations];
                              parts[j] = v;
                              return { participations: parts };
                            })
                          }
                          testId={`spread-${j}-participation`}
                        />
                      </div>
                      {isTop && !derived ? (
                        <ResetIcon
                          label="Reset To Derived"
                          testId={`spread-${j}-reset`}
                          onClick={() =>
                            setInputs((prev) => {
                              const parts = [...prev.participations];
                              parts[j] = null;
                              return { participations: parts };
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
                {error ? <p className="hs-error mt-2">{error}</p> : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Notional and Costs

export function CostsSection({ index }: { index: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
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

// ------------------------------------------------------------------ Volatility and Margin

/** Gold chip button with a spinning ring while fetching and a tick on success. */
function ComputeButton({ onClick, loading }: { onClick: () => Promise<number | null>; loading: boolean }) {
  const [done, setDone] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(false), 2_000);
    return () => window.clearTimeout(id);
  }, [done]);
  return (
    <motion.button
      type="button"
      data-testid="compute-history"
      disabled={loading}
      whileHover={reduce ? undefined : { y: -1, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className="btn-animated btn-motion btn-accent group inline-flex shrink-0 items-center gap-2.5"
      onClick={async () => {
        const vol = await onClick();
        if (vol != null) setDone(true);
      }}
    >
      <span className="btn-shine" aria-hidden />
      <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold-light via-gold to-gold-dark text-white shadow-sm">
        {loading ? (
          <span className="absolute inset-0 animate-spin rounded-lg border-2 border-white/30 border-t-white" aria-hidden />
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={done ? "done" : "idle"} className="inline-flex" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
            {done ? <Check className="h-4 w-4" /> : <Sigma className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="relative z-10 font-semibold">{loading ? "Computing From History" : done ? "Computed" : "Compute From History"}</span>
    </motion.button>
  );
}

export function VolatilitySection({ index }: { index: number }) {
  const { inputs, setInputs, computeDailyVol, dailyVolStatus } = useDesk();
  const errorFor = useFieldError();
  const u = inputs.underlying;
  const source = inputs.dailyVolSource;
  return (
    <Panel index={index} id="volatility">
      <SectionTitle icon={Gauge}>Volatility and Margin</SectionTitle>
      <div className="flex flex-col gap-4">
        <SubSection
          title="Volatility"
          icon={Activity}
          subtitle="Daily volatility is the standard deviation of daily log returns of Yahoo closes over the window. Annual volatility is daily volatility times the square root of 365."
        >
          <FieldRow label={`${u} Daily Volatility`} error={errorFor("dailyVol")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <NumberInput kind="percent" digits={4} value={inputs.dailyVol} onChange={(v) => setInputs({ dailyVol: v, dailyVolSource: "overridden" })} suffix="%" testId="daily-vol" />
              </div>
              <StatusBadge tone={source === "calculated" ? "ok" : "warn"} testId="daily-vol-status">
                {source === "calculated" ? "Calculated" : source === "overridden" ? "Overridden" : "Fallback"}
              </StatusBadge>
              {source !== "calculated" ? <ResetIcon label="Reset To Calculated" testId="daily-vol-reset" onClick={() => void computeDailyVol()} /> : null}
            </div>
          </FieldRow>
          <FieldRow label={`${u} Annual Volatility`} hint="Edit either one; the other follows.">
            <NumberInput
              kind="percent"
              value={annualVolFromDaily(inputs.dailyVol)}
              onChange={(v) => setInputs({ dailyVol: dailyVolFromAnnual(v), dailyVolSource: "overridden" })}
              suffix="%"
              testId="annual-vol"
            />
          </FieldRow>
          <FieldRow
            label="History Window"
            hint={
              dailyVolStatus.error
                ? dailyVolStatus.error
                : dailyVolStatus.from
                  ? `${dailyVolStatus.observations} daily returns from ${formatDate(dailyVolStatus.from)} to ${formatDate(dailyVolStatus.to)}.`
                  : undefined
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="input-glow flex-1 rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none focus:border-gold"
                value={inputs.historyWindowDays}
                data-testid="history-window"
                onChange={(e) => void computeDailyVol({ windowDays: Number(e.target.value) })}
              >
                <option value={182}>6 Months</option>
                <option value={365}>1 Year</option>
                <option value={730}>2 Years</option>
                <option value={1095}>3 Years</option>
              </select>
              <ComputeButton loading={dailyVolStatus.loading} onClick={() => computeDailyVol()} />
            </div>
          </FieldRow>
        </SubSection>

        <SubSection title="Exchange Pricing Rates" icon={Landmark} subtitle="Forward and discount rates for the exchange price of the hedge, from the exchange volatility file.">
          <FieldRow label="Exchange Forward Rate">
            <NumberInput kind="percent" value={inputs.exchangeForwardRate} onChange={(v) => setInputs({ exchangeForwardRate: v })} suffix="%" testId="exchange-forward" />
          </FieldRow>
          <FieldRow label="Exchange Discount Rate">
            <NumberInput kind="percent" value={inputs.exchangeDiscountRate} onChange={(v) => setInputs({ exchangeDiscountRate: v })} suffix="%" testId="exchange-discount" />
          </FieldRow>
        </SubSection>

        <SubSection title="Stressed Pricing Rates" icon={ShieldAlert} subtitle="Forward and discount rates for the stressed price of the hedge.">
          <FieldRow label="Stressed Forward Rate">
            <NumberInput kind="percent" value={inputs.stressedForwardRate} onChange={(v) => setInputs({ stressedForwardRate: v })} suffix="%" testId="stressed-forward" />
          </FieldRow>
          <FieldRow label="Stressed Discount Rate">
            <NumberInput kind="percent" value={inputs.stressedDiscountRate} onChange={(v) => setInputs({ stressedDiscountRate: v })} suffix="%" testId="stressed-discount" />
          </FieldRow>
        </SubSection>

        <SubSection title="Stress Shock" icon={Zap} subtitle="Spot is shocked down by the sigmas over the days, and volatility is scaled by the multiplier.">
          <FieldRow label="Shock Sigmas">
            <NumberInput value={inputs.stressSigmas} onChange={(v) => setInputs({ stressSigmas: v })} digits={0} suffix="Sigmas" testId="stress-sigmas" />
          </FieldRow>
          <FieldRow label="Shock Days">
            <NumberInput value={inputs.stressDays} onChange={(v) => setInputs({ stressDays: v })} digits={0} suffix="Days" testId="stress-days" />
          </FieldRow>
          <FieldRow label="Volatility Multiplier">
            <NumberInput value={inputs.stressVolMultiplier} onChange={(v) => setInputs({ stressVolMultiplier: v })} digits={2} suffix="Times" testId="stress-multiplier" />
          </FieldRow>
        </SubSection>

        <SubSection title="Margins" icon={Percent}>
          <FieldRow label="Exposure Margin" error={errorFor("exposureMargin")} hint="Charged on the shocked level of the sold hedge options.">
            <NumberInput kind="percent" value={inputs.exposureMargin} onChange={(v) => setInputs({ exposureMargin: v })} suffix="%" testId="exposure-margin" />
          </FieldRow>
          <FieldRow label="Futures Margin" error={errorFor("futuresMargin")} hint="Margin on the notional value of the residual futures.">
            <NumberInput kind="percent" value={inputs.futuresMargin} onChange={(v) => setInputs({ futuresMargin: v })} suffix="%" testId="futures-margin" />
          </FieldRow>
        </SubSection>
      </div>
    </Panel>
  );
}
