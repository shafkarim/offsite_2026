import { useMemo, useState } from "react"
import { useAsanaActivities } from "../activities"
import { useLiveHex } from "../live-sources"
import {
  activityForecastReadiness,
  forecastReadinessAction,
  hasSalesforceLink,
} from "../data/activity-readiness"
import { SUPPORT_LEADS_REVIEW_ACTION } from "../data/source-reconciliation"

type Destination = "activities" | "pacing" | "data-health"
type QueueKind = "overdue" | "inputs" | "linkage" | "review"

interface WorkItem {
  id: string
  kind: QueueKind
  title: string
  detail: string
  owner: string
  region: string
  due: string | null
  action: string
  destination: Destination
}

const KIND_META: Record<QueueKind, { label: string, style: string }> = {
  overdue: {
    label: "Overdue",
    style: "border-l-2 border-brand-hot-red bg-brand-light-gray/30",
  },
  inputs: { label: "Needs inputs", style: "bg-brand-dusty-violet" },
  linkage: { label: "Needs linkage", style: "bg-brand-light-gray" },
  review: { label: "Review", style: "bg-brand-lime" },
}

function dateLabel(value: string | null): string {
  if (!value) return "No date"
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
}

export default function WorkQueueView({
  onNavigate,
}: {
  onNavigate: (view: Destination) => void
}) {
  const [filter, setFilter] = useState<QueueKind | "all">("all")
  const { activities } = useAsanaActivities()
  const hex = useLiveHex()
  const activityReach = hex.data?.feed.activityReach ?? {}
  const channelMqlRates = hex.data?.feed.channelMqlRates ?? {}
  const evidence = { activityReach, channelMqlRates }
  const today = new Date().toISOString().slice(0, 10)

  const items = useMemo<WorkItem[]>(() => {
    const active = activities.filter(
      (activity) => !activity.completed,
    )
    const queue: WorkItem[] = [
      {
        id: "support-leads-reconciliation",
        kind: "review",
        title: "Reconcile the Support Leads source definition",
        detail: SUPPORT_LEADS_REVIEW_ACTION,
        owner: "Support Ops + Marketing Ops",
        region: "Global",
        due: null,
        action: "Review data",
        destination: "data-health",
      },
    ]

    for (const activity of active) {
      const base = {
        id: activity.id,
        title: activity.name,
        owner: activity.owner ?? "Unassigned",
        region: activity.region ?? "No region",
        due: activity.due,
      }

      if (activity.due && activity.due < today) {
        queue.push({
          ...base,
          kind: "overdue",
          detail: "Delivery date has passed but the activity is still open.",
          action: "Review status",
          destination: "activities",
        })
      } else if (!activityForecastReadiness(activity, evidence).ready) {
        queue.push({
          ...base,
          kind: "inputs",
          detail:
            forecastReadinessAction(activity, evidence) ??
            "Complete the forecast inputs.",
          action: "Complete forecast",
          destination: "activities",
        })
      }

      if (!hasSalesforceLink(activity)) {
        queue.push({
          ...base,
          id: `${activity.id}-link`,
          kind: "linkage",
          detail:
            "Forecasting can continue, but certified actuals cannot be attached yet.",
          action: "Resolve linkage",
          destination: "data-health",
        })
      }
    }

    return queue.sort((a, b) => {
      const priority: Record<QueueKind, number> = {
        review: 0,
        overdue: 1,
        inputs: 2,
        linkage: 3,
      }
      return (
        priority[a.kind] - priority[b.kind] ||
        (a.due ?? "9999").localeCompare(b.due ?? "9999")
      )
    })
  }, [activities, activityReach, channelMqlRates, today])

  const counts = useMemo(
    () => ({
      overdue: items.filter((item) => item.kind === "overdue").length,
      inputs: items.filter((item) => item.kind === "inputs").length,
      linkage: items.filter((item) => item.kind === "linkage").length,
      review: items.filter((item) => item.kind === "review").length,
    }),
    [items],
  )
  const visible =
    filter === "all" ? items : items.filter((item) => item.kind === filter)

  return (
    <div>
      <div className="mb-8 flex flex-col items-start gap-5 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-medium-gray">
            Workspace · Work queue
          </p>
          <h1 className="mb-3 text-4xl leading-none tracking-tight sm:text-5xl">
            What needs attention?
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-brand-medium-gray">
            A cross-team exception queue for missing inputs, overdue delivery,
            and measurement readiness. Named-user assignment becomes available
            when workspace authentication is enabled.
          </p>
        </div>
        <button
          onClick={() => onNavigate("activities")}
          className="shrink-0 rounded-lg bg-brand-black px-4 py-2.5 text-sm text-white hover:bg-brand-blue"
        >
          Open all activities →
        </button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-brand-black bg-brand-black lg:grid-cols-5">
        <button
          onClick={() => setFilter("all")}
          className={`p-5 text-left sm:p-6 ${
            filter === "all"
              ? "bg-brand-black text-white"
              : "bg-white hover:bg-brand-light-gray"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-55">
            Open exceptions
          </p>
          <p className="mt-4 text-4xl tracking-tight tabular-nums">
            {items.length}
          </p>
        </button>
        <button
          onClick={() => setFilter("overdue")}
          className={`p-5 text-left sm:p-6 ${
            filter === "overdue"
              ? "bg-brand-lime"
              : "bg-white hover:bg-brand-light-gray"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Overdue
          </p>
          <p className="mt-4 text-4xl tracking-tight tabular-nums">
            {counts.overdue}
          </p>
        </button>
        <button
          onClick={() => setFilter("inputs")}
          className={`p-5 text-left sm:p-6 ${
            filter === "inputs"
              ? "bg-brand-lime"
              : "bg-white hover:bg-brand-light-gray"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Need forecast inputs
          </p>
          <p className="mt-4 text-4xl tracking-tight tabular-nums">
            {counts.inputs}
          </p>
        </button>
        <button
          onClick={() => setFilter("linkage")}
          className={`p-5 text-left sm:p-6 ${
            filter === "linkage"
              ? "bg-brand-lime"
              : "bg-white hover:bg-brand-light-gray"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Need Salesforce linkage
          </p>
          <p className="mt-4 text-4xl tracking-tight tabular-nums">
            {counts.linkage}
          </p>
        </button>
        <button
          onClick={() => setFilter("review")}
          className={`col-span-2 p-5 text-left sm:p-6 lg:col-span-1 ${
            filter === "review"
              ? "bg-brand-lime"
              : "bg-white hover:bg-brand-light-gray"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
            Source reviews
          </p>
          <p className="mt-4 text-4xl tracking-tight tabular-nums">
            {counts.review}
          </p>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-light-gray bg-white">
        <div className="min-w-[740px]">
          <div className="grid grid-cols-[minmax(250px,1fr)_110px_90px_90px_120px] gap-3 border-b border-brand-light-gray bg-brand-black px-4 py-3 text-white">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
              Exception
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
              Owner
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
              Region
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
              Due
            </span>
            <span />
          </div>
          <div className="divide-y divide-brand-light-gray">
            {visible.slice(0, 30).map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(250px,1fr)_110px_90px_90px_120px] items-center gap-3 px-4 py-4 hover:bg-brand-light-gray/20"
              >
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${KIND_META[item.kind].style}`}
                    >
                      {KIND_META[item.kind].label}
                    </span>
                  </div>
                  <p className="truncate text-sm text-brand-black">
                    {item.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-brand-medium-gray">
                    {item.detail}
                  </p>
                </div>
                <p className="truncate text-xs">{item.owner}</p>
                <p className="truncate text-xs text-brand-medium-gray">
                  {item.region}
                </p>
                <p className="font-mono text-xs">{dateLabel(item.due)}</p>
                <button
                  onClick={() => onNavigate(item.destination)}
                  className="border border-brand-black px-3 py-2 text-xs hover:bg-brand-black hover:text-white"
                >
                  {item.action}
                </button>
              </div>
            ))}
            {visible.length === 0 && (
              <div className="px-6 py-14 text-center">
                <p className="text-lg">No exceptions in this view.</p>
                <p className="mt-1 text-sm text-brand-medium-gray">
                  Choose another queue or return to all exceptions.
                </p>
              </div>
            )}
          </div>
          {visible.length > 30 && (
            <div className="border-t border-brand-light-gray px-5 py-3 text-xs text-brand-medium-gray">
              Showing the 30 highest-priority items of {visible.length}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
