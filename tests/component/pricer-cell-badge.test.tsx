// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { GridCard } from "@/components/ui/desk-table";
import type { GridSpec } from "@/lib/tables";

const SURFACE = 0.142678;

/** One leg as the last run left it: `ran` is the volatility it priced at, and the run marks it overridden when that is not the surface's. */
function spec(ran: number): GridSpec {
  return {
    id: "leg-grid",
    title: "Leg Grid",
    corner: ["Strike", "Expiry"],
    groups: [{ label: "137%", span: 1 }],
    columnLabels: ["28-Oct-2026"],
    columnKeys: ["leg-1"],
    rows: [{ label: "Volatility", kind: "percent", digits: 2, values: [ran], overridden: [ran !== SURFACE], surface: [SURFACE] }],
  };
}

/** Holds the overrides as the Pricer page does; the button stands in for its Reset. */
function Desk({ ran = SURFACE, start = {} }: { ran?: number; start?: Record<string, number> }) {
  const [overrides, setOverrides] = useState(start);
  return (
    <>
      <GridCard
        spec={spec(ran)}
        edit={{
          rowLabel: "Volatility",
          overrides,
          onChange: (key, value) =>
            setOverrides((prev) => {
              const next = { ...prev };
              if (value == null) delete next[key];
              else next[key] = value;
              return next;
            }),
        }}
      />
      <button type="button" onClick={() => setOverrides({})}>
        Reset All
      </button>
    </>
  );
}

const badge = () => screen.queryByRole("button", { name: "Overridden ×" });
const cell = () => screen.getByTestId("grid-edit-leg-1") as HTMLInputElement;
const highlighted = () => cell().closest("td")!.classList.contains("hs-overridden-cell");

describe("Pricer Overridden badge and highlight follow the stored override", () => {
  it("clear at once on Reset while the last run still priced the override", () => {
    render(<Desk ran={0.3} start={{ "leg-1": 0.3 }} />);
    expect(badge()).not.toBeNull();
    expect(highlighted()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    expect(badge()).toBeNull();
    expect(highlighted()).toBe(false);
  });

  it("clear at once when the cell's own × is clicked", () => {
    render(<Desk ran={0.3} start={{ "leg-1": 0.3 }} />);
    fireEvent.click(badge()!);
    expect(badge()).toBeNull();
    expect(highlighted()).toBe(false);
    expect(cell().value).toBe("14.27");
  });

  it("appear as soon as an override is stored, before any run", () => {
    render(<Desk />);
    expect(badge()).toBeNull();
    act(() => cell().focus());
    fireEvent.change(cell(), { target: { value: "30" } });
    act(() => cell().blur());
    expect(badge()).not.toBeNull();
    expect(highlighted()).toBe(true);
  });

  it("stay away on a cell with no override", () => {
    render(<Desk />);
    expect(badge()).toBeNull();
    expect(highlighted()).toBe(false);
  });
});
