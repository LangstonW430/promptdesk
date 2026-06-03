import type {
  ScoredItem,
  IncludedItem,
  OmittedGroup,
  BudgetResult,
  ContextItemType,
} from './types'
import { estimateTokens } from './renderer'

/**
 * Fill a token budget from a pre-sorted (score desc) list of ScoredItems.
 *
 * Single greedy pass in score order:
 *   - full content if tokens remain
 *   - summary content if full doesn't fit but summary does
 *   - omit otherwise
 *
 * The profile block and template boilerplate are NOT in the budget — they live
 * outside {{context_block}} and are never subject to this algorithm.
 */
export function applyBudget(
  items: ScoredItem[],
  tokenBudget: number,
): BudgetResult {
  let remaining = tokenBudget
  const included: IncludedItem[] = []
  const omitted: ScoredItem[] = []

  for (const item of items) {
    const summaryTokens = estimateTokens(item.summaryContent)

    if (item.estimatedTokens <= remaining) {
      included.push({
        id: item.id,
        type: item.type,
        tier: 'full',
        content: item.fullContent,
        score: item.score,
        reason: item.reason,
        tokens: item.estimatedTokens,
      })
      remaining -= item.estimatedTokens
    } else if (summaryTokens <= remaining) {
      included.push({
        id: item.id,
        type: item.type,
        tier: 'summary',
        content: item.summaryContent,
        score: item.score,
        reason: item.reason,
        tokens: summaryTokens,
      })
      remaining -= summaryTokens
    } else {
      omitted.push(item)
    }
  }

  // Group omitted items by type for the omit label
  const countByType = new Map<ContextItemType, number>()
  for (const item of omitted) {
    countByType.set(item.type, (countByType.get(item.type) ?? 0) + 1)
  }

  const omittedSummary: OmittedGroup[] = []
  for (const [type, count] of countByType) {
    const noun = type === 'activity' ? 'activities' : `${type}s`
    omittedSummary.push({
      type,
      count,
      label: count === 1 ? `1 older ${type} omitted` : `${count} older ${noun} omitted`,
    })
  }

  return {
    included,
    omittedSummary,
    totalTokens: tokenBudget - remaining,
  }
}
