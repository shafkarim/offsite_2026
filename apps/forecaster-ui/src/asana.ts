const BASE = "https://app.asana.com/api/1.0"

async function asanaFetch<T>(pat: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Asana ${res.status}: ${body || res.statusText}`)
  }
  const json = await res.json()
  return json.data as T
}

export interface AsanaUser {
  gid: string
  name: string
  email: string
}

export interface AsanaWorkspace {
  gid: string
  name: string
}

export interface AsanaProject {
  gid: string
  name: string
  notes: string
  color: string | null
  archived: boolean
  modified_at: string
}

export interface AsanaSection {
  gid: string
  name: string
  project: { gid: string }
}

export interface AsanaCustomField {
  gid: string
  name: string
  type: string
  display_value: string | null
  number_value: number | null
  text_value: string | null
  enum_value: { gid: string; name: string } | null
}

export interface AsanaTask {
  gid: string
  name: string
  notes: string
  completed: boolean
  assignee: { gid: string; name: string } | null
  due_on: string | null
  custom_fields: AsanaCustomField[]
  memberships: {
    project: { gid: string; name: string }
    section: { gid: string; name: string } | null
  }[]
}

export interface AsanaCustomFieldSetting {
  gid: string
  custom_field: {
    gid: string
    name: string
    type: string
  }
}

export async function getMe(pat: string): Promise<AsanaUser> {
  return asanaFetch(pat, "/users/me?opt_fields=name,email")
}

export async function getWorkspaces(pat: string): Promise<AsanaWorkspace[]> {
  return asanaFetch(pat, "/workspaces?opt_fields=name&limit=100")
}

export async function getProjects(pat: string, workspaceGid: string): Promise<AsanaProject[]> {
  return asanaFetch(
    pat,
    `/projects?workspace=${workspaceGid}&opt_fields=name,notes,color,archived,modified_at&limit=100`
  )
}

export async function getSections(pat: string, projectGid: string): Promise<AsanaSection[]> {
  return asanaFetch(pat, `/sections?project=${projectGid}&opt_fields=name,project&limit=100`)
}

export async function getTasksForProject(pat: string, projectGid: string): Promise<AsanaTask[]> {
  return asanaFetch(
    pat,
    `/tasks?project=${projectGid}&opt_fields=name,notes,completed,assignee.name,due_on,custom_fields,memberships.project.name,memberships.section.name&limit=100`
  )
}

export async function getTasksForSection(pat: string, sectionGid: string): Promise<AsanaTask[]> {
  return asanaFetch(
    pat,
    `/tasks?section=${sectionGid}&opt_fields=name,notes,completed,assignee.name,due_on,custom_fields,memberships.project.name,memberships.section.name&limit=100`
  )
}

export async function getProjectCustomFields(
  pat: string,
  projectGid: string
): Promise<AsanaCustomFieldSetting[]> {
  return asanaFetch(
    pat,
    `/projects/${projectGid}/custom_field_settings?opt_fields=custom_field.name,custom_field.type,custom_field.gid&limit=100`
  )
}

export function getFieldValue(task: AsanaTask, fieldGid: string): string | number | null {
  const field = task.custom_fields?.find(f => f.gid === fieldGid)
  if (!field) return null
  if (field.type === "number") return field.number_value
  if (field.type === "text") return field.text_value
  if (field.type === "enum") return field.enum_value?.name || null
  return field.display_value
}

// ── Board sync ────────────────────────────────────────────────────────────────

export const ACTIVITY_BOARDS = [
  { id: "calendar", gid: "1154318831778057", label: "Mktg Calendar" },
] as const

export type BoardId = (typeof ACTIVITY_BOARDS)[number]["id"]

const TASK_OPT_FIELDS = [
  "name", "completed", "due_on",
  "memberships.section.name",
  "custom_fields.gid", "custom_fields.name", "custom_fields.type",
  "custom_fields.display_value", "custom_fields.number_value",
  "custom_fields.text_value", "custom_fields.enum_value.name",
].join(",")

const NOT_ACTIVITY = [
  "MOps/Web Ticket", "Data Science Ticket", "Localization Ticket",
  "Internal Assessment", "Setup Upgrade",
]

const CHANNEL_ALIAS: Record<string, string> = {
  "Webinar/Livestream": "Webinar",
  "IRL-Event": "IRL Event",
  "Organic-Social": "Social",
  "Event-Livestream": "Webinar",
  "Paid Mktg": "Paid",
}

export interface Activity {
  id: string
  board: BoardId
  boardLabel: string
  name: string
  section: string
  due: string | null           // YYYY-MM-DD or null
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

function fieldByName(task: AsanaTask, ...names: string[]): string | number | null {
  if (!task.custom_fields) return null
  const lower = names.map(n => n.toLowerCase())
  for (const f of task.custom_fields) {
    if (!lower.includes((f.name || "").toLowerCase())) continue
    if (f.type === "number" && f.number_value !== null) return f.number_value
    if (f.type === "enum" && f.enum_value) return f.enum_value.name
    if (f.text_value) return f.text_value
    if (f.display_value) return f.display_value
  }
  return null
}

function toActivity(
  task: AsanaTask,
  board: { id: BoardId; label: string }
): Activity | null {
  const name = (task.name || "").trim()
  if (!name || task.completed) return null

  const section = task.memberships?.[0]?.section?.name || ""
  if (isIgnoredForecastActivity({ name, section })) return null

  const rawChannel = String(fieldByName(task, "channel", "Channel") || "")
  const channel = (CHANNEL_ALIAS[rawChannel] || rawChannel) || null
  if (channel && NOT_ACTIVITY.includes(channel)) return null

  const region = String(fieldByName(task, "region", "Region") || "") || null
  const subRegion = String(fieldByName(task, "sub-region", "sub region", "subregion", "Sub-Region") || "") || null
  const goal = String(fieldByName(task, "funnel goal", "goal", "Goal") || "") || null
  const language = String(fieldByName(task, "language", "Language") || "") || null
  const product = String(fieldByName(task, "product", "Product") || "") || null
  const segment = String(fieldByName(task, "segment", "Segment") || "") || null
  const mqlRaw = fieldByName(task, "mql - forecast", "mql", "MQL")
  const sfdc = String(fieldByName(task, "sfdc campaign", "sfdc") || "") || null

  return {
    id: task.gid,
    board: board.id,
    boardLabel: board.label,
    name,
    section,
    due: task.due_on || null,
    region,
    subRegion,
    channel,
    language,
    product,
    segment,
    goal,
    mql: typeof mqlRaw === "number" ? mqlRaw : null,
    sao: null,
    owner: task.assignee?.name || null,
    sfdc,
    completed: false,
  }
}

async function fetchAllTasks(pat: string, projectGid: string): Promise<AsanaTask[]> {
  const tasks: AsanaTask[] = []
  let offset: string | null = null
  do {
    const base = `${BASE}/tasks?project=${projectGid}&completed=false&opt_fields=${TASK_OPT_FIELDS}&limit=100`
    const url: string = offset ? `${base}&offset=${encodeURIComponent(offset)}` : base
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/json" },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Asana ${res.status}: ${body || res.statusText}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    tasks.push(...(json.data || []))
    offset = json.next_page?.offset ?? null
  } while (offset)
  return tasks
}

export async function syncBoards(
  pat: string,
  onProgress?: (msg: string) => void
): Promise<{ activities: Activity[]; errors: string[] }> {
  const activities: Activity[] = []
  const errors: string[] = []

  for (const board of ACTIVITY_BOARDS) {
    onProgress?.(`Fetching ${board.label}…`)
    try {
      const tasks = await fetchAllTasks(pat, board.gid)
      for (const t of tasks) {
        const a = toActivity(t, board)
        if (a) activities.push(a)
      }
      onProgress?.(`${board.label}: ${tasks.length} tasks`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${board.label}: ${msg}`)
    }
  }

  return { activities, errors }
}
