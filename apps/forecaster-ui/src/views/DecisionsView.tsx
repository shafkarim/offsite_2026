import { usePlan } from "../store"
import { usePacing } from "../pacing"

type Destination = "engine" | "pacing" | "bets" | "methodology" | "data-health"

interface DecisionItem {
  id: string
  status: "needs-decision" | "monitor" | "decided"
  title: string
  question: string
  evidence: string
  owner: string
  destination: Destination
  action: string
}

const STATUS: Record<DecisionItem["status"], { label: string; style: string }> = {
  "needs-decision": { label: "Needs decision", style: "border-l-2 border-brand-hot-red bg-brand-light-gray/30" },
  monitor: { label: "Monitor", style: "bg-brand-dusty-violet" },
  decided: { label: "Decided", style: "bg-brand-lime" },
}

export default function DecisionsView({ onNavigate }: { onNavigate: (view: Destination) => void }) {
  const { state } = usePlan()
  const { data: pacingCache, mode: pacingMode, dataThrough } = usePacing()
  const mql = pacingCache.fy.mql
  const mqlGap = Math.max(0, mql.target - mql.fullYearForecast)
  const latam = pacingCache.regions.find(region => region.region === "LATAM")
  const items: DecisionItem[] = [
    {
      id: "mql-recovery",
      status: "needs-decision",
      title: "FY26 MQL recovery plan",
      question: `Which committed actions will close the ${mqlGap.toLocaleString()} MQL baseline gap?`,
      evidence: `${Math.round((mql.fullYearForecast / mql.target) * 100)}% forecast attainment · ${mql.fullYearForecast.toLocaleString()} of ${mql.target.toLocaleString()} MQL`,
      owner: "Unassigned",
      destination: "engine",
      action: "Review drivers",
    },
    {
      id: "latam-recovery",
      status: "needs-decision",
      title: "LATAM intervention",
      question: "Reallocate activity or explicitly accept the regional shortfall?",
      evidence: `${Math.round((latam?.mql.pacingIndex ?? 0) * 100)}% Q3 MQL pace · ${Math.round((latam?.mql.attainment ?? 0) * 100)}% target attained · ${pacingMode === "live" ? "live" : "snapshot"} through ${dataThrough}`,
      owner: "Regional leadership",
      destination: "pacing",
      action: "Review pacing",
    },
    {
      id: "support-leads-definition",
      status: "needs-decision",
      title: "Support Leads source contract",
      question: "Which Q3 population and cutoff should control the Support Leads baseline?",
      evidence: "Reconciliation must come from the semantic-approved Hex output; no static extract is substituted.",
      owner: "Support Ops + Marketing Ops",
      destination: "data-health",
      action: "Review evidence",
    },
    {
      id: "bet-allocation",
      status: state.bets.length > 0 ? "monitor" : "needs-decision",
      title: "Incremental investment portfolio",
      question: state.bets.length > 0 ? `Review ${state.bets.length} active planning bet${state.bets.length === 1 ? "" : "s"} against the remaining gap.` : "No incremental bets are recorded. Is the baseline recovery plan sufficient?",
      evidence: state.bets.length > 0 ? `${state.bets.filter(bet => bet.status === "fund").length} funded · ${state.bets.filter(bet => bet.status === "test").length} in test` : "No funded or test-stage bets in the shared plan",
      owner: "Marketing leadership",
      destination: "bets",
      action: "Open bets",
    },
  ]

  return <div>
    <div className="mb-8">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Workspace · Decisions</p>
      <h1 className="mb-3 text-4xl leading-none tracking-tight sm:text-5xl">Make the trade-offs explicit</h1>
      <p className="max-w-2xl text-base leading-relaxed text-brand-medium-gray">A decision register keeps evidence, ownership, and the next review together. Items remain proposals until an accountable approver records a decision.</p>
    </div>

    <div className="mb-8 grid gap-px overflow-hidden rounded-2xl border border-brand-black bg-brand-black sm:grid-cols-3">
      <div className="bg-white p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Needs decision</p><p className="mt-4 text-4xl tracking-tight">{items.filter(item => item.status === "needs-decision").length}</p></div>
      <div className="bg-white p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Monitoring</p><p className="mt-4 text-4xl tracking-tight">{items.filter(item => item.status === "monitor").length}</p></div>
      <div className="bg-white p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Recorded decisions</p><p className="mt-4 text-4xl tracking-tight">{items.filter(item => item.status === "decided").length}</p></div>
    </div>

    <div className="space-y-3">{items.map((item, index) => <article key={item.id} className="grid gap-5 rounded-2xl border border-brand-light-gray bg-white p-5 md:grid-cols-[38px_minmax(0,1fr)_150px] md:items-center xl:grid-cols-[54px_minmax(0,1fr)_180px_150px] xl:gap-6"><span className="font-mono text-xs text-brand-medium-gray">{String(index + 1).padStart(2, "0")}</span><div><div className="mb-3 flex flex-wrap items-center gap-3"><span className={`px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${STATUS[item.status].style}`}>{STATUS[item.status].label}</span><h2 className="text-lg">{item.title}</h2></div><p className="text-sm text-brand-black">{item.question}</p><p className="mt-2 font-mono text-[10px] text-brand-medium-gray">{item.evidence}</p></div><div className="md:col-start-3 md:row-start-1 xl:col-auto xl:row-auto"><p className="font-mono text-[9px] uppercase tracking-widest text-brand-medium-gray">Decision owner</p><p className="mt-2 text-sm">{item.owner}</p></div><button onClick={() => onNavigate(item.destination)} className="rounded-lg border border-brand-black px-3 py-2.5 text-sm hover:bg-brand-black hover:text-white md:col-start-2 md:justify-self-start xl:col-auto xl:row-auto xl:justify-self-stretch">{item.action} →</button></article>)}</div>

    <div className="mt-8 border-l-2 border-brand-blue bg-white px-5 py-4"><p className="text-sm">Shared planning is active in staging</p><p className="mt-1 text-xs leading-relaxed text-brand-medium-gray">Payload stores the shared plan and user roles. Forecast evidence still comes only from live Asana and semantic-approved Hex outputs; unavailable evidence remains visibly blocked.</p></div>
  </div>
}
