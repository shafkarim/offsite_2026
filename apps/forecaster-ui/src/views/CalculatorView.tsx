import { useState } from "react"
import { usePlan } from "../store"

type AutoDecision = "fund" | "test" | "re-plan"

const DC: Record<AutoDecision, { label: string; desc: string }> = {
  fund: {
    label: "Fund",
    desc: "A gap this size can reasonably be addressed through bets. Fund the credible cases, and either close the remainder or accept the risk explicitly.",
  },
  test: {
    label: "Test",
    desc: "The opportunity may be sound but the gap is material. Define what evidence is needed before committing full funding, and by when.",
  },
  "re-plan": {
    label: "Re-plan",
    desc: "The gap is too wide for bets to close, or the measurement is too weak to judge. A more fundamental conversation about the target, baseline, or investment level is needed.",
  },
}

// Decision status chip colors — color to background, never to text
const DC_STATUS: Record<AutoDecision, string> = {
  fund:      "bg-brand-dark-green text-white",
  test:      "bg-brand-maroon text-white",
  "re-plan": "bg-brand-blue text-white",
}

// Legend dot colors for decision cards
const LEGEND_DOT: Record<string, string> = {
  "Fund":    "bg-brand-dark-green",
  "Test":    "bg-brand-maroon",
  "Stop":    "bg-brand-hot-red",
  "Re-plan": "bg-brand-blue",
}

const DECISION_CARDS = [
  { label: "Fund",    desc: "The case is credible and the coverage holds." },
  { label: "Test",    desc: "Evidence not yet strong enough to fund the full bet. Define what evidence is needed, and by when." },
  { label: "Stop",    desc: "A decision rule has already been missed." },
  { label: "Re-plan", desc: "The gap is too wide for bets to close, or the measurement is too weak to judge." },
]

function autoDecide(pct: number): AutoDecision {
  if (pct <= 10) return "fund"
  if (pct <= 30) return "test"
  return "re-plan"
}

export default function CalculatorView() {
  const { state, engineTotal, betsTotal } = usePlan()
  const [outcomeId, setOutcomeId] = useState(state.outcomes[0]?.id || "")

  const outcome = state.outcomes.find(o => o.id === outcomeId) || state.outcomes[0]
  const [target, setTarget] = useState(outcome?.target || 120)
  const [engine, setEngine] = useState(() => engineTotal(state.outcomes[0]?.id || ""))
  const [bets, setBets] = useState(() => betsTotal(state.outcomes[0]?.id || ""))

  const handleOutcomeChange = (id: string) => {
    setOutcomeId(id)
    const o = state.outcomes.find(o => o.id === id)
    if (o) {
      setTarget(o.target)
      setEngine(engineTotal(id))
      setBets(betsTotal(id))
    }
  }

  const gap = Math.max(target - engine - bets, 0)
  const pct = target > 0 ? (gap / target) * 100 : 0
  const decision = autoDecide(pct)
  const d = DC[decision]
  const covered = engine + bets >= target

  const ep = target > 0 ? Math.min((engine / target) * 100, 100) : 0
  const bp = target > 0 ? Math.min((bets / target) * 100, Math.max(0, 100 - ep)) : 0
  const gp = Math.max(100 - ep - bp, 0)

  const prefix = outcome?.prefix || "$"
  const unit = outcome?.unit || "M"

  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">04 · Try the logic</p>
        <h1 className="text-5xl tracking-tight mb-3">Where does your plan land?</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          Move the inputs. The gap and the decision follow from them, which is the entire point.
        </p>
      </div>

      <div className="bg-white border border-brand-black">
        <div className="px-8 py-5 border-b border-brand-light-gray flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-brand-medium-gray mb-1">Coverage and decision</p>
            <p className="text-sm text-brand-medium-gray">
              One outcome, in {unit}. The engine forecasts, bets range, the gap is what is left.
            </p>
          </div>
          <select
            value={outcomeId}
            onChange={e => handleOutcomeChange(e.target.value)}
            className="border border-brand-light-gray px-3 py-1.5 text-sm focus:outline-none focus:border-brand-black bg-white"
          >
            {state.outcomes.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className="px-8 py-6 space-y-5">
          {[
            { label: "Target", value: target, set: setTarget },
            { label: "Engine forecast", value: engine, set: setEngine },
            { label: "Bets, planning case", value: bets, set: setBets },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center justify-between border-b border-brand-light-gray pb-5 last:border-0 last:pb-0">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-brand-medium-gray">{prefix}</span>
                <input
                  type="number"
                  value={value}
                  onChange={e => set(parseFloat(e.target.value) || 0)}
                  className="border border-brand-light-gray px-3 py-1.5 text-sm font-mono w-24 text-right focus:outline-none focus:border-brand-black bg-white"
                />
                <span className="font-mono text-sm text-brand-medium-gray w-6">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-8 pb-6 space-y-3">
          <div className="flex h-12 overflow-hidden border border-brand-black bg-white font-mono text-xs">
            {ep > 0 && (
              <div
                className="h-full bg-brand-black text-white flex items-center px-3 overflow-hidden shrink-0 transition-all duration-300"
                style={{ width: `${ep}%` }}
              >
                <span className="truncate">{prefix}{engine}{unit} engine</span>
              </div>
            )}
            {bp > 0 && (
              <div
                className="h-full bg-brand-medium-gray text-white flex items-center px-3 overflow-hidden shrink-0 transition-all duration-300"
                style={{ width: `${bp}%` }}
              >
                <span className="truncate">{prefix}{bets}{unit} bets</span>
              </div>
            )}
            {gp > 0.5 && (
              <div className="h-full flex items-center px-3 text-brand-medium-gray border-l border-dashed border-brand-light-gray flex-1 transition-all duration-300">
                {gap > 0 && <span>{prefix}{gap}{unit} gap</span>}
              </div>
            )}
            {covered && gp <= 0.5 && (
              <div className="h-full w-2 bg-brand-dark-green shrink-0 ml-auto" />
            )}
          </div>

          <div className="flex items-center gap-5 font-mono text-xs text-brand-medium-gray">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-brand-black inline-block shrink-0" /> Engine</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-brand-medium-gray inline-block shrink-0" /> Bets</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 border border-dashed border-brand-medium-gray inline-block shrink-0" /> Gap</span>
            {covered && (
              <span className="ml-2 bg-brand-lime text-brand-black font-mono text-xs px-2 py-0.5">
                Coverage complete
              </span>
            )}
          </div>
        </div>

        <div className="px-8 py-6 border-t border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray mb-3 uppercase tracking-wider">Decision</p>
          <div className="flex items-center gap-3 mb-3">
            <span className={`font-mono text-xs px-3 py-1.5 ${DC_STATUS[decision]}`}>
              {d.label}
            </span>
          </div>
          <p className="text-sm text-brand-medium-gray leading-relaxed max-w-lg">{d.desc}</p>
          {gap > 0 && (
            <p className="font-mono text-xs text-brand-medium-gray mt-3">
              Gap {prefix}{gap}{unit} · {pct.toFixed(0)}% of target uncovered
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {DECISION_CARDS.map(card => (
          <div key={card.label} className="bg-white border border-brand-black px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${LEGEND_DOT[card.label]}`} />
              <span className="text-sm">{card.label}</span>
            </div>
            <p className="text-xs text-brand-medium-gray leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white border border-brand-black px-6 py-5">
        <p className="font-mono text-xs text-brand-medium-gray mb-2">This decision is not made once.</p>
        <p className="text-sm text-brand-medium-gray leading-relaxed max-w-xl">
          At each review, updated evidence can cause us to fund, test, stop or re-plan.
          Which is what makes the decision rules worth writing down.
        </p>
        <p className="font-mono text-xs text-brand-medium-gray mt-3">
          Fund → Test → Stop → Re-plan ↺
        </p>
      </div>
    </div>
  )
}
