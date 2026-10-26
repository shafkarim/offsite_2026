import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { HEX_PROJECT_ID, HEX_PROJECT_URL, HEX_SNAPSHOT_KEY, validateHexFeed } from '@/integrations/hex'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ status: 'unauthenticated' }, { status: 401 })

  const result = await payload.find({
    collection: 'governed-snapshots',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { key: { equals: HEX_SNAPSHOT_KEY } },
  })
  let document: { value: unknown; updatedAt?: string } | undefined = result.docs[0]
  // Temporary read-only fallback for the snapshot stored before the protected
  // governed-snapshots collection was introduced. A successful new ingest
  // automatically moves subsequent reads to the protected collection.
  if (!document) {
    const legacy = await payload.find({
      collection: 'app-state',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: { key: { equals: HEX_SNAPSHOT_KEY } },
    })
    document = legacy.docs[0]
  }
  if (!document) {
    return Response.json(
      {
        status: 'unavailable',
        detail: 'No approved Hex feed has been received yet',
        projectId: HEX_PROJECT_ID,
        projectUrl: HEX_PROJECT_URL,
      },
      { status: 503 },
    )
  }

  try {
    const feed = validateHexFeed(document.value)
    const pacingUsable = feed.pacing.status !== 'UNAVAILABLE'
    return Response.json({
      status: 'live',
      dataMode: 'governed',
      source: 'Governed semantic provider',
      projectUrl: HEX_PROJECT_URL,
      receivedAt: document.updatedAt ?? feed.generatedAt,
      forecastUsable:
        feed.dsValidationStatus === 'APPROVED' && !feed.releaseStatus.toUpperCase().startsWith('BLOCKED'),
      pacingUsable,
      channelRatesUsable: Object.keys(feed.channelMqlRates).length > 0,
      feed: { ...feed, providerMode: 'governed' },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid Hex feed'
    return Response.json({ status: 'blocked', detail, projectUrl: HEX_PROJECT_URL }, { status: 503 })
  }
}
