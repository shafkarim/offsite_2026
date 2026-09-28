import { usePlan } from "../store"
import { Decision } from "../types"

const DECISIONS: Decision[] = ["fund", "test", "stop", "re-plan"]

// Active chip styles per decision — color goes to background, never to text
const DC: Record<Decision, { label: string; active: string; inactive: string }> = {
  fund:      { label: "Fund",    active: "bg-brand-dark-green text-white border-brand-dark-green",     inactive: "text-brand-medium-gray bg-white border-brand-light-gray hover:border-brand-medium-gray" },
  test:      { label: "Test",    active: "bg-brand-maroon text-white border-brand-maroon",             inactive: "text-brand-medium-gray bg-white border-brand-light-gray hover:border-brand-medium-gray" },
  stop:      { label: "Stop",    active: "border-2 border-brand-hot-red text-brand-black bg-white",    inactive: "text-brand-medium-gray bg-white border-brand-light-gray hover:border-brand-medium-gray" },
  "re-plan": { label: "Re-plan", active: "bg-brand-blue text-white border-brand-blue",                 inactive: "text-brand-medium-gray bg-white border-brand-light-gray hover:border-brand-medium-gray" },
  pending:   { label: "Pending", active: "bg-brand-light-gray text-brand-black border-brand-light-gray", inactive: "text-brand-medium-gray bg-white border-brand-light-gray hover:border-brand-medium-gray" },
}

// Colored dot for each decision status in the legend
const LEGEND_DOT: Record<string, string> = {
  "Fund":    "bg-brand-dark-green",
  "Test":    "bg-brand-maroon",
  "Stop":    "bg-brand-hot-red",
  "Re-plan": "bg-brand-blue",
}

function GapBar({ target, engine, bets, prefix, unit }: {
  target: number; engine: number; bets: number; prefix: string; unit: string
}) {
  if (target === 0) return null
  const ep = Math.min((engine / target) * 100, 100)
  const bp = Math.min((bets / target) * 100, Math.max(0, 100 - ep))
  const gp = Math.max(100 - ep - bp, 0)
  const gap = Math.max(target - engine - bets, 0)

  return (
    <div className="flex h-11 overflow-hidden border border-brand-black bg-white font-mono text-xs select-none">
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
          {gap > 0 && <span>{prefix}{gap}{unit}</span>}
        </div>
      )}
      {gp <= 0.5 && engine + bets > 0 && (
        <div className="h-full w-1 bg-brand-dark-green shrink-0" title="Coverage complete" />
      )}
    </div>
  )
}

export default function PortfolioView() {
  const { state, dispatch, engineTotal, betsTotal, gap, gapPct, computedDecision } = usePlan()

  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">FY27 portfolio view</p>
        <h1 className="text-5xl tracking-tight mb-3">One number. Engine plus bets.</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          The engine has operating history, so it forecasts. Bets have hypotheses, so they range.
          Both have to add up to the target before anything gets funded.
        </p>
      </div>

      <div className="flex items-center gap-6 mb-10 font-mono text-xs text-brand-medium-gray">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-brand-black inline-block shrink-0" />
          Engine forecast
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-brand-medium-gray inline-block shrink-0" />
          Bets, planning case
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border border-dashed border-brand-medium-gray inline-block shrink-0" />
          Gap still open
        </span>
      </div>

      <div className="space-y-6">
        {state.outcomes.map(outcome => {
          const eng = engineTotal(outcome.id)
          const bts = betsTotal(outcome.id)
          const gp = gap(outcome.id)
          const pct = gapPct(outcome.id)
          const decision = computedDecision(outcome.id)
          const bets = state.bets.filter(b => b.outcomeId === outcome.id)
          const totalPrice = bets.reduce((s, b) => s + (b.price || 0), 0)
          const rl = bets.reduce((s, b) => s + (b.rangeLow || 0), 0)
          const rh = bets.reduce((s, b) => s + (b.rangeHigh || 0), 0)
          const programs = state.programs.filter(p => p.outcomeId === outcome.id)
          const hasLowConf = programs.some(p => p.confidence === "low")
          const fmt = (n: number) => `${outcome.prefix}${n}${outcome.unit}`

          return (
            <div key={outcome.id} className="bg-white border border-brand-black">
              <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray">
                <h2 className="text-[17px]">{outcome.name}</h2>
                <span className="font-mono text-sm text-brand-medium-gray">Target {fmt(outcome.target)}</span>
              </div>

              <div className="px-6 pt-5 pb-2">
                <GapBar
                  target={outcome.target}
                  engine={eng}
                  bets={bts}
                  prefix={outcome.prefix}
                  unit={outcome.unit}
                />
              </div>

              <div className="px-6 pt-2 pb-4 font-mono text-xs text-brand-medium-gray flex flex-wrap gap-x-5 gap-y-1">
                <span>
                  {fmt(eng)} engine
                  {hasLowConf && (
                    <span className="ml-1.5 bg-brand-lime text-brand-black px-1.5 py-0.5">low confidence</span>
                  )}
                </span>
                {bts > 0 && (
                  <span>
                    {fmt(bts)} bets, planning case · range {outcome.prefix}{rl}–{rh}{outcome.unit}
                  </span>
                )}
                {totalPrice > 0 && <span>Price ${totalPrice.toFixed(1)}M</span>}
              </div>

              <div className="px-6 pb-5 flex items-end justify-between border-t border-brand-light-gray pt-4">
                <div>
                  <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-1.5">Gap</p>
                  <p className="text-3xl tracking-tight">
                    {gp > 0 ? fmt(gp) : "Covered"}
                  </p>
                  {gp > 0 && (
                    <p className="font-mono text-xs text-brand-medium-gray mt-1.5">{pct.toFixed(0)}% of target uncovered</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-2">Decision</p>
                  <div className="flex items-center gap-1">
                    {DECISIONS.map(dec => {
                      const isActive = decision === dec
                      return (
                        <button
                          key={dec}
                          onClick={() => dispatch({
                            type: "SET_DECISION",
                            outcomeId: outcome.id,
                            decision: outcome.decisionOverride === dec ? undefined : dec,
                          })}
                          className={`px-2.5 py-1 text-xs font-mono border transition-colors ${
                            isActive ? DC[dec].active : DC[dec].inactive
                          }`}
                        >
                          {DC[dec].label}
                        </button>
                      )
                    })}
                  </div>
                  {outcome.decisionOverride && (
                    <button
                      onClick={() => dispatch({ type: "SET_DECISION", outcomeId: outcome.id, decision: undefined })}
                      className="font-mono text-xs text-brand-medium-gray hover:text-brand-black mt-1.5 transition-colors"
                    >
                      ← use suggested
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-brand-black font-mono text-xs text-brand-medium-gray grid grid-cols-2 gap-x-8 gap-y-2">
        {[
          ["Fund", "Fund — case credible, coverage holds"],
          ["Test", "Test — evidence needed before full funding"],
          ["Stop", "Stop — a decision rule has already been missed"],
          ["Re-plan", "Re-plan — gap too wide or measurement too weak"],
        ].map(([label, desc]) => (
          <span key={label} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${LEGEND_DOT[label]}`} />
            {desc}
          </span>
        ))}
      </div>
    </div>
  )
}
