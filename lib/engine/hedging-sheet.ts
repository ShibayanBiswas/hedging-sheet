import { bsGreeks } from "@/lib/engine/black-scholes";
import { daysBetween } from "@/lib/engine/dates";
import { checkInputShape } from "@/lib/engine/input-schema";
import { dividendYield, pricerDiscountYield, readRateCurve } from "@/lib/engine/rates";
import { maturityDate, medianExpiryIndex, validateSchedule } from "@/lib/engine/schedule";
import { brentSolve } from "@/lib/engine/solver";
import {
  buildStrikes,
  clientReturn,
  effectiveSpreads,
  payoffDescription,
  payoffLevels,
  preTaxIrr,
  resolveParticipations,
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
  interpolateVolPercent,
  lookupFwdSellRate,
  lookupVolBump,
  pricingParamOnOrBefore,
  referenceSensexPrice,
  referenceUnderlyingPrice,
} from "@/lib/engine/vol-surface";

export const CRORE = 1e7;
export const LAKH = 1e5;
/** The workbook keeps two identical halves of the leg grid. */
export const HALVES = 2;
/** Fixed stress grid, as in the workbook. */
export const SCENARIO_MOVES = [-0.5, -0.45, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];

export function annualVolFromDaily(daily: number): number {
  return daily * Math.sqrt(365);
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
  volBump: number;
  dividends: number;
  curve: ReturnType<typeof readRateCurve>;
};

function priceOption(req: PriceRequest): OptionPricing {
  const days = daysBetween(req.valuationDate, req.maturity);
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
    forward: Math.exp((req.growth * days) / 365) * req.spot,
    volatility: req.vol,
    volBump: req.volBump,
    bidOffer: req.bidOffer,
    price: g.price,
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

function dividendMultiplier(type: OptionType, bidOffer: BidOffer, multiplier: number): number {
  if (type === "P") return bidOffer === "O" ? multiplier : 1;
  return bidOffer === "O" ? 1 : multiplier;
}

/** Day 1 fair forward growth: discount less dividends against the Forward Sell Rate. */
function hedgeGrowth(type: OptionType, bidOffer: BidOffer, discount: number, dividends: number, fwdSell: number): number {
  const net = discount - dividends;
  if (bidOffer === "B") return type === "P" ? Math.max(net, fwdSell) : Math.min(fwdSell - 0.005, net);
  return type === "P" ? Math.min(fwdSell - 0.005, net) : Math.max(net, fwdSell);
}

export function validateInputs(inputs: HedgeInputs): { errors: ValidationIssue[]; warnings: ValidationIssue[]; dates: string[] } {
  const warnings: ValidationIssue[] = [];
  const shape = checkInputShape(inputs);
  if (shape.length) return { errors: shape, warnings, dates: [] };
  const errors: ValidationIssue[] = [];
  const positive: Array<[keyof HedgeInputs, string]> = [
    ["spot", "Spot"],
    ["notionalCr", "Notional in Crore"],
    ["tenorDays", "Tenor in Days"],
    ["coupon", "Coupon"],
    ["dailyVol", "Daily Volatility"],
    ["hedgeStrike", "Hedge Strike"],
  ];
  for (const [key, label] of positive) {
    const v = inputs[key] as number;
    if (!(typeof v === "number" && Number.isFinite(v) && v > 0)) errors.push({ field: key, message: `${label} must be above zero.` });
  }
  const schedule = validateSchedule(inputs);
  errors.push(...schedule.errors);
  const spreads = effectiveSpreads(inputs);
  if (spreads.length) {
    const parts = resolveParticipations({ ...inputs, spreads });
    const total = spreads.reduce((sum, s, j) => sum + (s.sell - s.buy) * parts[j]!, 0);
    if (Math.abs(total - inputs.coupon) > 1e-9) {
      warnings.push({
        field: "spreads",
        message: `The spreads pay a maximum of ${(total * 100).toFixed(2)} percent, which does not tie to the Coupon of ${(inputs.coupon * 100).toFixed(2)} percent.`,
      });
    }
  }
  return { errors, warnings, dates: schedule.dates };
}

export function computeHedgingSheet(inputs: HedgeInputs, market: MarketData): HedgingResult | HedgingFailure {
  const { errors, warnings, dates } = validateInputs(inputs);
  const start = startLevel(inputs);
  const spreads = effectiveSpreads(inputs);
  const participations = resolveParticipations({ ...inputs, spreads });
  const strikes = errors.length ? [] : buildStrikes(inputs, start, participations);
  if (!errors.length) errors.push(...validateStructure(inputs, strikes.length));
  if (errors.length) return { ok: false, errors, warnings };

  const { surface, params } = market;
  const underlying = inputs.underlying;
  const notional = inputs.notionalCr * CRORE;
  const nLive = dates.length;
  const hedgeIdx =
    inputs.hedgeExpiryIndex != null && inputs.hedgeExpiryIndex >= 0 && inputs.hedgeExpiryIndex < nLive
      ? inputs.hedgeExpiryIndex
      : medianExpiryIndex(nLive);
  const hedgeExpiry = dates[hedgeIdx]!;
  const divScale = dividendScale(inputs, market);
  const premiumRate = inputs.premiumRate;

  // ------------------------------------------------------------ Pricer legs
  const legs: PricerLeg[] = [];
  strikes.forEach((slot, blockIndex) => {
    dates.forEach((maturity, expiryIndex) => {
      const type: OptionType = "P";
      const curve = readRateCurve(params.rateCurve, maturity, premiumRate);
      const discount = pricerDiscountYield(curve.rate, type, inputs.bidOffer, params, premiumRate);
      const growth = lookupFwdSellRate(surface.pricingParams, maturity);
      const vol = interpolateVolPercent(surface, slot.strike, maturity, underlying, inputs.spot) / 100 + inputs.volBump;
      const dividends = dividendYield(
        params.dividends,
        maturity,
        inputs.valuationDate,
        inputs.spot,
        divScale,
        dividendMultiplier(type, inputs.bidOffer, params.dividendBidOfferMultiplier),
      );
      const priced = priceOption({
        valuationDate: inputs.valuationDate,
        spot: inputs.spot,
        strike: slot.strike,
        maturity,
        optionType: type,
        bidOffer: inputs.bidOffer,
        growth,
        discount,
        vol,
        volBump: inputs.volBump,
        dividends,
        curve,
      });
      const contracts = (slot.units * notional) / start / (HALVES * nLive);
      const pp = pricingParamOnOrBefore(surface.pricingParams, maturity);
      const t = priced.days / 365;
      const incMargin = inputs.bidOffer === "B" ? 0 : (pp?.incMargin ?? null);
      const marginCost = pp?.marginCost ?? null;
      const fullMargin = pp?.fullMargin ?? null;
      const incCost = incMargin != null && marginCost != null ? incMargin * inputs.spot * marginCost * t : null;
      const fullCost = fullMargin != null && marginCost != null ? fullMargin * inputs.spot * marginCost * t : null;
      legs.push({
        ...priced,
        strikePercent: slot.percent,
        blockIndex,
        expiryIndex,
        units: slot.units,
        action: contracts < 0 ? "Sell" : "Buy",
        contracts,
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
        incrementalAdjustedPrice: incCost != null ? priced.price + incCost : null,
        fullMargin,
        fullMarginCost: marginCost,
        fullCostInr: fullCost,
        fullAdjustedPrice: fullCost != null ? priced.price + fullCost : null,
      });
    });
  });

  const sum = (pick: (l: PricerLeg) => number) => HALVES * legs.reduce((acc, l) => acc + pick(l), 0);
  const premium = sum((l) => l.optionValue);
  const bookDelta = sum((l) => l.deltaContracts);
  const bookVega = sum((l) => l.vegaInr);
  const bookRho = sum((l) => l.rhoInr);
  const bookGamma = sum((l) => l.gammaContracts);
  const vegaWeightedVol = bookVega !== 0 ? sum((l) => l.volatility * l.vegaInr) / bookVega : NaN;
  const grossVega = sum((l) => Math.abs(l.vegaInr));
  const absVegaWeightedVol = grossVega !== 0 ? sum((l) => l.volatility * Math.abs(l.vegaInr)) / grossVega : NaN;
  const rhoWeightedForward = bookRho !== 0 ? sum((l) => l.forwardGrowth * l.rhoInr) / bookRho : NaN;

  /** Book delta in lakh at a shocked spot, repriced directly instead of the workbook macro. */
  const bookDeltaLakhAt = (move: number): number => {
    if (move === 0) return bookDelta / LAKH;
    const shocked = inputs.spot * (1 + move);
    let total = 0;
    for (const l of legs) {
      const g = bsGreeks({
        spot: shocked,
        strike: l.strike,
        days: l.days,
        growth: l.forwardGrowth,
        discount: l.discountYield,
        vol: l.volatility,
        type: l.optionType,
      });
      total += l.contracts * g.delta;
    }
    return (HALVES * total) / LAKH;
  };

  // ------------------------------------------------------------ Day 1 Vega Hedge
  const annualVol = annualVolFromDaily(inputs.dailyVol);
  const hedgeType: OptionType = "P";
  const hedgeBidOffer: BidOffer = "B";
  const hedgeCurve = readRateCurve(params.rateCurve, hedgeExpiry, premiumRate);
  const hedgeFwdSell = lookupFwdSellRate(surface.pricingParams, hedgeExpiry);
  const hedgeBidBump = lookupVolBump(surface.pricingParams, hedgeExpiry);
  const hedgeSurfaceVol =
    interpolateVolPercent(surface, inputs.hedgeStrike, hedgeExpiry, underlying, inputs.spot) / 100 + hedgeBidBump;
  const divMult = dividendMultiplier(hedgeType, hedgeBidOffer, params.dividendBidOfferMultiplier);

  type Block = "fair" | "exchange" | "stressed";
  const hedgeRow = (move: number, block: Block): OptionPricing => {
    const base = inputs.spot * (1 + move);
    const spot =
      block === "stressed" ? base * (1 - inputs.stressSigmas * inputs.dailyVol * Math.sqrt(inputs.stressDays)) : base;
    const dividends = dividendYield(params.dividends, hedgeExpiry, inputs.valuationDate, spot, divScale, divMult);
    let vol: number;
    let growth: number;
    let discount: number;
    if (block === "fair") {
      vol = hedgeSurfaceVol;
      discount = hedgeCurve.rate;
      growth = hedgeGrowth(hedgeType, hedgeBidOffer, discount, dividends, hedgeFwdSell);
    } else if (block === "exchange") {
      vol = annualVol;
      growth = inputs.exchangeForwardRate;
      discount = inputs.exchangeDiscountRate;
    } else {
      vol = annualVol * inputs.stressVolMultiplier;
      growth = inputs.stressedForwardRate;
      discount = inputs.stressedDiscountRate;
    }
    return priceOption({
      valuationDate: inputs.valuationDate,
      spot,
      strike: inputs.hedgeStrike,
      maturity: hedgeExpiry,
      optionType: hedgeType,
      bidOffer: hedgeBidOffer,
      growth,
      discount,
      vol,
      volBump: hedgeBidBump,
      dividends,
      curve: hedgeCurve,
    });
  };

  const fairAtZero = hedgeRow(0, "fair");
  const hedgeQuantity = fairAtZero.vega !== 0 ? -bookVega / fairAtZero.vega : NaN;
  const toHedgeRow = (move: number, p: OptionPricing): HedgeRow => ({
    ...p,
    move,
    contracts: hedgeQuantity,
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

  const soldQuantity = -hedgeQuantity;
  const dayOneFair = fairAtZero.price;
  const hedgeMargin: HedgeMarginRow[] = SCENARIO_MOVES.map((move, i) => {
    const level = fair[i]!.spot;
    const ex = exchange[i]!.price;
    const st = stressed[i]!.price;
    const fp = fair[i]!.price;
    const initial = ((st - ex) * soldQuantity) / CRORE + ((fp - dayOneFair) * soldQuantity) / CRORE;
    const exposure = (inputs.exposureMargin * level * soldQuantity) / CRORE;
    return {
      level,
      move,
      strike: inputs.hedgeStrike,
      expiry: hedgeExpiry,
      quantity: soldQuantity,
      dayOneFairPrice: dayOneFair,
      premiumCr: (dayOneFair * soldQuantity * -1) / CRORE,
      exchangePrice: ex,
      stressedPrice: st,
      fairPrice: fp,
      initialMarginCr: initial,
      exposureMarginCr: exposure,
      totalMarginCr: initial + exposure,
    };
  });

  // ------------------------------------------------------------ Mark to Market and Margin
  const zeroIdx = SCENARIO_MOVES.indexOf(0);
  const base = SCENARIO_MOVES.map((move, i) => {
    const level = inputs.spot * (1 + move);
    const product = bookDeltaLakhAt(move);
    const option = fair[i]!.deltaContracts / LAKH;
    const residual = product + option;
    return {
      level,
      move,
      product,
      option,
      residual,
      futuresMargin: (-residual * inputs.futuresMargin * level * LAKH) / CRORE,
      optionsMargin: hedgeMargin[i]!.totalMarginCr,
    };
  });
  const step = base.map(() => 0);
  const cumulative = base.map(() => 0);
  for (let i = zeroIdx - 1; i >= 0; i--) {
    step[i] = (base[i + 1]!.residual * (base[i]!.level - base[i + 1]!.level) * LAKH) / CRORE;
    cumulative[i] = cumulative[i + 1]! + step[i]!;
  }
  for (let i = zeroIdx + 1; i < base.length; i++) {
    step[i] = (base[i - 1]!.residual * (base[i]!.level - base[i - 1]!.level) * LAKH) / CRORE;
    cumulative[i] = step[i]! + cumulative[i - 1]!;
  }
  const marginRows: MarginRow[] = base.map((b, i) => {
    const total = b.futuresMargin + cumulative[i]! + b.optionsMargin;
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
      totalRequirementPercent: total / inputs.notionalCr,
    };
  });
  const zeroRow = marginRows[zeroIdx]!;
  const worstCase = marginRows.reduce((w, r) => (r.totalRequirementCr < w.totalRequirementCr ? r : w), marginRows[0]!);

  // ------------------------------------------------------------ pots, margin loop and Inbuilt solve
  const costRate = inputs.transactionCost + inputs.issuanceCost + inputs.marginCost;
  const transactionCostInr = costRate * notional;
  const tenor = inputs.tenorDays;
  const nbfcGrowth = (1 + inputs.nbfcRate) ** (tenor / 365);
  const premiumGrowth = (1 + premiumRate) ** (tenor / 365);
  const marginGrowth = (1 + inputs.marginGrowthRate) ** (tenor / 365);
  const payoutFor = (inbuilt: number, marginInr: number) =>
    (notional - inbuilt - transactionCostInr - marginInr) * nbfcGrowth + premium * premiumGrowth + marginInr * marginGrowth;

  /** Margin as a fraction of notional from the 0 percent row. The Inbuilt does not move it in this book. */
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
    const marginInr = notional * marginFraction;
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
  const achievedCoupon = payout / notional - 1;
  const irr = (1 + achievedCoupon) ** (365 / tenor) - 1;
  const nbfcAmount = notional - inbuilt - transactionCostInr - marginInr;
  const actualInbuilt = inbuilt / notional;

  // ------------------------------------------------------------ Summary leg table
  const summaryLegs: SummaryLeg[] = strikes.map((slot, b) => {
    const own = legs.filter((l) => l.blockIndex === b);
    const contracts = HALVES * own.reduce((acc, l) => acc + l.contracts, 0);
    const avgPrice = (HALVES * own.reduce((acc, l) => acc + l.price, 0)) / (HALVES * nLive);
    const quantityLakh = contracts / LAKH;
    return {
      strikePercent: slot.percent,
      strike: slot.strike,
      optionType: "P",
      units: slot.units,
      quantityLakh,
      averagePrice: avgPrice,
      premiumCr: ((quantityLakh * avgPrice * LAKH) / CRORE) * -1,
    };
  });
  const hedgeQuantityLakh = soldQuantity / LAKH;
  const hedgePremiumCr = ((hedgeQuantityLakh * dayOneFair * LAKH) / CRORE) * -1;
  const hedgeDelta = fairAtZero.delta;

  // ------------------------------------------------------------ Product Description
  const nbfcCr = nbfcAmount / CRORE;
  const marginCr = marginInr / CRORE;
  const premiumCr = premium / CRORE;
  const finalNbfcCr = nbfcCr * nbfcGrowth;
  const finalPremiumCr = premiumCr * premiumGrowth;
  const finalMarginCr = marginCr * marginGrowth;
  const maturityCr = finalMarginCr + finalPremiumCr + finalNbfcCr;
  const weightedCompRate = (nbfcCr * inputs.nbfcRate + marginCr * inputs.marginGrowthRate) / (nbfcCr + marginCr);
  const hedgeQty = hedgeQuantityLakh * LAKH;
  const optionsDelta = hedgeQty * hedgeDelta;
  const years = Math.round(tenor / 365);
  const title = `${years} Year ${underlying} Accelerator Senior Debt For ₹${inputs.notionalCr} Crore With ${inputs.decay} Times Leverage`;

  const payoff = payoffLevels(inputs, strikes).map((performance) => {
    const value = clientReturn(inputs, participations, performance);
    return {
      performance,
      clientReturn: value,
      maturityValueCr: inputs.notionalCr * (1 + value),
      preTaxIrr: preTaxIrr(value, tenor),
      description: payoffDescription(inputs, performance, value),
    };
  });

  const spreadPayouts = spreads.map((s, j) => (s.sell - s.buy) * participations[j]!);

  return {
    ok: true,
    inputs,
    underlyingLabel: underlying,
    warnings,
    schedule: { expiries: dates, hedgeExpiry, maturityDate: maturityDate(inputs) },
    structure: { startLevel: start, strikes, spreadParticipations: participations, maxCoupon: spreadPayouts.reduce((a, b) => a + b, 0) },
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
        deltaLakh: bookDelta / LAKH,
        spreadPayouts,
        protectionLoss: inputs.protection * inputs.decay,
      },
      legs,
      halves: HALVES,
    },
    summary: {
      actualInbuilt,
      irr: (1 + inputs.coupon) ** (365 / tenor) - 1,
      margin: marginFraction,
      optionExpiry: hedgeExpiry,
      deltaContracts: bookDelta,
      deltaPercent: (bookDelta * inputs.spot) / notional,
      vegaWeightedVol,
      absVegaWeightedVol,
      vegaCr: (bookVega / CRORE) * -1,
      rhoWeightedForward,
      rhoCr: (bookRho / CRORE) * -1,
      legs: summaryLegs,
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
      irr: (maturityCr / inputs.notionalCr) ** (365 / tenor) - 1,
      weightedCompRate,
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
        targetLevel: inputs.target,
      },
      payoff,
    },
    dayOneVegaHedge: { quantity: hedgeQuantity, margin: hedgeMargin, fair, exchange, stressed },
    markToMarket: { rows: marginRows, zeroRow, worstCase },
    diagnostics: { solverIterations, loopPasses, loopResidual },
  };
}
