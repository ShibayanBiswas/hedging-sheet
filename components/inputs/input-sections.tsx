"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Check, ClipboardPaste, CloudDownload, Coins, Gauge, Layers, LineChart, Percent, RefreshCw, RotateCcw, ScrollText, type LucideIcon } from "lucide-react";

import { BulkEditDialog } from "@/components/inputs/bulk-edit-dialog";
import { ChoiceSelect, CountPicker, FieldRow, NumberInput, Segmented, TextInput, Toggle, type FieldCheck } from "@/components/ui/fields";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { focusField, useDesk } from "@/lib/context/desk-provider";
import { autoHedgeStrike } from "@/lib/engine/defaults";
import { formatDate, isValidYmd } from "@/lib/engine/dates";
import { annualVolFromDaily, dailyVolFromAnnual } from "@/lib/engine/hedging-sheet";
import { EXPIRY_WEEKDAY, MAX_EXPIRIES, medianExpiryIndex, MIN_EXPIRIES, quarterlyExpiries, resizeList, snapExpiry, WEEKDAY_NAMES } from "@/lib/engine/schedule";
import { deriveTerms, derivedSides, MAX_SPREADS, MIN_SPREADS, percentFromLevel, rupeeStrike, startLevel, strikeUnits } from "@/lib/engine/structure";
import type { OptionType, StrikeSide, Underlying } from "@/lib/engine/types";
import { parseExpiryPaste, parseStrikePaste, type PastedStrike } from "@/lib/inputs/bulk";
import { underlyingName, type DeskInputs } from "@/lib/inputs/draft";
import { setSpreadCount } from "@/lib/inputs/strikes";
import { LEVEL_FIELD, UNDERLYINGS } from "@/lib/underlyings";
import { checkFieldEdit, INPUT_SECTIONS, unlockedSteps } from "@/lib/validation/inputRules";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

// ------------------------------------------------------------------ shared pieces

/** Inline error for a field: invalid values at once, empty fields after a run attempt. */
function useFieldError() {
  const { visibleErrors } = useDesk();
  return (field: string) => visibleErrors.find((e) => e.field === field)?.message ?? null;
}

/** The rule check behind each typed number: a breaking value never reaches the inputs, and leaving the field reverts it with a popup. */
function useGuard() {
  const { inputs } = useDesk();
  const { alert } = useDeskDialog();
  return useCallback(
    (field: string) => ({
      check: (v: number) => checkFieldEdit(inputs, field, v),
      onReject: (r: FieldCheck) =>
        alert(r.message, {
          variant: "error",
          title: `${r.label} Reverted`,
          fix: r.range ? `Allowed: ${r.range}. The field is back to its last valid value.` : "The field is back to its last valid value.",
          onClose: () => focusField(field),
        }),
    }),
    [alert, inputs],
  );
}

/** A numbered input group. Until the steps before it are complete it stays visible but cannot be edited. */
function Group({ step, icon: Icon, aside, children, open }: { step: number; icon: LucideIcon; aside?: ReactNode; children: ReactNode; open: number }) {
  const locked = step > open;
  return (
    <section id={`group-${step}`} data-testid={`group-${step}`} data-locked={locked || undefined} className={cn("inputs-card glass", `inputs-card-${step}`)}>
      <header className="inputs-card-head">
        <h2 className="flex min-w-0 items-center gap-2 font-ui text-h3 font-bold text-ink">
          <span className="inputs-step" aria-hidden>
            {step}
          </span>
          <Icon className="icon-sm shrink-0 text-gold" aria-hidden />
          <span className="truncate">{INPUT_SECTIONS[step - 1]}</span>
        </h2>
        {locked ? (
          <span className="hs-chip hs-chip-maroon" data-testid={`group-${step}-locked`}>
            Complete Step {open} First
          </span>
        ) : (
          aside
        )}
      </header>
      <div className={cn("inputs-card-body", locked && "pointer-events-none select-none opacity-45")} inert={locked}>
        {children}
      </div>
    </section>
  );
}

function StatusTag({ edited, testId }: { edited: boolean; testId: string }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 font-ui text-caption font-bold uppercase leading-5 tracking-wider",
        edited ? "border-amber-400/50 text-amber-900" : "border-emerald-400/50 text-emerald-800",
      )}
    >
      {edited ? "Edited" : "Calculated"}
    </span>
  );
}

function ResetIcon({ onClick, label, testId }: { onClick: () => void; label: string; testId?: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} data-testid={testId} className="glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
      <RotateCcw className="icon-sm" aria-hidden />
    </button>
  );
}

/** A button that shows a spinner while working and a tick once done. */
function FetchButton({ onClick, loading, label, busyLabel, doneLabel, icon: Icon, testId }: { onClick: () => Promise<number | null>; loading: boolean; label: string; busyLabel: string; doneLabel: string; icon: LucideIcon; testId: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(false), 2_000);
    return () => window.clearTimeout(id);
  }, [done]);
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={loading}
      className="btn-animated btn-motion btn-accent btn-compact inline-flex shrink-0 items-center gap-2"
      onClick={async () => {
        if ((await onClick()) != null) setDone(true);
      }}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {done ? <Check className="icon-sm" data-testid={`${testId}-done`} aria-hidden /> : <Icon className={cn("icon-sm", loading && "animate-pulse")} aria-hidden />}
        {loading ? busyLabel : done ? doneLabel : label}
      </span>
    </button>
  );
}

/** A number field bound to one input key, guarded by its rule. */
function KeyNumber({ k, kind, digits, suffix, eg }: { k: keyof DeskInputs; kind?: "number" | "percent" | "integer"; digits?: number; suffix?: string; eg: string }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const guard = useGuard();
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
      {...guard(String(k))}
    />
  );
}

function Num({ k, label, hint, ...rest }: { k: keyof DeskInputs; label: string; hint?: string; kind?: "number" | "percent" | "integer"; digits?: number; suffix?: string; eg: string }) {
  const errorFor = useFieldError();
  return (
    <FieldRow label={label} error={errorFor(String(k))} hint={hint}>
      <KeyNumber k={k} {...rest} />
    </FieldRow>
  );
}

function withStrike(prev: DeskInputs, index: number, pct: number): Partial<DeskInputs> {
  const next = [...prev.strikePercents];
  next[index] = pct;
  return { strikePercents: next };
}

const HEDGE_RULE: Record<Underlying, string> = {
  Sensex: "Auto From Spot: Spot Times 1.006, Rounded Up To The Next 100",
  Nifty: "Auto From Spot: Spot Plus 150, Rounded Up To The Next 100",
};

// ------------------------------------------------------------------ 1 Underlying And Market

function UnderlyingGroup({ open }: { open: number }) {
  const { mode, inputs, setInputs, setUnderlying, levels, levelsLoading, refreshLevels, fetchLiveSpot } = useDesk();
  const errorFor = useFieldError();
  const guard = useGuard();
  const u = underlyingName(inputs);
  const start = Number.isFinite(inputs.spot) && Number.isFinite(inputs.startLevelUplift) ? startLevel(inputs) : NaN;
  const fetched = levels?.fetchedAt ? new Date(levels.fetchedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : null;
  return (
    <Group step={1} icon={LineChart} open={open}>
      <div className="inputs-grid">
        <FieldRow label="Underlying" error={errorFor("underlying")}>
          <ChoiceSelect<Underlying> value={inputs.underlying} testId="input-underlying" invalid={Boolean(errorFor("underlying"))} onChange={setUnderlying} options={UNDERLYINGS.map((x) => ({ value: x, label: x }))} />
        </FieldRow>
        <FieldRow label="Valuation Date" error={errorFor("valuationDate")} hint={mode === "default" ? "Today In India, Or The Last Close" : "Today Or An Earlier Date"}>
          <TextInput type="date" testId="input-valuationDate" invalid={Boolean(errorFor("valuationDate"))} value={inputs.valuationDate} onChange={(e) => setInputs({ valuationDate: e.target.value })} />
        </FieldRow>
        <FieldRow label={`${u} Spot`} error={errorFor("spot")} hint={`Start Level ${Number.isFinite(start) ? fmtNumber(start, 0) : "-"}${fetched && mode === "default" ? ` · Fetched At ${fetched} IST` : ""}`}>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <NumberInput
                value={inputs.spot}
                onChange={(v) => setInputs({ spot: v })}
                onBlankChange={() => setInputs({ spot: NaN })}
                digits={2}
                testId="input-spot"
                invalid={Boolean(errorFor("spot"))}
                placeholder={mode === "default" && levelsLoading ? "Fetching The Close" : "Eg 73,500"}
                {...guard("spot")}
              />
            </div>
            {mode === "blank" ? (
              <FetchButton testId="fetch-live-spot" icon={CloudDownload} label="Fetch" busyLabel="Fetching" doneLabel="Fetched" loading={levelsLoading} onClick={fetchLiveSpot} />
            ) : (
              <button
                type="button"
                className="glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                data-testid="refresh-yahoo"
                title="Refresh The Close From Yahoo"
                aria-label="Refresh The Close From Yahoo"
                onClick={async () => {
                  const lv = await refreshLevels();
                  const level = inputs.underlying ? lv?.[LEVEL_FIELD[inputs.underlying]] : undefined;
                  if (lv && level) setInputs({ spot: level, valuationDate: lv.valuationDate });
                }}
              >
                <RefreshCw className={levelsLoading ? "icon-sm animate-spin" : "icon-sm"} aria-hidden />
              </button>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Hedge Strike" error={errorFor("hedgeStrike")} hint={inputs.underlying ? HEDGE_RULE[inputs.underlying] : "Auto From Spot Once The Underlying Is Picked"}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <NumberInput
                value={inputs.hedgeStrike}
                onChange={(v) => setInputs({ hedgeStrike: v, hedgeStrikeAuto: false })}
                onBlankChange={() => setInputs({ hedgeStrike: NaN, hedgeStrikeAuto: false })}
                digits={0}
                grouped
                testId="input-hedgeStrike"
                invalid={Boolean(errorFor("hedgeStrike"))}
                placeholder="Eg 77,300"
                {...guard("hedgeStrike")}
              />
            </div>
            <Toggle
              label="Auto"
              checked={inputs.hedgeStrikeAuto}
              testId="input-hedgeStrikeAuto"
              onChange={(v) => setInputs({ hedgeStrikeAuto: v, hedgeStrike: v && inputs.underlying && Number.isFinite(inputs.spot) ? autoHedgeStrike(inputs.spot, inputs.underlying) : inputs.hedgeStrike })}
            />
          </div>
        </FieldRow>
      </div>
    </Group>
  );
}

// ------------------------------------------------------------------ 2 Observation Expiries

/** One expiry date. It commits on leaving the field: the date moves to its month's last expiry weekday, then the rules run. */
function ExpiryField({ i, hedge, onSnap }: { i: number; hedge: boolean; onSnap: (i: number, note: string | null) => void }) {
  const { inputs, setInputs } = useDesk();
  const { alert } = useDeskDialog();
  const errorFor = useFieldError();
  const value = inputs.expiryDates[i] ?? "";
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror outside changes, such as a paste or a new underlying
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft === value) return;
    if (!draft) {
      onSnap(i, null);
      setInputs((prev) => ({ expiryDates: Object.assign([...prev.expiryDates], { [i]: "" }) }));
      return;
    }
    const u = inputs.underlying;
    const snapped = u && isValidYmd(draft) ? snapExpiry(draft, u) : draft;
    const check = checkFieldEdit(inputs, `expiryDates.${i}`, snapped);
    if (check) {
      setDraft(value);
      alert(check.message, { variant: "error", title: `${check.label} Reverted`, fix: "The field is back to its last valid value.", onClose: () => focusField(`expiryDates.${i}`) });
      return;
    }
    onSnap(i, u && snapped !== draft ? `Moved To The Last ${WEEKDAY_NAMES[EXPIRY_WEEKDAY[u]]}, ${formatDate(snapped)}` : null);
    setDraft(snapped);
    setInputs((prev) => ({ expiryDates: Object.assign([...prev.expiryDates], { [i]: snapped }) }));
  };
  return (
    <TextInput
      type="date"
      testId={`input-expiryDates-${i}`}
      aria-label={`Expiry ${i + 1}${hedge ? " · Observation And Hedge Option Expiry" : ""}`}
      invalid={Boolean(errorFor(`expiryDates.${i}`))}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function ExpiriesGroup({ open }: { open: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const [notes, setNotes] = useState<Record<number, string | null>>({});
  const [bulk, setBulk] = useState(false);
  const count = Number.isInteger(inputs.expiryCount) ? inputs.expiryCount : 0;
  const hedgeIndex = inputs.hedgeExpiryIndex ?? medianExpiryIndex(count);
  const u = inputs.underlying;
  const first = inputs.expiryDates[0];

  const setCount = (next: number) =>
    setInputs((prev) => {
      const dates = resizeList(prev.expiryDates, next, "");
      // New rows continue quarterly from the last filled date.
      for (let i = 1; i < next; i++) {
        const before = dates[i - 1];
        if (!dates[i] && prev.underlying && before && isValidYmd(before)) dates[i] = quarterlyExpiries(before, 2, prev.underlying)[1]!;
      }
      return { expiryCount: next, expiryDates: dates, hedgeExpiryIndex: prev.hedgeExpiryIndex != null && prev.hedgeExpiryIndex < next ? prev.hedgeExpiryIndex : null };
    });

  const parse = useCallback((text: string) => parseExpiryPaste(text, { valuationDate: inputs.valuationDate, underlying: (u || "Sensex") as Underlying }), [inputs.valuationDate, u]);

  return (
    <Group
      step={2}
      icon={CalendarClock}
      open={open}
      aside={
        <div className="flex flex-wrap items-center justify-end gap-1">
          <span className="hs-chip" data-testid="expiry-weekday">
            {u ? `Last ${WEEKDAY_NAMES[EXPIRY_WEEKDAY[u]]} Of The Month` : "-"}
          </span>
          <button
            type="button"
            className="btn-animated btn-motion btn-ghost btn-compact"
            data-testid="expiries-quarterly"
            disabled={!u || !count || !isValidYmd(first)}
            title="Every Expiry Three Months After The One Before"
            onClick={() => u && first && setInputs({ expiryDates: quarterlyExpiries(first, count, u) })}
          >
            <span className="relative z-10">Quarterly From First Expiry</span>
          </button>
          <button type="button" className="btn-animated btn-motion btn-ghost btn-compact" data-testid="expiries-bulk" disabled={!u} onClick={() => setBulk(true)}>
            <span className="relative z-10 inline-flex items-center gap-1">
              <ClipboardPaste className="icon-xs" aria-hidden />
              Bulk Edit
            </span>
          </button>
        </div>
      }
    >
      <div className="inputs-grid">
        <FieldRow label="Number Of Expiry Dates" error={errorFor("expiryCount")}>
          <CountPicker label="Number Of Expiry Dates" value={inputs.expiryCount} min={MIN_EXPIRIES} max={MAX_EXPIRIES} onChange={setCount} testId="input-expiryCount" invalid={Boolean(errorFor("expiryCount"))} />
        </FieldRow>
        {Array.from({ length: count }, (_, i) => (
          <FieldRow
            key={i}
            label={`Expiry ${i + 1}`}
            error={errorFor(`expiryDates.${i}`)}
            hint={
              <span data-testid={`expiry-note-${i}`}>
                {notes[i] ?? (i === hedgeIndex ? "Observation And Hedge Option Expiry" : "Observation")}
              </span>
            }
          >
            <ExpiryField i={i} hedge={i === hedgeIndex} onSnap={(j, note) => setNotes((n) => ({ ...n, [j]: note }))} />
          </FieldRow>
        ))}
        {count ? (
          <FieldRow label="Hedge Option Expiry" hint="The Median Expiry Unless Picked">
            <select
              className="glass-select h-9 w-full rounded-xl px-3 font-ui text-body"
              value={inputs.hedgeExpiryIndex ?? "median"}
              data-testid="input-hedgeExpiryIndex"
              onChange={(e) => setInputs({ hedgeExpiryIndex: e.target.value === "median" ? null : Number(e.target.value) })}
            >
              <option value="median">Median · Expiry {medianExpiryIndex(count) + 1}</option>
              {Array.from({ length: count }, (_, i) => (
                <option key={i} value={i}>
                  Expiry {i + 1} · {formatDate(inputs.expiryDates[i])}
                </option>
              ))}
            </select>
          </FieldRow>
        ) : null}
      </div>
      <BulkEditDialog<string>
        open={bulk}
        title="Bulk Edit Expiries"
        hint={`Paste 1 to ${MAX_EXPIRIES} dates from a sheet, one per line or per cell. Each moves to the last expiry day of its month.`}
        placeholder={"25-Apr-2030\n25-Jul-2030\n31-Oct-2030"}
        initialText={inputs.expiryDates.slice(0, count).filter(Boolean).map(formatDate).join("\n")}
        columns={["Expiry"]}
        parse={parse}
        render={(d) => [formatDate(d)]}
        onApply={(dates) => {
          setNotes({});
          setInputs((prev) => ({ expiryCount: dates.length, expiryDates: dates, hedgeExpiryIndex: prev.hedgeExpiryIndex != null && prev.hedgeExpiryIndex < dates.length ? prev.hedgeExpiryIndex : null }));
        }}
        onClose={() => setBulk(false)}
        testId="bulk-expiries"
      />
    </Group>
  );
}

// ------------------------------------------------------------------ 3 Strikes And Spreads

const OPTION_TYPES: Array<{ value: OptionType; label: string }> = [
  { value: "P", label: "Put" },
  { value: "C", label: "Call" },
];
const SIDES: Array<{ value: StrikeSide; label: string }> = [
  { value: "B", label: "Buy" },
  { value: "S", label: "Sell" },
];

function setAt<T>(list: T[], i: number, v: T): T[] {
  const next = [...list];
  next[i] = v;
  return next;
}

function StrikesGroup({ open }: { open: number }) {
  const { mode, inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const guard = useGuard();
  const reduce = useReducedMotion();
  const [bulk, setBulk] = useState(false);
  const k = inputs.strikePercents;
  const terms = deriveTerms(inputs);
  const n = k.length ? terms.nSpreads : NaN;
  const start = Number.isFinite(inputs.spot) && Number.isFinite(inputs.startLevelUplift) ? startLevel(inputs) : NaN;
  const unitsReady = Number.isFinite(start) && [...k, inputs.coupon, inputs.decay, inputs.floorUnits].every(Number.isFinite) && inputs.participations.every((p) => p == null || Number.isFinite(p));
  const units = unitsReady ? strikeUnits(inputs, start) : [];
  const payouts = terms.spreads.map((s) => (s.sell - s.buy) * s.participation);
  const total = payouts.reduce((a, b) => a + b, 0);

  const applyPaste = (rows: PastedStrike[]) =>
    setInputs((prev) => {
      const count = rows.length - 4;
      const parts: Array<number | null> = prev.participations.slice(0, count - 1).map((p) => p ?? (mode === "blank" ? NaN : 1));
      while (parts.length < count - 1) parts.push(mode === "blank" ? NaN : 1);
      parts.push(null);
      const next = { strikePercents: rows.map((r) => r.percent), participations: parts, strikeOptionTypes: rows.map((r) => r.optionType) as Array<OptionType | "">, strikeSides: rows.map((r) => r.side) };
      if (rows.some((r) => !r.side) && mode === "default" && [prev.coupon, prev.decay, prev.floorUnits].every(Number.isFinite)) {
        next.strikeSides = derivedSides({ ...prev, ...next });
      }
      return next;
    });

  return (
    <Group
      step={3}
      icon={Layers}
      open={open}
      aside={
        <div className="flex flex-wrap items-center justify-end gap-1">
          <span className={cn("hs-chip", Number.isFinite(total) && Math.abs(total - inputs.coupon) > 1e-9 && "hs-chip-maroon")} data-testid="max-coupon">
            Maximum Upside {Number.isFinite(total) && k.length ? fmtPercent(total) : "-"}
          </span>
          <button type="button" className="btn-animated btn-motion btn-ghost btn-compact" data-testid="strikes-bulk" onClick={() => setBulk(true)}>
            <span className="relative z-10 inline-flex items-center gap-1">
              <ClipboardPaste className="icon-xs" aria-hidden />
              Bulk Edit
            </span>
          </button>
        </div>
      }
    >
      <div className="inputs-grid">
        <FieldRow label="Number Of Spreads" error={errorFor("spreadCount")}>
          <CountPicker
            label="Number Of Spreads"
            value={n}
            min={MIN_SPREADS}
            max={MAX_SPREADS}
            testId="input-spreadCount"
            invalid={Boolean(errorFor("spreadCount"))}
            onChange={(c) => setInputs((prev) => setSpreadCount(prev, c, mode))}
          />
        </FieldRow>
        <FieldRow label="Number Of Strikes" hint="Number Of Spreads Plus 4">
          <output className="inputs-readonly" data-testid="strike-count">
            {k.length || "-"}
          </output>
        </FieldRow>
      </div>
      {k.length ? (
        <div className="mt-2 flex flex-col gap-1" role="table" aria-label="Strikes">
          <div className="strike-row strike-head" role="row">
            {["Strike", "Level %", "Level In Points", "Option Type", "Buy Or Sell", "Units"].map((h) => (
              <span key={h} role="columnheader">
                {h}
              </span>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {k.map((pct, i) => {
              const error = errorFor(`strikePercents.${i}`) ?? errorFor(`strikeOptionTypes.${i}`) ?? errorFor(`strikeSides.${i}`);
              const level = Number.isFinite(start) && Number.isFinite(pct) ? rupeeStrike(start, pct) : NaN;
              return (
                <motion.div
                  key={i}
                  role="row"
                  data-testid={`strike-row-${i}`}
                  className={cn("strike-row", error && "strike-row--error")}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="font-ui text-body font-bold text-ink" role="cell">
                    Strike {i + 1}
                  </span>
                  <span role="cell">
                    <NumberInput
                      value={pct}
                      digits={2}
                      suffix="%"
                      ariaLabel={`Strike ${i + 1} Level %`}
                      testId={`input-strikePercents-${i}`}
                      invalid={Boolean(errorFor(`strikePercents.${i}`))}
                      placeholder={`Eg ${[137, 127, 125, 85, 84, 70][i] ?? 100}`}
                      onChange={(v) => setInputs((prev) => withStrike(prev, i, v))}
                      onBlankChange={() => setInputs((prev) => withStrike(prev, i, NaN))}
                      {...guard(`strikePercents.${i}`)}
                    />
                  </span>
                  <span role="cell">
                    <NumberInput
                      value={level}
                      digits={0}
                      grouped
                      disabled={!Number.isFinite(start)}
                      ariaLabel={`Strike ${i + 1} Level In Points`}
                      testId={`input-strikeLevel-${i}`}
                      placeholder="-"
                      onChange={(v) => setInputs((prev) => withStrike(prev, i, percentFromLevel(v, start)))}
                    />
                  </span>
                  <span role="cell">
                    <Segmented<OptionType>
                      label={`Strike ${i + 1} Option Type`}
                      value={inputs.strikeOptionTypes[i] ?? ""}
                      options={OPTION_TYPES}
                      testId={`input-strikeOptionTypes-${i}`}
                      invalid={Boolean(errorFor(`strikeOptionTypes.${i}`))}
                      onChange={(v) => setInputs((prev) => ({ strikeOptionTypes: setAt(prev.strikeOptionTypes, i, v) }))}
                    />
                  </span>
                  <span role="cell">
                    <Segmented<StrikeSide>
                      label={`Strike ${i + 1} Buy Or Sell`}
                      value={inputs.strikeSides[i] ?? ""}
                      options={SIDES}
                      testId={`input-strikeSides-${i}`}
                      invalid={Boolean(errorFor(`strikeSides.${i}`))}
                      onChange={(v) => setInputs((prev) => ({ strikeSides: setAt(prev.strikeSides, i, v) }))}
                    />
                  </span>
                  <output className="inputs-readonly tabular-nums" role="cell" aria-label={`Strike ${i + 1} Units`} data-testid={`strike-units-${i}`}>
                    {Number.isFinite(units[i]) ? fmtNumber(units[i]!, 3) : "-"}
                  </output>
                  {error ? (
                    <p className="hs-error strike-row-error" role="alert" data-testid={`strike-error-${i}`}>
                      {error}
                    </p>
                  ) : null}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div className="spread-row strike-head mt-2" role="row">
            {["Spread", "Buy Level", "Sell Level", "Participation Rate", "Pays"].map((h) => (
              <span key={h} role="columnheader">
                {h}
              </span>
            ))}
          </div>
          {terms.spreads.map((s, j) => {
            const isTop = j === terms.nSpreads - 1;
            const derived = terms.participationDerived[j];
            const error = errorFor(`spreads.${j}`) ?? errorFor(`participations.${j}`);
            return (
              <div key={j} role="row" className={cn("spread-row", error && "strike-row--error")} data-testid={`spread-card-${j}`}>
                <span className="font-ui text-body font-bold text-ink" role="cell">
                  Spread {j + 1}
                </span>
                <output className="inputs-readonly tabular-nums" role="cell" data-testid={`input-spreads-${j}-buy`}>
                  {Number.isFinite(s.buy) ? fmtPercent(s.buy) : "-"}
                </output>
                <output className="inputs-readonly tabular-nums" role="cell" tabIndex={-1} data-testid={`input-spreads-${j}-sell`}>
                  {Number.isFinite(s.sell) ? fmtPercent(s.sell) : "-"}
                </output>
                <span className="flex items-center gap-1" role="cell">
                  <span className="min-w-0 flex-1">
                    <NumberInput
                      value={s.participation}
                      digits={2}
                      fixed={derived}
                      ariaLabel={`Spread ${j + 1} Participation Rate`}
                      placeholder={isTop ? "Eg 10.05" : "Eg 1"}
                      invalid={Boolean(errorFor(`participations.${j}`))}
                      testId={`input-participations-${j}`}
                      onChange={(v) => setInputs((prev) => ({ participations: setAt(prev.participations, j, v) }))}
                      onBlankChange={() => setInputs((prev) => ({ participations: setAt(prev.participations, j, isTop ? null : NaN) }))}
                      {...guard(`participations.${j}`)}
                    />
                  </span>
                  {isTop ? <StatusTag edited={!derived} testId={`spread-${j}-participation-status`} /> : null}
                  {isTop && !derived ? <ResetIcon label="Reset To Calculated" testId={`spread-${j}-reset`} onClick={() => setInputs((prev) => ({ participations: setAt(prev.participations, j, null) }))} /> : null}
                </span>
                <output className="inputs-readonly tabular-nums" role="cell">
                  {Number.isFinite(payouts[j]) ? fmtPercent(payouts[j]!) : "-"}
                </output>
                {error ? <p className="hs-error strike-row-error">{error}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <BulkEditDialog<PastedStrike>
        open={bulk}
        title="Bulk Edit Strikes"
        hint={`Paste ${MIN_SPREADS + 4} to ${MAX_SPREADS + 4} rows from a sheet, highest first: Level %, then Put or Call, then Buy or Sell. Leave Buy Or Sell out to follow the payoff.`}
        placeholder={"137\tPut\tSell\n127\tPut\tBuy\n125\tPut\tBuy\n85\tPut\tSell\n84\tPut\tBuy\n70\tPut\tBuy"}
        initialText={k
          .map((p, i) => [Number.isFinite(p) ? p : "", inputs.strikeOptionTypes[i] === "C" ? "Call" : inputs.strikeOptionTypes[i] === "P" ? "Put" : "", inputs.strikeSides[i] === "B" ? "Buy" : inputs.strikeSides[i] === "S" ? "Sell" : ""].join("\t"))
          .join("\n")}
        columns={["Level %", "Option Type", "Buy Or Sell"]}
        parse={parseStrikePaste}
        render={(r) => [`${r.percent}%`, r.optionType === "C" ? "Call" : "Put", r.side === "B" ? "Buy" : r.side === "S" ? "Sell" : "Follows Payoff"]}
        onApply={applyPaste}
        onClose={() => setBulk(false)}
        testId="bulk-strikes"
      />
    </Group>
  );
}

// ------------------------------------------------------------------ 4 Rates

function RatesGroup({ open }: { open: number }) {
  return (
    <Group step={4} icon={Percent} open={open}>
      <div className="inputs-grid">
        <Num k="nbfcRate" label="NBFC Rate" kind="percent" suffix="%" eg="8" />
        <Num k="premiumRate" label="Premium Growth Rate" kind="percent" suffix="%" eg="6.5" />
        <Num k="marginGrowthRate" label="Margin Growth Rate" kind="percent" suffix="%" eg="6.58" />
      </div>
    </Group>
  );
}

// ------------------------------------------------------------------ 5 Product Terms

function TermsGroup({ open }: { open: number }) {
  const { inputs, setInputs } = useDesk();
  const errorFor = useFieldError();
  const terms = deriveTerms(inputs);
  const n = terms.nSpreads;
  const u = underlyingName(inputs);
  const has = inputs.strikePercents.length > 0;
  return (
    <Group step={5} icon={ScrollText} open={open}>
      <div className="inputs-grid">
        <FieldRow label={`Target ${u} Rise`} error={errorFor("strikePercents.0")}>
          <NumberInput
            kind="percent"
            value={has ? terms.target : NaN}
            disabled={!has}
            onChange={(v) => setInputs((prev) => withStrike(prev, 0, 100 * (1 + v)))}
            onBlankChange={() => setInputs((prev) => withStrike(prev, 0, NaN))}
            suffix="%"
            testId="input-target"
            placeholder="Eg 37 %"
          />
        </FieldRow>
        <Num k="coupon" label="Coupon" kind="percent" suffix="%" eg="102.5" />
        <FieldRow label="Protection" error={errorFor("protection")}>
          <NumberInput
            kind="percent"
            value={has ? terms.protection : NaN}
            disabled={!has}
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
        <Num k="decay" label="Decay" digits={2} eg="1.6" />
        <FieldRow label="Decay Floor Level" error={errorFor("floorLevel")}>
          <NumberInput
            kind="percent"
            digits={0}
            value={has ? terms.floorLevel : NaN}
            disabled={!has}
            onChange={(v) => setInputs((prev) => withStrike(prev, n + 3, 100 * v))}
            onBlankChange={() => setInputs((prev) => withStrike(prev, n + 3, NaN))}
            suffix="%"
            testId="input-floorLevel"
            invalid={Boolean(errorFor("floorLevel"))}
            placeholder="Eg 70 %"
          />
        </FieldRow>
        <Num k="floorUnits" label="Decay Reduction Below Floor" digits={2} eg="1" />
        <Num k="tenorDays" label="Tenor In Days" kind="integer" eg="1,940" />
        <Num k="startLevelUplift" label="Start Level Uplift" kind="percent" suffix="%" eg="0.6" />
        <Num k="notionalCr" label="Notional In Crore" digits={2} eg="100" />
      </div>
    </Group>
  );
}

// ------------------------------------------------------------------ 6 Volatility

function VolatilityGroup({ open }: { open: number }) {
  const { mode, inputs, setInputs, computeDailyVol, dailyVolStatus } = useDesk();
  const errorFor = useFieldError();
  const guard = useGuard();
  const u = underlyingName(inputs);
  const edited = inputs.dailyVolSource !== "calculated";
  const shown = Number.isFinite(inputs.dailyVol);
  return (
    <Group step={6} icon={Gauge} open={open}>
      <div className="inputs-grid">
        <FieldRow label={`${u} Daily Volatility`} error={errorFor("dailyVol")}>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <NumberInput
                kind="percent"
                digits={3}
                value={inputs.dailyVol}
                onChange={(v) => setInputs({ dailyVol: v, dailyVolSource: "overridden" })}
                onBlankChange={() => setInputs({ dailyVol: NaN, dailyVolSource: "overridden" })}
                suffix="%"
                testId="input-dailyVol"
                invalid={Boolean(errorFor("dailyVol"))}
                placeholder="Eg 0.88 %"
                {...guard("dailyVol")}
              />
            </div>
            {shown ? <StatusTag edited={edited} testId="daily-vol-status" /> : null}
          </div>
        </FieldRow>
        <FieldRow label={`${u} Annual Volatility`} hint="Daily Times The Square Root Of 365">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <NumberInput
                kind="percent"
                digits={3}
                value={annualVolFromDaily(inputs.dailyVol)}
                onChange={(v) => setInputs({ dailyVol: dailyVolFromAnnual(v), dailyVolSource: "overridden" })}
                onBlankChange={() => setInputs({ dailyVol: NaN, dailyVolSource: "overridden" })}
                suffix="%"
                testId="input-annualVol"
                placeholder="Eg 16.9 %"
              />
            </div>
            {shown ? <StatusTag edited={edited} testId="annual-vol-status" /> : null}
          </div>
        </FieldRow>
        <FieldRow
          label="History Window"
          wide
          hint={
            <span data-testid="vol-history-note">
              {dailyVolStatus.error
                ? dailyVolStatus.error
                : dailyVolStatus.from
                  ? `${dailyVolStatus.observations} Daily Returns From ${formatDate(dailyVolStatus.from)} To ${formatDate(dailyVolStatus.to)}`
                  : "-"}
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="glass-select h-9 min-w-[8rem] rounded-xl px-3 font-ui text-body"
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
            <FetchButton
              testId={mode === "blank" ? "compute-volatility" : "compute-history"}
              icon={RefreshCw}
              label="Compute From History"
              busyLabel="Computing"
              doneLabel="Computed"
              loading={dailyVolStatus.loading && (mode === "default" || inputs.underlying !== "")}
              onClick={() => computeDailyVol()}
            />
          </div>
        </FieldRow>
      </div>
    </Group>
  );
}

// ------------------------------------------------------------------ 7 Margin And Desk Terms

function DeskTermsGroup({ open }: { open: number }) {
  return (
    <Group step={7} icon={Coins} open={open}>
      <div className="inputs-grid">
        <Num k="transactionCost" label="Transaction Cost" kind="percent" suffix="%" eg="2.25" />
        <Num k="issuanceCost" label="Issuance Cost" kind="percent" suffix="%" eg="0.13" />
        <Num k="marginCost" label="Margin Cost" kind="percent" suffix="%" eg="0" />
        <Num k="exposureMargin" label="Exposure Margin" kind="percent" suffix="%" eg="5" />
        <Num k="futuresMargin" label="Futures Margin" kind="percent" suffix="%" eg="20" />
        <Num k="exchangeForwardRate" label="Exchange Forward Rate" kind="percent" suffix="%" eg="3.48" />
        <Num k="exchangeDiscountRate" label="Exchange Discount Rate" kind="percent" suffix="%" eg="3.48" />
        <Num k="stressedForwardRate" label="Stressed Forward Rate" kind="percent" suffix="%" eg="3.48" />
        <Num k="stressedDiscountRate" label="Stressed Discount Rate" kind="percent" suffix="%" eg="3.48" />
        <Num k="stressSigmas" label="Shock Sigmas" digits={0} eg="6" />
        <Num k="stressDays" label="Shock Days" kind="integer" eg="2" />
        <Num k="stressVolMultiplier" label="Volatility Multiplier" digits={2} eg="1.25" />
      </div>
    </Group>
  );
}

// ------------------------------------------------------------------ the page body

/** The seven numbered groups in fill order. A group opens once every field of the steps it depends on is filled. */
export function InputGroups() {
  const { fieldErrors } = useDesk();
  const open = unlockedSteps(fieldErrors);
  return (
    <div className="inputs-layout">
      <UnderlyingGroup open={open} />
      <ExpiriesGroup open={open} />
      <StrikesGroup open={open} />
      <RatesGroup open={open} />
      <TermsGroup open={open} />
      <VolatilityGroup open={open} />
      <DeskTermsGroup open={open} />
    </div>
  );
}
