import { formatDate, isValidYmd } from "@/lib/engine/dates";
import { annualVolFromDaily } from "@/lib/engine/hedging-sheet";
import { EXPIRY_WEEKDAY, medianExpiryIndex, WEEKDAY_NAMES } from "@/lib/engine/schedule";
import { deriveTerms, startLevel } from "@/lib/engine/structure";
import type { HedgingResult, MarketData, Underlying } from "@/lib/engine/types";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";
import { underlyingName, type DeskInputs } from "@/lib/inputs/draft";
import { marginHeadline, pricerHeadline, productHeadline, summaryHeadline, vegaHeadline, displayCell, type OutputTab, type TableSpec } from "@/lib/tables";

/** Input: typed or fetched. Calculation: derived from earlier stages. Check: tests a result. Output: what a result tab shows. */
export type StageKind = "Input" | "Calculation" | "Check" | "Output";

type AtlasValue = { label: string; value: string };

export type AtlasStage = {
  id: string;
  title: string;
  kind: StageKind;
  /** What the stage does with the inputs on screen, in plain words. */
  description: string;
  /** Stage ids this stage reads from. */
  uses: string[];
  /** Stage ids that read this stage, filled from every stage's uses. */
  feeds: string[];
  /** The rule in plain words. */
  rule: string;
  /** Key values from the last run, or null before one. */
  lastRun: AtlasValue[] | null;
};

export type AtlasInsight = { id: string; title: string; text: string };

export type AtlasOutput = { tab: OutputTab; title: string; href: string; values: AtlasValue[] };

/** Volatility history behind the daily figure, when it was computed. */
export type VolHistory = { observations: number | null; from: string | null; to: string | null };

const num = (v: number, digits = 2) => fmtNumber(v, digits);
const pct = (v: number, digits = 2) => fmtPercent(v, digits);
const crore = (v: number, digits = 2) => `${fmtCrore(v, digits)} Crore`.replace(/^- Crore$/, "-");
const date = (ymd: string | null | undefined) => formatDate(ymd && isValidYmd(ymd) ? ymd : null);
const span = (values: number[], show: (v: number) => string) => (values.length ? `${show(Math.min(...values))} To ${show(Math.max(...values))}` : "-");

/** The hedge strike rule as the Atlas states it. */
export function hedgeRuleText(u: Underlying | ""): string {
  if (u === "Nifty") return "Nifty: Spot Plus 150, Rounded Up To The Next 100";
  if (u === "Sensex") return "Sensex: Spot Times 1.006, Rounded Up To The Next 100";
  return "Spot Times 1.006 For Sensex Or Spot Plus 150 For Nifty, Rounded Up To The Next 100";
}

/** The expiry rule as the Atlas states it. */
export function expiryRuleText(u: Underlying | ""): string {
  return u ? `Last ${WEEKDAY_NAMES[EXPIRY_WEEKDAY[u]]} Of Each Month` : "Last Expiry Day Of Each Month";
}

/** Every stage of the pipeline, in the order the simulation runs them. */
export function atlasStages(i: DeskInputs, run: { result: HedgingResult; market: MarketData } | null, opts: { market: MarketData; history?: VolHistory | null }): AtlasStage[] {
  const u = underlyingName(i);
  const r = run?.result ?? null;
  const n = Number.isInteger(i.expiryCount) ? i.expiryCount : 0;
  const dates = i.expiryDates.slice(0, n).filter((d) => isValidYmd(d));
  const hedgeIndex = i.hedgeExpiryIndex ?? medianExpiryIndex(n);
  const k = i.strikePercents;
  const has = k.length > 0;
  const terms = deriveTerms(i);
  const start = Number.isFinite(i.spot) && Number.isFinite(i.startLevelUplift) ? startLevel(i) : NaN;
  const calls = i.strikeOptionTypes.filter((t) => t === "C").length;
  const puts = i.strikeOptionTypes.filter((t) => t === "P").length;
  const s = opts.market.surface;
  const legs = r?.pricer.legs ?? [];
  const last = <T>(build: (res: HedgingResult) => T): T | null => (r ? build(r) : null);

  const stages: Array<Omit<AtlasStage, "feeds">> = [
    {
      id: "inputs",
      title: "Inputs",
      kind: "Input",
      description: `${u} product of ${num(i.notionalCr)} Crore valued on ${date(i.valuationDate)}: coupon ${pct(i.coupon)}, tenor ${num(i.tenorDays, 0)} days, NBFC rate ${pct(i.nbfcRate)} and premium growth rate ${pct(i.premiumRate)}.`,
      uses: [],
      rule: "Every Value Typed Or Defaulted On The Inputs Tab, Checked Against Its Allowed Range",
      lastRun: last((res) => [
        { label: "Coupon", value: pct(res.inputs.coupon) },
        { label: "Notional In Crore", value: num(res.inputs.notionalCr) },
        { label: "Tenor In Days", value: num(res.inputs.tenorDays, 0) },
      ]),
    },
    {
      id: "live-close",
      title: "Live Close",
      kind: "Input",
      description: `The ${u} close of ${num(i.spot)} on ${date(i.valuationDate)} sets the start level of ${num(start, 0)}.`,
      uses: ["inputs"],
      rule: `Start Level: Spot Times ${num(1 + i.startLevelUplift, 3)}, Rounded Up To The Next 100`,
      lastRun: last((res) => [
        { label: `${res.underlyingLabel} Spot`, value: num(res.inputs.spot) },
        { label: "Start Level", value: num(res.structure.startLevel, 0) },
      ]),
    },
    {
      id: "expiries",
      title: "Expiries",
      kind: "Calculation",
      description: `${n || "-"} observation expiries from ${date(dates[0])} to ${date(dates.at(-1))}; the hedge option expires on ${date(dates[hedgeIndex])}.`,
      uses: ["inputs"],
      rule: expiryRuleText(i.underlying),
      lastRun: last((res) => [
        { label: "Expiries", value: num(res.schedule.expiries.length, 0) },
        { label: "First", value: date(res.schedule.expiries[0]) },
        { label: "Last", value: date(res.schedule.expiries.at(-1)) },
        { label: "Hedge Option Expiry", value: date(res.schedule.hedgeExpiry) },
      ]),
    },
    {
      id: "strikes",
      title: "Strikes And Spreads",
      kind: "Calculation",
      description: has
        ? `${k.length} strikes for ${terms.nSpreads} ${terms.nSpreads === 1 ? "spread" : "spreads"}, from ${num(Math.max(...k))}% down to ${num(Math.min(...k))}% of the start level: ${calls} call and ${puts} put.`
        : "No strikes until the number of spreads is picked.",
      uses: ["inputs", "live-close"],
      rule: "Strike In Points: Start Level Times Strike %, Rounded; Strikes: Spreads Plus 4",
      lastRun: last((res) => [
        { label: "Strikes", value: num(res.structure.strikes.length, 0) },
        { label: "Highest In Points", value: num(Math.max(...res.structure.strikes.map((x) => x.strike)), 0) },
        { label: "Lowest In Points", value: num(Math.min(...res.structure.strikes.map((x) => x.strike)), 0) },
      ]),
    },
    {
      id: "volatility",
      title: "Volatility",
      kind: "Input",
      description: `${u} daily volatility of ${pct(i.dailyVol, 3)}, annual ${pct(annualVolFromDaily(i.dailyVol), 3)}, ${
        i.dailyVolSource === "calculated" && opts.history?.observations
          ? `calculated from ${opts.history.observations} daily returns from ${date(opts.history.from)} to ${date(opts.history.to)}.`
          : Number.isFinite(i.dailyVol)
            ? "as edited on the Inputs tab."
            : "not yet set."
      }`,
      uses: ["inputs"],
      rule: "Annual Volatility: Daily Times The Square Root Of 365",
      lastRun: last((res) => [
        { label: "Daily", value: pct(res.inputs.dailyVol, 3) },
        { label: "Annual", value: pct(res.summary.annualVol, 3) },
      ]),
    },
    {
      id: "surface",
      title: "Surface Lookup",
      kind: "Calculation",
      description: `${s.label.replace(" Volatility Surface", "")} surface with ${s.expiries.length} expiry rows and ${s.moneyness.length} strike columns; expiries after ${date(s.expiries.at(-1)?.slice(0, 10))} read the last row.`,
      uses: ["expiries", "strikes"],
      rule: "Volatility Between The Two Nearest Expiries And The Two Nearest Strike Columns; Deep Reads The 55% Column",
      lastRun: last((res) => [{ label: "Leg Volatility", value: span(res.pricer.legs.map((l) => l.volatility), (v) => pct(v)) }]),
    },
    {
      id: "forwards",
      title: "Forwards",
      kind: "Calculation",
      description: `Each leg's forward grows the ${u} spot at the curve rate for its tenor, less the dividends paid before its expiry; the premium grows at ${pct(i.premiumRate)}.`,
      uses: ["live-close", "expiries"],
      rule: "Forward: Spot Grown To Expiry At The Curve Rate, Less Dividends",
      lastRun: last((res) => [{ label: "Forward", value: span(res.pricer.legs.map((l) => l.forward), (v) => num(v, 0)) }]),
    },
    {
      id: "option-pricing",
      title: "Option Pricing",
      kind: "Calculation",
      description: `${has && n ? k.length * n : "-"} legs: ${has ? k.length : "-"} strikes times ${n || "-"} expiries, each priced on its forward with the surface volatility.`,
      uses: ["strikes", "surface", "forwards", "volatility"],
      rule: "Black Price On The Forward, Discounted; Each Greek By Bumping Its Input",
      lastRun: last((res) => [
        { label: "Legs", value: num(legs.length, 0) },
        { label: "Premium In Crore", value: crore(res.summary.totalPremiumCr) },
      ]),
    },
    {
      id: "goal-seek",
      title: "Goal Seek Inbuilt",
      kind: "Check",
      description: `Finds the Inbuilt that makes the achieved coupon equal the target coupon of ${pct(i.coupon)}.`,
      uses: ["option-pricing", "inputs"],
      rule: "Achieved Coupon Equals The Target Coupon Within One Billionth",
      lastRun: last((res) => [
        { label: "Inbuilt", value: pct(res.summary.actualInbuilt, 3) },
        { label: "Achieved Coupon", value: pct(res.pricer.header.achievedCoupon) },
        { label: "Iterations", value: num(res.diagnostics.solverIterations, 0) },
      ]),
    },
    {
      id: "pots",
      title: "Pots",
      kind: "Calculation",
      description: `${num(i.notionalCr)} Crore split into the NBFC pot at ${pct(i.nbfcRate)}, the option premium growing at ${pct(i.premiumRate)} and the margin growing at ${pct(i.marginGrowthRate, 3)}.`,
      uses: ["goal-seek", "inputs"],
      rule: "NBFC Pot Plus Option Premium Plus Costs Equals The Notional",
      lastRun: last((res) => [
        { label: "NBFC In Crore", value: crore(res.productDescription.nbfcCr) },
        { label: "Premium In Crore", value: crore(res.productDescription.premiumCr) },
        { label: "Maturity In Crore", value: crore(res.productDescription.maturityCr) },
      ]),
    },
    {
      id: "vega-hedge",
      title: "Day 1 Vega Hedge",
      kind: "Calculation",
      description: `Sells ${u} options at ${num(i.hedgeStrike, 0)} expiring ${date(dates[hedgeIndex])} so their vega cancels the book's vega${i.hedgeStrikeAuto ? "" : "; the hedge strike is typed"}.`,
      uses: ["option-pricing", "live-close", "expiries"],
      rule: i.hedgeStrikeAuto ? hedgeRuleText(i.underlying) : `Typed Hedge Strike: ${num(i.hedgeStrike, 0)}`,
      lastRun: last((res) => [
        { label: "Hedge Strike", value: num(res.summary.hedgeStrike, 0) },
        { label: "Hedge Quantity", value: num(res.dayOneVegaHedge.quantity) },
        { label: "Fair Volatility", value: pct(res.dayOneVegaHedge.fair.find((h) => h.move === 0)?.volatility ?? NaN) },
      ]),
    },
    {
      id: "margin",
      title: "Mark To Market And Margin",
      kind: "Output",
      description: `Shocks the ${u} from -50% to +20%; at each level the residual futures, the mark to market and the margin, at a futures margin of ${pct(i.futuresMargin)}.`,
      uses: ["vega-hedge", "pots", "option-pricing"],
      rule: "Total Requirement: Futures Margin Plus Mark To Market Plus Options Margin",
      lastRun: last((res) => [
        { label: "Peak Requirement In Crore", value: crore(res.markToMarket.worstCase.totalRequirementCr, 3) },
        { label: "At A Move Of", value: pct(res.markToMarket.worstCase.move, 0) },
      ]),
    },
    {
      id: "payoff",
      title: "Payoff",
      kind: "Output",
      description: has
        ? `The client gets the ${pct(i.coupon)} coupon at or above a ${pct(terms.target)} rise, is protected down to -${pct(terms.protection)}, and loses at a decay of ${num(i.decay)} below it.`
        : "The payoff needs the strikes.",
      uses: ["inputs", "strikes", "goal-seek"],
      rule: "Coupon At Or Above The Target; Protection Down To The Protection Level; Decay Below It",
      lastRun: last((res) => {
        const zero = res.productDescription.payoff.find((p) => Math.abs(p.performance) < 1e-9);
        return [
          { label: "Return At 0%", value: pct(zero?.clientReturn ?? NaN) },
          { label: "Internal Rate Of Return", value: pct(res.productDescription.irr) },
        ];
      }),
    },
  ];

  return stages.map((st) => ({ ...st, feeds: stages.filter((x) => x.uses.includes(st.id)).map((x) => x.id) }));
}

/** Cards that explain the last run, from its values only. Empty before a run. */
export function atlasInsights(run: { result: HedgingResult; market: MarketData } | null): AtlasInsight[] {
  if (!run) return [];
  const r = run.result;
  const u = r.underlyingLabel;
  const s = r.summary;
  const out: AtlasInsight[] = [];

  out.push({
    id: "inbuilt",
    title: "What Drives The Inbuilt",
    text: `The Inbuilt of ${pct(s.actualInbuilt, 3)} buys an option book worth ${crore(s.totalPremiumCr)}, which has to pay the ${pct(r.inputs.coupon)} coupon on top of the ${crore(r.productDescription.nbfcCr)} NBFC pot.`,
  });

  const legs = [...s.legs].sort((a, b) => Math.abs(b.premiumCr) - Math.abs(a.premiumCr));
  const top = legs[0];
  if (top) {
    const share = Math.abs(top.premiumCr) / legs.reduce((a, l) => a + Math.abs(l.premiumCr), 0);
    out.push({
      id: "top-strike",
      title: "The Strike With The Most Premium",
      text: `The ${num(top.strikePercent)}% ${top.optionType === "C" ? "call" : "put"} at ${num(top.strike, 0)}, ${top.side === "B" ? "bought" : "sold"}, carries ${crore(top.premiumCr)}: ${pct(share)} of the gross premium.`,
    });
  }

  out.push({
    id: "hedge-strike",
    title: "Hedge Strike Against Spot",
    text: `The hedge strike of ${num(s.hedgeStrike, 0)} sits ${pct(s.hedgeStrike / r.inputs.spot - 1)} above the ${u} spot of ${num(r.inputs.spot)}.`,
  });

  const fair = r.dayOneVegaHedge.fair.find((h) => h.move === 0)?.volatility ?? NaN;
  out.push({
    id: "volatility",
    title: "Volatility Against The Saved Surface",
    text: `History gives an annual volatility of ${pct(s.annualVol)}; the saved ${run.market.surface.label.replace(" Volatility Surface", "")} surface gives ${pct(fair)} at the hedge strike, ${pct(fair - s.annualVol)} ${fair >= s.annualVol ? "above" : "below"} it.`,
  });

  const worst = r.markToMarket.worstCase;
  out.push({
    id: "margin-peak",
    title: "Margin Peak",
    text: `The worst margin requirement on the stress grid is ${crore(worst.totalRequirementCr, 3)}, at a ${pct(worst.move, 0)} move in the ${u}, against ${crore(r.markToMarket.zeroRow.totalRequirementCr, 3)} with no move.`,
  });

  return out;
}

const OUTPUT_TABS: Array<{ tab: OutputTab; title: string; href: string; head: (r: HedgingResult) => TableSpec; take: number }> = [
  { tab: "summary", title: "Summary Sheet", href: "/summary", head: summaryHeadline, take: 4 },
  { tab: "pricer", title: "Pricer", href: "/pricer", head: pricerHeadline, take: 4 },
  { tab: "product", title: "Product Description", href: "/product", head: productHeadline, take: 4 },
  { tab: "vega-hedge", title: "Day 1 Vega Hedge", href: "/vega-hedge", head: vegaHeadline, take: 4 },
  { tab: "margin", title: "Mark To Market", href: "/margin", head: marginHeadline, take: 4 },
];

/** One card per result tab with its headline numbers, or dashes before a run. */
export function atlasOutputs(r: HedgingResult | null): AtlasOutput[] {
  return OUTPUT_TABS.map(({ tab, title, href, head, take }) => {
    if (!r) return { tab, title, href, values: [] };
    const spec = head(r);
    const row = spec.rows[0]!;
    return {
      tab,
      title,
      href,
      values: spec.columns.slice(0, take).map((c) => ({ label: c.label, value: displayCell(row[c.key] ?? null, c.kind, Math.min(c.digits ?? 2, 3)).text })),
    };
  });
}
