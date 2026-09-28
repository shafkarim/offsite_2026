import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { HEX_SNAPSHOT_KEY, isValidSyncSecret, validateHexFeed } from '@/integrations/hex'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isValidSyncSecret(request)) {
    return Response.json({ status: 'unauthorized' }, { status: 401 })
  }

  try {
    const feed = validateHexFeed(await request.json())
    const payload = await getPayload({ config: configPromise })
    const existing = await payload.find({
      collection: 'app-state',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: { key: { equals: HEX_SNAPSHOT_KEY } },
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'app-state',
        id: existing.docs[0].id,
        overrideAccess: true,
        data: { value: feed },
      })
    } else {
      await payload.create({
        collection: 'app-state',
        overrideAccess: true,
        data: { key: HEX_SNAPSHOT_KEY, value: feed },
      })
    }

    return Response.json({ status: 'accepted', generatedAt: feed.generatedAt }, { status: 202 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid Hex feed'
    return Response.json({ status: 'rejected', detail }, { status: 400 })
  }
}
