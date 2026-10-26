import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { forecastDataProvider } from '@/forecast-data/provider'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ status: 'unauthenticated' }, { status: 401 })

  try {
    const result = await forecastDataProvider().load()
    return Response.json({ status: 'live', ...result })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Forecast data provider unavailable'
    return Response.json(
      {
        status: 'blocked',
        dataMode: process.env.FORECAST_DATA_MODE?.trim().toLowerCase() ?? 'unconfigured',
        detail,
      },
      { status: 503 },
    )
  }
}

