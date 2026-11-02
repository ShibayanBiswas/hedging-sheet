"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Calendar, Info, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import { deskFade } from "@/lib/motion";
import { formatDate, isValidYmd } from "@/lib/engine/dates";
import { MAX_DECIMALS, NUMBER_LOCALE, ungroup } from "@/lib/format";
import { parsePastedDate } from "@/lib/inputs/bulk";

export type FieldCheck = { label: string; message: string; range?: string };

/** FieldRow shares its id with the input inside, so the label names the input. */
const FieldIdContext = createContext<string | undefined>(undefined);

const PLACEHOLDER = "placeholder:text-stone-400 placeholder:font-normal";

/** Helper text behind an icon: it opens on hover, on keyboard focus and on a tap, across the width of its field. */
function FieldTip({ text }: { text: string }) {
  return (
    <span className="field-tip" role="img" aria-label={text} tabIndex={0}>
      <Info className="icon-xs" aria-hidden />
      <span className="field-tip-text">{text}</span>
    </span>
  );
}

export function FieldRow({
  label,
  children,
  hint,
  tip,
  error,
  htmlFor,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  /** Helper text kept behind an icon before the label, so the field stays one compact unit and the tab order reads left to right. */
  tip?: string;
  error?: string | null;
  htmlFor?: string;
}) {
  const labelId = useId();
  const inputId = useId();
  const forId = htmlFor ?? inputId;
  return (
    <div className="relative flex w-full min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        {tip ? <FieldTip text={tip} /> : null}
        <label className="field-label min-w-0 truncate font-ui" htmlFor={forId} id={labelId} title={typeof label === "string" ? label : undefined}>
          {label}
        </label>
      </div>
      <div className="min-w-0" role="group" aria-labelledby={labelId}>
        <FieldIdContext.Provider value={forId}>{children}</FieldIdContext.Provider>
        {hint ? <p className="hint mt-1 font-ui">{hint}</p> : null}
        <AnimatePresence initial={false}>
          {error ? (
            <m.p
              key={error}
              className="hs-error mt-1"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={deskFade}
            >
              {error}
            </m.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

type NumberKind = "number" | "percent" | "integer";

function toDraft(value: number, kind: NumberKind, digits: number, fixed = false): string {
  if (!Number.isFinite(value)) return "";
  const shown = kind === "percent" ? value * 100 : value;
  if (kind === "integer") return Math.round(shown).toLocaleString(NUMBER_LOCALE);
  const most = Math.min(MAX_DECIMALS, fixed ? digits : Math.max(digits, MAX_DECIMALS));
  return shown.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: Math.min(digits, most), maximumFractionDigits: most });
}

function parseDraft(text: string, kind: NumberKind): number | null {
  const cleaned = ungroup(text.replace(/[₹%\s]/g, ""));
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  if (!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (kind === "integer" && !Number.isInteger(n)) return null;
  return kind === "percent" ? n / 100 : n;
}

export function NumberInput({
  value,
  onChange,
  kind = "number",
  digits: digitsProp,
  suffix,
  disabled,
  testId,
  id,
  placeholder,
  invalid,
  onBlankChange,
  ariaLabel,
  fixed = false,
  check,
  onReject,
}: {
  /** The rule check of a typed value: a result keeps the value out of the inputs, and on leaving the field it reverts. */
  check?: (v: number) => FieldCheck | null;
  /** Told why a typed value was reverted, to open the popup. */
  onReject?: (result: FieldCheck) => void;
  value: number;
  onChange: (v: number) => void;
  kind?: NumberKind;
  digits?: number;
  suffix?: string;
  disabled?: boolean;
  testId?: string;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  onBlankChange?: () => void;
  ariaLabel?: string;
  /** Round the shown value to `digits`, for derived values; typed values otherwise show in full. */
  fixed?: boolean;
}) {
  const contextId = useContext(FieldIdContext);
  /** Percent fields read as 8.000 %. */
  const digits = digitsProp ?? (kind === "percent" ? 3 : 2);
  const [draft, setDraft] = useState(() => toDraft(value, kind, digits, fixed));
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);
  const [rejected, setRejected] = useState<FieldCheck | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror outside changes while the field is idle
    if (!focused) setDraft(toDraft(value, kind, digits, fixed));
  }, [value, kind, digits, fixed, focused]);

  return (
    <div className="relative w-full">
      <input
        id={id ?? (ariaLabel ? undefined : contextId)}
        aria-label={ariaLabel}
        data-testid={testId}
        data-value={Number.isFinite(value) ? value : undefined}
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        aria-invalid={bad || invalid || rejected != null || undefined}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={() => {
          setFocused(false);
          // A guarded field never keeps a value it cannot use: it goes back to the last valid one and says why.
          const reason = rejected ?? (bad && onReject ? { label: "", message: kind === "integer" ? "Enter a whole number." : "Enter a number." } : null);
          if (reason) {
            setRejected(null);
            setBad(false);
            setDraft(toDraft(value, kind, digits, fixed));
            onReject?.(reason);
            return;
          }
          if (!bad && draft.trim()) setDraft(toDraft(value, kind, digits, fixed));
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          if (!text.trim()) {
            setBad(false);
            setRejected(null);
            onBlankChange?.();
            return;
          }
          const parsed = parseDraft(text, kind);
          setBad(parsed == null);
          if (parsed == null) return;
          const result = check?.(parsed) ?? null;
          setRejected(result);
          if (!result) onChange(parsed);
        }}
        className={cn(
          "input-glow h-9 w-full rounded-xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-3 font-ui text-body tabular-nums outline-none focus:border-gold",
          PLACEHOLDER,
          suffix && "pr-12",
          (bad || invalid || rejected) && "border-rose-500 ring-2 ring-rose-400/60 focus:border-rose-500",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-ui text-caption font-bold tracking-wide text-gold-dark">
          {suffix}
        </span>
      ) : null}
      {bad ? (
        <p className="hs-error mt-1" role="alert">
          {kind === "integer" ? "Enter a whole number." : "Enter a number."}
        </p>
      ) : null}
    </div>
  );
}

const dateText = (ymd: string) => (isValidYmd(ymd) ? formatDate(ymd) : ymd);

/**
 * A date that reads 31-Oct-2026 at rest. Type it in that form, as 2026-10-31 or as 31-10-2026, or pick it from the calendar.
 * It commits on leaving the field; text that is not a date goes back to the last value and onUnreadable says why.
 */
export function DateInput({
  value,
  onCommit,
  onUnreadable,
  label,
  testId,
  invalid,
  ariaLabel,
}: {
  /** yyyy-mm-dd, or "" while empty. */
  value: string;
  onCommit: (ymd: string) => void;
  onUnreadable?: () => void;
  /** Names the calendar button. */
  label: string;
  testId?: string;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const contextId = useContext(FieldIdContext);
  const picker = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => dateText(value));
  const [focused, setFocused] = useState(false);
  /** Typed in since the field took focus: an untouched draft may be older than the value, so it never commits. */
  const dirty = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror outside changes while the field is idle, and put a refused entry back
    if (!focused) setDraft(dateText(value));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    if (!dirty.current) return;
    dirty.current = false;
    const text = draft.trim();
    if (!text) {
      if (value) onCommit("");
      return;
    }
    if (text === dateText(value)) return;
    const ymd = parsePastedDate(text);
    if (!ymd) {
      onUnreadable?.();
      return;
    }
    if (ymd !== value) onCommit(ymd);
  };

  return (
    <div className="relative flex w-full items-center gap-1">
      <input
        type="text"
        id={ariaLabel ? undefined : contextId}
        aria-label={ariaLabel}
        data-testid={testId}
        data-value={value || undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Eg 31-Oct-2026"
        value={draft}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(
          "input-glow h-9 w-full min-w-0 rounded-xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-3 font-ui text-body tabular-nums outline-none focus:border-gold",
          PLACEHOLDER,
          invalid && "border-rose-500 ring-2 ring-rose-400/60",
        )}
      />
      <button
        type="button"
        aria-label={`Open Calendar For ${label}`}
        title={`Open Calendar For ${label}`}
        className="glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        onClick={() => {
          try {
            picker.current?.showPicker();
          } catch {
            picker.current?.focus();
          }
        }}
      >
        <Calendar className="icon-sm" aria-hidden />
      </button>
      {/* Only the calendar popup comes from this control: it never shows its own date format. */}
      <input ref={picker} type="date" className="date-picker-native" tabIndex={-1} aria-hidden="true" value={isValidYmd(value) ? value : ""} onChange={(e) => onCommit(e.target.value)} />
    </div>
  );
}

/** A select that starts on an empty "Select …" option until a choice is made. */
export function ChoiceSelect<T extends string | number>({
  value,
  options,
  onChange,
  testId,
  invalid,
  placeholder = "Select …",
  ariaLabel,
}: {
  value: T | "";
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  testId?: string;
  invalid?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const contextId = useContext(FieldIdContext);
  return (
    <select
      id={ariaLabel ? undefined : contextId}
      aria-label={ariaLabel}
      data-testid={testId}
      aria-invalid={invalid || undefined}
      value={value === "" || (typeof value === "number" && Number.isNaN(value)) ? "" : String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
      className={cn(
        "glass-select h-9 w-full rounded-xl px-3 font-ui text-body",
        value === "" && "glass-select--empty",
        invalid && "border-rose-500 ring-2 ring-rose-400/60",
      )}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testId,
  label,
  invalid,
}: {
  options: Array<{ value: T; label: string }>;
  /** "" while nothing is chosen. */
  value: T | "";
  onChange: (v: T) => void;
  testId?: string;
  label: string;
  invalid?: boolean;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className={cn("hs-segment", invalid && "hs-segment--invalid")} role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} data-testid={testId} data-value={value}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
            onClick={() => onChange(o.value)}
            className={cn(active ? "text-maroon" : "text-muted hover:text-ink")}
          >
            {active ? (
              <m.span
                className="hs-segment-glow"
                layoutId={reduce ? undefined : `segment-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
              />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A count as a dropdown with a stepper either side. Empty shows "Select …"; the plus button then picks the least. */
export function CountPicker({
  value,
  onChange,
  min,
  max,
  testId,
  label,
  invalid,
}: {
  /** NaN while no count is picked. */
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  testId: string;
  label: string;
  invalid?: boolean;
}) {
  const picked = Number.isInteger(value);
  const step = "glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex w-full items-center gap-1">
      <button type="button" aria-label={`Decrease ${label}`} className={step} onClick={() => onChange(value - 1)} disabled={!picked || value <= min} data-testid={`${testId}-minus`}>
        <Minus className="icon-sm" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <ChoiceSelect<number>
          value={picked ? value : ""}
          testId={testId}
          invalid={invalid}
          onChange={onChange}
          options={Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: String(min + i) }))}
        />
      </div>
      <button type="button" aria-label={`Increase ${label}`} className={step} onClick={() => onChange(picked ? value + 1 : min)} disabled={picked && value >= max} data-testid={`${testId}-plus`}>
        <Plus className="icon-sm" aria-hidden />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-ui text-caption font-semibold text-muted">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[#b8860b]"
        checked={checked}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
