// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceSelect, FieldRow, NumberInput } from "@/components/ui/fields";

describe("NumberInput", () => {
  it("shows an empty field with its placeholder for a blank value, never 0", () => {
    render(
      <FieldRow label="Spot">
        <NumberInput value={NaN} onChange={() => undefined} placeholder="Eg 73,500" testId="input-spot" />
      </FieldRow>,
    );
    const input = screen.getByRole("textbox", { name: "Spot" }) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Eg 73,500");
    expect(input).toHaveAttribute("data-testid", "input-spot");
  });

  it("commits parsed percents and reports blanks and bad text", () => {
    const onChange = vi.fn();
    const onBlank = vi.fn();
    render(<NumberInput kind="percent" value={NaN} onChange={onChange} onBlankChange={onBlank} ariaLabel="Coupon" />);
    const input = screen.getByLabelText("Coupon");
    fireEvent.change(input, { target: { value: "102.5" } });
    expect(onChange).toHaveBeenLastCalledWith(1.025);
    fireEvent.change(input, { target: { value: "" } });
    expect(onBlank).toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number.");
  });

  it("marks an invalid field with aria-invalid and a red ring", () => {
    render(<NumberInput value={5} onChange={() => undefined} invalid ariaLabel="Decay" />);
    const input = screen.getByLabelText("Decay");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("ring-rose-400/60");
  });
});

describe("ChoiceSelect", () => {
  function Harness() {
    const [value, setValue] = useState<"P" | "C" | "">("");
    return (
      <FieldRow label="Option Type">
        <ChoiceSelect value={value} onChange={setValue} testId="input-optionType" options={[{ value: "P", label: "Put" }, { value: "C", label: "Call" }]} />
      </FieldRow>
    );
  }

  it("starts on the empty Select option and takes a choice", () => {
    render(<Harness />);
    const select = screen.getByRole("combobox", { name: "Option Type" }) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.options[0]!.text).toBe("Select …");
    fireEvent.change(select, { target: { value: "C" } });
    expect(select.value).toBe("C");
  });
});
