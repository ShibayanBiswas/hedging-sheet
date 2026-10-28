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

/** Descriptive copy only. `u` is the underlying name and `weekday` its expiry day, so no text hard-codes an index. */
export function logicModules(u: string, weekday: string): LogicModule[] {
  return [
    mod({
      id: "market",
      title: "Market Data Intake",
      subtitle: "Spot, surface, rates and volatility",
      accent: "cyan",
      purpose:
        "The last completed close sets the spot and the valuation date is today in India. The latest monthly vol surface and its parameters come from the desk database, and the daily volatility is calculated from one year of closes.",
      metrics: [
        { label: "Sources", value: "Upload and Yahoo" },
        { label: "Fallback", value: "Built In Seed" },
      ],
      nodes: [
        { kind: "input", label: "Live close", description: "The last completed session close is fetched for Nifty and Sensex, never an intraday print." },
        { kind: "input", label: "Monthly vol surface", description: "Strike Change columns and expiry rows are uploaded or read from the latest month in the desk database." },
        { kind: "lookup", label: "Surface parameters", description: `Reference prices, Bid or Offer, the rate curve tenors and dividends. The ${u} reference price turns each column into a rupee strike.` },
        { kind: "process", label: "Daily volatility", description: "The standard deviation of daily log returns over the history window, which the desk can override." },
        { kind: "output", label: "Active dataset", description: "One dataset feeds every page, and the app keeps running from the built in seed when the database is away." },
      ],
      flows: ["Upload replaces the active surface", "A month without an upload carries the previous grid forward"],
      insights: [
        "Spot, valuation date and daily volatility always load live; nothing is pinned to a saved day.",
        "A failed database write still applies the upload to the session and says so.",
      ],
      outputs: ["Vol surface", "Pricing Params", "Rate curve", "Implied dividends", "Live spot", "Daily volatility"],
    }),
    mod({
      id: "terms",
      title: "Strikes and Payoff Construction",
      subtitle: "Six strikes define the product",
      accent: "amber",
      purpose:
        "The strikes are the primary inputs. The spreads, the target, the protection level and the decay floor are read from them, and the top participation is derived from the coupon. The start level is the spot plus a small uplift, rounded up to the next hundred.",
      metrics: [
        { label: "Strikes", value: "Spreads plus four" },
        { label: "Cap", value: "Maximum coupon" },
      ],
      nodes: [
        { kind: "input", label: "Strikes", description: "Strike 1 is the target. Each pair below it is a spread, then the protection level, the outflow strike and the decay floor." },
        { kind: "process", label: "Spreads", description: "Spread 1 runs from Strike 3 to Strike 2 and Spread 2 from Strike 2 to Strike 1. Editing a spread writes back to its strikes." },
        { kind: "process", label: "Participation", description: "The top spread takes whatever coupon the lower spreads leave, divided by its width. Any participation can be overridden and reset." },
        { kind: "process", label: "Downside", description: "Below the protection level losses run at the decay rate, easing past the decay floor." },
        { kind: "output", label: "Payoff table", description: "Levels are generated from every strike, the protection step, zero and regular steps in between." },
      ],
      flows: ["Strikes shape the payoff", "The payoff shapes the legs"],
      insights: [
        "Strikes must fall strictly from Strike 1 to the floor; a popup names the strike to fix.",
        "The protection step is shown with a level just below it so the drop is visible.",
      ],
      outputs: ["Payoff table", "Payoff chart", "Pre tax internal rate of return"],
    }),
    mod({
      id: "schedule",
      title: "Expiry Schedule",
      subtitle: `${u} expiries fall on ${weekday}`,
      accent: "purple",
      purpose: `Each observation expiry is a number of months from the valuation date. The date is the ${weekday} nearest to the valuation date plus the months times 30.5 days.`,
      metrics: [
        { label: "Expiries", value: "One to eight" },
        { label: "Weekday", value: weekday },
      ],
      nodes: [
        { kind: "input", label: "Expiry months", description: "Months must rise strictly from the first expiry to the last." },
        { kind: "process", label: "Raw date", description: "Valuation date plus the months times 30.5 days, rounded to whole days." },
        { kind: "process", label: "Nearest weekday", description: `The nearest ${weekday}: up to three days forward, otherwise back.` },
        { kind: "output", label: "Option expiry", description: "The hedge uses the middle expiry, taking the lower one when the count is even." },
      ],
      flows: ["Expiries set the leg maturities", "The middle expiry sets the hedge"],
      insights: [
        "The weekday follows the exchange calendar for the underlying and is not editable.",
        "An expiry past the last surface row is allowed with a warning; it reads the last row.",
      ],
      outputs: ["Expiry dates", "Option expiry", "Maturity date"],
    }),
    mod({
      id: "legs",
      title: "Leg Replication",
      subtitle: "Options that copy the payoff",
      accent: "gold",
      purpose:
        "The payoff is rebuilt from options of the chosen type. At each strike the number of units is the change in slope of the payoff across that strike, so any shape of spreads is replicated exactly.",
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
      flows: ["Option Type feeds every Option Type column"],
      insights: [
        "The book is checked against the client payoff at every kink; the largest gap is in the debug drawer.",
        "A call book uses the same units; the linear difference is carried by the futures hedge.",
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
        { kind: "lookup", label: "Volatility", description: "The surface is read across the two nearest strike columns and between the two nearest expiry rows. Any leg can be overridden on the Pricer." },
        { kind: "lookup", label: "Rate curve", description: "The curve is anchored at the valuation date and runs a year past the longest expiry, so Upper and Lower Maturity always resolve." },
        { kind: "lookup", label: "Forward and discount", description: "Spot grows at the Forward Sell Rate of the valuation month. The discount yield is the curve rate, capped by option type and side." },
        { kind: "engine", label: "Price", description: "Each option is priced on the forward and discounted to the valuation date, on the Bid or Offer side set in the surface parameters." },
        { kind: "output", label: "Greeks", description: "Delta, gamma, theta, vega and rho are taken from repriced bumps." },
      ],
      flows: ["Prices feed the premium", "Greeks feed the hedge and the margin grid"],
      insights: [
        "Rho bumps the forward growth and the discount yield together.",
        "Overridden volatilities are marked on the Pricer and can be reset in one click.",
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
      insights: ["The solve runs on every Run Simulation, so the Inbuilt always matches the inputs that were run."],
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
      flows: ["The original sheet broke this loop by hand with pasted values"],
      insights: ["The pass count is shown in the debug drawer below."],
      outputs: ["Margin funded in the Pricer", "Loop pass count"],
    }),
    mod({
      id: "vega",
      title: "Day 1 Vega Hedge",
      subtitle: "Listed options against book vega",
      accent: "cyan",
      purpose:
        "Listed options at the money are sold so their vega cancels the vega of the book. The hedge is valued at fair, exchange and stressed prices for every move.",
      metrics: [
        { label: "Blocks", value: "Fair, exchange, stressed" },
        { label: "Moves", value: "Fifteen" },
      ],
      nodes: [
        { kind: "input", label: "Book vega", description: "The vega of every leg, summed across both halves." },
        { kind: "process", label: "Hedge size", description: "Book vega over the vega of one hedge option at the current level gives the quantity." },
        { kind: "engine", label: "Three prices", description: "Fair from the surface or the override, exchange at the flat annual volatility, stressed after a sharp spot and volatility shock." },
        { kind: "output", label: "Option margin", description: "Stress less exchange price plus the move in fair value, with an exposure charge on the level." },
      ],
      flows: ["Hedge delta and option margin feed the stress grid"],
      insights: ["The fair volatility can be overridden on the Day 1 Vega Hedge tab and is badged when it is."],
      outputs: ["Hedge quantity", "Day 1 fair price", "Option margin per move"],
    }),
    mod({
      id: "mtm",
      title: "Mark to Market and Margin Scenarios",
      subtitle: "Cash under stress",
      accent: "amber",
      purpose:
        "For each move of the index the spot bump is set, the book delta is read, and the bump is reset to zero. The delta is netted with the hedge delta and turned into futures margin, cumulative mark to market and option margin.",
      metrics: [
        { label: "Range", value: "Minus 50 to plus 20" },
        { label: "Margin row", value: "0 percent" },
      ],
      nodes: [
        { kind: "engine", label: "Set bump", description: "Every leg is repriced at the shocked level." },
        { kind: "process", label: "Read delta", description: "Book delta plus hedge delta is the futures position still to be done." },
        { kind: "process", label: "Reset bump", description: "The bump goes back to zero after every move, so no shocked spot is left behind." },
        { kind: "process", label: "Mark to market", description: "Each step outward from the current level is marked on the residual of the step before it." },
        { kind: "output", label: "Total requirement", description: "Futures margin, mark to market and option margin, with the worst case shown next to the 0 percent row." },
      ],
      flows: ["The 0 percent row returns to the pots as the margin"],
      insights: ["The worst case is shown for reference; the funded margin uses the 0 percent row, as the original sheet does."],
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
        { kind: "input", label: "Last run", description: "The tables of the last Run Simulation are reused, so the file matches the pages." },
        { kind: "process", label: "Desk styling", description: "A gold rule, maroon title band, section bands, frozen headers and fitted columns." },
        { kind: "output", label: "Simulation file", description: "Named by underlying and valuation date, with blank dates written as a dash." },
      ],
      flows: ["Download Excel is enabled after the first run"],
      insights: ["The sample vol surface on Market Data is the one other file the desk can fetch."],
      outputs: ["Hedging Sheet simulation file"],
    }),
  ];
}
