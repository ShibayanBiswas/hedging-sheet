"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { autoHedgeStrike, EXPIRY_WEEKDAY, seedMarketData, WORKBOOK_SPOT, workbookDefaultInputs } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs, HedgingFailure, HedgingResult, MarketData, PricingParams, Underlying, VolSurface } from "@/lib/engine/types";
import { normalizeVolSurface, referenceUnderlyingPrice } from "@/lib/engine/vol-surface";
import type { MarketLevels } from "@/lib/market-data";

const INPUTS_KEY = "hs-desk-inputs";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export const RECALC_DEBOUNCE_MS = 150;

type InputsPatch = Partial<HedgeInputs> | ((prev: HedgeInputs) => Partial<HedgeInputs>);

export type DeskContextValue = {
  inputs: HedgeInputs;
  setInputs: (patch: InputsPatch) => void;
  resetToWorkbook: () => void;
  setMode: (mode: HedgeInputs["mode"]) => void;
  setUnderlying: (underlying: Underlying) => void;
  levels: MarketLevels | null;
  levelsLoading: boolean;
  refreshLevels: () => Promise<MarketLevels | null>;
  liveMarket: MarketData | null;
  workbookMarket: MarketData;
  market: MarketData;
  datasetSource: string;
  datasetLoading: boolean;
  refreshDataset: () => Promise<void>;
  applyMarket: (next: { surface?: VolSurface; params?: PricingParams | null }) => void;
  result: HedgingResult | HedgingFailure;
  recalculating: boolean;
};

const DeskContext = createContext<DeskContextValue | null>(null);

function readStored(): HedgeInputs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INPUTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HedgeInputs>;
    const base = workbookDefaultInputs();
    const merged = { ...base, ...parsed } as HedgeInputs;
    merged.expiryMonths = (parsed.expiryMonths ?? base.expiryMonths).map((n) => (n == null ? NaN : Number(n)));
    return merged;
  } catch {
    return null;
  }
}

function persist(inputs: HedgeInputs) {
  try {
    sessionStorage.setItem(
      INPUTS_KEY,
      JSON.stringify({ ...inputs, expiryMonths: inputs.expiryMonths.map((n) => (Number.isFinite(n) ? n : null)) }),
    );
  } catch {
    // Private mode can block session storage.
  }
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const workbookMarket = useMemo(() => seedMarketData(), []);
  const [inputs, setInputsState] = useState<HedgeInputs>(() => workbookDefaultInputs());
  const [hydrated, setHydrated] = useState(false);
  const [levels, setLevels] = useState<MarketLevels | null>(null);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [liveMarket, setLiveMarket] = useState<MarketData | null>(null);
  const [datasetSource, setDatasetSource] = useState("seed");
  const [datasetLoading, setDatasetLoading] = useState(true);
  const levelsRef = useRef<MarketLevels | null>(null);

  const setInputs = useCallback((patch: InputsPatch) => {
    setInputsState((prev) => {
      const delta = typeof patch === "function" ? patch(prev) : patch;
      const next = { ...prev, ...delta };
      if (next.hedgeStrikeAuto) next.hedgeStrike = autoHedgeStrike(next.spot);
      persist(next);
      return next;
    });
  }, []);

  /** State is only set after the fetch settles, so this is safe to start from an effect. */
  const loadLevels = useCallback(async (): Promise<MarketLevels | null> => {
    try {
      const res = await fetch("/api/market/levels", { cache: "no-store" });
      const data = (await res.json()) as MarketLevels;
      levelsRef.current = data;
      setLevels(data);
      return data;
    } catch {
      return null;
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  const refreshLevels = useCallback(async (): Promise<MarketLevels | null> => {
    setLevelsLoading(true);
    return loadLevels();
  }, [loadLevels]);

  const loadDataset = useCallback(async () => {
    try {
      const res = await fetch("/api/dataset", { cache: "no-store" });
      const data = (await res.json()) as { surface: VolSurface; params: PricingParams; surfaceSource: string };
      setLiveMarket({ surface: normalizeVolSurface(data.surface), params: data.params });
      setDatasetSource(data.surfaceSource);
    } catch {
      setLiveMarket(null);
    } finally {
      setDatasetLoading(false);
    }
  }, []);

  const refreshDataset = useCallback(async () => {
    setDatasetLoading(true);
    await loadDataset();
  }, [loadDataset]);

  const applyMarket = useCallback((next: { surface?: VolSurface; params?: PricingParams | null }) => {
    setLiveMarket((prev) => {
      const base = prev ?? seedMarketData();
      return {
        surface: next.surface ? normalizeVolSurface(next.surface) : base.surface,
        params: next.params ?? base.params,
      };
    });
  }, []);

  const liveSpotFor = useCallback(
    (u: Underlying, lv: MarketLevels | null): number | null => {
      const level = u === "Sensex" ? lv?.sensexLevel : lv?.niftyLevel;
      return level != null && level > 0 ? level : null;
    },
    [],
  );

  const setMode = useCallback(
    (mode: HedgeInputs["mode"]) => {
      if (mode === "workbook") {
        setInputs({ ...workbookDefaultInputs(), mode: "workbook" });
        return;
      }
      const apply = (lv: MarketLevels | null) =>
        setInputs((prev) => {
          const spot = liveSpotFor(prev.underlying, lv) ?? prev.spot;
          return {
            mode: "live",
            valuationDate: lv?.valuationDate ?? prev.valuationDate,
            spot,
            hedgeStrikeAuto: true,
            hedgeStrike: autoHedgeStrike(spot),
          };
        });
      if (levelsRef.current) apply(levelsRef.current);
      else void refreshLevels().then(apply);
    },
    [liveSpotFor, refreshLevels, setInputs],
  );

  const setUnderlying = useCallback(
    (underlying: Underlying) => {
      setInputs((prev) => {
        let spot = prev.spot;
        if (prev.mode === "live") spot = liveSpotFor(underlying, levelsRef.current) ?? prev.spot;
        else if (underlying === "Sensex") spot = WORKBOOK_SPOT;
        else spot = referenceUnderlyingPrice(workbookMarket.surface) || prev.spot;
        const hedgeStrikeAuto = prev.mode === "live" || underlying === "Nifty" ? true : prev.hedgeStrikeAuto;
        return {
          underlying,
          spot,
          expiryWeekday: EXPIRY_WEEKDAY[underlying],
          hedgeStrikeAuto,
          hedgeStrike: hedgeStrikeAuto ? autoHedgeStrike(spot) : workbookDefaultInputs().hedgeStrike,
        };
      });
    },
    [liveSpotFor, setInputs, workbookMarket.surface],
  );

  const resetToWorkbook = useCallback(() => setInputs(workbookDefaultInputs()), [setInputs]);

  // A layout effect restores the session before any click can be handled, so an early
  // click is never persisted first and then restored on top of itself.
  useIsomorphicLayoutEffect(() => {
    const stored = readStored();
    if (stored) setInputsState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch; state is set only after the request settles
    void loadLevels();
    void loadDataset();
  }, [loadDataset, loadLevels]);

  const market = inputs.mode === "workbook" ? workbookMarket : (liveMarket ?? workbookMarket);
  const debouncedInputs = useDebounced(inputs, RECALC_DEBOUNCE_MS);
  const result = useMemo(() => computeHedgingSheet(debouncedInputs, market), [debouncedInputs, market]);

  const value = useMemo<DeskContextValue>(
    () => ({
      inputs,
      setInputs,
      resetToWorkbook,
      setMode,
      setUnderlying,
      levels,
      levelsLoading,
      refreshLevels,
      liveMarket,
      workbookMarket,
      market,
      datasetSource,
      datasetLoading,
      refreshDataset,
      applyMarket,
      result,
      recalculating: hydrated && debouncedInputs !== inputs,
    }),
    [
      inputs,
      setInputs,
      resetToWorkbook,
      setMode,
      setUnderlying,
      levels,
      levelsLoading,
      refreshLevels,
      liveMarket,
      workbookMarket,
      market,
      datasetSource,
      datasetLoading,
      refreshDataset,
      applyMarket,
      result,
      hydrated,
      debouncedInputs,
    ],
  );

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk(): DeskContextValue {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error("useDesk requires DeskProvider");
  return ctx;
}

/** Underlying name for every label, so no copy hard-codes Sensex. */
export function useUnderlyingLabel(): Underlying {
  return useDesk().inputs.underlying;
}
