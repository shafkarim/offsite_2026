import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ status: 'unauthenticated' }, { status: 401 })

  const result = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    sort: 'displayName',
  })

  return Response.json(
    {
      status: 'live',
      members: result.docs.map((member) => ({
        id: member.id,
        displayName: member.displayName?.trim() || 'Figma teammate',
        role: member.role,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
