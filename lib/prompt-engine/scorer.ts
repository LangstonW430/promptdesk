import type {
  ScorableItem,
  ScorableClient,
  ScorableNote,
  ScorableTask,
  ScorableActivity,
  ScoringWeights,
  ScoreBreakdown,
  ClientStatus,
} from './types'
import { DEFAULT_WEIGHTS } from './types'

// ─── Stage urgency map (spec §7.3) ───────────────────────────────────────────

const STAGE_URGENCY: Record<ClientStatus, number> = {
  negotiating: 1.0,
  proposal_sent: 0.75,
  contacted: 0.50,
  lead: 0.25,
  won: 0.0,
  lost: 0.0,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000
}

/** Exponential decay: score=1 at 0 days, ~0.5 at 21 days, ~0 at 90+ days. */
function recencyScore(isoDate: string, now: Date): number {
  const days = daysBetween(new Date(isoDate), now)
  if (days < 0) return 1.0 // future-dated items treated as brand-new
  return Math.exp(-days / 30)
}

/**
 * Word-set Jaccard similarity between objective and item text.
 * Tokenises to lowercase alpha-only words, ignores stop words.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'my', 'our',
  'i', 'we', 'you', 'it', 'this', 'that', 'which', 'who', 'what', 'how',
])

function tokenise(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? []
  return new Set(words.filter((w) => !STOP_WORDS.has(w) && w.length > 1))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) {
    if (b.has(word)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Staleness risk (spec §7.3 w4):
 * - Overdue follow-up (nextFollowupDate < today)  → 1.0
 * - No contact in ≥30 days                         → 0.8
 * - No contact in <30 days                         → linear 0–0.8
 * - Everything else                                → 0
 */
function stalenessScore(
  lastContactDate: string | null | undefined,
  nextFollowupDate: string | null | undefined,
  now: Date,
): number {
  if (nextFollowupDate) {
    const followup = new Date(nextFollowupDate)
    if (followup < now) return 1.0
  }
  if (lastContactDate) {
    const days = daysBetween(new Date(lastContactDate), now)
    if (days >= 30) return 0.8
    return (days / 30) * 0.8
  }
  // Never contacted — treat as maximally stale (but below overdue)
  return 0.8
}

// ─── Per-kind sub-score calculators ──────────────────────────────────────────

function scoreClient(
  item: ScorableClient,
  objectiveTokens: Set<string>,
  maxValue: number,
  now: Date,
): Omit<ScoreBreakdown, 'composite' | 'reason'> {
  return {
    recency: recencyScore(item.updatedAt, now),
    dealValue: maxValue > 0 ? (item.estimatedValue ?? 0) / maxValue : 0,
    stageUrgency: STAGE_URGENCY[item.status] ?? 0,
    stalenessRisk: stalenessScore(item.lastContactDate, item.nextFollowupDate, now),
    relevance: jaccardSimilarity(tokenise(item.searchText), objectiveTokens),
  }
}

function scoreNote(
  item: ScorableNote,
  objectiveTokens: Set<string>,
  maxValue: number,
  now: Date,
): Omit<ScoreBreakdown, 'composite' | 'reason'> {
  return {
    recency: recencyScore(item.occurredAt, now),
    dealValue: maxValue > 0 ? (item.clientEstimatedValue ?? 0) / maxValue : 0,
    stageUrgency: STAGE_URGENCY[item.clientStatus ?? 'lead'] ?? 0,
    stalenessRisk: 0, // staleness not meaningful for historical notes
    relevance: jaccardSimilarity(tokenise(item.searchText), objectiveTokens),
  }
}

function scoreTask(
  item: ScorableTask,
  objectiveTokens: Set<string>,
  maxValue: number,
  now: Date,
): Omit<ScoreBreakdown, 'composite' | 'reason'> {
  // Overdue undone tasks get full staleness score
  const isOverdue =
    !item.isDone && item.dueDate != null && new Date(item.dueDate) < now
  return {
    recency: item.dueDate ? recencyScore(item.dueDate, now) : 0.5,
    dealValue: maxValue > 0 ? (item.clientEstimatedValue ?? 0) / maxValue : 0,
    stageUrgency: STAGE_URGENCY[item.clientStatus ?? 'lead'] ?? 0,
    stalenessRisk: isOverdue ? 1.0 : 0,
    relevance: jaccardSimilarity(tokenise(item.searchText), objectiveTokens),
  }
}

function scoreActivity(
  item: ScorableActivity,
  objectiveTokens: Set<string>,
  maxValue: number,
  now: Date,
): Omit<ScoreBreakdown, 'composite' | 'reason'> {
  return {
    recency: recencyScore(item.occurredAt, now),
    dealValue: maxValue > 0 ? (item.clientEstimatedValue ?? 0) / maxValue : 0,
    stageUrgency: STAGE_URGENCY[item.clientStatus ?? 'lead'] ?? 0,
    stalenessRisk: 0,
    relevance: jaccardSimilarity(tokenise(item.searchText), objectiveTokens),
  }
}

// ─── Reason string ────────────────────────────────────────────────────────────

const REASON_LABELS: Record<keyof ScoringWeights, (score: number) => string | null> = {
  recency: (s) => (s >= 0.8 ? 'recent activity' : null),
  dealValue: (s) => (s >= 0.7 ? 'high value' : null),
  stageUrgency: (s) =>
    s >= 0.75 ? 'negotiating' : s >= 0.5 ? 'active stage' : null,
  stalenessRisk: (s) => (s >= 1.0 ? 'overdue follow-up' : s >= 0.8 ? 'going cold' : null),
  relevance: (s) => (s >= 0.15 ? 'keyword match' : null),
}

function buildReason(
  subs: Omit<ScoreBreakdown, 'composite' | 'reason'>,
  weights: ScoringWeights,
): string {
  const parts: string[] = []

  for (const key of Object.keys(weights) as Array<keyof ScoringWeights>) {
    const label = REASON_LABELS[key](subs[key])
    if (label) parts.push(label)
  }

  if (parts.length > 0) return parts.join(' + ')

  // Fallback: name the single highest-weighted contributing dimension
  const top = (Object.keys(weights) as Array<keyof ScoringWeights>).reduce(
    (best, key) =>
      subs[key] * weights[key] > subs[best] * weights[best] ? key : best,
  )
  const fallbacks: Record<keyof ScoringWeights, string> = {
    recency: 'recent activity',
    dealValue: 'deal value',
    stageUrgency: 'pipeline stage',
    stalenessRisk: 'follow-up risk',
    relevance: 'objective match',
  }
  return fallbacks[top]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a single item against an objective string.
 *
 * @param item          - pre-built ScorableItem
 * @param objective     - the user's objective text (used for relevance)
 * @param weights       - partial weight overrides; merged with DEFAULT_WEIGHTS
 * @param maxValue      - the highest estimatedValue across the full batch (for normalisation)
 * @param now           - current timestamp (injectable for tests)
 */
export function scoreItem(
  item: ScorableItem,
  objective: string,
  weights: Partial<ScoringWeights> = {},
  maxValue = 0,
  now: Date = new Date(),
): ScoreBreakdown {
  const w: ScoringWeights = { ...DEFAULT_WEIGHTS, ...weights }

  // Normalise weights so they always sum to 1
  const total = w.recency + w.dealValue + w.stageUrgency + w.stalenessRisk + w.relevance
  const wn: ScoringWeights =
    total === 0
      ? DEFAULT_WEIGHTS
      : {
          recency: w.recency / total,
          dealValue: w.dealValue / total,
          stageUrgency: w.stageUrgency / total,
          stalenessRisk: w.stalenessRisk / total,
          relevance: w.relevance / total,
        }

  const objectiveTokens = tokenise(objective)

  let subs: Omit<ScoreBreakdown, 'composite' | 'reason'>
  switch (item.kind) {
    case 'client':
      subs = scoreClient(item, objectiveTokens, maxValue, now)
      break
    case 'note':
      subs = scoreNote(item, objectiveTokens, maxValue, now)
      break
    case 'task':
      subs = scoreTask(item, objectiveTokens, maxValue, now)
      break
    case 'activity':
      subs = scoreActivity(item, objectiveTokens, maxValue, now)
      break
  }

  const composite =
    subs.recency * wn.recency +
    subs.dealValue * wn.dealValue +
    subs.stageUrgency * wn.stageUrgency +
    subs.stalenessRisk * wn.stalenessRisk +
    subs.relevance * wn.relevance

  return {
    ...subs,
    composite: Math.min(1, Math.max(0, composite)),
    reason: buildReason(subs, wn),
  }
}

/**
 * Score and rank a batch of items.
 * Computes maxValue across the batch automatically.
 *
 * Returns items sorted by composite score descending, each annotated with
 * a full ScoreBreakdown including a reason string for context_meta.
 */
export function scoreAll(
  items: ScorableItem[],
  objective: string,
  weights: Partial<ScoringWeights> = {},
  now: Date = new Date(),
): Array<{ item: ScorableItem; breakdown: ScoreBreakdown }> {
  const maxValue = items.reduce<number>((max, it) => {
    const val =
      it.kind === 'client'
        ? (it.estimatedValue ?? 0)
        : ('clientEstimatedValue' in it ? (it.clientEstimatedValue ?? 0) : 0)
    return Math.max(max, val)
  }, 0)

  return items
    .map((item) => ({
      item,
      breakdown: scoreItem(item, objective, weights, maxValue, now),
    }))
    .sort((a, b) => b.breakdown.composite - a.breakdown.composite)
}
