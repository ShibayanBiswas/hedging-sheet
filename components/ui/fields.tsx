"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/cn";

/** FieldRow shares its id with the input inside, so the label names the input. */
const FieldIdContext = createContext<string | undefined>(undefined);

const PLACEHOLDER = "placeholder:text-stone-400 placeholder:font-normal dark:placeholder:text-stone-500";

export function FieldRow({
  label,
  children,
  hint,
  error,
  htmlFor,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
}) {
  const labelId = useId();
  const inputId = useId();
  const forId = htmlFor ?? inputId;
  return (
    <div className="grid w-full gap-2 md:grid-cols-[240px_1fr]">
      <div className="flex items-start pt-3">
        <label className="label-chip" htmlFor={forId} id={labelId}>
          {label}
        </label>
      </div>
      <div className="min-w-0" role="group" aria-labelledby={labelId}>
        <FieldIdContext.Provider value={forId}>{children}</FieldIdContext.Provider>
        {hint ? <p className="mt-1 font-ui text-[11px] text-muted">{hint}</p> : null}
        <AnimatePresence initial={false}>
          {error ? (
            <motion.p
              key={error}
              className="hs-error mt-1.5"
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

function toDraft(value: number, kind: NumberKind, digits: number): string {
  if (!Number.isFinite(value)) return "";
  const shown = kind === "percent" ? value * 100 : value;
  if (kind === "integer") return String(Math.round(shown));
  return shown.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 8), useGrouping: false });
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
}: {
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
}) {
  const contextId = useContext(FieldIdContext);
  const [draft, setDraft] = useState(() => toDraft(value, kind, digits));
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror outside changes while the field is idle
    if (!focused) setDraft(toDraft(value, kind, digits));
  }, [value, kind, digits, focused]);

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
        aria-invalid={bad || invalid || undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (!bad && draft.trim()) setDraft(toDraft(value, kind, digits));
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          if (!text.trim()) {
            setBad(false);
            onBlankChange?.();
            return;
          }
          const parsed = parseDraft(text, kind);
          setBad(parsed == null);
          if (parsed != null) onChange(parsed);
        }}
        className={cn(
          "input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm tabular-nums outline-none transition focus:border-gold",
          PLACEHOLDER,
          suffix && "pr-16",
          (bad || invalid) && "border-rose-500 ring-2 ring-rose-400/60 focus:border-rose-500",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-ui text-xs font-bold tracking-wide text-gold-dark">
          {suffix}
        </span>
      ) : null}
      {bad ? (
        <p className="hs-error mt-1.5" role="alert">
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
        "input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none transition focus:border-gold",
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
}: {
  value: T | "";
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  testId?: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  const contextId = useContext(FieldIdContext);
  return (
    <select
      id={contextId}
      data-testid={testId}
      aria-invalid={invalid || undefined}
      value={value === "" || (typeof value === "number" && Number.isNaN(value)) ? "" : String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
      className={cn(
        "input-glow w-full rounded-2xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-4 py-3 font-ui text-sm outline-none transition focus:border-gold",
        value === "" && "text-stone-500",
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
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  testId?: string;
  label: string;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className="hs-segment" role="radiogroup" aria-label={label} data-testid={testId}>
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
            className={cn(active ? "text-maroon dark:text-gold-light" : "text-muted hover:text-ink")}
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

export function Stepper({
  value,
  onChange,
  min,
  max,
  testId,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  testId?: string;
  label: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="btn-ghost btn-animated inline-flex h-11 w-11 items-center justify-center"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        data-testid={testId ? `${testId}-minus` : undefined}
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="w-28">
        <NumberInput value={value} kind="integer" ariaLabel={label} onChange={(v) => onChange(clamp(v))} testId={testId ? `${testId}-input` : undefined} />
      </div>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="btn-ghost btn-animated inline-flex h-11 w-11 items-center justify-center"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        data-testid={testId ? `${testId}-plus` : undefined}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-ui text-xs font-semibold text-muted">
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
