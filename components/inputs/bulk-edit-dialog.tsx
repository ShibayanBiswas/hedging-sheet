"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ClipboardPaste } from "lucide-react";

import type { BulkResult } from "@/lib/inputs/bulk";
import { cn } from "@/lib/cn";

/** Paste a block from a sheet, check every row live, and apply only when all rows pass. */
export function BulkEditDialog<T>({
  open,
  title,
  hint,
  placeholder,
  initialText,
  columns,
  parse,
  render,
  onApply,
  onClose,
  testId,
}: {
  open: boolean;
  title: string;
  hint: string;
  placeholder: string;
  initialText: string;
  columns: string[];
  parse: (text: string) => BulkResult<T>;
  /** The preview cells of a parsed row. */
  render: (value: T) => ReactNode[];
  onApply: (values: T[]) => void;
  onClose: () => void;
  testId: string;
}) {
  const reduce = useReducedMotion();
  const [text, setText] = useState(initialText);
  const area = useRef<HTMLTextAreaElement>(null);
  const result = useMemo(() => parse(text), [parse, text]);
  // The latest props, so opening reads them without re-running on every parent render and wiping a paste.
  const latest = useRef({ initialText, onClose });
  useEffect(() => {
    latest.current = { initialText, onClose };
  });

  useEffect(() => {
    if (!open) return;
    setText(latest.current.initialText);
    window.setTimeout(() => area.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && latest.current.onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Opened only by a click after hydration. On the page body: a group card's backdrop filter would trap a fixed overlay.
  if (!open) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[190] flex items-end justify-center sm:items-center sm:p-4" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
          <button type="button" aria-label="Close Bulk Edit" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
          <div role="dialog" aria-modal="true" aria-labelledby={`${testId}-title`} data-testid={testId} className="desk-sheet glass relative z-10 flex w-full flex-col overflow-hidden border border-gold/30 sm:max-w-2xl">
            <div className="h-1 bg-gradient-to-r from-maroon via-gold to-maroon/70" />
            <div className="flex items-center gap-2 border-b border-gold/15 px-4 py-3">
              <ClipboardPaste className="icon-md text-gold" aria-hidden />
              <h2 id={`${testId}-title`} className="font-ui text-h3 font-bold text-ink">
                {title}
              </h2>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <p className="hint font-ui">{hint}</p>
              <textarea
                ref={area}
                aria-label={title}
                data-testid={`${testId}-text`}
                className="input-glow h-32 w-full rounded-xl border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-3 py-2 font-mono text-caption outline-none focus:border-gold"
                placeholder={placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {result.error ? (
                <p className="hs-error" role="alert" data-testid={`${testId}-error`}>
                  {result.error}
                </p>
              ) : null}
              {result.rows.length ? (
                <table className="w-full font-ui text-caption" data-testid={`${testId}-preview`}>
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 pr-2 font-semibold">Row</th>
                      <th className="py-1 pr-2 font-semibold">Pasted</th>
                      {columns.map((c) => (
                        <th key={c} className="py-1 pr-2 font-semibold">
                          {c}
                        </th>
                      ))}
                      <th className="py-1 font-semibold">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className={cn("border-t border-[color:var(--ar-border)]", row.error && "text-rose-800")} data-testid={`${testId}-row-${i}`}>
                        <td className="py-1 pr-2 tabular-nums">{i + 1}</td>
                        <td className="whitespace-nowrap py-1 pr-2">{row.raw}</td>
                        {columns.map((c, j) => (
                          <td key={c} className="whitespace-nowrap py-1 pr-2 tabular-nums">
                            {row.value != null ? (render(row.value)[j] ?? "-") : "-"}
                          </td>
                        ))}
                        <td className="whitespace-nowrap py-1">{row.error ?? row.note ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
            <div className="sheet-actions flex justify-end gap-2 border-t border-[color:var(--ar-border)] bg-[color:var(--ar-panel)] px-4 py-3">
              <button type="button" className="btn-animated btn-motion btn-ghost" onClick={onClose} data-testid={`${testId}-cancel`}>
                <span className="relative z-10">Cancel</span>
              </button>
              <button
                type="button"
                className="btn-animated btn-motion btn-primary"
                disabled={!result.ok}
                data-testid={`${testId}-apply`}
                onClick={() => {
                  onApply(result.rows.map((r) => r.value as T));
                  onClose();
                }}
              >
                <span className="relative z-10">Apply</span>
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
