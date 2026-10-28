"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { autoHedgeStrike, defaultInputs, seedMarketData } from "@/lib/engine/defaults";
import { istTodayYmd } from "@/lib/engine/dates";
import { computeHedgingSheet, validateInputs } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs, HedgingResult, MarketData, PricingParams, Underlying, ValidationIssue, VolSurface } from "@/lib/engine/types";
import { forwardMarket, normalizeVolSurface } from "@/lib/engine/vol-surface";
import type { MarketLevels } from "@/lib/market-data";

type InputsPatch = Partial<HedgeInputs> | ((prev: HedgeInputs) => Partial<HedgeInputs>);

export const SIMULATION_STEPS = ["Fetching Market Data", "Pricing Legs", "Solving Inbuilt", "Building Stress Grid"] as const;

export type SimulationState = { running: boolean; step: number };

export type LastRun = { result: HedgingResult; key: string; at: string };

export type DailyVolStatus = { loading: boolean; error: string | null; observations: number | null; from: string | null; to: string | null };

export type DeskContextValue = {
  inputs: HedgeInputs;
  setInputs: (patch: InputsPatch) => void;
  resetToDefaults: () => void;
  setUnderlying: (underlying: Underlying) => void;
  levels: MarketLevels | null;
  levelsLoading: boolean;
  refreshLevels: () => Promise<MarketLevels | null>;
  dailyVolStatus: DailyVolStatus;
  computeDailyVol: (override?: { underlying?: Underlying; windowDays?: number }) => Promise<number | null>;
  market: MarketData;
  datasetSource: string;
  datasetLoading: boolean;
  refreshDataset: () => Promise<MarketData | null>;
  applyMarket: (next: { surface?: VolSurface; params?: PricingParams | null }) => void;
  /** Live validation of the current inputs, before any run. */
  issues: { errors: ValidationIssue[]; warnings: ValidationIssue[] };
  simulation: SimulationState;
  runSimulation: () => Promise<boolean>;
  lastRun: LastRun | null;
  /** Inputs or market data changed since the last run. */
  stale: boolean;
};

const DeskContext = createContext<DeskContextValue | null>(null);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function runKey(inputs: HedgeInputs, marketVersion: number): string {
  return JSON.stringify({ inputs, marketVersion });
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const { alert, toast } = useDeskDialog();
  const [inputs, setInputsState] = useState<HedgeInputs>(() => defaultInputs({ valuationDate: istTodayYmd() }));
  const [levels, setLevels] = useState<MarketLevels | null>(null);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [market, setMarket] = useState<MarketData>(() => seedMarketData());
  const [marketVersion, setMarketVersion] = useState(0);
  const [datasetSource, setDatasetSource] = useState("seed");
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [dailyVolStatus, setDailyVolStatus] = useState<DailyVolStatus>({ loading: true, error: null, observations: null, from: null, to: null });
  const [simulation, setSimulation] = useState<SimulationState>({ running: false, step: -1 });
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const levelsRef = useRef<MarketLevels | null>(null);
  const inputsRef = useRef(inputs);
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
      const next = { ...prev, ...delta };
      if (next.hedgeStrikeAuto && Number.isFinite(next.spot)) next.hedgeStrike = autoHedgeStrike(next.spot);
      return next;
    });
  }, []);

  const spotFor = (u: Underlying, lv: MarketLevels | null): number | null => {
    const level = u === "Sensex" ? lv?.sensexLevel : lv?.niftyLevel;
    return level != null && level > 0 ? level : null;
  };

  /** State is only set after the fetch settles, so this is safe to start from an effect. */
  const loadLevels = useCallback(async (): Promise<MarketLevels | null> => {
    try {
      const res = await fetch("/api/market/levels", { cache: "no-store" });
      const data = (await res.json()) as MarketLevels;
      levelsRef.current = data;
      setLevels(data);
      setInputsState((prev) => {
        const spot = spotFor(prev.underlying, data);
        if (spot == null) return prev;
        return {
          ...prev,
          spot,
          valuationDate: data.valuationDate ?? prev.valuationDate,
          hedgeStrike: prev.hedgeStrikeAuto ? autoHedgeStrike(spot) : prev.hedgeStrike,
        };
      });
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
      const w = override?.windowDays ?? inputsRef.current.historyWindowDays;
      setDailyVolStatus((s) => ({ ...s, loading: true, error: null }));
      const vol = await fetchDailyVol(u, w);
      if (vol != null) setInputs({ dailyVol: vol, dailyVolSource: "calculated", historyWindowDays: w });
      return vol;
    },
    [fetchDailyVol, setInputs],
  );

  const loadDataset = useCallback(async (): Promise<MarketData | null> => {
    try {
      const res = await fetch("/api/dataset", { cache: "no-store" });
      const data = (await res.json()) as { surface: VolSurface; params: PricingParams; surfaceSource: string };
      const next = { surface: normalizeVolSurface(data.surface), params: data.params };
      setMarket(next);
      bumpMarketVersion();
      setDatasetSource(data.surfaceSource);
      return next;
    } catch {
      return null;
    } finally {
      setDatasetLoading(false);
    }
  }, [bumpMarketVersion]);

  const refreshDataset = useCallback(async () => {
    setDatasetLoading(true);
    return loadDataset();
  }, [loadDataset]);

  const applyMarket = useCallback((next: { surface?: VolSurface; params?: PricingParams | null }) => {
    setMarket((prev) => ({
      surface: next.surface ? normalizeVolSurface(next.surface) : prev.surface,
      params: next.params ?? prev.params,
    }));
    bumpMarketVersion();
  }, [bumpMarketVersion]);

  const setUnderlying = useCallback(
    (underlying: Underlying) => {
      const spot = spotFor(underlying, levelsRef.current);
      setInputs((prev) => ({ underlying, spot: spot ?? prev.spot, legVolOverrides: {}, hedgeVolOverride: null }));
      if (inputsRef.current.dailyVolSource !== "overridden") void computeDailyVol({ underlying });
    },
    [computeDailyVol, setInputs],
  );

  const resetToDefaults = useCallback(() => {
    const prev = inputsRef.current;
    const spot = spotFor(prev.underlying, levelsRef.current) ?? prev.spot;
    setInputsState({
      ...defaultInputs({ valuationDate: levelsRef.current?.valuationDate ?? istTodayYmd(), spot }),
      underlying: prev.underlying,
    });
    void computeDailyVol({ windowDays: 365 });
  }, [computeDailyVol]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch; state is set only after each request settles
    void loadLevels();
    void loadDataset();
    void fetchDailyVol("Sensex", 365).then((vol) => {
      if (vol != null) setInputsState((prev) => (prev.dailyVolSource === "overridden" ? prev : { ...prev, dailyVol: vol, dailyVolSource: "calculated" }));
    });
  }, [fetchDailyVol, loadDataset, loadLevels]);

  const issues = useMemo(() => {
    const v = validateInputs(inputs, market);
    return { errors: v.errors, warnings: v.warnings };
  }, [inputs, market]);

  const runSimulation = useCallback(async (): Promise<boolean> => {
    const current = inputsRef.current;
    const check = validateInputs(current, market);
    if (check.errors.length) {
      const first = check.errors[0]!;
      const more = check.errors.length > 1 ? `\n\n${check.errors.length - 1} more ${check.errors.length === 2 ? "issue needs" : "issues need"} fixing:\n${check.errors.slice(1, 5).map((e) => `• ${e.message}`).join("\n")}` : "";
      alert(`${first.message}${more}`, { variant: "error", title: "Cannot Run The Simulation", fix: first.fix });
      return false;
    }
    setSimulation({ running: true, step: 0 });
    const fresh = (await refreshDataset()) ?? market;
    for (let step = 1; step < SIMULATION_STEPS.length; step++) {
      await wait(220);
      setSimulation({ running: true, step });
    }
    const result = computeHedgingSheet(inputsRef.current, forwardMarket(fresh, inputsRef.current.valuationDate));
    await wait(220);
    setSimulation({ running: false, step: SIMULATION_STEPS.length });
    if (!result.ok) {
      const first = result.errors[0]!;
      alert(first.message, { variant: "error", title: "Cannot Run The Simulation", fix: first.fix });
      return false;
    }
    setLastRun({ result, key: runKey(inputsRef.current, marketVersionRef.current), at: new Date().toISOString() });
    for (const w of result.warnings.filter((w) => w.code === "expiry-surface")) {
      alert(w.message, { variant: "warning", title: "Expiries Beyond The Surface", fix: w.fix });
    }
    toast("Simulation Complete");
    return true;
  }, [alert, market, refreshDataset, toast]);

  const stale = lastRun != null && lastRun.key !== runKey(inputs, marketVersion);

  const value = useMemo<DeskContextValue>(
    () => ({
      inputs,
      setInputs,
      resetToDefaults,
      setUnderlying,
      levels,
      levelsLoading,
      refreshLevels,
      dailyVolStatus,
      computeDailyVol,
      market,
      datasetSource,
      datasetLoading,
      refreshDataset,
      applyMarket,
      issues,
      simulation,
      runSimulation,
      lastRun,
      stale,
    }),
    [
      inputs,
      setInputs,
      resetToDefaults,
      setUnderlying,
      levels,
      levelsLoading,
      refreshLevels,
      dailyVolStatus,
      computeDailyVol,
      market,
      datasetSource,
      datasetLoading,
      refreshDataset,
      applyMarket,
      issues,
      simulation,
      runSimulation,
      lastRun,
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
