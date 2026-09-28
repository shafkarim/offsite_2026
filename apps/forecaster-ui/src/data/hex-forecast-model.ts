// ─── Hex Forecast Engine — TypeScript Port ───────────────────────────────────
//
// Hierarchical funnel-forecasting model ported from the Hex notebook
// "Marketing Campaign Forecaster WIP - DO NOT USE".
//
// Experimental — not backtested against out-of-sample data.
// All outputs are planning scenarios, not certified forecasts.
//
// Architecture notes:
//   • Comparable pool: asana-cache.json activities with MQL + reach data
//   • Weighted empirical quantiles (deterministic, browser-safe)
//   • Tiers: T3 (channel + region) → T4 (channel only)
//   • No global cross-channel fallback — forecast unavailable without channel prior
//   • Orgs Web Form excluded: handled by inbound-forecast-model.ts instead
//   • Pipeline forecast unavailable: no averageCreatedOpportunityValueUsd
//   • Incomplete or future activities excluded from the comparable pool

import ASANA_CACHE from "./asana-cache.json"
import { SAMPLE_REACH } from "./forecast-model"

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_COMPARABLES = 8
const RECENCY_HALF_LIFE_DAYS = 365
const AUDIENCE_BAND = 3.0
const SEASONALITY_BONUS = 1.25
const TODAY = new Date()

// Stage-to-stage conversion ratios calibrated to SFDC actuals
// averageCreatedOpportunityValueUsd is not available → pipeline forecast = null
const STAGE_RATIOS = {
  mqlToSao: 0.017,
  saoToOpp: 0.65,
  oppToClosedWon: 0.22,
  avgDealSizeUsd: 48000,
  nnShare: 0.72,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignProfile {
  channel: string
  region?: string
  goal?: string
  plannedReach?: number
  dueDate?: string
}

export interface FunnelQuantiles {
  low: number
  planning: number
  high: number
}

export interface ForecastResult {
  profile: CampaignProfile
  tier: string
  nComparables: number
  comparableIds: string[]
  mqls: FunnelQuantiles
  mqls_net_new: FunnelQuantiles
  mqls_upgrade: FunnelQuantiles
  saos: FunnelQuantiles
  opps: FunnelQuantiles
  pipeline_usd: null
  pipelineUnavailableReason: string
  cw_usd: FunnelQuantiles
  warnings: string[]
}

export interface UnavailableForecastResult {
  profile: CampaignProfile
  unavailable: true
  reason: string
}

export type AnyForecastResult = ForecastResult | UnavailableForecastResult

// ─── Internal comparable type ─────────────────────────────────────────────────

interface Comparable {
  id: string
  channel: string
  region: string | null
  goal: string | null
  mqlRate: number
  mql: number
  reach: number
  dueDate: string | null
}

// ─── Build comparable pool ────────────────────────────────────────────────────
// Excludes: Orgs Web Form (separate inbound model), future activities (not yet run),
// and activities without MQL data or reach data.

function buildPool(): Comparable[] {
  const activities = (ASANA_CACHE as { activities: Array<Record<string, unknown>> }).activities
  const pool: Comparable[] = []

  for (const act of activities) {
    const id = act.id as string
    const mql = act.mql as number | null
    if (!mql || mql <= 0) continue

    const reach = SAMPLE_REACH[id]
    if (!reach || reach <= 0) continue

    const channel = act.channel as string
    if (channel === "Orgs Web Form") continue

    const dueDate = (act.due as string | null) ?? null
    if (dueDate) {
      const due = new Date(dueDate)
      if (due > TODAY) continue
    }

    pool.push({
      id,
      channel,
      region: (act.region as string | null) ?? null,
      goal: (act.goal as string | null) ?? null,
      mqlRate: mql / reach,
      mql,
      reach,
      dueDate,
    })
  }

  return pool
}

const POOL: Comparable[] = buildPool()

// ─── Tier ladder ──────────────────────────────────────────────────────────────
// T3: channel + region; T4: channel only.
// No T6 global fallback — return null if no channel prior exists.

interface TierResult {
  name: string
  comparables: Comparable[]
}

function pickTier(profile: CampaignProfile): TierResult | null {
  const ch = profile.channel?.toLowerCase()
  const reg = profile.region?.toLowerCase()

  if (ch && reg) {
    const sub = POOL.filter(
      c => c.channel.toLowerCase() === ch && c.region?.toLowerCase() === reg
    )
    if (sub.length >= MIN_COMPARABLES) return { name: "T3 channel + region", comparables: sub }
  }

  if (ch) {
    const sub = POOL.filter(c => c.channel.toLowerCase() === ch)
    if (sub.length >= MIN_COMPARABLES) return { name: "T4 channel only", comparables: sub }
  }

  return null
}

// ─── Weighting ────────────────────────────────────────────────────────────────

function todayDaysSince(dateStr: string | null): number {
  if (!dateStr) return 180
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.max(0, (now - then) / 86_400_000)
}

function currentQuarter(): string {
  const m = new Date().getMonth()
  const y = new Date().getFullYear()
  const qStart = [0, 3, 6, 9][Math.floor(m / 3)]
  return `${y}-${String(qStart + 1).padStart(2, "0")}`
}

function activityQuarter(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const m = d.getMonth()
  const y = d.getFullYear()
  const qStart = [0, 3, 6, 9][Math.floor(m / 3)]
  return `${y}-${String(qStart + 1).padStart(2, "0")}`
}

function computeWeights(comparables: Comparable[], profile: CampaignProfile): number[] {
  const tgtQuarter = profile.dueDate ? activityQuarter(profile.dueDate) : currentQuarter()
  const audienceHint = profile.plannedReach ?? null

  const raw = comparables.map(c => {
    const ageDays = todayDaysSince(c.dueDate)
    let w = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS)

    if (audienceHint && audienceHint > 0) {
      const ratio = Math.max(c.reach, 1) / audienceHint
      const logSim = Math.exp(-Math.abs(Math.log(ratio)) / Math.log(AUDIENCE_BAND))
      w *= 0.25 + 0.75 * logSim
    }

    if (tgtQuarter && activityQuarter(c.dueDate) === tgtQuarter) {
      w *= SEASONALITY_BONUS
    }

    return w
  })

  const total = raw.reduce((s, v) => s + v, 0)
  return total > 0 ? raw.map(v => v / total) : raw.map(() => 1 / raw.length)
}

// ─── Weighted empirical quantile ──────────────────────────────────────────────

function weightedQuantile(values: number[], weights: number[], q: number): number {
  if (values.length === 0) return 0
  const pairs = values.map((v, i) => [v, weights[i]] as [number, number])
  pairs.sort((a, b) => a[0] - b[0])

  let cumW = 0
  for (const [v, w] of pairs) {
    cumW += w
    if (cumW >= q) return v
  }
  return pairs[pairs.length - 1][0]
}

function funnelQuantiles(values: number[], weights: number[]): FunnelQuantiles {
  return {
    low: weightedQuantile(values, weights, 0.2),
    planning: weightedQuantile(values, weights, 0.5),
    high: weightedQuantile(values, weights, 0.8),
  }
}

function scaleQuantiles(q: FunnelQuantiles, factor: number): FunnelQuantiles {
  return { low: q.low * factor, planning: q.planning * factor, high: q.high * factor }
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function buildWarnings(profile: CampaignProfile, tier: string, n: number): string[] {
  const warnings: string[] = ["Experimental — not backtested"]

  if (!profile.region) {
    warnings.push("No region specified — tier matching limited to channel only")
  }
  if (!profile.plannedReach) {
    warnings.push("No planned reach provided — audience-size similarity weighting disabled")
  }
  if (n < MIN_COMPARABLES && n > 0) {
    warnings.push(`Only ${n} comparable(s) found — forecast reliability is reduced`)
  }

  return warnings
}

// ─── Main forecast function ───────────────────────────────────────────────────

export function runHexForecast(profile: CampaignProfile): AnyForecastResult {
  if (profile.channel === "Orgs Web Form") {
    return {
      profile,
      unavailable: true,
      reason: "Orgs Web Form is handled by the always-on inbound model, not the campaign forecaster",
    }
  }

  const tierResult = pickTier(profile)

  if (!tierResult) {
    return {
      profile,
      unavailable: true,
      reason: "Forecast unavailable — no compatible channel history",
    }
  }

  const { name: tier, comparables } = tierResult
  const warnings = buildWarnings(profile, tier, comparables.length)

  if (comparables.length === 0) {
    return {
      profile,
      unavailable: true,
      reason: "Forecast unavailable — no compatible channel history",
    }
  }

  const weights = computeWeights(comparables, profile)

  const mqlRates = comparables.map(c => c.mqlRate)
  const mqlRateQ = funnelQuantiles(mqlRates, weights)

  let mqlQ: FunnelQuantiles
  if (profile.plannedReach && profile.plannedReach > 0) {
    mqlQ = {
      low: mqlRateQ.low * profile.plannedReach,
      planning: mqlRateQ.planning * profile.plannedReach,
      high: mqlRateQ.high * profile.plannedReach,
    }
  } else {
    const mqlAbs = comparables.map(c => c.mql)
    mqlQ = funnelQuantiles(mqlAbs, weights)
  }

  const saoQ = scaleQuantiles(mqlQ, STAGE_RATIOS.mqlToSao)
  const oppQ = scaleQuantiles(saoQ, STAGE_RATIOS.saoToOpp)
  const cwOppQ = scaleQuantiles(oppQ, STAGE_RATIOS.oppToClosedWon)
  const cwUsdQ = scaleQuantiles(cwOppQ, STAGE_RATIOS.avgDealSizeUsd)
  const mqlNNQ = scaleQuantiles(mqlQ, STAGE_RATIOS.nnShare)
  const mqlUpQ = scaleQuantiles(mqlQ, 1 - STAGE_RATIOS.nnShare)

  return {
    profile,
    tier,
    nComparables: comparables.length,
    comparableIds: comparables.map(c => c.id),
    mqls: mqlQ,
    mqls_net_new: mqlNNQ,
    mqls_upgrade: mqlUpQ,
    saos: saoQ,
    opps: oppQ,
    pipeline_usd: null,
    pipelineUnavailableReason: "averageCreatedOpportunityValueUsd not available — pipeline forecast requires this input",
    cw_usd: cwUsdQ,
    warnings,
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function formatFunnelQ(q: FunnelQuantiles, decimals = 0): string {
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: decimals })
  return `${fmt(q.low)} – ${fmt(q.planning)} – ${fmt(q.high)}`
}

export function formatUsdQ(q: FunnelQuantiles): string {
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : `$${Math.round(n / 1000)}K`
  return `${fmt(q.low)} – ${fmt(q.planning)} – ${fmt(q.high)}`
}

export const FORECAST_DISCLAIMER = "Experimental — not backtested"

// Compatibility shim — A–E confidence grades were removed; kept as empty map
// so stale browser module caches referencing this export don't throw SyntaxError
export const CONFIDENCE_LABELS: Record<string, string> = {}

// Map from activity GID → display name (stripped of flag emoji prefix)
const _ACTIVITY_NAMES: Record<string, string> = (() => {
  const activities = (ASANA_CACHE as { activities: Array<Record<string, unknown>> }).activities
  const map: Record<string, string> = {}
  for (const act of activities) {
    const id = act.id as string
    let name = (act.name as string | null) ?? id
    name = name.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*[-–—]\s*/u, "")
    map[id] = name
  }
  return map
})()

export function getActivityName(id: string): string {
  return _ACTIVITY_NAMES[id] ?? id
}
