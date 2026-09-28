import { useState } from "react"
import { usePlan } from "../store"
import { Bet, Decision, Outcome } from "../types"

// Color goes to chip background, not type
const STATUS_STYLES: Record<Decision, string> = {
  fund:      "bg-brand-dark-green text-white border-brand-dark-green",
  test:      "bg-brand-maroon text-white border-brand-maroon",
  stop:      "border-2 border-brand-hot-red text-brand-black bg-white",
  "re-plan": "bg-brand-blue text-white border-brand-blue",
  pending:   "bg-brand-light-gray text-brand-black border-brand-light-gray",
}

const REGIONS = ["AMER", "EMEA", "APAC", "JAPAN", "LATAM", "Global"]
const QUARTERS = ["Q1 FY27", "Q2 FY27", "Q3 FY27", "Q4 FY27"]
const CHANNELS = ["Webinar", "IRL Event", "Paid", "Social", "Email", "Content", "PR", "Sponsorship", "ABM", "Partner", "SDR", "Other"]
const LANGUAGES = ["English", "Japanese", "German", "French", "Spanish", "Portuguese", "Korean", "Chinese (Simplified)", "Multi-language"]
const PRODUCTS = ["Figma Design", "FigJam", "Dev Mode", "Slides", "Enterprise", "Multi-product"]
const SEGMENTS = ["Enterprise", "Mid-Market", "SMB", "Strategic", "All"]
const uid = () => Math.random().toString(36).slice(2, 9)

function emptyBet(outcomeId: string): Bet {
  return {
    id: uid(), outcomeId, name: "", region: "", quarter: "", owner: "",
    rangeLow: 0, rangeHigh: 0, planningCase: 0, price: 0,
    capacity: "", hypothesis: "", comparable: "", decisionRule: "", status: "pending",
  }
}

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div>
      <label className="font-mono text-xs text-brand-medium-gray block mb-2">{label}</label>
      {children}
      {hint && <p className="font-mono text-xs text-brand-medium-gray mt-2 leading-relaxed">{hint}</p>}
    </div>
  )
}

const INPUT = "w-full border border-brand-light-gray px-4 py-3 text-sm focus:outline-none focus:border-brand-black bg-white rounded-sm"
const SELECT = "w-full border border-brand-light-gray px-4 py-3 text-sm focus:outline-none focus:border-brand-black bg-white rounded-sm appearance-none"

interface ProposeBetFormProps {
  draft: Bet
  setDraft: (b: Bet) => void
  outcomes: Outcome[]
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  saveLabel: string
}

function ProposeBetForm({ draft, setDraft, outcomes, onSave, onCancel, onDelete, saveLabel }: ProposeBetFormProps) {
  const num = (key: keyof Bet) => (draft[key] as number) || ""
  const set = (key: keyof Bet) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [key]: e.target.value })
  const setNum = (key: keyof Bet) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">04 · Bets</p>
        <h1 className="text-5xl tracking-tight mb-3">Propose a bet</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          A bet is what we are doing differently this cycle. It cannot carry the same kind
          of forecast as the engine, so it carries a range, a price, a hypothesis and a rule
          for stopping.
        </p>
      </div>

      <div className="bg-white border border-brand-black px-8 py-8 space-y-7 max-w-3xl">

        <Field label="What is it">
          <input
            autoFocus
            value={draft.name}
            onChange={set("name")}
            placeholder="e.g. DACH enterprise ABM pilot"
            className={INPUT}
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="The gap it closes: region">
            <select value={draft.region} onChange={set("region")} className={SELECT}>
              <option value="">Choose</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="The gap it closes: outcome">
            <select value={draft.outcomeId} onChange={set("outcomeId")} className={SELECT}>
              <option value="">Choose</option>
              {outcomes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Quarter">
            <select value={draft.quarter} onChange={set("quarter")} className={SELECT}>
              <option value="">Choose</option>
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <input value={draft.owner} onChange={set("owner")} placeholder="Name" className={INPUT} />
          </Field>
        </div>

        <Field
          label="The range, and the case inside it"
          hint="The planning case is a stated point inside the range, not a prediction dressed up as one. A wide range is honest; a single number is not."
        >
          <div className="grid grid-cols-3 gap-3">
            {(["rangeLow", "planningCase", "rangeHigh"] as const).map((key, i) => (
              <div key={key}>
                <input
                  type="number"
                  value={num(key)}
                  onChange={setNum(key)}
                  placeholder="0"
                  className={INPUT}
                />
                <p className="font-mono text-xs text-brand-medium-gray mt-1.5">
                  {["Low, $M", "Planning case, $M", "High, $M"][i]}
                </p>
              </div>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Price, incremental $M">
            <input type="number" value={num("price")} onChange={setNum("price")} placeholder="0" className={INPUT} />
          </Field>
          <Field label="Capacity and dependencies">
            <input value={draft.capacity} onChange={set("capacity")} placeholder="e.g. 1 ABM lead, SDR pair" className={INPUT} />
          </Field>
        </div>

        <Field
          label="The hypothesis: what do you think is true"
          hint="Something that can be argued with in September, rather than discovered in March."
        >
          <textarea
            value={draft.hypothesis}
            onChange={set("hypothesis")}
            rows={3}
            placeholder="e.g. A named-account motion produces meetings at twice the inbound rate in DACH, as it did in the ANZ pilot."
            className={`${INPUT} resize-none`}
          />
        </Field>

        <Field
          label="The nearest comparable"
          hint="If there genuinely is not one, write none. That is a real answer and it tells us how much to trust the range."
        >
          <input
            value={draft.comparable}
            onChange={set("comparable")}
            placeholder="e.g. ANZ ABM pilot, Q2 FY26, single run"
            className={INPUT}
          />
        </Field>

        <Field
          label="The decision rule"
          hint="What you would see, by when, and what you do if you do not see it."
        >
          <textarea
            value={draft.decisionRule}
            onChange={set("decisionRule")}
            rows={3}
            placeholder="e.g. Quarter one meeting count. Below 40% of the case, stop and return the budget."
            className={`${INPUT} resize-none`}
          />
        </Field>

        <div className="border-t border-brand-light-gray pt-6">
          <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-4">Salesforce</p>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Campaign ID">
              <input
                value={draft.salesforceCampaignId || ""}
                onChange={set("salesforceCampaignId")}
                placeholder="7013z000001aBcDEFG"
                className={INPUT}
              />
            </Field>
            <Field label="Campaign link">
              <input
                value={draft.salesforceCampaignUrl || ""}
                onChange={set("salesforceCampaignUrl")}
                placeholder="https://host.lightning.force.com/…"
                className={INPUT}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-brand-light-gray pt-6">
          <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-4">Dimensions</p>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Sub-region" hint="e.g. DACH, ANZ, UKI, Korea">
              <input
                value={draft.subRegion || ""}
                onChange={set("subRegion")}
                placeholder="Free text"
                className={INPUT}
              />
            </Field>
            <Field label="Channel">
              <select value={draft.channel || ""} onChange={set("channel")} className={SELECT}>
                <option value="">None</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Language">
              <select value={draft.language || ""} onChange={set("language")} className={SELECT}>
                <option value="">None</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Product">
              <select value={draft.product || ""} onChange={set("product")} className={SELECT}>
                <option value="">None</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Segment">
              <select value={draft.segment || ""} onChange={set("segment")} className={SELECT}>
                <option value="">None</option>
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={!draft.name.trim()}
            className="px-6 py-3 bg-brand-black text-white text-sm hover:bg-brand-maroon transition-colors disabled:opacity-40 rounded-sm"
          >
            {saveLabel}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-brand-light-gray text-sm hover:bg-brand-light-gray transition-colors rounded-sm"
          >
            Cancel
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="ml-auto px-4 py-3 text-sm text-brand-medium-gray border border-transparent hover:border-brand-hot-red hover:text-brand-black transition-colors"
            >
              Delete bet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BetsView() {
  const { state, dispatch } = usePlan()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [draft, setDraft] = useState<Bet | null>(null)

  const toggle = (id: string) => setExpanded(expanded === id ? null : id)

  const openAdd = () => {
    const defaultOutcome = state.outcomes[0]?.id || ""
    setDraft(emptyBet(defaultOutcome))
    setMode("add")
  }

  const openEdit = (b: Bet) => {
    setDraft({ ...b })
    setMode("edit")
    setExpanded(null)
  }

  const commitAdd = () => {
    if (draft && draft.name.trim()) dispatch({ type: "ADD_BET", bet: draft })
    setMode("list")
    setDraft(null)
  }

  const commitEdit = () => {
    if (draft) dispatch({ type: "UPDATE_BET", bet: draft })
    setMode("list")
    setDraft(null)
  }

  const cancelForm = () => {
    setMode("list")
    setDraft(null)
  }

  if ((mode === "add" || mode === "edit") && draft) {
    return (
      <ProposeBetForm
        draft={draft}
        setDraft={setDraft}
        outcomes={state.outcomes}
        onSave={mode === "add" ? commitAdd : commitEdit}
        onCancel={cancelForm}
        onDelete={mode === "edit" ? () => {
          dispatch({ type: "DELETE_BET", id: draft.id })
          setMode("list")
          setDraft(null)
        } : undefined}
        saveLabel={mode === "add" ? "Propose it" : "Save changes"}
      />
    )
  }

  return (
    <div>
      <div className="mb-10 flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">04 · Bets priced against the gap</p>
          <h1 className="text-5xl tracking-tight mb-3">Bets</h1>
          <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
            Each bet is something we are doing differently this cycle. Range, price, hypothesis, decision rule —
            all required before anything gets funded.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="mt-1 shrink-0 px-5 py-2.5 bg-brand-black text-white text-sm hover:bg-brand-maroon transition-colors"
        >
          Propose a bet
        </button>
      </div>

      {state.bets.length === 0 ? (
        <div className="bg-white border border-brand-black px-8 py-16 text-center">
          <p className="font-mono text-xs text-brand-medium-gray mb-3">No bets yet</p>
          <p className="text-sm text-brand-medium-gray max-w-sm mx-auto leading-relaxed">
            No bets yet. Add one to see it roll into the portfolio.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-brand-black">
          {state.bets.map((bet, i) => {
            const outcome = state.outcomes.find(o => o.id === bet.outcomeId)
            const isLast = i === state.bets.length - 1
            return (
              <div key={bet.id} className={isLast ? "" : "border-b border-brand-light-gray"}>
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                  onClick={() => toggle(bet.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`font-mono text-xs px-2 py-0.5 border shrink-0 ${STATUS_STYLES[bet.status]}`}>
                      {bet.status}
                    </span>
                    <span className="text-sm truncate">{bet.name}</span>
                    {bet.region && (
                      <span className="font-mono text-xs text-brand-medium-gray shrink-0">{bet.region}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-5 font-mono text-xs text-brand-medium-gray shrink-0 ml-4">
                    {outcome && (
                      <span>{outcome.prefix}{bet.planningCase}{outcome.unit} case</span>
                    )}
                    <span className="text-brand-light-gray">{expanded === bet.id ? "▴" : "▾"}</span>
                  </div>
                </div>

                {expanded === bet.id && (
                  <div className="px-6 pb-6 pt-4 bg-[#FAFAFA] border-t border-brand-light-gray">
                    <div className="grid grid-cols-3 gap-6 mb-5 text-sm">
                      <div>
                        <p className="font-mono text-xs text-brand-medium-gray mb-1">Range</p>
                        <p className="font-mono">{outcome?.prefix}{bet.rangeLow}–{bet.rangeHigh}{outcome?.unit}</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-brand-medium-gray mb-1">Price</p>
                        <p className="font-mono">${bet.price}M</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-brand-medium-gray mb-1">Quarter</p>
                        <p>{bet.quarter || <span className="text-brand-light-gray">—</span>}</p>
                      </div>
                      {bet.capacity && (
                        <div>
                          <p className="font-mono text-xs text-brand-medium-gray mb-1">Capacity</p>
                          <p>{bet.capacity}</p>
                        </div>
                      )}
                      {bet.owner && (
                        <div>
                          <p className="font-mono text-xs text-brand-medium-gray mb-1">Owner</p>
                          <p>{bet.owner}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-8 mb-5">
                      <div>
                        <p className="font-mono text-xs text-brand-medium-gray mb-2">Hypothesis</p>
                        <p className="text-sm leading-relaxed text-brand-black">
                          {bet.hypothesis || <span className="text-brand-light-gray italic">Not set</span>}
                        </p>
                        {bet.comparable && (
                          <p className="font-mono text-xs text-brand-medium-gray mt-2">Nearest comparable: {bet.comparable}</p>
                        )}
                      </div>
                      <div>
                        <p className="font-mono text-xs text-brand-medium-gray mb-2">Decision rule</p>
                        <p className="text-sm leading-relaxed text-brand-black">
                          {bet.decisionRule || <span className="text-brand-light-gray italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                    {bet.salesforceCampaignId && (
                      <div className="mb-5 pt-4 border-t border-brand-light-gray flex items-center gap-3">
                        <p className="font-mono text-xs text-brand-medium-gray">SF Campaign</p>
                        <span className="font-mono text-xs text-brand-black">{bet.salesforceCampaignId}</span>
                        {bet.salesforceCampaignUrl && (
                          <a
                            href={bet.salesforceCampaignUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-brand-medium-gray hover:text-brand-black transition-colors flex items-center gap-1"
                          >
                            Open in Salesforce
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2 2h3.5M2 2v8h8V6.5M2 2l5 5M7 2h3v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    )}
                    {(bet.subRegion || bet.channel || bet.language || bet.product || bet.segment) && (
                      <div className="mb-5 pt-4 border-t border-brand-light-gray flex flex-wrap items-center gap-2">
                        {bet.subRegion && (
                          <span className="font-mono text-xs px-2 py-0.5 border border-brand-light-gray text-brand-medium-gray">
                            {bet.subRegion}
                          </span>
                        )}
                        {bet.channel && (
                          <span className="font-mono text-xs px-2 py-0.5 border border-brand-light-gray text-brand-medium-gray">
                            {bet.channel}
                          </span>
                        )}
                        {bet.language && (
                          <span className="font-mono text-xs px-2 py-0.5 border border-brand-light-gray text-brand-medium-gray">
                            {bet.language}
                          </span>
                        )}
                        {bet.product && (
                          <span className="font-mono text-xs px-2 py-0.5 bg-brand-lime text-brand-black">
                            {bet.product}
                          </span>
                        )}
                        {bet.segment && (
                          <span className="font-mono text-xs px-2 py-0.5 border border-brand-light-gray text-brand-medium-gray">
                            {bet.segment}
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => openEdit(bet)}
                      className="font-mono text-xs text-brand-medium-gray hover:text-brand-black transition-colors"
                    >
                      Edit →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
