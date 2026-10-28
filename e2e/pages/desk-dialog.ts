import { expect, type Locator, type Page } from "@playwright/test";

/** The shared desk popup: title, grouped items, action buttons and OK. */
export class DeskDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly groups: Locator;
  readonly ok: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("desk-dialog");
    this.title = this.root.locator("#desk-dialog-title");
    this.groups = page.getByTestId("desk-dialog-groups");
    this.ok = page.getByTestId("desk-dialog-ok");
  }

  async expectTitle(title: string | RegExp) {
    await expect(this.root).toBeVisible();
    await expect(this.title).toHaveText(title);
  }

  /**
   * Close every queued popup, each waited out of the DOM so an exiting popup is never clicked.
   * `appearWithinMs` is how long to wait for the next one; edge-case popups are debounced by 900 ms.
   */
  async dismissAll(appearWithinMs = 1_500) {
    for (let i = 0; i < 6; i++) {
      try {
        await this.root.first().waitFor({ state: "visible", timeout: appearWithinMs });
      } catch {
        return;
      }
      const title = (await this.title.first().textContent()) ?? "";
      await this.ok.first().click();
      await expect(this.root.filter({ hasText: title })).toHaveCount(0);
    }
  }

  /** Run an action button by its test id and wait for the popup to leave. */
  async action(testId: string) {
    const title = (await this.title.first().textContent()) ?? "";
    await this.page.getByTestId(testId).click();
    await expect(this.root.filter({ hasText: title })).toHaveCount(0);
  }
}
