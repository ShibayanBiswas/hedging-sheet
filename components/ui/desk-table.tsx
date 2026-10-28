"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";
import { deskEase } from "@/lib/motion";
import { cellKey, displayCell, gridColumnLabel, tableRowLabel, type CellKind, type CellValue, type GridSpec, type KeyValueSpec, type TableSpec } from "@/lib/tables";

export { displayCell };

/** Raw number behind a cell, for tests that compare values beyond the shown digits. */
function rawValue(value: CellValue): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Primary dynamic-table frame: maroon band, horizontal scroll, animated reveal, full width. */
function TableFrame({ children, testId, title, note, book }: { children: ReactNode; testId: string; title: string; note?: string; book?: boolean }) {
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
        <div className={cn("desk-table-scroll horizontal-rail !rounded-t-none", book && "desk-table-scroll--book")} tabIndex={0} role="region" aria-label={title}>
          {children}
        </div>
      </div>
      {note ? <p className="mt-2 font-ui text-xs italic text-muted">{note}</p> : null}
    </motion.div>
  );
}

function Cell({ value, kind, digits, pinned, cell }: { value: CellValue; kind: CellKind; digits?: number; pinned?: boolean; cell: string }) {
  const d = displayCell(value, kind, digits);
  return (
    <td className={cn(kind !== "text" && "text-right", pinned && "col-pinned font-semibold")} title={d.title} data-cell={cell} data-value={rawValue(value)}>
      {d.text}
    </td>
  );
}

export function TableCard({ spec, pinFirst = true, testId }: { spec: TableSpec; pinFirst?: boolean; testId?: string }) {
  return (
    <TableFrame testId={testId ?? `table-${spec.id}`} title={spec.title} note={spec.note}>
      <table className="data-table-premium data-table-fill">
        <thead>
          <tr className="hs-head-row">
            {spec.columns.map((c, i) => (
              <th key={c.key} className={cn(c.kind !== "text" && "text-right", i === 0 && pinFirst && "col-pinned")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, r) => {
            const label = tableRowLabel(spec, row);
            return (
              <tr
                key={r}
                data-row={label}
                className={cn(r % 2 === 1 && "data-table-row-alt", spec.highlightRow === r && "hs-row-highlight", spec.totalRow === r && "hs-row-total")}
              >
                {spec.columns.map((c, i) => (
                  <Cell key={c.key} value={row[c.key] ?? null} kind={c.kind} digits={c.digits} pinned={i === 0 && pinFirst} cell={cellKey(label, c.label)} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}

export function KeyValueCard({ spec }: { spec: KeyValueSpec }) {
  return (
    <TableFrame testId={`table-${spec.id}`} title={spec.title} note={spec.note}>
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
              <tr key={item.label} data-row={item.label} className={cn(r % 2 === 1 && "data-table-row-alt")}>
                <td className="col-pinned font-semibold" data-cell={cellKey(item.label, "Item")}>
                  {item.label}
                </td>
                <td className="text-right" title={d.title} data-cell={cellKey(item.label, "Value")} data-value={rawValue(item.value)}>
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
    <TableFrame testId={`table-${spec.id}`} title={spec.title} note={spec.note} book>
      <table className="data-table-premium hs-has-groups">
        <thead>
          <tr className="hs-group-row">
            <th className="col-pinned">{spec.corner[0]}</th>
            {spec.groups.map((g) => (
              <th key={g.label} colSpan={g.span} className="hs-strike-band">
                {g.label}
              </th>
            ))}
          </tr>
          <tr className="hs-head-row">
            <th className="col-pinned">{spec.corner[1]}</th>
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
              <tr key={row.label} data-row={row.label} className={cn(r % 2 === 1 && "data-table-row-alt")}>
                <td className="col-pinned font-semibold" data-cell={cellKey(row.label, spec.corner[1])}>
                  {row.label}
                </td>
                {row.values.map((v, i) => {
                  const overridden = row.overridden?.[i] ?? false;
                  const cell = cellKey(row.label, gridColumnLabel(spec, i));
                  if (!editable) {
                    const d = displayCell(v, row.kind, row.digits);
                    return (
                      <td
                        key={i}
                        className={cn("text-right", overridden && "hs-overridden-cell")}
                        title={overridden ? "Overridden" : d.title}
                        data-cell={cell}
                        data-value={rawValue(v)}
                      >
                        {d.text}
                      </td>
                    );
                  }
                  const key = spec.columnKeys![i]!;
                  return (
                    <td key={i} className={cn("p-1 text-right", overridden && "hs-overridden-cell")} data-cell={cell} data-value={rawValue(v)}>
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          className="w-20 rounded-lg border border-[color:var(--ar-border)] bg-[color:var(--ar-input-bg)] px-2 py-1 text-right font-ui text-xs tabular-nums outline-none focus:border-gold"
                          inputMode="decimal"
                          aria-label={`${row.label} for ${spec.columnLabels[i]} leg ${i + 1}`}
                          defaultValue={typeof v === "number" ? (v * 100).toFixed(2) : ""}
                          data-testid={`grid-edit-${key}`}
                          onBlur={(e) => {
                            const text = e.target.value.replace(/[%\s]/g, "");
                            const n = Number(text);
                            if (text && Number.isFinite(n) && n > 0) edit.onChange(key, n / 100);
                          }}
                        />
                        {overridden ? (
                          <button type="button" className="hs-overridden-badge" onClick={() => edit.onChange(key, null)} title="Reset To The Surface">
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
