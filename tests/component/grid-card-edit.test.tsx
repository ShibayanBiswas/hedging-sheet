// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GridCard } from "@/components/ui/desk-table";
import type { GridSpec } from "@/lib/tables";

function spec(vol: number, overridden = false): GridSpec {
  return {
    id: "leg-grid",
    title: "Leg Grid",
    corner: ["Strike", "Expiry"],
    groups: [{ label: "137%", span: 1 }],
    columnLabels: ["28-Oct-2026"],
    columnKeys: ["leg-1"],
    rows: [{ label: "Volatility", kind: "percent", digits: 2, values: [vol], overridden: [overridden] }],
  };
}

/** Real focus and blur, as the Tab key moves them: the browser's own events, not fired ones. */
function tabThrough(cell: HTMLInputElement) {
  act(() => cell.focus());
  expect(document.activeElement).toBe(cell);
  act(() => cell.blur());
  expect(document.activeElement).not.toBe(cell);
}

function typeInto(cell: HTMLInputElement, text: string) {
  act(() => cell.focus());
  fireEvent.change(cell, { target: { value: text } });
  act(() => cell.blur());
}

const legCell = () => screen.getByTestId("grid-edit-leg-1") as HTMLInputElement;

describe("Pricer leg volatility cell", () => {
  it("stores nothing when the cell is tabbed through showing a surface volatility of 14.2678%", () => {
    const onChange = vi.fn();
    render(<GridCard spec={spec(0.142678)} edit={{ rowLabel: "Volatility", onChange }} />);
    expect(legCell().value).toBe("14.27");
    tabThrough(legCell());
    expect(onChange).not.toHaveBeenCalled();
    expect(legCell().value).toBe("14.27");
  });

  it("commits a typed volatility once, and a later untouched blur neither commits it again nor rounds it", () => {
    const onChange = vi.fn();
    const edit = { rowLabel: "Volatility", onChange };
    const { rerender } = render(<GridCard spec={spec(0.142678)} edit={edit} />);
    typeInto(legCell(), "14.275");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toBe("leg-1");
    expect(onChange.mock.calls[0]![1]).toBeCloseTo(0.14275, 12);
    tabThrough(legCell());
    // The run that follows prices the override: the cell's default text is now rounded, what it shows is not.
    rerender(<GridCard spec={spec(0.14275, true)} edit={edit} />);
    tabThrough(legCell());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(legCell().value).toBe("14.275");
  });

  it("does not round an override of 14.275 when the tab is reopened and the cell shows it to 2 decimals", () => {
    const onChange = vi.fn();
    render(<GridCard spec={spec(0.14275, true)} edit={{ rowLabel: "Volatility", onChange }} />);
    tabThrough(legCell());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not bring back a typed override after it was reset", () => {
    const onChange = vi.fn();
    const edit = { rowLabel: "Volatility", onChange };
    const { rerender } = render(<GridCard spec={spec(0.142678)} edit={edit} />);
    typeInto(legCell(), "30");
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<GridCard spec={spec(0.142678)} edit={edit} />);
    tabThrough(legCell());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("commits a change, takes a percent sign, and ignores text that is not a positive number", () => {
    const onChange = vi.fn();
    render(<GridCard spec={spec(0.142678)} edit={{ rowLabel: "Volatility", onChange }} />);
    typeInto(legCell(), "15 %");
    expect(onChange).toHaveBeenLastCalledWith("leg-1", 0.15);
    onChange.mockClear();
    for (const text of ["abc", "0", "-3", ""]) typeInto(legCell(), text);
    expect(onChange).not.toHaveBeenCalled();
  });
});
