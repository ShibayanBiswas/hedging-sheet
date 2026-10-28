import { expect, type Locator, type Page } from "@playwright/test";

import { NavBar, type TabId } from "./nav-bar";

/** A results tab behind the run gate. */
class OutputPage {
  readonly heading: Locator;
  readonly gate: Locator;
  readonly staleBanner: Locator;
  private readonly nav: NavBar;

  constructor(
    protected readonly page: Page,
    readonly id: TabId,
    readonly title: string,
  ) {
    this.nav = new NavBar(page);
    this.heading = page.getByRole("heading", { level: 1, name: title });
    this.gate = page.getByTestId("run-gate");
    this.staleBanner = page.getByTestId("stale-banner");
  }

  async open() {
    await this.nav.go(this.id);
  }

  table(id: string): Locator {
    return this.page.getByTestId(`table-${id}`);
  }

  async expectGate() {
    await expect(this.gate).toBeVisible();
    await expect(this.page.getByText("Run The Simulation To See Results")).toBeVisible();
  }

  async expectResults() {
    await expect(this.heading).toBeVisible();
    await expect(this.gate).toHaveCount(0);
  }
}

class SummaryPage extends OutputPage {
  constructor(page: Page) {
    super(page, "summary", "Summary Sheet");
  }
}

class PricerPage extends OutputPage {
  readonly resetLegVols: Locator;
  constructor(page: Page) {
    super(page, "pricer", "Pricer");
    this.resetLegVols = page.getByTestId("reset-leg-vols");
  }
  gridCell(index = 0): Locator {
    return this.page.locator('[data-testid^="grid-edit-"]').nth(index);
  }
}

class ProductPage extends OutputPage {
  readonly payoffMove: Locator;
  readonly payoffReturn: Locator;
  constructor(page: Page) {
    super(page, "product", "Product Description");
    this.payoffMove = page.getByTestId("payoff-move");
    this.payoffReturn = page.getByTestId("payoff-return");
  }
}

class VegaHedgePage extends OutputPage {
  readonly hedgeVolOverride: Locator;
  constructor(page: Page) {
    super(page, "vega-hedge", "Day 1 Vega Hedge");
    this.hedgeVolOverride = page.getByTestId("hedge-vol-override");
  }
}

class MarginPage extends OutputPage {
  constructor(page: Page) {
    super(page, "margin", "Mark To Market And Margin Requirement");
  }
}

export function outputPages(page: Page) {
  return {
    summary: new SummaryPage(page),
    pricer: new PricerPage(page),
    product: new ProductPage(page),
    vegaHedge: new VegaHedgePage(page),
    margin: new MarginPage(page),
  };
}
