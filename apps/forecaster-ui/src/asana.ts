/**
 * Browser-safe Asana contract.
 *
 * The app intentionally contains no Asana token handling or direct Asana API
 * client. Live tasks are fetched by Payload's authenticated server route.
 */

export const ACTIVITY_BOARDS = [
  { id: "calendar", label: "Mktg Calendar" },
] as const

export type BoardId = (typeof ACTIVITY_BOARDS)[number]["id"]

export interface Activity {
  id: string
  board: BoardId
  boardLabel: string
  name: string
  section: string
  due: string | null
  region: string | null
  subRegion?: string | null
  channel: string | null
  language?: string | null
  product?: string | null
  segment?: string | null
  goal: string | null
  mql: number | null
  sao: number | null
  sfdc: string | null
  owner: string | null
  completed?: boolean
  modifiedAt?: string | null
  permalinkUrl?: string | null
}

export function isIgnoredForecastActivity(
  activity: Pick<Activity, "name" | "section">,
): boolean {
  const labels = [activity.name, activity.section]
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ""))
  return labels.some((value) => value.includes("fignation"))
}
