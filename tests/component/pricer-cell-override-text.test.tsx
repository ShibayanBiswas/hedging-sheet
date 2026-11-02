// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GridCard } from "@/components/ui/desk-table";
import type { GridSpec } from "@/lib/tables";

function spec(vol: number, overridden: boolean): GridSpec {
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

const shown = (vol: number, overridden: boolean) => {
  const { unmount } = render(<GridCard spec={spec(vol, overridden)} edit={{ rowLabel: "Volatility", onChange: vi.fn(), overrides: overridden ? { "leg-1": vol } : {} }} />);
  const text = (screen.getByTestId("grid-edit-leg-1") as HTMLInputElement).value;
  unmount();
  return text;
};

describe("Pricer cell text when the tab is opened", () => {
  it("shows an override to its third decimal", () => {
    expect(shown(0.14275, true)).toBe("14.275");
    expect(shown(0.141, true)).toBe("14.10");
    expect(shown(0.3, true)).toBe("30.00");
  });

  it("stops an override at 3 decimals", () => {
    expect(shown(0.1427512, true)).toBe("14.275");
  });

  it("keeps a surface value at the 2 decimals it has always shown", () => {
    expect(shown(0.142678, false)).toBe("14.27");
  });
});
