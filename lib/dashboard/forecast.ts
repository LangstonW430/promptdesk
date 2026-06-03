import type { StageProbabilities } from './types'
import { OPEN_STAGES } from './types'

export interface StatusGroup {
  status: string
  count: number
  /** Pre-summed estimatedValue for this status bucket (null becomes 0 before this point). */
  sumValue: number
}

/**
 * Σ (sumValue × probability/100) for each group whose status has a known probability.
 * Groups for 'won', 'lost', and unknown statuses are skipped — they are already resolved.
 */
export function computeRevenueForecast(
  groups: StatusGroup[],
  probs: StageProbabilities,
): number {
  let total = 0
  for (const g of groups) {
    const p = probs[g.status as (typeof OPEN_STAGES)[number]]
    if (p === undefined) continue
    total += g.sumValue * (p / 100)
  }
  return total
}

/**
 * Conversion rate as a fraction 0–1, or null when no closed deals exist yet.
 * Denominator is won + lost only — open deals are not yet resolved.
 */
export function computeConversionRate(wonCount: number, lostCount: number): number | null {
  const closed = wonCount + lostCount
  if (closed === 0) return null
  return wonCount / closed
}
