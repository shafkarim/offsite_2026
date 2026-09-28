import { useState } from "react"
import { useLiveHex } from "../live-sources"

type MetricKey = "mql" | "sao" | "pg"
type PaceStatus = "on-track" | "at-risk" | "off-track" | "none"
type QuarterStatus = "complete" | "in-progress" | "upcoming"

function fmtN(value: number | null, metric: MetricKey): string {
  if (value == null) return "—"
  if (metric === "pg") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }
  return value.toLocaleString()
}

function fmtPct(v: number | null): string {
  if (v == null) return "—"
  return `${Math.round(v * 100)}%`
}

function paceStatus(index: number | null): PaceStatus {
  if (index == null) return "none"
  if (index >= 1.0) return "on-track"
  if (index >= 0.85) return "at-risk"
  return "off-track"
}

function attainmentStatus(attainment: number | null): PaceStatus {
  if (attainment == null) return "none"
  if (attainment >= 1.0) return "on-track"
  if (attainment >= 0.9) return "at-risk"
  return "off-track"
}

function statusDotClass(status: PaceStatus): string {
  if (status === "on-track") return "bg-brand-dark-green"
  if (status === "at-risk") return "bg-brand-maroon"
  if (status === "off-track") return "bg-brand-hot-red"
  return "bg-brand-light-gray"
}

function statusBorderColor(status: PaceStatus): string {
  if (status === "on-track") return "#0A5C35"
  if (status === "at-risk") return "#721C1C"
  if (status === "off-track") return "#FF3737"
  return "#E2E2E2"
}

function statusLabel(status: PaceStatus): string {
  if (status === "on-track") return "On track"
  if (status === "at-risk") return "At risk"
  if (status === "off-track") return "Off track"
  return "—"
}

function statusTextClass(status: PaceStatus): string {
  if (status === "on-track") return "text-brand-dark-green"
  if (status === "at-risk") return "text-brand-maroon"
  if (status === "off-track") return "text-brand-hot-red"
  return "text-brand-medium-gray"
}

function PacingBar({ attainment, elapsed }: { attainment: number; elapsed: number }) {
  const pct = Math.min(attainment, 1)
  const isAhead = attainment >= elapsed
  return (
    <div className="relative h-1.5 bg-brand-light-gray rounded-full overflow-hidden w-20">
      <div
        className="absolute top-0 bottom-0 w-px bg-brand-medium-gray z-10"
        style={{ left: `${elapsed * 100}%` }}
      />
      <div
        className={`h-full rounded-full transition-all ${isAhead ? "bg-brand-dark-green" : "bg-brand-maroon"}`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-4 py-1.5 rounded-full transition-colors font-mono ${
        active
          ? "bg-brand-black text-white"
          : "text-brand-medium-gray hover:bg-brand-light-gray"
      }`}
    >
      {children}
    </button>
  )
}

const METRIC_LABELS: Record<MetricKey, string> = {
  mql: "MQL",
  sao: "SAO",
  pg: "Pipeline $",
}

function QuarterStatusBadge({ status }: { status: QuarterStatus }) {
  if (status === "complete") {
    return (
      <span className="font-mono text-[10px] tracking-widest uppercase text-brand-dark-green bg-[#E8F5EE] px-2 py-0.5">
        Complete
      </span>
    )
  }
  if (status === "in-progress") {
    return (
      <span className="font-mono text-[10px] tracking-widest uppercase text-brand-maroon bg-[#F9F0F0] px-2 py-0.5">
        In Progress
      </span>
    )
  }
  return (
    <span className="font-mono text-[10px] tracking-widest uppercase text-brand-medium-gray bg-brand-light-gray px-2 py-0.5">
      Upcoming
    </span>
  )
}

export default function PacingView() {
  const [tab, setTab] = useState<"regions" | "channels">("regions")
  const [metric, setMetric] = useState<MetricKey>("mql")
  const hex = useLiveHex()

  if (!hex.data) {
    return (
      <div role="alert" className="border border-brand-hot-red bg-white p-8 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-hot-red mb-3">Live Hex data required</p>
        <h1 className="text-4xl tracking-tight mb-3">Pacing is unavailable</h1>
        <p className="text-brand-medium-gray text-sm leading-relaxed">
          This view does not fall back to the bundled Hex snapshot. {hex.detail ?? "Waiting for the approved live feed."}
        </p>
        <button onClick={() => void hex.refresh()} className="font-mono text-xs underline mt-5">Retry live connection</button>
      </div>
    )
  }

  const pacingCache = hex.data.feed.pacing

  const elapsed = pacingCache.quarterElapsedPct
  const global = pacingCache.regions.find(r => r.region === "GLOBAL")!
  const subRegions = pacingCache.regions.filter(r => r.region !== "GLOBAL")
  const quarters = pacingCache.quarters
  const fy = pacingCache.fy

  const rows: typeof pacingCache.regions | typeof pacingCache.channels =
    tab === "regions" ? pacingCache.regions.filter(r => r.region !== "GLOBAL") : pacingCache.channels

  // FY-level status for each metric
  const fyMqlStatus = attainmentStatus(fy.mql.fullYearAttainment)
  const fySaoStatus = attainmentStatus(fy.sao.fullYearAttainment)
  const fyPgStatus = attainmentStatus(fy.pg.fullYearAttainment)
  const fyStatuses: Record<MetricKey, PaceStatus> = {
    mql: fyMqlStatus,
    sao: fySaoStatus,
    pg: fyPgStatus,
  }
  // Overall FY verdict: worst of the three
  const fyOverall: PaceStatus =
    [fyMqlStatus, fySaoStatus, fyPgStatus].includes("off-track")
      ? "off-track"
      : [fyMqlStatus, fySaoStatus, fyPgStatus].includes("at-risk")
        ? "at-risk"
        : "on-track"

  return (
    <div>
      {/* ── Hero: Are we on track? ─────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="font-mono text-xs tracking-widest uppercase text-brand-medium-gray mb-2">
          FY26 · as of {pacingCache.asOf}
        </p>
        <div className="flex items-start gap-4 mb-1">
          <h1 className="text-5xl tracking-tight">Are we on track?</h1>
          <div className="mt-2.5 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotClass(fyOverall)}`} />
            <span className={`text-lg tracking-tight ${statusTextClass(fyOverall)}`}>
              {fyOverall === "on-track" ? "Mostly yes" : fyOverall === "at-risk" ? "Partially at risk" : "Off track"}
            </span>
          </div>
        </div>
        <p className="text-brand-medium-gray text-sm font-mono">
          Pipeline is ahead · MQL and SAO slightly below full-year pace
        </p>
      </div>

      {/* ── FY26 summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(["mql", "sao", "pg"] as MetricKey[]).map(m => {
          const fyData = fy[m]
          const status = fyStatuses[m]
          const attPct = fyData.fullYearAttainment
          const shortfall = fyData.target - fyData.fullYearForecast
          return (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`text-left border p-5 transition-colors bg-white ${
                metric === m
                  ? "border-brand-black"
                  : "border-brand-light-gray hover:border-brand-medium-gray"
              }`}
              style={{ borderLeft: `3px solid ${statusBorderColor(status)}` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(status)}`} />
                <p className="font-mono text-xs tracking-widest uppercase text-brand-medium-gray">{METRIC_LABELS[m]}</p>
                <span className={`ml-auto font-mono text-xs ${statusTextClass(status)}`}>
                  {statusLabel(status)}
                </span>
              </div>
              <p className="text-2xl tabular-nums tracking-tight leading-none">
                {fmtPct(attPct)}
              </p>
              <p className="font-mono text-xs text-brand-medium-gray mt-0.5 mb-3">
                full-year projected attainment
              </p>
              <div className="border-t border-brand-light-gray pt-3 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-brand-medium-gray">YTD actual</span>
                  <span className="font-mono text-xs tabular-nums text-brand-black">{fmtN(fyData.ytdActual, m)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-brand-medium-gray">Full-year forecast</span>
                  <span className="font-mono text-xs tabular-nums text-brand-black">{fmtN(fyData.fullYearForecast, m)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-brand-medium-gray">Target</span>
                  <span className="font-mono text-xs tabular-nums text-brand-medium-gray">{fmtN(fyData.target, m)}</span>
                </div>
                {shortfall > 0 && (
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="font-mono text-xs text-brand-hot-red">Gap to target</span>
                    <span className="font-mono text-xs tabular-nums text-brand-hot-red">–{fmtN(shortfall, m)}</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Quarter-by-Quarter table ───────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-brand-medium-gray mb-1">Quarterly breakdown</p>
            <h2 className="text-xl tracking-tight">Quarter by quarter</h2>
          </div>
          <div className="flex gap-1">
            {(["mql", "sao", "pg"] as MetricKey[]).map(m => (
              <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
                {METRIC_LABELS[m]}
              </Pill>
            ))}
          </div>
        </div>

        <div className="bg-white border border-brand-black overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-brand-light-gray bg-[#FAFAFA]">
                <th className="text-left font-mono text-xs text-brand-medium-gray px-5 py-3 w-32">Quarter</th>
                <th className="text-left font-mono text-xs text-brand-medium-gray px-3 py-3">Period</th>
                <th className="text-left font-mono text-xs text-brand-medium-gray px-3 py-3">Status</th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">Actual</th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">Target</th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">Attainment</th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">EoQ Forecast</th>
                <th className="text-left font-mono text-xs text-brand-medium-gray px-5 py-3 w-40">Progress</th>
              </tr>
            </thead>
            <tbody>
              {quarters.map(q => {
                const d = q[metric as keyof typeof q] as {
                  actual: number | null
                  target: number
                  attainment: number | null
                  linearForecast: number | null
                  pacingIndex: number | null
                }
                const isCurrentQ = q.status === "in-progress"
                const isUpcoming = q.status === "upcoming"
                const elapsedPct = "elapsedPct" in q ? (q.elapsedPct as number) : null

                let rowStatus: PaceStatus = "none"
                if (q.status === "complete") rowStatus = attainmentStatus(d.attainment)
                else if (q.status === "in-progress") rowStatus = paceStatus(d.pacingIndex)

                const forecastAtt = d.linearForecast != null ? d.linearForecast / d.target : null
                const displayAttainment = q.status === "complete" ? d.attainment : forecastAtt

                return (
                  <tr
                    key={q.id}
                    className={`border-b border-brand-light-gray ${
                      isCurrentQ
                        ? "bg-[#FFFEF5]"
                        : isUpcoming
                          ? "opacity-50"
                          : ""
                    }`}
                  >
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        {!isUpcoming && (
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(rowStatus)}`} />
                        )}
                        {isUpcoming && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 border border-brand-medium-gray" />
                        )}
                        <span className="font-mono text-xs text-brand-black">{q.label}</span>
                        {isCurrentQ && (
                          <span className="font-mono text-[9px] tracking-widest uppercase bg-brand-black text-white px-1.5 py-0.5">
                            Current
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 font-mono text-xs text-brand-medium-gray align-middle">
                      {q.period}
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <QuarterStatusBadge status={q.status as QuarterStatus} />
                    </td>
                    <td className="px-3 py-4 font-mono text-xs text-right tabular-nums text-brand-black align-middle">
                      {fmtN(d.actual, metric)}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs text-right tabular-nums text-brand-medium-gray align-middle">
                      {fmtN(d.target, metric)}
                    </td>
                    <td className={`px-3 py-4 font-mono text-xs text-right tabular-nums align-middle ${
                      isUpcoming ? "text-brand-medium-gray" : statusTextClass(rowStatus)
                    }`}>
                      {isUpcoming ? "—" : fmtPct(displayAttainment)}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs text-right tabular-nums align-middle">
                      {isCurrentQ && d.linearForecast != null ? (
                        <span className="text-brand-black">{fmtN(d.linearForecast, metric)}</span>
                      ) : q.status === "complete" ? (
                        <span className="text-brand-medium-gray">Final</span>
                      ) : (
                        <span className="text-brand-medium-gray">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {isCurrentQ && d.attainment != null && elapsedPct != null ? (
                        <div className="flex items-center gap-3">
                          <PacingBar attainment={d.attainment} elapsed={elapsedPct} />
                          <span className="font-mono text-xs text-brand-black">
                            {fmtPct(d.pacingIndex)} pace
                          </span>
                        </div>
                      ) : q.status === "complete" && d.attainment != null ? (
                        <div className="flex items-center gap-3">
                          <div className="relative h-1.5 bg-brand-light-gray rounded-full overflow-hidden w-20">
                            <div
                              className={`h-full rounded-full ${statusDotClass(attainmentStatus(d.attainment))}`}
                              style={{ width: `${Math.min(d.attainment, 1) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-brand-medium-gray">final</span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-brand-medium-gray">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {/* FY26 Summary row */}
              <tr className="bg-brand-black text-white">
                <td className="px-5 py-4 align-middle" colSpan={2}>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(fyStatuses[metric])}`} />
                    <span className="font-mono text-xs">FY26 Full Year</span>
                  </div>
                  <p className="font-mono text-[10px] text-[#888] mt-0.5 ml-3.5">Q3 EoQ forecast + Q4 target</p>
                </td>
                <td className="px-3 py-4 align-middle">
                  <span className={`font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 ${
                    fyStatuses[metric] === "on-track"
                      ? "text-brand-dark-green bg-[#0A5C35]/20"
                      : fyStatuses[metric] === "at-risk"
                        ? "text-[#F4A4A4] bg-[#721C1C]/30"
                        : "text-brand-hot-red bg-[#FF3737]/20"
                  }`}>
                    {statusLabel(fyStatuses[metric])}
                  </span>
                </td>
                <td className="px-3 py-4 font-mono text-xs text-right tabular-nums align-middle">
                  {fmtN(fy[metric].ytdActual, metric)}
                </td>
                <td className="px-3 py-4 font-mono text-xs text-right tabular-nums text-[#888] align-middle">
                  {fmtN(fy[metric].target, metric)}
                </td>
                <td className={`px-3 py-4 font-mono text-xs text-right tabular-nums align-middle ${
                  fyStatuses[metric] === "on-track"
                    ? "text-brand-lime"
                    : fyStatuses[metric] === "at-risk"
                      ? "text-[#F4A4A4]"
                      : "text-brand-hot-red"
                }`}>
                  {fmtPct(fy[metric].fullYearAttainment)}
                </td>
                <td className="px-3 py-4 font-mono text-xs text-right tabular-nums align-middle">
                  {fmtN(fy[metric].fullYearForecast, metric)}
                </td>
                <td className="px-5 py-4 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="relative h-1.5 bg-[#333] rounded-full overflow-hidden w-20">
                      <div
                        className={`h-full rounded-full ${
                          fyStatuses[metric] === "on-track"
                            ? "bg-brand-lime"
                            : fyStatuses[metric] === "at-risk"
                              ? "bg-[#F4A4A4]"
                              : "bg-brand-hot-red"
                        }`}
                        style={{ width: `${Math.min(fy[metric].fullYearAttainment, 1) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-[#888]">projected</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-2 font-mono text-xs text-brand-medium-gray">
          EoQ forecast = current pace extrapolated to quarter-end (actual ÷ {Math.round(elapsed * 100)}% elapsed) ·
          {" "}<a href={pacingCache.hexThread} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand-black">validate in Hex</a>
        </p>
      </div>

      {/* ── Divider: current quarter detail ───────────────────────────────── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-brand-light-gray" />
        <span className="font-mono text-xs tracking-widest uppercase text-brand-medium-gray">
          {pacingCache.quarter} · current quarter detail
        </span>
        <div className="h-px flex-1 bg-brand-light-gray" />
      </div>

      {/* Global Q3 summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(["mql", "sao", "pg"] as MetricKey[]).map(m => {
          const d = global[m]
          const status = paceStatus(d.pacingIndex)
          return (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`text-left border p-5 transition-colors bg-white ${
                metric === m
                  ? "border-brand-black"
                  : "border-brand-light-gray hover:border-brand-medium-gray"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(status)}`} />
                <p className="font-mono text-xs tracking-widest uppercase text-brand-medium-gray">{METRIC_LABELS[m]}</p>
              </div>
              <p className="text-2xl tabular-nums tracking-tight leading-none">
                {fmtN(d.actual, m)}
              </p>
              <p className="font-mono text-xs text-brand-medium-gray mt-0.5">
                of {fmtN(d.target, m)} target
              </p>
              <div className="mt-3 flex items-center gap-3">
                <PacingBar attainment={d.attainment} elapsed={elapsed} />
                <span className="font-mono text-xs text-brand-black">
                  {fmtPct(d.pacingIndex)} pace
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Quarter context bar */}
      <div className="bg-white border border-brand-black px-5 py-3 mb-0 font-mono text-xs text-brand-medium-gray flex items-center gap-4 flex-wrap">
        <span>
          Quarter is <span className="text-brand-black">{Math.round(elapsed * 100)}% elapsed</span>
          {" "}({pacingCache.quarterStart} – {pacingCache.quarterEnd})
        </span>
        <span>·</span>
        <span>Pacing index = attainment ÷ elapsed — 100% = on linear track</span>
        <a
          href={pacingCache.hexThread}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-brand-medium-gray hover:text-brand-black underline underline-offset-2"
        >
          Source: Hex
        </a>
      </div>

      {/* Breakdown tabs */}
      <div className="bg-white border border-brand-black border-t-0">
        <div className="px-5 pt-4 pb-0 flex items-center gap-4 border-b border-brand-light-gray">
          <div className="flex gap-1">
            <Pill active={tab === "regions"} onClick={() => setTab("regions")}>By region</Pill>
            <Pill active={tab === "channels"} onClick={() => setTab("channels")}>By channel</Pill>
          </div>
          <div className="ml-auto flex gap-1">
            {(["mql", "sao", "pg"] as MetricKey[]).map(m => (
              <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
                {METRIC_LABELS[m]}
              </Pill>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-light-gray">
                <th className="text-left font-mono text-xs text-brand-medium-gray px-5 py-3">
                  {tab === "regions" ? "Region" : "Channel"}
                </th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">Actual</th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">Target</th>
                <th className="text-right font-mono text-xs text-brand-medium-gray px-3 py-3">Attainment</th>
                <th className="text-left font-mono text-xs text-brand-medium-gray px-5 py-3 w-48">Pace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const label = "region" in row ? row.region : (row as typeof pacingCache.channels[0]).channel
                const d = (row as any)[metric] as {
                  actual: number
                  target: number
                  attainment: number | null
                  pacingIndex: number | null
                }
                if (!d) return null
                const status = paceStatus(d.pacingIndex)
                return (
                  <tr
                    key={label}
                    className={`border-b border-brand-light-gray ${i % 2 !== 0 ? "bg-[#FAFAFA]" : ""}`}
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-brand-black align-middle">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(status)}`} />
                        {label}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-right text-brand-black tabular-nums align-middle">
                      {fmtN(d.actual, metric)}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-right text-brand-medium-gray tabular-nums align-middle">
                      {fmtN(d.target, metric)}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-right tabular-nums align-middle text-brand-black">
                      {d.attainment == null ? "—" : fmtPct(d.attainment)}
                    </td>
                    <td className="px-5 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        {d.attainment != null && (
                          <PacingBar attainment={d.attainment} elapsed={elapsed} />
                        )}
                        <span className="font-mono text-xs text-brand-black">
                          {d.pacingIndex != null ? `${fmtPct(d.pacingIndex)} pace` : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Forecast by region ─────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-brand-medium-gray mb-1">Forecast by region</p>
            <h2 className="text-xl tracking-tight">End-of-quarter projection</h2>
            <p className="text-brand-medium-gray text-sm mt-0.5">
              Linear run-rate to {pacingCache.quarterEnd} · if today's pace holds
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {(["mql", "sao", "pg"] as MetricKey[]).map(m => (
              <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
                {METRIC_LABELS[m]}
              </Pill>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {subRegions.map(r => {
            const d = r[metric]
            const forecastAtt = d.linearForecast / d.target
            const forecastStatus: PaceStatus =
              forecastAtt >= 1.0 ? "on-track" : forecastAtt >= 0.85 ? "at-risk" : "off-track"
            const wow = d.actual - d.actual7d
            const mom = d.actual - d.actual30d

            return (
              <div
                key={r.region}
                className="bg-white border border-brand-black p-5"
                style={{ borderLeft: `3px solid ${statusBorderColor(forecastStatus)}` }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(forecastStatus)}`} />
                  <span className="font-mono text-xs tracking-widest uppercase">{r.region}</span>
                </div>

                <p className="text-2xl tabular-nums tracking-tight leading-none mb-0.5">
                  {fmtN(d.linearForecast, metric)}
                </p>
                <p className="font-mono text-xs text-brand-medium-gray mb-1">
                  EoQ forecast
                </p>
                <p className="font-mono text-xs text-brand-medium-gray mb-4">
                  of {fmtN(d.target, metric)} target
                  <span className="ml-2 text-brand-black">{fmtPct(forecastAtt)}</span>
                </p>

                <div className="border-t border-brand-light-gray pt-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-brand-medium-gray">vs last week</span>
                    <span className="bg-brand-lime text-brand-black font-mono text-xs px-2 py-0.5">
                      +{fmtN(wow, metric)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-brand-medium-gray">vs 30 days ago</span>
                    <span className="bg-brand-lime text-brand-black font-mono text-xs px-2 py-0.5">
                      +{fmtN(mom, metric)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 font-mono text-xs text-brand-medium-gray">
          Last week = {pacingCache.forecast7dAsOf} · 30 days ago = {pacingCache.forecast30dAsOf} · forecast = actual ÷ {Math.round(elapsed * 100)}% elapsed
        </p>
      </section>

      {/* Footer */}
      <div className="mt-8 font-mono text-xs text-brand-medium-gray flex items-center gap-3">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-dark-green" />
        Data refreshed daily at 9 AM ET · source materialized{" "}
        {new Date(pacingCache.sourceRefreshedAt).toLocaleString("en-GB", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })} UTC
        <span className="ml-2">· validate with data science before sharing externally</span>
      </div>
    </div>
  )
}
