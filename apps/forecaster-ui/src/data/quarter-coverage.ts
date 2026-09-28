export interface QuarterCoverageMetric {
  actual: number | null
  target: number
  linearForecast?: number | null
  targetStatus?: "governed" | "unverified" | "missing"
  forecastStatus?: "committed" | "provisional" | "required"
}

export type QuarterCoverageStatus = "complete" | "in-progress" | "upcoming"

export function quarterCoverageValue(
  status: QuarterCoverageStatus,
  metric: QuarterCoverageMetric,
): number | null {
  if (status === "complete") return metric.actual
  return metric.linearForecast ?? null
}

export function quarterCoverageAttainment(
  status: QuarterCoverageStatus,
  metric: QuarterCoverageMetric,
): number | null {
  if (metric.targetStatus && metric.targetStatus !== "governed") return null
  const value = quarterCoverageValue(status, metric)
  return value == null || metric.target <= 0 ? null : value / metric.target
}

export function quarterCoverageGap(
  status: QuarterCoverageStatus,
  metric: QuarterCoverageMetric,
): number | null {
  if (metric.targetStatus && metric.targetStatus !== "governed") return null
  const value = quarterCoverageValue(status, metric)
  return value == null ? null : metric.target - value
}
