import { timingSafeEqual } from 'node:crypto'

export const HEX_PROJECT_ID = '01a0a009-8e2e-716f-a668-81a3fc326cd5'
export const HEX_PROJECT_URL =
  'https://app.hex.tech/figma/app/Marketing-Campaign-Forecaster-WIP-034OglsR9JAGWYwQZ91DjJ/latest'
export const HEX_SNAPSHOT_KEY = 'integration:hex:semantic-approved-output:v1'

export type HexIngestReadiness = {
  status: 'ready' | 'blocked'
  ingestEnabled: boolean
  syncSecretConfigured: boolean
  machineCredentialRequiredInSender: true
  machineCredentialHeader: 'X-Figma-Okta-Auth'
}

export type HexUnavailablePacing = {
  status: 'UNAVAILABLE'
  reason: 'BLOCKED_MISSING_APPROVED_TARGETS'
  availableActualMeasures: string[]
  missingTargetMeasures: Array<{ metric: string; grain: string }>
  data: null
}

export type HexChannelMqlRatesMethod = {
  methodVersion: string
  shape: 'channel_only'
  minComparables: number
}

export type HexApprovedFeed = {
  schemaVersion: 1
  projectId: string
  generatedAt: string
  sourceAsOf: string
  semanticSourceGate: 'PASS'
  sourceGovernanceStatus: 'SEMANTIC_APPROVED'
  dsValidationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  releaseStatus: string
  pacing: HexUnavailablePacing
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
  channelMqlRatesMethod?: HexChannelMqlRatesMethod
  inboundForecast?: Record<string, unknown> | null
  modelMetadata?: Record<string, unknown> | null
  attributionQuality?: Record<string, unknown> | null
}

const MAX_ACTIVITY_REACH_KEYS = 10_000
const MAX_CHANNEL_RATE_KEYS = 100
const MAX_MAP_KEY_LENGTH = 200
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'projectId',
  'generatedAt',
  'sourceAsOf',
  'semanticSourceGate',
  'sourceGovernanceStatus',
  'dsValidationStatus',
  'releaseStatus',
  'pacing',
  'activityReach',
  'channelMqlRates',
  'channelMqlRatesMethod',
  'inboundForecast',
  'modelMetadata',
  'attributionQuality',
])

const EMAIL_LIKE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i
const URL_LIKE = /(?:https?:\/\/|www\.)/i
const SALESFORCE_ID_LIKE = /^701[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateMapKey(key: string, label: string) {
  const normalized = key.trim()
  if (!normalized) throw new Error(`${label} contains an empty key`)
  if (normalized.length > MAX_MAP_KEY_LENGTH) throw new Error(`${label} contains an overlong key`)
  if (
    EMAIL_LIKE.test(normalized) ||
    URL_LIKE.test(normalized) ||
    SALESFORCE_ID_LIKE.test(normalized)
  ) {
    throw new Error(`${label} contains a sensitive or record-level key`)
  }
}

function validateNonNegativeNumberMap(
  value: Record<string, unknown>,
  label: string,
  maxEntries: number,
  maximum?: number,
) {
  if (Object.keys(value).length > maxEntries) {
    throw new Error(`${label} contains too many entries`)
  }
  for (const [key, item] of Object.entries(value)) {
    validateMapKey(key, label)
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) {
      throw new Error(`${label}.${key} must be a finite non-negative number`)
    }
    if (maximum !== undefined && item > maximum) {
      throw new Error(`${label}.${key} must not exceed ${maximum}`)
    }
  }
}

function validatePacing(value: Record<string, unknown>) {
  if (value.status !== 'UNAVAILABLE') {
    throw new Error('Hex schemaVersion 1 only accepts the approved unavailable-pacing contract')
  }
  if (value.reason !== 'BLOCKED_MISSING_APPROVED_TARGETS' || value.data !== null) {
    throw new Error('Unavailable Hex pacing must use the approved reason and data=null')
  }
  if (
    !Array.isArray(value.availableActualMeasures) ||
    value.availableActualMeasures.some((item) => typeof item !== 'string' || !item.trim())
  ) {
    throw new Error('Unavailable Hex pacing actual-measure metadata is invalid')
  }
  if (
    !Array.isArray(value.missingTargetMeasures) ||
    value.missingTargetMeasures.length === 0 ||
    value.missingTargetMeasures.some(
      (item) =>
        !isRecord(item) ||
        typeof item.metric !== 'string' ||
        !item.metric.trim() ||
        typeof item.grain !== 'string' ||
        !item.grain.trim(),
    )
  ) {
    throw new Error('Unavailable Hex pacing target-measure metadata is invalid')
  }
}

function validateChannelRateMethod(value: unknown) {
  if (value === undefined) throw new Error('Hex channelMqlRatesMethod is required')
  if (!isRecord(value)) throw new Error('Hex channelMqlRatesMethod must be an object')
  if (typeof value.methodVersion !== 'string' || !value.methodVersion.trim()) {
    throw new Error('Hex channelMqlRatesMethod.methodVersion is required')
  }
  if (value.methodVersion !== 'channel-mql-rate-v1-frozen') {
    throw new Error('Hex channelMqlRatesMethod.methodVersion is not approved')
  }
  if (value.shape !== 'channel_only') {
    throw new Error('Hex channelMqlRatesMethod.shape must be channel_only')
  }
  if (!Number.isInteger(value.minComparables) || Number(value.minComparables) < 1) {
    throw new Error('Hex channelMqlRatesMethod.minComparables must be a positive integer')
  }
}

function parseIsoDate(value: unknown, label: string): number {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`${label} must be a valid ISO-8601 timestamp`)
  return timestamp
}

function validateQuarantinedOutput(value: unknown, label: string) {
  if (value !== undefined && value !== null) {
    throw new Error(`${label} must remain omitted or null while its release gate is blocked`)
  }
}

export function validateHexFeed(value: unknown): HexApprovedFeed {
  if (!isRecord(value)) throw new Error('Hex payload must be a JSON object')
  const unknownKeys = Object.keys(value).filter((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key))
  if (unknownKeys.length > 0)
    throw new Error(`Hex payload contains unsupported fields: ${unknownKeys.join(', ')}`)
  if (value.schemaVersion !== 1) throw new Error('Unsupported Hex payload schemaVersion')
  if (value.projectId !== HEX_PROJECT_ID) throw new Error('Hex project ID is not approved')
  if (value.semanticSourceGate !== 'PASS') throw new Error('Hex semantic source gate is not PASS')
  if (value.sourceGovernanceStatus !== 'SEMANTIC_APPROVED') {
    throw new Error('Hex source governance status is not SEMANTIC_APPROVED')
  }
  const generatedAt = parseIsoDate(value.generatedAt, 'Hex generatedAt')
  const sourceAsOf = parseIsoDate(value.sourceAsOf, 'Hex sourceAsOf')
  if (sourceAsOf > generatedAt) throw new Error('Hex sourceAsOf cannot be later than generatedAt')
  if (generatedAt > Date.now() + 10 * 60 * 1000)
    throw new Error('Hex generatedAt is unreasonably far in the future')
  if (!isRecord(value.pacing)) throw new Error('Hex pacing output is required')
  validatePacing(value.pacing)
  if (!isRecord(value.activityReach)) throw new Error('Hex activityReach output is required')
  if (!isRecord(value.channelMqlRates)) throw new Error('Hex channelMqlRates output is required')
  validateNonNegativeNumberMap(value.activityReach, 'activityReach', MAX_ACTIVITY_REACH_KEYS)
  validateNonNegativeNumberMap(value.channelMqlRates, 'channelMqlRates', MAX_CHANNEL_RATE_KEYS, 1)
  validateChannelRateMethod(value.channelMqlRatesMethod)
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(String(value.dsValidationStatus))) {
    throw new Error('Invalid Hex dsValidationStatus')
  }
  if (
    typeof value.releaseStatus !== 'string' ||
    !value.releaseStatus.trim() ||
    value.releaseStatus.length > 100
  ) {
    throw new Error('Hex releaseStatus is required')
  }
  if (
    value.dsValidationStatus !== 'APPROVED' &&
    !value.releaseStatus.toUpperCase().startsWith('BLOCKED')
  ) {
    throw new Error(
      'Hex releaseStatus must remain blocked until Data Scientist validation is approved',
    )
  }
  validateQuarantinedOutput(value.inboundForecast, 'Hex inboundForecast')
  validateQuarantinedOutput(value.modelMetadata, 'Hex modelMetadata')
  validateQuarantinedOutput(value.attributionQuality, 'Hex attributionQuality')
  return value as HexApprovedFeed
}

export function isValidSyncSecret(request: Request): boolean {
  const configured = process.env.HEX_SYNC_SECRET
  if (!configured) return false
  const supplied = request.headers.get('authorization')
  if (!supplied) return false
  const expectedBuffer = Buffer.from(`Bearer ${configured}`)
  const suppliedBuffer = Buffer.from(supplied)
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  )
}

export function hexIngestReadiness(): HexIngestReadiness {
  const ingestEnabled = process.env.HEX_INGEST_ENABLED === 'true'
  const syncSecretConfigured = Boolean(process.env.HEX_SYNC_SECRET?.trim())
  return {
    status: ingestEnabled && syncSecretConfigured ? 'ready' : 'blocked',
    ingestEnabled,
    syncSecretConfigured,
    machineCredentialRequiredInSender: true,
    machineCredentialHeader: 'X-Figma-Okta-Auth',
  }
}
