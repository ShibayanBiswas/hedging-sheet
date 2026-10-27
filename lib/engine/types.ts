export type Underlying = "Nifty" | "Sensex";
export type InputMode = "workbook" | "live";
export type OptionType = "P" | "C";
export type BidOffer = "B" | "O";

export type SpreadInput = {
  /** Buy level as a fraction above the start level, 0.25 for 125 percent. */
  buy: number;
  /** Sell level as a fraction above the start level. */
  sell: number;
  /** Participation rate, 1 for 100 percent. */
  participation: number;
};

export type HedgeInputs = {
  mode: InputMode;
  underlying: Underlying;
  /** YYYY-MM-DD */
  valuationDate: string;
  /** Fetched spot. The derived spot always equals it. */
  spot: number;
  startLevelUplift: number;
  startLevelRounding: number;

  nbfcRate: number;
  premiumRate: number;
  marginGrowthRate: number;

  /** Top spread sell level as a fraction, 0.37. */
  target: number;
  /** Maximum coupon, 1.025 for 102.5 percent. */
  coupon: number;
  protection: number;
  decay: number;
  tenorDays: number;

  expiryCount: number;
  /** Month numbers counted from the valuation month. NaN marks a blank field. */
  expiryMonths: number[];
  /** Manual YYYY-MM-DD override per expiry, or null. */
  expiryOverrides: Array<string | null>;
  /** 0 Sunday … 6 Saturday. */
  expiryWeekday: number;
  /** Index into the expiry list, or null for the median. */
  hedgeExpiryIndex: number | null;

  spreads: SpreadInput[];
  /** Last spread participation is derived so the spreads tie to the coupon. */
  autoParticipation: boolean;
  /** Width of the protection outflow step, 0.01 for one percent. */
  outflowWidth: number;
  /** Decay floor strike as a fraction of start, 0.70. */
  floorLevel: number;
  /** Units bought at the floor strike. Slope below the floor is decay minus this. */
  floorUnits: number;

  notionalCr: number;
  transactionCost: number;
  issuanceCost: number;
  marginCost: number;

  dailyVol: number;
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

  /** Pricer vol bump input, added to every leg. */
  volBump: number;
  bidOffer: BidOffer;
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

export type RatePoint = { date: string; ratePercent: number; linkedToPremiumRate?: boolean };
export type DividendPoint = { date: string; amount: number };

export type PricingParams = {
  forwardSellRate: number;
  premiumRateSpread: number;
  rateCapBuyingForward: number;
  dividendBidOfferMultiplier: number;
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

export type PayoffRow = {
  performance: number;
  clientReturn: number;
  maturityValueCr: number;
  preTaxIrr: number;
  description: string;
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

export type ValidationIssue = { field: string; message: string };

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
    /** The workbook's signed vega weighting, kept for parity. */
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
  diagnostics: { solverIterations: number; loopPasses: number; loopResidual: number };
};

export type HedgingFailure = {
  ok: false;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};
