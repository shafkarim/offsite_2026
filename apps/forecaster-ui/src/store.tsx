import { createContext, useContext, useReducer, useEffect, useRef, useState, ReactNode } from "react"
import { PlanState, EngineProgram, Bet, Decision } from "./types"
import { getPayloadValue, setPayloadValue } from "./payload"

const PLAN_KEY = "how_we_plan_state_v1"

// FY26 Q1–Q3 actuals annualised × 1.10 default multiplier
const FY27_BASELINE = 224.5

export const DEFAULT_STATE: PlanState = {
  outcomes: [
    { id: "pipeline", name: "Pipeline generation", unit: "M", prefix: "$", target: FY27_BASELINE },
  ],
  programs: [],
  bets: [],
}

// IDs seeded in an earlier version — strip them from any persisted state
const SEED_PROGRAM_IDS = new Set(["p1", "p2", "p3", "p4"])
const SEED_BET_IDS = new Set(["b1", "b2", "b3"])

type Action =
  | { type: "SYNC"; state: PlanState }
  | { type: "UPDATE_TARGET"; outcomeId: string; target: number }
  | { type: "SET_DECISION"; outcomeId: string; decision: Decision | undefined }
  | { type: "ADD_PROGRAM"; program: EngineProgram }
  | { type: "UPDATE_PROGRAM"; program: EngineProgram }
  | { type: "DELETE_PROGRAM"; id: string }
  | { type: "ADD_BET"; bet: Bet }
  | { type: "UPDATE_BET"; bet: Bet }
  | { type: "DELETE_BET"; id: string }
  | { type: "RESET" }

function reducer(state: PlanState, action: Action): PlanState {
  switch (action.type) {
    case "SYNC":
      return action.state
    case "UPDATE_TARGET":
      return { ...state, outcomes: state.outcomes.map(o => o.id === action.outcomeId ? { ...o, target: action.target } : o) }
    case "SET_DECISION":
      return { ...state, outcomes: state.outcomes.map(o => o.id === action.outcomeId ? { ...o, decisionOverride: action.decision } : o) }
    case "ADD_PROGRAM":
      return { ...state, programs: [...state.programs, action.program] }
    case "UPDATE_PROGRAM":
      return { ...state, programs: state.programs.map(p => p.id === action.program.id ? action.program : p) }
    case "DELETE_PROGRAM":
      return { ...state, programs: state.programs.filter(p => p.id !== action.id) }
    case "ADD_BET":
      return { ...state, bets: [...state.bets, action.bet] }
    case "UPDATE_BET":
      return { ...state, bets: state.bets.map(b => b.id === action.bet.id ? action.bet : b) }
    case "DELETE_BET":
      return { ...state, bets: state.bets.filter(b => b.id !== action.id) }
    case "RESET":
      return DEFAULT_STATE
    default:
      return state
  }
}

interface PlanContextValue {
  state: PlanState
  dispatch: React.Dispatch<Action>
  syncing: boolean
  engineTotal: (outcomeId: string) => number
  betsTotal: (outcomeId: string) => number
  gap: (outcomeId: string) => number
  gapPct: (outcomeId: string) => number
  computedDecision: (outcomeId: string) => Decision
}

const PlanContext = createContext<PlanContextValue>({
  state: DEFAULT_STATE,
  dispatch: () => {},
  syncing: false,
  engineTotal: () => 0,
  betsTotal: () => 0,
  gap: () => 0,
  gapPct: () => 0,
  computedDecision: () => "re-plan",
})

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE)
  const [syncing, setSyncing] = useState(true)
  const loaded = useRef(false)
  const isRemote = useRef(false)
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWritten = useRef<string>("")

  // Load initial state from the shared Payload workspace on mount.
  useEffect(() => {
    getPayloadValue<PlanState | null>(PLAN_KEY, null)
      .then((raw) => {
        if (raw) {
          // Migrate: strip non-pipeline items, seeded placeholders, and fill new bet fields
          const migrated: PlanState = {
            ...raw,
            outcomes: raw.outcomes
              .filter(o => o.id === "pipeline")
              .map(o => ({ ...o, target: o.target === 120 ? FY27_BASELINE : o.target })),
            programs: raw.programs.filter(p => p.outcomeId === "pipeline" && !SEED_PROGRAM_IDS.has(p.id)),
            bets: raw.bets
              .filter(b => b.outcomeId === "pipeline" && !SEED_BET_IDS.has(b.id))
              .map(b => ({
                ...b,
                region: b.region ?? "",
                quarter: b.quarter ?? "",
                owner: b.owner ?? "",
                capacity: b.capacity ?? "",
                comparable: b.comparable ?? "",
              })),
          }
          isRemote.current = true
          dispatch({ type: "SYNC", state: migrated })
          lastWritten.current = JSON.stringify(migrated)
        }
      })
      .then(() => {
        loaded.current = true
        setSyncing(false)
      }, () => {
        loaded.current = true
        setSyncing(false)
      })
  }, [])

  // Write to Payload when local state changes (debounced, skip remote-triggered updates).
  useEffect(() => {
    if (!loaded.current) return
    if (isRemote.current) {
      isRemote.current = false
      return
    }
    const serialized = JSON.stringify(state)
    if (serialized === lastWritten.current) return

    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(async () => {
      lastWritten.current = serialized
      await setPayloadValue(PLAN_KEY, state)
    }, 400)
  }, [state])

  // Poll the shared Payload workspace for multi-user updates.
  useEffect(() => {
    const syncRemote = async () => {
      try {
        const incoming = await getPayloadValue<PlanState | null>(PLAN_KEY, null)
        if (!incoming) return
        const serialized = JSON.stringify(incoming)
        if (serialized === lastWritten.current) return
        lastWritten.current = serialized
        isRemote.current = true
        dispatch({ type: "SYNC", state: incoming })
      } catch {
        // Keep the last good state; the header sync indicator remains usable.
      }
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncRemote()
    }, 15_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const engineTotal = (outcomeId: string) =>
    state.programs.filter(p => p.outcomeId === outcomeId).reduce((s, p) => s + (p.forecast || 0), 0)

  const betsTotal = (outcomeId: string) =>
    state.bets.filter(b => b.outcomeId === outcomeId).reduce((s, b) => s + (b.planningCase || 0), 0)

  const gap = (outcomeId: string) => {
    const outcome = state.outcomes.find(o => o.id === outcomeId)
    if (!outcome) return 0
    return Math.max(outcome.target - engineTotal(outcomeId) - betsTotal(outcomeId), 0)
  }

  const gapPct = (outcomeId: string) => {
    const outcome = state.outcomes.find(o => o.id === outcomeId)
    if (!outcome || outcome.target === 0) return 0
    return (gap(outcomeId) / outcome.target) * 100
  }

  const computedDecision = (outcomeId: string): Decision => {
    const outcome = state.outcomes.find(o => o.id === outcomeId)
    if (outcome?.decisionOverride) return outcome.decisionOverride
    const pct = gapPct(outcomeId)
    if (pct <= 10) return "fund"
    if (pct <= 30) return "test"
    return "re-plan"
  }

  return (
    <PlanContext.Provider value={{ state, dispatch, syncing, engineTotal, betsTotal, gap, gapPct, computedDecision }}>
      {children}
    </PlanContext.Provider>
  )
}

export const usePlan = () => useContext(PlanContext)
