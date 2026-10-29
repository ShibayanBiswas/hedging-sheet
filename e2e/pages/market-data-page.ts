import { expect, type Locator, type Page } from "@playwright/test";

import { E2E_DESK_KEY } from "../support/desk-key";
import { NavBar } from "./nav-bar";

/** Market Data: the vol surface toolbar and grid, surface parameters and the rate curve. */
export class MarketDataPage {
  readonly heading: Locator;
  readonly volGrid: Locator;
  readonly surfaceFile: Locator;
  readonly editSurface: Locator;
  readonly discardSurface: Locator;
  readonly downloadSurface: Locator;
  readonly paramsTable: Locator;
  readonly editParams: Locator;
  readonly saveParams: Locator;
  readonly resetParams: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Market Data" });
    this.volGrid = page.getByTestId("vol-grid");
    this.surfaceFile = page.getByTestId("surface-file");
    this.editSurface = page.getByTestId("edit-surface");
    this.discardSurface = page.getByTestId("discard-surface");
    this.downloadSurface = page.getByTestId("download-surface");
    this.paramsTable = page.getByTestId("surface-params-table");
    this.editParams = page.getByTestId("edit-params");
    this.saveParams = page.getByTestId("save-params");
    this.resetParams = page.getByTestId("reset-params");
  }

  async open() {
    await new NavBar(this.page).go("market-data");
    await expect(this.heading).toBeVisible();
  }

  volCell(index: number): Locator {
    return this.page.locator('[data-testid^="vol-cell-"]').nth(index);
  }

  param(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** The first save of a page load asks for the Desk Key. */
  async enterDeskKey(key = E2E_DESK_KEY) {
    const dialog = this.page.getByTestId("desk-key-dialog");
    await expect(dialog).toBeVisible();
    await this.page.getByTestId("desk-key-input").fill(key);
    await this.page.getByTestId("desk-key-submit").click();
    await expect(dialog).toBeHidden();
  }
}
