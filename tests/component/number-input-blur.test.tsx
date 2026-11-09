// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NumberInput } from "@/components/ui/fields";

function typeThenLeave(input: HTMLElement, text: string) {
  act(() => input.focus());
  fireEvent.change(input, { target: { value: text } });
  act(() => input.blur());
}

describe("NumberInput after leaving the field with bad text", () => {
  it("an unguarded field goes back to the last number and drops its error", () => {
    render(<NumberInput value={1.25} onChange={() => undefined} ariaLabel="Factor" />);
    const input = screen.getByLabelText("Factor") as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number.");
    act(() => input.blur());
    expect(input.value).toBe("1.25");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input.className).not.toContain("ring-rose-400/60");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the error stays while the field still has focus", () => {
    render(<NumberInput value={1.25} onChange={() => undefined} ariaLabel="Factor" />);
    const input = screen.getByLabelText("Factor");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("a whole number field does the same", () => {
    render(<NumberInput kind="integer" value={1940} onChange={() => undefined} ariaLabel="Tenor" />);
    const input = screen.getByLabelText("Tenor") as HTMLInputElement;
    typeThenLeave(input, "1.5");
    expect(input.value).toBe("1,940");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("a guarded field still reverts and says why", () => {
    const onReject = vi.fn();
    render(<NumberInput value={1.25} onChange={() => undefined} onReject={onReject} ariaLabel="Decay" />);
    const input = screen.getByLabelText("Decay") as HTMLInputElement;
    typeThenLeave(input, "abc");
    expect(onReject).toHaveBeenCalledWith({ label: "", message: "Enter a number." });
    expect(input.value).toBe("1.25");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("a value its rule corrects stays out while typed, then becomes the corrected value on leaving, with no popup", () => {
    const onReject = vi.fn();
    const onChange = vi.fn();
    const onCorrect = vi.fn();
    const lowered = { value: 1.6, note: "Lowered To The Decay, 1.60" };
    render(<NumberInput value={1.25} onChange={onChange} correct={(v) => (v > 1.6 ? lowered : null)} onCorrect={onCorrect} onReject={onReject} ariaLabel="Decay" />);
    const input = screen.getByLabelText("Decay") as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "99" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    act(() => input.blur());
    expect(onChange).not.toHaveBeenCalled();
    expect(onCorrect).toHaveBeenCalledWith(lowered);
    expect(onReject).not.toHaveBeenCalled();
  });

  it("a whole number field with a rule takes a decimal, for the rule to round it", () => {
    const onCorrect = vi.fn();
    render(<NumberInput kind="integer" value={1940} onChange={() => undefined} correct={(v) => (Number.isInteger(v) ? null : { value: Math.round(v), note: "Rounded" })} onCorrect={onCorrect} ariaLabel="Tenor" />);
    typeThenLeave(screen.getByLabelText("Tenor"), "1940.4");
    expect(onCorrect).toHaveBeenCalledWith({ value: 1940, note: "Rounded" });
  });

  it("any keystroke tells the field it is being edited, so its note can go", () => {
    const onEdit = vi.fn();
    render(<NumberInput value={1.25} onChange={() => undefined} onEdit={onEdit} ariaLabel="Decay" />);
    fireEvent.change(screen.getByLabelText("Decay"), { target: { value: "1.3" } });
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("an external invalid mark stays after the blur", () => {
    render(<NumberInput value={1.25} onChange={() => undefined} invalid ariaLabel="Factor" />);
    const input = screen.getByLabelText("Factor");
    typeThenLeave(input, "abc");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
