"use client";

import { Fragment } from "react";

import { cn } from "@/lib/cn";
import { blank, dateText, numberText, percentText, croreText, type Display } from "@/lib/format";
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

function Cell({ value, kind, digits, pinned }: { value: CellValue; kind: CellKind; digits?: number; pinned?: boolean }) {
  const d = displayCell(value, kind, digits);
  const right = kind !== "text";
  return (
    <td className={cn(right && "text-right", pinned && "col-pinned font-semibold")} title={d.title}>
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
    <div className="w-full min-w-0" data-testid={testId ?? `table-${spec.id}`}>
      <div className="desk-table-scroll">
        <table className={cn("data-table-premium", hasGroups && "hs-has-groups")}>
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
                className={cn(
                  r % 2 === 1 && "data-table-row-alt",
                  spec.highlightRow === r && "hs-row-highlight",
                  spec.totalRow === r && "hs-row-total",
                )}
              >
                {spec.columns.map((c, i) => (
                  <Cell key={c.key} value={row[c.key] ?? null} kind={c.kind} digits={c.digits} pinned={i === 0 && pinFirst} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spec.note ? <p className="mt-2 font-ui text-xs italic text-muted">{spec.note}</p> : null}
    </div>
  );
}

export function KeyValueCard({ spec }: { spec: KeyValueSpec }) {
  return (
    <div className="w-full min-w-0" data-testid={`table-${spec.id}`}>
      <div className="desk-table-scroll">
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
      </div>
      {spec.note ? <p className="mt-2 font-ui text-xs italic text-muted">{spec.note}</p> : null}
    </div>
  );
}

export function GridCard({ spec }: { spec: GridSpec }) {
  return (
    <div className="w-full min-w-0" data-testid={`table-${spec.id}`}>
      <div className="desk-table-scroll desk-table-scroll--book">
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
            {spec.rows.map((row, r) => (
              <Fragment key={row.label}>
                <tr className={cn(r % 2 === 1 && "data-table-row-alt")}>
                  <td className="col-pinned font-semibold">{row.label}</td>
                  {row.values.map((v, i) => (
                    <Cell key={i} value={v} kind={row.kind} digits={row.digits} />
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {spec.note ? <p className="mt-2 font-ui text-xs italic text-muted">{spec.note}</p> : null}
    </div>
  );
}
