export const HEX_PROJECT_ID = '01a0a009-8e2e-716f-a668-81a3fc326cd5'
export const HEX_PROJECT_URL =
  'https://app.hex.tech/figma/app/Marketing-Campaign-Forecaster-WIP-034OglsR9JAGWYwQZ91DjJ/latest'
export const HEX_SNAPSHOT_KEY = 'integration:hex:semantic-approved-output:v1'

export type HexApprovedFeed = {
  schemaVersion: 1
  projectId: string
  generatedAt: string
  sourceAsOf: string
  semanticSourceGate: 'PASS'
  sourceGovernanceStatus: 'SEMANTIC_APPROVED'
  dsValidationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  releaseStatus: string
  pacing: Record<string, unknown>
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
  inboundForecast?: Record<string, unknown> | null
  modelMetadata?: Record<string, unknown> | null
  attributionQuality?: Record<string, unknown> | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateHexFeed(value: unknown): HexApprovedFeed {
  if (!isRecord(value)) throw new Error('Hex payload must be a JSON object')
  if (value.schemaVersion !== 1) throw new Error('Unsupported Hex payload schemaVersion')
  if (value.projectId !== HEX_PROJECT_ID) throw new Error('Hex project ID is not approved')
  if (value.semanticSourceGate !== 'PASS') throw new Error('Hex semantic source gate is not PASS')
  if (value.sourceGovernanceStatus !== 'SEMANTIC_APPROVED') {
    throw new Error('Hex source governance status is not SEMANTIC_APPROVED')
  }
  if (typeof value.generatedAt !== 'string' || typeof value.sourceAsOf !== 'string') {
    throw new Error('Hex generatedAt and sourceAsOf are required')
  }
  if (!isRecord(value.pacing)) throw new Error('Hex pacing output is required')
  if (!isRecord(value.activityReach)) throw new Error('Hex activityReach output is required')
  if (!isRecord(value.channelMqlRates)) throw new Error('Hex channelMqlRates output is required')
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(String(value.dsValidationStatus))) {
    throw new Error('Invalid Hex dsValidationStatus')
  }
  if (typeof value.releaseStatus !== 'string') throw new Error('Hex releaseStatus is required')
  return value as HexApprovedFeed
}

export function isValidSyncSecret(request: Request): boolean {
  const configured = process.env.HEX_SYNC_SECRET
  if (!configured) return false
  const supplied = request.headers.get('authorization')
  return supplied === `Bearer ${configured}`
}
