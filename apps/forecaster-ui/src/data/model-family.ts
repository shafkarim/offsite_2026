export type InboundModelFamily = "web-form-intent" | "support-sourced"

export const RETIRED_FORECAST_SOURCES = ["Other Madkudu Signals"] as const

export interface ModelFamilyDefinition {
  id: InboundModelFamily
  label: string
  model: "web-form-run-rate" | "support-lead-run-rate"
  channels: readonly string[]
  behaviouralRationale: string
  allowedFallback: "same-family-only"
  status: "active" | "review-required"
  forecastEligible: boolean
  owner: string
  reviewAction?: string
}

export const INBOUND_MODEL_FAMILIES: readonly ModelFamilyDefinition[] = [
  {
    id: "web-form-intent",
    label: "High-intent web forms",
    model: "web-form-run-rate",
    channels: ["Orgs Web Form"],
    behaviouralRationale: "Explicit form submission signals active intent and a request to engage.",
    allowedFallback: "same-family-only",
    status: "active",
    forecastEligible: true,
    owner: "Marketing Operations",
  },
  {
    id: "support-sourced",
    label: "Support-sourced demand",
    model: "support-lead-run-rate",
    channels: ["Support Leads"],
    behaviouralRationale:
      "Support interactions can reveal qualified commercial intent, but service-only conversations must remain excluded.",
    allowedFallback: "same-family-only",
    status: "review-required",
    forecastEligible: false,
    owner: "Support Operations + Marketing Operations",
    reviewAction: SUPPORT_LEADS_REVIEW_ACTION,
  },
] as const

export function getModelFamily(
  familyId: InboundModelFamily,
): ModelFamilyDefinition | undefined {
  return INBOUND_MODEL_FAMILIES.find((family) => family.id === familyId)
}

export function getInboundFamily(channel: string): ModelFamilyDefinition | undefined {
  return INBOUND_MODEL_FAMILIES.find((family) => family.channels.includes(channel))
}

export function isAlwaysOnInboundSource(channel: string): boolean {
  return getInboundFamily(channel) !== undefined
}

export function isRetiredForecastSource(channel: string): boolean {
  return (RETIRED_FORECAST_SOURCES as readonly string[]).includes(channel)
}

export function assertDisjointModelFamilies(
  families: readonly ModelFamilyDefinition[] = INBOUND_MODEL_FAMILIES,
): void {
  const owners = new Map<string, string>()
  for (const family of families) {
    for (const channel of family.channels) {
      const existing = owners.get(channel)
      if (existing) throw new Error(`${channel} is assigned to both ${existing} and ${family.id}`)
      owners.set(channel, family.id)
    }
  }
}

export function assertTrainingRowsBelongToFamily(
  familyId: InboundModelFamily,
  rows: readonly { channel: string }[],
): void {
  const family = getModelFamily(familyId)
  if (!family) throw new Error(`Unknown model family: ${familyId}`)

  const contaminants = [...new Set(rows.map((row) => row.channel).filter((channel) => !family.channels.includes(channel)))]
  if (contaminants.length > 0) {
    throw new Error(`${family.label} contains incompatible channels: ${contaminants.join(", ")}`)
  }
}

assertDisjointModelFamilies()
import { SUPPORT_LEADS_REVIEW_ACTION } from "./source-reconciliation.ts"
