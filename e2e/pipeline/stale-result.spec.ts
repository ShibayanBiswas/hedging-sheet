import { expect, test } from "../fixtures";
import { hook, outputTableCount } from "./helpers";

/** A result made from other inputs is never shown: not on the output tabs, not in the Logic Atlas, not in the Excel file. */
test.describe("no stale result after a mode or underlying switch", () => {
  test("switching mode clears the result everywhere", async ({ page, inputs, nav }) => {
    await inputs.goto("default");
    await inputs.run();
    expect(await outputTableCount(page)).toBeGreaterThan(0);
    expect((await hook(page)).result).not.toBeNull();

    await nav.go("inputs");
    await inputs.setMode("blank");
    expect((await hook(page)).result).toBeNull();
    for (const tab of ["summary", "pricer", "product", "vega-hedge", "margin"] as const) {
      await nav.go(tab);
      expect(await outputTableCount(page), `${tab} shows no table`).toBe(0);
    }
    await expect(nav.downloadExcel).toBeDisabled();
    await nav.go("logic-atlas");
    await expect(page.getByTestId("atlas-status")).toContainText("Waiting For Run Simulation");
  });

  test("switching the underlying hides the old run until Run Simulation", async ({ page, inputs, nav }) => {
    await inputs.goto("default");
    await inputs.run();
    expect((await hook(page)).result?.underlyingLabel).toBe("Sensex");

    await nav.go("inputs");
    await inputs.fill("input-underlying", "Nifty");
    await expect.poll(async () => (await hook(page)).stale).toBe(true);
    for (const tab of ["summary", "pricer", "product", "vega-hedge", "margin"] as const) {
      await nav.go(tab);
      await expect(page.getByTestId("stale-banner")).toBeVisible();
      expect(await outputTableCount(page), `${tab} shows no table from the Sensex run`).toBe(0);
    }
    await expect(nav.downloadExcel).toBeDisabled();
    await nav.go("logic-atlas");
    await expect(page.getByTestId("atlas-status")).toContainText("Waiting For Run Simulation");

    await nav.go("inputs");
    await expect(inputs.field("spot")).not.toHaveValue("", { timeout: 30_000 });
    await inputs.run();
    expect((await hook(page)).result?.underlyingLabel).toBe("Nifty");
    await expect(nav.downloadExcel).toBeEnabled();
  });
});
