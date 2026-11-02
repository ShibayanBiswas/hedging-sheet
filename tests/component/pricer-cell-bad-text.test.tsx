// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GridCard } from "@/components/ui/desk-table";
import type { GridSpec } from "@/lib/tables";

const spec: GridSpec = {
  id: "leg-grid",
  title: "Leg Grid",
  corner: ["Strike", "Expiry"],
  groups: [{ label: "137%", span: 1 }],
  columnLabels: ["28-Oct-2026"],
  columnKeys: ["leg-1"],
  rows: [{ label: "Volatility", kind: "percent", digits: 2, values: [0.142678], overridden: [false] }],
};

function setup(overrides: Record<string, number> = {}) {
  const onChange = vi.fn();
  render(<GridCard spec={spec} edit={{ rowLabel: "Volatility", onChange, overrides }} />);
  const cell = screen.getByTestId("grid-edit-leg-1") as HTMLInputElement;
  const type = (text: string) => {
    act(() => cell.focus());
    fireEvent.change(cell, { target: { value: text } });
    act(() => cell.blur());
  };
  return { onChange, cell, type };
}

describe("Pricer cell with text it cannot use", () => {
  it.each(["6,5", "14,50", "abc", "0", "-3", "", "1e1", "0x10", "1.2.3", "14,5 %"])("%s goes back to the surface value and stores nothing", (text) => {
    const { onChange, cell, type } = setup();
    type(text);
    expect(onChange).not.toHaveBeenCalled();
    expect(cell.value).toBe("14.27");
  });

  it("goes back to the override when one is held", () => {
    const { onChange, cell, type } = setup({ "leg-1": 0.14275 });
    type("6,5");
    expect(onChange).not.toHaveBeenCalled();
    expect(cell.value).toBe("14.275");
  });

  it.each([
    ["1,940", 19.4],
    ["15", 0.15],
    ["15 %", 0.15],
    ["14.", 0.14],
    [".5", 0.005],
  ])("still takes %s", (text, value) => {
    const { onChange, type } = setup();
    type(text);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![1]).toBeCloseTo(value, 12);
  });
});
