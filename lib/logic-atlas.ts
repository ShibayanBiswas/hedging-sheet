import type { FlowNodeSpec } from "@/components/atlas/logic-flow";

export type LogicModule = {
  id: string;
  title: string;
  subtitle: string;
  accent: "amber" | "cyan" | "purple" | "green" | "rose" | "gold";
  purpose: string;
  stageCount: number;
  metrics: Array<{ label: string; value: string }>;
  nodes: FlowNodeSpec[];
  flows: string[];
  insights: string[];
  outputs: string[];
};

function mod(m: Omit<LogicModule, "stageCount">): LogicModule {
  return { ...m, stageCount: m.nodes.length };
}

/** Descriptive copy only. `u` is the underlying name so no text hard-codes an index. */
export function logicModules(u: string): LogicModule[] {
  return [
    mod({
      id: "market",
      title: "Market Data Intake",
      subtitle: "Surface, rates and dividends",
      accent: "cyan",
      purpose:
        "The monthly vol surface, the Pricing Params and the rate curve are read in, and the live close is fetched for the chosen index. Workbook Defaults keep the saved surface so the approved numbers hold.",
      metrics: [
        { label: "Sources", value: "Upload and Yahoo" },
        { label: "Fallback", value: "Built In Seed" },
      ],
      nodes: [
        { kind: "input", label: "Monthly vol surface", description: "Strike Change columns and expiry rows are uploaded or taken from the desk database." },
        { kind: "lookup", label: "Reference prices", description: `The 100 percent anchor of the surface is set for Nifty and Sensex. The ${u} anchor turns each column into a rupee strike.` },
        { kind: "input", label: "Live close", description: "The last completed session close is fetched, never an intraday print." },
        { kind: "output", label: "Active dataset", description: "One dataset feeds every page, and the app keeps running from the seeds when the database is away." },
      ],
      flows: ["Upload replaces the active surface", "A month without an upload carries the previous grid forward"],
      insights: [
        "The surface is carried into the current month with that month's anchors when no new file has arrived.",
        "A failed database write still applies the upload to the session and says so.",
      ],
      outputs: ["Vol surface", "Pricing Params", "Rate curve", "Implied dividends", "Live spot"],
    }),
    mod({
      id: "terms",
      title: "Product Terms and Payoff Construction",
      subtitle: "From terms to a payoff line",
      accent: "amber",
      purpose:
        "The target, coupon, spreads, protection and decay are turned into one piecewise payoff. The start level is the spot plus a small uplift, rounded up to the next hundred.",
      metrics: [
        { label: "Kinks", value: "Spreads, protection, floor" },
        { label: "Cap", value: "Maximum coupon" },
      ],
      nodes: [
        { kind: "input", label: "Product terms", description: "Target, coupon, protection, decay, tenor and the spread cards are read from the inputs." },
        { kind: "process", label: "Upside ladder", description: "Each spread adds its participation between its buy and sell levels, and the total is capped at the coupon." },
        { kind: "process", label: "Downside", description: "Below the protection level losses run at the decay rate, easing past the decay floor." },
        { kind: "output", label: "Payoff table", description: "Levels are generated from every strike, the protection step, zero and regular steps in between." },
      ],
      flows: ["Terms shape the payoff", "The payoff shapes the legs"],
      insights: [
        "The last spread can take its participation from the coupon so the ladder always ties out.",
        "The protection step is shown with a level just below it so the drop is visible.",
      ],
      outputs: ["Payoff table", "Payoff chart", "Pre tax internal rate of return"],
    }),
    mod({
      id: "legs",
      title: "Leg Replication",
      subtitle: "Puts that copy the payoff",
      accent: "gold",
      purpose:
        "The payoff is rebuilt from puts. At each strike the number of units is the change in slope of the payoff across that strike, so any shape of spreads is replicated exactly.",
      metrics: [
        { label: "Strikes", value: "One per kink" },
        { label: "Halves", value: "Two identical" },
      ],
      nodes: [
        { kind: "input", label: "Payoff kinks", description: "The strikes are the spread levels, the protection level, one point below it and the decay floor." },
        { kind: "process", label: "Slope change", description: "Units are bought where the slope rises and sold where it falls, using the rounded rupee strikes." },
        { kind: "process", label: "Spread across expiries", description: "Each strike is split evenly across the observation expiries and the two halves of the grid." },
        { kind: "output", label: "Contracts", description: "Units times notional over the start level gives the contracts for every leg." },
      ],
      flows: ["Strike count must equal the expiry count before pricing"],
      insights: [
        "With the saved terms the units are sell 10.05, buy 9.05, buy 1, sell 25.6, buy 24 and buy 1.",
        "The legs reproduce the client payoff at every level outside the one point outflow band.",
      ],
      outputs: ["Units per strike", "Contracts per leg", "Buy and sell actions"],
    }),
    mod({
      id: "pricing",
      title: "Option Pricing and Greeks",
      subtitle: "Every leg on the surface",
      accent: "purple",
      purpose:
        "The vol surface is read for each leg's strike and expiry, and a fair price is produced for every option. Greeks come from small bumps of spot, time, volatility and rates.",
      metrics: [
        { label: "Model", value: "Black on the forward" },
        { label: "Greeks", value: "Bump and reprice" },
      ],
      nodes: [
        { kind: "lookup", label: "Volatility", description: "The surface is read across the two nearest strike columns and between the two nearest expiry rows." },
        { kind: "lookup", label: "Forward and discount", description: "Spot grows at the Forward Sell Rate, and the discount yield comes from the rate curve under its cap." },
        { kind: "engine", label: "Price", description: "A put is priced on the forward and discounted to the valuation date." },
        { kind: "output", label: "Greeks", description: "Delta, gamma, theta, vega and rho are taken from repriced bumps, as the workbook does." },
      ],
      flows: ["Prices feed the premium", "Greeks feed the hedge and the margin grid"],
      insights: [
        "The rate curve in the saved workbook ends before the trade date, so every leg reads its last point.",
        "Rho bumps the forward growth and the discount yield together.",
      ],
      outputs: ["Leg prices", "Book premium", "Book Greeks"],
    }),
    mod({
      id: "solver",
      title: "Inbuilt Solver",
      subtitle: "Three pots to the target payout",
      accent: "rose",
      purpose:
        "The money is split into the NBFC deposit, the option premium pot and the margin pot. The Inbuilt is solved so the three pots grow to exactly the target payout at maturity.",
      metrics: [
        { label: "Method", value: "Brent with bisection" },
        { label: "Tolerance", value: "Ten to the minus ten" },
      ],
      nodes: [
        { kind: "input", label: "Costs and rates", description: "Transaction, issuance and margin costs, and the NBFC, premium and margin growth rates." },
        { kind: "process", label: "Pots", description: "Whatever is not Inbuilt, cost or margin sits with the NBFC; the premium and margin grow on their own rates." },
        { kind: "engine", label: "Solve", description: "The Inbuilt is moved until the grown pots meet the coupon. This replaces the goal seek macro." },
        { kind: "output", label: "Actual Inbuilt", description: "The issuer margin as a share of notional, with the payout and internal rate of return." },
      ],
      flows: ["Margin enters the pots", "The solved Inbuilt sets the NBFC amount"],
      insights: ["The solve runs on every change, so the Inbuilt is never stale."],
      outputs: ["Actual Inbuilt", "Maturity payout", "Internal rate of return"],
    }),
    mod({
      id: "loop",
      title: "Margin and Inbuilt Loop",
      subtitle: "Closing the circle",
      accent: "green",
      purpose:
        "The margin from the stress grid is funded in the pots, and the pots set the Inbuilt. The two are iterated until the margin stops moving.",
      metrics: [
        { label: "Passes", value: "Up to 50" },
        { label: "Settles", value: "First pass here" },
      ],
      nodes: [
        { kind: "input", label: "Margin", description: "The total requirement at the 0 percent move, as a share of notional." },
        { kind: "engine", label: "Inbuilt solve", description: "The pots are solved with that margin." },
        { kind: "process", label: "Check", description: "The margin is recomputed and compared with the last pass." },
        { kind: "output", label: "Settled book", description: "In this product the margin does not depend on the Inbuilt, so the loop settles at once." },
      ],
      flows: ["The worksheet broke this loop by hand with pasted values"],
      insights: ["The pass count is shown in the debug drawer below."],
      outputs: ["Margin funded in the Pricer", "Loop pass count"],
    }),
    mod({
      id: "vega",
      title: "Day 1 Vega Hedge",
      subtitle: "Listed puts against book vega",
      accent: "cyan",
      purpose:
        "Listed puts at the money are sold so their vega cancels the vega of the book. The hedge is valued at fair, exchange and stressed prices for every move.",
      metrics: [
        { label: "Blocks", value: "Fair, exchange, stressed" },
        { label: "Moves", value: "Fifteen" },
      ],
      nodes: [
        { kind: "input", label: "Book vega", description: "The vega of every leg, summed across both halves." },
        { kind: "process", label: "Hedge size", description: "Book vega over the vega of one hedge put at the current level gives the quantity." },
        { kind: "engine", label: "Three prices", description: "Fair from the surface, exchange at the flat annual volatility, stressed after a sharp spot and volatility shock." },
        { kind: "output", label: "Option margin", description: "Stress less exchange price plus the move in fair value, with an exposure charge on the level." },
      ],
      flows: ["Hedge delta and option margin feed the stress grid"],
      insights: ["Upper and Lower Maturity read a dash when the rate curve has no point beyond the expiry."],
      outputs: ["Hedge quantity", "Day 1 fair price", "Option margin per move"],
    }),
    mod({
      id: "mtm",
      title: "Mark to Market and Margin Scenarios",
      subtitle: "Cash under stress",
      accent: "amber",
      purpose:
        "For each move of the index the book delta is repriced directly, netted with the hedge delta, and turned into futures margin, cumulative mark to market and option margin.",
      metrics: [
        { label: "Range", value: "Minus 50 to plus 20" },
        { label: "Margin row", value: "0 percent" },
      ],
      nodes: [
        { kind: "engine", label: "Book delta", description: "Every leg is repriced at the shocked level. No shocked spot is left behind, unlike the old macro." },
        { kind: "process", label: "Residual futures", description: "Book delta plus hedge delta is the futures position still to be done." },
        { kind: "process", label: "Mark to market", description: "Each step outward from the current level is marked on the residual of the step before it." },
        { kind: "output", label: "Total requirement", description: "Futures margin, mark to market and option margin, with the worst case shown next to the 0 percent row." },
      ],
      flows: ["The 0 percent row returns to the pots as the margin"],
      insights: ["The worst case is shown for reference; the funded margin follows the workbook and uses the 0 percent row."],
      outputs: ["Margin requirement", "Worst case requirement"],
    }),
    mod({
      id: "excel",
      title: "Excel Simulation",
      subtitle: "One download, five sheets",
      accent: "gold",
      purpose:
        "The Summary Sheet, Pricer, Product Description, Day 1 Vega Hedge and Mark to Market sheets are written with real number formats, the desk masthead and the logo.",
      metrics: [
        { label: "Sheets", value: "Five" },
        { label: "Formats", value: "Native numbers and dates" },
      ],
      nodes: [
        { kind: "input", label: "Priced book", description: "The same tables shown on screen are reused, so the file matches the pages." },
        { kind: "process", label: "Desk styling", description: "A gold rule, maroon title band, section bands, frozen headers and fitted columns." },
        { kind: "output", label: "Workbook", description: "Named by underlying and valuation date, with blank dates written as a dash." },
      ],
      flows: ["Download Excel is the only download in the app"],
      insights: ["The sample vol surface on Market Data is the one other file the desk can fetch."],
      outputs: ["Hedging Sheet workbook"],
    }),
  ];
}
