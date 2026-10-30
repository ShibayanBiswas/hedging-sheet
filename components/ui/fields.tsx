"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import { MAX_DECIMALS } from "@/lib/format";

export type FieldCheck = { label: string; message: string; range?: string };

/** FieldRow shares its id with the input inside, so the label names the input. */
const FieldIdContext = createContext<string | undefined>(undefined);

const PLACEHOLDER = "placeholder:text-stone-400 placeholder:font-normal";

export function FieldRow({
  label,
  children,
  hint,
  error,
  htmlFor,
  wide,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  /** Span the whole row of the grid. */
  wide?: boolean;
}) {
  const labelId = useId();
  const inputId = useId();
  const forId = htmlFor ?? inputId;
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1", wide && "field-wide")}>
      <label className="field-label truncate font-ui" htmlFor={forId} id={labelId} title={typeof label === "string" ? label : undefined}>
        {label}
      </label>
      <div className="min-w-0" role="group" aria-labelledby={labelId}>
        <FieldIdContext.Provider value={forId}>{children}</FieldIdContext.Provider>
        {hint ? <p className="hint mt-1 font-ui">{hint}</p> : null}
        <AnimatePresence initial={false}>
          {error ? (
            <motion.p
              key={error}
              className="hs-error mt-1"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

type NumberKind = "number" | "percent" | "integer";

function toDraft(value: number, kind: NumberKind, digits: number, grouped = false, fixed = false): string {
  if (!Number.isFinite(value)) return "";
  const shown = kind === "percent" ? value * 100 : value;
  if (kind === "integer") return String(Math.round(shown));
  const most = Math.min(MAX_DECIMALS, fixed ? digits : Math.max(digits, MAX_DECIMALS));
  return shown.toLocaleString("en-IN", { minimumFractionDigits: Math.min(digits, most), maximumFractionDigits: most, useGrouping: grouped });
}

function parseDraft(text: string, kind: NumberKind): number | null {
  const cleaned = text.replace(/[₹,%\s]/g, "");
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
  digits = 2,
  suffix,
  disabled,
  testId,
  id,
  placeholder,
  invalid,
  onBlankChange,
  ariaLabel,
  grouped = false,
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
  /** Show the value with Indian digit grouping, such as 1,05,901. */
  grouped?: boolean;
  /** Round the shown value to `digits`, for derived values; typed values otherwise show in full. */
  fixed?: boolean;
}) {
  const contextId = useContext(FieldIdContext);
  const [draft, setDraft] = useState(() => toDraft(value, kind, digits, grouped, fixed));
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);
  const [rejected, setRejected] = useState<FieldCheck | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror outside changes while the field is idle
    if (!focused) setDraft(toDraft(value, kind, digits, grouped, fixed));
  }, [value, kind, digits, grouped, fixed, focused]);

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
          if (rejected) {
            setRejected(null);
            setBad(false);
            setDraft(toDraft(value, kind, digits, grouped, fixed));
            onReject?.(rejected);
            return;
          }
          if (!bad && draft.trim()) setDraft(toDraft(value, kind, digits, grouped, fixed));
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
          "input-glow h-9 w-full rounded-xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-3 font-ui text-body tabular-nums outline-none transition focus:border-gold",
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

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { testId?: string; invalid?: boolean }) {
  const { testId, className, invalid, id, ...rest } = props;
  const contextId = useContext(FieldIdContext);
  return (
    <input
      {...rest}
      id={id ?? contextId}
      data-testid={testId}
      aria-invalid={invalid || undefined}
      className={cn(
        "input-glow h-9 w-full rounded-xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-3 font-ui text-body outline-none transition focus:border-gold",
        PLACEHOLDER,
        invalid && "border-rose-500 ring-2 ring-rose-400/60",
        className,
      )}
    />
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
              <motion.span
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
