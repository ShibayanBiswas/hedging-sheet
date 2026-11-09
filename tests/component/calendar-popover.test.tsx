// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateInput } from "@/components/ui/fields";

/** 28-Oct-2026 10:00 IST, the e2e clock. */
const NOW = new Date("2026-10-28T04:30:00.000Z");

const button = (label = "Valuation Date") => screen.getByRole("button", { name: `Open Calendar For ${label}` });
const calendar = (label = "Valuation Date") => screen.getByRole("dialog", { name: `Choose ${label}` });
const day = (name: string) => within(calendar()).getByRole("gridcell", { name });
const shownMonth = () => within(calendar()).getByRole("grid").getAttribute("aria-label");
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });

function setup(value: string, label = "Valuation Date") {
  const onCommit = vi.fn();
  render(<DateInput value={value} onCommit={onCommit} label={label} testId="date" />);
  return { onCommit };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

describe("DateInput calendar", () => {
  it("has no hidden native date control: the button opens the desk's own calendar", () => {
    setup("2026-10-26");
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(button()).toHaveAttribute("title", "Open Calendar For Valuation Date");
    expect(button()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button());
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(calendar()).toHaveAttribute("aria-modal", "true");
  });

  it("opens on the field's month with its date selected and focused, and today marked", () => {
    setup("2026-09-15");
    fireEvent.click(button());
    expect(shownMonth()).toBe("September 2026");
    const selected = within(calendar()).getAllByRole("gridcell", { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName("Tuesday 15-Sep-2026");
    expect(selected[0]).toHaveFocus();
    // Today is 28-Oct-2026, past the six weeks September shows; the next month marks it.
    expect(within(calendar()).queryByRole("gridcell", { current: "date" })).toBeNull();
    fireEvent.click(within(calendar()).getByRole("button", { name: "Next Month" }));
    expect(shownMonth()).toBe("October 2026");
    expect(day("Wednesday 28-Oct-2026")).toHaveAttribute("aria-current", "date");
  });

  it("an empty field opens on today's month with today focused and nothing selected", () => {
    setup("");
    fireEvent.click(button());
    expect(shownMonth()).toBe("October 2026");
    expect(day("Wednesday 28-Oct-2026")).toHaveFocus();
    expect(within(calendar()).queryAllByRole("gridcell", { selected: true })).toHaveLength(0);
  });

  it("previous and next month and the month and year choices move the view, and a pick commits once, closes and returns focus", () => {
    const { onCommit } = setup("2026-10-26");
    fireEvent.click(button());
    fireEvent.click(within(calendar()).getByRole("button", { name: "Previous Month" }));
    expect(shownMonth()).toBe("September 2026");
    fireEvent.click(within(calendar()).getByRole("button", { name: "Next Month" }));
    fireEvent.click(within(calendar()).getByRole("button", { name: "Next Month" }));
    expect(shownMonth()).toBe("November 2026");
    // Expiries reach 2031 and beyond.
    const year = within(calendar()).getByRole("combobox", { name: "Year" }) as HTMLSelectElement;
    expect([...year.options].map((o) => o.value)).toEqual(expect.arrayContaining(["2016", "2031", "2041"]));
    fireEvent.change(year, { target: { value: "2031" } });
    expect(shownMonth()).toBe("November 2031");
    fireEvent.change(within(calendar()).getByRole("combobox", { name: "Month" }), { target: { value: "3" } });
    expect(shownMonth()).toBe("April 2031");
    fireEvent.click(day("Thursday 24-Apr-2031"));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2031-04-24");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button()).toHaveFocus();
  });

  it("picking the date already in the field closes without a commit", () => {
    const { onCommit } = setup("2026-10-26");
    fireEvent.click(button());
    fireEvent.click(day("Monday 26-Oct-2026"));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("arrows move by a day or a week, Page Up and Page Down by a month, Home and End to the week's ends, Enter picks", () => {
    const { onCommit } = setup("2026-10-28");
    fireEvent.click(button());
    const focused = () => document.activeElement?.getAttribute("data-date");
    expect(focused()).toBe("2026-10-28");
    key("ArrowRight");
    expect(focused()).toBe("2026-10-29");
    key("ArrowDown");
    expect(focused()).toBe("2026-11-05");
    expect(shownMonth()).toBe("November 2026");
    key("ArrowUp");
    key("ArrowLeft");
    expect(focused()).toBe("2026-10-28");
    key("PageDown");
    expect(focused()).toBe("2026-11-28");
    key("PageUp");
    key("PageUp");
    expect(focused()).toBe("2026-09-28");
    key("Home");
    expect(focused()).toBe("2026-09-27");
    key("End");
    expect(focused()).toBe("2026-10-03");
    expect(shownMonth()).toBe("October 2026");
    // A month shorter than the focused day keeps its last day.
    key("PageDown");
    key("PageDown");
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    expect(focused()).toBe("2026-12-31");
    key("PageDown");
    key("PageDown");
    expect(focused()).toBe("2027-02-28");
    key("Enter");
    expect(onCommit).toHaveBeenCalledWith("2027-02-28");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Space picks too", () => {
    const { onCommit } = setup("2026-10-28");
    fireEvent.click(button());
    key("ArrowLeft");
    key(" ");
    expect(onCommit).toHaveBeenCalledWith("2026-10-27");
  });

  it("Escape closes without a commit and returns focus to the button", () => {
    const { onCommit } = setup("2026-10-28");
    fireEvent.click(button());
    key("ArrowRight");
    key("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button()).toHaveFocus();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Tab stays inside the calendar: past the focused day it wraps to Previous Month", () => {
    setup("2026-10-28");
    fireEvent.click(button());
    key("Tab");
    expect(within(calendar()).getByRole("button", { name: "Previous Month" })).toHaveFocus();
    key("Tab");
    expect(within(calendar()).getByRole("combobox", { name: "Month" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(day("Wednesday 28-Oct-2026")).toHaveFocus();
  });

  it("a press outside closes it; a second press on the button closes it too", () => {
    const { onCommit } = setup("2026-10-28");
    fireEvent.click(button());
    fireEvent.pointerDown(day("Thursday 29-Oct-2026"));
    expect(calendar()).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(button());
    fireEvent.pointerDown(button());
    fireEvent.click(button());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("only one calendar is open at a time", () => {
    render(
      <>
        <DateInput value="2030-04-25" onCommit={() => undefined} label="Expiry 1" />
        <DateInput value="2030-07-25" onCommit={() => undefined} label="Expiry 2" />
      </>,
    );
    fireEvent.click(button("Expiry 1"));
    expect(calendar("Expiry 1")).toBeInTheDocument();
    act(() => button("Expiry 2").click());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(calendar("Expiry 2")).toBeInTheDocument();
    expect(within(calendar("Expiry 2")).getByRole("grid")).toHaveAccessibleName("July 2030");
  });
});
