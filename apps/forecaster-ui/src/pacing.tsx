import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import type { PacingDeliveryStatus } from "./data/pacing-delivery"
import { useLiveHex } from "./live-sources"

export interface PaceMetric {
  actual: number | null
  target: number
  attainment: number | null
  pacingIndex: number | null
  actual7d?: number | null
  actual30d?: number | null
  linearForecast?: number | null
  targetStatus?: "governed" | "unverified" | "missing"
  forecastStatus?: "committed" | "provisional" | "required"
  forecastLow?: number | null
  forecastHigh?: number | null
}

export interface PacingQuarter {
  id: string
  label: string
  period: string
  start: string
  end: string
  status: "complete" | "in-progress" | "upcoming"
  elapsedPct?: number
  mql: PaceMetric
  sao: PaceMetric
  pg: PaceMetric
}

export interface PacingSnapshot {
  quarter: string
  quarterStart: string
  quarterEnd: string
  quarterElapsedPct: number
  asOf: string
  sourceDataThrough?: string
  forecast7dAsOf: string
  forecast30dAsOf: string
  sourceRefreshedAt: string
  sourceTable: string
  hexThread: string
  hexProject?: string
  forecastScope?: "pipegen"
  attributedSource?: string
  channelsStatus?: "current" | "not_governed_in_this_run"
  subRegionsStatus?: "current" | "not_governed_in_this_run"
  subRegionReconciliation?: {
    status: "pass" | "warning"
    residuals: Array<{
      region: string
      metric: "mql" | "sao" | "pg"
      unallocatedActual: number | null
    }>
    note: string
  }
  regionalReconciliation?: {
    status: "pass" | "warning"
    unallocatedRegion?: string
    unallocatedMql?: number
    note: string
  }
  quarters: PacingQuarter[]
  fy: {
    label: string
    period: string
    note: string
    mql: { target: number; ytdActual: number; fullYearForecast: number; fullYearAttainment: number }
    sao: { target: number; ytdActual: number; fullYearForecast: number; fullYearAttainment: number }
    pg: { target: number; ytdActual: number; fullYearForecast: number; fullYearAttainment: number }
  }
  regions: Array<{ region: string; mql: PaceMetric; sao: PaceMetric; pg: PaceMetric }>
  subRegions?: Array<{
    region: string
    subRegion: string
    mql: PaceMetric
    sao: PaceMetric
    pg: PaceMetric
  }>
  channels: Array<{ channel: string; mql: PaceMetric; sao: PaceMetric; pg: PaceMetric }>
}

export type PacingMode = "loading" | "live" | "refreshing" | "error"

interface PacingContextValue {
  data: PacingSnapshot
  mode: PacingMode
  dataThrough: string
  syncedAt: string
  runUrl: string | null
  message: string
  deliveryStatus: PacingDeliveryStatus
  refresh: () => Promise<string | null>
}

const EMPTY_PACING: PacingSnapshot = {
  quarter: "",
  quarterStart: "",
  quarterEnd: "",
  quarterElapsedPct: 0,
  asOf: "",
  forecast7dAsOf: "",
  forecast30dAsOf: "",
  sourceRefreshedAt: "",
  sourceTable: "",
  hexThread: "",
  quarters: [],
  fy: {
    label: "",
    period: "",
    note: "Live Hex data is required.",
    mql: { target: 0, ytdActual: 0, fullYearForecast: 0, fullYearAttainment: 0 },
    sao: { target: 0, ytdActual: 0, fullYearForecast: 0, fullYearAttainment: 0 },
    pg: { target: 0, ytdActual: 0, fullYearForecast: 0, fullYearAttainment: 0 },
  },
  regions: [],
  channels: [],
}

const PacingContext = createContext<PacingContextValue>({
  data: EMPTY_PACING,
  mode: "loading",
  dataThrough: "",
  syncedAt: "",
  runUrl: null,
  message: "Connecting to the governed Hex feed…",
  deliveryStatus: "checking",
  refresh: async () => "Live Hex is not connected.",
})

export function PacingProvider({ children }: { children: ReactNode }) {
  const live = useLiveHex()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await live.refresh()
      return null
    } catch (error) {
      return error instanceof Error ? error.message : "Hex refresh failed."
    } finally {
      setRefreshing(false)
    }
  }, [live.refresh])

  const value = useMemo<PacingContextValue>(() => {
    const mode: PacingMode = refreshing
      ? "refreshing"
      : live.status === "loading"
        ? "loading"
        : live.status === "live" && live.data
          ? "live"
          : "error"
    const feed = live.data?.feed
    const pacing = feed?.pacing as unknown as PacingSnapshot | undefined
    return {
      data: pacing ?? EMPTY_PACING,
      mode,
      dataThrough: feed?.sourceAsOf ?? pacing?.sourceDataThrough ?? pacing?.asOf ?? "",
      syncedAt: live.data?.receivedAt ?? "",
      runUrl: live.data?.projectUrl ?? null,
      message: mode === "live"
        ? "Live governed Hex feed"
        : live.detail ?? (mode === "loading" ? "Connecting to the governed Hex feed…" : "Live Hex is unavailable."),
      deliveryStatus: mode === "live" ? "ready" : mode === "loading" ? "checking" : "unavailable",
      refresh,
    }
  }, [live.data, live.detail, live.status, refresh, refreshing])

  return <PacingContext.Provider value={value}>{children}</PacingContext.Provider>
}

export const usePacing = () => useContext(PacingContext)
