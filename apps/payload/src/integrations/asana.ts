const ASANA_API_BASE = 'https://app.asana.com/api/1.0'
const DEFAULT_PROJECT_GID = '1154318831778057'
const CACHE_TTL_MS = 5 * 60 * 1000

type AsanaCustomField = {
  name?: string
  type?: string
  display_value?: string | null
  number_value?: number | null
  text_value?: string | null
  enum_value?: { name?: string } | null
}

type AsanaTask = {
  gid: string
  name?: string
  completed?: boolean
  due_on?: string | null
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
}

export type AsanaLiveResponse = {
  status: 'live'
  source: 'Asana API'
  projectGid: string
  projectName: 'Marketing Calendar'
  fetchedAt: string
  activities: LiveActivity[]
}

let memoryCache: { expiresAt: number; value: AsanaLiveResponse } | null = null

function fieldValue(task: AsanaTask, ...names: string[]): string | number | null {
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  const field = task.custom_fields?.find((item) => wanted.has((item.name ?? '').toLowerCase()))
  if (!field) return null
  if (field.type === 'number' && typeof field.number_value === 'number') return field.number_value
  if (field.type === 'enum' && field.enum_value?.name) return field.enum_value.name
  return field.text_value ?? field.display_value ?? null
}

const CHANNEL_ALIASES: Record<string, string> = {
  'Webinar/Livestream': 'Webinar',
  'IRL-Event': 'IRL Event',
  'Organic-Social': 'Social',
  'Event-Livestream': 'Webinar',
  'Paid Mktg': 'Paid',
}

const EXCLUDED_CHANNELS = new Set([
  'MOps/Web Ticket',
  'Data Science Ticket',
  'Localization Ticket',
  'Internal Assessment',
  'Setup Upgrade',
])

function textField(task: AsanaTask, ...names: string[]): string | null {
  const value = fieldValue(task, ...names)
  return value == null || String(value).trim() === '' ? null : String(value).trim()
}

function normalizeTask(task: AsanaTask): LiveActivity | null {
  const name = (task.name ?? '').trim()
  if (!name || task.completed) return null

  const rawChannel = textField(task, 'channel')
  const channel = rawChannel ? (CHANNEL_ALIASES[rawChannel] ?? rawChannel) : null
  if (channel && EXCLUDED_CHANNELS.has(channel)) return null

  const rawMql = fieldValue(task, 'mql - forecast', 'mql')
  return {
    id: task.gid,
    board: 'calendar',
    boardLabel: 'Mktg Calendar',
    name,
    section: task.memberships?.[0]?.section?.name ?? '',
    due: task.due_on ?? null,
    region: textField(task, 'region'),
    subRegion: textField(task, 'sub-region', 'sub region', 'subregion'),
    channel,
    language: textField(task, 'language'),
    product: textField(task, 'product'),
    segment: textField(task, 'segment'),
    goal: textField(task, 'funnel goal', 'goal'),
    mql: typeof rawMql === 'number' ? rawMql : null,
    sao: null,
    sfdc: textField(task, 'sfdc campaign', 'sfdc'),
    // Personal data is deliberately excluded from the app response.
    owner: null,
  }
}

async function fetchPage(token: string, projectGid: string, offset?: string) {
  const fields = [
    'name',
    'completed',
    'due_on',
    'memberships.section.name',
    'custom_fields.name',
    'custom_fields.type',
    'custom_fields.display_value',
    'custom_fields.number_value',
    'custom_fields.text_value',
    'custom_fields.enum_value.name',
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
    const detail = await response.text().catch(() => '')
    throw new Error(`Asana live read failed (${response.status}): ${detail || response.statusText}`)
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

  const value: AsanaLiveResponse = {
    status: 'live',
    source: 'Asana API',
    projectGid,
    projectName: 'Marketing Calendar',
    fetchedAt: new Date().toISOString(),
    activities: tasks.map(normalizeTask).filter((item): item is LiveActivity => item !== null),
  }
  memoryCache = { value, expiresAt: Date.now() + CACHE_TTL_MS }
  return value
}
