import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { fetchLiveAsanaActivities } from '@/integrations/asana'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ status: 'unauthenticated' }, { status: 401 })

  try {
    const result = await fetchLiveAsanaActivities()
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=240' },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Asana integration error'
    return Response.json({ status: 'unavailable', source: 'Asana API', detail }, { status: 503 })
  }
}
