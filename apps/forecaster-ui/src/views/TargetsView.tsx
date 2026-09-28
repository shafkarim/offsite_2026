import { useEffect, useState } from "react"

import { useAdmin } from "../admin"
import { usePacing } from "../pacing"
import { getPayloadValue, setPayloadValue } from "../payload"
import { usePlan } from "../store"

const MULTIPLIER_KEY = "fy27_multiplier"

function fmtMetric(value: number | null, metric: "mql" | "sao" | "pg") {
  if (value == null) return "—"
  if (metric === "pg") return `$${(value / 1_000_000).toFixed(1)}M`
  return Math.round(value).toLocaleString()
}

export default function TargetsView() {
  const { data, mode, message } = usePacing()
  const { dispatch } = usePlan()
  const { isAdmin } = useAdmin()
  const [multiplier, setMultiplier] = useState(1.1)
  const [metric, setMetric] = useState<"pg" | "mql" | "sao">("pg")
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    getPayloadValue<{ multiplier?: number }>(MULTIPLIER_KEY, {})
      .then((saved) => { if (saved.multiplier) setMultiplier(saved.multiplier) })
  }, [])

  if (mode !== "live") {
    return (
      <div role={mode === "loading" ? "status" : "alert"} className="max-w-3xl rounded-xl border border-brand-hot-red/50 bg-white p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Live Hex data required</p>
        <h1 className="mt-2 text-3xl">Target baseline is unavailable</h1>
        <p className="mt-3 text-sm text-brand-medium-gray">{message} No bundled target or historical snapshot is substituted.</p>
      </div>
    )
  }

  const source = data.fy[metric]
  const impliedTarget = source.fullYearForecast * multiplier

  async function updateMultiplier(value: number) {
    setMultiplier(value)
    if (isAdmin) await setPayloadValue(MULTIPLIER_KEY, { multiplier: value })
  }

  function applyTarget() {
    dispatch({ type: "UPDATE_TARGET", outcomeId: "pipeline", target: impliedTarget / 1_000_000 })
    setApplied(true)
    window.setTimeout(() => setApplied(false), 2000)
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Plan · Targets</p>
        <h1 className="mb-3 text-4xl leading-none tracking-tight sm:text-5xl">Set the next planning target</h1>
        <p className="max-w-2xl text-base leading-relaxed text-brand-medium-gray">Start from the live semantic-approved Hex forecast, then apply an explicit planning multiplier. The saved multiplier and approved plan are shared in Payload.</p>
      </div>

      <div className="mb-6 grid gap-px overflow-hidden rounded-2xl border border-brand-black bg-brand-black md:grid-cols-3">
        <div className="bg-white p-6"><p className="font-mono text-xs uppercase text-brand-medium-gray">Current target</p><p className="mt-3 text-3xl">{fmtMetric(source.target, metric)}</p></div>
        <div className="bg-white p-6"><p className="font-mono text-xs uppercase text-brand-medium-gray">Full-year forecast</p><p className="mt-3 text-3xl">{fmtMetric(source.fullYearForecast, metric)}</p></div>
        <div className="bg-brand-lime p-6"><p className="font-mono text-xs uppercase">Proposed next target</p><p className="mt-3 text-3xl">{fmtMetric(impliedTarget, metric)}</p></div>
      </div>

      <section className="mb-6 rounded-2xl border border-brand-light-gray bg-white p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div><p className="font-mono text-xs uppercase text-brand-medium-gray">Planning control</p><h2 className="mt-1 text-2xl">Live baseline × multiplier</h2></div>
          <div className="flex gap-2" role="group" aria-label="Metric">
            {(["pg", "mql", "sao"] as const).map((value) => <button key={value} onClick={() => setMetric(value)} aria-pressed={metric === value} className={`min-h-11 rounded-md px-4 font-mono text-xs uppercase ${metric === value ? "bg-brand-black text-white" : "border border-brand-light-gray"}`}>{value === "pg" ? "Pipeline" : value.toUpperCase()}</button>)}
          </div>
        </div>
        <label className="block max-w-xl"><span className="mb-2 flex justify-between text-sm"><span>Multiplier</span><strong>{multiplier.toFixed(2)}×</strong></span><input type="range" min="0.8" max="1.5" step="0.01" value={multiplier} disabled={!isAdmin} onChange={(event) => void updateMultiplier(Number(event.target.value))} className="w-full" /></label>
        <p className="mt-3 text-xs text-brand-medium-gray">Only contributors and approvers can change the shared planning multiplier.</p>
        {metric === "pg" && <button onClick={applyTarget} disabled={!isAdmin} className="mt-5 min-h-11 rounded-md bg-brand-black px-5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{applied ? "Applied to shared plan" : "Apply proposed pipeline target"}</button>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-light-gray bg-white">
        <div className="border-b border-brand-light-gray p-5"><p className="font-mono text-xs uppercase text-brand-medium-gray">Regional live view · {data.quarter}</p><h2 className="mt-1 text-xl">Current-quarter target and delivery</h2></div>
        <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-brand-light-gray/60"><tr><th className="px-5 py-3">Region</th><th className="px-5 py-3 text-right">Actual</th><th className="px-5 py-3 text-right">Target</th><th className="px-5 py-3 text-right">Attainment</th><th className="px-5 py-3 text-right">Pace</th></tr></thead><tbody className="divide-y divide-brand-light-gray">{data.regions.map((row) => { const values = row[metric]; return <tr key={row.region}><th scope="row" className="px-5 py-4">{row.region}</th><td className="px-5 py-4 text-right font-mono">{fmtMetric(values.actual, metric)}</td><td className="px-5 py-4 text-right font-mono">{fmtMetric(values.target, metric)}</td><td className="px-5 py-4 text-right font-mono">{values.attainment == null ? "—" : `${Math.round(values.attainment * 100)}%`}</td><td className="px-5 py-4 text-right font-mono">{values.pacingIndex == null ? "—" : `${Math.round(values.pacingIndex * 100)}%`}</td></tr> })}</tbody></table></div>
      </section>

      <p className="mt-4 text-xs text-brand-medium-gray">Source: {data.sourceTable} · data through {data.asOf}. This page never reads the retired local target snapshot.</p>
    </div>
  )
}
