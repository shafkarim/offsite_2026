import { useMemo, useState } from "react"

import type { Activity } from "../asana"
import { useCollaboration } from "../collaboration"
import { useLiveAsana, useLiveHex } from "../live-sources"
import { usePayloadValue } from "../payload"
import {
  ACTIVITY_OVERRIDES_KEY,
  CHANNEL_RATE_OVERRIDES_KEY,
  type ActivityOverride,
  type ActivityOverridesMap,
} from "../data/activity-planning"

type ForecastState = "ready" | "missing-channel" | "missing-reach" | "missing-rate"
type ReadinessFilter = "All" | "Ready" | "Needs input" | "Channel missing" | "Reach missing" | "Rate unavailable"

type ForecastResult = {
  value: number | null
  basis: string
  state: ForecastState
  action: string | null
}

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
  isPoc: boolean,
): ForecastResult {
  if (override.mqlFcst != null) {
    return {
      value: override.mqlFcst,
      basis: "Manual planning case",
      state: "ready",
      action: null,
    }
  }
  if (activity.mql != null && Number.isFinite(activity.mql)) {
    return {
      value: activity.mql,
      basis: "Asana MQL forecast",
      state: "ready",
      action: null,
    }
  }
  const reach = override.reach ?? liveReach[activity.id]
  const rate = activity.channel ? liveRates[activity.channel] : undefined
  if (!activity.channel) {
    return {
      value: null,
      basis: "Channel missing",
      state: "missing-channel",
      action:
        "Add a channel in Asana, or enter a manual MQL planning case here.",
    }
  }
  if (rate == null || !Number.isFinite(rate)) {
    return {
      value: null,
      basis: "Channel rate unavailable",
      state: "missing-rate",
      action:
        "Use a documented manual MQL planning case; no compatible channel rate is available.",
    }
  }
  if (reach == null || !Number.isFinite(reach)) {
    return {
      value: null,
      basis: "Reach missing",
      state: "missing-reach",
      action: "Enter planned reach, or enter a manual MQL planning case.",
    }
  }
  return {
    value: Math.round(reach * rate),
    basis: isPoc
      ? "Planned reach × team assumption"
      : "Planned reach × governed channel rate",
    state: "ready",
    action: null,
  }
}

function SourceState({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div
      role="alert"
      className="max-w-3xl rounded-xl border border-brand-hot-red/50 bg-white p-8"
    >
      <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">
        Live source required
      </p>
      <h1 className="mt-2 text-3xl">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-brand-medium-gray">
        {detail} No bundled activity list, seeded reach, or saved actuals are
        substituted.
      </p>
    </div>
  )
}

export default function ActivitiesView() {
  const asana = useLiveAsana()
  const hex = useLiveHex()
  const isPoc = hex.data?.dataMode === "poc"
  const forecastEvidenceUnavailable = !hex.data
  const { canContribute, profileName } = useCollaboration()
  const {
    value: overrides,
    setValue: setOverrides,
    loading: loadingOverrides,
    saving: savingOverrides,
    saveError: overridesError,
    lastSavedAt,
    refresh: refreshOverrides,
    retrySave: retryOverrides,
  } = usePayloadValue<ActivityOverridesMap>(ACTIVITY_OVERRIDES_KEY, {})
  const {
    value: rateOverrides,
    setValue: setRateOverrides,
    saving: savingRates,
    saveError: ratesError,
    retrySave: retryRates,
  } = usePayloadValue<Record<string, number>>(CHANNEL_RATE_OVERRIDES_KEY, {})
  const [query, setQuery] = useState("")
  const [channel, setChannel] = useState("All")
  const [region, setRegion] = useState("All")
  const [readiness, setReadiness] = useState<ReadinessFilter>("All")
  const [upcomingOnly, setUpcomingOnly] = useState(true)

  const activities = asana.data?.activities ?? []
  const activityReach = hex.data?.feed.activityReach ?? {}
  const providerRates = hex.data?.feed.channelMqlRates ?? {}
  // Local planning assumptions must never replace governed semantic rates.
  const channelMqlRates = isPoc
    ? { ...providerRates, ...rateOverrides }
    : providerRates
  const today = new Date().toISOString().slice(0, 10)

  const channels = [
    ...new Set(
      activities.map((item) => item.channel).filter(Boolean) as string[],
    ),
  ].sort()
  const regions = [
    ...new Set(
      activities.map((item) => item.region).filter(Boolean) as string[],
    ),
  ].sort()

  const filteredBeforeReadiness = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return activities
      .filter((item) => !item.completed)
      .filter((item) => !upcomingOnly || !item.due || item.due >= today)
      .filter((item) => channel === "All" || item.channel === channel)
      .filter((item) => region === "All" || item.region === region)
      .filter(
        (item) =>
          !normalized ||
          [item.name, item.channel, item.region, item.owner].some((value) =>
            value?.toLowerCase().includes(normalized),
          ),
      )
      .sort((a, b) =>
        (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31"),
      )
  }, [
    activities,
    activityReach,
    channel,
    channelMqlRates,
    isPoc,
    overrides,
    query,
    region,
    today,
    upcomingOnly,
  ])

  const visible = useMemo(
    () =>
      filteredBeforeReadiness.filter((item) => {
        if (readiness === "All") return true
        const forecast = forecastFor(
          item,
          overrides[item.id] ?? {},
          activityReach,
          channelMqlRates,
          Boolean(isPoc),
        )
        if (readiness === "Ready") return forecast.state === "ready"
        if (readiness === "Needs input") return forecast.state !== "ready"
        if (readiness === "Channel missing")
          return forecast.state === "missing-channel"
        if (readiness === "Reach missing")
          return forecast.state === "missing-reach"
        return forecast.state === "missing-rate"
      }),
    [
      activityReach,
      channelMqlRates,
      filteredBeforeReadiness,
      isPoc,
      overrides,
      readiness,
    ],
  )

  if (!asana.data)
    return (
      <SourceState
        title="Activities are unavailable"
        detail={asana.detail ?? "The live Asana feed is not connected."}
      />
    )
  const forecastable = visible.filter(
    (item) =>
      forecastFor(
        item,
        overrides[item.id] ?? {},
        activityReach,
        channelMqlRates,
        Boolean(isPoc),
      ).value != null,
  ).length
  const linked = visible.filter((item) => Boolean(item.sfdc)).length
  const totalMql = visible.reduce(
    (sum, item) =>
      sum +
      (forecastFor(
        item,
        overrides[item.id] ?? {},
        activityReach,
        channelMqlRates,
        Boolean(isPoc),
      ).value ?? 0),
    0,
  )
  const missingInputs = visible.length - forecastable
  const readinessCounts = filteredBeforeReadiness.reduce(
    (counts, item) => {
      const state = forecastFor(
        item,
        overrides[item.id] ?? {},
        activityReach,
        channelMqlRates,
        Boolean(isPoc),
      ).state
      counts[state] += 1
      return counts
    },
    {
      ready: 0,
      "missing-channel": 0,
      "missing-reach": 0,
      "missing-rate": 0,
    } satisfies Record<ForecastState, number>,
  )
  const saveError = overridesError ?? ratesError
  const saving = savingOverrides || savingRates
  const filtersActive =
    query.trim() !== "" ||
    channel !== "All" ||
    region !== "All" ||
    readiness !== "All" ||
    !upcomingOnly

  function clearFilters() {
    setQuery("")
    setChannel("All")
    setRegion("All")
    setReadiness("All")
    setUpcomingOnly(true)
  }

  function setOverride(
    id: string,
    field: "reach" | "mqlFcst" | "comment",
    raw: string,
  ) {
    const value =
      field === "comment"
        ? raw.trim() || null
        : raw.trim() === ""
          ? null
          : Number(raw)
    setOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]:
          field === "comment"
            ? value
            : typeof value === "number" && Number.isFinite(value)
              ? Math.max(0, value)
              : null,
        updatedAt: new Date().toISOString(),
        updatedBy: profileName,
      },
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
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-medium-gray">
            Plan · Activities
          </p>
          <h1 className="mb-3 text-4xl leading-none tracking-tight sm:text-5xl">
            Live marketing activity plan
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-brand-medium-gray">
            Activities and any entered MQL forecast come from Asana.{" "}
            {forecastEvidenceUnavailable
              ? "The Hex forecast provider is unavailable, so governed reach and channel-rate forecasts are paused; Asana forecasts and manual planning cases remain available."
              : isPoc
                ? "Reach, manual forecasts, and channel assumptions can be completed together here."
                : "Reach and channel rates come from the governed semantic provider."}{" "}
            Every planning edit is shared through Payload.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          <span className="rounded-md bg-brand-lime px-3 py-2">
            {forecastable}/{visible.length} forecastable
          </span>
          <span className="rounded-md bg-brand-light-gray px-3 py-2">
            {linked}/{visible.length} linked to Salesforce
          </span>
          {loadingOverrides && (
            <span
              role="status"
              className="rounded-md border border-brand-light-gray px-3 py-2"
            >
              Loading shared plan…
            </span>
          )}
          {!loadingOverrides && (
            <span
              role="status"
              aria-live="polite"
              className="rounded-md border border-brand-light-gray bg-white px-3 py-2"
            >
              {saving
                ? "Saving shared changes…"
                : lastSavedAt
                  ? `Saved ${new Date(lastSavedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                  : "Shared plan loaded"}
            </span>
          )}
        </div>
      </div>

      {forecastEvidenceUnavailable && (
        <div
          role="status"
          className="mb-5 grid gap-4 rounded-xl border border-brand-black bg-brand-lime p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-widest">
              Asana is live · Hex forecasts are paused
            </p>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed">
              Live activities are ready to plan. Until Hex reconnects, the tool
              won&apos;t calculate from reach or channel rates, but Asana MQL
              forecasts and documented manual cases still work.
            </p>
          </div>
          <a
            href="#data-health"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-black bg-white px-4 text-sm hover:bg-brand-black hover:text-white"
          >
            Check Hex status
          </a>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="mb-5 flex flex-col gap-3 rounded-xl border border-brand-maroon bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">
              This change has not been saved to the shared workspace.
            </p>
            <p className="mt-1 text-sm text-brand-medium-gray">{saveError}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => {
                void retryOverrides()
                if (ratesError) void retryRates()
              }}
              className="rounded-md bg-brand-black px-4 py-2 text-sm text-white hover:bg-brand-blue"
            >
              Try again
            </button>
            <button
              onClick={() => void refreshOverrides()}
              className="rounded-md border border-brand-black bg-white px-4 py-2 text-sm hover:bg-brand-light-gray"
            >
              Load latest
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-px overflow-hidden rounded-xl border border-brand-black bg-brand-black sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Visible activities
          </p>
          <p className="mt-3 text-3xl tabular-nums">{visible.length}</p>
        </div>
        <div className="bg-brand-lime p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest">
            Planned MQLs
          </p>
          <p className="mt-3 text-3xl tabular-nums">
            {totalMql.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Forecastable
          </p>
          <p className="mt-3 text-3xl tabular-nums">{forecastable}</p>
        </div>
        <div className="bg-white p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Need inputs
          </p>
          <p
            className={`mt-3 text-3xl tabular-nums ${
              missingInputs ? "text-brand-hot-red" : "text-brand-dark-green"
            }`}
          >
            {missingInputs}
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          {
            label: "Channel missing" as const,
            count: readinessCounts["missing-channel"],
            detail:
              "Add the activity channel in Asana, or enter a manual MQL case.",
          },
          {
            label: "Rate unavailable" as const,
            count: readinessCounts["missing-rate"],
            detail:
              "This channel has no approved rate. Use a documented manual case.",
          },
          {
            label: "Reach missing" as const,
            count: readinessCounts["missing-reach"],
            detail: "Add planned reach here, or enter a manual MQL case.",
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={readiness === item.label}
            onClick={() =>
              setReadiness(readiness === item.label ? "All" : item.label)
            }
            className={`rounded-xl border p-4 text-left transition-colors ${
              readiness === item.label
                ? "border-brand-black bg-brand-dusty-violet"
                : "border-brand-light-gray bg-white hover:border-brand-black"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm">{item.label}</span>
              <span className="font-mono text-lg tabular-nums">
                {item.count}
              </span>
            </span>
            <span className="mt-2 block text-xs leading-relaxed text-brand-medium-gray">
              {item.detail}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-brand-light-gray bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm">Find the activities that need a decision</p>
            <p
              className="mt-0.5 text-xs text-brand-medium-gray"
              aria-live="polite"
            >
              Showing {visible.length} of{" "}
              {activities.filter((item) => !item.completed).length} active
              activities
            </p>
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-brand-black bg-white px-3 py-2 text-sm hover:bg-brand-black hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">
              Search
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-brand-light-gray px-3"
              placeholder="Activity, owner, channel…"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">
              Channel
            </span>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="h-11 w-full rounded-md border border-brand-light-gray bg-white px-3"
            >
              <option>All</option>
              {channels.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">
              Region
            </span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="h-11 w-full rounded-md border border-brand-light-gray bg-white px-3"
            >
              <option>All</option>
              {regions.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-mono text-xs uppercase text-brand-medium-gray">
              Forecast status
            </span>
            <select
              value={readiness}
              onChange={(event) =>
                setReadiness(event.target.value as typeof readiness)
              }
              className="h-11 w-full rounded-md border border-brand-light-gray bg-white px-3"
            >
              <option>All</option>
              <option>Ready</option>
              <option>Needs input</option>
              <option>Channel missing</option>
              <option>Rate unavailable</option>
              <option>Reach missing</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-brand-light-gray px-3 text-sm">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(event) => setUpcomingOnly(event.target.checked)}
            />
            Upcoming only
          </label>
        </div>
      </div>

      {isPoc && (
        <details className="mb-5 rounded-xl border border-brand-light-gray bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium">
            Shared channel assumptions{" "}
            <span className="ml-2 font-normal text-brand-medium-gray">
              Edit the starting MQL rate used when an activity has reach but no
              MQL forecast.
            </span>
          </summary>
          <div className="grid gap-3 border-t border-brand-light-gray p-5 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((name) => (
              <label key={name} className="text-sm">
                <span className="mb-1 block truncate font-mono text-xs text-brand-medium-gray">
                  {name}
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={!canContribute}
                    value={
                      channelMqlRates[name] == null
                        ? ""
                        : Number((channelMqlRates[name] * 100).toFixed(2))
                    }
                    onChange={(event) =>
                      setRateOverride(name, event.target.value)
                    }
                    className="h-10 min-w-0 flex-1 rounded-md border border-brand-light-gray px-2 text-right font-mono disabled:bg-brand-light-gray/50"
                    placeholder="No rate"
                  />
                  <span className="text-brand-medium-gray">%</span>
                </span>
              </label>
            ))}
          </div>
          <p className="border-t border-brand-light-gray px-5 py-3 text-xs text-brand-medium-gray">
            These are team planning assumptions, not measured conversion rates.
            They are stored in Payload and can be replaced by governed Hex rates
            later.
          </p>
        </details>
      )}

      <div
        className="max-h-[70vh] overflow-auto rounded-xl border border-brand-light-gray bg-white"
        tabIndex={0}
      >
        <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Live marketing activities and forecast readiness
          </caption>
          <thead className="sticky top-0 z-20 bg-brand-black text-white">
            <tr>
              {[
                "Activity",
                "Date",
                "Region",
                "Channel",
                "Reach",
                "MQL forecast",
                "Forecast basis",
                "Actuals linkage",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className={`px-4 py-3 font-mono text-xs uppercase tracking-wider ${
                    label === "Activity"
                      ? "sticky left-0 z-30 bg-brand-black"
                      : ""
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-light-gray">
            {visible.map((activity) => {
              const override = overrides[activity.id] ?? {}
              const reach = override.reach ?? activityReach[activity.id] ?? null
              const forecast = forecastFor(
                activity,
                override,
                activityReach,
                channelMqlRates,
                Boolean(isPoc),
              )
              return (
                <tr
                  key={activity.id}
                  className="group align-top hover:bg-brand-light-gray/30"
                >
                  <td className="sticky left-0 z-10 max-w-80 border-r border-brand-light-gray bg-white px-4 py-4 group-hover:bg-brand-light-gray">
                    <p className="font-medium">{activity.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-medium-gray">
                      <span>{activity.owner ?? "Owner hidden"}</span>
                      {activity.permalinkUrl && (
                        <a
                          href={activity.permalinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-brand-light-gray underline-offset-2 hover:decoration-brand-black"
                        >
                          Open in Asana ↗
                        </a>
                      )}
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium">
                        {override.comment
                          ? "Planning note"
                          : "Add planning note"}
                      </summary>
                      <label
                        className="mt-2 block text-xs"
                        htmlFor={`note-${activity.id}`}
                      >
                        <span className="sr-only">
                          Planning note for {activity.name}
                        </span>
                        <textarea
                          id={`note-${activity.id}`}
                          rows={3}
                          maxLength={500}
                          disabled={!canContribute}
                          value={override.comment ?? ""}
                          onChange={(event) =>
                            setOverride(
                              activity.id,
                              "comment",
                              event.target.value,
                            )
                          }
                          className="w-full rounded-md border border-brand-light-gray p-2 text-sm disabled:bg-brand-light-gray/50"
                          placeholder="Assumption or decision rationale only—no customer details."
                        />
                      </label>
                      {override.updatedAt && (
                        <p className="mt-1 text-xs text-brand-medium-gray">
                          Last changed by {override.updatedBy ?? "a teammate"} ·{" "}
                          {new Date(override.updatedAt).toLocaleString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      )}
                    </details>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {dateLabel(activity.due)}
                  </td>
                  <td className="px-4 py-4">{activity.region ?? "—"}</td>
                  <td className="px-4 py-4">{activity.channel ?? "—"}</td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`reach-${activity.id}`}>
                      Planned reach for {activity.name}
                    </label>
                    <input
                      id={`reach-${activity.id}`}
                      type="number"
                      min="0"
                      disabled={!canContribute}
                      value={reach ?? ""}
                      onChange={(event) =>
                        setOverride(activity.id, "reach", event.target.value)
                      }
                      className="h-10 w-28 rounded-md border border-brand-light-gray px-2 text-right font-mono disabled:bg-brand-light-gray/50"
                      placeholder="Add reach"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`mql-${activity.id}`}>
                      Manual MQL forecast for {activity.name}
                    </label>
                    <input
                      id={`mql-${activity.id}`}
                      type="number"
                      min="0"
                      disabled={!canContribute}
                      value={override.mqlFcst ?? ""}
                      onChange={(event) =>
                        setOverride(activity.id, "mqlFcst", event.target.value)
                      }
                      className="h-10 w-28 rounded-md border border-brand-light-gray px-2 text-right font-mono disabled:bg-brand-light-gray/50"
                      placeholder="Optional"
                    />
                    <p className="mt-1 max-w-28 text-xs text-brand-medium-gray">
                      Overrides the calculated case.
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block rounded border px-2 py-1 text-xs ${
                        forecast.value == null
                          ? "border-brand-maroon bg-white"
                          : "border-brand-dark-green bg-brand-lime"
                      }`}
                    >
                      {forecast.value == null ? "Needs input" : "Ready"} ·{" "}
                      {forecast.basis}
                    </span>
                    {forecast.value != null ? (
                      <p className="mt-2 font-mono text-sm">
                        {forecast.value.toLocaleString()} MQL
                      </p>
                    ) : (
                      <p className="mt-2 max-w-56 text-xs leading-relaxed text-brand-medium-gray">
                        {forecast.action}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {activity.sfdc ? (
                      <span className="rounded bg-brand-light-gray px-2 py-1 text-xs">
                        Linked
                      </span>
                    ) : (
                      <>
                        <span className="rounded border border-brand-light-gray px-2 py-1 text-xs">
                          Awaiting campaign
                        </span>
                        <p className="mt-2 max-w-44 text-xs text-brand-medium-gray">
                          Forecast remains available; certified activity actuals
                          do not.
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <p className="text-base">
                    No activities match these filters.
                  </p>
                  <p className="mt-1 text-sm text-brand-medium-gray">
                    Clear the filters to return to the live activity plan.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-md border border-brand-black bg-white px-4 py-2 text-sm hover:bg-brand-black hover:text-white"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-brand-medium-gray">
        Forecast identity is the Asana activity ID. A Salesforce Campaign is
        required only for certified activity-level actuals, not for forecasting.{" "}
        {forecastEvidenceUnavailable
          ? "Hex forecast evidence unavailable;"
          : isPoc
            ? `POC assumptions version ${hex.data?.feed.sourceAsOf};`
            : `Live source as of ${hex.data?.feed.sourceAsOf};`}{" "}
        Asana fetched {dateLabel(asana.data.fetchedAt.slice(0, 10))}.
      </p>
    </div>
  )
}
