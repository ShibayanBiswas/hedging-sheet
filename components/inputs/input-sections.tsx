"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Check,
  CloudDownload,
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

import { ChoiceSelect, FieldRow, NumberInput, Stepper, TextInput, Toggle } from "@/components/ui/fields";
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
import type { HedgeInputs, OptionType, Underlying } from "@/lib/engine/types";
import { underlyingName, type DeskInputs } from "@/lib/inputs/draft";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { deskEase } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Inline error for a field: invalid values at once, empty fields after a run attempt. */
function useFieldError() {
  const { visibleErrors } = useDesk();
  return (field: string) => visibleErrors.find((e) => e.field === field)?.message ?? null;
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

/** Gold chip button with a spinning ring while working and a tick on success, in the Round 2 compute style. */
function FetchButton({
  onClick,
  loading,
  label,
  busyLabel,
  doneLabel,
  icon: Icon,
  testId,
}: {
  onClick: () => Promise<number | null>;
  loading: boolean;
  label: string;
  busyLabel: string;
  doneLabel: string;
  icon: typeof Sigma;
  testId: string;
}) {
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
      data-testid={testId}
      disabled={loading}
      whileHover={reduce ? undefined : { y: -1, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className="btn-animated btn-motion btn-accent group inline-flex shrink-0 items-center gap-2.5"
      onClick={async () => {
        const v = await onClick();
        if (v != null) setDone(true);
      }}
    >
      <span className="btn-shine" aria-hidden />
      <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold-light via-gold to-gold-dark text-white shadow-sm">
        {loading ? <span className="absolute inset-0 animate-spin rounded-lg border-2 border-white/30 border-t-white" aria-hidden /> : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={done ? "done" : "idle"} className="inline-flex" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
            {done ? <Check className="h-4 w-4" data-testid={`${testId}-done`} /> : <Icon className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="relative z-10 font-semibold">{loading ? busyLabel : done ? doneLabel : label}</span>
    </motion.button>
  );
}

// ------------------------------------------------------------------ strike helpers

function withStrike(prev: DeskInputs, index: number, pct: number): Partial<DeskInputs> {
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
  const { mode, inputs, setInputs, setUnderlying, levels, levelsLoading, refreshLevels, fetchLiveSpot } = useDesk();
  const errorFor = useFieldError();
  const u = underlyingName(inputs);
  const start = Number.isFinite(inputs.spot) && Number.isFinite(inputs.startLevelUplift) ? startLevel(inputs) : NaN;
  return (
    <Panel index={index} id="underlying">
      <SectionTitle icon={LineChart} subtitle="Every label renames with the chosen underlying. Spot is the last completed session close.">
        Underlying And Market
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Underlying" error={errorFor("underlying")}>
          <ChoiceSelect<Underlying>
            value={inputs.underlying}
            testId="input-underlying"
            invalid={Boolean(errorFor("underlying"))}
            onChange={setUnderlying}
            options={[
              { value: "Nifty", label: "Nifty" },
              { value: "Sensex", label: "Sensex" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Valuation Date" error={errorFor("valuationDate")} hint={mode === "default" ? "Today in India by default." : "Today or an earlier date."}>
          <TextInput
            type="date"
            testId="input-valuationDate"
            placeholder="Eg 28-Oct-2026"
            invalid={Boolean(errorFor("valuationDate"))}
            value={inputs.valuationDate}
            onChange={(e) => setInputs({ valuationDate: e.target.value })}
          />
        </FieldRow>
        <FieldRow
          label={`${u} Spot`}
          error={errorFor("spot")}
          hint={`Derived Spot equals the spot. Start ${u} Level is ${Number.isFinite(start) ? fmtNumber(start, 0) : "-"}.`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <NumberInput
                value={inputs.spot}
                onChange={(v) => setInputs({ spot: v })}
                onBlankChange={() => setInputs({ spot: NaN })}
                digits={2}
                testId="input-spot"
                invalid={Boolean(errorFor("spot"))}
                placeholder={mode === "default" && levelsLoading ? "Fetching The Close" : "Eg 73,500"}
              />
            </div>
            {mode === "blank" ? (
              <FetchButton
                testId="fetch-live-spot"
                icon={CloudDownload}
                label="Fetch Live Spot"
                busyLabel="Fetching Live Spot"
                doneLabel="Spot Fetched"
                loading={levelsLoading}
                onClick={fetchLiveSpot}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="btn-animated btn-motion btn-accent shrink-0"
                  data-testid="refresh-yahoo"
                  onClick={async () => {
                    const lv = await refreshLevels();
                    const level = inputs.underlying === "Nifty" ? lv?.niftyLevel : lv?.sensexLevel;
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
              </>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Hedge Strike" error={errorFor("hedgeStrike")} hint="The listed option sold for the Day 1 Vega Hedge. Auto picks the nearest 100 point strike to the spot.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <NumberInput
                value={inputs.hedgeStrike}
                onChange={(v) => setInputs({ hedgeStrike: v, hedgeStrikeAuto: false })}
                onBlankChange={() => setInputs({ hedgeStrike: NaN, hedgeStrikeAuto: false })}
                digits={0}
                testId="input-hedgeStrike"
                invalid={Boolean(errorFor("hedgeStrike"))}
                placeholder="Eg 73,500"
              />
            </div>
            <Toggle
              label="Auto From Spot"
              checked={inputs.hedgeStrikeAuto}
              testId="input-hedgeStrikeAuto"
              onChange={(v) => setInputs({ hedgeStrikeAuto: v, hedgeStrike: v && Number.isFinite(inputs.spot) ? autoHedgeStrike(inputs.spot) : inputs.hedgeStrike })}
            />
          </div>
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Rates

/** A number field bound to one input key, with the blank, placeholder and error wiring every field shares. */
function KeyNumber({
  k,
  kind,
  digits,
  suffix,
  eg,
}: {
  k: keyof DeskInputs;
  kind?: "number" | "percent" | "integer";
  digits?: number;
  suffix?: string;
  eg: string;
}) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  return (
    <NumberInput
      kind={kind}
      digits={digits}
      suffix={suffix}
      value={inputs[k] as number}
      onChange={(v) => setInputs({ [k]: v } as Partial<DeskInputs>)}
      onBlankChange={() => setInputs({ [k]: NaN } as Partial<DeskInputs>)}
      testId={`input-${String(k)}`}
      invalid={Boolean(errorFor(String(k)))}
      placeholder={`Eg ${eg}${suffix ? ` ${suffix}` : ""}`}
    />
  );
}

export function RatesSection({ index }: { index: number }) {
  const errorFor = useFieldError();
  return (
    <Panel index={index} id="rates">
      <SectionTitle icon={Percent}>Rates</SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="NBFC Rate" error={errorFor("nbfcRate")}>
          <KeyNumber k="nbfcRate" kind="percent" suffix="%" eg="8" />
        </FieldRow>
        <FieldRow label="Premium Growth Rate" error={errorFor("premiumRate")} hint="Linked rate curve points and the rate cap while selling forward follow it.">
          <KeyNumber k="premiumRate" kind="percent" suffix="%" eg="6.5" />
        </FieldRow>
        <FieldRow label="Margin Growth Rate" error={errorFor("marginGrowthRate")}>
          <KeyNumber k="marginGrowthRate" kind="percent" suffix="%" eg="6.58" />
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
  const u = underlyingName(inputs);
  const hasMaturity = Number.isFinite(inputs.tenorDays) && inputs.tenorDays > 0 && Boolean(inputs.valuationDate);
  return (
    <Panel index={index} id="terms">
      <SectionTitle
        icon={ScrollText}
        subtitle="Target, Protection and the Decay Floor Level are the strikes in another form; editing one moves its strike."
        aside={<span className="hs-chip" data-testid="maturity-chip">Maturity Date {formatDate(hasMaturity ? maturityDate(inputs) : null)}</span>}
      >
        Product Terms
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label={`Target ${u} Rise`} error={errorFor("strikePercents.0")} hint="Strike 1: the Sell Level of the top spread.">
          <NumberInput
            kind="percent"
            value={terms.target}
            onChange={(v) => setInputs((prev) => withStrike(prev, 0, 100 * (1 + v)))}
            onBlankChange={() => setInputs((prev) => withStrike(prev, 0, NaN))}
            suffix="%"
            testId="input-target"
            placeholder="Eg 37 %"
          />
        </FieldRow>
        <FieldRow label="Coupon" error={errorFor("coupon")} hint="The maximum coupon paid at or above the Target.">
          <KeyNumber k="coupon" kind="percent" suffix="%" eg="102.5" />
        </FieldRow>
        <FieldRow label="Protection" error={errorFor("protection")} hint={`Strike ${n + 2}, with the one point outflow step below it as Strike ${n + 3}.`}>
          <NumberInput
            kind="percent"
            value={terms.protection}
            onChange={(v) =>
              setInputs((prev) => {
                const gap = prev.strikePercents[n + 1]! - prev.strikePercents[n + 2]!;
                const width = Number.isFinite(gap) && gap > 0 ? gap : 1;
                const next = [...prev.strikePercents];
                next[n + 1] = 100 * (1 - v);
                next[n + 2] = next[n + 1]! - width;
                return { strikePercents: next };
              })
            }
            suffix="%"
            testId="input-protection"
            invalid={Boolean(errorFor("protection"))}
            placeholder="Eg 15 %"
          />
        </FieldRow>
        <FieldRow label="Decay" error={errorFor("decay")} hint="Downside participation below the protection level.">
          <KeyNumber k="decay" digits={2} suffix="Times" eg="1.6" />
        </FieldRow>
        <FieldRow label="Decay Floor Level" error={errorFor("floorLevel")} hint={`Strike ${n + 4}, as a % of the start level. Below it the slope is Decay less the Floor Units.`}>
          <NumberInput
            kind="percent"
            digits={0}
            value={terms.floorLevel}
            onChange={(v) => setInputs((prev) => withStrike(prev, n + 3, 100 * v))}
            onBlankChange={() => setInputs((prev) => withStrike(prev, n + 3, NaN))}
            suffix="%"
            testId="input-floorLevel"
            invalid={Boolean(errorFor("floorLevel"))}
            placeholder="Eg 70 %"
          />
        </FieldRow>
        <FieldRow label="Floor Units" error={errorFor("floorUnits")} hint={`Units bought at the floor. Slope below the floor: ${fmtNumber(inputs.decay - inputs.floorUnits, 2)}.`}>
          <KeyNumber k="floorUnits" digits={2} eg="1" />
        </FieldRow>
        <FieldRow label="Tenor In Days" error={errorFor("tenorDays")}>
          <KeyNumber k="tenorDays" kind="integer" suffix="Days" eg="1,940" />
        </FieldRow>
        <FieldRow label="Start Level Uplift" error={errorFor("startLevelUplift")} hint="Start level is the spot times one plus this uplift, rounded up to the next 100.">
          <KeyNumber k="startLevelUplift" kind="percent" suffix="%" eg="0.6" />
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
  const count = Number.isInteger(inputs.expiryCount) ? inputs.expiryCount : 0;
  const dates = inputs.underlying && inputs.valuationDate && count > 0 ? expiryDates(inputs as HedgeInputs) : Array.from({ length: count }, () => null);
  const weekday = inputs.underlying ? WEEKDAY_NAMES[EXPIRY_WEEKDAY[inputs.underlying]]! : "-";
  const median = medianExpiryIndex(count);

  const setCount = (next: number) =>
    setInputs((prev) => ({
      expiryCount: next,
      expiryMonths: resizeList(prev.expiryMonths, next, NaN),
      hedgeExpiryIndex: prev.hedgeExpiryIndex != null && prev.hedgeExpiryIndex < next ? prev.hedgeExpiryIndex : null,
    }));

  return (
    <Panel index={index} id="expiries">
      <SectionTitle
        icon={CalendarClock}
        subtitle={`Each month number m gives a raw date of the valuation date plus m × ${DAYS_PER_MONTH} days, rounded. The expiry is the ${inputs.underlying ? weekday : "expiry weekday"} nearest to it, never more than 3 days away.`}
        aside={
          <span className="hs-chip hs-chip-maroon" data-testid="expiry-weekday">
            {underlyingName(inputs)} Expiry Weekday · {weekday}
          </span>
        }
      >
        Observation Expiries
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Number Of Expiry Dates" error={errorFor("expiryCount")} hint={`From ${MIN_EXPIRIES} to ${MAX_EXPIRIES}. That many month rows appear.`}>
          <ChoiceSelect<number>
            value={Number.isInteger(inputs.expiryCount) ? inputs.expiryCount : ""}
            testId="input-expiryCount"
            invalid={Boolean(errorFor("expiryCount"))}
            onChange={setCount}
            options={Array.from({ length: MAX_EXPIRIES - MIN_EXPIRIES + 1 }, (_, i) => ({ value: MIN_EXPIRIES + i, label: String(MIN_EXPIRIES + i) }))}
          />
        </FieldRow>
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {Array.from({ length: count }, (_, i) => {
              const month = inputs.expiryMonths[i];
              const date = dates[i];
              const raw = Number.isInteger(month) && month! > 0 && inputs.valuationDate ? rawExpiryDate(inputs.valuationDate, month!) : null;
              const error = errorFor(`expiryMonths.${i}`);
              return (
                <motion.div
                  key={i}
                  layout={!reduce}
                  className={cn("rounded-2xl border bg-[color:var(--ar-panel)] p-3", error ? "border-rose-400/60" : "border-[color:var(--ar-border)]")}
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
                      placeholder="Eg 41 Months"
                      ariaLabel={`Expiry Month ${i + 1}`}
                      testId={`input-expiryMonths-${i}`}
                      invalid={Boolean(error)}
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
                        {date ? formatDate(date) : "-"}
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
            data-testid="input-hedgeExpiryIndex"
            aria-label="Option Expiry"
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
  const start = Number.isFinite(inputs.spot) && Number.isFinite(inputs.startLevelUplift) ? startLevel(inputs) : NaN;
  const ordered = inputs.strikePercents.every((v, i, a) => Number.isFinite(v) && v > 0 && (i === 0 || v < a[i - 1]!));
  const slots = Number.isFinite(start) && ordered && Number.isFinite(inputs.coupon) ? buildStrikes(inputs as HedgeInputs, start) : null;
  return (
    <Panel index={index} id="strikes">
      <SectionTitle
        icon={Layers}
        subtitle="Strikes as a % of the start level, highest first. Units are the change in slope of the payoff across each strike."
        aside={<span className="hs-chip">{inputs.strikePercents.length} Strikes</span>}
      >
        Strikes
      </SectionTitle>
      <div className="grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${inputs.strikePercents.length}, minmax(9.5rem, 1fr))`, overflowX: "auto" }}>
        <AnimatePresence initial={false}>
          {inputs.strikePercents.map((pct, i) => {
            const slot = slots?.[i];
            const error = errorFor(`strikePercents.${i}`);
            const units = slot && Number.isFinite(slot.units) ? slot.units : null;
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
                <NumberInput
                  value={pct}
                  digits={2}
                  suffix="%"
                  ariaLabel={`Strike ${i + 1}`}
                  testId={`input-strikePercents-${i}`}
                  invalid={Boolean(error)}
                  placeholder={`Eg ${[137, 127, 125, 85, 84, 70][i] ?? 100}`}
                  onChange={(v) => setInputs((prev) => withStrike(prev, i, v))}
                  onBlankChange={() => setInputs((prev) => withStrike(prev, i, NaN))}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="hs-chip" data-testid={`strike-units-${i}`}>
                    Units {units != null ? fmtNumber(units, 2) : "-"}
                  </span>
                  <span className={cn("hs-chip", units != null && units < 0 && "hs-chip-maroon")}>{units != null ? (units < 0 ? "Sell" : "Buy") : "-"}</span>
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
          <span className={Number.isFinite(total) && Math.abs(total - inputs.coupon) > 1e-9 ? "hs-chip hs-chip-maroon" : "hs-chip"} data-testid="max-coupon">
            Maximum Upside {Number.isFinite(total) ? fmtPercent(total) : "-"}
          </span>
        }
      >
        Spreads And Option Type
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Option Type" error={errorFor("optionType")} hint="Every leg, the hedge and every Option Type column use it. A call book replicates the same payoff up to futures and cash.">
          <ChoiceSelect<OptionType>
            value={inputs.optionType}
            testId="input-optionType"
            invalid={Boolean(errorFor("optionType"))}
            onChange={(v) => setInputs({ optionType: v })}
            options={[
              { value: "P", label: "Put" },
              { value: "C", label: "Call" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Number Of Spreads" error={errorFor("spreadCount")} hint={`From ${MIN_SPREADS} to ${MAX_SPREADS}. Adding a spread adds a strike on top.`}>
          <Stepper label="Number Of Spreads" value={n} min={MIN_SPREADS} max={MAX_SPREADS} onChange={setCount} testId="input-spreadCount" />
        </FieldRow>
        <AnimatePresence initial={false}>
          {terms.spreads.map((s, j) => {
            const derived = terms.participationDerived[j];
            const isTop = j === n - 1;
            const buyStrike = n - j;
            const sellStrike = n - j - 1;
            const error = errorFor(`spreads.${j}`) ?? errorFor(`participations.${j}`);
            return (
              <motion.div
                key={j}
                layout={!reduce}
                className={cn("w-full rounded-2xl border bg-[color:var(--ar-panel)] p-4", error ? "border-rose-400/60" : "border-[color:var(--ar-border)]")}
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
                  <span className="hs-chip">Pays {Number.isFinite(payouts[j]) ? fmtPercent(payouts[j]) : "-"}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Spread {j + 1} Buy Level</p>
                    <NumberInput
                      kind="percent"
                      suffix="%"
                      value={s.buy}
                      ariaLabel={`Spread ${j + 1} Buy Level`}
                      placeholder="Eg 25 %"
                      onChange={(v) => setLevel(buyStrike, v)}
                      testId={`input-spreads-${j}-buy`}
                    />
                  </div>
                  <div>
                    <p className="mb-1 font-ui text-[11px] font-semibold text-muted">Spread {j + 1} Sell Level</p>
                    <NumberInput
                      kind="percent"
                      suffix="%"
                      value={s.sell}
                      ariaLabel={`Spread ${j + 1} Sell Level`}
                      placeholder="Eg 27 %"
                      invalid={Boolean(errorFor(`spreads.${j}`))}
                      onChange={(v) => setLevel(sellStrike, v)}
                      testId={`input-spreads-${j}-sell`}
                    />
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
                          ariaLabel={`Spread ${j + 1} Participation Rate`}
                          placeholder={isTop ? "Eg 10.05" : "Eg 1"}
                          invalid={Boolean(errorFor(`participations.${j}`))}
                          onChange={(v) =>
                            setInputs((prev) => {
                              const parts = [...prev.participations];
                              parts[j] = v;
                              return { participations: parts };
                            })
                          }
                          onBlankChange={() =>
                            setInputs((prev) => {
                              const parts = [...prev.participations];
                              parts[j] = isTop ? null : NaN;
                              return { participations: parts };
                            })
                          }
                          testId={`input-participations-${j}`}
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
  const errorFor = useFieldError();
  return (
    <Panel index={index} id="costs">
      <SectionTitle icon={Coins}>Notional And Costs</SectionTitle>
      <div className="flex flex-col gap-4">
        <FieldRow label="Notional In Crore" error={errorFor("notionalCr")}>
          <KeyNumber k="notionalCr" digits={2} suffix="₹ Cr" eg="100" />
        </FieldRow>
        <FieldRow label="Transaction Cost" error={errorFor("transactionCost")}>
          <KeyNumber k="transactionCost" kind="percent" suffix="%" eg="2.25" />
        </FieldRow>
        <FieldRow label="Issuance Cost" error={errorFor("issuanceCost")}>
          <KeyNumber k="issuanceCost" kind="percent" suffix="%" eg="0.13" />
        </FieldRow>
        <FieldRow label="Margin Cost" error={errorFor("marginCost")}>
          <KeyNumber k="marginCost" kind="percent" suffix="%" eg="0" />
        </FieldRow>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Volatility and Margin

export function VolatilitySection({ index }: { index: number }) {
  const { mode, inputs, setInputs, computeDailyVol, dailyVolStatus } = useDesk();
  const errorFor = useFieldError();
  const u = underlyingName(inputs);
  const source = inputs.dailyVolSource;
  const compute = (
    <FetchButton
      testId={mode === "blank" ? "compute-volatility" : "compute-history"}
      icon={Sigma}
      label={mode === "blank" ? "Compute Volatility From History" : "Compute From History"}
      busyLabel="Computing From History"
      doneLabel="Computed"
      loading={dailyVolStatus.loading && (mode === "default" || inputs.underlying !== "")}
      onClick={() => computeDailyVol()}
    />
  );
  return (
    <Panel index={index} id="volatility">
      <SectionTitle icon={Gauge}>Volatility And Margin</SectionTitle>
      <div className="flex flex-col gap-4">
        <SubSection
          title="Volatility"
          icon={Activity}
          subtitle="Daily volatility is the standard deviation of daily log returns of Yahoo closes over the window. Annual volatility is daily volatility times the square root of 365."
        >
          <FieldRow label={`${u} Daily Volatility`} error={errorFor("dailyVol")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <NumberInput
                  kind="percent"
                  digits={4}
                  value={inputs.dailyVol}
                  onChange={(v) => setInputs({ dailyVol: v, dailyVolSource: "overridden" })}
                  onBlankChange={() => setInputs({ dailyVol: NaN, dailyVolSource: "overridden" })}
                  suffix="%"
                  testId="input-dailyVol"
                  invalid={Boolean(errorFor("dailyVol"))}
                  placeholder="Eg 0.88 %"
                />
              </div>
              {Number.isFinite(inputs.dailyVol) ? (
                <StatusBadge tone={source === "calculated" ? "ok" : "warn"} testId="daily-vol-status">
                  {source === "calculated" ? "Calculated" : source === "overridden" ? "Overridden" : "Fallback"}
                </StatusBadge>
              ) : null}
              {mode === "default" && source !== "calculated" ? <ResetIcon label="Reset To Calculated" testId="daily-vol-reset" onClick={() => void computeDailyVol()} /> : null}
            </div>
          </FieldRow>
          <FieldRow label={`${u} Annual Volatility`} hint="Edit either one; the other follows.">
            <NumberInput
              kind="percent"
              value={annualVolFromDaily(inputs.dailyVol)}
              onChange={(v) => setInputs({ dailyVol: dailyVolFromAnnual(v), dailyVolSource: "overridden" })}
              onBlankChange={() => setInputs({ dailyVol: NaN, dailyVolSource: "overridden" })}
              suffix="%"
              testId="input-annualVol"
              placeholder="Eg 16.9 %"
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
                data-testid="input-historyWindowDays"
                aria-label="History Window"
                onChange={(e) => {
                  const windowDays = Number(e.target.value);
                  setInputs({ historyWindowDays: windowDays });
                  if (mode === "default") void computeDailyVol({ windowDays });
                }}
              >
                <option value={182}>6 Months</option>
                <option value={365}>1 Year</option>
                <option value={730}>2 Years</option>
                <option value={1095}>3 Years</option>
              </select>
              {compute}
            </div>
          </FieldRow>
        </SubSection>

        <SubSection title="Exchange Pricing Rates" icon={Landmark} subtitle="Forward and discount rates for the exchange price of the hedge, from the exchange volatility file.">
          <FieldRow label="Exchange Forward Rate" error={errorFor("exchangeForwardRate")}>
            <KeyNumber k="exchangeForwardRate" kind="percent" suffix="%" eg="3.48" />
          </FieldRow>
          <FieldRow label="Exchange Discount Rate" error={errorFor("exchangeDiscountRate")}>
            <KeyNumber k="exchangeDiscountRate" kind="percent" suffix="%" eg="3.48" />
          </FieldRow>
        </SubSection>

        <SubSection title="Stressed Pricing Rates" icon={ShieldAlert} subtitle="Forward and discount rates for the stressed price of the hedge.">
          <FieldRow label="Stressed Forward Rate" error={errorFor("stressedForwardRate")}>
            <KeyNumber k="stressedForwardRate" kind="percent" suffix="%" eg="3.48" />
          </FieldRow>
          <FieldRow label="Stressed Discount Rate" error={errorFor("stressedDiscountRate")}>
            <KeyNumber k="stressedDiscountRate" kind="percent" suffix="%" eg="3.48" />
          </FieldRow>
        </SubSection>

        <SubSection title="Stress Shock" icon={Zap} subtitle="Spot is shocked down by the sigmas over the days, and volatility is scaled by the multiplier.">
          <FieldRow label="Shock Sigmas" error={errorFor("stressSigmas")}>
            <KeyNumber k="stressSigmas" digits={0} suffix="Sigmas" eg="6" />
          </FieldRow>
          <FieldRow label="Shock Days" error={errorFor("stressDays")}>
            <KeyNumber k="stressDays" kind="integer" suffix="Days" eg="2" />
          </FieldRow>
          <FieldRow label="Volatility Multiplier" error={errorFor("stressVolMultiplier")}>
            <KeyNumber k="stressVolMultiplier" digits={2} suffix="Times" eg="1.25" />
          </FieldRow>
        </SubSection>

        <SubSection title="Margins" icon={Percent}>
          <FieldRow label="Exposure Margin" error={errorFor("exposureMargin")} hint="Charged on the shocked level of the sold hedge options.">
            <KeyNumber k="exposureMargin" kind="percent" suffix="%" eg="5" />
          </FieldRow>
          <FieldRow label="Futures Margin" error={errorFor("futuresMargin")} hint="Margin on the notional value of the residual futures.">
            <KeyNumber k="futuresMargin" kind="percent" suffix="%" eg="20" />
          </FieldRow>
        </SubSection>
      </div>
    </Panel>
  );
}