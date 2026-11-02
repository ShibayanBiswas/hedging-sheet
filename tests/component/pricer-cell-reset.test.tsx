// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { GridCard } from "@/components/ui/desk-table";
import { pricerGrid, type GridSpec } from "@/lib/tables";

import { priced } from "../helpers/fixture";

const SURFACE = 0.142678;

/** One leg as the last run left it: `priced` is the volatility it ran on, with the surface value beside it. */
function spec(priced_: number): GridSpec {
  return {
    id: "leg-grid",
    title: "Leg Grid",
    corner: ["Strike", "Expiry"],
    groups: [{ label: "137%", span: 1 }],
    columnLabels: ["28-Oct-2026"],
    columnKeys: ["leg-1"],
    rows: [{ label: "Volatility", kind: "percent", digits: 2, values: [priced_], overridden: [priced_ !== SURFACE], surface: [SURFACE] }],
  };
}

/** Holds the overrides as the Pricer page does; the buttons stand in for its reset and for a run of the simulation. */
function Desk({ start = {}, onChange = vi.fn() }: { start?: Record<string, number>; onChange?: (key: string, value: number | null) => void }) {
  const [overrides, setOverrides] = useState<Record<string, number>>(start);
  const [ran, setRan] = useState(start["leg-1"] ?? SURFACE);
  return (
    <>
      <GridCard
        spec={spec(ran)}
        edit={{
          rowLabel: "Volatility",
          overrides,
          onChange: (key, value) => {
            onChange(key, value);
            setOverrides((prev) => {
              const next = { ...prev };
              if (value == null) delete next[key];
              else next[key] = value;
              return next;
            });
          },
        }}
      />
      <button type="button" onClick={() => setOverrides({})}>
        Reset All
      </button>
      <button type="button" onClick={() => setRan(overrides["leg-1"] ?? SURFACE)}>
        Run
      </button>
    </>
  );
}

const cell = () => screen.getByTestId("grid-edit-leg-1") as HTMLInputElement;

function type(text: string) {
  act(() => cell().focus());
  fireEvent.change(cell(), { target: { value: text } });
  act(() => cell().blur());
}

describe("Pricer cell after its override goes away", () => {
  it("shows the surface value again after Reset, with no run in between", () => {
    render(<Desk />);
    type("30");
    expect(cell().value).toBe("30.00");
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    expect(cell().value).toBe("14.27");
  });

  it("shows the surface value after Reset even when the last run priced the override", () => {
    render(<Desk />);
    type("30");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    expect(cell().value).toBe("14.27");
  });

  it("shows the surface value after the cell's own badge is clicked", () => {
    render(<Desk start={{ "leg-1": 0.3 }} />);
    expect(cell().value).toBe("30.00");
    fireEvent.click(screen.getByRole("button", { name: "Overridden ×" }));
    expect(cell().value).toBe("14.27");
  });

  it("stores nothing when the re-synced cell is then tabbed through", () => {
    const onChange = vi.fn();
    render(<Desk onChange={onChange} />);
    type("30");
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    onChange.mockClear();
    act(() => cell().focus());
    act(() => cell().blur());
    expect(onChange).not.toHaveBeenCalled();
    expect(cell().value).toBe("14.27");
  });

  it("does not disturb a cell being typed in", () => {
    render(<Desk start={{ "leg-1": 0.3 }} />);
    act(() => cell().focus());
    fireEvent.change(cell(), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    act(() => cell().focus());
    expect(cell().value).toBe("2");
  });
});

describe("the Pricer grid", () => {
  it("carries the surface value of an overridden leg, and overriding one leg changes no other leg's", () => {
    const plain = pricerGrid(priced());
    const overridden = pricerGrid(priced({ legVolOverrides: { "0-0": 0.3 } }));
    const row = (s: GridSpec) => s.rows.find((r) => r.label === "Volatility")!;
    expect(row(overridden).values[0]).toBe(0.3);
    expect(row(overridden).surface).toEqual(row(plain).values);
    expect(row(plain).surface).toEqual(row(plain).values);
    expect(pricerGrid(priced()).rows.find((r) => r.label === "Strike")!.surface).toBeUndefined();
  });
});
