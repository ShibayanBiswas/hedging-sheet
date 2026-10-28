import { test as base, expect } from "@playwright/test";

import { DeskDialog, Footer, InputsPage, LogicAtlasPage, MarketDataPage, NavBar, outputPages } from "./pages";

/** 28-Oct-2026 10:00 IST, the same instant the mock server uses for TEST_NOW. */
export const FROZEN_NOW = "2026-10-28T04:30:00.000Z";

type DeskFixtures = {
  consoleErrors: string[];
  inputs: InputsPage;
  dialog: DeskDialog;
  nav: NavBar;
  footer: Footer;
  outputs: ReturnType<typeof outputPages>;
  marketData: MarketDataPage;
  atlas: LogicAtlasPage;
};

/** Every spec gets a frozen browser clock, so dates, the market status and the footer clock are fixed. */
export const test = base.extend<DeskFixtures>({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(FROZEN_NOW));
    await use(page);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !/Download the React DevTools/.test(msg.text())) errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await use(errors);
  },
  dialog: async ({ page }, use) => use(new DeskDialog(page)),
  nav: async ({ page }, use) => use(new NavBar(page)),
  footer: async ({ page }, use) => use(new Footer(page)),
  inputs: async ({ page }, use) => use(new InputsPage(page)),
  outputs: async ({ page }, use) => use(outputPages(page)),
  marketData: async ({ page }, use) => use(new MarketDataPage(page)),
  atlas: async ({ page }, use) => use(new LogicAtlasPage(page)),
});

export { expect };
