import { expect, type Locator, type Page } from "@playwright/test";

import { DeskDialog } from "./desk-dialog";

export type InputMode = "default" | "blank";

/** Test ids of the fields rendered as select elements. */
const SELECTS = new Set(["input-underlying", "input-optionType", "input-expiryCount", "input-hedgeExpiryIndex"]);

/** The Inputs page: mode switch, every field by `input-<key>`, Run Simulation and its validation popup. */
export class InputsPage {
  readonly dialog: DeskDialog;
  readonly heading: Locator;
  readonly modeSwitch: Locator;
  readonly modeActive: Locator;
  readonly runButton: Locator;
  readonly resetButton: Locator;

  constructor(private readonly page: Page) {
    this.dialog = new DeskDialog(page);
    this.heading = page.getByRole("heading", { level: 1, name: "Inputs" });
    this.modeSwitch = page.getByTestId("mode-switch");
    this.modeActive = page.getByTestId("mode-active");
    this.runButton = page.getByTestId("run-simulation");
    this.resetButton = page.getByTestId("reset-inputs");
  }

  field(testId: string): Locator {
    return this.page.getByTestId(testId.startsWith("input-") ? testId : `input-${testId}`);
  }

  /** Load Inputs; in Default Values mode wait for the mock close to fill the spot. */
  async goto(mode: InputMode = "default") {
    await this.page.goto("/");
    await expect(this.heading).toBeVisible();
    await expect(this.field("spot")).not.toHaveValue("", { timeout: 30_000 });
    await expect(this.field("dailyVol")).not.toHaveValue("", { timeout: 30_000 });
    if (mode === "blank") await this.setMode("blank");
  }

  async setMode(mode: InputMode) {
    await this.page.getByTestId(`mode-${mode}`).click();
    await expect(this.dialog.root).toBeVisible();
    await this.dialog.expectTitle("Switch Mode And Clear Results");
    await this.dialog.action("confirm-switch-mode");
    await expect(this.page.getByTestId(`mode-${mode}`)).toHaveAttribute("aria-selected", "true");
  }

  /** Type or select one value, then leave the field so it commits. */
  async fill(testId: string, value: string) {
    const id = testId.startsWith("input-") ? testId : `input-${testId}`;
    const el = this.page.getByTestId(id);
    if (SELECTS.has(id)) {
      await el.selectOption(value);
      return;
    }
    await el.fill(value);
    await el.blur();
  }

  async fillAll(pairs: ReadonlyArray<readonly [string, string]>) {
    for (const [id, value] of pairs) await this.fill(id, value);
  }

  async clear(testId: string) {
    const el = this.field(testId);
    await el.fill("");
    await el.blur();
  }

  /** Run the simulation and, when it succeeds, close the follow-up popups and land on Summary. */
  async run() {
    await this.runButton.click();
    await expect(this.page).toHaveURL(/\/summary$/, { timeout: 30_000 });
    await this.dialog.dismissAll();
  }

  /** Run with errors: the grouped popup opens and the page stays on Inputs. */
  async expectValidationDialog(expected: { count?: number; contains?: string[] } = {}) {
    await this.runButton.click();
    await this.dialog.expectTitle("Missing Or Invalid Inputs");
    await expect(this.dialog.groups).toBeVisible();
    if (expected.count != null) await expect(this.dialog.root).toContainText(`${expected.count} ${expected.count === 1 ? "field needs" : "fields need"} attention`);
    for (const text of expected.contains ?? []) await expect(this.dialog.groups).toContainText(text);
    await expect(this.page).toHaveURL(/\/$/);
  }
}
