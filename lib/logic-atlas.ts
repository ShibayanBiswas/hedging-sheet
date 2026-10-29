import type { FlowNodeSpec } from "@/components/atlas/logic-flow";
import { formatDate } from "@/lib/engine/dates";
import { deriveTerms } from "@/lib/engine/structure";
import type { HedgingResult } from "@/lib/engine/types";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";

type LogicFormula = {
  name: string;
  /** The formula in words. */
  words: string;
  inputs: string;
  output: string;
  /** The value from the last run, or "-" before one. */
  value: (r: HedgingResult) => string;
};

type LogicOutput = { label: string; href: string; value: (r: HedgingResult) => string };

export type LogicModule = {
  id: string;
  title: string;
  subtitle: string;
  accent: "amber" | "cyan" | "purple" | "green" | "rose" | "gold";
  /** Three to six sentences on what the section does and why. */
  description: string;
  stageCount: number;
  metrics: Array<{ label: string; value: string }>;
  nodes: FlowNodeSpec[];
  formulas: LogicFormula[];
  edgeCases: string[];
  /** Plain-language cards, filled with the last run's values when there is one. */
  insights: (r: HedgingResult | null) => string[];
  outputs: LogicOutput[];
};

function mod(m: Omit<LogicModule, "stageCount">): LogicModule {
  return { ...m, stageCount: m.nodes.length };
}

const cr = (inr: number) => fmtCrore(inr / 1e7);

/** Descriptive copy only. `u` is the underlying name and `weekday` its expiry day, so no text hard-codes an index. */
export function logicModules(u: string, weekday: string): LogicModule[] {
  return [
    mod({
      id: "inputs",
      title: "Inputs",
      subtitle: "Live Defaults And Product Terms",
      accent: "cyan",
      description: `Spot is the last completed ${u} close, the valuation date is today in India and the daily volatility is calculated from a year of closes. Product terms default to a 37% target, a 102.5% coupon, strikes of 137, 127, 125, 85, 84 and 70, decay 1.6 and a 1,940 day tenor. Nothing is saved: a refresh reloads the live defaults, and only Run Simulation prices.`,
      metrics: [
        { label: "Sections", value: "Eight" },
        { label: "Saved", value: "Never" },
      ],
      nodes: [
        { kind: "input", label: "Live Close", description: "The last completed session close for the underlying, never an intraday print." },
        { kind: "input", label: "Product Terms", description: "Coupon, decay, tenor, strikes, expiries, costs and the volatility and margin inputs." },
        { kind: "process", label: "Validation", description: "Every edge case is checked as you type; a blocking popup names the input and the fix." },
        { kind: "output", label: "Run Simulation", description: "Fetches market data, prices the legs, solves the Inbuilt and builds the stress grid." },
      ],
      formulas: [
        { name: "Start Level", words: "Spot times one plus the uplift, rounded up to the next 100.", inputs: "Spot, Start Level Uplift", output: `Start ${u} Level`, value: (r) => fmtNumber(r.structure.startLevel, 0) },
        { name: "Annual Volatility", words: "Daily volatility times the square root of 365.", inputs: "Daily Volatility", output: "Annual Volatility", value: (r) => fmtPercent(r.summary.annualVol) },
        { name: "Hedge Strike", words: "Spot rounded to the nearest 100 point listed strike.", inputs: "Spot", output: "Hedge Strike", value: (r) => fmtNumber(r.summary.hedgeStrike, 0) },
      ],
      edgeCases: [
        "Spot stays blank when Yahoo does not answer; the run is blocked until it is above zero.",
        "Typing over the daily or annual volatility marks it Overridden; Reset recalculates it.",
        "Changing any input after a run marks the output tabs Inputs Changed.",
      ],
      insights: (r) =>
        r
          ? [`The last run priced ${r.inputs.underlying} at a spot of ${fmtNumber(r.inputs.spot)} on ${formatDate(r.inputs.valuationDate)}.`, "Download Excel uses the last run."]
          : ["Market Data and Logic Atlas never need a run.", "Download Excel uses the last run."],
      outputs: [
        { label: "Spot", href: "/", value: (r) => fmtNumber(r.inputs.spot) },
        { label: "Valuation Date", href: "/", value: (r) => formatDate(r.inputs.valuationDate) },
        { label: "Daily Volatility", href: "/", value: (r) => fmtPercent(r.inputs.dailyVol, 3) },
      ],
    }),
    mod({
      id: "expiries",
      title: "Expiries",
      subtitle: `${u} Expiries Fall On ${weekday}`,
      accent: "purple",
      description: `Each observation expiry is a month number counted from the valuation date and set on the ${weekday} the exchange calendar fixes for ${u}. Every expiry is observed by the payoff; the median one, the lower middle for an even count, is also the expiry of the listed hedge option.`,
      metrics: [
        { label: "Count", value: "One To Twelve" },
        { label: "Weekday", value: weekday },
      ],
      nodes: [
        { kind: "input", label: "Month Numbers", description: "Strictly rising, such as 41, 44, 47, 50, 53 and 56." },
        { kind: "process", label: "Expiry Weekday", description: `Each month number lands on the nearest ${weekday}.` },
        { kind: "output", label: "Expiry Dates", description: "Observation dates, with the hedge option expiry marked." },
      ],
      formulas: [
        { name: "Expiry", words: `The ${weekday} nearest to the month number counted from the valuation date.`, inputs: "Valuation Date, Expiry Months", output: "Expiry Dates", value: (r) => r.schedule.expiries.map((d) => formatDate(d)).join(", ") },
        { name: "Hedge Option Expiry", words: "The middle expiry; the lower middle for an even count.", inputs: "Expiry Dates", output: "Observation And Hedge Option Expiry", value: (r) => formatDate(r.schedule.hedgeExpiry) },
        { name: "Maturity", words: "Valuation date plus the tenor in days.", inputs: "Valuation Date, Tenor In Days", output: "Maturity Date", value: (r) => formatDate(r.schedule.maturityDate) },
      ],
      edgeCases: [
        "Months that do not rise strictly block the run.",
        "An expiry after maturity blocks the run.",
        "An expiry after the last surface row is allowed with a warning; it reads the last row.",
      ],
      insights: (r) => [
        `${u} expiries are ${weekday}s, per the exchange notices from September 2025.`,
        ...(r ? [`The last run observed ${r.schedule.expiries.length} dates and hedged at ${formatDate(r.schedule.hedgeExpiry)}.`] : []),
      ],
      outputs: [
        { label: "Expiry Dates", href: "/summary", value: (r) => String(r.schedule.expiries.length) },
        { label: "Hedge Option Expiry", href: "/vega-hedge", value: (r) => formatDate(r.schedule.hedgeExpiry) },
        { label: "Maturity Date", href: "/product", value: (r) => formatDate(r.schedule.maturityDate) },
      ],
    }),
    mod({
      id: "strikes",
      title: "Strikes And Spreads",
      subtitle: "Strikes Define The Payoff",
      accent: "amber",
      description:
        "The strikes are the primary inputs, as a % of the start level, highest first. With n spreads there are n + 4 strikes: the spread levels, the protection strike, one point below it and the decay floor. Each strike takes Put or Call and Buy or Sell; the side must match the payoff, and a call strike carries a futures leg so it replicates the put. The top participation is derived from the coupon and can be overridden.",
      metrics: [
        { label: "Strikes", value: "Spreads Plus Four" },
        { label: "Spreads", value: "One To Four" },
      ],
      nodes: [
        { kind: "input", label: "Strikes", description: "Strike 1 is the target; the last is the decay floor." },
        { kind: "process", label: "Spreads", description: "Buy and sell levels read from adjacent strikes. Editing a level writes its strike." },
        { kind: "process", label: "Participation", description: "The top spread takes the coupon left over by the lower spreads, divided by its width." },
        { kind: "output", label: "Quantity And Side", description: "The change in the payoff's slope at each strike: its size is the quantity, its sign Buy or Sell." },
      ],
      formulas: [
        { name: "Top Participation", words: "Coupon less the payout of the lower spreads, divided by the top spread width.", inputs: "Coupon, Strikes, Participation Rates", output: "Top Participation Rate", value: (r) => fmtNumber(r.structure.spreadParticipations[r.structure.spreadParticipations.length - 1], 3) },
        { name: "Spread Payout", words: "Spread width times its participation.", inputs: "Buy Level, Sell Level, Participation Rate", output: "Maximum Upside", value: (r) => fmtPercent(r.structure.maxCoupon) },
        { name: "Strike Level", words: "Start level times the strike %, rounded to whole points.", inputs: "Start Level, Strike %", output: "Strike Levels", value: (r) => r.structure.strikes.map((s) => fmtNumber(s.strike, 0)).join(", ") },
        { name: "Quantity Per Strike", words: "Slope above less slope below the strike; negative is Sell.", inputs: "Strikes, Participation Rates, Decay", output: "Quantity And Side", value: (r) => r.structure.strikes.map((s) => `${fmtNumber(Math.abs(s.units))} ${s.side === "S" ? "Sell" : "Buy"}`).join(", ") },
        { name: "Futures Adjustment", words: "For a call strike, quantity times discount times forward less strike, so the call and its futures leg value as the put.", inputs: "Option Type, Forward, Discount Yield", output: "Futures Adjustment For Call Strikes", value: (r) => fmtCrore(r.summary.futuresAdjustmentCr) },
      ],
      edgeCases: [
        "Strikes not strictly descending, or any strike at or below zero, block the run.",
        "A side that does not match the payoff shows an error on that strike and keeps Run off.",
        "A participation at or below zero, or a coupon the spreads cannot reach, blocks the run.",
        "A typed top participation that pays more than the Coupon shows an error under the field and keeps Run off.",
      ],
      insights: (r) =>
        r
          ? [`The book matches the client payoff to ${r.diagnostics.payoffBookGap.toExponential(1)} at every strike.`, `${r.structure.strikes.filter((s) => s.optionType === "C").length} of ${r.structure.strikes.length} strikes are calls.`]
          : ["The book matches the client payoff at every strike to about 1e-15."],
      outputs: [
        { label: "Spreads", href: "/summary", value: (r) => String(deriveTerms(r.inputs).nSpreads) },
        { label: "Maximum Upside", href: "/summary", value: (r) => fmtPercent(r.structure.maxCoupon) },
        { label: "Strikes", href: "/pricer", value: (r) => String(r.structure.strikes.length) },
      ],
    }),
    mod({
      id: "pricer",
      title: "Pricer",
      subtitle: "Every Live Leg On The Surface",
      accent: "gold",
      description:
        "Each live leg is one strike at one expiry, priced as a Black option on the forward. Volatility is read from the surface between the two nearest strike columns and expiry rows, plus the volatility bump, unless the leg is overridden. The rate curve is anchored at the valuation date and runs a year past the longest expiry. Greeks come from bumping spot, time, volatility and rates and repricing.",
      metrics: [
        { label: "Model", value: "Black On The Forward" },
        { label: "Greeks", value: "Bump And Reprice" },
      ],
      nodes: [
        { kind: "lookup", label: "Volatility", description: "A straight line across the two nearest strike columns, then linear in days between expiry rows." },
        { kind: "lookup", label: "Rate Curve", description: "The discount yield is the capped straight line between the bracketing curve points." },
        { kind: "engine", label: "Price", description: "The forward is spot times e to the growth times time; the option is discounted at the discount yield." },
        { kind: "output", label: "Greeks And Book", description: "Delta, gamma, theta, vega and rho per leg and in rupees for the book." },
      ],
      formulas: [
        { name: "Forward", words: "Spot times e to the forward growth times days over 365.", inputs: "Spot, Forward Growth, Days", output: "Forward", value: (r) => fmtNumber(r.pricer.legs[0]?.forward) },
        { name: "Forward Growth", words: "The Forward Sell Rate of the valuation month.", inputs: "Pricing Parameters", output: "Forward Growth", value: (r) => fmtPercent(r.pricer.legs[0]?.forwardGrowth, 3) },
        { name: "Discount Yield", words: "The smaller of the cap and the curve rate; the cap depends on the option type and Bid or Offer.", inputs: "Rate Curve, Option Type", output: "Discount Yield", value: (r) => fmtPercent(r.pricer.legs[0]?.discountYield, 3) },
        { name: "Contracts", words: "Units times notional over the start level, over twice the live expiry count.", inputs: "Units, Notional, Start Level", output: "Contracts", value: (r) => fmtNumber(r.pricer.legs[0]?.contracts, 0) },
        { name: "Book Premium", words: "Minus contracts times price over every leg, plus any futures adjustment.", inputs: "Contracts, Price", output: "Premium In Crore", value: (r) => cr(r.pricer.header.premium) },
      ],
      edgeCases: [
        "A leg past the last surface row reads the last row.",
        "A leg override applies to that strike and expiry and is badged Overridden.",
        "The Deep column of the surface always equals the 55% column.",
      ],
      insights: (r) => (r ? [`${r.pricer.legs.length} live legs priced to a premium of ${cr(r.pricer.header.premium)} crore.`, "Rho bumps the forward growth and the discount yield together."] : ["Rho bumps the forward growth and the discount yield together.", "Bid carries no incremental margin."]),
      outputs: [
        { label: "Premium In Crore", href: "/pricer", value: (r) => cr(r.pricer.header.premium) },
        { label: "Delta In Contracts", href: "/pricer", value: (r) => fmtNumber(r.pricer.header.delta, 0) },
        { label: "Live Legs", href: "/pricer", value: (r) => String(r.pricer.legs.length) },
      ],
    }),
    mod({
      id: "solver",
      title: "Solver",
      subtitle: "Goal Seek On The Inbuilt",
      accent: "rose",
      description:
        "The mobilisation is split into the Inbuilt, costs, the NBFC deposit, the option premium and the margin. Each pot grows at its own rate to maturity, and the Inbuilt is solved so the total equals the notional times one plus the coupon. Brent's method with a bisection fallback runs on every Run Simulation. The margin from the stress grid feeds the pots.",
      metrics: [
        { label: "Method", value: "Brent With Bisection" },
        { label: "Residual", value: "Below 1e-9" },
      ],
      nodes: [
        { kind: "input", label: "Costs And Rates", description: "Transaction, issuance and margin costs; NBFC, premium and margin growth rates." },
        { kind: "process", label: "Pots", description: "NBFC amount = mobilisation − Inbuilt − costs − margin." },
        { kind: "engine", label: "Goal Seek", description: "Move the Inbuilt until the achieved coupon equals the coupon." },
        { kind: "output", label: "Actual Inbuilt", description: "The Inbuilt as a % of notional, with the payout and internal rate of return." },
      ],
      formulas: [
        { name: "Maturity Payout", words: "NBFC amount grown at the NBFC rate, plus premium grown at the premium rate, plus margin grown at the margin rate, over the tenor.", inputs: "Pots, Rates, Tenor", output: "Maturity Payout In Crore", value: (r) => cr(r.pricer.header.payout) },
        { name: "Achieved Coupon", words: "Payout over mobilisation, less one.", inputs: "Maturity Payout, Mobilisation", output: "Achieved Coupon", value: (r) => fmtPercent(r.pricer.header.achievedCoupon) },
        { name: "Goal Seek", words: "Set the achieved coupon to the coupon by changing the Inbuilt.", inputs: "Coupon, Pots", output: "Actual Inbuilt", value: (r) => fmtPercent(r.summary.actualInbuilt) },
        { name: "Margin", words: "The total requirement at the 0% move over notional.", inputs: "Mark To Market At 0%", output: "Margin Requirement", value: (r) => fmtPercent(r.summary.margin) },
      ],
      edgeCases: ["If no Inbuilt reaches the coupon the run reports it rather than showing a stale value."],
      insights: (r) => (r ? [`The goal seek took ${r.diagnostics.solverIterations} steps to an Inbuilt of ${fmtPercent(r.summary.actualInbuilt)}.`] : ["The Debug Drawer lists every goal seek step of the last run."]),
      outputs: [
        { label: "Actual Inbuilt", href: "/summary", value: (r) => fmtPercent(r.summary.actualInbuilt) },
        { label: "Maturity Payout In Crore", href: "/pricer", value: (r) => cr(r.pricer.header.payout) },
        { label: "Internal Rate Of Return", href: "/summary", value: (r) => fmtPercent(r.summary.irr) },
      ],
    }),
    mod({
      id: "summary",
      title: "Summary",
      subtitle: "One Page Of The Book",
      accent: "green",
      description:
        "The Summary Sheet tab collects the market and rates, the product specification, the final expiries, the Greeks, the costs, the options per strike and the vega hedge. Option details sum each strike's contracts across expiries and average its price. Weighted Average Volatility weights each leg by its signed vega, so long and short legs offset; the absolute version sits beside it.",
      metrics: [
        { label: "Tables", value: "Eight" },
        { label: "Totals", value: "Every Leg" },
      ],
      nodes: [
        { kind: "input", label: "Priced Legs", description: "Every leg's contracts, price, vega and rho." },
        { kind: "process", label: "Per Strike", description: "Quantity in lakh, average price and premium in crore." },
        { kind: "output", label: "Summary Tables", description: "The same tables are written to the Excel file." },
      ],
      formulas: [
        { name: "Quantity", words: "Sum of a strike's contracts over 100,000.", inputs: "Contracts", output: "Quantity In Lakh", value: (r) => fmtNumber(r.summary.legs[0]?.quantityLakh) },
        { name: "Premium", words: "Minus quantity times average price, in crore.", inputs: "Quantity, Average Price", output: "Premium In Crore", value: (r) => fmtCrore(r.summary.totalPremiumCr) },
        { name: "Weighted Average Volatility", words: "Sum of volatility times vega in rupees over the sum of vega in rupees.", inputs: "Volatility, Vega", output: "Weighted Average Volatility", value: (r) => fmtPercent(r.summary.vegaWeightedVol) },
      ],
      edgeCases: ["When the book's vega sums to zero the weighted volatility shows a dash with the reason."],
      insights: (r) => (r ? [`Delta % is ${fmtPercent(r.summary.deltaPercent, 1)}: book delta times spot over mobilisation.`] : ["Delta % is book delta times spot over mobilisation."]),
      outputs: [
        { label: "Option Premium In Crore", href: "/summary", value: (r) => fmtCrore(r.summary.totalPremiumCr) },
        { label: "Vega In Crore", href: "/summary", value: (r) => fmtCrore(r.summary.vegaCr) },
      ],
    }),
    mod({
      id: "product",
      title: "Product Description",
      subtitle: "Term Sheet And Payoff",
      accent: "amber",
      description:
        "The Product Description re-proves the payout from the three pots and lists the Greek details the desk quotes. The payoff is generated from the inputs at every strike, the protection level and 0.01% below it, zero, and every 5% between. Above protection the client earns the spread ladder capped at the coupon; below it losses run at the decay rate, easing past the floor.",
      metrics: [
        { label: "Greek Rows", value: "Twelve" },
        { label: "Payoff", value: "From The Inputs" },
      ],
      nodes: [
        { kind: "input", label: "Pots", description: "Inbuilt, costs, margin, NBFC amount and premium." },
        { kind: "process", label: "Greek Details", description: "Total delta, the hedge quantity, options delta and the residual futures." },
        { kind: "output", label: "Payoff", description: "Scenario table and chart." },
      ],
      formulas: [
        { name: "Options Delta", words: "Options quantity times the hedge option delta.", inputs: "Hedge Quantity, Hedge Delta", output: "Options Delta", value: (r) => fmtNumber(r.productDescription.greeks.optionsDelta, 0) },
        { name: "Residual Futures", words: "Total delta required less options delta.", inputs: "Total Delta, Options Delta", output: "Residual Futures", value: (r) => fmtNumber(r.productDescription.greeks.residualFutures, 0) },
        { name: "Client Return", words: "Above protection, the smaller of the coupon and the spread ladder; below it, the decayed loss eased past the floor.", inputs: "Strikes, Coupon, Decay", output: "Client Return", value: (r) => fmtPercent(r.productDescription.payoff[0]?.clientReturn) },
        { name: "Pre Tax Internal Rate Of Return", words: "One plus the return, raised to 365 over the tenor, less one.", inputs: "Client Return, Tenor", output: "Pre Tax Internal Rate Of Return", value: (r) => fmtPercent(r.productDescription.irr) },
      ],
      edgeCases: ["Below −90% the client return equals the index move."],
      insights: (r) => (r ? [`At the target the client earns ${fmtPercent(r.inputs.coupon)}; the maturity value is ${fmtCrore(r.productDescription.maturityCr)} crore.`] : ["The hedge quantity is negative because the listed options are sold."]),
      outputs: [
        { label: "Maturity Value In Crore", href: "/product", value: (r) => fmtCrore(r.productDescription.maturityCr) },
        { label: "Payoff Levels", href: "/product", value: (r) => String(r.productDescription.payoff.length) },
      ],
    }),
    mod({
      id: "dayone",
      title: "Day 1 Vega Hedge",
      subtitle: "Listed Options Against Book Vega",
      accent: "cyan",
      description:
        "Listed puts at the hedge strike and the hedge option expiry are sold so their vega cancels the book's vega. Each is valued three ways for every move from −50% to +20%: fair from the surface, exchange at the flat annual volatility, and stressed after a sigma shock. The margin is the stressed less the exchange price, plus the change in fair value, plus an exposure charge on the level.",
      metrics: [
        { label: "Blocks", value: "Fair, Exchange, Stressed" },
        { label: "Moves", value: "Fifteen" },
      ],
      nodes: [
        { kind: "input", label: "Book Vega", description: "The vega of every leg in rupees." },
        { kind: "process", label: "Quantity", description: "Minus book vega over the vega of one hedge option at the 0% move." },
        { kind: "engine", label: "Three Prices", description: "Fair, exchange and stressed." },
        { kind: "output", label: "Option Margin", description: "Initial plus exposure margin per move." },
      ],
      formulas: [
        { name: "Quantity", words: "Minus book vega over the hedge option's vega at 0%.", inputs: "Book Vega, Hedge Vega", output: "Hedge Quantity", value: (r) => fmtNumber(r.dayOneVegaHedge.quantity, 0) },
        { name: "Stressed Level", words: "Level times one less sigmas times daily volatility times the root of the shock days.", inputs: "Level, Shock Sigmas, Shock Days, Daily Volatility", output: "Stressed Level", value: (r) => fmtNumber(r.dayOneVegaHedge.stressed[10]?.spot) },
        { name: "Initial Margin", words: "Stressed less exchange price, plus fair less day 1 fair price, times quantity, in crore.", inputs: "Three Prices, Quantity", output: "Initial Margin In Crore", value: (r) => fmtCrore(r.dayOneVegaHedge.margin[10]?.initialMarginCr) },
        { name: "Exposure Margin", words: "Exposure rate times level times quantity, in crore.", inputs: "Exposure Margin, Level, Quantity", output: "Exposure Margin In Crore", value: (r) => fmtCrore(r.dayOneVegaHedge.margin[10]?.exposureMarginCr) },
      ],
      edgeCases: ["The fair volatility can be overridden on the tab and is badged when it is."],
      insights: (r) => (r ? [`${fmtNumber(Math.abs(r.dayOneVegaHedge.quantity), 0)} puts at ${fmtNumber(r.summary.hedgeStrike, 0)} cancel the book vega.`] : ["The hedge quantity is chosen so the book vega nets to zero."]),
      outputs: [
        { label: "Hedge Quantity", href: "/vega-hedge", value: (r) => fmtNumber(r.dayOneVegaHedge.quantity, 0) },
        { label: "Day 1 Fair Price", href: "/vega-hedge", value: (r) => fmtNumber(r.summary.hedgePrice) },
      ],
    }),
    mod({
      id: "mtm",
      title: "Mark To Market And Margin",
      subtitle: "Cash Under Stress",
      accent: "rose",
      description:
        "For each move the spot is shocked, the book delta is read and the shock is reset to zero. Book delta plus the hedge delta is the residual futures position. Futures margin is charged on its notional value, mark to market is built outward from the 0% row, and the option margin comes from the Day 1 Vega Hedge. The 0% total is the margin funded in the pots.",
      metrics: [
        { label: "Range", value: "−50% To +20%" },
        { label: "Funded Row", value: "0%" },
      ],
      nodes: [
        { kind: "engine", label: "Shock Spot", description: "Reprice every leg at the shocked spot." },
        { kind: "process", label: "Read Delta", description: "Product requirement in lakh." },
        { kind: "process", label: "Reset Shock", description: "Back to zero after every move." },
        { kind: "output", label: "Total Margin", description: "Futures margin, mark to market and option margin." },
      ],
      formulas: [
        { name: "Residual Futures", words: "Product requirement plus option delta, in lakh.", inputs: "Product Requirement, Option Delta", output: "Residual Futures In Lakh", value: (r) => fmtNumber(r.markToMarket.zeroRow.residualFuturesLakh, 3) },
        { name: "Futures Margin", words: "Minus residual futures times the futures margin rate times the level, in crore.", inputs: "Residual Futures, Futures Margin, Level", output: "Futures Margin In Crore", value: (r) => fmtCrore(r.markToMarket.zeroRow.futuresMarginCr) },
        { name: "Total Margin", words: "Futures margin plus cumulative mark to market plus option margin.", inputs: "Futures Margin, Mark To Market, Options Margin", output: "Total Margin In Crore", value: (r) => fmtCrore(r.markToMarket.zeroRow.totalRequirementCr) },
      ],
      edgeCases: ["The spot shock is checked to be zero after every run."],
      insights: (r) => (r ? [`The funded margin is the 0% row, ${fmtCrore(r.markToMarket.zeroRow.totalRequirementCr)} crore; the worst row is ${fmtPercent(r.markToMarket.worstCase.move, 0)}.`] : ["The worst case is shown for reference; the funded margin is the 0% row."]),
      outputs: [
        { label: "Total Margin At 0% In Crore", href: "/margin", value: (r) => fmtCrore(r.markToMarket.zeroRow.totalRequirementCr) },
        { label: "Worst Case In Crore", href: "/margin", value: (r) => fmtCrore(r.markToMarket.worstCase.totalRequirementCr) },
      ],
    }),
    mod({
      id: "market",
      title: "Market Data",
      subtitle: "Surface, Rates And Dividends",
      accent: "cyan",
      description:
        "The latest monthly volatility surface comes from the desk database; a month without an upload carries the last grid forward with that month's closes as the 100% anchors. The surface can be edited cell by cell, uploaded or downloaded. The Deep column always equals the 55% column. The forward pricing parameters, the rate curve and the future dividends drive pricing and travel in the surface file; the page shows the surface and its parameters.",
      metrics: [
        { label: "Sources", value: "Upload And Yahoo" },
        { label: "Fallback", value: "Built In Surface" },
      ],
      nodes: [
        { kind: "input", label: "Surface File", description: "Volatility Surface, Surface Parameters, Rate Curve and Dividends tabs." },
        { kind: "lookup", label: "Anchors", description: "Reference prices turn strike % columns into index points." },
        { kind: "output", label: "Active Dataset", description: "One dataset for every run." },
      ],
      formulas: [
        { name: "Column Strike", words: "Reference price of the underlying times the strike %.", inputs: "Reference Price, Strike %", output: "Column Strikes", value: () => "-" },
        { name: "Nifty Dividends", words: "Sensex points times the Nifty over Sensex reference prices.", inputs: "Dividends, Reference Prices", output: "Dividend Yield", value: (r) => fmtPercent(r.pricer.legs[0]?.dividends, 3) },
      ],
      edgeCases: ["A failed database write still applies an upload to the session and says so.", "Uploads over 4.5 megabytes are refused before sending."],
      insights: () => ["Download Current Surface writes a file that uploads back to the same surface."],
      outputs: [{ label: "Volatility Surface", href: "/market-data", value: (r) => `${r.pricer.legs.length} Legs Read` }],
    }),
    mod({
      id: "export",
      title: "Export",
      subtitle: "One File, Five Tabs",
      accent: "gold",
      description:
        "Download Excel writes the Summary Sheet, Pricer, Product Description, Day 1 Vega Hedge and Mark To Market And Margin tabs from the last run. The tables are the ones on screen, so the headers match. There are no pivots, inputs, market data or helper columns, and every date is a real date.",
      metrics: [
        { label: "Tabs", value: "Five" },
        { label: "Pivots", value: "None" },
      ],
      nodes: [
        { kind: "input", label: "Last Run", description: "The result of the last Run Simulation." },
        { kind: "process", label: "Desk Styling", description: "Masthead, headers, frozen panes and fitted columns." },
        { kind: "output", label: "Simulation File", description: "Named by underlying and valuation date." },
      ],
      formulas: [{ name: "File Name", words: "Hedging Sheet, the underlying and the valuation date.", inputs: "Underlying, Valuation Date", output: "File Name", value: (r) => `${r.inputs.underlying} ${formatDate(r.inputs.valuationDate)}` }],
      edgeCases: ["Download Excel is off until the first run."],
      insights: () => ["Download Current Surface on Market Data is the only other file the desk can fetch."],
      outputs: [{ label: "Simulation File", href: "/summary", value: () => "Five Tabs" }],
    }),
  ];
}
