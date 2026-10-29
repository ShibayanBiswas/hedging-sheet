export type Underlying = "Nifty" | "Sensex";
export type OptionType = "P" | "C";
export type BidOffer = "B" | "O";
type DailyVolSource = "calculated" | "overridden" | "fallback";

export type SpreadInput = {
  /** Buy level as a fraction above the start level, 0.25 for 125 percent. */
  buy: number;
  /** Sell level as a fraction above the start level. */
  sell: number;
  /** Participation rate, 1 for 100 percent. */
  participation: number;
  /** A put spread pays its payout in cash and is built from puts; a call spread is built from calls alone. */
  optionType: OptionType;
};

export type HedgeInputs = {
  underlying: Underlying;
  /** YYYY-MM-DD, today in IST by default. */
  valuationDate: string;
  /** Fetched spot. The derived spot always equals it. NaN until the close arrives. */
  spot: number;
  startLevelUplift: number;
  startLevelRounding: number;

  nbfcRate: number;
  premiumRate: number;
  marginGrowthRate: number;

  /** Maximum coupon, 1.025 for 102.5 percent. */
  coupon: number;
  decay: number;
  tenorDays: number;

  /**
   * Strikes as percent of start, highest first. The first nSpreads + 1 are the spread levels,
   * then the protection strike, the protection outflow step and the decay floor.
   */
  strikePercents: number[];
  /** One per spread, bottom spread first. Null is derived: 1 below the top, coupon-derived at the top. */
  participations: Array<number | null>;
  /** Units bought at the floor strike. Slope below the floor is decay minus this. */
  floorUnits: number;
  /** One per spread, bottom spread first. The protection, outflow and floor legs are always puts. */
  spreadOptionTypes: OptionType[];

  expiryCount: number;
  /** Month numbers. NaN marks a blank field. */
  expiryMonths: number[];
  /** Index into the expiry list, or null for the median. */
  hedgeExpiryIndex: number | null;

  notionalCr: number;
  transactionCost: number;
  issuanceCost: number;
  marginCost: number;

  dailyVol: number;
  dailyVolSource: DailyVolSource;
  historyWindowDays: number;
  exposureMargin: number;
  futuresMargin: number;
  hedgeStrike: number;
  hedgeStrikeAuto: boolean;

  exchangeForwardRate: number;
  exchangeDiscountRate: number;
  stressedForwardRate: number;
  stressedDiscountRate: number;
  stressSigmas: number;
  stressDays: number;
  stressVolMultiplier: number;

  /** Per-leg volatility overrides keyed "block-expiry", as a decimal. */
  legVolOverrides: Record<string, number>;
  /** Day 1 hedge fair volatility override, as a decimal. */
  hedgeVolOverride: number | null;
};

export type PricingParamPoint = {
  date: string;
  volBump: number;
  fwdSellRate: number;
  incMargin?: number;
  fullMargin?: number;
  marginCost?: number;
};

export type VolSurface = {
  monthKey: string;
  label: string;
  deepStrike: number;
  moneyness: number[];
  strikes: number[];
  expiries: string[];
  /** Percent points, 13.39 means 13.39 percent. First column is the Deep strike. */
  volsPercent: number[][];
  pricingParams: PricingParamPoint[];
  /** Nifty 100 percent anchor. */
  referenceUnderlyingPrice?: number;
  /** Sensex 100 percent anchor. */
  referenceSensexPrice?: number;
  niftyAnchorAsOf?: string;
};

/** A rate curve point, anchored at the valuation date: its date is the valuation date plus this tenor. */
export type RatePoint = { years: number; ratePercent: number; linkedToPremiumRate?: boolean };
export type DividendPoint = { date: string; amount: number };

export type PricingParams = {
  forwardSellRate: number;
  premiumRateSpread: number;
  rateCapBuyingForward: number;
  dividendBidOfferMultiplier: number;
  /** Pricer Bid or Offer row. */
  bidOffer: BidOffer;
  rateCurve: RatePoint[];
  dividends: DividendPoint[];
};

export type MarketData = {
  surface: VolSurface;
  params: PricingParams;
};

/** One priced option: a Pricer column or a Day 1 Vega Hedge row. */
export type OptionPricing = {
  valuationDate: string;
  spot: number;
  strike: number;
  maturity: string;
  optionType: OptionType;
  days: number;
  upperMaturity: string | null;
  lowerMaturity: string | null;
  upperForward: number | null;
  lowerForward: number | null;
  forwardGrowth: number;
  discountYield: number;
  dividends: number;
  forward: number;
  volatility: number;
  /** True when the volatility is a user override instead of the surface lookup. */
  volOverridden: boolean;
  volBump: number;
  bidOffer: BidOffer;
  price: number;
  pricePercent: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
};

export type StrikeRole = "spread" | "protection" | "outflow" | "floor";

export type StrikeSlot = {
  /** Strike as percent of start, 137. */
  percent: number;
  /** Rupee strike, ROUND(start × percent / 100). */
  strike: number;
  roles: StrikeRole[];
  units: number;
  /** A strike shared by a put spread and a call spread carries one leg of each type. */
  optionType: OptionType;
};

export type PricerLeg = OptionPricing & {
  strikePercent: number;
  blockIndex: number;
  expiryIndex: number;
  units: number;
  action: "Buy" | "Sell";
  contracts: number;
  optionValue: number;
  deltaInr: number;
  deltaContracts: number;
  gammaContracts: number;
  thetaInr: number;
  vegaInr: number;
  rhoInr: number;
  incrementalMargin: number | null;
  incrementalMarginCost: number | null;
  incrementalCostInr: number | null;
  incrementalAdjustedPrice: number | null;
  fullMargin: number | null;
  fullMarginCost: number | null;
  fullCostInr: number | null;
  fullAdjustedPrice: number | null;
};

export type HedgeRow = OptionPricing & {
  move: number;
  contracts: number;
  vegaInr: number;
  deltaContracts: number;
  optionValue: number;
  deltaInr: number;
  gammaContracts: number;
  thetaInr: number;
  rhoInr: number;
};

export type HedgeMarginRow = {
  level: number;
  move: number;
  strike: number;
  expiry: string;
  quantity: number;
  dayOneFairPrice: number;
  premiumCr: number;
  exchangePrice: number;
  stressedPrice: number;
  fairPrice: number;
  initialMarginCr: number;
  exposureMarginCr: number;
  totalMarginCr: number;
};

export type MarginRow = {
  level: number;
  move: number;
  productRequirementLakh: number;
  optionDeltaLakh: number;
  residualFuturesLakh: number;
  futuresMarginCr: number;
  markToMarketCr: number;
  optionsMarginCr: number;
  totalRequirementCr: number;
  deltaChangeLakh: number;
  stepMarkToMarketCr: number;
  totalRequirementPercent: number;
};

type PayoffRow = {
  performance: number;
  clientReturn: number;
  maturityValueCr: number;
  preTaxIrr: number;
};

export type SummaryLeg = {
  strikePercent: number;
  strike: number;
  optionType: OptionType;
  units: number;
  quantityLakh: number;
  averagePrice: number;
  premiumCr: number;
};

export type ValidationIssue = {
  field: string;
  message: string;
  /** Stable code for the edge-case popups. */
  code?: string;
  /** A suggested fix shown in the popup. */
  fix?: string;
};

export type HedgingResult = {
  ok: true;
  inputs: HedgeInputs;
  underlyingLabel: Underlying;
  warnings: ValidationIssue[];
  schedule: { expiries: string[]; hedgeExpiry: string; maturityDate: string };
  structure: { startLevel: number; strikes: StrikeSlot[]; spreadParticipations: number[]; maxCoupon: number };
  pricer: {
    header: {
      startLevel: number;
      coupon: number;
      expiry: string;
      mobilisation: number;
      actualInbuilt: number;
      productCost: number;
      inbuiltInr: number;
      transactionCostInr: number;
      nbfcAmount: number;
      premium: number;
      nbfcRate: number;
      premiumRate: number;
      tenorDays: number;
      payout: number;
      achievedCoupon: number;
      delta: number;
      vega: number;
      rho: number;
      gamma: number;
      irr: number;
      margin: number;
      deltaLakh: number;
      spreadPayouts: number[];
      /** The put spreads' payouts, paid in cash at maturity; call spreads pay through their options. */
      upsideCash: number;
      protectionLoss: number;
    };
    legs: PricerLeg[];
    halves: number;
  };
  summary: {
    actualInbuilt: number;
    irr: number;
    margin: number;
    optionExpiry: string;
    deltaContracts: number;
    deltaPercent: number;
    /** Signed vega weighting, as Summary G15 computes it. */
    vegaWeightedVol: number;
    /** Weighted by the size of each leg's vega, so long and short legs do not cancel. */
    absVegaWeightedVol: number;
    vegaCr: number;
    rhoWeightedForward: number;
    rhoCr: number;
    legs: SummaryLeg[];
    totalPremiumCr: number;
    hedgeStrike: number;
    hedgeExpiry: string;
    hedgeQuantityLakh: number;
    hedgePrice: number;
    hedgePremiumCr: number;
    hedgeDelta: number;
    annualVol: number;
  };
  productDescription: {
    title: string;
    initialInvestment: number;
    inbuiltCr: number;
    issuanceCostCr: number;
    transactionCostCr: number;
    marginCr: number;
    nbfcCr: number;
    premiumCr: number;
    tenorDays: number;
    nbfcRate: number;
    finalNbfcCr: number;
    premiumRate: number;
    finalPremiumCr: number;
    marginRate: number;
    finalMarginCr: number;
    maturityCr: number;
    irr: number;
    weightedCompRate: number;
    weightedHalfYearlyRate: number;
    weightedQuarterlyRate: number;
    greeks: {
      deltaPercent: number;
      totalDelta: number;
      hedgeQuantity: number;
      hedgePremiumCr: number;
      optionsDelta: number;
      residualFutures: number;
      vegaWeightedVol: number;
      vegaCr: number;
      rhoWeightedForward: number;
      rhoCr: number;
      leverage: number;
      targetLevel: number;
    };
    payoff: PayoffRow[];
  };
  dayOneVegaHedge: {
    quantity: number;
    margin: HedgeMarginRow[];
    fair: HedgeRow[];
    exchange: HedgeRow[];
    stressed: HedgeRow[];
  };
  markToMarket: { rows: MarginRow[]; zeroRow: MarginRow; worstCase: MarginRow };
  diagnostics: {
    solverIterations: number;
    /** Every goal seek evaluation of the last margin loop pass: the Inbuilt tried and the coupon residual. */
    solverTrace: Array<{ inbuilt: number; residual: number }>;
    /** Achieved coupon less the target coupon after the goal seek. */
    goalSeekResidual: number;
    /** The rate curve as dated points from the valuation date, as every leg reads it. */
    curvePoints: Array<{ date: string; rate: number }>;
    loopPasses: number;
    loopResidual: number;
    /** The Pricer spot bump after the stress loop. Always 0: the loop resets it. */
    spotBumpAfterStress: number;
    /** Largest gap between the client payoff and the option book across every kink. */
    payoffBookGap: number;
  };
};

export type HedgingFailure = {
  ok: false;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};
