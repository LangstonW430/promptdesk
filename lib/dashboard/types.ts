export const OPEN_STAGES = ['lead', 'contacted', 'proposal_sent', 'negotiating'] as const
export type OpenStage = (typeof OPEN_STAGES)[number]

/** Stage close-probability percentages (0–100). User-overridable via users.settings. */
export type StageProbabilities = Record<OpenStage, number>

export const DEFAULT_STAGE_PROBABILITIES: StageProbabilities = {
  lead: 10,
  contacted: 25,
  proposal_sent: 50,
  negotiating: 70,
}

export interface StageBreakdown {
  stage: OpenStage
  count: number
  /** Raw sum of estimatedValue for this stage. */
  totalValue: number
  /** totalValue × (probability / 100). */
  forecastContribution: number
}

export interface DashboardAggregates {
  totalLeads: number
  activeClients: number
  /** Raw sum of estimatedValue across all open-stage, non-archived clients. */
  totalPipelineValue: number
  /** Σ (estimatedValue × stageProbability/100) across open-stage clients. */
  revenueForecast: number
  /** won / (won + lost). null when no closed deals exist yet. */
  conversionRate: number | null
  /** The probabilities used — defaults merged with any user overrides. */
  stageProbabilities: StageProbabilities
  /** Per-stage breakdown for all four open stages (zero-count stages included). */
  pipelineByStage: StageBreakdown[]
  wonCount: number
  lostCount: number
}
