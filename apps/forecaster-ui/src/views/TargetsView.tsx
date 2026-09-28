import { useState, useEffect } from "react"
import { usePlan } from "../store"
import { useAdmin } from "../admin"
import { getPayloadValue, setPayloadValue } from "../payload"

const REGIONS = ["AMER", "EMEA", "APAC", "JAPAN", "LATAM"] as const
type Region = (typeof REGIONS)[number]

interface QData { pg: number; mql: number; sao: number }

const FY26: Record<Region, { Q1: QData; Q2: QData; Q3: QData }> = {
  AMER:  { Q1: { pg:  4.10, mql: 4616, sao: 459 }, Q2: { pg:  4.19, mql: 8253, sao: 463 }, Q3: { pg:  5.35, mql: 7122, sao: 382 } },
  EMEA:  { Q1: { pg:  4.47, mql: 5837, sao: 449 }, Q2: { pg:  4.51, mql: 5642, sao: 478 }, Q3: { pg:  4.61, mql: 5004, sao: 318 } },
  APAC:  { Q1: { pg:  2.18, mql: 2783, sao: 174 }, Q2: { pg:  1.85, mql: 1774, sao: 116 }, Q3: { pg:  2.02, mql: 2766, sao: 114 } },
  JAPAN: { Q1: { pg:  1.18, mql:  923, sao: 139 }, Q2: { pg:  1.24, mql: 1242, sao:  87 }, Q3: { pg:  1.81, mql:  885, sao: 114 } },
  LATAM: { Q1: { pg:  1.51, mql: 1860, sao: 190 }, Q2: { pg:  1.26, mql: 2109, sao: 152 }, Q3: { pg:  1.34, mql: 2213, sao: 149 } },
}

function regionSum(r: Region): QData {
  const d = FY26[r]
  return {
    pg:  d.Q1.pg  + d.Q2.pg  + d.Q3.pg,
    mql: d.Q1.mql + d.Q2.mql + d.Q3.mql,
    sao: d.Q1.sao + d.Q2.sao + d.Q3.sao,
  }
}

function annualised(pg: number) { return pg * 4 / 3 }

function totalFY26PG() {
  return REGIONS.reduce((s, r) => s + regionSum(r).pg, 0)
}

function impliedFY27(multiplier: number) {
  return Math.round(annualised(totalFY26PG()) * multiplier * 10) / 10
}

function fmtM(n: number) { return `$${n.toFixed(1)}M` }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)) }

const MULTIPLIER_KEY = "fy27_multiplier"

export default function TargetsView() {
  const { state, dispatch } = usePlan()
  const { isAdmin } = useAdmin()
  const [multiplier, setMultiplier] = useState(1.1)
  const [applied, setApplied] = useState(false)
  const [metric, setMetric] = useState<"pg" | "mql" | "sao">("pg")

  useEffect(() => {
    getPayloadValue<{ multiplier?: number }>(MULTIPLIER_KEY, {})
      .then(data => { if (data.multiplier) setMultiplier(data.multiplier) })
  }, [])

  async function handleMultiplier(val: number) {
    setMultiplier(val)
    if (isAdmin) {
      await setPayloadValue(MULTIPLIER_KEY, { multiplier: val })
    }
  }

  function applyToTarget() {
    const next = impliedFY27(multiplier)
    dispatch({ type: "UPDATE_TARGET", outcomeId: "pipeline", target: next })
    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }

  const pipelineOutcome = state.outcomes.find(o => o.id === "pipeline")
  const fy27Total = impliedFY27(multiplier)

  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">01 · What marketing owes</p>
        <h1 className="text-5xl tracking-tight mb-3">Start with what marketing owes</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          FY26 regional targets are the baseline. Apply a multiplier to set FY27.
        </p>
      </div>

      {/* FY27 target card */}
      <div className="bg-white border border-brand-black mb-6">
        {/* Header: calculator output */}
        <div className="border-b border-brand-light-gray">
          <div className="px-8 py-8">
            <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-widest mb-3">Implied target · calculator</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl text-brand-light-gray">$</span>
              <span className="text-5xl">{fy27Total.toFixed(1)}</span>
              <span className="text-5xl text-brand-light-gray">M</span>
            </div>
            <p className="font-mono text-xs text-brand-medium-gray mt-2">
              FY26 Q1–Q3 annualised × {multiplier.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Multiplier control */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider">FY27 growth multiplier</p>
            <span className="font-mono text-sm">
              {multiplier.toFixed(2)}×
              <span className="font-mono text-xs text-brand-medium-gray ml-2">
                ({multiplier >= 1 ? "+" : ""}{((multiplier - 1) * 100).toFixed(0)}% YoY)
              </span>
            </span>
          </div>
          <input
            type="range"
            min={0.8}
            max={2.0}
            step={0.05}
            value={multiplier}
            onChange={e => handleMultiplier(parseFloat(e.target.value))}
            disabled={!isAdmin}
            className="w-full accent-brand-black mb-1"
          />
          <div className="flex justify-between font-mono text-xs text-brand-medium-gray mb-6">
            <span>0.80×</span>
            <span>1.00×</span>
            <span>1.50×</span>
            <span>2.00×</span>
          </div>
          {!isAdmin && pipelineOutcome && Math.abs(pipelineOutcome.target - fy27Total) > 0.05 && (
            <p className="font-mono text-xs text-brand-medium-gray mb-4">
              The plan target (${pipelineOutcome.target}M) differs from the calculator (${fy27Total}M). Admin access required to sync them.
            </p>
          )}
          {isAdmin && (
            <div className="flex items-center gap-4">
              <button
                onClick={applyToTarget}
                disabled={!pipelineOutcome || Math.abs((pipelineOutcome?.target ?? 0) - fy27Total) <= 0.05}
                className="px-5 py-2 bg-brand-black text-white text-sm hover:bg-brand-maroon transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Sync plan target to calculator
              </button>
              {applied && (
                <span className="bg-brand-lime text-brand-black font-mono text-xs px-2 py-0.5">
                  Plan target updated
                </span>
              )}
              <span className="font-mono text-xs text-brand-medium-gray ml-auto">Multiplier shared across all users</span>
            </div>
          )}
        </div>
      </div>

      {/* Regional breakdown table */}
      <div className="bg-white border border-brand-black">
        <div className="px-6 py-4 border-b border-brand-light-gray flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-0.5">FY26 marketing-attributed actuals · Q1–Q3</p>
            <p className="font-mono text-xs text-brand-light-gray">Q4 FY26 pending · LATAM added FY26</p>
          </div>
          <div className="flex gap-1">
            {(["pg", "mql", "sao"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`font-mono text-xs px-3 py-1.5 border transition-colors ${
                  metric === m
                    ? "bg-brand-black text-white border-brand-black"
                    : "text-brand-medium-gray border-brand-light-gray hover:border-brand-medium-gray"
                }`}
              >
                {m === "pg" ? "Pipeline" : m === "mql" ? "MQL" : "SAO"}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-light-gray">
              <th className="text-left font-mono text-xs text-brand-medium-gray px-6 py-3">Region</th>
              <th className="text-right font-mono text-xs text-brand-medium-gray px-4 py-3">Q1 FY26</th>
              <th className="text-right font-mono text-xs text-brand-medium-gray px-4 py-3">Q2 FY26</th>
              <th className="text-right font-mono text-xs text-brand-medium-gray px-4 py-3">Q3 FY26</th>
              <th className="text-right font-mono text-xs text-brand-medium-gray px-4 py-3">3Q total</th>
              <th className="text-right font-mono text-xs text-brand-medium-gray px-4 py-3">Annualised</th>
              <th className="text-right font-mono text-xs text-brand-medium-gray px-6 py-3">FY27 target</th>
            </tr>
          </thead>
          <tbody>
            {REGIONS.map(region => {
              const d = FY26[region]
              const sum = regionSum(region)
              const ann = annualised(sum.pg)
              const fy27 = Math.round(ann * multiplier * 10) / 10

              const cell = (q: QData) => metric === "pg" ? fmtM(q.pg) : metric === "mql" ? fmtK(q.mql) : fmtK(q.sao)
              const sumVal = metric === "pg" ? fmtM(sum.pg) : metric === "mql" ? fmtK(sum.mql) : fmtK(sum.sao)
              const annVal = metric === "pg" ? fmtM(ann) : "—"

              return (
                <tr key={region} className="border-b border-brand-light-gray hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-brand-black">{region}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-medium-gray text-right">{cell(d.Q1)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-medium-gray text-right">{cell(d.Q2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-medium-gray text-right">{cell(d.Q3)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-black text-right">{sumVal}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-medium-gray text-right">{annVal}</td>
                  <td className="px-6 py-3 font-mono text-sm text-brand-black text-right">
                    {metric === "pg" ? fmtM(fy27) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-brand-light-gray bg-[#FAFAFA]">
              <td className="px-6 py-3 font-mono text-xs text-brand-black">Total</td>
              {["Q1", "Q2", "Q3"].map(q => {
                const total = REGIONS.reduce((s, r) => {
                  const qd = FY26[r][q as "Q1"|"Q2"|"Q3"]
                  return s + (metric === "pg" ? qd.pg : metric === "mql" ? qd.mql : qd.sao)
                }, 0)
                return (
                  <td key={q} className="px-4 py-3 font-mono text-xs text-brand-black text-right">
                    {metric === "pg" ? fmtM(total) : fmtK(total)}
                  </td>
                )
              })}
              <td className="px-4 py-3 font-mono text-xs text-brand-black text-right">
                {metric === "pg" ? fmtM(totalFY26PG()) : metric === "mql" ? fmtK(REGIONS.reduce((s, r) => s + regionSum(r).mql, 0)) : fmtK(REGIONS.reduce((s, r) => s + regionSum(r).sao, 0))}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-brand-medium-gray text-right">
                {metric === "pg" ? fmtM(annualised(totalFY26PG())) : "—"}
              </td>
              <td className="px-6 py-3 font-mono text-sm text-brand-black text-right">
                {metric === "pg" ? fmtM(fy27Total) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="font-mono text-xs text-brand-medium-gray mt-4">
        Sub-regional targets will be added here. Revenue targets are out of scope for this tool.
      </p>
    </div>
  )
}
