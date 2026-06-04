export interface DashboardAggregates {
  totalLeads: number
  activeClients: number
  /** Raw sum of estimatedValue across all open-stage, non-archived clients. */
  totalPipelineValue: number
  /** won / (won + lost). null when no closed deals exist yet. */
  conversionRate: number | null
  wonCount: number
  lostCount: number
  /** Per-stage breakdown for the four open stages (zero-count stages included). */
  pipelineByStage: StageBreakdown[]
}

export const OPEN_STAGES = ['lead', 'contacted', 'proposal_sent', 'negotiating'] as const
export type OpenStage = (typeof OPEN_STAGES)[number]

export interface StageBreakdown {
  stage: OpenStage
  count: number
  totalValue: number
}
