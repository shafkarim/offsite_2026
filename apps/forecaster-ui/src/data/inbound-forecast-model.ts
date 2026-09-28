// Orgs Web Form is always-on inbound — NOT a campaign channel.
// Uses run-rate model from completed quarters only (Q1 + Q2 mature).
// Q3 is incomplete; its 11.02% MQL→SAO rate is treated as immature.
// Pipeline dollars are unavailable: no averageCreatedOpportunityValueUsd.

export interface InboundPeriod {
  period: string
  mqlActual: number
  saoActual: number
  mqlToSaoRate: number
  isMature: boolean
}

export interface InboundForecastResult {
  channel: "Orgs Web Form"
  modelFamily: "inbound-run-rate"
  historicalPeriods: InboundPeriod[]
  ytdMqlActual: number
  ytdSaoActual: number
  remainingPeriodMqlForecast: number | null
  remainingPeriodSaoForecast: number | null
  /** Remaining-period MQL scenarios */
  mqlLow: number | null
  mqlPlanning: number | null
  mqlHigh: number | null
  /** Remaining-period SAO scenarios (derived from mql * mature conversion rate) */
  saoLow: number | null
  saoPlanning: number | null
  saoHigh: number | null
  pipelineForecast: null
  pipelineUnavailableReason: string
  sourceAsOf: string
  status: "experimental" | "unavailable"
  warnings: string[]
}

// Mature quarters from conversion-breakdowns.ts
const MATURE_PERIODS: InboundPeriod[] = [
  { period: "2026-01-01", mqlActual: 4325, saoActual: 649, mqlToSaoRate: 0.1501, isMature: true },
  { period: "2026-04-01", mqlActual: 3771, saoActual: 571, mqlToSaoRate: 0.1514, isMature: true },
]

// Q3 partial — pacing-cache values (in-progress)
const Q3_PARTIAL: InboundPeriod = {
  period: "2026-07-01",
  mqlActual: 2683,
  saoActual: 370,
  mqlToSaoRate: 0.1102,
  isMature: false,
}

// Run-rate conversion rate uses only mature periods
function matureConversionRate(): number {
  const totalMql = MATURE_PERIODS.reduce((s, p) => s + p.mqlActual, 0)
  const totalSao = MATURE_PERIODS.reduce((s, p) => s + p.saoActual, 0)
  return totalMql > 0 ? totalSao / totalMql : 0
}

// Q3 full quarter target from pacing-cache: 4403 MQL
const Q3_MQL_TARGET = 4403
// Elapsed fraction based on asOf 2026-09-10 within Q3 (Jul 1 – Sep 30 = 92 days; Sep 10 = day 71/92)
const Q3_ELAPSED_FRACTION = 71 / 92

export function computeInboundForecast(): InboundForecastResult {
  const allPeriods = [...MATURE_PERIODS, Q3_PARTIAL]

  const ytdMqlActual = MATURE_PERIODS.reduce((s, p) => s + p.mqlActual, 0) + Q3_PARTIAL.mqlActual
  const ytdSaoActual = MATURE_PERIODS.reduce((s, p) => s + p.saoActual, 0) + Q3_PARTIAL.saoActual

  const matureRate = matureConversionRate()

  // Remaining Q3 MQL estimated from Q3 target minus YTD pace
  const q3RunRateMql = Q3_PARTIAL.mqlActual / Q3_ELAPSED_FRACTION
  const remainingQ3Mql = Math.max(0, q3RunRateMql - Q3_PARTIAL.mqlActual)

  // Q4 run-rate MQL: average of mature quarters
  const avgMatureMql = MATURE_PERIODS.reduce((s, p) => s + p.mqlActual, 0) / MATURE_PERIODS.length

  // Scenarios: low = -15%, planning = run-rate, high = +20%
  const remainingMqlPlanning = remainingQ3Mql + avgMatureMql
  const remainingMqlLow = remainingMqlPlanning * 0.85
  const remainingMqlHigh = remainingMqlPlanning * 1.20

  const remainingSaoLow = Math.round(remainingMqlLow * matureRate)
  const remainingSaoPlanning = Math.round(remainingMqlPlanning * matureRate)
  const remainingSaoHigh = Math.round(remainingMqlHigh * matureRate)

  return {
    channel: "Orgs Web Form",
    modelFamily: "inbound-run-rate",
    historicalPeriods: allPeriods,
    ytdMqlActual,
    ytdSaoActual,
    remainingPeriodMqlForecast: Math.round(remainingMqlPlanning),
    remainingPeriodSaoForecast: remainingSaoPlanning,
    mqlLow: Math.round(remainingMqlLow),
    mqlPlanning: Math.round(remainingMqlPlanning),
    mqlHigh: Math.round(remainingMqlHigh),
    saoLow: remainingSaoLow,
    saoPlanning: remainingSaoPlanning,
    saoHigh: remainingSaoHigh,
    pipelineForecast: null,
    pipelineUnavailableReason: "averageCreatedOpportunityValueUsd not available for inbound channel",
    sourceAsOf: "2026-09-10",
    status: "experimental",
    warnings: [
      "Experimental inbound run-rate scenario — not backtested",
      "Q3 conversion rate (11.02%) is immature — only Q1 and Q2 rates used for run-rate model",
      "Pipeline forecast unavailable — no average created opportunity value for this channel",
    ],
  }
}
