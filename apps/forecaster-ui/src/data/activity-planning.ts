export type ActivityOverride = {
  reach?: number | null
  mqlFcst?: number | null
  comment?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
}

export type ActivityOverridesMap = Record<string, ActivityOverride>

export const ACTIVITY_OVERRIDES_KEY = "activity_overrides_v1"
export const CHANNEL_RATE_OVERRIDES_KEY = "channel_mql_rate_overrides_v1"

export function hasFinitePlanningValue(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}
