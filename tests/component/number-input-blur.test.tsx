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

  it("a guarded field still reverts a value its rule refuses", () => {
    const onReject = vi.fn();
    const onChange = vi.fn();
    const refused = { label: "Decay", message: "Too high." };
    render(<NumberInput value={1.25} onChange={onChange} check={() => refused} onReject={onReject} ariaLabel="Decay" />);
    const input = screen.getByLabelText("Decay") as HTMLInputElement;
    typeThenLeave(input, "99");
    expect(onChange).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith(refused);
    expect(input.value).toBe("1.25");
  });

  it("an external invalid mark stays after the blur", () => {
    render(<NumberInput value={1.25} onChange={() => undefined} invalid ariaLabel="Factor" />);
    const input = screen.getByLabelText("Factor");
    typeThenLeave(input, "abc");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
