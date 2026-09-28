// Source: DWH_ANALYTICS.MARKETING.GOALS_ACTUALS_COMBINED via pacing-cache.json
// Do NOT derive company-level totals from sfdc-actuals.ts
// Values are provisional — marketing-sourced scope cannot be verified from supplied data alone.

export interface PlanningMetric {
  metric: "mql" | "sao" | "pipeline"
  target: number
  ytdActual: number
  fullYearForecast: number
  remainingGap: number
  periodStart: string
  periodEnd: string
  asOf: string
  attributionScope: "marketing-sourced" | "unverified"
  scopeNote: string
  source: string
  status: "provisional" | "authoritative" | "unreconciled"
}

export const MARKETING_SOURCED_SCOPE_NOTE =
  "Marketing-sourced scope requires source validation. Values shown are provisional and exclude sales-sourced, partner-sourced, and marketing-influenced-only pipeline."

export const FY26_PLANNING_METRICS: Record<"mql" | "sao" | "pipeline", PlanningMetric> = {
  mql: {
    metric: "mql",
    target: 69189,
    ytdActual: 41899,
    fullYearForecast: 66042,
    remainingGap: 3147,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    asOf: "2026-09-10",
    attributionScope: "marketing-sourced",
    scopeNote: MARKETING_SOURCED_SCOPE_NOTE,
    source: "DWH_ANALYTICS.MARKETING.GOALS_ACTUALS_COMBINED",
    status: "provisional",
  },
  sao: {
    metric: "sao",
    target: 9461,
    ytdActual: 5769,
    fullYearForecast: 9102,
    remainingGap: 359,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    asOf: "2026-09-10",
    attributionScope: "marketing-sourced",
    scopeNote: MARKETING_SOURCED_SCOPE_NOTE,
    source: "DWH_ANALYTICS.MARKETING.GOALS_ACTUALS_COMBINED",
    status: "provisional",
  },
  pipeline: {
    metric: "pipeline",
    target: 202637387,
    ytdActual: 136795914,
    fullYearForecast: 211700000,
    remainingGap: -9062613,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    asOf: "2026-09-10",
    attributionScope: "marketing-sourced",
    scopeNote: MARKETING_SOURCED_SCOPE_NOTE,
    source: "DWH_ANALYTICS.MARKETING.GOALS_ACTUALS_COMBINED",
    status: "provisional",
  },
}
