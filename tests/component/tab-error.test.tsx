// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TabError from "@/app/error";

describe("TabError", () => {
  afterEach(cleanup);

  it("says what happened and retries", () => {
    const retry = vi.fn();
    render(<TabError retry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("This Tab Could Not Be Shown");
    fireEvent.click(screen.getByTestId("tab-error-retry"));
    expect(retry).toHaveBeenCalledOnce();
  });
});
