// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VolSurfaceGrid } from "@/components/market/vol-surface-grid";
import { NumberInput } from "@/components/ui/fields";
import { seedMarketData } from "@/lib/engine/defaults";
import { ungroup } from "@/lib/format";

describe("ungroup", () => {
  it.each([
    ["74,151.04", "74151.04"],
    ["1,940", "1940"],
    ["1,02,202", "102202"],
    ["-1,940", "-1940"],
    ["1,234.", "1234."],
    ["6.5", "6.5"],
    ["", ""],
  ])("reads %s as grouping", (text, plain) => {
    expect(ungroup(text)).toBe(plain);
  });

  it.each(["6,5", "14,50", "14,5", "1,2345", "1,234,", "1.234,567", "1,23.4"])("refuses %s", (text) => {
    expect(ungroup(text)).toBeNull();
  });
});

describe("NumberInput decimal comma", () => {
  it("rejects 6,5 in a percent field through its error, rather than reading 65%", () => {
    const onChange = vi.fn();
    render(<NumberInput kind="percent" value={0.08} onChange={onChange} ariaLabel="NBFC Rate" />);
    const input = screen.getByLabelText("NBFC Rate");
    fireEvent.change(input, { target: { value: "6,5" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number.");
  });

  it("keeps reading grouped numbers, the rupee sign and the percent sign", () => {
    const onChange = vi.fn();
    render(<NumberInput value={1} onChange={onChange} ariaLabel="Spot" />);
    const input = screen.getByLabelText("Spot");
    for (const [text, value] of [["74,151.04", 74151.04], ["1,940", 1940], ["1,02,202", 102202], ["₹ 1,940", 1940]] as const) {
      fireEvent.change(input, { target: { value: text } });
      expect(onChange).toHaveBeenLastCalledWith(value);
    }
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("a whole number field takes a grouped number and refuses a decimal comma", () => {
    const onChange = vi.fn();
    render(<NumberInput kind="integer" value={1} onChange={onChange} ariaLabel="Tenor" />);
    const input = screen.getByLabelText("Tenor");
    fireEvent.change(input, { target: { value: "1,940" } });
    expect(onChange).toHaveBeenLastCalledWith(1940);
    fireEvent.change(input, { target: { value: "19,4" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number.");
  });
});

describe("Volatility surface cell decimal comma", () => {
  const { surface } = seedMarketData();
  const draft = surface.volsPercent.map((row) => [...row]);
  const asOf = surface.expiries[0]!.slice(0, 10);

  function setup() {
    const onCellChange = vi.fn();
    const onInvalidChange = vi.fn();
    render(<VolSurfaceGrid surface={surface} asOf={asOf} editing draft={draft} onCellChange={onCellChange} onInvalidChange={onInvalidChange} />);
    return { onCellChange, onInvalidChange, cell: screen.getByTestId("vol-cell-0-1") };
  }

  it("marks 14,5 and 14,50 invalid rather than reading 145", () => {
    const { onCellChange, onInvalidChange, cell } = setup();
    for (const text of ["14,5", "14,50"]) {
      fireEvent.change(cell, { target: { value: text } });
      expect(cell).toHaveAttribute("aria-invalid", "true");
    }
    expect(onCellChange).not.toHaveBeenCalled();
    expect(onInvalidChange).toHaveBeenLastCalledWith(1);
  });

  it("still takes a plain value and a percent sign", () => {
    const { onCellChange, cell } = setup();
    fireEvent.change(cell, { target: { value: "14.5 %" } });
    expect(onCellChange).toHaveBeenLastCalledWith(0, 1, 14.5);
    expect(cell).not.toHaveAttribute("aria-invalid");
  });
});
