import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { isIgnoredForecastActivity, type Activity } from "./asana"
import { regionForSubRegion } from "./data/subregions"
import { useLiveAsana } from "./live-sources"

export type AsanaMode = "loading" | "live" | "refreshing" | "error"

interface AsanaContextValue {
  activities: Activity[]
  mode: AsanaMode
  dataThrough: string
  syncedAt: string
  source: string
  message: string
  refresh: () => Promise<string | null>
}

const AsanaContext = createContext<AsanaContextValue>({
  activities: [],
  mode: "loading",
  dataThrough: "",
  syncedAt: "",
  source: "Asana API",
  message: "Connecting to the live Asana feed…",
  refresh: async () => "Live Asana is not connected.",
})

function normalizeActivities(activities: Activity[]): Activity[] {
  return activities
    .filter((activity) => !activity.completed && !isIgnoredForecastActivity(activity))
    .map((activity) => {
      const parentRegion = regionForSubRegion(activity.subRegion)
      return parentRegion ? { ...activity, region: parentRegion } : activity
    })
}

export function AsanaProvider({ children }: { children: ReactNode }) {
  const live = useLiveAsana()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await live.refresh()
      return null
    } catch (error) {
      return error instanceof Error ? error.message : "Asana refresh failed."
    } finally {
      setRefreshing(false)
    }
  }, [live.refresh])

  const value = useMemo<AsanaContextValue>(() => {
    const mode: AsanaMode = refreshing
      ? "refreshing"
      : live.status === "loading"
        ? "loading"
        : live.status === "live" && live.data
          ? "live"
          : "error"
    const syncedAt = live.data?.fetchedAt ?? ""
    return {
      activities: live.data ? normalizeActivities(live.data.activities) : [],
      mode,
      dataThrough: syncedAt,
      syncedAt,
      source: live.data?.source ?? "Asana API",
      message: mode === "live"
        ? "Live Asana activity feed"
        : live.detail ?? (mode === "loading" ? "Connecting to the live Asana feed…" : "Live Asana is unavailable."),
      refresh,
    }
  }, [live.data, live.detail, live.status, refresh, refreshing])

  return <AsanaContext.Provider value={value}>{children}</AsanaContext.Provider>
}

export const useAsanaActivities = () => useContext(AsanaContext)
