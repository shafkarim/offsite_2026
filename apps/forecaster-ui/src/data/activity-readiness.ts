export interface ForecastableActivity {
  id: string
  channel: string | null
  mql: number | null
}

export interface ForecastEvidence {
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
}

export interface LinkableActivity {
  sfdc: string | null
}

export type ForecastReadiness = {
  ready: true
  method: "manual" | "reach-rate"
  reason: null
} | {
  ready: false
  method: null
  reason: "missing-channel" | "unsupported-channel" | "missing-reach-or-manual"
}

export function activityForecastReadiness(
  activity: ForecastableActivity,
  evidence: ForecastEvidence,
): ForecastReadiness {
  if (activity.mql != null)
    return { ready: true, method: "manual", reason: null }
  if (!activity.channel)
    return { ready: false, method: null, reason: "missing-channel" }
  const rate = evidence.channelMqlRates[activity.channel]
  if (typeof rate !== "number" || !Number.isFinite(rate))
    return { ready: false, method: null, reason: "unsupported-channel" }

  const reach = evidence.activityReach[activity.id]
  if (reach == null || !Number.isFinite(reach))
    return { ready: false, method: null, reason: "missing-reach-or-manual" }
  return { ready: true, method: "reach-rate", reason: null }
}

export function forecastReadinessAction(
  activity: ForecastableActivity,
  evidence: ForecastEvidence,
): string | null {
  const status = activityForecastReadiness(activity, evidence)
  if (status.ready) return null
  if (status.reason === "missing-channel")
    return "Add a channel so the workspace can select a compatible model family."
  if (status.reason === "unsupported-channel")
    return "Add a documented manual planning case; this channel has no compatible prior."
  return "Add planned reach or a documented manual planning case."
}

export function hasSalesforceLink(activity: LinkableActivity): boolean {
  return Boolean(activity.sfdc && activity.sfdc !== "—")
}
