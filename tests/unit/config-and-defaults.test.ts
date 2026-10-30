import { describe, expect, it } from "vitest";

import { resolveDbName, resolveMongoConfig } from "@/lib/db/config";
import { defaultInputs, normalizePricingParams, seedPricingParams } from "@/lib/engine/defaults";
import { defaultRateCurve } from "@/lib/engine/rates";

describe("database name", () => {
  it("a preview gets its own database, even when MONGODB_DB names production", () => {
    expect(resolveDbName({ VERCEL_ENV: "preview", MONGODB_DB: "hedging_sheet" })).toBe("hedging_sheet_preview");
    expect(resolveDbName({ VERCEL_ENV: "preview", MONGODB_DB: "desk_preview" })).toBe("desk_preview");
  });

  it("production uses the named database, or the production name", () => {
    expect(resolveDbName({ VERCEL_ENV: "production" })).toBe("hedging_sheet");
    expect(resolveDbName({ MONGODB_DB: "other" })).toBe("other");
  });
});

describe("connection from parts", () => {
  it("is null with neither a URI nor a host", () => {
    expect(resolveMongoConfig({})).toBeNull();
  });

  it("builds a plain URI with a port, no credentials and no TLS", () => {
    expect(resolveMongoConfig({ MONGODB_HOST: "db.local", MONGODB_PORT: "27018", NODE_ENV: "production" })).toEqual({
      uri: "mongodb://db.local:27018/hedging_sheet?retryWrites=true&w=majority",
      dbName: "hedging_sheet",
    });
  });

  it("builds an SRV URI with escaped credentials, the auth source and TLS, and ignores the port", () => {
    const config = resolveMongoConfig({
      MONGODB_HOST: "cluster0.abc.mongodb.net",
      MONGODB_PORT: "27017",
      MONGODB_USER: "desk user",
      MONGODB_PASSWORD: "p@ss",
      MONGODB_AUTH_SOURCE: "admin",
      MONGODB_TLS: "true",
      NODE_ENV: "production",
    })!;
    expect(config.uri).toBe("mongodb+srv://desk%20user:p%40ss@cluster0.abc.mongodb.net/hedging_sheet?retryWrites=true&w=majority&authSource=admin&tls=true");
  });

  it("a user with no password is sent with an empty password", () => {
    expect(resolveMongoConfig({ MONGODB_HOST: "db.local", MONGODB_USER: "desk", MONGODB_SRV: "true", NODE_ENV: "production" })!.uri).toMatch(/^mongodb\+srv:\/\/desk:@db\.local\//);
  });
});

describe("surface parameters from storage", () => {
  it("fill every missing value from the seed and read an unknown side as Bid", () => {
    const seed = seedPricingParams();
    const p = normalizePricingParams({ bidOffer: "X" as never });
    expect(p).toMatchObject({
      forwardSellRate: seed.forwardSellRate,
      premiumRateSpread: seed.premiumRateSpread,
      rateCapBuyingForward: seed.rateCapBuyingForward,
      dividendBidOfferMultiplier: seed.dividendBidOfferMultiplier,
      bidOffer: "B",
      dividends: seed.dividends,
    });
  });

  it("replace an old dated curve with the default tenor curve, and keep a tenor curve as it is", () => {
    const dated = [{ date: "2027-01-01", rate: 0.07 }] as unknown[];
    expect(normalizePricingParams({ rateCurve: dated as never }).rateCurve).toEqual(defaultRateCurve());
    const curve = [{ years: 1, ratePercent: 7, linkedToPremiumRate: false }];
    expect(normalizePricingParams({ rateCurve: curve, bidOffer: "O", forwardSellRate: 0.06 })).toMatchObject({ rateCurve: curve, bidOffer: "O", forwardSellRate: 0.06 });
  });
});

describe("default inputs", () => {
  it("start from today when no valuation date is given", () => {
    expect(defaultInputs().valuationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
