import { useState, useMemo, useRef } from "react"
import {
  runHexForecast,
  getActivityName,
  FORECAST_DISCLAIMER,
  type CampaignProfile,
  type AnyForecastResult,
  type ForecastResult,
  type FunnelQuantiles,
} from "@/data/hex-forecast-model"
import { useLiveAsana, useLiveHex, type LiveHexFeed } from "@/live-sources"

type LiveMetrics = {
  totalMqlTarget: number
  mqlDelivered: number
  mqlYearEndProjection: number
  mqlGap: number
  saoDelivered: number
  saoTarget: number
  daysRemaining: number
  sourceAsOf: string
}

type LiveInboundForecast = {
  ytdMqlActual: number
  ytdSaoActual: number
  mqlLow: number | null
  mqlPlanning: number | null
  mqlHigh: number | null
  saoLow: number | null
  saoPlanning: number | null
  saoHigh: number | null
  sourceAsOf: string
  historicalPeriods: Array<{
    period: string
    mqlActual: number
    saoActual: number
    mqlToSaoRate: number
    isMature: boolean
  }>
  warnings: string[]
}

const CHANNELS = [
  { value: "Webinar", label: "Webinar", hasRegionalData: true },
  { value: "IRL Event", label: "IRL Event", hasRegionalData: true },
  { value: "Content Syndication", label: "Content Syndication", hasRegionalData: false },
  { value: "Paid Social", label: "Paid Social", hasRegionalData: false },
  { value: "Email", label: "Email", hasRegionalData: false },
  { value: "Paid Search", label: "Paid Search", hasRegionalData: false },
]

const REGIONS = ["AMER", "EMEA", "APJ"]

const PRESETS = [
  { label: "Webinar · AMER · 500", channel: "Webinar", region: "AMER", reach: 500 },
  { label: "Webinar · EMEA · 300", channel: "Webinar", region: "EMEA", reach: 300 },
  { label: "IRL Event · AMER · 200", channel: "IRL Event", region: "AMER", reach: 200 },
  { label: "IRL Event · EMEA · 150", channel: "IRL Event", region: "EMEA", reach: 150 },
  { label: "Content Syndication · 2K", channel: "Content Syndication", region: "", reach: 2000 },
]

function fmtN(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1000)}K`
  return Math.round(n).toString()
}
function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

function ActualsBanner({ metrics }: { metrics: LiveMetrics }) {
  const elapsed = ((metrics.mqlDelivered / metrics.totalMqlTarget) * 100).toFixed(1)
  return (
    <div className="border border-brand-black bg-white px-6 py-4 mb-6 flex flex-wrap gap-x-10 gap-y-2">
      <div>
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
          Global FY26 MQL target
        </p>
        <p className="font-mono text-sm text-brand-black tabular-nums">
          {metrics.totalMqlTarget.toLocaleString()} MQLs
        </p>
      </div>
      <div>
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
          YTD delivered
        </p>
        <p className="font-mono text-sm text-brand-lime tabular-nums">
          {metrics.mqlDelivered.toLocaleString()} ({elapsed}%)
        </p>
      </div>
      <div>
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
          Year-end projection
        </p>
        <p className="font-mono text-sm text-brand-black tabular-nums">
          {metrics.mqlYearEndProjection.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
          Remaining gap
        </p>
        <p className="font-mono text-sm text-brand-hot-red tabular-nums">
          {metrics.mqlGap.toLocaleString()} MQLs
        </p>
      </div>
      <div className="border-l border-brand-light-gray pl-10">
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
          SAO: YTD vs target
        </p>
        <p className="font-mono text-sm">
          <span className="text-brand-black">{metrics.saoDelivered.toLocaleString()} YTD of {metrics.saoTarget.toLocaleString()} target · {((metrics.saoDelivered / metrics.saoTarget) * 100).toFixed(1)}% delivered</span>
        </p>
        <p className="font-mono text-[10px] text-brand-medium-gray">{metrics.daysRemaining} days remaining in FY26 · live as of {metrics.sourceAsOf}</p>
      </div>
    </div>
  )
}

function RangeBar({
  q,
  max,
  usd,
  highlight,
}: {
  q: FunnelQuantiles
  max: number
  usd?: boolean
  highlight?: boolean
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100))
  const left = pct(q.low)
  const right = pct(q.high)
  const mid = pct(q.planning)
  const fmt = usd ? fmtUsd : fmtN

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-1 h-5">
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-px bg-brand-light-gray" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-2 ${highlight ? "bg-brand-black/25" : "bg-brand-black/15"}`}
          style={{ left: `${left}%`, right: `${100 - right}%` }}
        />
        <div
          className={`absolute top-0 bottom-0 w-0.5 ${highlight ? "bg-brand-black" : "bg-brand-black/50"}`}
          style={{ left: `${mid}%` }}
        />
        <div
          className="absolute top-1.5 bottom-1.5 w-px bg-brand-black/30"
          style={{ left: `${left}%` }}
        />
        <div
          className="absolute top-1.5 bottom-1.5 w-px bg-brand-black/30"
          style={{ left: `${right}%` }}
        />
      </div>
      <div
        className={`w-14 text-right font-mono text-sm tabular-nums shrink-0 ${highlight ? "text-brand-black" : "text-brand-black/70"}`}
      >
        {fmt(q.planning)}
      </div>
      <div className="w-28 text-right font-mono text-[10px] text-brand-medium-gray tabular-nums shrink-0 hidden sm:block">
        {fmt(q.low)} – {fmt(q.high)}
      </div>
    </div>
  )
}

function FunnelWaterfall({ result }: { result: ForecastResult }) {
  const mqlMax = result.mqls.high * 1.25
  const cwMax = result.cw_usd.high * 1.25

  const peopleRows: { label: string; sub?: boolean; q: FunnelQuantiles; highlight?: boolean }[] = [
    { label: "MQLs", q: result.mqls, highlight: true },
    { label: "Net-new MQLs", q: result.mqls_net_new, sub: true },
    { label: "Upgrade MQLs", q: result.mqls_upgrade, sub: true },
    { label: "SAOs", q: result.saos },
    { label: "Opportunities", q: result.opps },
  ]

  return (
    <div>
      <div className="flex items-center gap-5 pb-3 border-b border-brand-black">
        <div className="w-40 shrink-0" />
        <div className="flex-1 text-center font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray">
          Low ──── Planning ──── High
        </div>
        <div className="w-14 text-right font-mono text-[9px] tracking-widest uppercase text-brand-black shrink-0">
          Planning
        </div>
        <div className="w-28 text-right font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray shrink-0 hidden sm:block">
          Range
        </div>
      </div>
      <div className="mt-1 space-y-0.5">
        {peopleRows.map(({ label, sub, q, highlight }, i) => (
          <div
            key={i}
            className={`flex items-center gap-5 py-2.5 ${
              label === "SAOs" ? "border-t border-brand-light-gray pt-4 mt-2" : ""
            }`}
          >
            <div
              className={`w-40 shrink-0 font-mono text-xs truncate ${
                sub ? "pl-5 text-brand-medium-gray" : highlight ? "text-brand-black" : "text-brand-black/80"
              }`}
            >
              {sub ? `↳ ${label}` : label}
            </div>
            <RangeBar q={q} max={mqlMax} highlight={!!highlight} />
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-brand-black">
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-3">
          Revenue impact
        </p>
        <div className="space-y-0.5">
          <div className="flex items-center gap-5 py-2.5">
            <div className="w-40 shrink-0 font-mono text-xs text-brand-black/80">Closed-won</div>
            <RangeBar q={result.cw_usd} max={cwMax} usd />
          </div>
          <div className="flex items-center gap-5 py-1">
            <div className="w-40 shrink-0 font-mono text-[10px] text-brand-medium-gray">Pipeline</div>
            <p className="font-mono text-[10px] text-brand-medium-gray italic">
              Unavailable — {result.pipelineUnavailableReason}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface PlanItem {
  id: number
  label: string
  channel: string
  region: string
  reach: number
  result: ForecastResult
}

function PlanSummary({ plan, onRemove, metrics }: { plan: PlanItem[]; onRemove: (id: number) => void; metrics: LiveMetrics }) {
  const totalMqls = plan.reduce((s, p) => s + p.result.mqls.planning, 0)
  const totalCwUsd = plan.reduce((s, p) => s + p.result.cw_usd.planning, 0)
  const projectedWithPlan = metrics.mqlYearEndProjection + totalMqls
  const gapRemaining = Math.max(0, metrics.totalMqlTarget - projectedWithPlan)
  const planGapCoverage = totalMqls > 0 ? (totalMqls / metrics.mqlGap) * 100 : 0
  const deliveredPct = (metrics.mqlDelivered / metrics.totalMqlTarget) * 100
  const projPct = (metrics.mqlYearEndProjection / metrics.totalMqlTarget) * 100
  const planPct = Math.min((totalMqls / metrics.totalMqlTarget) * 100, 100 - projPct)

  return (
    <div className="border border-brand-black bg-white mt-10">
      <div className="px-6 py-4 border-b border-brand-black flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Plan accumulator
          </p>
          <p className="font-mono text-sm text-brand-black tabular-nums">
            {plan.length} activit{plan.length === 1 ? "y" : "ies"} · +{fmtN(totalMqls)} MQL Planning
          </p>
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Covers gap
          </p>
          <p className="font-mono text-sm tabular-nums text-brand-dark-green">
            {fmtPct(planGapCoverage)} of {metrics.mqlGap.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Gap remaining
          </p>
          <p className={`font-mono text-sm tabular-nums ${gapRemaining > 0 ? "text-brand-hot-red" : "text-brand-dark-green"}`}>
            {gapRemaining > 0 ? gapRemaining.toLocaleString() : "Closed"} MQLs
          </p>
        </div>
        <div className="ml-auto">
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Pipeline (plan)
          </p>
          <p className="font-mono text-sm tabular-nums text-brand-black">${fmtUsd(totalCwUsd)} CW Planning</p>
        </div>
      </div>
      <div className="px-6 pt-3 pb-1">
        <div className="relative h-2.5 bg-brand-light-gray overflow-hidden mb-1.5">
          <div className="absolute inset-y-0 left-0 bg-brand-lime" style={{ width: `${deliveredPct}%` }} />
          <div
            className="absolute inset-y-0 bg-brand-black/20"
            style={{ left: `${deliveredPct}%`, width: `${projPct - deliveredPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-brand-dark-green/50"
            style={{ left: `${projPct}%`, width: `${planPct}%` }}
          />
        </div>
        <p className="font-mono text-[10px] text-brand-medium-gray mb-3">
          <span className="inline-block w-2.5 h-2 bg-brand-lime mr-1.5 align-middle" />delivered ·{" "}
          <span className="inline-block w-2.5 h-2 bg-brand-black/20 mr-1.5 align-middle" />current projection ·{" "}
          <span className="inline-block w-2.5 h-2 bg-brand-dark-green/50 mr-1.5 align-middle" />this plan
        </p>
      </div>
      <div className="divide-y divide-brand-light-gray">
        {plan.map(item => (
          <div key={item.id} className="flex items-center gap-4 px-6 py-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-brand-black truncate">{item.label}</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">
                reach {item.reach.toLocaleString()} · {fmtN(item.result.mqls.planning)} MQL Planning · ${fmtUsd(item.result.cw_usd.planning)} CW
              </p>
            </div>
            <p className="font-mono text-[10px] text-brand-dark-green tabular-nums shrink-0">
              +{fmtPct((item.result.mqls.planning / metrics.mqlGap) * 100)} gap
            </p>
            <button
              onClick={() => onRemove(item.id)}
              className="font-mono text-[10px] text-brand-medium-gray hover:text-brand-hot-red transition-colors shrink-0"
            >
              remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function InboundSection({ feed, metrics }: { feed: LiveHexFeed; metrics: LiveMetrics }) {
  const forecast = feed.inboundForecast as unknown as LiveInboundForecast | null | undefined

  if (!forecast) {
    return (
      <div className="mb-10 border border-brand-maroon bg-white px-6 py-5">
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-maroon mb-2">§ 01 · Always-on inbound</p>
        <p className="font-mono text-sm text-brand-black">Live Orgs Web Form forecast is not present in the approved Hex feed.</p>
        <p className="font-mono text-[10px] text-brand-medium-gray mt-1">No bundled model or stale snapshot has been substituted.</p>
      </div>
    )
  }

  const mqlGapContrib = forecast.mqlPlanning !== null ? (forecast.mqlPlanning / metrics.mqlGap) * 100 : null

  return (
    <div className="mb-10">
      {/* Section heading */}
      <div className="flex items-center gap-4 mb-4">
        <span className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray">§ 01 · Always-on inbound</span>
        <div className="flex-1 h-px bg-brand-light-gray" />
      </div>

      <div className="border border-brand-black bg-white">
        {/* Header row */}
        <div className="px-6 py-4 border-b border-brand-black flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">Channel</p>
            <p className="font-mono text-sm text-brand-black">Orgs Web Form · Run-rate model</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] tracking-widest uppercase px-2 py-1 border border-brand-maroon/30 text-brand-maroon bg-brand-maroon/5">
              Experimental
            </span>
            <span className="font-mono text-[9px] text-brand-medium-gray">as of {forecast.sourceAsOf}</span>
          </div>
        </div>

        {/* YTD actuals + gap contribution */}
        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-6 border-b border-brand-light-gray">
          <div>
            <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">YTD MQLs</p>
            <p className="font-mono text-sm text-brand-black tabular-nums">{forecast.ytdMqlActual.toLocaleString()}</p>
            <p className="font-mono text-[9px] text-brand-medium-gray/60">certified actuals</p>
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">YTD SAOs</p>
            <p className="font-mono text-sm text-brand-black tabular-nums">{forecast.ytdSaoActual.toLocaleString()}</p>
            <p className="font-mono text-[9px] text-brand-medium-gray/60">certified actuals</p>
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">Remaining MQLs · Planning</p>
            <p className="font-mono text-sm text-brand-black tabular-nums">
              {forecast.mqlPlanning !== null ? `+${forecast.mqlPlanning.toLocaleString()}` : "—"}
            </p>
            <p className="font-mono text-[9px] text-brand-medium-gray/60">remaining Q3 + Q4 run-rate</p>
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">Covers remaining gap</p>
            <p className={`font-mono text-sm tabular-nums ${mqlGapContrib !== null && mqlGapContrib >= 50 ? "text-brand-dark-green" : "text-brand-black"}`}>
              {mqlGapContrib !== null ? `${Math.round(mqlGapContrib)}% of ${metrics.mqlGap.toLocaleString()}` : "—"}
            </p>
            <p className="font-mono text-[9px] text-brand-medium-gray/60">MQL gap coverage</p>
          </div>
        </div>

        {/* Low / Planning / High MQL scenarios */}
        <div className="px-6 py-4 border-b border-brand-light-gray">
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-3">
            Remaining-period MQL scenarios
          </p>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "Low (−15%)", mql: forecast.mqlLow, sao: forecast.saoLow },
              { label: "Planning", mql: forecast.mqlPlanning, sao: forecast.saoPlanning },
              { label: "High (+20%)", mql: forecast.mqlHigh, sao: forecast.saoHigh },
            ].map(({ label, mql, sao }) => (
              <div key={label} className={`${label === "Planning" ? "border-l-2 border-brand-black pl-3" : ""}`}>
                <p className={`font-mono text-[9px] tracking-widest uppercase mb-1 ${label === "Planning" ? "text-brand-black" : "text-brand-medium-gray"}`}>
                  {label}
                </p>
                <p className={`font-mono text-lg tabular-nums ${label === "Planning" ? "text-brand-black" : "text-brand-medium-gray"}`}>
                  {mql !== null ? `+${mql.toLocaleString()}` : "—"}
                </p>
                <p className="font-mono text-[9px] text-brand-medium-gray/60">MQL · {sao !== null ? sao.toLocaleString() : "—"} SAO</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quarterly conversion history */}
        <div className="px-6 py-4 border-b border-brand-light-gray">
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-3">
            Quarterly conversion history
          </p>
          <div className="grid grid-cols-3 gap-4">
            {forecast.historicalPeriods.map(p => {
              const qLabel = p.period.startsWith("2026-01") ? "Q1 FY26"
                : p.period.startsWith("2026-04") ? "Q2 FY26"
                : "Q3 FY26 (partial)"
              return (
                <div key={p.period} className={`${!p.isMature ? "opacity-70" : ""}`}>
                  <p className="font-mono text-[9px] text-brand-medium-gray mb-0.5">
                    {qLabel}{!p.isMature ? " · immature" : " · mature"}
                  </p>
                  <p className="font-mono text-[11px] text-brand-black tabular-nums">
                    {p.mqlActual.toLocaleString()} MQL
                  </p>
                  <p className="font-mono text-[11px] text-brand-black tabular-nums">
                    {p.saoActual.toLocaleString()} SAO · {(p.mqlToSaoRate * 100).toFixed(1)}% conv.
                  </p>
                  {!p.isMature && (
                    <p className="font-mono text-[9px] text-brand-maroon mt-0.5">excluded from run-rate model</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Warnings */}
        <div className="px-6 py-3 space-y-1">
          {forecast.warnings.map((w, i) => (
            <p key={i} className="font-mono text-[10px] text-brand-medium-gray">
              <span className="text-brand-maroon mr-1.5">↳</span>{w}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EngineView() {
  const asana = useLiveAsana()
  const hex = useLiveHex()
  const [channel, setChannel] = useState("")
  const [region, setRegion] = useState("")
  const [reach, setReach] = useState(500)
  const [showComparables, setShowComparables] = useState(false)
  const [activePreset, setActivePreset] = useState<number | null>(null)
  const [plan, setPlan] = useState<PlanItem[]>([])
  const nextId = useRef(0)
  const activities = asana.data?.activities ?? []
  const pacing = hex.data?.feed.pacing
  const metrics: LiveMetrics | null = pacing
    ? {
        totalMqlTarget: pacing.fy.mql.target,
        mqlDelivered: pacing.fy.mql.ytdActual,
        mqlYearEndProjection: pacing.fy.mql.fullYearForecast,
        mqlGap: Math.max(0, pacing.fy.mql.target - pacing.fy.mql.fullYearForecast),
        saoDelivered: pacing.fy.sao.ytdActual,
        saoTarget: pacing.fy.sao.target,
        daysRemaining: Math.max(
          0,
          Math.round((new Date("2026-12-31").getTime() - new Date(pacing.asOf).getTime()) / 86_400_000),
        ),
        sourceAsOf: pacing.asOf,
      }
    : null

  const result = useMemo<AnyForecastResult | null>(() => {
    if (!channel) return null
    const profile: CampaignProfile = {
      channel,
      region: region || undefined,
      plannedReach: reach,
    }
    try {
      return runHexForecast(profile, activities, hex.data?.feed.activityReach ?? {})
    } catch {
      return null
    }
  }, [channel, region, reach, activities, hex.data?.feed.activityReach])

  const isAvailable = result !== null && !("unavailable" in result)
  const availableResult = isAvailable ? (result as ForecastResult) : null

  const gapCoverage = availableResult && metrics ? (availableResult.mqls.planning / metrics.mqlGap) * 100 : null
  const activitiesNeeded = availableResult && availableResult.mqls.planning > 0
    ? Math.ceil((metrics?.mqlGap ?? 0) / availableResult.mqls.planning)
    : null

  const selectedChannelObj = CHANNELS.find(c => c.value === channel)

  if (!asana.data || !hex.data || !metrics) {
    return (
      <div role="alert" className="border border-brand-hot-red bg-white p-8 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-hot-red mb-3">Live sources required</p>
        <h1 className="text-4xl tracking-tight mb-3">Forecast engine is unavailable</h1>
        <p className="text-brand-medium-gray text-sm leading-relaxed">
          The engine requires both live Asana activities and the Hex semantic-approved feed. It will not run on bundled snapshots.
        </p>
        <p className="font-mono text-xs text-brand-medium-gray mt-4">{asana.detail ?? hex.detail}</p>
      </div>
    )
  }

  function applyPreset(i: number) {
    const p = PRESETS[i]
    setChannel(p.channel)
    setRegion(p.region)
    setReach(p.reach)
    setActivePreset(i)
    setShowComparables(false)
  }

  function handleChannelChange(v: string) {
    setChannel(v)
    setActivePreset(null)
    setShowComparables(false)
  }

  function addToPlan() {
    if (!availableResult || !channel) return
    const label = [channel, region || "Global", `reach ${reach.toLocaleString()}`].join(" · ")
    setPlan(prev => [...prev, { id: nextId.current++, label, channel, region, reach, result: availableResult }])
  }

  function removeFromPlan(id: number) {
    setPlan(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">
          02 · Engine
        </p>
        <h1 className="text-5xl tracking-tight mb-3">Forecast engine</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          Hierarchical model anchored to certified actuals. Evaluate activities against the real gap,
          then compose a plan to see cumulative impact.
        </p>
      </div>

      {/* Actuals banner */}
      <ActualsBanner metrics={metrics} />

      {/* Provenance strip */}
      <div className="flex items-center gap-6 mb-10 flex-wrap">
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Historical pool
          </p>
          <p className="font-mono text-sm text-brand-black">63 campaigns</p>
        </div>
        <div className="w-px h-7 bg-brand-light-gray" />
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Date range
          </p>
          <p className="font-mono text-sm text-brand-black">Jul 2025 – Aug 2026</p>
        </div>
        <div className="w-px h-7 bg-brand-light-gray" />
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Channel historicals
          </p>
          <p className="font-mono text-sm text-brand-black">Webinar · IRL Event</p>
        </div>
        <div className="w-px h-7 bg-brand-light-gray" />
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            All other channels
          </p>
          <p className="font-mono text-sm text-brand-medium-gray">Global pooled prior</p>
        </div>
        <div className="w-px h-7 bg-brand-light-gray" />
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
            Remaining gap
          </p>
          <p className="font-mono text-sm text-brand-hot-red tabular-nums">
            {metrics.mqlGap.toLocaleString()} MQLs
          </p>
        </div>
      </div>

      {/* Always-on inbound section */}
      <InboundSection feed={hex.data.feed} metrics={metrics} />

      {/* Campaign forecaster section heading */}
      <div className="flex items-center gap-4 mb-6">
        <span className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray">§ 02 · Campaign activity forecaster</span>
        <div className="flex-1 h-px bg-brand-light-gray" />
        <span className="font-mono text-[9px] text-brand-medium-gray/60">Evaluate individual activities against the remaining MQL gap</span>
      </div>

      {/* Presets */}
      <div className="mb-6">
        <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-3">
          Quick start
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={`font-mono text-[10px] tracking-wide px-3 py-1.5 border transition-colors ${
                activePreset === i
                  ? "border-brand-black bg-brand-black text-white"
                  : "border-brand-black/30 text-brand-medium-gray hover:border-brand-black hover:text-brand-black"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input strip */}
      <div className="max-w-3xl mb-1.5">
        <div className="flex border border-brand-black bg-white divide-x divide-brand-black">
          <div className="px-5 py-4 flex-1 min-w-0">
            <label className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray block mb-2">
              Channel
            </label>
            <select
              value={channel}
              onChange={e => handleChannelChange(e.target.value)}
              className="w-full text-sm bg-transparent outline-none cursor-pointer text-brand-black"
            >
              <option value="">Select…</option>
              <optgroup label="Channel-specific historicals">
                {CHANNELS.filter(c => c.hasRegionalData).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </optgroup>
              <optgroup label="Global pooled prior">
                {CHANNELS.filter(c => !c.hasRegionalData).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="px-5 py-4 flex-1 min-w-0">
            <label className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray block mb-2">
              Region
            </label>
            <select
              value={region}
              onChange={e => { setRegion(e.target.value); setActivePreset(null) }}
              className="w-full text-sm bg-transparent outline-none cursor-pointer text-brand-black"
            >
              <option value="">All regions</option>
              {REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="px-5 py-4 flex-[2] min-w-0">
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray">
                Planned reach
              </label>
              <span className="font-mono text-sm tabular-nums text-brand-black">
                {reach.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={reach}
              onChange={e => { setReach(Number(e.target.value)); setActivePreset(null) }}
              className="w-full accent-brand-black cursor-pointer"
            />
          </div>
        </div>
        {selectedChannelObj && (
          <p className="font-mono text-[10px] text-brand-medium-gray mt-1.5">
            {selectedChannelObj.hasRegionalData
              ? `${selectedChannelObj.label} has channel-specific historicals. Adding a region narrows the estimate further.`
              : `${selectedChannelObj.label} uses the global pooled prior — all 63 campaigns aggregated. No channel-specific historicals available.`}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="max-w-3xl mt-8">
        {result ? (
          <>
            {"unavailable" in result ? (
              <div className="border border-brand-black bg-white px-8 py-8 mb-4">
                <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-2">
                  Forecast unavailable
                </p>
                <p className="font-mono text-sm text-brand-black">{result.reason}</p>
                <p className="font-mono text-[10px] text-brand-medium-gray mt-3">
                  Try a different channel or region combination to find comparable activities.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-stretch border border-brand-black bg-white mb-0 flex-wrap">
                  <div className="px-6 py-4 border-r border-brand-black">
                    <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
                      Prior type
                    </p>
                    <p className="font-mono text-[11px] text-brand-black">
                      {selectedChannelObj?.hasRegionalData && region ? "Channel + region" : selectedChannelObj?.hasRegionalData ? "Channel" : "Global pooled"}
                    </p>
                  </div>
                  <div className="px-6 py-4 border-r border-brand-black">
                    <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
                      Comparables
                    </p>
                    <p className="font-mono text-[11px] text-brand-black">n = {availableResult!.nComparables}</p>
                  </div>
                  {gapCoverage !== null && (
                    <div className="px-6 py-4 border-r border-brand-black">
                      <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
                        Covers gap
                      </p>
                      <p className="font-mono text-[11px] text-brand-dark-green tabular-nums">
                        {fmtPct(gapCoverage)} of {metrics.mqlGap.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {activitiesNeeded !== null && (
                    <div className="px-6 py-4 border-r border-brand-black">
                      <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-0.5">
                        Needed to close
                      </p>
                      <p className="font-mono text-[11px] text-brand-black tabular-nums">
                        {activitiesNeeded}× this type
                      </p>
                    </div>
                  )}
                  <div className="px-6 py-4 ml-auto flex items-center">
                    <button
                      onClick={addToPlan}
                      className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 border border-brand-black bg-brand-black text-white hover:bg-white hover:text-brand-black transition-colors"
                    >
                      + Add to plan
                    </button>
                  </div>
                </div>
                <div className="bg-white border border-brand-black border-t-0 px-8 py-8 mb-4">
                  <FunnelWaterfall result={availableResult!} />
                </div>
                {availableResult!.warnings.length > 0 && (
                  <div className="border border-brand-medium-gray/20 bg-white px-6 py-4 mb-4 space-y-1.5">
                    <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-2">
                      Model notes
                    </p>
                    {availableResult!.warnings.map((w, i) => (
                      <p key={i} className="font-mono text-[11px] text-brand-medium-gray leading-relaxed">
                        <span className="text-brand-maroon mr-1.5">↳</span>
                        {w}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowComparables(v => !v)}
                  className="font-mono text-[10px] tracking-widest uppercase text-brand-medium-gray hover:text-brand-black transition-colors flex items-center gap-2"
                >
                  <span className={`text-brand-maroon transition-transform inline-block ${showComparables ? "rotate-90" : ""}`}>
                    ›
                  </span>
                  {availableResult!.comparableIds.length} comparable campaign{availableResult!.comparableIds.length !== 1 ? "s" : ""} used
                </button>
                {showComparables && (
                  <div className="mt-3 border border-brand-light-gray bg-white px-5 py-4 space-y-1.5">
                    {availableResult!.comparableIds.map(id => (
                      <div key={id} className="flex items-baseline gap-3">
                        <span className="font-mono text-[9px] text-brand-medium-gray/40 shrink-0 tabular-nums w-36">
                          {id}
                        </span>
                        <span className="font-mono text-[10px] text-brand-medium-gray truncate">
                          {getActivityName(id, activities)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="bg-white border border-brand-black px-8 py-10">
            <p className="text-brand-medium-gray text-[15px] mb-6">
              Select a channel above — or pick a quick-start scenario — to run the forecast against the{" "}
              <span className="font-mono text-brand-hot-red">{metrics.mqlGap.toLocaleString()} MQL gap</span>.
              Add results to the plan accumulator below to see cumulative impact.
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-2">
                  How the prior works
                </p>
                <p className="font-mono text-[11px] text-brand-medium-gray leading-relaxed">
                  Channel + region uses the narrowest comparables · Channel pools all regions · Global pools all 63 campaigns
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-2">
                  What Low / Planning / High mean
                </p>
                <p className="font-mono text-[11px] text-brand-medium-gray leading-relaxed">
                  Low / Planning / High planning scenarios at the 20th, 50th, and 80th percentile of historical comparables
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] tracking-widest uppercase text-brand-medium-gray mb-2">
                  Reach sensitivity
                </p>
                <p className="font-mono text-[11px] text-brand-medium-gray leading-relaxed">
                  MQL rate is drawn from comparables. Drag the reach slider to scale output linearly.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {plan.length > 0 && <div className="max-w-3xl"><PlanSummary plan={plan} onRemove={removeFromPlan} metrics={metrics} /></div>}

      <p className="font-mono text-[10px] text-brand-medium-gray/50 mt-8 max-w-3xl">
        {metrics.daysRemaining} days remaining in FY26 · Stage ratios: MQL→SAO 1.7% · SAO→Opp 65% · Opp→CW 22% · avg ACV $48K
      </p>
    </div>
  )
}
