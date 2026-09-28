import { FY26_PLANNING_METRICS } from "./planning-metrics.ts"

export const FORECAST_CONTRACT = {
  label: "FY26 operating forecast",
  period: "FY26",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  asOf: "2026-09-10",
  scope: "Pipegen (PG)",
  status: "Provisional",
  source: FY26_PLANNING_METRICS.pipeline.source,
  pipelineTargetMillions: FY26_PLANNING_METRICS.pipeline.target / 1_000_000,
} as const

export const FORECAST_WORKFLOW = [
  {
    id: "overview",
    step: "01",
    label: "Forecast",
    description: "Read the outlook and the gap",
  },
  {
    id: "engine",
    step: "02",
    label: "Drivers",
    description: "Understand and adjust the sources",
  },
  {
    id: "activities",
    step: "03",
    label: "Plan",
    description: "Commit activities and ownership",
  },
  {
    id: "pacing",
    step: "04",
    label: "Performance",
    description: "Track actuals and intervene",
  },
] as const
