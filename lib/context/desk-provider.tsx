"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { autoHedgeStrike, defaultExpiryDates, defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { istTodayYmd, isValidYmd } from "@/lib/engine/dates";
import { snapExpiry } from "@/lib/engine/schedule";
import { computeHedgingSheet, validateInputs } from "@/lib/engine/hedging-sheet";
import type { HedgingResult, MarketData, PricingParams, Underlying, ValidationIssue, VolSurface } from "@/lib/engine/types";
import { forwardMarket, normalizeVolSurface } from "@/lib/engine/vol-surface";
import { blankInputs, isPriceable, type DeskInputs, type InputMode } from "@/lib/inputs/draft";
import { fieldSection, fieldTestId, groupBySection, INPUT_SECTIONS, validateDeskInputs, type FieldError } from "@/lib/validation/inputRules";
import type { MarketLevels } from "@/lib/market-data";
import { LEVEL_FIELD } from "@/lib/underlyings";

type InputsPatch = Partial<DeskInputs> | ((prev: DeskInputs) => Partial<DeskInputs>);

export const SIMULATION_STEPS = ["Fetching Market Data", "Pricing Legs", "Solving Inbuilt", "Building Stress Grid"] as const;

export type SimulationState = { running: boolean; step: number };

export type LastRun = { result: HedgingResult; market: MarketData; inputsKey: string; overridesKey: string; marketVersion: number; at: string };

export type DailyVolStatus = { loading: boolean; error: string | null; observations: number | null; from: string | null; to: string | null };

export type DeskContextValue = {
  mode: InputMode;
  /** Asks to confirm, then clears the inputs and the last run. */
  requestMode: (next: InputMode) => void;
  inputs: DeskInputs;
  setInputs: (patch: InputsPatch) => void;
  /** Back to the start state of the current mode. */
  resetInputs: () => void;
  setUnderlying: (underlying: Underlying) => void;
  levels: MarketLevels | null;
  levelsLoading: boolean;
  refreshLevels: () => Promise<MarketLevels | null>;
  /** Fills only the spot of the chosen underlying. */
  fetchLiveSpot: () => Promise<number | null>;
  dailyVolStatus: DailyVolStatus;
  computeDailyVol: (override?: { underlying?: Underlying; windowDays?: number }) => Promise<number | null>;
  market: MarketData;
  datasetSource: string;
  datasetLoading: boolean;
  /** When the surface and parameters last arrived from the server. */
  datasetFetchedAt: string | null;
  /** Why the last load failed; the built in surface is shown meanwhile. */
  datasetError: string | null;
  refreshDataset: () => Promise<MarketData | null>;
  applyMarket: (next: { surface?: VolSurface; params?: PricingParams | null }) => void;
  /** Field errors from lib/validation/inputRules. Inline display shows invalid values at once and empty fields after a run attempt. */
  fieldErrors: FieldError[];
  /** The field errors to show inline right now. */
  visibleErrors: FieldError[];
  /** Engine issues of priceable inputs: structure warnings such as expiries beyond the surface. */
  issues: { errors: ValidationIssue[]; warnings: ValidationIssue[] };
  simulation: SimulationState;
  runSimulation: () => Promise<boolean>;
  lastRun: LastRun | null;
  /** Inputs changed since the last run: the output tabs show the run gate again. */
  staleInputs: boolean;
  /** Only output tab overrides or market data changed: results stay with a banner. */
  stale: boolean;
};

const DeskContext = createContext<DeskContextValue | null>(null);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Run warnings shown as a popup after the simulation, by code. */
const WARNING_TITLES: Record<string, string> = {
  "expiry-surface": "Expiries Beyond The Surface",
  "loss-cap": "Loss Reaches 100% Before A 90% Fall",
};

/** Overrides are made on the output tabs, so they are keyed apart from the inputs. */
function splitKeys(inputs: DeskInputs): { inputsKey: string; overridesKey: string } {
  const { legVolOverrides, hedgeVolOverride, ...rest } = inputs;
  return { inputsKey: JSON.stringify(rest), overridesKey: JSON.stringify({ legVolOverrides, hedgeVolOverride }) };
}

/**
 * Values that follow other inputs: the auto hedge strike follows the spot and the underlying's rule,
 * and a new underlying moves every expiry to its own last expiry weekday of the month.
 */
function derive(prev: DeskInputs, next: DeskInputs): DeskInputs {
  const out = { ...next };
  if (out.underlying && out.underlying !== prev.underlying) {
    const u = out.underlying;
    out.expiryDates = out.expiryDates.map((d) => (isValidYmd(d) ? snapExpiry(d, u) : d));
  }
  if (out.hedgeStrikeAuto && out.underlying && Number.isFinite(out.spot)) out.hedgeStrike = autoHedgeStrike(out.spot, out.underlying);
  return out;
}

function startInputs(mode: InputMode, levels: MarketLevels | null): DeskInputs {
  if (mode === "blank") return blankInputs();
  const spot = levels?.sensexLevel != null && levels.sensexLevel > 0 ? levels.sensexLevel : undefined;
  return defaultInputs({ valuationDate: levels?.valuationDate ?? istTodayYmd(), spot });
}

/** Scroll to and focus the input of a field; a field not on the page yet, such as a row of an unpicked count, goes to its group. */
export function focusField(field: string) {
  const el =
    document.querySelector<HTMLElement>(`[data-testid="${fieldTestId(field)}"]`) ??
    document.querySelector<HTMLElement>(`#group-${1 + INPUT_SECTIONS.indexOf(fieldSection(field))}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const { alert, toast } = useDeskDialog();
  const [mode, setModeState] = useState<InputMode>("default");
  const [inputs, setInputsState] = useState<DeskInputs>(() => defaultInputs({ valuationDate: istTodayYmd() }));
  const [levels, setLevels] = useState<MarketLevels | null>(null);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [market, setMarket] = useState<MarketData>(() => seedMarketData());
  const [marketVersion, setMarketVersion] = useState(0);
  const [datasetSource, setDatasetSource] = useState("seed");
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetFetchedAt, setDatasetFetchedAt] = useState<string | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [dailyVolStatus, setDailyVolStatus] = useState<DailyVolStatus>({ loading: true, error: null, observations: null, from: null, to: null });
  const [simulation, setSimulation] = useState<SimulationState>({ running: false, step: -1 });
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const levelsRef = useRef<MarketLevels | null>(null);
  const inputsRef = useRef(inputs);
  const modeRef = useRef<InputMode>("default");
  const marketVersionRef = useRef(0);

  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);

  const bumpMarketVersion = useCallback(() => {
    marketVersionRef.current += 1;
    setMarketVersion(marketVersionRef.current);
  }, []);

  const setInputs = useCallback((patch: InputsPatch) => {
    setInputsState((prev) => {
      const delta = typeof patch === "function" ? patch(prev) : patch;
      return derive(prev, { ...prev, ...delta });
    });
  }, []);

  const spotFor = (u: Underlying | "", lv: MarketLevels | null): number | null => {
    if (!u) return null;
    const level = lv?.[LEVEL_FIELD[u]];
    return level != null && level > 0 ? level : null;
  };

  /** State is only set after the fetch settles, so this is safe to start from an effect. Blank mode never fills from it. */
  const loadLevels = useCallback(async (): Promise<MarketLevels | null> => {
    try {
      const res = await fetch("/api/market/levels", { cache: "no-store" });
      const data = (await res.json()) as MarketLevels;
      levelsRef.current = data;
      setLevels(data);
      if (modeRef.current === "default") {
        setInputsState((prev) => {
          const spot = spotFor(prev.underlying, data);
          if (spot == null || !prev.underlying) return prev;
          const valuationDate = data.valuationDate ?? prev.valuationDate;
          // Untouched default expiries move with the close's date; typed ones stay.
          const untouched = JSON.stringify(prev.expiryDates) === JSON.stringify(defaultExpiryDates(prev.valuationDate, prev.underlying));
          return derive(prev, { ...prev, spot, valuationDate, expiryDates: untouched ? defaultExpiryDates(valuationDate, prev.underlying) : prev.expiryDates });
        });
      }
      return data;
    } catch {
      return null;
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  const refreshLevels = useCallback(async () => {
    setLevelsLoading(true);
    return loadLevels();
  }, [loadLevels]);

  const fetchLiveSpot = useCallback(async (): Promise<number | null> => {
    const u = inputsRef.current.underlying;
    if (!u) {
      alert("Select Nifty or Sensex first, so the right close is fetched.", { variant: "warning", title: "Select The Underlying" });
      return null;
    }
    setLevelsLoading(true);
    try {
      const res = await fetch("/api/market/levels", { cache: "no-store" });
      const data = (await res.json()) as MarketLevels;
      levelsRef.current = data;
      setLevels(data);
      const spot = spotFor(u, data);
      if (spot == null) throw new Error("No close was returned.");
      setInputsState((prev) => derive(prev, { ...prev, spot }));
      return spot;
    } catch {
      alert("The live close could not be fetched. Type the spot instead.", { variant: "error", title: "Fetch Failed" });
      return null;
    } finally {
      setLevelsLoading(false);
    }
  }, [alert]);

  const fetchDailyVol = useCallback(async (underlying: Underlying, windowDays: number) => {
    try {
      const res = await fetch(`/api/market/daily-vol?underlying=${underlying}&windowDays=${windowDays}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || typeof data.dailyVol !== "number") throw new Error(data.error ?? "Yahoo history is unavailable.");
      setDailyVolStatus({ loading: false, error: null, observations: data.observations, from: data.from, to: data.to });
      return data.dailyVol as number;
    } catch (err) {
      setDailyVolStatus({ loading: false, error: err instanceof Error ? err.message : "Yahoo history is unavailable.", observations: null, from: null, to: null });
      return null;
    }
  }, []);

  const computeDailyVol = useCallback(
    async (override?: { underlying?: Underlying; windowDays?: number }) => {
      const u = override?.underlying ?? inputsRef.current.underlying;
      if (!u) {
        alert("Select Nifty or Sensex first, so the right history is used.", { variant: "warning", title: "Select The Underlying" });
        return null;
      }
      const w = override?.windowDays ?? inputsRef.current.historyWindowDays;
      setDailyVolStatus((s) => ({ ...s, loading: true, error: null }));
      const vol = await fetchDailyVol(u, w);
      if (vol != null) setInputs({ dailyVol: vol, dailyVolSource: "calculated", historyWindowDays: w });
      return vol;
    },
    [alert, fetchDailyVol, setInputs],
  );

  const loadDataset = useCallback(async (): Promise<MarketData | null> => {
    try {
      const res = await fetch("/api/dataset", { cache: "no-store" });
      if (!res.ok) throw new Error(`The desk database answered ${res.status}`);
      const data = (await res.json()) as { surface: VolSurface; params: PricingParams; surfaceSource: string };
      const next = { surface: normalizeVolSurface(data.surface), params: data.params };
      setMarket(next);
      bumpMarketVersion();
      setDatasetSource(data.surfaceSource);
      setDatasetFetchedAt(new Date().toISOString());
      setDatasetError(null);
      return next;
    } catch {
      setDatasetError("The Surface Could Not Be Loaded - Showing The Built In Surface");
      return null;
    } finally {
      setDatasetLoading(false);
    }
  }, [bumpMarketVersion]);

  const refreshDataset = useCallback(async () => {
    setDatasetLoading(true);
    return loadDataset();
  }, [loadDataset]);

  const applyMarket = useCallback(
    (next: { surface?: VolSurface; params?: PricingParams | null }) => {
      setMarket((prev) => ({
        surface: next.surface ? normalizeVolSurface(next.surface) : prev.surface,
        params: next.params ?? prev.params,
      }));
      bumpMarketVersion();
    },
    [bumpMarketVersion],
  );

  const setUnderlying = useCallback(
    (underlying: Underlying) => {
      if (modeRef.current === "blank") {
        setInputs({ underlying, legVolOverrides: {}, hedgeVolOverride: null });
        return;
      }
      const spot = spotFor(underlying, levelsRef.current);
      setInputs((prev) => ({ underlying, spot: spot ?? prev.spot, legVolOverrides: {}, hedgeVolOverride: null }));
      if (inputsRef.current.dailyVolSource !== "overridden") void computeDailyVol({ underlying });
    },
    [computeDailyVol, setInputs],
  );

  const applyMode = useCallback(
    (next: InputMode) => {
      modeRef.current = next;
      setModeState(next);
      setLastRun(null);
      setSubmitted(false);
      const start = startInputs(next, levelsRef.current);
      inputsRef.current = start;
      setInputsState(start);
      if (next === "default") void computeDailyVol({ underlying: "Sensex", windowDays: 365 });
    },
    [computeDailyVol],
  );

  const requestMode = useCallback(
    (next: InputMode) => {
      if (next === modeRef.current) return;
      alert("Switching mode resets every input to the new mode's start state and clears the last results.", {
        variant: "warning",
        title: "Switch Mode And Clear Results",
        okLabel: "Cancel",
        actions: [{ label: "Switch Mode", onClick: () => applyMode(next), testId: "confirm-switch-mode" }],
      });
    },
    [alert, applyMode],
  );

  const resetInputs = useCallback(() => {
    const prev = inputsRef.current;
    setSubmitted(false);
    if (modeRef.current === "blank") {
      setInputsState(blankInputs());
      return;
    }
    const u: Underlying = prev.underlying || "Sensex";
    const spot = spotFor(u, levelsRef.current) ?? (Number.isFinite(prev.spot) ? prev.spot : undefined);
    setInputsState({ ...defaultInputs({ valuationDate: levelsRef.current?.valuationDate ?? istTodayYmd(), spot }), underlying: u });
    void computeDailyVol({ underlying: u, windowDays: 365 });
  }, [computeDailyVol]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch; state is set only after each request settles
    void loadLevels();
    void loadDataset();
    void fetchDailyVol("Sensex", 365).then((vol) => {
      if (vol == null || modeRef.current !== "default") return;
      setInputsState((prev) => (prev.dailyVolSource === "overridden" ? prev : { ...prev, dailyVol: vol, dailyVolSource: "calculated" }));
    });
  }, [fetchDailyVol, loadDataset, loadLevels]);

  const fieldErrors = useMemo(() => validateDeskInputs(inputs, { today: istTodayYmd() }), [inputs]);
  const visibleErrors = useMemo(() => (submitted ? fieldErrors : fieldErrors.filter((e) => e.kind === "invalid")), [fieldErrors, submitted]);

  const issues = useMemo(() => {
    if (!isPriceable(inputs)) return { errors: [], warnings: [] };
    const v = validateInputs(inputs, market);
    return { errors: v.errors, warnings: v.warnings };
  }, [inputs, market]);

  const runSimulation = useCallback(async (): Promise<boolean> => {
    const current = inputsRef.current;
    const errors = validateDeskInputs(current, { today: istTodayYmd() });
    if (errors.length || !isPriceable(current)) {
      setSubmitted(true);
      const first = errors[0];
      const goFirst = () => first && focusField(first.field);
      alert(`${errors.length} ${errors.length === 1 ? "field needs" : "fields need"} attention before the simulation can run.`, {
        variant: "error",
        title: "Missing Or Invalid Inputs",
        groups: groupBySection(errors).map((g) => ({
          title: g.title,
          items: g.items.map((e) => ({ text: `${e.label}: ${e.message}`, onClick: () => focusField(e.field), testId: `fix-${fieldTestId(e.field)}` })),
        })),
        actions: [{ label: "Go To Field", onClick: goFirst, testId: "go-to-first-field" }],
        onClose: goFirst,
      });
      return false;
    }
    setSimulation({ running: true, step: 0 });
    const fresh = (await refreshDataset()) ?? market;
    for (let step = 1; step < SIMULATION_STEPS.length; step++) {
      await wait(220);
      setSimulation({ running: true, step });
    }
    const priced = inputsRef.current;
    const result = isPriceable(priced) ? computeHedgingSheet(priced, forwardMarket(fresh, priced.valuationDate)) : null;
    await wait(220);
    setSimulation({ running: false, step: SIMULATION_STEPS.length });
    if (!result || !result.ok) {
      const first = result && !result.ok ? result.errors[0] : undefined;
      alert(first?.message ?? "The inputs changed during the run. Run it again.", { variant: "error", title: "Cannot Run The Simulation", fix: first?.fix });
      return false;
    }
    setLastRun({ result, market: fresh, ...splitKeys(priced), marketVersion: marketVersionRef.current, at: new Date().toISOString() });
    for (const w of result.warnings) {
      const title = WARNING_TITLES[w.code ?? ""];
      if (title) alert(w.message, { variant: "warning", title, fix: w.fix });
    }
    toast("Simulation Completed");
    return true;
  }, [alert, market, refreshDataset, toast]);

  const keys = useMemo(() => splitKeys(inputs), [inputs]);
  const staleInputs = lastRun != null && lastRun.inputsKey !== keys.inputsKey;
  const stale = lastRun != null && (staleInputs || lastRun.overridesKey !== keys.overridesKey || lastRun.marketVersion !== marketVersion);

  // The end to end suite reads the last result here; production builds leave NEXT_PUBLIC_E2E unset.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== "1") return;
    (window as unknown as { __HS_TEST__?: unknown }).__HS_TEST__ = { result: lastRun?.result ?? null, inputs, mode, stale };
  }, [lastRun, inputs, mode, stale]);

  const value = useMemo<DeskContextValue>(
    () => ({
      mode,
      requestMode,
      inputs,
      setInputs,
      resetInputs,
      setUnderlying,
      levels,
      levelsLoading,
      refreshLevels,
      fetchLiveSpot,
      dailyVolStatus,
      computeDailyVol,
      market,
      datasetSource,
      datasetLoading,
      datasetFetchedAt,
      datasetError,
      refreshDataset,
      applyMarket,
      fieldErrors,
      visibleErrors,
      issues,
      simulation,
      runSimulation,
      lastRun,
      staleInputs,
      stale,
    }),
    [
      mode,
      requestMode,
      inputs,
      setInputs,
      resetInputs,
      setUnderlying,
      levels,
      levelsLoading,
      refreshLevels,
      fetchLiveSpot,
      dailyVolStatus,
      computeDailyVol,
      market,
      datasetSource,
      datasetLoading,
      datasetFetchedAt,
      datasetError,
      refreshDataset,
      applyMarket,
      fieldErrors,
      visibleErrors,
      issues,
      simulation,
      runSimulation,
      lastRun,
      staleInputs,
      stale,
    ],
  );

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk(): DeskContextValue {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error("useDesk requires DeskProvider");
  return ctx;
}
