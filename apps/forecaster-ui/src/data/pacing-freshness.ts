const DAY_MS = 86_400_000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function utcDay(value: string | Date): number | null {
  if (value instanceof Date) {
    const time = Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    )
    return Number.isFinite(time) ? time : null
  }

  const normalized = DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value
  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) return null
  return Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  )
}

export function pacingDataAgeInDays(
  dataThrough: string,
  now = new Date(),
): number | null {
  const sourceDay = utcDay(dataThrough)
  const currentDay = utcDay(now)
  if (sourceDay == null || currentDay == null) return null
  return Math.max(0, Math.floor((currentDay - sourceDay) / DAY_MS))
}

export function pacingFreshness(
  dataThrough: string,
  now = new Date(),
): "fresh" | "aging" | "stale" | "invalid" {
  const age = pacingDataAgeInDays(dataThrough, now)
  if (age == null) return "invalid"
  if (age <= 1) return "fresh"
  if (age <= 3) return "aging"
  return "stale"
}

export function isPacingDecisionReady(
  dataThrough: string,
  isLive: boolean,
  now = new Date(),
): boolean {
  return isLive && pacingFreshness(dataThrough, now) === "fresh"
}

export function isPacingSnapshotRegression(
  incomingDataThrough: string,
  currentDataThrough: string,
): boolean {
  const incoming = utcDay(incomingDataThrough)
  const current = utcDay(currentDataThrough)
  if (incoming == null) return true
  if (current == null) return false
  return incoming < current
}

export function formatSourceDate(value: string): string {
  const normalized = DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value
  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) return "Unknown"
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}
