import { useCallback, useEffect, useState } from "react"

import type { Activity } from "./asana"

export type LiveSourceStatus = "loading" | "live" | "unavailable" | "blocked"
export type PacingData = typeof import("./data/pacing-cache.json")

export type LiveAsanaData = {
  status: "live"
  source: "Asana API"
  projectGid: string
  projectName: string
  fetchedAt: string
  activities: Activity[]
}

export type LiveHexFeed = {
  schemaVersion: 1
  projectId: string
  generatedAt: string
  sourceAsOf: string
  semanticSourceGate: "PASS"
  sourceGovernanceStatus: "SEMANTIC_APPROVED"
  dsValidationStatus: "PENDING" | "APPROVED" | "REJECTED"
  releaseStatus: string
  pacing: PacingData
  inboundForecast?: Record<string, unknown> | null
  modelMetadata?: Record<string, unknown> | null
  attributionQuality?: Record<string, unknown> | null
}

export type LiveHexData = {
  status: "live"
  source: "Hex semantic-approved feed"
  projectUrl: string
  receivedAt: string
  forecastUsable: boolean
  feed: LiveHexFeed
}

type UnavailableResponse = {
  status?: "unavailable" | "blocked" | "unauthenticated"
  detail?: string
}

function useLiveSource<T>(url: string, refreshMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<LiveSourceStatus>("loading")
  const [detail, setDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, { credentials: "include", cache: "no-store" })
      const body = (await response.json().catch(() => ({}))) as T & UnavailableResponse
      if (!response.ok) {
        setData(null)
        setStatus(body.status === "blocked" ? "blocked" : "unavailable")
        setDetail(body.detail ?? `Live source unavailable (${response.status})`)
        return
      }
      setData(body)
      setStatus("live")
      setDetail(null)
    } catch (error) {
      setData(null)
      setStatus("unavailable")
      setDetail(error instanceof Error ? error.message : "Live source unavailable")
    }
  }, [url])

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
  return useLiveSource<LiveAsanaData>("/api/integrations/asana", 5 * 60 * 1000)
}

export function useLiveHex() {
  return useLiveSource<LiveHexData>("/api/integrations/hex", 5 * 60 * 1000)
}
