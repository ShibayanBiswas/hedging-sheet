import type { Locator, Page } from "@playwright/test";

import { NavBar } from "./nav-bar";

/** Logic Atlas: the status chip and its three sections, Flows, Insights and Outputs. */
export class LogicAtlasPage {
  readonly heading: Locator;
  readonly status: Locator;
  readonly flows: Locator;
  readonly insights: Locator;
  readonly outputs: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 }).first();
    this.status = page.getByTestId("atlas-status");
    this.flows = page.getByTestId("atlas-section-flows");
    this.insights = page.getByTestId("atlas-section-insights");
    this.outputs = page.getByTestId("atlas-section-outputs");
  }

  async open() {
    await new NavBar(this.page).go("logic-atlas");
  }

  stage(id: string): Locator {
    return this.page.getByTestId(`stage-${id}`);
  }
}
