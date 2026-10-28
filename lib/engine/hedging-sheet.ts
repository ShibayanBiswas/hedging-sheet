import { bsGreeks } from "@/lib/engine/black-scholes";
import { daysBetween, formatDate, parseYmd } from "@/lib/engine/dates";
import { checkInputShape } from "@/lib/engine/input-schema";
import { anchoredCurve, dividendYield, pricerDiscountYield, readRateCurve } from "@/lib/engine/rates";
import { maturityDate, medianExpiryIndex, validateSchedule } from "@/lib/engine/schedule";
import { brentSolve } from "@/lib/engine/solver";
import {
  buildStrikes,
  clientReturn,
  deriveTerms,
  payoffBookGap,
  payoffDescription,
  payoffLevels,
  preTaxIrr,
  startLevel,
  validateStructure,
} from "@/lib/engine/structure";
import type {
  BidOffer,
  HedgeInputs,
  HedgeMarginRow,
  HedgeRow,
  HedgingFailure,
  HedgingResult,
  MarginRow,
  MarketData,
  OptionPricing,
  OptionType,
  PricerLeg,
  SummaryLeg,
  ValidationIssue,
} from "@/lib/engine/types";
import {
  forwardSellRateForMonth,
  interpolateVolPercent,
  lookupFwdSellRate,
  lookupVolBump,
  pricingParamOnOrBefore,
  referenceSensexPrice,
  referenceUnderlyingPrice,
} from "@/lib/engine/vol-surface";

export const CRORE = 1e7;
export const LAKH = 1e5;
/** The Pricer keeps two identical halves of the leg grid, B:AW and AX:CS. */
export const HALVES = 2;
/** MTM & Margin req D6:D20 and the Day 1 Vega Hedge moves: −50 to +20 percent in 5 percent steps. */
export const SCENARIO_MOVES = [-0.5, -0.45, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];

// Summary I26 = I25 × √365
export function annualVolFromDaily(daily: number): number {
  return daily * Math.sqrt(365);
}

export function dailyVolFromAnnual(annual: number): number {
  return annual / Math.sqrt(365);
}

export function legKey(blockIndex: number, expiryIndex: number): string {
  return `${blockIndex}-${expiryIndex}`;
}

type PriceRequest = {
  valuationDate: string;
  spot: number;
  strike: number;
  maturity: string;
  optionType: OptionType;
  bidOffer: BidOffer;
  growth: number;
  discount: number;
  vol: number;
  volOverridden: boolean;
  volBump: number;
  dividends: number;
  curve: ReturnType<typeof readRateCurve>;
};

function priceOption(req: PriceRequest): OptionPricing {
  // Pricer B20 − B26: days to maturity.
  const days = daysBetween(req.valuationDate, req.maturity);
  // Pricer rows 35 and 49 to 53: price and bump-and-reprice Greeks.
  const g = bsGreeks({
    spot: req.spot,
    strike: req.strike,
    days,
    growth: req.growth,
    discount: req.discount,
    vol: req.vol,
    type: req.optionType,
  });
  return {
    valuationDate: req.valuationDate,
    spot: req.spot,
    strike: req.strike,
    maturity: req.maturity,
    optionType: req.optionType,
    days,
    upperMaturity: req.curve.upperMaturity,
    lowerMaturity: req.curve.lowerMaturity,
    upperForward: req.curve.upperForward,
    lowerForward: req.curve.lowerForward,
    forwardGrowth: req.growth,
    discountYield: req.discount,
    dividends: req.dividends,
    // Pricer B31 = EXP(B28 × (B20 − B26) ÷ 365) × B27
    forward: Math.exp((req.growth * days) / 365) * req.spot,
    volatility: req.vol,
    volOverridden: req.volOverridden,
    volBump: req.volBump,
    bidOffer: req.bidOffer,
    price: g.price,
    // Pricer B36 = B35 ÷ B27
    pricePercent: g.price / req.spot,
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta,
    vega: g.vega,
    rho: g.rho,
  };
}

/** Dividend points are Sensex index points; Nifty scales them by the ratio of the two anchors. */
function dividendScale(inputs: HedgeInputs, market: MarketData): number {
  if (inputs.underlying === "Sensex") return 1;
  const nifty = referenceUnderlyingPrice(market.surface, inputs.spot);
  const sensex = referenceSensexPrice(market.surface);
  return nifty > 0 && sensex > 0 ? nifty / sensex : 1;
}

// Pricer B30 bid or offer factor: IF(P, IF(O, 'Pricing Params'!M2, 1), IF(O, 1, M2))
function dividendMultiplier(type: OptionType, bidOffer: BidOffer, multiplier: number): number {
  if (type === "P") return bidOffer === "O" ? multiplier : 1;
  return bidOffer === "O" ? 1 : multiplier;
}

// Day1 Vega Hedge O26 = IF(B, IF(P, MAX(P26 − R26, fwd sell), MIN(fwd sell − 0.5%, P26 − R26)), …)
function hedgeGrowth(type: OptionType, bidOffer: BidOffer, discount: number, dividends: number, fwdSell: number): number {
  const net = discount - dividends;
  if (bidOffer === "B") return type === "P" ? Math.max(net, fwdSell) : Math.min(fwdSell - 0.005, net);
  return type === "P" ? Math.min(fwdSell - 0.005, net) : Math.max(net, fwdSell);
}

export function validateInputs(
  inputs: HedgeInputs,
  market?: MarketData,
): { errors: ValidationIssue[]; warnings: ValidationIssue[]; dates: string[] } {
  const warnings: ValidationIssue[] = [];
  const shape = checkInputShape(inputs);
  if (shape.length) return { errors: shape, warnings, dates: [] };
  const errors: ValidationIssue[] = [];
  const positive: Array<[keyof HedgeInputs, string, string]> = [
    ["spot", "Spot", "Click Refresh From Yahoo or type the spot."],
    ["notionalCr", "Notional in Crore", "Enter the notional, such as 100."],
    ["coupon", "Coupon", "Enter the maximum coupon, such as 102.5 percent."],
    ["dailyVol", "Daily Volatility", "Compute it from history or type it."],
    ["hedgeStrike", "Hedge Strike", "Turn on Auto From Spot or type the strike."],
    ["decay", "Decay", "Enter the downside participation, such as 1.6."],
  ];
  for (const [key, label, fix] of positive) {
    const v = inputs[key] as number;
    if (!(typeof v === "number" && Number.isFinite(v) && v > 0)) {
      errors.push({ field: key, code: `${key}-positive`, message: `${label} must be above zero.`, fix });
    }
  }
  const schedule = validateSchedule(inputs);
  errors.push(...schedule.errors);
  errors.push(...validateStructure(inputs));

  const lastSurface = market?.surface.expiries[market.surface.expiries.length - 1];
  if (lastSurface) {
    const beyond = schedule.dates.filter((d) => parseYmd(d).getTime() > parseYmd(lastSurface).getTime());
    if (beyond.length) {
      warnings.push({
        field: "expiryMonths",
        code: "expiry-surface",
        message: `${beyond.length} expiry ${beyond.length === 1 ? "date falls" : "dates fall"} after the last surface row on ${formatDate(lastSurface)}. Their volatility is read from that last row.`,
        fix: "Upload a surface with longer expiries, or lower the month numbers.",
      });
    }
  }
  const terms = deriveTerms(inputs);
  const reach = terms.spreads.reduce((a, s) => a + (s.sell - s.buy) * s.participation, 0);
  if (Number.isFinite(reach) && reach > inputs.coupon + 1e-9) {
    warnings.push({
      field: "spreads",
      code: "coupon-capped",
      message: `The spreads pay up to ${(reach * 100).toFixed(2)} percent; the payoff is capped at the Coupon of ${(inputs.coupon * 100).toFixed(2)} percent.`,
    });
  }
  return { errors, warnings, dates: schedule.dates };
}

export function computeHedgingSheet(inputs: HedgeInputs, market: MarketData): HedgingResult | HedgingFailure {
  const { errors, warnings, dates } = validateInputs(inputs, market);
  if (errors.length) return { ok: false, errors, warnings };

  const { surface, params } = market;
  const bidOffer: BidOffer = params.bidOffer ?? "B";
  const optionType = inputs.optionType;
  const terms = deriveTerms(inputs);
  const start = startLevel(inputs);
  const strikes = buildStrikes(inputs, start);
  const underlying = inputs.underlying;
  // Pricer E5 = Summary C15 × 1e7
  const notional = inputs.notionalCr * CRORE;
  const nLive = dates.length;
  const hedgeIdx =
    inputs.hedgeExpiryIndex != null && inputs.hedgeExpiryIndex >= 0 && inputs.hedgeExpiryIndex < nLive
      ? inputs.hedgeExpiryIndex
      : medianExpiryIndex(nLive);
  const hedgeExpiry = dates[hedgeIdx]!;
  const divScale = dividendScale(inputs, market);
  const premiumRate = inputs.premiumRate;
  const longest = dates[dates.length - 1]!;
  const curvePoints = anchoredCurve(params.rateCurve, inputs.valuationDate, premiumRate, longest);
  // Pricer B28 = 'Pricing Params'!H69: the Forward Sell Rate of the valuation month, one value for every leg.
  const pricerGrowth = forwardSellRateForMonth(surface.pricingParams, inputs.valuationDate);

  // ------------------------------------------------------------ Pricer legs
  type LegSetup = { slotIndex: number; expiryIndex: number; maturity: string; vol: number; overridden: boolean };
  const setups: LegSetup[] = [];
  strikes.forEach((slot, blockIndex) => {
    dates.forEach((maturity, expiryIndex) => {
      const override = inputs.legVolOverrides[legKey(blockIndex, expiryIndex)];
      // Pricer B32: bilinear lookup on the surface, then + B33 vol bump.
      const surfaceVol = interpolateVolPercent(surface, slot.strike, maturity, underlying, inputs.spot) / 100 + inputs.volBump;
      const overridden = typeof override === "number" && Number.isFinite(override);
      setups.push({ slotIndex: blockIndex, expiryIndex, maturity, vol: overridden ? override : surfaceVol, overridden });
    });
  });

  /** Prices every leg with the Pricer spot bump J7 applied: B27 = B2 × (1 + J7). */
  const priceBook = (spotBump: number): PricerLeg[] =>
    setups.map(({ slotIndex, expiryIndex, maturity, vol, overridden }) => {
      const slot = strikes[slotIndex]!;
      const spot = inputs.spot * (1 + spotBump);
      const curve = readRateCurve(curvePoints, maturity);
      const discount = pricerDiscountYield(curve.rate, optionType, bidOffer, params, premiumRate);
      const dividends = dividendYield(
        params.dividends,
        maturity,
        inputs.valuationDate,
        spot,
        divScale,
        dividendMultiplier(optionType, bidOffer, params.dividendBidOfferMultiplier),
      );
      const priced = priceOption({
        valuationDate: inputs.valuationDate,
        spot,
        strike: slot.strike,
        maturity,
        optionType,
        bidOffer,
        growth: pricerGrowth,
        discount,
        vol,
        volOverridden: overridden,
        volBump: inputs.volBump,
        dividends,
        curve,
      });
      // Pricer B55 = B47 × E5 ÷ B5 ÷ (2 × COUNTIF(B25:I25, "P"))
      const contracts = (slot.units * notional) / start / (HALVES * nLive);
      const pp = pricingParamOnOrBefore(surface.pricingParams, maturity);
      const t = priced.days / 365;
      // Pricer B38 = IF(B34 = "B", 0, VLOOKUP(Inc. Margin)); B39, B43, B44 from 'Pricing Params'.
      const incMargin = bidOffer === "B" ? 0 : (pp?.incMargin ?? null);
      const marginCost = pp?.marginCost ?? null;
      const fullMargin = pp?.fullMargin ?? null;
      // Pricer B40 = B38 × B27 × B39 × T; B45 = B43 × B27 × B44 × T
      const incCost = incMargin != null && marginCost != null ? incMargin * spot * marginCost * t : null;
      const fullCost = fullMargin != null && marginCost != null ? fullMargin * spot * marginCost * t : null;
      return {
        ...priced,
        strikePercent: slot.percent,
        blockIndex: slotIndex,
        expiryIndex,
        units: slot.units,
        // Pricer B48 = IF(B55 < 0, "Sell", "Buy")
        action: contracts < 0 ? "Sell" : "Buy",
        contracts,
        // Pricer rows 56 to 62
        optionValue: contracts * priced.price * -1,
        deltaInr: priced.delta * priced.spot * contracts,
        deltaContracts: contracts * priced.delta,
        gammaContracts: contracts * priced.gamma,
        thetaInr: priced.theta * contracts,
        vegaInr: contracts * priced.vega,
        rhoInr: priced.rho * contracts,
        incrementalMargin: incMargin,
        incrementalMarginCost: marginCost,
        incrementalCostInr: incCost,
        // Pricer B41 = B35 + B40; B46 = B35 + B45
        incrementalAdjustedPrice: incCost != null ? priced.price + incCost : null,
        fullMargin,
        fullMarginCost: marginCost,
        fullCostInr: fullCost,
        fullAdjustedPrice: fullCost != null ? priced.price + fullCost : null,
      };
    });

  // Pricer J7 "Switch": the spot bump, 0 for the book itself.
  let spotBump = 0;
  const legs = priceBook(spotBump);
  const sumLegs = (book: PricerLeg[], pick: (l: PricerLeg) => number) => HALVES * book.reduce((acc, l) => acc + pick(l), 0);
  const sum = (pick: (l: PricerLeg) => number) => sumLegs(legs, pick);
  // Pricer K5, Q5, R5, S5, T5
  const premium = sum((l) => l.optionValue);
  const bookDelta = sum((l) => l.deltaContracts);
  const bookVega = sum((l) => l.vegaInr);
  const bookRho = sum((l) => l.rhoInr);
  const bookGamma = sum((l) => l.gammaContracts);
  // Summary G15 = SUMPRODUCT(B32:CS32, B61:CS61) ÷ SUM(B61:CS61)
  const vegaWeightedVol = bookVega !== 0 ? sum((l) => l.volatility * l.vegaInr) / bookVega : NaN;
  const grossVega = sum((l) => Math.abs(l.vegaInr));
  const absVegaWeightedVol = grossVega !== 0 ? sum((l) => l.volatility * Math.abs(l.vegaInr)) / grossVega : NaN;
  // Summary I15 = SUMPRODUCT(B28:CS28, B62:CS62) ÷ SUM(B62:CS62)
  const rhoWeightedForward = bookRho !== 0 ? sum((l) => l.forwardGrowth * l.rhoInr) / bookRho : NaN;

  // ------------------------------------------------------------ Day 1 Vega Hedge
  const annualVol = annualVolFromDaily(inputs.dailyVol);
  const hedgeBidOffer: BidOffer = "B";
  const hedgeCurve = readRateCurve(curvePoints, hedgeExpiry);
  // Day1 O26: VLOOKUP(F26, 'Pricing Params'!B:H, 7) and T26: VLOOKUP(F26, 'Pricing Params'!B:C, 2)
  const hedgeFwdSell = lookupFwdSellRate(surface.pricingParams, hedgeExpiry);
  const hedgeBidBump = lookupVolBump(surface.pricingParams, hedgeExpiry);
  // Day1 N26: surface lookup at the hedge strike and expiry + T26, unless overridden.
  const hedgeSurfaceVol =
    interpolateVolPercent(surface, inputs.hedgeStrike, hedgeExpiry, underlying, inputs.spot) / 100 + hedgeBidBump;
  const hedgeVolOverridden = inputs.hedgeVolOverride != null && Number.isFinite(inputs.hedgeVolOverride);
  const hedgeFairVol = hedgeVolOverridden ? inputs.hedgeVolOverride! : hedgeSurfaceVol;
  const divMult = dividendMultiplier(optionType, hedgeBidOffer, params.dividendBidOfferMultiplier);

  type Block = "fair" | "exchange" | "stressed";
  const hedgeRow = (move: number, block: Block): OptionPricing => {
    // Day1 D26 = C2 × (1 + C26); D62 = C2 × (1 + C62) × (1 − 6 × F2 × √2)
    const base = inputs.spot * (1 + move);
    const spot =
      block === "stressed" ? base * (1 - inputs.stressSigmas * inputs.dailyVol * Math.sqrt(inputs.stressDays)) : base;
    // Day1 R26: dividends at the shocked spot.
    const dividends = dividendYield(params.dividends, hedgeExpiry, inputs.valuationDate, spot, divScale, divMult);
    let vol: number;
    let growth: number;
    let discount: number;
    if (block === "fair") {
      vol = hedgeFairVol;
      // Day1 P26 = FORECAST on the rate curve, no cap.
      discount = hedgeCurve.rate;
      growth = hedgeGrowth(optionType, hedgeBidOffer, discount, dividends, hedgeFwdSell);
    } else if (block === "exchange") {
      // Day1 N44 = F3, O44 = I2, P44 = I3
      vol = annualVol;
      growth = inputs.exchangeForwardRate;
      discount = inputs.exchangeDiscountRate;
    } else {
      // Day1 N62 = F3 × 1.25, O62 = L2, P62 = L3
      vol = annualVol * inputs.stressVolMultiplier;
      growth = inputs.stressedForwardRate;
      discount = inputs.stressedDiscountRate;
    }
    return priceOption({
      valuationDate: inputs.valuationDate,
      spot,
      strike: inputs.hedgeStrike,
      maturity: hedgeExpiry,
      optionType,
      bidOffer: hedgeBidOffer,
      growth,
      discount,
      vol,
      volOverridden: block === "fair" && hedgeVolOverridden,
      volBump: hedgeBidBump,
      dividends,
      curve: hedgeCurve,
    });
  };

  const fairAtZero = hedgeRow(0, "fair");
  // Day1 K26 = Summary H15 × 1e7 ÷ J36: book vega over the vega of one hedge option at 0 percent.
  const hedgeQuantity = fairAtZero.vega !== 0 ? -bookVega / fairAtZero.vega : NaN;
  const toHedgeRow = (move: number, p: OptionPricing): HedgeRow => ({
    ...p,
    move,
    contracts: hedgeQuantity,
    // Day1 L, M, Z, AA, AB, AC, AD
    vegaInr: hedgeQuantity * p.vega,
    deltaContracts: hedgeQuantity * p.delta,
    optionValue: hedgeQuantity * p.price * -1,
    deltaInr: p.delta * p.spot * hedgeQuantity,
    gammaContracts: hedgeQuantity * p.gamma,
    thetaInr: p.theta * hedgeQuantity,
    rhoInr: p.rho * hedgeQuantity,
  });
  const fair = SCENARIO_MOVES.map((m) => toHedgeRow(m, m === 0 ? fairAtZero : hedgeRow(m, "fair")));
  const exchange = SCENARIO_MOVES.map((m) => toHedgeRow(m, hedgeRow(m, "exchange")));
  const stressed = SCENARIO_MOVES.map((m) => toHedgeRow(m, hedgeRow(m, "stressed")));

  // Day1 F8 = −K26; G8 = H36
  const soldQuantity = -hedgeQuantity;
  const dayOneFair = fairAtZero.price;
  const hedgeMargin: HedgeMarginRow[] = SCENARIO_MOVES.map((move, i) => {
    const level = fair[i]!.spot;
    const ex = exchange[i]!.price;
    const st = stressed[i]!.price;
    const fp = fair[i]!.price;
    // Day1 L8 = (J8 − I8) × F8 ÷ 1e7 + (K8 − G8) × F8 ÷ 1e7; M8 = M6 × B8 × F8 ÷ 1e7; N8 = L8 + M8
    const initial = ((st - ex) * soldQuantity) / CRORE + ((fp - dayOneFair) * soldQuantity) / CRORE;
    const exposure = (inputs.exposureMargin * level * soldQuantity) / CRORE;
    return {
      level,
      move,
      strike: inputs.hedgeStrike,
      expiry: hedgeExpiry,
      quantity: soldQuantity,
      dayOneFairPrice: dayOneFair,
      // Day1 H8 = G8 × F8 × −1 ÷ 1e7
      premiumCr: (dayOneFair * soldQuantity * -1) / CRORE,
      exchangePrice: ex,
      stressedPrice: st,
      fairPrice: fp,
      initialMarginCr: initial,
      exposureMarginCr: exposure,
      totalMarginCr: initial + exposure,
    };
  });

  // ------------------------------------------------------------ Macro MTM and the stress grid
  // The macro writes each move into Pricer J7, copies K7 = SUM(B58:CQ58) ÷ 1e5 into MTM E6:E20,
  // and never resets J7. Here the full book is repriced at each bump and the bump is reset to 0.
  const productLakh: number[] = [];
  try {
    for (const move of SCENARIO_MOVES) {
      spotBump = move;
      const shocked = move === 0 ? legs : priceBook(spotBump);
      productLakh.push(sumLegs(shocked, (l) => l.deltaContracts) / LAKH);
    }
  } finally {
    spotBump = 0;
  }

  const zeroIdx = SCENARIO_MOVES.indexOf(0);
  const base = SCENARIO_MOVES.map((move, i) => {
    // MTM C6 = $C$16 × (1 + D6)
    const level = inputs.spot * (1 + move);
    const product = productLakh[i]!;
    // MTM F6 = Day1 M26 ÷ 1e5; G6 = E6 + F6
    const option = fair[i]!.deltaContracts / LAKH;
    const residual = product + option;
    return {
      level,
      move,
      product,
      option,
      residual,
      // MTM H6 = −G6 × $H$2 × C6 × 1e5 ÷ 1e7
      futuresMargin: (-residual * inputs.futuresMargin * level * LAKH) / CRORE,
      // MTM J6 = Day1 N8
      optionsMargin: hedgeMargin[i]!.totalMarginCr,
    };
  });
  const step = base.map(() => 0);
  const cumulative = base.map(() => 0);
  // MTM P6 = G7 × (C6 − C7) × 1e5 ÷ 1e7 and I6 = I7 + P6, built outward from 0 at row 16.
  for (let i = zeroIdx - 1; i >= 0; i--) {
    step[i] = (base[i + 1]!.residual * (base[i]!.level - base[i + 1]!.level) * LAKH) / CRORE;
    cumulative[i] = cumulative[i + 1]! + step[i]!;
  }
  for (let i = zeroIdx + 1; i < base.length; i++) {
    step[i] = (base[i - 1]!.residual * (base[i]!.level - base[i - 1]!.level) * LAKH) / CRORE;
    cumulative[i] = step[i]! + cumulative[i - 1]!;
  }
  const marginRows: MarginRow[] = base.map((b, i) => {
    // MTM K6 = SUM(H6:J6)
    const total = b.futuresMargin + cumulative[i]! + b.optionsMargin;
    // MTM O6 = E6 − E7 above the 0 percent row, O16 = E16, O17 = E17 − E16 below.
    const deltaChange =
      i < zeroIdx ? b.product - base[i + 1]!.product : i === zeroIdx ? b.product : b.product - base[i - 1]!.product;
    return {
      level: b.level,
      move: b.move,
      productRequirementLakh: b.product,
      optionDeltaLakh: b.option,
      residualFuturesLakh: b.residual,
      futuresMarginCr: b.futuresMargin,
      markToMarketCr: cumulative[i]!,
      optionsMarginCr: b.optionsMargin,
      totalRequirementCr: total,
      deltaChangeLakh: deltaChange,
      stepMarkToMarketCr: step[i]!,
      // MTM R6 = K6 ÷ notional
      totalRequirementPercent: total / inputs.notionalCr,
    };
  });
  const zeroRow = marginRows[zeroIdx]!;
  const worstCase = marginRows.reduce((w, r) => (r.totalRequirementCr < w.totalRequirementCr ? r : w), marginRows[0]!);

  // ------------------------------------------------------------ pots, margin loop and Macro2
  // Pricer G5 = SUM(B8:B10); I5 = G5 × E5
  const costRate = inputs.transactionCost + inputs.issuanceCost + inputs.marginCost;
  const transactionCostInr = costRate * notional;
  const tenor = inputs.tenorDays;
  const nbfcGrowth = (1 + inputs.nbfcRate) ** (tenor / 365);
  const premiumGrowth = (1 + premiumRate) ** (tenor / 365);
  const marginGrowth = (1 + inputs.marginGrowthRate) ** (tenor / 365);
  // Pricer O5 = (E5 − H5 − I5 − V5)(1 + L5)^(N5/365) + K5(1 + M5)^(N5/365) + V5(1 + Summary C6)^(N5/365)
  const payoutFor = (inbuilt: number, marginInr: number) =>
    (notional - inbuilt - transactionCostInr - marginInr) * nbfcGrowth + premium * premiumGrowth + marginInr * marginGrowth;

  // Summary Q10 = MTM K16 ÷ −notional. The Inbuilt does not move it in this book.
  const marginFractionFor = (inbuiltInr: number): number => {
    void inbuiltInr;
    return -zeroRow.totalRequirementCr / inputs.notionalCr;
  };

  let inbuilt = 0;
  let marginFraction = marginFractionFor(inbuilt);
  let solverIterations = 0;
  let loopPasses = 0;
  let loopResidual = Infinity;
  for (let pass = 0; pass < 50; pass++) {
    loopPasses = pass + 1;
    // Pricer V5 = E5 × Summary Q10
    const marginInr = notional * marginFraction;
    // Macro2: GoalSeek P5 = C5 by changing H5.
    const solved = brentSolve((h) => payoutFor(h, marginInr) / notional - 1 - inputs.coupon, -notional, notional, 1e-10);
    solverIterations += solved.iterations;
    inbuilt = solved.root;
    const next = marginFractionFor(inbuilt);
    loopResidual = Math.abs(next - marginFraction);
    marginFraction = next;
    if (loopResidual < 1e-9) break;
  }
  const marginInr = notional * marginFraction;
  const payout = payoutFor(inbuilt, marginInr);
  // Pricer P5 = O5 ÷ E5 − 1; U5 = (1 + P5)^(365/N5) − 1
  const achievedCoupon = payout / notional - 1;
  const irr = (1 + achievedCoupon) ** (365 / tenor) - 1;
  // Pricer J5 = E5 − H5 − I5 − V5; F5 = H5 ÷ E5
  const nbfcAmount = notional - inbuilt - transactionCostInr - marginInr;
  const actualInbuilt = inbuilt / notional;

  // ------------------------------------------------------------ Summary leg table
  const summaryLegs: SummaryLeg[] = strikes.map((slot, b) => {
    const own = legs.filter((l) => l.blockIndex === b);
    // Summary D23 = SUMIF(row 17, key, row 55) ÷ 1e5; E23 = SUMIF(row 35) ÷ (2 × live expiries)
    const contracts = HALVES * own.reduce((acc, l) => acc + l.contracts, 0);
    const avgPrice = (HALVES * own.reduce((acc, l) => acc + l.price, 0)) / (HALVES * nLive);
    const quantityLakh = contracts / LAKH;
    return {
      strikePercent: slot.percent,
      strike: slot.strike,
      optionType,
      units: slot.units,
      quantityLakh,
      averagePrice: avgPrice,
      // Summary F23 = D23 × E23 × 1e5 ÷ 1e7 × −1
      premiumCr: ((quantityLakh * avgPrice * LAKH) / CRORE) * -1,
    };
  });
  // Summary K23 = Day1 F8 ÷ 1e5; M23 = K23 × L23 × 1e5 ÷ 1e7 × −1; M24 = Day1 I36
  const hedgeQuantityLakh = soldQuantity / LAKH;
  const hedgePremiumCr = ((hedgeQuantityLakh * dayOneFair * LAKH) / CRORE) * -1;
  const hedgeDelta = fairAtZero.delta;

  // ------------------------------------------------------------ Product Description
  const nbfcCr = nbfcAmount / CRORE;
  const marginCr = marginInr / CRORE;
  const premiumCr = premium / CRORE;
  // Product Description D43, D45, D47 and D48
  const finalNbfcCr = nbfcCr * nbfcGrowth;
  const finalPremiumCr = premiumCr * premiumGrowth;
  const finalMarginCr = marginCr * marginGrowth;
  const maturityCr = finalMarginCr + finalPremiumCr + finalNbfcCr;
  // Product Description O28 = (D36 × D42 + D35 × D46) ÷ (D36 + D35)
  const weightedCompRate = (nbfcCr * inputs.nbfcRate + marginCr * inputs.marginGrowthRate) / (nbfcCr + marginCr);
  const hedgeQty = hedgeQuantityLakh * LAKH;
  // Product Description H35 = H33 × Summary M24; H36 = H32 − H35
  const optionsDelta = hedgeQty * hedgeDelta;
  const years = Math.round(tenor / 365);
  const title = `${years} Year ${underlying} Accelerator Senior Debt For ₹${inputs.notionalCr} Crore With ${inputs.decay} Times Leverage`;

  const payoff = payoffLevels(inputs, strikes).map((performance) => {
    const value = clientReturn(inputs, performance);
    return {
      performance,
      clientReturn: value,
      maturityValueCr: inputs.notionalCr * (1 + value),
      preTaxIrr: preTaxIrr(value, tenor),
      description: payoffDescription(inputs, performance, value),
    };
  });

  // Pricer C13 = (H10 − G10) × K10; C14 = L10 × (J10 − I10)
  const spreadPayouts = terms.spreads.map((s) => (s.sell - s.buy) * s.participation);

  return {
    ok: true,
    inputs,
    underlyingLabel: underlying,
    warnings,
    schedule: { expiries: dates, hedgeExpiry, maturityDate: maturityDate(inputs) },
    structure: {
      startLevel: start,
      strikes,
      spreadParticipations: terms.spreads.map((s) => s.participation),
      maxCoupon: spreadPayouts.reduce((a, b) => a + b, 0),
    },
    pricer: {
      header: {
        startLevel: start,
        coupon: inputs.coupon,
        expiry: hedgeExpiry,
        mobilisation: notional,
        actualInbuilt,
        productCost: costRate,
        inbuiltInr: inbuilt,
        transactionCostInr,
        nbfcAmount,
        premium,
        nbfcRate: inputs.nbfcRate,
        premiumRate,
        tenorDays: tenor,
        payout,
        achievedCoupon,
        delta: bookDelta,
        vega: bookVega,
        rho: bookRho,
        gamma: bookGamma,
        irr,
        margin: marginInr,
        // Pricer K7 = SUM of every delta column ÷ 1e5, at bump 0.
        deltaLakh: bookDelta / LAKH,
        spreadPayouts,
        // Pricer E14 = E13 × E12
        protectionLoss: terms.protection * inputs.decay,
      },
      legs,
      halves: HALVES,
    },
    summary: {
      actualInbuilt,
      // Summary F10 = (1 + D10)^(365/O10) − 1
      irr: (1 + inputs.coupon) ** (365 / tenor) - 1,
      margin: marginFraction,
      optionExpiry: hedgeExpiry,
      // Summary E15 = Pricer Q5; F15 = Q5 × B2 ÷ E5
      deltaContracts: bookDelta,
      deltaPercent: (bookDelta * inputs.spot) / notional,
      vegaWeightedVol,
      absVegaWeightedVol,
      // Summary H15 = −SUM(row 61) ÷ 1e7; J15 = −SUM(row 62) ÷ 1e7
      vegaCr: (bookVega / CRORE) * -1,
      rhoWeightedForward,
      rhoCr: (bookRho / CRORE) * -1,
      legs: summaryLegs,
      // Summary F29 = SUM(F23:F28)
      totalPremiumCr: summaryLegs.reduce((acc, l) => acc + l.premiumCr, 0),
      hedgeStrike: inputs.hedgeStrike,
      hedgeExpiry,
      hedgeQuantityLakh,
      hedgePrice: dayOneFair,
      hedgePremiumCr,
      hedgeDelta,
      annualVol,
    },
    productDescription: {
      title,
      initialInvestment: inputs.notionalCr,
      // Product Description D32 = D31 × IB; D33 and D34 from Pricer B9 and B8; D35 to D37 from the Pricer.
      inbuiltCr: inputs.notionalCr * actualInbuilt,
      issuanceCostCr: inputs.notionalCr * inputs.issuanceCost,
      transactionCostCr: inputs.notionalCr * inputs.transactionCost,
      marginCr,
      nbfcCr,
      premiumCr,
      tenorDays: tenor,
      nbfcRate: inputs.nbfcRate,
      finalNbfcCr,
      premiumRate,
      finalPremiumCr,
      marginRate: inputs.marginGrowthRate,
      finalMarginCr,
      maturityCr,
      // Product Description D49 = (D48 ÷ D31)^(365/D41) − 1
      irr: (maturityCr / inputs.notionalCr) ** (365 / tenor) - 1,
      weightedCompRate,
      // Product Description P28 and Q28
      weightedHalfYearlyRate: 2 * ((1 + weightedCompRate) ** (1 / 2) - 1),
      weightedQuarterlyRate: 4 * ((1 + weightedCompRate) ** (1 / 4) - 1),
      greeks: {
        deltaPercent: (bookDelta * inputs.spot) / notional,
        totalDelta: bookDelta,
        hedgeQuantity: hedgeQty,
        hedgePremiumCr,
        optionsDelta,
        residualFutures: bookDelta - optionsDelta,
        vegaWeightedVol,
        vegaCr: (bookVega / CRORE) * -1,
        rhoWeightedForward,
        rhoCr: (bookRho / CRORE) * -1,
        leverage: inputs.decay,
        targetLevel: terms.target,
      },
      payoff,
    },
    dayOneVegaHedge: { quantity: hedgeQuantity, margin: hedgeMargin, fair, exchange, stressed },
    markToMarket: { rows: marginRows, zeroRow, worstCase },
    diagnostics: {
      solverIterations,
      loopPasses,
      loopResidual,
      spotBumpAfterStress: spotBump,
      payoffBookGap: payoffBookGap(inputs, strikes, start),
    },
  };
}
