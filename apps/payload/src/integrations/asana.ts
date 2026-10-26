const ASANA_API_BASE = 'https://app.asana.com/api/1.0'
const DEFAULT_PROJECT_GID = '1154318831778057'
const CACHE_TTL_MS = 5 * 60 * 1000

type AsanaCustomField = {
  gid?: string
  name?: string
  type?: string
  display_value?: string | null
  number_value?: number | null
  text_value?: string | null
  enum_value?: { name?: string } | null
  multi_enum_values?: Array<{ name?: string }> | null
}

type AsanaTask = {
  gid: string
  name?: string
  completed?: boolean
  due_on?: string | null
  modified_at?: string | null
  permalink_url?: string | null
  custom_fields?: AsanaCustomField[]
  memberships?: Array<{ section?: { name?: string } | null }>
}

export type LiveActivity = {
  id: string
  board: 'calendar'
  boardLabel: 'Mktg Calendar'
  name: string
  section: string
  due: string | null
  region: string | null
  subRegion: string | null
  channel: string | null
  language: string | null
  product: string | null
  segment: string | null
  goal: string | null
  mql: number | null
  sao: null
  sfdc: string | null
  owner: null
  modifiedAt: string | null
  permalinkUrl: string | null
}

export type AsanaMappingCoverage = {
  total: number
  channel: number
  region: number
  subRegion: number
  mqlForecast: number
  salesforceCampaign: number
}

export type AsanaLiveResponse = {
  status: 'live'
  source: 'Asana API'
  projectGid: string
  projectName: 'Marketing Calendar'
  fetchedAt: string
  mappingCoverage: AsanaMappingCoverage
  activities: LiveActivity[]
}

let memoryCache: { expiresAt: number; value: AsanaLiveResponse } | null = null

export function normalizeAsanaLabel(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function fieldValue(task: AsanaTask, ...names: string[]): string | number | null {
  const wanted = new Set(names.map(normalizeAsanaLabel))
  const field = task.custom_fields?.find((item) => wanted.has(normalizeAsanaLabel(item.name ?? '')))
  if (!field) return null
  if (field.type === 'number' && typeof field.number_value === 'number') return field.number_value
  if (field.type === 'enum' && field.enum_value?.name) return field.enum_value.name
  if (field.type === 'multi_enum' && field.multi_enum_values?.length) {
    return field.multi_enum_values.map((item) => item.name).filter(Boolean).join(', ')
  }
  return field.text_value ?? field.display_value ?? null
}

const CHANNEL_ALIASES: Record<string, string> = {
  'webinar livestream': 'Webinar',
  'irl event': 'IRL Event',
  'organic social': 'Social',
  'event livestream': 'Webinar',
  'paid mktg': 'Paid',
}

const EXCLUDED_CHANNELS = new Set([
  'mops web ticket',
  'data science ticket',
  'localization ticket',
  'internal assessment',
  'setup upgrade',
])

const FIELD_NAMES = {
  channel: [
    'channel',
    'marketing channel',
    'campaign channel',
    'activity channel',
    'channel / tactic',
    'channel tactic',
  ],
  region: ['region', 'marketing region', 'sales region', 'geo', 'geography', 'primary region'],
  subRegion: [
    'sub-region',
    'sub region',
    'subregion',
    'marketing sub-region',
    'sales sub-region',
    'geo sub-region',
  ],
  language: ['language', 'campaign language', 'locale'],
  product: ['product', 'product area', 'product line'],
  segment: ['segment', 'customer segment', 'market segment'],
  goal: ['funnel goal', 'campaign goal', 'marketing goal', 'goal', 'objective'],
  mql: ['mql - forecast', 'mql forecast', 'mqls forecast', 'forecast mql', 'mql target', 'mql goal', 'mql'],
  sfdc: [
    'sfdc campaign',
    'sfdc campaign id',
    'salesforce campaign',
    'salesforce campaign id',
    'campaign id',
    'campaign url',
  ],
} as const

function textField(task: AsanaTask, ...names: string[]): string | null {
  const value = fieldValue(task, ...names)
  return value == null || String(value).trim() === '' ? null : String(value).trim()
}

function numberField(task: AsanaTask, ...names: string[]): number | null {
  const value = fieldValue(task, ...names)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeAsanaTask(task: AsanaTask): LiveActivity | null {
  const name = (task.name ?? '').trim()
  if (!name || task.completed) return null

  const rawChannel = textField(task, ...FIELD_NAMES.channel)
  const normalizedChannel = rawChannel ? normalizeAsanaLabel(rawChannel) : null
  const channel = rawChannel && normalizedChannel
    ? (CHANNEL_ALIASES[normalizedChannel] ?? rawChannel)
    : null
  if (normalizedChannel && EXCLUDED_CHANNELS.has(normalizedChannel)) return null

  return {
    id: task.gid,
    board: 'calendar',
    boardLabel: 'Mktg Calendar',
    name,
    section: task.memberships?.[0]?.section?.name ?? '',
    due: task.due_on ?? null,
    region: textField(task, ...FIELD_NAMES.region),
    subRegion: textField(task, ...FIELD_NAMES.subRegion),
    channel,
    language: textField(task, ...FIELD_NAMES.language),
    product: textField(task, ...FIELD_NAMES.product),
    segment: textField(task, ...FIELD_NAMES.segment),
    goal: textField(task, ...FIELD_NAMES.goal),
    mql: numberField(task, ...FIELD_NAMES.mql),
    sao: null,
    sfdc: textField(task, ...FIELD_NAMES.sfdc),
    // Personal data is deliberately excluded from the app response.
    owner: null,
    modifiedAt: task.modified_at ?? null,
    permalinkUrl: task.permalink_url ?? null,
  }
}

export function mappingCoverage(activities: LiveActivity[]): AsanaMappingCoverage {
  return {
    total: activities.length,
    channel: activities.filter((activity) => Boolean(activity.channel)).length,
    region: activities.filter((activity) => Boolean(activity.region)).length,
    subRegion: activities.filter((activity) => Boolean(activity.subRegion)).length,
    mqlForecast: activities.filter((activity) => activity.mql !== null).length,
    salesforceCampaign: activities.filter((activity) => Boolean(activity.sfdc)).length,
  }
}

async function fetchPage(token: string, projectGid: string, offset?: string) {
  const fields = [
    'name',
    'completed',
    'due_on',
    'modified_at',
    'permalink_url',
    'memberships.section.name',
    'custom_fields.gid',
    'custom_fields.name',
    'custom_fields.type',
    'custom_fields.display_value',
    'custom_fields.number_value',
    'custom_fields.text_value',
    'custom_fields.enum_value.name',
    'custom_fields.multi_enum_values.name',
  ].join(',')
  const params = new URLSearchParams({
    project: projectGid,
    completed_since: 'now',
    limit: '100',
    opt_fields: fields,
  })
  if (offset) params.set('offset', offset)

  const response = await fetch(`${ASANA_API_BASE}/tasks?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    // Do not surface upstream response bodies: they may contain provider or
    // account details that should remain in server logs only.
    throw new Error(`Asana live read failed (${response.status})`)
  }
  return response.json() as Promise<{
    data?: AsanaTask[]
    next_page?: { offset?: string | null } | null
  }>
}

export async function fetchLiveAsanaActivities(): Promise<AsanaLiveResponse> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.value

  const token = process.env.ASANA_ACCESS_TOKEN
  if (!token) throw new Error('ASANA_ACCESS_TOKEN is not configured in the staging environment')

  const projectGid = process.env.ASANA_MARKETING_CALENDAR_GID ?? DEFAULT_PROJECT_GID
  if (projectGid !== DEFAULT_PROJECT_GID) {
    throw new Error('Refusing to read an unapproved Asana project')
  }

  const tasks: AsanaTask[] = []
  let offset: string | undefined
  do {
    const page = await fetchPage(token, projectGid, offset)
    tasks.push(...(page.data ?? []))
    offset = page.next_page?.offset ?? undefined
  } while (offset)

  const activities = tasks
    .map(normalizeAsanaTask)
    .filter((item): item is LiveActivity => item !== null)
  const value: AsanaLiveResponse = {
    status: 'live',
    source: 'Asana API',
    projectGid,
    projectName: 'Marketing Calendar',
    fetchedAt: new Date().toISOString(),
    mappingCoverage: mappingCoverage(activities),
    activities,
  }
  memoryCache = { value, expiresAt: Date.now() + CACHE_TTL_MS }
  return value
}
