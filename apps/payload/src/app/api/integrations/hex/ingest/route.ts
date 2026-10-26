import configPromise from '@payload-config'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'

import { HEX_SNAPSHOT_KEY, isValidSyncSecret, validateHexFeed } from '@/integrations/hex'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) throw new Error('Hex payload exceeds the 64 KB limit')
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error('Hex payload exceeds the 64 KB limit')
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Hex payload must contain valid JSON')
  }
}

export async function POST(request: Request) {
  if (process.env.HEX_INGEST_ENABLED !== 'true') {
    return Response.json(
      {
        status: 'disabled',
        detail:
          'Hex snapshot ingestion is disabled for this environment.',
      },
      { status: 503 },
    )
  }

  if (!isValidSyncSecret(request)) {
    return Response.json({ status: 'unauthorized' }, { status: 401 })
  }

  try {
    const feed = validateHexFeed(await readJsonBody(request))
    const contentHash = createHash('sha256').update(JSON.stringify(feed)).digest('hex')
    const payload = await getPayload({ config: configPromise })
    const existing = await payload.find({
      collection: 'governed-snapshots',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: { key: { equals: HEX_SNAPSHOT_KEY } },
    })

    if (existing.docs[0]) {
      const existingGeneratedAt = Date.parse(existing.docs[0].sourceGeneratedAt)
      const existingSourceAsOf = Date.parse(existing.docs[0].sourceAsOf)
      if (existing.docs[0].contentHash === contentHash) {
        return Response.json({ status: 'duplicate', generatedAt: feed.generatedAt }, { status: 409 })
      }
      if (Date.parse(feed.generatedAt) <= existingGeneratedAt || Date.parse(feed.sourceAsOf) < existingSourceAsOf) {
        return Response.json(
          { status: 'rejected', detail: 'A newer governed Hex snapshot is already stored' },
          { status: 409 },
        )
      }
      await payload.update({
        collection: 'governed-snapshots',
        id: existing.docs[0].id,
        overrideAccess: true,
        data: {
          value: feed,
          sourceGeneratedAt: feed.generatedAt,
          sourceAsOf: feed.sourceAsOf,
          contentHash,
        },
      })
    } else {
      await payload.create({
        collection: 'governed-snapshots',
        overrideAccess: true,
        data: {
          key: HEX_SNAPSHOT_KEY,
          value: feed,
          sourceGeneratedAt: feed.generatedAt,
          sourceAsOf: feed.sourceAsOf,
          contentHash,
        },
      })
    }

    return Response.json({ status: 'accepted', generatedAt: feed.generatedAt }, { status: 202 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid Hex feed'
    return Response.json({ status: 'rejected', detail }, { status: 400 })
  }
}
