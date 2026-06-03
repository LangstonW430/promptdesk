/**
 * Pure orchestration of the prompt generation pipeline.
 * No I/O — takes data as arguments, returns a value.
 * The generatePrompt() entry point in index.ts handles DB access.
 */

import {
  normalizeClient,
  normalizeNote,
  normalizeTask,
  normalizeActivity,
} from '@/lib/prompt-engine/normalizer'
import { deduplicateNotes } from '@/lib/prompt-engine/deduplicator'
import { scoreAll } from '@/lib/prompt-engine/scorer'
import { applyBudget } from '@/lib/prompt-engine/budgeter'
import {
  buildScorableSet,
  buildScoredItemsFromResults,
  buildContextBlock,
  computePipelineAggregate,
} from '@/lib/prompt-engine/context-builder'
import { renderTemplate } from '@/lib/prompt-engine/renderer'
import type {
  RawClient,
  RawNote,
  RawTask,
  RawActivity,
  NormalizerOptions,
} from '@/lib/prompt-engine/types'
import type { BuiltInTemplate } from '@/lib/prompt-engine/template-types'
import type { ContextMeta, GenerateResult } from './types'

export interface PipelineInput {
  rawClients: RawClient[]
  rawNotes: RawNote[]
  rawTasks: RawTask[]
  rawActivities: RawActivity[]
  template: Pick<BuiltInTemplate, 'key' | 'version' | 'body' | 'scope' | 'tokenBudget'>
  userProfile: {
    businessName?: string | null
    businessType?: string | null
    currency?: string
  }
  objective?: string
  now?: Date
}

export function buildPrompt(input: PipelineInput): GenerateResult {
  const now = input.now ?? new Date()
  const { template, userProfile, objective } = input

  const normOpts: NormalizerOptions = {
    currency: userProfile.currency ?? 'USD',
    locale: 'en-US',
    now,
  }

  // ── 1. Normalize ────────────────────────────────────────────────────────────
  const clients = input.rawClients.map((c) => normalizeClient(c, normOpts))
  const allNotes = input.rawNotes.map(normalizeNote)
  const tasks = input.rawTasks.map(normalizeTask)
  const activities = input.rawActivities.map(normalizeActivity)

  // ── 2. Deduplicate notes ────────────────────────────────────────────────────
  const { unique: notes, droppedCount: deduplicatedNoteCount } =
    deduplicateNotes(allNotes)

  // ── 3. Build scorable set + lookup maps ─────────────────────────────────────
  const { items: scorableItems, clientMap, noteMap, taskMap, activityMap } =
    buildScorableSet(clients, notes, tasks, activities)

  const totalCandidateCount = scorableItems.length

  // ── 4. Score ────────────────────────────────────────────────────────────────
  const scoredResults = scoreAll(scorableItems, objective ?? '', {}, now)

  // ── 5. Build ScoredItems with rendered content ──────────────────────────────
  const scoredItems = buildScoredItemsFromResults(
    scoredResults,
    clientMap,
    noteMap,
    taskMap,
    activityMap,
    now,
  )

  // ── 6. Pipeline aggregate (global scope only) ───────────────────────────────
  const aggregate =
    template.scope === 'global'
      ? computePipelineAggregate(clients, now, userProfile.currency ?? 'USD')
      : undefined

  // ── 7. Budget ───────────────────────────────────────────────────────────────
  const budgetResult = applyBudget(scoredItems, template.tokenBudget)

  // ── 8. Build context block ──────────────────────────────────────────────────
  const contextBlock = buildContextBlock(budgetResult.included, aggregate)

  // ── 9. Render ───────────────────────────────────────────────────────────────
  const rendered = renderTemplate(template, {
    businessName: userProfile.businessName ?? undefined,
    businessType: userProfile.businessType ?? undefined,
    today: now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    objective,
    contextBlock,
  })

  // ── 10. Build context_meta ──────────────────────────────────────────────────
  const contextMeta: ContextMeta = {
    templateKey: template.key,
    templateVersion: template.version,
    objective,
    includedItems: budgetResult.included.map((i) => ({
      id: i.id,
      type: i.type,
      tier: i.tier,
      score: i.score,
      reason: i.reason,
    })),
    omittedGroups: budgetResult.omittedSummary,
    deduplicatedNoteCount,
    totalCandidateCount,
  }

  return {
    text: rendered.text,
    tokenCount: rendered.tokenCount,
    contextMeta,
  }
}
