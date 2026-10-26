import { useCallback, useEffect, useState } from "react"

import type { Activity } from "./asana"

export type LiveSourceStatus = "loading" | "live" | "unavailable" | "blocked"
export type ForecastDataMode = "poc" | "governed"
export type PacingData = typeof import("./data/pacing-cache.json")
export type PacingUnavailable = {
  status: "UNAVAILABLE"
  reason: "BLOCKED_MISSING_APPROVED_TARGETS"
  availableActualMeasures: string[]
  missingTargetMeasures: Array<{ metric: string; grain: string }>
  data: null
}
export type PacingFeed = PacingData | PacingUnavailable

export function isPacingUnavailable(
  value: PacingFeed,
): value is PacingUnavailable {
  return "status" in value && value.status === "UNAVAILABLE"
}

export function isPacingData(value: PacingFeed): value is PacingData {
  return !isPacingUnavailable(value)
}

export type LiveAsanaData = {
  status: "live"
  source: "Asana API"
  projectGid: string
  projectName: string
  fetchedAt: string
  mappingCoverage?: {
    total: number
    channel: number
    region: number
    subRegion: number
    mqlForecast: number
    salesforceCampaign: number
  }
  activities: Activity[]
}

export type ForecastDataFeed = {
  schemaVersion: 1
  providerMode: ForecastDataMode
  projectId: string
  generatedAt: string
  sourceAsOf: string
  semanticSourceGate: "PASS" | "NOT_APPLICABLE"
  sourceGovernanceStatus: "SEMANTIC_APPROVED" | "POC_ASSUMPTIONS"
  dsValidationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NOT_APPLICABLE"
  releaseStatus: string
  pacing: PacingFeed
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
  channelMqlRatesMethod?: {
    methodVersion: string
    shape: "channel_only"
    minComparables: number
  }
  inboundForecast?: Record<string, unknown> | null
  modelMetadata?: Record<string, unknown> | null
  attributionQuality?: Record<string, unknown> | null
}

export type ForecastDataResponse = {
  status: "live"
  dataMode: ForecastDataMode
  source: "Payload POC assumptions" | "Governed semantic provider"
  projectUrl: string | null
  receivedAt: string
  forecastUsable: boolean
  pacingUsable: boolean
  channelRatesUsable: boolean
  detail?: string
  feed: ForecastDataFeed
}

export type LiveHexFeed = ForecastDataFeed
export type LiveHexData = ForecastDataResponse

export type HexIngestReadiness = {
  status: "ready" | "blocked"
  ingestEnabled: boolean
  syncSecretConfigured: boolean
  machineCredentialRequiredInSender: true
  machineCredentialHeader: "X-Figma-Okta-Auth"
  source: "Hex governed aggregate delivery"
  projectId: string
  latestSnapshot: {
    receivedAt: string
    generatedAt: string
    sourceAsOf: string
  } | null
  detail: string
}

type UnavailableResponse = {
  status?: "unavailable" | "blocked" | "unauthenticated"
  detail?: string
}

function isLiveAsanaData(value: unknown): value is LiveAsanaData {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<LiveAsanaData>
  return candidate.status === "live" && Array.isArray(candidate.activities)
}

function isForecastDataResponse(value: unknown): value is ForecastDataResponse {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ForecastDataResponse>
  return (
    candidate.status === "live" &&
    (candidate.dataMode === "poc" || candidate.dataMode === "governed") &&
    candidate.feed?.schemaVersion === 1 &&
    candidate.feed.providerMode === candidate.dataMode &&
    !!candidate.feed.pacing &&
    typeof candidate.feed.pacing === "object" &&
    !!candidate.feed.activityReach &&
    typeof candidate.feed.activityReach === "object" &&
    !!candidate.feed.channelMqlRates &&
    typeof candidate.feed.channelMqlRates === "object"
  )
}

function isHexIngestReadiness(value: unknown): value is HexIngestReadiness {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<HexIngestReadiness>
  return (
    (candidate.status === "ready" || candidate.status === "blocked") &&
    typeof candidate.ingestEnabled === "boolean" &&
    typeof candidate.syncSecretConfigured === "boolean" &&
    candidate.machineCredentialRequiredInSender === true &&
    candidate.machineCredentialHeader === "X-Figma-Okta-Auth" &&
    typeof candidate.projectId === "string" &&
    typeof candidate.detail === "string"
  )
}

function useLiveSource<T>(
  url: string,
  refreshMs: number,
  isValid: (value: unknown) => value is T,
) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<LiveSourceStatus>("loading")
  const [detail, setDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
      })
      const body = (await response
        .json()
        .catch(() => ({}))) as UnavailableResponse
      if (!response.ok) {
        setData(null)
        setStatus(body.status === "blocked" ? "blocked" : "unavailable")
        setDetail(body.detail ?? `Live source unavailable (${response.status})`)
        return
      }
      if (!isValid(body)) {
        setData(null)
        setStatus("unavailable")
        setDetail("The live source returned an invalid or incomplete response.")
        return
      }
      setData(body)
      setStatus("live")
      setDetail(null)
    } catch (error) {
      setData(null)
      setStatus("unavailable")
      setDetail(
        error instanceof Error ? error.message : "Live source unavailable",
      )
    }
  }, [isValid, url])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, refreshMs)
    return () => window.clearInterval(timer)
  }, [refresh, refreshMs])

  return { data, status, detail, refresh }
}

export function useLiveAsana() {
  return useLiveSource<LiveAsanaData>(
    "/api/integrations/asana",
    5 * 60 * 1000,
    isLiveAsanaData,
  )
}

export function useForecastData() {
  return useLiveSource<ForecastDataResponse>(
    "/api/forecast-data",
    5 * 60 * 1000,
    isForecastDataResponse,
  )
}

export function useHexIngestReadiness() {
  const [data, setData] = useState<HexIngestReadiness | null>(null)
  const [status, setStatus] = useState<LiveSourceStatus>("loading")
  const [detail, setDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/hex/ingest", {
        credentials: "include",
        cache: "no-store",
      })
      const body = (await response.json().catch(() => ({}))) as unknown
      if (isHexIngestReadiness(body)) {
        setData(body)
        setStatus("live")
        setDetail(null)
        return
      }
      setData(null)
      setStatus("unavailable")
      setDetail(`Hex receiver status is unavailable (${response.status}).`)
    } catch (error) {
      setData(null)
      setStatus("unavailable")
      setDetail(
        error instanceof Error
          ? error.message
          : "Hex receiver status is unavailable.",
      )
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { data, status, detail, refresh }
}

// Compatibility alias while the views move from the old Hex transport name to
// the provider-neutral forecast-data contract.
export const useLiveHex = useForecastData
