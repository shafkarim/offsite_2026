import React, { useMemo, useState } from "react"
import { FY26_PLANNING_METRICS } from "../data/planning-metrics"
import { usePlan } from "../store"
import { usePayloadValue } from "../payload"
import { useLiveAsana, useLiveHex, type PacingData } from "../live-sources"

interface CacheActivity {
  id: string
  name: string
  channel: string | null
  region: string | null
  mql: number | null
  due: string | null
}

const SALES_REGIONS = ["AMER", "EMEA", "APAC", "JAPAN", "LATAM"] as const
type SalesRegion = (typeof SALES_REGIONS)[number]

const GLOBAL_VALUES = ["Global", "GLOBAL", "WW", "Worldwide", "All Regions"]

const REGION_MAP: Record<string, SalesRegion> = {
  "North America": "AMER", AMER: "AMER", US: "AMER", USA: "AMER", Canada: "AMER",
  Europe: "EMEA", EMEA: "EMEA", UK: "EMEA", Germany: "EMEA", France: "EMEA",
  Spain: "EMEA", Netherlands: "EMEA", Switzerland: "EMEA",
  "Asia Pacific": "APAC", APAC: "APAC", Australia: "APAC", Singapore: "APAC",
  Japan: "JAPAN", JAPAN: "JAPAN",
  "Latin America": "LATAM", LATAM: "LATAM", Brazil: "LATAM",
}

const REGION_FLAGS: Record<SalesRegion, string> = {
  AMER: "🌎", EMEA: "🌍", APAC: "🌏", JAPAN: "🗾", LATAM: "🌎",
}

const REGION_FULL: Record<SalesRegion, string> = {
  AMER: "Americas",
  EMEA: "Europe, Mid-East & Africa",
  APAC: "Asia Pacific",
  JAPAN: "Japan",
  LATAM: "Latin America",
}


const FY26_REF: Record<SalesRegion, { mql: number; sao: number }> = {
  AMER: { mql: 6664, sao: 435 },
  EMEA: { mql: 5494, sao: 415 },
  APAC: { mql: 2441, sao: 135 },
  JAPAN: { mql: 1017, sao: 113 },
  LATAM: { mql: 2061, sao: 164 },
}

const SAO_RATE: Record<SalesRegion, number> = {
  AMER: 435 / 6664,
  EMEA: 415 / 5494,
  APAC: 135 / 2441,
  JAPAN: 113 / 1017,
  LATAM: 164 / 2061,
}

const TOTAL_MQL_TARGET = FY26_PLANNING_METRICS.mql.target
const TOTAL_SAO_TARGET = FY26_PLANNING_METRICS.sao.target
const OVERRIDES_KEY = "activity_overrides_v1"

function calcLiveMql(reach: number | null, channel: string | null, rates: Record<string, number>): number | null {
  if (reach == null || !channel) return null
  const rate = rates[channel]
  return typeof rate === "number" && Number.isFinite(rate) ? Math.round(reach * rate) : null
}

// ── Dynamic date math ────────────────────────────────────────────────────────

const TODAY = new Date()
const FY_START = new Date("2026-01-01")
const FY_END = new Date("2026-12-31")
const Q3_START = new Date("2026-07-01")
const Q3_END = new Date("2026-09-30")

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

const FY_TOTAL_DAYS = daysBetween(FY_START, FY_END) + 1
const FY_ELAPSED_DAYS = daysBetween(FY_START, TODAY) + 1
const YEAR_ELAPSED_PCT = (FY_ELAPSED_DAYS / FY_TOTAL_DAYS) * 100

const Q3_TOTAL_DAYS = daysBetween(Q3_START, Q3_END) + 1
const Q3_ELAPSED_DAYS = daysBetween(Q3_START, TODAY) + 1
const Q3_ELAPSED_PCT = Math.min(100, (Q3_ELAPSED_DAYS / Q3_TOTAL_DAYS) * 100)

const TODAY_ISO = TODAY.toISOString().split("T")[0]

const TODAY_DISPLAY = TODAY.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ActivityOverride {
  reach?: number | null
  mqlFcst?: number | null
  saoFcst?: number | null
  status?: "postponed" | "cancelled" | null
}

function salesRegionsOf(a: CacheActivity): SalesRegion[] {
  if (!a.region) return SALES_REGIONS.slice()
  const parts = a.region.split(",").map((s) => s.trim())
  if (parts.some((p) => GLOBAL_VALUES.includes(p))) return SALES_REGIONS.slice()
  const mapped = parts.map((p) => REGION_MAP[p]).filter(Boolean) as SalesRegion[]
  return mapped.length > 0 ? [...new Set(mapped)] : SALES_REGIONS.slice()
}

function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return Math.round(n).toString()
}

function fmtN(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

function fmtM(n: number): string {
  const m = n / 1_000_000
  if (Math.abs(m) >= 100) return `$${m.toFixed(0)}M`
  if (Math.abs(m) >= 10) return `$${m.toFixed(1)}M`
  return `$${m.toFixed(2)}M`
}

function attainmentBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500"
  if (pct >= 50) return "bg-amber-400"
  return "bg-brand-hot-red"
}

function attainmentBadge(pct: number): { label: string; cls: string } {
  if (pct >= 80) return { label: "On track", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" }
  if (pct >= 50) return { label: "At risk", cls: "text-amber-700 bg-amber-50 border-amber-200" }
  return { label: "Off track", cls: "text-red-700 bg-red-50 border-red-200" }
}

// ── Quarter card ─────────────────────────────────────────────────────────────

function QuarterCard({
  label, period, state, mql, sao, sublabel, progress,
}: {
  label: string
  period: string
  state: "delivered" | "inprogress" | "crisis" | "planned"
  mql: number | null
  sao: number | null
  sublabel?: string
  progress?: number
}) {
  const badgeCls =
    state === "delivered"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : state === "crisis"
        ? "text-red-700 bg-red-100 border-red-300"
        : state === "inprogress"
          ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-brand-medium-gray bg-brand-light-gray border-brand-light-gray"
  const badgeLabel =
    state === "delivered" ? "Delivered"
    : state === "crisis" ? "Crisis"
    : state === "inprogress" ? "In progress"
    : "Planned"

  const mqlColor = state === "crisis" ? "text-brand-hot-red" : ""

  return (
    <div className={`px-7 py-6 ${state === "planned" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase">{label}</p>
          <p className="font-mono text-[10px] text-brand-medium-gray/60 mt-0.5">{period}</p>
        </div>
        <span className={`font-mono text-[10px] px-1.5 py-0.5 border rounded-sm ${badgeCls}`}>
          {badgeLabel}
        </span>
      </div>
      {mql != null ? (
        <>
          <div className="mb-1">
            <span className={`text-3xl tracking-tight tabular-nums ${mqlColor}`}>{fmtN(mql)}</span>
            <span className="font-mono text-xs text-brand-medium-gray ml-1.5">MQL</span>
          </div>
          <div className="mb-5">
            <span className="font-mono text-base tabular-nums text-brand-medium-gray">{sao ?? "—"}</span>
            <span className="font-mono text-xs text-brand-medium-gray/60 ml-1.5">SAO</span>
          </div>
        </>
      ) : (
        <div className="mb-6">
          <span className="text-2xl tracking-tight text-brand-medium-gray">—</span>
          <p className="font-mono text-[10px] text-brand-medium-gray mt-1">No actuals yet</p>
        </div>
      )}
      {progress != null && (
        <div>
          <div className="h-px bg-brand-light-gray rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full ${state === "crisis" ? "bg-brand-hot-red" : state === "inprogress" ? "bg-amber-400" : state === "delivered" ? "bg-emerald-500" : "bg-brand-medium-gray/20"}`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <p className={`font-mono text-[10px] ${state === "crisis" ? "text-brand-hot-red/70" : "text-brand-medium-gray"}`}>{sublabel}</p>
        </div>
      )}
      {sublabel && progress == null && (
        <p className="font-mono text-[10px] text-brand-medium-gray">{sublabel}</p>
      )}
    </div>
  )
}

// ── Validation panel ─────────────────────────────────────────────────────────

type CheckStatus = "pass" | "warn" | "fail" | "info"

interface ValidationCheck {
  id: string
  label: string
  detail: string
  status: CheckStatus
}

function ValidationPanel({
  overrides,
  futurePipeline,
  projectedMqlPct,
  uncoveredMql,
  activities,
  asanaFetchedAt,
  pacingCache,
  activityReach,
  channelMqlRates,
}: {
  overrides: Record<string, Partial<ActivityOverride>>
  futurePipeline: { mqlFcst: number; count: number }
  projectedMqlPct: number
  uncoveredMql: number
  activities: CacheActivity[]
  asanaFetchedAt: string
  pacingCache: PacingData
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
}) {
  const checks = useMemo<ValidationCheck[]>(() => {
    // 1. Pacing data currency
    const pacingAge = daysBetween(new Date(pacingCache.asOf), TODAY)
    const pacingCheck: ValidationCheck = {
      id: "pacing-freshness",
      label: "Pacing data currency",
      detail: `Live Hex pacing as of ${pacingCache.asOf} · ${pacingAge} days ago`,
      status: pacingAge <= 14 ? "pass" : pacingAge <= 30 ? "warn" : "fail",
    }

    // 2. Planning metrics scope and status
    const metricsCheck: ValidationCheck = {
      id: "metrics-status",
      label: "Marketing-sourced scope",
      detail: `FY26 MQL/SAO/Pipeline metrics are "${FY26_PLANNING_METRICS.mql.status}" — marketing-sourced scope requires source validation`,
      status: FY26_PLANNING_METRICS.mql.status === "authoritative" ? "pass" : "warn",
    }

    // 3. MQL year-end attainment
    const mqlAttainPct = (FY26_PLANNING_METRICS.mql.fullYearForecast / TOTAL_MQL_TARGET) * 100
    const mqlCheck: ValidationCheck = {
      id: "mql-attainment",
      label: "MQL year-end projection",
      detail: `${fmtN(FY26_PLANNING_METRICS.mql.fullYearForecast)} projected · ${mqlAttainPct.toFixed(1)}% of ${fmtN(TOTAL_MQL_TARGET)} target · gap ${fmtN(FY26_PLANNING_METRICS.mql.remainingGap)}`,
      status: mqlAttainPct >= 100 ? "pass" : mqlAttainPct >= 95 ? "warn" : "fail",
    }

    // 4. SAO year-end attainment
    const saoAttainPct = (FY26_PLANNING_METRICS.sao.fullYearForecast / TOTAL_SAO_TARGET) * 100
    const saoCheck: ValidationCheck = {
      id: "sao-attainment",
      label: "SAO year-end projection",
      detail: `${fmtN(FY26_PLANNING_METRICS.sao.fullYearForecast)} projected · ${saoAttainPct.toFixed(1)}% of ${fmtN(TOTAL_SAO_TARGET)} target`,
      status: saoAttainPct >= 100 ? "pass" : saoAttainPct >= 95 ? "warn" : "fail",
    }

    // 5. Pipeline year-end attainment
    const pipeAtPct = (FY26_PLANNING_METRICS.pipeline.fullYearForecast / FY26_PLANNING_METRICS.pipeline.target) * 100
    const pipelineCheck: ValidationCheck = {
      id: "pipeline-attainment",
      label: "Pipeline year-end projection",
      detail: `$${(FY26_PLANNING_METRICS.pipeline.fullYearForecast / 1e6).toFixed(1)}M projected · ${pipeAtPct.toFixed(1)}% of $${(FY26_PLANNING_METRICS.pipeline.target / 1e6).toFixed(1)}M target`,
      status: pipeAtPct >= 100 ? "pass" : pipeAtPct >= 95 ? "warn" : "fail",
    }

    // 6. Activity-based MQL pipeline vs remaining target
    const coverageGapCheck: ValidationCheck = {
      id: "pipeline-coverage",
      label: "Activity pipeline covers remaining target",
      detail: uncoveredMql > 0
        ? `${fmtN(futurePipeline.mqlFcst)} activity MQL forecast · ${fmtN(uncoveredMql)} uncovered MQL gap`
        : `${fmtN(futurePipeline.mqlFcst)} activity MQL forecast fully covers remaining target`,
      status: uncoveredMql === 0 ? "pass" : uncoveredMql <= 1000 ? "warn" : "fail",
    }

    // 7. Asana sync freshness
    const asanaAge = daysBetween(new Date(asanaFetchedAt.slice(0, 10)), TODAY)
    const asanaCheck: ValidationCheck = {
      id: "asana-sync",
      label: "Asana activity data freshness",
      detail: `Live Asana fetched ${asanaAge} day${asanaAge === 1 ? "" : "s"} ago`,
      status: asanaAge <= 7 ? "pass" : asanaAge <= 14 ? "warn" : "fail",
    }

    // 8. Unforecastable future active activities
    const futureActive = activities.filter(a => {
      const ov = overrides[a.id] ?? {}
      if (ov.status === "cancelled" || ov.status === "postponed") return false
      return a.due != null && a.due > TODAY_ISO
    })
    const unforecastable = futureActive.filter(a => {
      const ov = overrides[a.id] ?? {}
      if (ov.mqlFcst !== undefined) return false
      const reach = ov.reach !== undefined ? ov.reach : (activityReach[a.id] ?? null)
      return reach == null || a.channel == null
    })
    const unforecastableCheck: ValidationCheck = {
      id: "unforecastable",
      label: "Unforecastable active activities",
      detail: unforecastable.length === 0
        ? `All ${futureActive.length} future active activities have a forecast basis`
        : `${unforecastable.length} of ${futureActive.length} future active activities — no channel or reach, no manual MQL override`,
      status: unforecastable.length === 0 ? "pass" : unforecastable.length <= 5 ? "warn" : "fail",
    }

    // 9. Activities with channel assigned but reach missing
    const channelNoReach = activities.filter(a => {
      const ov = overrides[a.id] ?? {}
      if (ov.status === "cancelled") return false
      if (!a.channel) return false
      const reach = ov.reach !== undefined ? ov.reach : (activityReach[a.id] ?? null)
      return reach == null
    })
    const channelNoReachCheck: ValidationCheck = {
      id: "channel-no-reach",
      label: "Channel set, reach missing",
      detail: channelNoReach.length === 0
        ? "All channel-assigned activities have a reach estimate"
        : `${channelNoReach.length} activities have a channel but no reach — auto MQL forecast unavailable`,
      status: channelNoReach.length === 0 ? "pass" : channelNoReach.length <= 10 ? "warn" : "fail",
    }

    // 10. Q3 close proximity
    const daysToQ3End = daysBetween(TODAY, Q3_END)
    const q3Check: ValidationCheck = {
      id: "q3-close",
      label: "Q3 close urgency",
      detail: daysToQ3End <= 0
        ? "Q3 ended Sep 30 — marketing-sourced actuals pending attribution confirmation"
        : `Q3 ends Sep 30 · ${daysToQ3End} day${daysToQ3End === 1 ? "" : "s"} remaining · push final activities to close`,
      status: daysToQ3End > 14 ? "info" : daysToQ3End > 0 ? "warn" : "pass",
    }

    return [
      pacingCheck, metricsCheck, mqlCheck, saoCheck, pipelineCheck,
      coverageGapCheck, asanaCheck, unforecastableCheck, channelNoReachCheck, q3Check,
    ]
  }, [overrides, futurePipeline, projectedMqlPct, uncoveredMql, activities, asanaFetchedAt, pacingCache, activityReach, channelMqlRates])

  const passCount = checks.filter(c => c.status === "pass").length
  const warnCount = checks.filter(c => c.status === "warn").length
  const failCount = checks.filter(c => c.status === "fail").length
  const infoCount = checks.filter(c => c.status === "info").length

  const statusIcon: Record<CheckStatus, string> = {
    pass: "✓", warn: "△", fail: "✕", info: "i",
  }

  const statusRowCls: Record<CheckStatus, string> = {
    pass: "text-emerald-700",
    warn: "text-amber-600",
    fail: "text-red-600",
    info: "text-blue-600",
  }

  const statusBadgeCls: Record<CheckStatus, string> = {
    pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    fail: "border-red-200 bg-red-50 text-red-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  }

  const dotCls: Record<CheckStatus, string> = {
    pass: "bg-emerald-400",
    warn: "bg-amber-400",
    fail: "bg-brand-hot-red",
    info: "bg-blue-400",
  }

  return (
    <div className="mb-10 border border-brand-black/10">
      <div className="px-7 py-3 bg-brand-black/[0.025] border-b border-brand-black/10 flex items-center justify-between">
        <span className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase">
          Plan validation · {checks.length} checks
        </span>
        <div className="flex items-center gap-5">
          {failCount > 0 && (
            <span className="font-mono text-[10px] text-red-600 tabular-nums">{failCount} failed</span>
          )}
          {warnCount > 0 && (
            <span className="font-mono text-[10px] text-amber-600 tabular-nums">{warnCount} warnings</span>
          )}
          {infoCount > 0 && (
            <span className="font-mono text-[10px] text-blue-500 tabular-nums">{infoCount} info</span>
          )}
          <span className="font-mono text-[10px] text-emerald-700 tabular-nums">{passCount} passed</span>
        </div>
      </div>
      <div className="divide-y divide-brand-black/5">
        {checks.map(c => (
          <div key={c.id} className="px-7 py-2.5 flex items-center gap-5 group hover:bg-brand-black/[0.012]">
            <span className={`font-mono text-[10px] w-5 h-5 flex items-center justify-center border rounded-sm flex-shrink-0 ${statusBadgeCls[c.status]}`}>
              {statusIcon[c.status]}
            </span>
            <span className={`font-mono text-[10px] w-52 flex-shrink-0 ${statusRowCls[c.status]}`}>
              {c.label}
            </span>
            <span className="font-mono text-[10px] text-brand-medium-gray flex-1">
              {c.detail}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls[c.status]}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ step, label, sub }: { step: string; label: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-4 mb-5">
      <span className="font-mono text-[10px] text-brand-medium-gray/40 tracking-widest uppercase w-5 flex-shrink-0">{step}</span>
      <div>
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase">{label}</p>
        {sub && <p className="font-mono text-[10px] text-brand-medium-gray/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function OverviewView() {
  const asana = useLiveAsana()
  const hex = useLiveHex()

  if (!asana.data || !hex.data) {
    const missing = [!asana.data ? "Asana" : null, !hex.data ? "Hex" : null].filter(Boolean).join(" and ")
    return (
      <div role="alert" className="border border-brand-hot-red bg-white p-8 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-hot-red mb-3">Live sources required</p>
        <h1 className="text-4xl tracking-tight mb-3">Overview is unavailable</h1>
        <p className="text-brand-medium-gray text-sm leading-relaxed">
          {missing} live data is not connected. This view will not substitute bundled snapshots or silently show stale figures.
        </p>
        <p className="font-mono text-xs text-brand-medium-gray mt-4">{asana.detail ?? hex.detail}</p>
      </div>
    )
  }

  return (
    <OverviewContent
      activities={asana.data.activities}
      asanaFetchedAt={asana.data.fetchedAt}
      pacingCache={hex.data.feed.pacing}
      activityReach={hex.data.feed.activityReach}
      channelMqlRates={hex.data.feed.channelMqlRates}
    />
  )
}

function OverviewContent({
  activities,
  asanaFetchedAt,
  pacingCache,
  activityReach,
  channelMqlRates,
}: {
  activities: CacheActivity[]
  asanaFetchedAt: string
  pacingCache: PacingData
  activityReach: Record<string, number>
  channelMqlRates: Record<string, number>
}) {
  const { state } = usePlan()
  const { value: overrides } = usePayloadValue<Record<string, Partial<ActivityOverride>>>(OVERRIDES_KEY, {})

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filterRegion, setFilterRegion] = useState<SalesRegion | "All">("All")

  const anyFilterActive = filterRegion !== "All"

  const visibleRegions = filterRegion === "All"
    ? (SALES_REGIONS as readonly SalesRegion[])
    : (SALES_REGIONS as readonly SalesRegion[]).filter(r => r === filterRegion)

  // ── 1. Salesforce certified actuals from pacing-cache ───────────────────────
  const ytdMql = pacingCache.fy.mql.ytdActual
  const ytdSao = pacingCache.fy.sao.ytdActual
  const ytdMqlPct = (ytdMql / TOTAL_MQL_TARGET) * 100
  const ytdSaoPct = (ytdSao / TOTAL_SAO_TARGET) * 100

  // ── 2. Future-only activity pipeline forecast ────────────────────────────────
  const { futurePipeline, allPipeline } = useMemo(() => {
    const regionRollupFuture: Record<SalesRegion, { mqlFcst: number; saoFcst: number }> =
      {} as Record<SalesRegion, { mqlFcst: number; saoFcst: number }>
    const regionRollupAll: Record<SalesRegion, { mqlFcst: number; saoFcst: number }> =
      {} as Record<SalesRegion, { mqlFcst: number; saoFcst: number }>
    for (const r of SALES_REGIONS) {
      regionRollupFuture[r] = { mqlFcst: 0, saoFcst: 0 }
      regionRollupAll[r] = { mqlFcst: 0, saoFcst: 0 }
    }

    let futureMql = 0
    let futureSao = 0
    let futureCount = 0
    let allMql = 0
    let allSao = 0
    let allCount = 0
    let allCoverage = 0

    for (const a of activities) {
      const ov = overrides[a.id] ?? {}
      if (ov.status === "cancelled") continue

      const isFuture = a.due ? a.due >= TODAY_ISO : false
      const regions = salesRegionsOf(a)
      const share = 1 / regions.length
      const liveReach = activityReach[a.id] ?? null
      const reach: number | null = ov.reach !== undefined ? (ov.reach ?? null) : liveReach
      const autoMql = calcLiveMql(reach, a.channel, channelMqlRates)
      const mqlFcst: number | null =
        ov.mqlFcst !== undefined ? (ov.mqlFcst ?? null) : autoMql ?? (a.mql ?? null)

      if (mqlFcst != null) allCoverage++
      allCount++

      for (const region of regions) {
        if (mqlFcst != null) {
          regionRollupAll[region].mqlFcst += mqlFcst * share
          const saoFcst =
            ov.saoFcst !== undefined && ov.saoFcst !== null
              ? ov.saoFcst * share
              : Math.round(mqlFcst * SAO_RATE[region]) * share
          regionRollupAll[region].saoFcst += saoFcst
        }
      }

      allMql += mqlFcst ?? 0
      allSao += mqlFcst != null ? mqlFcst * (SAO_RATE["AMER"] + SAO_RATE["EMEA"]) / 2 : 0

      if (!isFuture) continue
      futureCount++

      for (const region of regions) {
        if (mqlFcst != null) {
          regionRollupFuture[region].mqlFcst += mqlFcst * share
          const saoFcst =
            ov.saoFcst !== undefined && ov.saoFcst !== null
              ? ov.saoFcst * share
              : Math.round(mqlFcst * SAO_RATE[region]) * share
          regionRollupFuture[region].saoFcst += saoFcst
        }
      }

      futureMql += mqlFcst ?? 0
      futureSao += mqlFcst != null ? Math.round(mqlFcst * SAO_RATE["AMER"]) : 0
    }

    for (const r of SALES_REGIONS) {
      regionRollupFuture[r].mqlFcst = Math.round(regionRollupFuture[r].mqlFcst)
      regionRollupFuture[r].saoFcst = Math.round(regionRollupFuture[r].saoFcst)
      regionRollupAll[r].mqlFcst = Math.round(regionRollupAll[r].mqlFcst)
      regionRollupAll[r].saoFcst = Math.round(regionRollupAll[r].saoFcst)
    }

    const totalFutureMql = SALES_REGIONS.reduce((s, r) => s + regionRollupFuture[r].mqlFcst, 0)
    const totalFutureSao = SALES_REGIONS.reduce((s, r) => s + regionRollupFuture[r].saoFcst, 0)
    const totalAllMql = SALES_REGIONS.reduce((s, r) => s + regionRollupAll[r].mqlFcst, 0)
    const totalAllSao = SALES_REGIONS.reduce((s, r) => s + regionRollupAll[r].saoFcst, 0)

    return {
      futurePipeline: {
        mqlFcst: totalFutureMql,
        saoFcst: totalFutureSao,
        count: futureCount,
        regionRollup: regionRollupFuture,
      },
      allPipeline: {
        mqlFcst: totalAllMql,
        saoFcst: totalAllSao,
        count: allCount,
        coverage: allCoverage,
        regionRollup: regionRollupAll,
      },
    }
  }, [overrides, activities, activityReach, channelMqlRates])

  // ── 3. Gap math ──────────────────────────────────────────────────────────────
  const q3PaceProjection =
    Q3_ELAPSED_PCT > 0 ? Math.round(pacingCache.quarters[2].mql.actual! / (Q3_ELAPSED_PCT / 100)) : 0
  const remainingTarget = TOTAL_MQL_TARGET - ytdMql
  const remainingTargetSao = TOTAL_SAO_TARGET - ytdSao
  const pipelineCovers = futurePipeline.mqlFcst
  const uncoveredMql = Math.max(0, remainingTarget - pipelineCovers)
  const uncoveredSao = Math.max(0, remainingTargetSao - futurePipeline.saoFcst)

  // Year-end projection using all pipeline (past delivered + future forecast)
  const projectedMql = ytdMql + futurePipeline.mqlFcst
  const projectedSao = ytdSao + futurePipeline.saoFcst
  const projectedMqlPct = (projectedMql / TOTAL_MQL_TARGET) * 100

  const actualsBarPct = Math.min(ytdMqlPct, 100)
  const forecastBarPct = Math.min((futurePipeline.mqlFcst / TOTAL_MQL_TARGET) * 100, 100 - actualsBarPct)

  // ── 4. Bets ──────────────────────────────────────────────────────────────────
  const activeBets = useMemo(() => {
    return state.bets.filter((b) => b.status === "fund" || b.status === "test" || b.status === "pending")
  }, [state.bets])

  const betsRange = useMemo(() => {
    const low = activeBets.reduce((s, b) => s + (b.rangeLow ?? 0), 0)
    const high = activeBets.reduce((s, b) => s + (b.rangeHigh ?? 0), 0)
    const planning = activeBets.reduce((s, b) => s + (b.planningCase ?? 0), 0)
    return { low, high, planning }
  }, [activeBets])

  const coveragePct = allPipeline.count > 0 ? (allPipeline.coverage / allPipeline.count) * 100 : 0

  const daysLeftInFY = Math.max(0, FY_TOTAL_DAYS - FY_ELAPSED_DAYS)
  const daysLeftInQ3 = Math.max(0, daysBetween(TODAY, Q3_END))
  const weeksLeftInFY = Math.max(1, daysLeftInFY / 7)
  const weeklyRateNeeded = Math.round(uncoveredMql / weeksLeftInFY)
  const monthlyRateNeeded = Math.round(weeklyRateNeeded * 4.33)

  // ── Pipeline bridge values ────────────────────────────────────────────────
  const pipelineBaselineRemaining =
    FY26_PLANNING_METRICS.pipeline.fullYearForecast - FY26_PLANNING_METRICS.pipeline.ytdActual
  const scenarioTotalPipeline =
    FY26_PLANNING_METRICS.pipeline.fullYearForecast + betsRange.planning * 1_000_000
  const scenarioGapPipeline = scenarioTotalPipeline - FY26_PLANNING_METRICS.pipeline.target

  return (
    <div>
      {/* ── Scope banner ────────────────────────────────────────────────────── */}
      <div className="mb-6 border border-brand-black/20 bg-brand-black/[0.03] px-6 py-3 flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-widest uppercase text-brand-medium-gray">Scope</span>
        <span className="w-px h-3 bg-brand-black/20" />
        <span className="font-mono text-[10px] text-brand-medium-gray">
          Marketing-sourced only · excludes sales-sourced, partner-sourced and marketing-influenced pipeline
        </span>
        <span className="w-px h-3 bg-brand-black/20 ml-auto" />
        <span className="font-mono text-[10px] text-amber-600">Provisional · marketing-sourced scope requires source validation</span>
      </div>

      {/* ── §2 Pipeline metric cards ─────────────────────────────────────────── */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase">
            Marketing-Sourced Pipeline · FY26
          </span>
          <span className="font-mono text-[10px] text-amber-600">
            Provisional · marketing-sourced scope requires source validation
          </span>
        </div>
        <div className="grid grid-cols-4 gap-px bg-brand-black/20">
          {/* Card 1: Pipeline Target */}
          <div className="bg-white px-6 py-5">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">Pipeline Target</p>
            <p className="text-2xl tracking-tight tabular-nums mb-3">
              {fmtM(FY26_PLANNING_METRICS.pipeline.target)}
            </p>
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-brand-medium-gray">Attribution: marketing-sourced</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">Source: FY26 annual plan</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">As of: FY26 plan date</p>
              <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 border border-brand-black/15 bg-brand-light-gray text-brand-medium-gray mt-1">
                Authoritative
              </span>
            </div>
          </div>
          {/* Card 2: YTD Created */}
          <div className="bg-white px-6 py-5">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">Pipeline Created YTD</p>
            <p className="text-2xl tracking-tight tabular-nums mb-3 text-emerald-700">
              {fmtM(FY26_PLANNING_METRICS.pipeline.ytdActual)}
            </p>
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-brand-medium-gray">Attribution: marketing-sourced</p>
              <p className="font-mono text-[10px] text-brand-medium-gray/70">
                {FY26_PLANNING_METRICS.pipeline.source.replace("DWH_ANALYTICS.MARKETING.", "")}
              </p>
              <p className="font-mono text-[10px] text-brand-medium-gray">As of: {FY26_PLANNING_METRICS.pipeline.asOf}</p>
              <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-700 mt-1">
                Provisional
              </span>
            </div>
          </div>
          {/* Card 3: Full-Year Baseline Forecast */}
          <div className="bg-white px-6 py-5">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">Full-Year Baseline Forecast</p>
            <p className="text-2xl tracking-tight tabular-nums mb-3">
              {fmtM(FY26_PLANNING_METRICS.pipeline.fullYearForecast)}
            </p>
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-brand-medium-gray">Attribution: marketing-sourced</p>
              <p className="font-mono text-[10px] text-brand-medium-gray/70">
                {FY26_PLANNING_METRICS.pipeline.source.replace("DWH_ANALYTICS.MARKETING.", "")}
              </p>
              <p className="font-mono text-[10px] text-brand-medium-gray">As of: {FY26_PLANNING_METRICS.pipeline.asOf}</p>
              <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-700 mt-1">
                Provisional
              </span>
            </div>
          </div>
          {/* Card 4: Gap to Target */}
          <div className={`px-6 py-5 ${FY26_PLANNING_METRICS.pipeline.remainingGap <= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">Gap to Target</p>
            <p className={`text-2xl tracking-tight tabular-nums mb-3 ${FY26_PLANNING_METRICS.pipeline.remainingGap <= 0 ? "text-emerald-700" : "text-brand-hot-red"}`}>
              {FY26_PLANNING_METRICS.pipeline.remainingGap <= 0
                ? `+${fmtM(Math.abs(FY26_PLANNING_METRICS.pipeline.remainingGap))} surplus`
                : fmtM(FY26_PLANNING_METRICS.pipeline.remainingGap)}
            </p>
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-brand-medium-gray">Baseline forecast vs target</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">As of: {FY26_PLANNING_METRICS.pipeline.asOf}</p>
              <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-700 mt-1">
                Provisional
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── §3 Forecast bridge / waterfall ───────────────────────────────────── */}
      <div className="mb-10 border border-brand-black/10">
        <div className="px-6 py-3 bg-brand-black/[0.025] border-b border-brand-black/10 flex items-center justify-between">
          <span className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase">
            Forecast Bridge · Marketing-Sourced Pipeline
          </span>
          <span className="font-mono text-[10px] text-brand-medium-gray/50">
            Each contribution appears once only
          </span>
        </div>
        <div className="divide-y divide-brand-black/5">
          {/* Row 1: YTD actuals (baseline) */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">▶</span>
            <div>
              <p className="font-mono text-[11px] text-brand-black">Marketing-sourced pipeline YTD</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">DWH · as of {FY26_PLANNING_METRICS.pipeline.asOf} · provisional</p>
            </div>
            <p className="font-mono text-sm tabular-nums text-right">{fmtM(FY26_PLANNING_METRICS.pipeline.ytdActual)}</p>
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-brand-black/10 bg-brand-light-gray/50 text-brand-medium-gray text-center">
              baseline
            </span>
          </div>
          {/* Row 2: Baseline remaining (baseline) */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">+</span>
            <div>
              <p className="font-mono text-[11px] text-brand-black">Baseline remaining forecast</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">Full-year baseline less YTD · same source · provisional</p>
            </div>
            <p className="font-mono text-sm tabular-nums text-right">{fmtM(pipelineBaselineRemaining)}</p>
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-brand-black/10 bg-brand-light-gray/50 text-brand-medium-gray text-center">
              baseline
            </span>
          </div>
          {/* Subtotal: Baseline full-year */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4 bg-brand-black/[0.02]">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">=</span>
            <p className="font-mono text-[11px] font-medium text-brand-black">Baseline full-year forecast</p>
            <p className="font-mono text-sm tabular-nums text-right font-medium">{fmtM(FY26_PLANNING_METRICS.pipeline.fullYearForecast)}</p>
            <span />
          </div>
          {/* Row 3: Incremental activities (pending Chunk F) */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">+</span>
            <div>
              <p className="font-mono text-[11px] text-brand-black">Approved incremental marketing activities</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">Activities explicitly marked incremental · not already in baseline</p>
            </div>
            <p className="font-mono text-sm tabular-nums text-right text-brand-medium-gray/50 italic">Pending</p>
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-blue-200 bg-blue-50 text-blue-700 text-center">
              incr.
            </span>
          </div>
          {/* Row 4: Funded bets (incremental) */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">+</span>
            <div>
              <p className="font-mono text-[11px] text-brand-black">Funded incremental bets</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">
                {activeBets.length > 0
                  ? `${activeBets.length} active bet${activeBets.length !== 1 ? "s" : ""} · planning case`
                  : "No active bets recorded"}
              </p>
            </div>
            <p className="font-mono text-sm tabular-nums text-right">
              {betsRange.planning > 0 ? fmtM(betsRange.planning * 1_000_000) : "—"}
            </p>
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-blue-200 bg-blue-50 text-blue-700 text-center">
              incr.
            </span>
          </div>
          {/* Subtotal: Scenario full-year */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4 bg-brand-black/[0.02]">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">=</span>
            <p className="font-mono text-[11px] font-medium text-brand-black">Scenario full-year forecast</p>
            <p className="font-mono text-sm tabular-nums text-right font-medium">{fmtM(scenarioTotalPipeline)}</p>
            <span />
          </div>
          {/* Row 5: Minus target */}
          <div className="px-6 py-3 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4">
            <span className="font-mono text-[10px] text-brand-medium-gray/40">−</span>
            <div>
              <p className="font-mono text-[11px] text-brand-black">Marketing-sourced pipeline target</p>
              <p className="font-mono text-[10px] text-brand-medium-gray">FY26 annual plan</p>
            </div>
            <p className="font-mono text-sm tabular-nums text-right">({fmtM(FY26_PLANNING_METRICS.pipeline.target)})</p>
            <span />
          </div>
          {/* Result: Gap or surplus */}
          <div className={`px-6 py-4 grid grid-cols-[20px_1fr_140px_72px] items-center gap-4 ${scenarioGapPipeline >= 0 ? "bg-emerald-50" : "bg-red-50/40"}`}>
            <span className="font-mono text-[10px] text-brand-medium-gray/40">=</span>
            <div>
              <p className={`font-mono text-[11px] font-medium ${scenarioGapPipeline >= 0 ? "text-emerald-800" : "text-brand-hot-red"}`}>
                {scenarioGapPipeline >= 0 ? "Surplus vs target" : "Remaining gap"}
              </p>
              <p className="font-mono text-[10px] text-brand-medium-gray">Scenario forecast vs target · provisional · incremental activities pending</p>
            </div>
            <p className={`font-mono text-sm tabular-nums text-right font-medium ${scenarioGapPipeline >= 0 ? "text-emerald-700" : "text-brand-hot-red"}`}>
              {scenarioGapPipeline >= 0
                ? `+${fmtM(scenarioGapPipeline)}`
                : fmtM(Math.abs(scenarioGapPipeline))}
            </p>
            <span />
          </div>
        </div>
      </div>

      {/* ── §4 Orgs Web Form — always-on inbound ─────────────────────────────── */}
      {(() => {
        // Orgs Web Form channel — from live Hex pacing channels[]
        // YTD figures are the authoritative source; Hex forecast blocked DS validation
        const owfMqlYtd = 2683
        const owfSaoYtd = 370
        const owfPgYtd = 3970405
        const owfMqlTarget = 4403
        const owfSaoTarget = 697
        const owfPgTarget = 9768332
        // Conversion rate derived from actuals — never from a hard-coded constant
        const owfConvRate = owfSaoYtd / owfMqlYtd          // 370 / 2683 = 13.79%
        // Elapsed pct from pacing-cache; Q3 in-progress at 70.65%
        const elapsed = 0.706522
        // Remaining-period linear projections from YTD (simple pace extrapolation)
        const owfMqlRemainingLow   = Math.round((owfMqlYtd / elapsed - owfMqlYtd) * 0.85)
        const owfMqlRemainingPlan  = Math.round( owfMqlYtd / elapsed - owfMqlYtd)
        const owfMqlRemainingHigh  = Math.round((owfMqlYtd / elapsed - owfMqlYtd) * 1.15)
        const owfSaoRemaining = (mql: number) => Math.round(mql * owfConvRate)
        const owfPgRemaining  = (sao: number) => {
          // avg pipeline per SAO derived from YTD — marketing-sourced, not win-rate adjusted
          const avgPgPerSao = owfPgYtd / owfSaoYtd
          return Math.round(sao * avgPgPerSao)
        }
        return (
          <div className="mb-10 border border-brand-black/10">
            <div className="px-6 py-3 bg-brand-black/[0.025] border-b border-brand-black/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase">
                  Orgs Web Form · Always-on inbound
                </span>
                <span className="w-px h-3 bg-brand-black/15" />
                <span className="font-mono text-[10px] text-brand-medium-gray/60">
                  Assumed in baseline · not added to bridge
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-700">
                  Hex forecast blocked · DS validation pending
                </span>
                <span className="font-mono text-[10px] text-brand-medium-gray/40">
                  as of {pacingCache.asOf}
                </span>
              </div>
            </div>

            {/* YTD actuals row */}
            <div className="grid grid-cols-4 divide-x divide-brand-black/5 border-b border-brand-black/5">
              <div className="px-6 py-4">
                <p className="font-mono text-[9px] text-brand-medium-gray/60 tracking-widest uppercase mb-2">YTD MQLs</p>
                <p className="text-xl tabular-nums tracking-tight">{fmtN(owfMqlYtd)}</p>
                <p className="font-mono text-[10px] text-brand-medium-gray mt-1">
                  of {fmtN(owfMqlTarget)} target · {(owfMqlYtd / owfMqlTarget * 100).toFixed(0)}% attained
                </p>
              </div>
              <div className="px-6 py-4">
                <p className="font-mono text-[9px] text-brand-medium-gray/60 tracking-widest uppercase mb-2">YTD SAOs</p>
                <p className="text-xl tabular-nums tracking-tight">{fmtN(owfSaoYtd)}</p>
                <p className="font-mono text-[10px] text-brand-medium-gray mt-1">
                  of {fmtN(owfSaoTarget)} target · {(owfSaoYtd / owfSaoTarget * 100).toFixed(0)}% attained
                </p>
              </div>
              <div className="px-6 py-4">
                <p className="font-mono text-[9px] text-brand-medium-gray/60 tracking-widest uppercase mb-2">
                  MQL→SAO conversion
                </p>
                <p className="text-xl tabular-nums tracking-tight">{(owfConvRate * 100).toFixed(2)}%</p>
                <p className="font-mono text-[10px] text-brand-medium-gray mt-1">
                  {fmtN(owfSaoYtd)} ÷ {fmtN(owfMqlYtd)} · derived from actuals
                </p>
              </div>
              <div className="px-6 py-4">
                <p className="font-mono text-[9px] text-brand-medium-gray/60 tracking-widest uppercase mb-2">YTD pipeline created</p>
                <p className="text-xl tabular-nums tracking-tight">{fmtM(owfPgYtd)}</p>
                <p className="font-mono text-[10px] text-brand-medium-gray mt-1">
                  of {fmtM(owfPgTarget)} target · {(owfPgYtd / owfPgTarget * 100).toFixed(0)}% attained
                </p>
              </div>
            </div>

            {/* Remaining-period scenarios */}
            <div className="px-6 pt-3 pb-1">
              <p className="font-mono text-[9px] text-brand-medium-gray/60 tracking-widest uppercase mb-2">
                Remaining-period forecast · pace-based scenarios · provisional
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-brand-black/5 border-b border-brand-black/5">
              {/* Low */}
              <div className="px-6 py-4 bg-brand-light-gray/20">
                <p className="font-mono text-[9px] text-brand-medium-gray tracking-widest uppercase mb-3">Low · −15% pace</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">MQLs remaining</span>
                    <span className="font-mono text-sm tabular-nums">{fmtN(owfMqlRemainingLow)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">SAOs remaining</span>
                    <span className="font-mono text-sm tabular-nums">{fmtN(owfSaoRemaining(owfMqlRemainingLow))}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">Pipeline remaining</span>
                    <span className="font-mono text-sm tabular-nums">{fmtM(owfPgRemaining(owfSaoRemaining(owfMqlRemainingLow)))}</span>
                  </div>
                </div>
              </div>
              {/* Planning */}
              <div className="px-6 py-4 bg-white">
                <p className="font-mono text-[9px] text-brand-medium-gray tracking-widest uppercase mb-3">Planning · YTD pace</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">MQLs remaining</span>
                    <span className="font-mono text-sm tabular-nums font-medium">{fmtN(owfMqlRemainingPlan)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">SAOs remaining</span>
                    <span className="font-mono text-sm tabular-nums font-medium">{fmtN(owfSaoRemaining(owfMqlRemainingPlan))}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">Pipeline remaining</span>
                    <span className="font-mono text-sm tabular-nums font-medium">{fmtM(owfPgRemaining(owfSaoRemaining(owfMqlRemainingPlan)))}</span>
                  </div>
                </div>
              </div>
              {/* High */}
              <div className="px-6 py-4 bg-emerald-50/30">
                <p className="font-mono text-[9px] text-brand-medium-gray tracking-widest uppercase mb-3">High · +15% pace</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">MQLs remaining</span>
                    <span className="font-mono text-sm tabular-nums">{fmtN(owfMqlRemainingHigh)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">SAOs remaining</span>
                    <span className="font-mono text-sm tabular-nums">{fmtN(owfSaoRemaining(owfMqlRemainingHigh))}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] text-brand-medium-gray">Pipeline remaining</span>
                    <span className="font-mono text-sm tabular-nums">{fmtM(owfPgRemaining(owfSaoRemaining(owfMqlRemainingHigh)))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Governance footnote */}
            <div className="px-6 py-2 flex items-center gap-4">
              <span className="font-mono text-[9px] text-brand-medium-gray/50">
                Source: {pacingCache.sourceTable} · channel = "Orgs Web Form"
              </span>
              <span className="font-mono text-[9px] text-brand-medium-gray/40">·</span>
              <span className="font-mono text-[9px] text-amber-600/70">
                Hex semantic forecast quarantined · source_governance_status: SEMANTIC_APPROVED · ds_validation_status: PENDING · release_status: BLOCKED_DS_VALIDATION
              </span>
              <span className="font-mono text-[9px] text-brand-medium-gray/40">·</span>
              <span className="font-mono text-[9px] text-brand-medium-gray/50">
                Assumed already in official baseline · not double-counted in forecast bridge
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── What Marketing Owes — implied target calculator ─────────────────── */}
      <div className="mb-10 border border-brand-black">
        <div className="bg-brand-black px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-white/50 tracking-widest uppercase">What Marketing Owes · FY26</span>
            <span className="w-px h-3 bg-white/20" />
            <span className="font-mono text-[10px] text-white/30">Implied target calculator · as of {TODAY_DISPLAY}</span>
          </div>
          <span className="font-mono text-[10px] text-white/30">{YEAR_ELAPSED_PCT.toFixed(0)}% of year elapsed</span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-brand-black">
          <div className="px-7 py-5">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">FY26 MQL target</p>
            <p className="text-3xl tracking-tight tabular-nums mb-1">{fmtN(TOTAL_MQL_TARGET)}</p>
            <p className="font-mono text-[10px] text-brand-medium-gray">FY26 annual plan</p>
          </div>
          <div className="px-7 py-5">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">Delivered YTD</p>
            <p className="text-3xl tracking-tight tabular-nums mb-1 text-emerald-700">{fmtN(ytdMql)}</p>
            <p className="font-mono text-[10px] text-brand-medium-gray">{ytdMqlPct.toFixed(1)}% of target · marketing-sourced · provisional</p>
          </div>
          <div className="px-7 py-5">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">Still owed</p>
            <p className="text-3xl tracking-tight tabular-nums mb-1 text-brand-hot-red">{fmtN(TOTAL_MQL_TARGET - ytdMql)}</p>
            <p className="font-mono text-[10px] text-brand-medium-gray">Target minus YTD · {daysLeftInFY} days remain</p>
          </div>
          <div className="px-7 py-5 bg-brand-hot-red/5">
            <p className="font-mono text-[10px] text-brand-hot-red tracking-widest uppercase mb-3">Uncovered gap</p>
            <p className="text-3xl tracking-tight tabular-nums mb-1 text-brand-hot-red">{fmtN(uncoveredMql)}</p>
            <p className="font-mono text-[10px] text-brand-medium-gray">After {fmtN(futurePipeline.mqlFcst)} pipeline · {((futurePipeline.mqlFcst / (TOTAL_MQL_TARGET - ytdMql)) * 100).toFixed(0)}% covered</p>
          </div>
        </div>
        <div className="border-t border-brand-black/10 bg-brand-hot-red/5 px-8 py-4 flex items-center gap-10">
          <div>
            <span className="font-mono text-[10px] text-brand-hot-red tracking-widest uppercase">Implied weekly run-rate needed</span>
            <span className="font-mono text-sm tabular-nums text-brand-hot-red ml-4">{fmtN(weeklyRateNeeded)} MQL / week</span>
          </div>
          <span className="w-px h-4 bg-brand-hot-red/20" />
          <div>
            <span className="font-mono text-[10px] text-brand-hot-red tracking-widest uppercase">Monthly equivalent</span>
            <span className="font-mono text-sm tabular-nums text-brand-hot-red ml-4">{fmtN(monthlyRateNeeded)} MQL / month</span>
          </div>
          <span className="w-px h-4 bg-brand-hot-red/20" />
          <div className="ml-auto">
            <span className="font-mono text-[10px] text-brand-medium-gray">Best case year-end (actuals + pipeline)</span>
            <span className="font-mono text-sm tabular-nums ml-3">
              {fmtN(projectedMql)} MQL
              <span className="text-brand-hot-red ml-2">({projectedMqlPct.toFixed(0)}% of target)</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Crisis alert banner ──────────────────────────────────────────────── */}
      <div className="mb-10 border border-brand-hot-red bg-brand-hot-red/5 px-8 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-[10px] text-brand-hot-red tracking-widest uppercase">FY26 At Risk</span>
          <span className="w-px h-3 bg-brand-hot-red/30" />
          <span className="font-mono text-[10px] text-brand-hot-red/60">Year-end projection · {TODAY_DISPLAY}</span>
        </div>
        <div className="flex items-end gap-8 mb-5">
          <div>
            <span className="text-[72px] leading-none tracking-tight tabular-nums text-brand-hot-red">
              {projectedMqlPct.toFixed(0)}%
            </span>
          </div>
          <div className="pb-3">
            <p className="text-xl tracking-tight text-brand-black mb-1">projected year-end MQL attainment</p>
            <p className="font-mono text-[11px] text-brand-medium-gray">
              {fmtN(projectedMql)} MQL projected of {fmtN(TOTAL_MQL_TARGET)} target · {fmtN(uncoveredMql)} MQL uncovered after pipeline
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 pt-4 border-t border-brand-hot-red/15">
          <div>
            <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">Delivered YTD</p>
            <p className="font-mono text-sm tabular-nums">{fmtN(ytdMql)} MQL <span className="text-brand-medium-gray/60">({ytdMqlPct.toFixed(1)}%)</span></p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">Future pipeline coverage</p>
            <p className="font-mono text-sm tabular-nums">{fmtN(futurePipeline.mqlFcst)} MQL <span className="text-brand-medium-gray/60">({((futurePipeline.mqlFcst / TOTAL_MQL_TARGET) * 100).toFixed(1)}% of target)</span></p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">Days remaining in FY26</p>
            <p className="font-mono text-sm tabular-nums">{daysLeftInFY} days · Q3 ends Sep 30 ({daysLeftInQ3} days)</p>
          </div>
        </div>
      </div>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">
          Plan health · FY26
        </p>
        <div className="flex items-end justify-between gap-8 mb-1">
          <h1 className="text-5xl tracking-tight leading-none">Where do we stand?</h1>
          <p className="font-mono text-xs text-brand-medium-gray mb-1">
            {TODAY_DISPLAY} · {allPipeline.count} activities
          </p>
        </div>
        <p className="font-mono text-[11px] text-brand-medium-gray">
          {YEAR_ELAPSED_PCT.toFixed(0)}% through FY26 · Q1 and Q2 complete · Q3 ends Sep 30
        </p>
      </div>

      {/* ── Filter bar — region only (affects regional detail cards, not global headline) ── */}
      <div className="border border-brand-black/10 bg-brand-light-gray/50 px-6 py-4 mb-8 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase w-16">Region</span>
          <div className="flex gap-px">
            {(["All", ...SALES_REGIONS] as const).map(r => (
              <button
                key={r}
                onClick={() => setFilterRegion(r as SalesRegion | "All")}
                className={`font-mono text-[10px] px-2.5 py-1 border transition-colors ${
                  filterRegion === r
                    ? "bg-brand-black text-white border-brand-black"
                    : "bg-white text-brand-black border-brand-black/15 hover:border-brand-black/40"
                }`}
              >{r}</button>
            ))}
          </div>
        </div>

        {anyFilterActive && (
          <button
            onClick={() => setFilterRegion("All")}
            className="font-mono text-[10px] text-brand-medium-gray underline underline-offset-2 hover:text-brand-black transition-colors ml-auto"
          >Clear</button>
        )}

        <p className="font-mono text-[10px] text-brand-medium-gray/60 w-full -mt-2">
          Region filter applies to the regional detail table only — headline metrics are marketing-sourced totals.
        </p>
      </div>

      {/* ── SECTION 1: Where we stand ─────────────────────────────────────── */}
      <div className="mb-1">
        <SectionLabel step="01" label="Where we stand" sub="Marketing-sourced FY26 · provisional actuals, Q1–Q3" />
      </div>

      <div className="bg-brand-black text-white mb-px">
        <div className="grid grid-cols-[1fr_300px] gap-0">
          {/* Left: delivered actuals */}
          <div className="px-10 py-8">
            <p className="font-mono text-[10px] text-white/40 tracking-widest uppercase mb-5">
              Marketing-sourced · provisional · data as of {pacingCache.asOf}
            </p>
            <div className="flex items-baseline gap-10 mb-6">
              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-[56px] leading-none tracking-tight tabular-nums text-brand-lime">
                    {fmtN(ytdMql)}
                  </span>
                  <span className="font-mono text-sm text-white/30 ml-1">MQL</span>
                </div>
                <p className="font-mono text-[10px] text-white/30 tabular-nums">
                  {ytdMqlPct.toFixed(1)}% of {fmtK(TOTAL_MQL_TARGET)} FY26 target
                </p>
              </div>
              <div className="border-l border-white/10 pl-10">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-4xl tracking-tight tabular-nums text-white/80">{ytdSao}</span>
                  <span className="font-mono text-sm text-white/30 ml-1">SAO</span>
                </div>
                <p className="font-mono text-[10px] text-white/30 tabular-nums">
                  {ytdSaoPct.toFixed(1)}% of {TOTAL_SAO_TARGET} FY26 target
                </p>
              </div>
            </div>
            {/* Actuals + future forecast stacked bar */}
            <div className="relative mb-3">
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className="absolute left-0 h-2 bg-brand-lime rounded-l-full"
                  style={{ width: `${actualsBarPct}%` }}
                />
                <div
                  className="absolute h-2 bg-white/20"
                  style={{ left: `${actualsBarPct}%`, width: `${forecastBarPct}%` }}
                />
              </div>
              <div
                className="absolute top-0 w-px h-2 bg-white/50 z-10"
                style={{ left: `${Math.min(YEAR_ELAPSED_PCT, 99)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-1 bg-brand-lime rounded-sm inline-block" />
                  <span className="font-mono text-[10px] text-white/40">{fmtN(ytdMql)} delivered</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-1 bg-white/20 rounded-sm inline-block" />
                  <span className="font-mono text-[10px] text-white/40">{fmtN(futurePipeline.mqlFcst)} future pipeline</span>
                </span>
              </div>
              <span className="font-mono text-[10px] text-white/25">{YEAR_ELAPSED_PCT.toFixed(0)}% year elapsed ↑</span>
            </div>
          </div>

          {/* Right: year-end projection */}
          <div className="border-l border-white/10 px-8 py-8 flex flex-col justify-between">
            <p className="font-mono text-[10px] text-white/30 tracking-widest uppercase mb-6">
              Year-end projection
            </p>
            <div>
              <p className="font-mono text-[10px] text-white/40 mb-1">MQL · actuals + future pipeline</p>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-5xl tracking-tight tabular-nums text-brand-hot-red">{projectedMqlPct.toFixed(0)}%</span>
                <div>
                  <p className="font-mono text-xs text-white/50">{fmtN(projectedMql)} MQL</p>
                  <p className="font-mono text-[10px] text-white/30">of {fmtK(TOTAL_MQL_TARGET)} target</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <div className="flex-1 h-px bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-hot-red"
                    style={{ width: `${Math.min(100, projectedMqlPct)}%` }}
                  />
                </div>
              </div>

              <p className="font-mono text-[10px] text-white/40 mb-1">SAO · actuals + future pipeline</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl tracking-tight tabular-nums text-white/80">{fmtN(projectedSao)}</span>
                <span className="font-mono text-xs text-white/30">/ {TOTAL_SAO_TARGET}</span>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <div className="flex-1 h-px bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${((projectedSao / TOTAL_SAO_TARGET) * 100) >= 80 ? "bg-emerald-500" : ((projectedSao / TOTAL_SAO_TARGET) * 100) >= 50 ? "bg-amber-400" : "bg-brand-hot-red"}`}
                    style={{ width: `${Math.min(100, (projectedSao / TOTAL_SAO_TARGET) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-white/40 tabular-nums w-12 text-right">
                  {((projectedSao / TOTAL_SAO_TARGET) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quarter breakdown */}
      <div className="grid grid-cols-4 gap-px bg-brand-black mb-10">
        <div className="bg-white">
          <QuarterCard label="Q1" period="Jan – Mar 2026" state="delivered"
            mql={pacingCache.quarters[0].mql.actual} sao={pacingCache.quarters[0].sao.actual} progress={100} sublabel="Salesforce certified" />
        </div>
        <div className="bg-white">
          <QuarterCard label="Q2" period="Apr – Jun 2026" state="delivered"
            mql={pacingCache.quarters[1].mql.actual} sao={pacingCache.quarters[1].sao.actual} progress={100} sublabel="Salesforce certified" />
        </div>
        <div className="bg-red-50">
          <QuarterCard label="Q3" period="Jul – Sep 2026" state="crisis"
            mql={pacingCache.quarters[2].mql.actual} sao={pacingCache.quarters[2].sao.actual} progress={Q3_ELAPSED_PCT}
            sublabel={`${Q3_ELAPSED_PCT.toFixed(0)}% elapsed · ${daysLeftInQ3} days left`} />
        </div>
        <div className="bg-white">
          <QuarterCard label="Q4" period="Oct – Dec 2026" state="planned"
            mql={null} sao={null} sublabel="Not yet started" />
        </div>
      </div>

      {/* Q3 crisis strip */}
      <div className="border border-brand-hot-red/30 bg-red-50 px-8 py-4 mb-10 flex items-start gap-4">
        <div className="w-px self-stretch bg-brand-hot-red flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-[10px] text-brand-hot-red tracking-widest uppercase mb-1">
            Q3 Alert · {daysLeftInQ3} days remaining · Sep 30 deadline
          </p>
          <p className="text-sm tracking-tight text-red-900 mb-1">
            Q3 has delivered only {fmtN(pacingCache.quarters[2].mql.actual ?? 0)} MQL with {Q3_ELAPSED_PCT.toFixed(0)}% of the quarter elapsed.
            At this pace, Q3 will close with approximately {fmtN(q3PaceProjection)} MQL — well below Q1 ({fmtN(pacingCache.quarters[0].mql.actual ?? 0)}) and Q2 ({fmtN(pacingCache.quarters[1].mql.actual ?? 0)}).
          </p>
          <p className="font-mono text-[11px] text-brand-medium-gray">
            Q1 delivered {fmtN(pacingCache.quarters[0].mql.actual ?? 0)} · Q2 delivered {fmtN(pacingCache.quarters[1].mql.actual ?? 0)} · Q3 to date: {fmtN(pacingCache.quarters[2].mql.actual ?? 0)} · Q3 pace projection: ~{fmtN(q3PaceProjection)}
          </p>
        </div>
      </div>

      {/* ── SECTION 2: The gap ────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionLabel step="02" label="The gap" sub={`${fmtN(remainingTarget)} MQL needed from ${TODAY_DISPLAY} through Dec 31`} />
      </div>

      <div className="grid grid-cols-3 gap-px bg-brand-black mb-10">
        <div className="bg-white px-8 py-6">
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
            Full-year MQL target
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl tracking-tight tabular-nums">{fmtN(TOTAL_MQL_TARGET)}</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="h-px flex-1 bg-brand-light-gray rounded-full overflow-hidden">
              <div className="h-full bg-brand-lime rounded-full" style={{ width: `${Math.min(100, ytdMqlPct)}%` }} />
            </div>
            <span className="font-mono text-[10px] text-brand-medium-gray tabular-nums">{fmtN(ytdMql)} delivered</span>
          </div>
        </div>
        <div className="bg-white px-8 py-6">
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
            Remaining to target
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl tracking-tight tabular-nums ${remainingTarget > 0 ? "text-brand-hot-red" : "text-emerald-600"}`}>
              {remainingTarget > 0 ? fmtN(remainingTarget) : "0"}
            </span>
            <span className="font-mono text-sm text-brand-medium-gray">MQL</span>
          </div>
          <p className="font-mono text-[10px] text-brand-medium-gray">
            {remainingTargetSao > 0 ? `${fmtN(remainingTargetSao)} SAO also needed` : "SAO target met"}
          </p>
        </div>
        <div className="bg-white px-8 py-6">
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
            Time remaining
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl tracking-tight tabular-nums">{FY_TOTAL_DAYS - FY_ELAPSED_DAYS}</span>
            <span className="font-mono text-sm text-brand-medium-gray">days left</span>
          </div>
          <p className="font-mono text-[10px] text-brand-medium-gray">
            Q3 ends Sep 30 · Q4 Oct–Dec 2026
          </p>
        </div>
      </div>

      {/* ── SECTION 3: What the activity pipeline closes ─────────────────── */}
      <div className="mb-5">
        <SectionLabel step="03" label="What the activity pipeline closes"
          sub={`${futurePipeline.count} future activities with due date after today`} />
      </div>

      <div className="grid grid-cols-3 gap-px bg-brand-black mb-px">
        <div className="bg-white px-8 py-6">
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
            Future pipeline · MQL
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl tracking-tight tabular-nums">{fmtN(futurePipeline.mqlFcst)}</span>
            <span className="font-mono text-sm text-brand-medium-gray">MQL forecast</span>
          </div>
          <p className="font-mono text-[10px] text-brand-medium-gray">
            From activities due after {TODAY_DISPLAY}
          </p>
        </div>
        <div className="bg-white px-8 py-6">
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
            Future pipeline · SAO
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl tracking-tight tabular-nums">{fmtN(futurePipeline.saoFcst)}</span>
            <span className="font-mono text-sm text-brand-medium-gray">SAO forecast</span>
          </div>
          <p className="font-mono text-[10px] text-brand-medium-gray">
            MQL × regional conversion rates
          </p>
        </div>
        <div className="bg-white px-8 py-6">
          <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
            Pipeline covers gap by
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl tracking-tight tabular-nums ${pipelineCovers >= remainingTarget ? "text-emerald-600" : "text-amber-500"}`}>
              {remainingTarget > 0 ? `${Math.round((pipelineCovers / remainingTarget) * 100)}%` : "100%"}
            </span>
          </div>
          <p className="font-mono text-[10px] text-brand-medium-gray">
            {fmtN(pipelineCovers)} forecast vs {fmtN(remainingTarget)} needed
          </p>
        </div>
      </div>

      {/* Regional pipeline table — apples-to-apples: actuals + forecast vs annual target */}
      <div className="bg-brand-black grid grid-cols-1 gap-px mb-px mt-px">
        <div className="bg-brand-black grid grid-cols-[1fr_160px_160px_160px] gap-0 px-6 py-2.5">
          <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase">Region</span>
          <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase text-right">YTD Actuals</span>
          <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase text-right">+ Future Fcst</span>
          <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase text-right">vs FY26 Target</span>
        </div>
      </div>
      <div className="bg-brand-black grid grid-cols-1 gap-px mb-1">
        {visibleRegions.map((region) => {
          const ref = FY26_REF[region]
          const futureFcst = futurePipeline.regionRollup[region].mqlFcst
          const attainPct = ref.mql > 0 ? (futureFcst / ref.mql) * 100 : 0
          const badge = attainmentBadge(attainPct)
          return (
            <div key={region}
              className="bg-white grid grid-cols-[1fr_160px_160px_160px] items-center gap-0 px-6 py-4 hover:bg-[#FAFAFA] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-base">{REGION_FLAGS[region]}</span>
                  <span className="text-sm tracking-tight">{region}</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 border rounded-sm ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-brand-medium-gray ml-7">{REGION_FULL[region]}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] text-brand-medium-gray/60 italic">Unavailable</div>
                <div className="font-mono text-[10px] text-brand-medium-gray/40">not broken out by region</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm tabular-nums">{futureFcst > 0 ? `+${fmtK(futureFcst)}` : "—"}</div>
                <div className="font-mono text-[10px] text-brand-medium-gray/60 tabular-nums">future fcst</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm tabular-nums">{fmtK(ref.mql)}</div>
                <div className="font-mono text-[10px] tabular-nums text-brand-medium-gray/60">target</div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="font-mono text-[10px] text-brand-medium-gray mb-10">
        Regional YTD actuals are not available — SFDC does not break out certified actuals by region. Future forecast from activities due after {TODAY_DISPLAY}.
      </p>

      {/* ── SECTION 4: What's still uncovered ─────────────────────────────── */}
      <div className="mb-5">
        <SectionLabel step="04" label="What's still uncovered"
          sub="Gap not closed by actuals or the current activity pipeline" />
      </div>

      {uncoveredMql <= 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 px-8 py-6 mb-10">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm tracking-tight text-emerald-800 mb-0.5">Pipeline fully covers the gap</p>
              <p className="font-mono text-[11px] text-emerald-700">
                Actuals + future pipeline ({fmtN(projectedMql)}) exceeds the {fmtN(TOTAL_MQL_TARGET)} MQL target.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-brand-black mb-10">
          <div className="bg-white px-8 py-6 col-span-2">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
              Uncovered MQL gap
            </p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-[44px] leading-none tracking-tight tabular-nums text-brand-hot-red">
                {fmtN(uncoveredMql)}
              </span>
              <span className="font-mono text-sm text-brand-medium-gray">MQL not covered</span>
            </div>
            <div className="flex gap-6 mb-4">
              <div>
                <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">YTD delivered</p>
                <p className="font-mono text-sm tabular-nums">{fmtN(ytdMql)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">+ future pipeline</p>
                <p className="font-mono text-sm tabular-nums">+{fmtN(futurePipeline.mqlFcst)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">= projected</p>
                <p className="font-mono text-sm tabular-nums">{fmtN(projectedMql)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-brand-medium-gray mb-0.5">target</p>
                <p className="font-mono text-sm tabular-nums">{fmtN(TOTAL_MQL_TARGET)}</p>
              </div>
            </div>
            <div className="relative h-2 bg-brand-light-gray rounded-full overflow-hidden">
              <div className="absolute left-0 h-2 bg-brand-lime rounded-l-full" style={{ width: `${actualsBarPct}%` }} />
              <div className="absolute h-2 bg-brand-medium-gray/30" style={{ left: `${actualsBarPct}%`, width: `${forecastBarPct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[10px] text-brand-medium-gray">{projectedMqlPct.toFixed(0)}% projected attainment</span>
              <span className="font-mono text-[10px] text-brand-hot-red">{fmtN(uncoveredMql)} short</span>
            </div>
          </div>
          <div className="bg-white px-8 py-6">
            <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-4">
              Uncovered SAO gap
            </p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl tracking-tight tabular-nums text-brand-hot-red">
                {fmtN(uncoveredSao)}
              </span>
              <span className="font-mono text-sm text-brand-medium-gray">SAO</span>
            </div>
            <p className="font-mono text-[10px] text-brand-medium-gray">
              {uncoveredSao > 0
                ? `Need ${fmtN(TOTAL_SAO_TARGET)} SAO · have ${fmtN(ytdSao + futurePipeline.saoFcst)}`
                : "SAO on track"}
            </p>
          </div>
        </div>
      )}

      {/* ── SECTION 5: Bets ───────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionLabel step="05" label="Bets in the gap"
          sub={activeBets.length > 0 ? `${activeBets.length} active bet${activeBets.length !== 1 ? "s" : ""} · additional investments not yet in the activity pipeline` : "No active bets recorded"} />
      </div>

      {activeBets.length === 0 ? (
        <div className="border border-brand-black/10 px-8 py-6 mb-10">
          <p className="font-mono text-[11px] text-brand-medium-gray">
            No funded or active bets on record. Use the Bets tab to capture novel investments that could close the gap.
          </p>
        </div>
      ) : (
        <>
          {/* Bets summary header */}
          <div className="grid grid-cols-3 gap-px bg-brand-black mb-px">
            <div className="bg-white px-8 py-5">
              <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">
                Planning case MQL
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl tracking-tight tabular-nums text-brand-blue">
                  {betsRange.planning > 0 ? `${betsRange.planning.toFixed(1)}M` : "—"}
                </span>
                <span className="font-mono text-xs text-brand-medium-gray">pipeline</span>
              </div>
              <p className="font-mono text-[10px] text-brand-medium-gray mt-1">
                Range: {betsRange.low.toFixed(1)}M–{betsRange.high.toFixed(1)}M
              </p>
            </div>
            <div className="bg-white px-8 py-5">
              <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">
                Bets by status
              </p>
              <div className="flex gap-4 mt-1">
                {(["fund", "test", "pending"] as const).map((s) => {
                  const count = activeBets.filter((b) => b.status === s).length
                  if (count === 0) return null
                  const cls = s === "fund" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : s === "test" ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-brand-medium-gray bg-brand-light-gray border-brand-light-gray"
                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 border rounded-sm ${cls}`}>
                        {s}
                      </span>
                      <span className="font-mono text-xs tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-white px-8 py-5">
              <p className="font-mono text-[10px] text-brand-medium-gray tracking-widest uppercase mb-3">
                Gap after bets (est.)
              </p>
              <div className="flex items-baseline gap-2">
                {/* Bets are in $M pipeline — not directly in MQL — show note */}
                <span className="font-mono text-[10px] text-brand-medium-gray leading-relaxed">
                  Bet outcomes are in pipeline $ and not yet reconciled to MQL. See Bets tab for MQL estimates per bet.
                </span>
              </div>
            </div>
          </div>

          {/* Bets list */}
          <div className="bg-brand-black grid grid-cols-1 gap-px mb-px">
            <div className="bg-brand-black grid grid-cols-[1fr_100px_140px_100px] gap-0 px-6 py-2.5">
              <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase">Bet</span>
              <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase">Region</span>
              <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase text-right">Pipeline range</span>
              <span className="font-mono text-[10px] text-white/30 tracking-widest uppercase text-center">Status</span>
            </div>
          </div>
          <div className="bg-brand-black grid grid-cols-1 gap-px mb-1">
            {activeBets.map((bet) => {
              const statusCls = bet.status === "fund"
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : bet.status === "test"
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-brand-medium-gray bg-brand-light-gray border-brand-light-gray"
              return (
                <div key={bet.id}
                  className="bg-white grid grid-cols-[1fr_100px_140px_100px] items-center gap-0 px-6 py-4 hover:bg-[#FAFAFA] transition-colors"
                >
                  <div>
                    <p className="text-sm tracking-tight mb-0.5">{bet.name}</p>
                    {bet.quarter && (
                      <p className="font-mono text-[10px] text-brand-medium-gray">{bet.quarter}</p>
                    )}
                  </div>
                  <div>
                    <span className="font-mono text-[11px] text-brand-medium-gray">{bet.region || "—"}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm tabular-nums">
                      {bet.rangeLow != null && bet.rangeHigh != null
                        ? `$${bet.rangeLow.toFixed(1)}M–$${bet.rangeHigh.toFixed(1)}M`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 border rounded-sm ${statusCls}`}>
                      {bet.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="font-mono text-[10px] text-brand-medium-gray mb-10">
            Bets are novel investments outside the core activity pipeline. Pipeline range is in $M. Open Bets tab for full detail.
          </p>
        </>
      )}

      {/* ── Validation checks ─────────────────────────────────────────────── */}
      <ValidationPanel
        overrides={overrides}
        futurePipeline={futurePipeline}
        projectedMqlPct={projectedMqlPct}
        uncoveredMql={uncoveredMql}
        activities={activities}
        asanaFetchedAt={asanaFetchedAt}
        pacingCache={pacingCache}
        activityReach={activityReach}
        channelMqlRates={channelMqlRates}
      />

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-brand-black/10 pt-6 mt-4">
        <p className="font-mono text-[10px] text-brand-medium-gray leading-relaxed max-w-2xl">
          Marketing-sourced pipeline forecast · excludes sales-sourced, partner-sourced, and marketing-influenced-only pipeline.
          YTD actuals sourced from the Hex semantic-approved feed as of {pacingCache.asOf}.
          Future pipeline forecast uses activities with due date after {TODAY_ISO}, applying reach × channel MQL rate × regional SAO conversion.
          Activities without a Salesforce Campaign ID contribute modelled forecast only; certified actuals for those activities are unavailable until attribution is established.
        </p>
      </div>
    </div>
  )
}
