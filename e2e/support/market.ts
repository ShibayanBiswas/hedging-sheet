import { expect, type APIRequestContext } from "@playwright/test";

import pricingParams from "../../tests/fixtures/pricing-params.json";
import surface from "../../tests/fixtures/surface.json";
import { E2E_DESK_KEY } from "./desk-key";

/**
 * Put the seeded surface and surface parameters back after a test that uploads or saves market data,
 * so later specs on the same mock server price against the fixtures.
 */
export async function restoreMarketFixtures(request: APIRequestContext) {
  const { monthKey, ...params } = pricingParams;
  void monthKey;
  const headers = { "x-desk-key": E2E_DESK_KEY };
  const s = await request.post("/api/surface", { data: surface, headers });
  expect(s.ok(), await s.text()).toBe(true);
  const p = await request.post("/api/params", { data: { params }, headers });
  expect(p.ok(), await p.text()).toBe(true);
}
