import { useMemo, useState } from "react"

import type { Activity } from "../asana"
import { useCollaboration } from "../collaboration"
import { useLiveAsana, useLiveHex } from "../live-sources"
import { usePayloadValue } from "../payload"

type ActivityOverride = {
  reach?: number | null
  mqlFcst?: number | null
  comment?: string | null
}

type OverridesMap = Record<string, ActivityOverride>
const OVERRIDES_KEY = "activity_overrides_v1"
const RATE_OVERRIDES_KEY = "channel_mql_rate_overrides_v1"

function dateLabel(value: string | null) {
  if (!value) return "No date"
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function forecastFor(
  activity: Activity,
  override: ActivityOverride,
  liveReach: Record<string, number>,
  liveRates: Record<string, number>,
) {
  if (override.mqlFcst != null) return { value: override.mqlFcst, basis: "Manual planning case" }
  if (activity.mql != null && Number.isFinite(activity.mql)) {
    return { value: activity.mql, basis: "Asana MQL forecast" }
  }
  const reach = override.reach ?? liveReach[activity.id]
  const rate = activity.channel ? liveRates[activity.channel] : undefined
  if (reach == null) return { value: null, basis: "Planned reach required" }
  if (rate == null || !Number.isFinite(rate)) return { value: null, basis: "Approved channel rate required" }
  return { value: Math.round(reach * rate), basis: "Planned reach × shared channel assumption" }
}

function SourceState({ title, detail }: { title: string; detail: string }) {
  return (
    <div role="alert" className="max-w-3xl rounded-xl border border-brand-hot-red/50 bg-white p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Live source required</p>
      <h1 className="mt-2 text-3xl">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-brand-medium-gray">{detail} No bundled activity list, seeded reach, or saved actuals are substituted.</p>
    </div>
  )
}

export default function ActivitiesView() {
  const asana = useLiveAsana()
  const hex = useLiveHex()
  const isPoc = hex.data?.dataMode === "poc"
  const { canContribute } = useCollaboration()
  const { value: overrides, setValue: setOverrides, loading: loadingOverrides } = usePayloadValue<OverridesMap>(OVERRIDES_KEY, {})
  const { value: rateOverrides, setValue: setRateOverrides } = usePayloadValue<Record<string, number>>(RATE_OVERRIDES_KEY, {})
  const [query, setQuery] = useState("")
  const [channel, setChannel] = useState("All")
  const [region, setRegion] = useState("All")
  const [upcomingOnly, setUpcomingOnly] = useState(true)

  const activities = asana.data?.activities ?? []
  const activityReach = hex.data?.feed.activityReach ?? {}
  const providerRates = hex.data?.feed.channelMqlRates ?? {}
  const channelMqlRates = { ...providerRates, ...rateOverrides }
  const today = new Date().toISOString().slice(0, 10)

  const channels = [...new Set(activities.map((item) => item.channel).filter(Boolean) as string[])].sort()
  const regions = [...new Set(activities.map((item) => item.region).filter(Boolean) as string[])].sort()

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return activities
      .filter((item) => !item.completed)
      .filter((item) => !upcomingOnly || !item.due || item.due >= today)
      .filter((item) => channel === "All" || item.channel === channel)
      .filter((item) => region === "All" || item.region === region)
      .filter((item) => !normalized || [item.name, item.channel, item.region, item.owner].some((value) => value?.toLowerCase().includes(normalized)))
      .sort((a, b) => (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31"))
  }, [activities, channel, query, region, today, upcomingOnly])

  if (!asana.data) return <SourceState title="Activities are unavailable" detail={asana.detail ?? "The live Asana feed is not connected."} />
  if (!hex.data) return <SourceState title="Forecast inputs are unavailable" detail={hex.detail ?? "The forecast data provider is not connected."} />

  const forecastable = visible.filter((item) => forecastFor(item, overrides[item.id] ?? {}, activityReach, channelMqlRates).value != null).length
  const linked = visible.filter((item) => Boolean(item.sfdc)).length
  const totalMql = visible.reduce((sum, item) => sum + (forecastFor(item, overrides[item.id] ?? {}, activityReach, channelMqlRates).value ?? 0), 0)
  const missingInputs = visible.length - forecastable

  function setOverride(id: string, field: "reach" | "mqlFcst", raw: string) {
    const value = raw.trim() === "" ? null : Number(raw)
    setOverrides((current) => ({
      ...current,
      [id]: { ...current[id], [field]: Number.isFinite(value) ? value : null },
    }))
  }

  function setRateOverride(name: string, raw: string) {
    const percentage = Number(raw)
    setRateOverrides((current) => {
      const next = { ...current }
      if (raw.trim() === "" || !Number.isFinite(percentage)) delete next[name]
      else next[name] = Math.max(0, Math.min(1, percentage / 100))
      return next
    })
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Plan · Activities</p>
          <h1 className="mb-3 text-4xl leading-none tracking-tight sm:text-5xl">Live marketing activity plan</h1>
          <p className="max-w-3xl text-base leading-relaxed text-brand-medium-gray">Activities and any entered MQL forecast come from Asana. {isPoc ? "Reach, manual forecasts, and channel assumptions can be completed together here." : "Reach and channel rates come from the governed semantic provider."} Every planning edit is shared through Payload.</p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          <span className="rounded-md bg-brand-lime px-3 py-2">{forecastable}/{visible.length} forecastable</span>
          <span className="rounded-md bg-brand-light-gray px-3 py-2">{linked}/{visible.length} linked to Salesforce</span>
          {loadingOverrides && <span role="status" className="rounded-md border border-brand-light-gray px-3 py-2">Loading shared plan…</span>}
        </div>
      </div>

      <div className="mb-6 grid gap-px overflow-hidden rounded-xl border border-brand-black bg-brand-black sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Visible activities</p><p className="mt-3 text-3xl tabular-nums">{visible.length}</p></div>
        <div className="bg-brand-lime p-5"><p className="font-mono text-[10px] uppercase tracking-widest">Planned MQLs</p><p className="mt-3 text-3xl tabular-nums">{totalMql.toLocaleString()}</p></div>
        <div className="bg-white p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Forecastable</p><p className="mt-3 text-3xl tabular-nums">{forecastable}</p></div>
        <div className="bg-white p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Need inputs</p><p className={`mt-3 text-3xl tabular-nums ${missingInputs ? "text-brand-hot-red" : "text-brand-dark-green"}`}>{missingInputs}</p></div>
      </div>

      <div className="mb-5 grid gap-3 rounded-xl border border-brand-light-gray bg-white p-4 md:grid-cols-4">
        <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-md border border-brand-light-gray px-3" placeholder="Activity, owner, channel…" /></label>
        <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 w-full rounded-md border border-brand-light-gray bg-white px-3"><option>All</option>{channels.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">Region</span><select value={region} onChange={(event) => setRegion(event.target.value)} className="h-11 w-full rounded-md border border-brand-light-gray bg-white px-3"><option>All</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-brand-light-gray px-3 text-sm"><input type="checkbox" checked={upcomingOnly} onChange={(event) => setUpcomingOnly(event.target.checked)} />Upcoming only</label>
      </div>

      {isPoc && (
        <details className="mb-5 rounded-xl border border-brand-light-gray bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium">Shared channel assumptions <span className="ml-2 font-normal text-brand-medium-gray">Edit the starting MQL rate used when an activity has reach but no MQL forecast.</span></summary>
          <div className="grid gap-3 border-t border-brand-light-gray p-5 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((name) => (
              <label key={name} className="text-sm">
                <span className="mb-1 block truncate font-mono text-xs text-brand-medium-gray">{name}</span>
                <span className="flex items-center gap-2"><input type="number" min="0" max="100" step="0.1" disabled={!canContribute} value={channelMqlRates[name] == null ? "" : Number((channelMqlRates[name] * 100).toFixed(2))} onChange={(event) => setRateOverride(name, event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-brand-light-gray px-2 text-right font-mono disabled:bg-brand-light-gray/50" placeholder="No rate" /><span className="text-brand-medium-gray">%</span></span>
              </label>
            ))}
          </div>
          <p className="border-t border-brand-light-gray px-5 py-3 text-xs text-brand-medium-gray">These are team planning assumptions, not measured conversion rates. They are stored in Payload and can be replaced by governed Hex rates later.</p>
        </details>
      )}

      <div className="overflow-x-auto rounded-xl border border-brand-light-gray bg-white">
        <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
          <caption className="sr-only">Live marketing activities and forecast readiness</caption>
          <thead className="bg-brand-black text-white"><tr>{["Activity", "Date", "Region", "Channel", "Reach", "MQL forecast", "Forecast basis", "Actuals linkage"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-mono text-xs uppercase tracking-wider">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-brand-light-gray">
            {visible.map((activity) => {
              const override = overrides[activity.id] ?? {}
              const reach = override.reach ?? activityReach[activity.id] ?? null
              const forecast = forecastFor(activity, override, activityReach, channelMqlRates)
              return (
                <tr key={activity.id} className="align-top hover:bg-brand-light-gray/30">
                  <td className="px-4 py-4"><p className="font-medium">{activity.name}</p><p className="mt-1 text-xs text-brand-medium-gray">{activity.owner ?? "Unassigned"}</p></td>
                  <td className="whitespace-nowrap px-4 py-4">{dateLabel(activity.due)}</td>
                  <td className="px-4 py-4">{activity.region ?? "—"}</td>
                  <td className="px-4 py-4">{activity.channel ?? "—"}</td>
                  <td className="px-4 py-3"><label className="sr-only" htmlFor={`reach-${activity.id}`}>Planned reach for {activity.name}</label><input id={`reach-${activity.id}`} type="number" min="0" disabled={!canContribute} defaultValue={reach ?? ""} onBlur={(event) => setOverride(activity.id, "reach", event.target.value)} className="h-10 w-28 rounded-md border border-brand-light-gray px-2 text-right font-mono disabled:bg-brand-light-gray/50" placeholder="Required" /></td>
                  <td className="px-4 py-3"><label className="sr-only" htmlFor={`mql-${activity.id}`}>Manual MQL forecast for {activity.name}</label><input id={`mql-${activity.id}`} type="number" min="0" disabled={!canContribute} defaultValue={override.mqlFcst ?? ""} onBlur={(event) => setOverride(activity.id, "mqlFcst", event.target.value)} className="h-10 w-28 rounded-md border border-brand-light-gray px-2 text-right font-mono disabled:bg-brand-light-gray/50" placeholder={forecast.value?.toLocaleString() ?? "Required"} /></td>
                  <td className="px-4 py-4"><span className={`inline-block rounded px-2 py-1 text-xs ${forecast.value == null ? "border border-brand-hot-red/40" : "bg-brand-lime"}`}>{forecast.basis}</span>{forecast.value != null && <p className="mt-2 font-mono text-xs">Planning: {forecast.value.toLocaleString()} MQL</p>}</td>
                  <td className="px-4 py-4">{activity.sfdc ? <span className="rounded bg-brand-light-gray px-2 py-1 text-xs">Linked</span> : <><span className="rounded border border-brand-light-gray px-2 py-1 text-xs">Awaiting campaign</span><p className="mt-2 max-w-44 text-xs text-brand-medium-gray">Forecast remains available; certified activity actuals do not.</p></>}</td>
                </tr>
              )
            })}
            {visible.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-brand-medium-gray">No live activities match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-brand-medium-gray">Forecast identity is the Asana activity ID. A Salesforce Campaign is required only for certified activity-level actuals, not for forecasting. {isPoc ? "POC assumptions version" : "Live source as of"} {hex.data.feed.sourceAsOf}; Asana fetched {dateLabel(asana.data.fetchedAt.slice(0, 10))}.</p>
    </div>
  )
}
