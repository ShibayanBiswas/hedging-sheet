// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateInput } from "@/components/ui/fields";

const field = () => screen.getByTestId("date") as HTMLInputElement;
const focus = () => act(() => field().focus());
const blur = () => act(() => field().blur());

function setup(value: string) {
  const onCommit = vi.fn();
  const onUnreadable = vi.fn();
  const view = render(<DateInput value={value} onCommit={onCommit} onUnreadable={onUnreadable} label="Valuation Date" testId="date" />);
  const moveTo = (next: string) => view.rerender(<DateInput value={next} onCommit={onCommit} onUnreadable={onUnreadable} label="Valuation Date" testId="date" />);
  return { onCommit, onUnreadable, moveTo };
}

describe("DateInput", () => {
  it("an untouched blur never writes the old date over one that arrived while the field had focus", () => {
    const { onCommit, moveTo } = setup("2026-10-27");
    focus();
    moveTo("2026-10-28");
    expect(field().value).toBe("27-Oct-2026");
    blur();
    expect(onCommit).not.toHaveBeenCalled();
    expect(field().value).toBe("28-Oct-2026");
  });

  it("an untouched blur of a blank draft does not clear a date that has since arrived", () => {
    const { onCommit, moveTo } = setup("");
    focus();
    moveTo("2026-10-28");
    blur();
    expect(onCommit).not.toHaveBeenCalled();
    expect(field().value).toBe("28-Oct-2026");
  });

  it("commits what was typed, once, even when the value moved meanwhile", () => {
    const { onCommit, moveTo } = setup("2026-10-27");
    focus();
    fireEvent.change(field(), { target: { value: "15-Sep-2026" } });
    moveTo("2026-10-28");
    blur();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2026-09-15");
    focus();
    blur();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("commits a cleared field as empty, and reverts text that is not a date", () => {
    const { onCommit, onUnreadable } = setup("2026-10-27");
    focus();
    fireEvent.change(field(), { target: { value: "not a date" } });
    blur();
    expect(onUnreadable).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(field().value).toBe("27-Oct-2026");
    focus();
    fireEvent.change(field(), { target: { value: "" } });
    blur();
    expect(onCommit).toHaveBeenCalledWith("");
  });

  it("the calendar picker still commits on its own", () => {
    const { onCommit } = setup("2026-10-27");
    const picker = document.querySelector<HTMLInputElement>('input[type="date"]')!;
    fireEvent.change(picker, { target: { value: "2026-11-30" } });
    expect(onCommit).toHaveBeenCalledWith("2026-11-30");
  });
});
