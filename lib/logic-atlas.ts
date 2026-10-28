import type { FlowNodeSpec } from "@/components/atlas/logic-flow";

export type LogicFormula = { name: string; words: string; source: string };

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
  insights: string[];
  outputs: string[];
};

export type ComputationPrimitive = { name: string; category: string; uses: string; role: string };

function mod(m: Omit<LogicModule, "stageCount">): LogicModule {
  return { ...m, stageCount: m.nodes.length };
}

/** Descriptive copy only. `u` is the underlying name and `weekday` its expiry day, so no text hard-codes an index. */
export function logicModules(u: string, weekday: string): LogicModule[] {
  return [
    mod({
      id: "inputs",
      title: "Inputs",
      subtitle: "Live Defaults And Product Terms",
      accent: "cyan",
      description: `Inputs holds only inputs. Spot is the last completed ${u} close, the valuation date is today in India and the daily volatility is calculated from a year of closes. Product terms default to a 37% target, a 102.5% coupon, strikes of 137, 127, 125, 85, 84 and 70, decay 1.6 and a 1,940 day tenor. Nothing is saved: a refresh reloads the live defaults. Editing an input never reprices; Run Simulation does.`,
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
        { name: "Start Level", words: "Spot times one plus the uplift, rounded up to the next 100.", source: "Pricer B5" },
        { name: "Annual Volatility", words: "Daily volatility times the square root of 365.", source: "Summary I26" },
        { name: "Hedge Strike", words: "Spot rounded to the nearest 100 point listed strike.", source: "Day 1 Vega Hedge, hedge strike" },
      ],
      edgeCases: [
        "Spot stays blank when Yahoo does not answer; the run is blocked until it is above zero.",
        "Typing over the daily or annual volatility marks it Overridden; Reset recalculates it.",
        "Changing any input after a run marks the output tabs Inputs Changed.",
      ],
      insights: ["Market Data and Logic Atlas never need a run.", "The Download Excel button uses the last run."],
      outputs: ["Live spot", "Valuation date", "Daily volatility", "Product terms"],
    }),
    mod({
      id: "expiries",
      title: "Expiries",
      subtitle: `${u} Expiries Fall On ${weekday}`,
      accent: "purple",
      description: `Each observation expiry is a month number counted from the valuation date. The raw date is the valuation date plus the months times 30.5 days, rounded. The expiry is the ${weekday} nearest to that raw date, which is fixed by the exchange calendar for ${u}. The hedge uses the middle expiry, the lower one when the count is even.`,
      metrics: [
        { label: "Count", value: "One To Eight" },
        { label: "Weekday", value: weekday },
      ],
      nodes: [
        { kind: "input", label: "Month Numbers", description: "Strictly rising, such as 41, 44, 47, 50, 53 and 56." },
        { kind: "process", label: "Raw Date", description: "Valuation date plus the months times 30.5 days, rounded." },
        { kind: "process", label: "Nearest Weekday", description: `Up to three days forward to a ${weekday}, otherwise back.` },
        { kind: "output", label: "Expiry Dates", description: "Pricer row 20, the Summary Final Expiries and the Option Expiry." },
      ],
      formulas: [
        { name: "Raw Date", words: "Valuation date plus the month number times 30.5 days, rounded to whole days.", source: "Pricer row 20" },
        { name: "Expiry", words: `The ${weekday} nearest to the raw date: forward when three days or fewer away, otherwise back.`, source: "Pricer row 20" },
        { name: "Option Expiry", words: "The middle expiry; the lower middle for an even count.", source: "Pricer D5" },
        { name: "Maturity", words: "Valuation date plus the tenor in days.", source: "Product Description D41" },
      ],
      edgeCases: [
        "Months that do not rise strictly block the run.",
        "An expiry after maturity blocks the run.",
        "An expiry after the last surface row is allowed with a warning popup; it reads the last row.",
      ],
      insights: ["Sensex expiries are Thursdays and Nifty expiries are Tuesdays, per NSE and BSE notices from September 2025."],
      outputs: ["Expiry dates", "Option Expiry", "Maturity date"],
    }),
    mod({
      id: "strikes",
      title: "Strikes And Spreads",
      subtitle: "Strikes Define The Payoff",
      accent: "amber",
      description:
        "The strikes are the primary inputs, as a % of the start level, highest first. With n spreads there are n + 4 strikes: the spread levels, the protection strike, one point below it and the decay floor. Spreads are read from the strikes, so Spread 1 runs from Strike 3 to Strike 2 and Spread 2 from Strike 2 to Strike 1. The top participation is derived from the coupon and can be overridden. Units at each strike are the change in the payoff's slope across it.",
      metrics: [
        { label: "Strikes", value: "Spreads Plus Four" },
        { label: "Spreads", value: "One To Four" },
      ],
      nodes: [
        { kind: "input", label: "Strikes", description: "Strike 1 is the target; the last is the decay floor." },
        { kind: "process", label: "Spreads", description: "Buy and sell levels read from adjacent strikes. Editing a level writes its strike." },
        { kind: "process", label: "Participation", description: "The top spread takes the coupon left over by the lower spreads, divided by its width." },
        { kind: "output", label: "Units", description: "Slope above less slope below at each rounded rupee strike." },
      ],
      formulas: [
        { name: "Top Participation", words: "Coupon less the payout of the lower spreads, divided by the top spread width.", source: "Summary L10" },
        { name: "Spread Payout", words: "Spread width times its participation.", source: "Pricer C13 and C14" },
        { name: "Rupee Strike", words: "Start level times the strike %, rounded to whole rupees.", source: "Pricer B19" },
        { name: "Outflow Units", words: "Minus protection times decay times start level over the rupee width of the outflow step, less the slope below.", source: "Pricer Z47" },
        { name: "Floor Units", words: "Decay less the Floor Units input sets the slope below the floor.", source: "Pricer row 47, the floor strike" },
      ],
      edgeCases: [
        "Strikes not strictly descending, or any strike at or below zero, block the run.",
        "A participation at or below zero, or a coupon the spreads cannot reach, blocks the run.",
        "Protection not below 100%, a floor not below protection less the step, or Floor Units above the Decay block the run.",
      ],
      insights: ["The option book matches the client payoff at every strike to about 5e-15."],
      outputs: ["Derived spreads", "Participation rates", "Units per strike", "Buy and sell actions"],
    }),
    mod({
      id: "pricer",
      title: "Pricer",
      subtitle: "Every Live Leg On The Surface",
      accent: "gold",
      description:
        "Each live leg is one strike at one expiry, priced as a Black option on the forward. Volatility is a bilinear read of the surface plus the volatility bump, unless the leg is overridden. The rate curve is anchored at the valuation date and runs a year past the longest expiry, so Upper and Lower Maturity always resolve. Greeks come from bumping spot, time, volatility and rates and repricing. Contracts spread each strike's units across the expiries and the two halves of the book.",
      metrics: [
        { label: "Model", value: "Black On The Forward" },
        { label: "Greeks", value: "Bump And Reprice" },
      ],
      nodes: [
        { kind: "lookup", label: "Volatility", description: "FORECAST across the two nearest strike columns, then linear in days between expiry rows." },
        { kind: "lookup", label: "Rate Curve", description: "Upper and Lower Maturity bracket the expiry; the discount yield is the capped FORECAST." },
        { kind: "engine", label: "Price", description: "The forward is spot times e to the growth times time; the option is discounted at the discount yield." },
        { kind: "output", label: "Greeks And Book", description: "Delta, gamma, theta, vega and rho per leg and in rupees for the book." },
      ],
      formulas: [
        { name: "Forward", words: "Spot times e to the forward growth times days over 365.", source: "Pricer B31" },
        { name: "Forward Growth", words: "The Forward Sell Rate of the valuation month row of Pricing Params.", source: "Pricer B28, Pricing Params H69" },
        { name: "Discount Yield", words: "The smaller of the cap and the curve rate; the cap depends on the option type and Bid or Offer.", source: "Pricer B29" },
        { name: "Dividends", words: "Sum of implied dividends before maturity over spot, times 365 over days, times the bid or offer factor.", source: "Pricer B30" },
        { name: "Contracts", words: "Units times notional over the start level, over twice the live expiry count.", source: "Pricer B55" },
        { name: "Incremental Margin", words: "Zero on Bid, otherwise the Pricing Params value by expiry.", source: "Pricer B38" },
      ],
      edgeCases: [
        "A leg past the last surface row reads the last row.",
        "A leg override applies to that strike and expiry in both halves and is badged Overridden.",
        "A Call book keeps the same units; the linear difference is carried by futures.",
      ],
      insights: ["Rho bumps the forward growth and the discount yield together.", "Bid carries no incremental margin."],
      outputs: ["Leg prices", "Leg Greeks", "Contracts", "Book premium"],
    }),
    mod({
      id: "solver",
      title: "Solver",
      subtitle: "Goal Seek On The Inbuilt",
      accent: "rose",
      description:
        "The mobilisation is split into the Inbuilt, costs, the NBFC deposit, the option premium and the margin. Each pot grows at its own rate to maturity, and the Inbuilt is solved so the total equals the notional times one plus the coupon. Brent's method with a bisection fallback replaces the sheet's goal seek macro and runs on every Run Simulation. The margin from the stress grid feeds the pots; the loop settles on the first pass because the margin does not depend on the Inbuilt.",
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
        { name: "Maturity Payout", words: "NBFC amount grown at the NBFC rate, plus premium grown at the premium rate, plus margin grown at the margin rate, over the tenor.", source: "Pricer O5" },
        { name: "Achieved Coupon", words: "Payout over mobilisation, less one.", source: "Pricer P5" },
        { name: "Goal Seek", words: "Set the achieved coupon to the coupon by changing the Inbuilt in rupees.", source: "Macro2, Pricer H5" },
        { name: "Margin", words: "The total requirement at the 0% move over notional.", source: "Summary Q10" },
      ],
      edgeCases: ["If no Inbuilt reaches the coupon the run reports it rather than showing a stale value."],
      insights: ["The Debug Drawer lists every goal seek step of the last run."],
      outputs: ["Actual Inbuilt", "Maturity payout", "Internal rate of return"],
    }),
    mod({
      id: "summary",
      title: "Summary",
      subtitle: "One Page Of The Book",
      accent: "green",
      description:
        "The Summary Sheet collects the market and rates, the product specification, the final expiries, the Greeks, the costs, the options per strike and the vega hedge. Option details sum each strike's contracts across expiries and both halves and average its price. Weighted Average Volatility weights each leg by its signed vega, as the sheet does, so long and short legs offset; the absolute version sits beside it.",
      metrics: [
        { label: "Tables", value: "Eight" },
        { label: "Totals", value: "Both Halves" },
      ],
      nodes: [
        { kind: "input", label: "Priced Legs", description: "Every leg's contracts, price, vega and rho." },
        { kind: "process", label: "Per Strike", description: "Quantity in lakh, average price and premium in crore." },
        { kind: "output", label: "Summary Tables", description: "The same tables are written to the Excel file." },
      ],
      formulas: [
        { name: "Quantity", words: "Sum of a strike's contracts over 100,000.", source: "Summary D23" },
        { name: "Premium", words: "Minus quantity times average price, in crore.", source: "Summary F23" },
        { name: "Weighted Average Volatility", words: "Sum of volatility times vega in rupees over the sum of vega in rupees.", source: "Summary G15" },
        { name: "Weighted Average Forward", words: "Sum of forward growth times rho in rupees over the sum of rho in rupees.", source: "Summary I15" },
      ],
      edgeCases: ["When the book's vega sums to zero the weighted volatility shows a dash with the reason."],
      insights: ["Delta % is book delta times spot over mobilisation."],
      outputs: ["Product Greeks", "Options Details", "Day 1 Vega Hedge row"],
    }),
    mod({
      id: "product",
      title: "Product Description",
      subtitle: "Term Sheet And Payoff",
      accent: "amber",
      description:
        "The Product Description re-proves the payout from the three pots and lists the Greek details the desk quotes. The payoff is generated from the inputs at every strike, the protection level and 0.01% below it, zero, and every 5% between. Above protection the client earns the spread ladder capped at the coupon; below it losses run at the decay rate, easing past the floor. The chart shows the payoff, the index level, the strikes and the protection band.",
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
        { name: "Options Delta", words: "Options quantity times the hedge option delta.", source: "Product Description H35" },
        { name: "Residual Futures", words: "Total Delta Required less Options Delta.", source: "Product Description H36" },
        { name: "Client Return Above Protection", words: "The smaller of the coupon and the sum of each spread's participation times the move inside it.", source: "Product Description K32" },
        { name: "Client Return Below Protection", words: "The larger of −100% and the decayed loss, eased past the floor by the floor units.", source: "Product Description K32" },
        { name: "Pre Tax Internal Rate Of Return", words: "One plus the return, raised to 365 over the tenor, less one.", source: "Product Description L32" },
      ],
      edgeCases: ["Below −90% the client return equals the index move."],
      insights: ["The hedge quantity is negative because the listed options are sold."],
      outputs: ["Term Sheet", "Greek Details", "Payoff scenarios", "Payoff chart"],
    }),
    mod({
      id: "dayone",
      title: "Day 1 Vega Hedge",
      subtitle: "Listed Options Against Book Vega",
      accent: "cyan",
      description:
        "Listed options at the hedge strike and the Option Expiry are sold so their vega cancels the book's vega. Each is valued three ways for every move from −50% to +20%: fair from the surface, exchange at the flat annual volatility, and stressed after a sigma shock. The margin is the stressed less the exchange price, plus the change in fair value, plus an exposure charge on the level.",
      metrics: [
        { label: "Blocks", value: "Fair, Exchange, Stressed" },
        { label: "Moves", value: "Fifteen" },
      ],
      nodes: [
        { kind: "input", label: "Book Vega", description: "The vega of every leg in rupees." },
        { kind: "process", label: "Quantity", description: "Minus book vega over the vega of one hedge option at the 0% move." },
        { kind: "engine", label: "Three Prices", description: "Fair, exchange and stressed, each on the Pricer row set." },
        { kind: "output", label: "Option Margin", description: "Initial plus exposure margin per move." },
      ],
      formulas: [
        { name: "Quantity", words: "Product vega in crore times 1e7 over the hedge vega at 0%.", source: "Day 1 Vega Hedge K26" },
        { name: "Stressed Level", words: "Level times one less sigmas times daily volatility times the root of the shock days.", source: "Day 1 Vega Hedge D62" },
        { name: "Fair Growth", words: "On Bid, a Put takes the larger of the discount less dividends and the Forward Sell Rate.", source: "Day 1 Vega Hedge O26" },
        { name: "Initial Margin", words: "Stressed less exchange price, plus fair less day 1 fair price, times quantity, in crore.", source: "Day 1 Vega Hedge L8" },
        { name: "Exposure Margin", words: "Exposure rate times level times quantity, in crore.", source: "Day 1 Vega Hedge M8" },
      ],
      edgeCases: ["The fair volatility can be overridden on the tab and is badged when it is."],
      insights: ["Upper and Lower Maturity resolve on every row because the curve runs past the expiry."],
      outputs: ["Hedge quantity", "Day 1 fair price", "Option margin per move"],
    }),
    mod({
      id: "mtm",
      title: "Mark To Market And Margin",
      subtitle: "Cash Under Stress",
      accent: "rose",
      description:
        "For each move the spot bump is set, the book delta is read and the bump is reset to zero, as the MTM macro does. Book delta plus the hedge delta is the residual futures position. Futures margin is charged on its notional value, mark to market is built outward from the 0% row, and the option margin comes from the Day 1 Vega Hedge. The 0% total is the margin funded in the Pricer.",
      metrics: [
        { label: "Range", value: "−50% To +20%" },
        { label: "Funded Row", value: "0%" },
      ],
      nodes: [
        { kind: "engine", label: "Set Bump", description: "Reprice every leg at the bumped spot." },
        { kind: "process", label: "Read Delta", description: "Product requirement in lakh." },
        { kind: "process", label: "Reset Bump", description: "Back to zero after every move." },
        { kind: "output", label: "Total Requirement", description: "Futures margin, mark to market and option margin." },
      ],
      formulas: [
        { name: "Residual Futures", words: "Product requirement plus option delta, in lakh.", source: "MTM G6" },
        { name: "Futures Margin", words: "Minus residual futures times the futures margin rate times the level, in crore.", source: "MTM H6" },
        { name: "Step Mark To Market", words: "Residual of the row nearer 0% times the level change, in crore.", source: "MTM P6" },
        { name: "Total", words: "Futures margin plus cumulative mark to market plus option margin.", source: "MTM K6" },
      ],
      edgeCases: ["The spot bump is checked to be zero after every run."],
      insights: ["The worst case is shown for reference; the funded margin is the 0% row, as the sheet does."],
      outputs: ["Margin requirement", "Worst case requirement"],
    }),
    mod({
      id: "market",
      title: "Market Data",
      subtitle: "Surface, Rates And Dividends",
      accent: "cyan",
      description:
        "The latest monthly vol surface comes from the desk database; a month without an upload carries the last grid forward with that month's closes on the first session as the 100% anchors. The surface can be edited cell by cell, uploaded or downloaded in the upload layout. Only the forward Pricing Params grid and future dividends are shown, because older rows are never looked up by a live expiry.",
      metrics: [
        { label: "Sources", value: "Upload And Yahoo" },
        { label: "Fallback", value: "Built In Surface" },
      ],
      nodes: [
        { kind: "input", label: "Surface File", description: "Vol Surface, Surface Parameters, Rate Curve and Dividends sheets." },
        { kind: "lookup", label: "Anchors", description: "Reference prices turn Strike Change columns into rupee strikes." },
        { kind: "output", label: "Active Dataset", description: "One dataset for every run." },
      ],
      formulas: [
        { name: "Column Strike", words: "Reference price of the underlying times the Strike Change.", source: "Vol Surface strike rows" },
        { name: "Nifty Dividends", words: "Sensex points times the Nifty over Sensex reference prices.", source: "Pricer B30" },
      ],
      edgeCases: ["A failed database write still applies an upload to the session and says so.", "Uploads over 4.5 MB are refused before sending."],
      insights: ["Download Surface writes a file that uploads back to the same surface."],
      outputs: ["Vol surface", "Forward Pricing Params", "Future dividends"],
    }),
    mod({
      id: "params",
      title: "Surface Parameters",
      subtitle: "Every Pricing Params Value The Pricer Reads",
      accent: "purple",
      description:
        "Surface Parameters holds each value the Pricer reads from Pricing Params: Bid or Offer, the volatility bump, the incremental and full margins, the margin cost, the Forward Sell Rate, the dividend factor and the two rate caps. Defaults are this month's values; saving writes them to this month in the desk database and to every row of the forward grid. The rate curve is a list of tenors anchored at the valuation date, and linked points follow the Premium Growth Rate.",
      metrics: [
        { label: "Saved", value: "Per Month" },
        { label: "Reset", value: "From The Database" },
      ],
      nodes: [
        { kind: "input", label: "Parameters", description: "Edited in a Parameter and Value table." },
        { kind: "process", label: "Forward Grid", description: "Scalars written to every row from the valuation month on." },
        { kind: "output", label: "Pricer Inputs", description: "Rows 28, 29, 30, 33, 34, 38, 39, 43 and 44." },
      ],
      formulas: [
        { name: "Rate Cap While Selling Forward", words: "The last rate curve point.", source: "Pricing Params O2 = MarketData D34 ÷ 100" },
        { name: "Rate Cap While Buying Forward", words: "Typed, 6.80% by default.", source: "Pricing Params N2" },
        { name: "Dividend Bid Or Offer Factor", words: "Applied to a Put on Offer and a Call on Bid.", source: "Pricing Params M2" },
      ],
      edgeCases: ["Tenors must rise strictly; values must sit between 0% and 100%."],
      insights: ["The selling cap is shown for completeness; it is read from the curve, not typed."],
      outputs: ["Bid or Offer", "Rate caps", "Forward grid", "Rate curve"],
    }),
    mod({
      id: "export",
      title: "Export",
      subtitle: "One File, Five Sheets",
      accent: "gold",
      description:
        "Download Excel writes the Summary Sheet, Pricer, Product Description, Day 1 Vega Hedge and Mark To Market And Margin sheets from the last run. The tables are the ones on screen, so the headers match: % strikes over real expiry dates in the Pricer. There are no pivots, inputs, market data or helper columns, and every date is a real date.",
      metrics: [
        { label: "Sheets", value: "Five" },
        { label: "Pivots", value: "None" },
      ],
      nodes: [
        { kind: "input", label: "Last Run", description: "The result of the last Run Simulation." },
        { kind: "process", label: "Desk Styling", description: "Masthead, maroon headers, frozen panes and fitted columns." },
        { kind: "output", label: "Simulation File", description: "Named by underlying and valuation date." },
      ],
      formulas: [{ name: "File Name", words: "SP Hedging Sheet, the underlying and the valuation date.", source: "Export" }],
      edgeCases: ["Download Excel is disabled until the first run."],
      insights: ["Download Surface on Market Data is the only other file the desk can fetch."],
      outputs: ["Hedging Sheet simulation file"],
    }),
  ];
}

export const COMPUTATION_PRIMITIVES: ComputationPrimitive[] = [
  { name: "Black Price On The Forward", category: "Pricing", uses: "Every leg and every hedge row", role: "Option price from forward, strike, volatility, time and discount." },
  { name: "Bump And Reprice", category: "Greeks", uses: "Delta, gamma, theta, vega, rho", role: "Finite differences exactly as the sheet takes them." },
  { name: "Bilinear Surface Read", category: "Market", uses: "Leg and fair volatility", role: "FORECAST across strikes, then linear in days." },
  { name: "Curve FORECAST", category: "Market", uses: "Discount yield, Upper and Lower Forward", role: "Straight line between the bracketing curve dates." },
  { name: "Nearest Weekday", category: "Schedule", uses: "Every expiry", role: "Snap the raw date to the underlying's expiry day." },
  { name: "Slope Change", category: "Replication", uses: "Units per strike", role: "Turn the payoff into an option book." },
  { name: "Brent Goal Seek", category: "Solver", uses: "Actual Inbuilt", role: "Replace Macro2 with a bracketed root find." },
  { name: "Set, Read, Reset", category: "Stress", uses: "Fifteen moves", role: "Replace the MTM macro without leaving the spot shocked." },
];
