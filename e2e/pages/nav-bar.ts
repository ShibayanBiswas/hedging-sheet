import { expect, type Locator, type Page } from "@playwright/test";

export const TAB_IDS = ["inputs", "summary", "pricer", "product", "vega-hedge", "margin", "market-data", "logic-atlas"] as const;
export type TabId = (typeof TAB_IDS)[number];

const PATHS: Record<TabId, RegExp> = {
  inputs: /\/$/,
  summary: /\/summary$/,
  pricer: /\/pricer$/,
  product: /\/product$/,
  "vega-hedge": /\/vega-hedge$/,
  margin: /\/margin$/,
  "market-data": /\/market-data$/,
  "logic-atlas": /\/logic-atlas$/,
};

/** The top navigation and the Excel download. */
export class NavBar {
  readonly downloadExcel: Locator;
  readonly underlyingBadge: Locator;

  constructor(private readonly page: Page) {
    this.downloadExcel = page.getByTestId("download-excel");
    this.underlyingBadge = page.getByTestId("underlying-badge");
  }

  tab(id: TabId) {
    return this.page.getByTestId(`nav-${id}`);
  }

  async go(id: TabId) {
    await this.tab(id).click();
    await expect(this.page).toHaveURL(PATHS[id]);
  }
}
