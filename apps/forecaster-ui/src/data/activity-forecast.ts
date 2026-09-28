// Asana activity ID is the stable forecast identity — NOT SFDC campaign ID.
// Forecast eligibility and actuals eligibility are independent statuses.
// A missing SFDC campaign ID must not force forecast to zero or prevent proxy/manual forecasts.
// An unlinked activity cannot contribute certified actuals.

export type ForecastEligibility =
  | "modelled"
  | "proxy-modelled"
  | "manual-case"
  | "insufficient-inputs"

export type ActualsEligibility =
  | "linked"
  | "awaiting-salesforce-campaign"
  | "linkage-error"
  | "not-applicable"

export type CampaignLinkageStatus =
  | "not-requested"
  | "requested"
  | "linked"
  | "failed"
  | "not-required"

export interface ActivityForecastRecord {
  activityId: string
  salesforceCampaignId: string | null
  forecastEligibility: ForecastEligibility
  actualsEligibility: ActualsEligibility
  forecastMethod: string
  forecastCreatedAt?: string
}

export interface CampaignLinkage {
  activityId: string
  salesforceCampaignId: string | null
  linkageStatus: CampaignLinkageStatus
  requestedAt?: string
  linkedAt?: string
  owner?: string
}

export function deriveForecastEligibility(
  channelHasPrior: boolean,
  hasReach: boolean,
  hasManualInputs: boolean
): ForecastEligibility {
  if (channelHasPrior && hasReach) return "modelled"
  if (channelHasPrior && !hasReach) return "proxy-modelled"
  if (hasManualInputs) return "manual-case"
  return "insufficient-inputs"
}

export function deriveActualsEligibility(
  sfCampaignId: string | null,
  linkageStatus: CampaignLinkageStatus
): ActualsEligibility {
  if (sfCampaignId && linkageStatus === "linked") return "linked"
  if (!sfCampaignId && linkageStatus === "not-requested") return "awaiting-salesforce-campaign"
  if (linkageStatus === "failed") return "linkage-error"
  if (linkageStatus === "not-required") return "not-applicable"
  return "awaiting-salesforce-campaign"
}

export function forecastEligibilityLabel(e: ForecastEligibility): string {
  switch (e) {
    case "modelled": return "Modelled"
    case "proxy-modelled": return "Proxy-modelled"
    case "manual-case": return "Manual planning case"
    case "insufficient-inputs": return "Insufficient inputs"
  }
}

export function actualsEligibilityLabel(e: ActualsEligibility): string {
  switch (e) {
    case "linked": return "Linked"
    case "awaiting-salesforce-campaign": return "Awaiting SFDC campaign"
    case "linkage-error": return "Linkage error"
    case "not-applicable": return "Not applicable"
  }
}

export function forecastEligibilityColor(e: ForecastEligibility): string {
  switch (e) {
    case "modelled": return "text-emerald-700 bg-emerald-50 border-emerald-200"
    case "proxy-modelled": return "text-blue-700 bg-blue-50 border-blue-200"
    case "manual-case": return "text-amber-700 bg-amber-50 border-amber-200"
    case "insufficient-inputs": return "text-brand-medium-gray bg-[#F7F7F5] border-brand-light-gray"
  }
}

export function actualsEligibilityColor(e: ActualsEligibility): string {
  switch (e) {
    case "linked": return "text-emerald-700 bg-emerald-50 border-emerald-200"
    case "awaiting-salesforce-campaign": return "text-amber-700 bg-amber-50 border-amber-200"
    case "linkage-error": return "text-red-700 bg-red-50 border-red-200"
    case "not-applicable": return "text-brand-medium-gray bg-[#F7F7F5] border-brand-light-gray"
  }
}
