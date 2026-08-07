import type { ClientStage } from '@/lib/clients/stage'

export interface DashboardAggregates {
  totalLeads: number
  /** Clients with work in flight — an active project. */
  activeClients: number
  /**
   * Sum of open project budgets (proposed + active) across all open-stage,
   * non-archived clients. Derived from projects — clients no longer carry a
   * value of their own.
   */
  totalPipelineValue: number
  /** won / (won + lost). null when nothing has closed either way yet. */
  conversionRate: number | null
  /** Clients who became real work: an active or completed project. */
  wonCount: number
  /** Clients archived without work ever starting. */
  lostCount: number
  /** Per-stage breakdown of the open stages (zero-count stages included). */
  pipelineByStage: StageBreakdown[]
}

export interface StageBreakdown {
  stage: ClientStage
  count: number
  totalValue: number
}
