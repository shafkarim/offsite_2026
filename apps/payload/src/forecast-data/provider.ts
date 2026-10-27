export type ForecastDataMode = 'poc' | 'governed'

export type ForecastPacingUnavailable = {
  status: 'UNAVAILABLE'
  reason: 'BLOCKED_MISSING_APPROVED_TARGETS'
  availableActualMeasures: string[]
  missingTargetMeasures: Array<{ metric: string; grain: string }>
  data: null
}

export type ForecastChannelRateMethod = {
  methodVersion: string
  shape: 'channel_only'
  minComparables: number
}

export type ForecastDataFeed = {
  schemaVersion: 1
  providerMode: ForecastDataMode
  projectId: string
  generatedAt: string
  sourceAsOf: string
  semanticSourceGate: 'PASS' | 'NOT_APPLICABLE'
  sourceGovernanceStatus: 'SEMANTIC_APPROVED' | 'POC_ASSUMPTIONS'
  dsValidationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_APPLICABLE'
  releaseStatus: string
  pacing: Record<string, unknown> | ForecastPacingUnavailable
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
  channelMqlRatesMethod?: ForecastChannelRateMethod
  inboundForecast?: Record<string, unknown> | null
  modelMetadata?: Record<string, unknown> | null
  attributionQuality?: Record<string, unknown> | null
}

export type ForecastDataResult = {
  dataMode: ForecastDataMode
  source: 'Payload POC assumptions' | 'Governed semantic provider'
  projectUrl: string | null
  receivedAt: string
  forecastUsable: boolean
  pacingUsable: boolean
  channelRatesUsable: boolean
  detail: string
  feed: ForecastDataFeed
}

export interface ForecastDataProvider {
  readonly mode: ForecastDataMode
  load(): Promise<ForecastDataResult>
}

const POC_CHANNEL_MQL_RATES = Object.freeze({
  ABM: 0.09,
  Conference: 0.11,
  'Content Syndication': 0.07,
  'Direct Download': 0.08,
  'Direct Mail': 0.03,
  Email: 0.04,
  Event: 0.12,
  'IRL Event': 0.12,
  'Paid Marketing': 0.05,
  'Partner Lead': 0.1,
  Webinar: 0.18,
})

function metric(actual: number | null, target: number, forecast: number | null, elapsed = 0.6) {
  const attainment = actual == null || target === 0 ? null : actual / target
  return {
    actual,
    target,
    attainment,
    pacingIndex: attainment == null || elapsed === 0 ? null : attainment / elapsed,
    linearForecast: forecast,
  }
}

// Historical visual fixture retained for reference while the POC contract
// deliberately returns pacing as unavailable. It is never served as live data.
function _legacyPocPacingFixture(): Record<string, unknown> {
  const asOf = '2026-10-01'
  const regions = [
    ['GLOBAL', 6000, 10000, 720, 1200, 24_000_000, 40_000_000],
    ['AMER', 2700, 4500, 315, 520, 10_800_000, 18_000_000],
    ['EMEA', 1800, 3000, 225, 380, 7_200_000, 12_000_000],
    ['APAC', 720, 1200, 86, 145, 2_880_000, 4_800_000],
    ['JAPAN', 420, 700, 52, 85, 1_680_000, 2_800_000],
    ['LATAM', 360, 600, 42, 70, 1_440_000, 2_400_000],
  ].map(([region, mqlActual, mqlTarget, saoActual, saoTarget, pgActual, pgTarget]) => ({
    region,
    mql: metric(Number(mqlActual), Number(mqlTarget), Math.round(Number(mqlActual) / 0.6)),
    sao: metric(Number(saoActual), Number(saoTarget), Math.round(Number(saoActual) / 0.6)),
    pg: metric(Number(pgActual), Number(pgTarget), Math.round(Number(pgActual) / 0.6)),
  }))

  const channels = Object.entries(POC_CHANNEL_MQL_RATES).map(([channel, rate], index) => {
    const target = 500 + index * 75
    const actual = Math.round(target * (0.48 + (index % 4) * 0.06))
    const saoTarget = Math.round(target * 0.12)
    const saoActual = Math.round(actual * 0.12)
    const pgTarget = saoTarget * 35_000
    const pgActual = saoActual * 35_000
    return {
      channel,
      mql: metric(actual, target, Math.round(actual / 0.6)),
      sao: metric(saoActual, saoTarget, Math.round(saoActual / 0.6)),
      pg: metric(pgActual, pgTarget, Math.round(pgActual / 0.6)),
      pocAssumptionRate: rate,
    }
  })

  return {
    quarter: 'Q4 2026 · POC',
    quarterStart: '2026-10-01',
    quarterEnd: '2026-12-31',
    quarterElapsedPct: 0.6,
    asOf,
    sourceDataThrough: asOf,
    forecast7dAsOf: asOf,
    forecast30dAsOf: asOf,
    sourceRefreshedAt: '2026-10-01T00:00:00.000Z',
    sourceTable: 'POC_ASSUMPTIONS_NOT_A_WAREHOUSE_SOURCE',
    hexThread: '',
    forecastScope: 'pipegen',
    attributedSource: 'POC representative assumptions',
    channelsStatus: 'current',
    subRegionsStatus: 'not_governed_in_this_run',
    quarters: [
      {
        id: 'Q1',
        label: 'Q1 FY26 · POC',
        period: 'Jan – Mar 2026',
        start: '2026-01-01',
        end: '2026-03-31',
        status: 'complete',
        mql: metric(2100, 2200, null, 1),
        sao: metric(252, 264, null, 1),
        pg: metric(8_820_000, 9_240_000, null, 1),
      },
      {
        id: 'Q2',
        label: 'Q2 FY26 · POC',
        period: 'Apr – Jun 2026',
        start: '2026-04-01',
        end: '2026-06-30',
        status: 'complete',
        mql: metric(2300, 2400, null, 1),
        sao: metric(276, 288, null, 1),
        pg: metric(9_660_000, 10_080_000, null, 1),
      },
      {
        id: 'Q3',
        label: 'Q3 FY26 · POC',
        period: 'Jul – Sep 2026',
        start: '2026-07-01',
        end: '2026-09-30',
        status: 'complete',
        mql: metric(1600, 2500, null, 1),
        sao: metric(192, 300, null, 1),
        pg: metric(6_720_000, 10_500_000, null, 1),
      },
      {
        id: 'Q4',
        label: 'Q4 FY26 · POC',
        period: 'Oct – Dec 2026',
        start: '2026-10-01',
        end: '2026-12-31',
        status: 'in-progress',
        elapsedPct: 0.6,
        mql: metric(0, 2900, 2600, 0.6),
        sao: metric(0, 348, 312, 0.6),
        pg: metric(0, 10_180_000, 9_100_000, 0.6),
      },
    ],
    fy: {
      label: 'FY26 · POC',
      period: 'Jan – Dec 2026',
      note: 'Representative planning assumptions only. Not approved actuals or targets.',
      mql: { target: 10_000, ytdActual: 6_000, fullYearForecast: 9_200, fullYearAttainment: 0.92 },
      sao: { target: 1_200, ytdActual: 720, fullYearForecast: 1_104, fullYearAttainment: 0.92 },
      pg: { target: 40_000_000, ytdActual: 24_000_000, fullYearForecast: 36_800_000, fullYearAttainment: 0.92 },
    },
    regions,
    channels,
  }
}

class PocForecastDataProvider implements ForecastDataProvider {
  readonly mode = 'poc' as const

  async load(): Promise<ForecastDataResult> {
    const receivedAt = new Date().toISOString()
    return {
      dataMode: this.mode,
      source: 'Payload POC assumptions',
      projectUrl: null,
      receivedAt,
      forecastUsable: false,
      pacingUsable: false,
      channelRatesUsable: true,
      detail:
        'Live Asana and shared Payload planning are enabled. Performance actuals and approved targets are not connected in this POC.',
      feed: {
        schemaVersion: 1,
        providerMode: this.mode,
        projectId: 'payload-poc-provider-v1',
        generatedAt: receivedAt,
        sourceAsOf: receivedAt,
        semanticSourceGate: 'NOT_APPLICABLE',
        sourceGovernanceStatus: 'POC_ASSUMPTIONS',
        dsValidationStatus: 'NOT_APPLICABLE',
        releaseStatus: 'POC_ONLY_NOT_FOR_REPORTING',
        pacing: {
          status: 'UNAVAILABLE',
          reason: 'BLOCKED_MISSING_APPROVED_TARGETS',
          availableActualMeasures: [],
          missingTargetMeasures: [
            { metric: 'MQL_TARGET', grain: 'GLOBAL_QUARTERLY' },
            { metric: 'SAO_TARGET', grain: 'GLOBAL_QUARTERLY' },
            { metric: 'MARKETING_SOURCED_PIPELINE_TARGET', grain: 'GLOBAL_QUARTERLY' },
          ],
          data: null,
        },
        activityReach: {},
        channelMqlRates: { ...POC_CHANNEL_MQL_RATES },
        channelMqlRatesMethod: {
          methodVersion: 'poc-assumptions-v1',
          shape: 'channel_only',
          minComparables: 0,
        },
        inboundForecast: null,
        modelMetadata: {
          status: 'POC_ONLY',
          fixtureVersion: 'poc-assumptions-v1',
          effectiveAsOf: receivedAt,
          note: 'Editable starting assumptions support activity planning only. Performance actuals and approved targets remain unavailable.',
        },
        attributionQuality: null,
      },
    }
  }
}

class GovernedForecastDataProvider implements ForecastDataProvider {
  readonly mode = 'governed' as const

  async load(): Promise<ForecastDataResult> {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'governed-snapshots',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: { key: { equals: HEX_SNAPSHOT_KEY } },
    })
    const document = result.docs[0]
    if (!document) throw new Error('No approved governed forecast snapshot has been received yet')
    const feed = validateHexFeed(document.value)
    return {
      dataMode: this.mode,
      source: 'Governed semantic provider',
      projectUrl: HEX_PROJECT_URL,
      receivedAt: document.updatedAt,
      forecastUsable:
        feed.dsValidationStatus === 'APPROVED' && !feed.releaseStatus.toUpperCase().startsWith('BLOCKED'),
      pacingUsable: feed.pacing.status !== 'UNAVAILABLE',
      channelRatesUsable: Object.keys(feed.channelMqlRates).length > 0,
      detail: 'Validated aggregate forecast evidence from the approved semantic-source delivery.',
      feed: { ...feed, providerMode: this.mode },
    }
  }
}

export function configuredForecastDataMode(): ForecastDataMode {
  const configured = process.env.FORECAST_DATA_MODE?.trim().toLowerCase()
  if (configured === 'poc' || configured === 'governed') return configured
  throw new Error('FORECAST_DATA_MODE must be explicitly configured as poc or governed')
}

export function forecastDataProvider(): ForecastDataProvider {
  return configuredForecastDataMode() === 'governed'
    ? new GovernedForecastDataProvider()
    : new PocForecastDataProvider()
}
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { HEX_PROJECT_URL, HEX_SNAPSHOT_KEY, validateHexFeed } from '@/integrations/hex'

