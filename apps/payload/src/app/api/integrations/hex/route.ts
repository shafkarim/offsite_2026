import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { HEX_PROJECT_ID, HEX_PROJECT_URL, HEX_SNAPSHOT_KEY, validateHexFeed } from '@/integrations/hex'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ status: 'unauthenticated' }, { status: 401 })

  const result = await payload.find({
    collection: 'app-state',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: false,
    user,
    where: { key: { equals: HEX_SNAPSHOT_KEY } },
  })
  const document = result.docs[0]
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
    return Response.json({
      status: 'live',
      source: 'Hex semantic-approved feed',
      projectUrl: HEX_PROJECT_URL,
      receivedAt: document.updatedAt,
      forecastUsable:
        feed.dsValidationStatus === 'APPROVED' && !feed.releaseStatus.toUpperCase().startsWith('BLOCKED'),
      feed,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid Hex feed'
    return Response.json({ status: 'blocked', detail, projectUrl: HEX_PROJECT_URL }, { status: 503 })
  }
}
