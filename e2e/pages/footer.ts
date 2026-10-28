import type { Locator, Page } from "@playwright/test";

/** Desk footer: live spots, fetch time, market status, data source and Mongo state. */
export class Footer {
  readonly root: Locator;
  readonly nifty: Locator;
  readonly sensex: Locator;
  readonly fetched: Locator;
  readonly marketStatus: Locator;
  readonly source: Locator;
  readonly mongo: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("desk-footer");
    this.nifty = page.getByTestId("footer-nifty");
    this.sensex = page.getByTestId("footer-sensex");
    this.fetched = page.getByTestId("footer-fetched");
    this.marketStatus = page.getByTestId("footer-market-status");
    this.source = page.getByTestId("footer-source");
    this.mongo = page.getByTestId("footer-mongo");
  }
}
