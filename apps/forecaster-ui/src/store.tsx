import { createContext, useCallback, useContext, useReducer, useEffect, useRef, useState, ReactNode } from "react"
import { PlanState, EngineProgram, Bet, Decision, TargetMetric } from "./types"
import { getPayloadValue, setPayloadValue } from "./payload"
import { useCollaboration } from "./collaboration"
import { FORECAST_CONTRACT } from "./data/forecast-contract"

const PLAN_KEY = "how_we_plan_state_v1"

export const DEFAULT_STATE: PlanState = {
  outcomes: [
    { id: "pipeline", name: "Pipeline generation", unit: "M", prefix: "$", target: FORECAST_CONTRACT.pipelineTargetMillions },
  ],
  programs: [],
  bets: [],
  subRegionTargets: [],
}

// IDs seeded in an earlier version — strip them from any persisted state
const SEED_PROGRAM_IDS = new Set(["p1", "p2", "p3", "p4"])
const SEED_BET_IDS = new Set(["b1", "b2", "b3"])

function migratePlanState(raw: PlanState): PlanState {
  return {
    ...raw,
    outcomes: raw.outcomes
      .filter(outcome => outcome.id === "pipeline")
      .map(outcome => ({
        ...outcome,
        target: outcome.target === 120 || outcome.target === 224.5
          ? FORECAST_CONTRACT.pipelineTargetMillions
          : outcome.target,
      })),
    programs: raw.programs.filter(program =>
      program.outcomeId === "pipeline" && !SEED_PROGRAM_IDS.has(program.id),
    ),
    bets: raw.bets
      .filter(bet => bet.outcomeId === "pipeline" && !SEED_BET_IDS.has(bet.id))
      .map(bet => ({
        ...bet,
        region: bet.region ?? "",
        quarter: bet.quarter ?? "",
        owner: bet.owner ?? "",
        capacity: bet.capacity ?? "",
        comparable: bet.comparable ?? "",
      })),
    subRegionTargets: raw.subRegionTargets ?? [],
  }
}

type Action =
  | { type: "SYNC"; state: PlanState }
  | { type: "UPDATE_TARGET"; outcomeId: string; target: number }
  | { type: "UPDATE_SUBREGION_TARGET"; region: string; subRegion: string; metric: TargetMetric; value: number | null }
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
    case "UPDATE_SUBREGION_TARGET": {
      const existing = state.subRegionTargets.find(row => row.subRegion === action.subRegion)
      const next = { ...(existing ?? { region: action.region, subRegion: action.subRegion }) }
      if (action.value == null) delete next[action.metric]
      else next[action.metric] = action.value
      const hasValue = next.mql != null || next.sao != null || next.pipeline != null
      return {
        ...state,
        subRegionTargets: hasValue
          ? [...state.subRegionTargets.filter(row => row.subRegion !== action.subRegion), next]
          : state.subRegionTargets.filter(row => row.subRegion !== action.subRegion),
      }
    }
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
  storageMode: "shared" | "legacy"
  syncError: string | null
  lastSyncedAt: string | null
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
  storageMode: "legacy",
  syncError: null,
  lastSyncedAt: null,
  engineTotal: () => 0,
  betsTotal: () => 0,
  gap: () => 0,
  gapPct: () => 0,
  computedDecision: () => "re-plan",
})

export function PlanProvider({ children }: { children: ReactNode }) {
  const { isShared, canContribute } = useCollaboration()
  const [state, baseDispatch] = useReducer(reducer, DEFAULT_STATE)
  const [syncing, setSyncing] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const loaded = useRef(false)
  const isRemote = useRef(false)
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWritten = useRef<string>("")

  // Load initial state from the shared Payload workspace on mount.
  useEffect(() => {
    getPayloadValue<PlanState | null>(PLAN_KEY, null)
      .then((raw) => {
        if (raw) {
          const migrated = migratePlanState(raw)
          isRemote.current = true
          baseDispatch({ type: "SYNC", state: migrated })
          lastWritten.current = JSON.stringify(migrated)
          setLastSyncedAt(new Date().toISOString())
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
      setSyncing(true)
      setSyncError(null)
      try {
        await setPayloadValue(PLAN_KEY, state)
        lastWritten.current = serialized
        setLastSyncedAt(new Date().toISOString())
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Changes could not be saved.")
      } finally {
        setSyncing(false)
      }
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
        baseDispatch({ type: "SYNC", state: migratePlanState(incoming) })
        setLastSyncedAt(new Date().toISOString())
        setSyncError(null)
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Shared plan refresh failed.")
      }
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncRemote()
    }, 15_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    if (isShared && !canContribute && action.type !== "SYNC") {
      setSyncError("Your viewer role can review the shared plan but cannot change it.")
      return
    }
    baseDispatch(action)
  }, [canContribute, isShared])

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
    <PlanContext.Provider value={{
      state,
      dispatch,
      syncing,
      storageMode: isShared ? "shared" : "legacy",
      syncError,
      lastSyncedAt,
      engineTotal,
      betsTotal,
      gap,
      gapPct,
      computedDecision,
    }}>
      {children}
    </PlanContext.Provider>
  )
}

export const usePlan = () => useContext(PlanContext)
