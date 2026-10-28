"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";
import { blank, croreText, dateText, numberText, percentText, type Display } from "@/lib/format";
import { deskEase } from "@/lib/motion";
import type { CellKind, CellValue, GridSpec, KeyValueSpec, TableSpec } from "@/lib/tables";

export function displayCell(value: CellValue, kind: CellKind, digits?: number): Display {
  if (value == null || value === "") return blank();
  switch (kind) {
    case "date":
      return dateText(String(value));
    case "text":
      return { text: String(value) };
    case "percent":
      return percentText(value, digits ?? 2);
    case "crore":
    case "rupee":
      return croreText(value, digits ?? 2);
    case "integer":
      return numberText(value, 0);
    case "greek":
      return numberText(value, digits ?? 8);
    default:
      return numberText(value, digits ?? 2);
  }
}

/** Primary dynamic-table frame: maroon band, horizontal scroll, animated reveal, full width. */
function TableFrame({ children, testId, note, book }: { children: ReactNode; testId: string; note?: string; book?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="w-full min-w-0"
      data-testid={testId}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, ease: deskEase }}
    >
      <div className="overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-maroon via-gold to-maroon/70" aria-hidden />
        <div className={cn("desk-table-scroll horizontal-rail !rounded-t-none", book && "desk-table-scroll--book")}>{children}</div>
      </div>
      {note ? <p className="mt-2 font-ui text-xs italic text-muted">{note}</p> : null}
    </motion.div>
  );
}

function Cell({ value, kind, digits, pinned }: { value: CellValue; kind: CellKind; digits?: number; pinned?: boolean }) {
  const d = displayCell(value, kind, digits);
  return (
    <td className={cn(kind !== "text" && "text-right", pinned && "col-pinned font-semibold")} title={d.title}>
      {d.text}
    </td>
  );
}

function groupRuns(groups: Array<string | undefined>): Array<{ label: string; span: number }> {
  const runs: Array<{ label: string; span: number }> = [];
  for (const g of groups) {
    const label = g ?? "";
    const last = runs[runs.length - 1];
    if (last && last.label === label) last.span += 1;
    else runs.push({ label, span: 1 });
  }
  return runs;
}

export function TableCard({ spec, pinFirst = true, testId }: { spec: TableSpec; pinFirst?: boolean; testId?: string }) {
  const hasGroups = spec.columns.some((c) => c.group);
  return (
    <TableFrame testId={testId ?? `table-${spec.id}`} note={spec.note}>
      <table className={cn("data-table-premium data-table-fill", hasGroups && "hs-has-groups")}>
        <thead>
          {hasGroups ? (
            <tr className="hs-group-row">
              {groupRuns(spec.columns.map((c) => c.group)).map((g, i) => (
                <th key={i} colSpan={g.span} className={cn(i === 0 && pinFirst && !g.label && "col-pinned")}>
                  {g.label}
                </th>
              ))}
            </tr>
          ) : null}
          <tr className="hs-head-row">
            {spec.columns.map((c, i) => (
              <th key={c.key} className={cn(c.kind !== "text" && "text-right", i === 0 && pinFirst && "col-pinned")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, r) => (
            <tr
              key={r}
              className={cn(r % 2 === 1 && "data-table-row-alt", spec.highlightRow === r && "hs-row-highlight", spec.totalRow === r && "hs-row-total")}
            >
              {spec.columns.map((c, i) => (
                <Cell key={c.key} value={row[c.key] ?? null} kind={c.kind} digits={c.digits} pinned={i === 0 && pinFirst} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

export function KeyValueCard({ spec }: { spec: KeyValueSpec }) {
  return (
    <TableFrame testId={`table-${spec.id}`} note={spec.note}>
      <table className="data-table-premium data-table-fill">
        <thead>
          <tr>
            <th className="col-pinned">Item</th>
            <th className="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {spec.items.map((item, r) => {
            const d = displayCell(item.value, item.kind, item.digits);
            return (
              <tr key={item.label} className={cn(r % 2 === 1 && "data-table-row-alt")}>
                <td className="col-pinned font-semibold">{item.label}</td>
                <td className="text-right" title={d.title}>
                  {d.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}

export type GridEdit = {
  /** Row label that becomes editable, such as Volatility. */
  rowLabel: string;
  /** Column key, then the new value as a decimal, or null to clear the override. */
  onChange: (columnKey: string, value: number | null) => void;
};

export function GridCard({ spec, edit }: { spec: GridSpec; edit?: GridEdit }) {
  return (
    <TableFrame testId={`table-${spec.id}`} note={spec.note} book>
      <table className="data-table-premium hs-has-groups">
        <thead>
          <tr className="hs-group-row">
            <th className="col-pinned">Strike Block</th>
            {spec.groups.map((g) => (
              <th key={g.label} colSpan={g.span}>
                {g.label}
              </th>
            ))}
          </tr>
          <tr className="hs-head-row">
            <th className="col-pinned">Field</th>
            {spec.columnLabels.map((label, i) => (
              <th key={i} className="text-right">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, r) => {
            const editable = edit && row.label === edit.rowLabel && spec.columnKeys;
            return (
              <tr key={row.label} className={cn(r % 2 === 1 && "data-table-row-alt")}>
                <td className="col-pinned font-semibold">{row.label}</td>
                {row.values.map((v, i) => {
                  const overridden = row.overridden?.[i] ?? false;
                  if (!editable) {
                    const d = displayCell(v, row.kind, row.digits);
                    return (
                      <td key={i} className={cn("text-right", overridden && "hs-overridden-cell")} title={overridden ? "Overridden" : d.title}>
                        {d.text}
                      </td>
                    );
                  }
                  const key = spec.columnKeys![i]!;
                  return (
                    <td key={i} className={cn("p-1 text-right", overridden && "hs-overridden-cell")}>
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          className="w-20 rounded-lg border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-2 py-1 text-right font-ui text-xs tabular-nums outline-none focus:border-gold"
                          inputMode="decimal"
                          aria-label={`${row.label} for ${spec.columnLabels[i]} column ${i + 1}`}
                          defaultValue={typeof v === "number" ? (v * 100).toFixed(2) : ""}
                          data-testid={`grid-edit-${key}`}
                          onBlur={(e) => {
                            const text = e.target.value.replace(/[%\s]/g, "");
                            const n = Number(text);
                            if (text && Number.isFinite(n) && n > 0) edit.onChange(key, n / 100);
                          }}
                        />
                        {overridden ? (
                          <button type="button" className="hs-overridden-badge" onClick={() => edit.onChange(key, null)} title="Reset to the surface">
                            Overridden ×
                          </button>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}
