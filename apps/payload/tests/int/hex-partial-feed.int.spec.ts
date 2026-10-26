import { describe, expect, it } from 'vitest'

import { HEX_PROJECT_ID, validateHexFeed } from '@/integrations/hex'

const partialFeed = {
  schemaVersion: 1,
  projectId: HEX_PROJECT_ID,
  generatedAt: '2026-09-29T12:00:00Z',
  sourceAsOf: '2026-09-29T05:39:00Z',
  semanticSourceGate: 'PASS',
  sourceGovernanceStatus: 'SEMANTIC_APPROVED',
  dsValidationStatus: 'PENDING',
  releaseStatus: 'BLOCKED_DS_VALIDATION',
  pacing: {
    status: 'UNAVAILABLE',
    reason: 'BLOCKED_MISSING_APPROVED_TARGETS',
    availableActualMeasures: ['MQLS'],
    missingTargetMeasures: [{ metric: 'MQL_TARGET', grain: 'GLOBAL_QUARTERLY' }],
    data: null,
  },
  activityReach: {},
  channelMqlRates: { Webinar: 0.25 },
  channelMqlRatesMethod: {
    methodVersion: 'channel-mql-rate-v1-frozen',
    shape: 'channel_only',
    minComparables: 8,
  },
} as const

describe('Hex partial feed validation', () => {
  it('accepts unavailable pacing with governed channel rates', () => {
    expect(validateHexFeed(partialFeed)).toMatchObject({
      pacing: { status: 'UNAVAILABLE' },
      activityReach: {},
      channelMqlRates: { Webinar: 0.25 },
    })
  })

  it('rejects an invalid channel rate', () => {
    expect(() => validateHexFeed({ ...partialFeed, channelMqlRates: { Webinar: 1.25 } })).toThrow(
      'must not exceed 1',
    )
  })

  it('rejects unavailable pacing with live data attached', () => {
    expect(() =>
      validateHexFeed({
        ...partialFeed,
        pacing: { ...partialFeed.pacing, data: { target: 1 } },
      }),
    ).toThrow('data=null')
  })

  it('rejects unsupported fields rather than silently accepting them', () => {
    expect(() => validateHexFeed({ ...partialFeed, contacts: [{ email: 'hidden@example.com' }] }))
      .toThrow('unsupported fields')
  })

  it('rejects sensitive-looking map keys', () => {
    expect(() => validateHexFeed({
      ...partialFeed,
      activityReach: { 'hidden@example.com': 10 },
    })).toThrow('sensitive or record-level key')
  })

  it('rejects malformed timestamps', () => {
    expect(() => validateHexFeed({ ...partialFeed, generatedAt: 'not-a-date' }))
      .toThrow('valid ISO-8601 timestamp')
  })

  it('keeps quarantined outputs out of schema version 1', () => {
    expect(() => validateHexFeed({ ...partialFeed, inboundForecast: { planning: 10 } }))
      .toThrow('must remain omitted or null')
  })
})
