export type Confidence = "high" | "medium" | "low"
export type Decision = "fund" | "test" | "stop" | "re-plan" | "pending"
export type TargetMetric = "mql" | "sao" | "pipeline"

export interface Outcome {
  id: string
  name: string
  unit: string
  prefix: string
  target: number
  decisionOverride?: Decision
}

export interface EngineProgram {
  id: string
  outcomeId: string
  name: string
  forecast: number
  hexForecast?: number
  confidence: Confidence
  historyNote: string
  asanaGid?: string
  asanaProjectGid?: string
  owner?: string
  salesforceCampaignId?: string
  salesforceCampaignUrl?: string
  region?: string
  subRegion?: string
  channel?: string
  language?: string
  product?: string
  segment?: string
}

export interface Bet {
  id: string
  outcomeId: string
  name: string
  region: string
  quarter: string
  owner: string
  rangeLow: number
  rangeHigh: number
  planningCase: number
  hexForecast?: number
  price: number
  capacity: string
  hypothesis: string
  comparable: string
  decisionRule: string
  status: Decision
  asanaGid?: string
  asanaProjectGid?: string
  dueOn?: string
  salesforceCampaignId?: string
  salesforceCampaignUrl?: string
  subRegion?: string
  channel?: string
  language?: string
  product?: string
  segment?: string
}

export interface PlanState {
  outcomes: Outcome[]
  programs: EngineProgram[]
  bets: Bet[]
  subRegionTargets: SubRegionTarget[]
}

export interface SubRegionTarget {
  region: string
  subRegion: string
  mql?: number
  sao?: number
  pipeline?: number
}
