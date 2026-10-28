// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeskDialog } from "@/components/ui/desk-dialog";

describe("DeskDialog", () => {
  it("shows the title, grouped items, a fix, actions and a custom close label", () => {
    const onClose = vi.fn();
    const go = vi.fn();
    render(
      <DeskDialog
        open
        onClose={onClose}
        state={{
          title: "Missing Or Invalid Inputs",
          message: "2 fields need attention before the simulation can run.",
          variant: "error",
          fix: "Fill the fields listed.",
          groups: [
            { title: "Underlying And Market", items: ["Underlying: Select Nifty or Sensex."] },
            { title: "Strikes", items: ["Strike 1: Strike 1 is required."] },
          ],
          actions: [{ label: "Go To First Field", onClick: go, testId: "go-to-first-field" }],
          okLabel: "Close",
        }}
      />,
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Missing Or Invalid Inputs");
    expect(screen.getByTestId("desk-dialog-groups")).toHaveTextContent("Underlying And Market");
    expect(screen.getByTestId("desk-dialog-groups")).toHaveTextContent("Strike 1: Strike 1 is required.");
    expect(screen.getByText(/How To Fix/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("go-to-first-field"));
    expect(go).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("desk-dialog-ok")).toHaveTextContent("Close");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
