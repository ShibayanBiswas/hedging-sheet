import type { Locator, Page } from "@playwright/test";

import { NavBar } from "./nav-bar";

/** Logic Atlas: section cards, the node detail, edge cases and the live debug drawer. */
export class LogicAtlasPage {
  readonly heading: Locator;
  readonly nodeDetail: Locator;
  readonly edgeCases: Locator;
  readonly debugDrawer: Locator;
  readonly debugValues: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 }).first();
    this.nodeDetail = page.getByTestId("atlas-node-detail");
    this.edgeCases = page.getByTestId("atlas-edge-cases");
    this.debugDrawer = page.getByTestId("debug-drawer");
    this.debugValues = page.getByTestId("debug-values");
  }

  async open() {
    await new NavBar(this.page).go("logic-atlas");
  }

  module(id: string): Locator {
    return this.page.getByTestId(`atlas-${id}`);
  }
}
