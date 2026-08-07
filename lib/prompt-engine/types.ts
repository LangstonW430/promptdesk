// ─── Normalised domain shapes ─────────────────────────────────────────────────

// The engine speaks the same stage vocabulary as the rest of the app rather
// than keeping a parallel one of its own — see lib/clients/stage.ts. That
// module is pure (no I/O, no framework), so importing it here costs the engine
// nothing and stops the two vocabularies drifting apart.
export type { ClientStage } from '@/lib/clients/stage'
import type { ClientStage } from '@/lib/clients/stage'

export type NoteType = 'note' | 'call' | 'meeting' | 'email'

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'

/** Canonical client shape used throughout the engine. Dates are human-readable strings. */
export interface EngineClient {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  leadSource: string | null
  stage: ClientStage
  estimatedValue: number | null
  estimatedValueFormatted: string | null // "$2,500.00"
  projectType: string | null
  painPoints: string | null
  requirements: string | null
  opportunityNotes: string | null
  lastContactDate: string | null         // "Jun 3, 2026"
  nextFollowupDate: string | null
  tags: string[]
  customFields: Record<string, string>
  createdAt: string                      // ISO 8601
  updatedAt: string
  /** Pre-computed rolling summary of notes + status history (~250–350 tokens). */
  relationshipSummary: string | null
}

/** Normalised note with a content hash for deduplication. */
export interface EngineNote {
  id: string
  clientId: string
  body: string
  noteType: NoteType
  occurredAt: string  // ISO 8601
  contentHash: string // hash of normalised body
}

export interface EngineTask {
  id: string
  clientId: string | null
  projectId: string | null
  title: string
  dueDate: string | null // "Jun 3, 2026"
  isDone: boolean
}

export interface EngineProject {
  id: string
  clientId: string
  title: string
  status: ProjectStatus
  startDate: string | null        // "Jun 3, 2026"
  endDate: string | null
  budget: number | null
  budgetFormatted: string | null  // "$5,000.00"
  deliverables: string[]
  createdAt: string               // ISO 8601
  updatedAt: string
}

export interface EngineActivity {
  id: string
  clientId: string | null
  type: string
  detail: Record<string, unknown>
  occurredAt: string // ISO 8601
}

/** Pipeline-level aggregates for global-scope prompts. */
export interface PipelineAggregate {
  totalActive: number
  stageCounts: Record<ClientStage, number>
  weightedPipelineValue: number
  weightedPipelineValueFormatted: string // "$14,250.00"
  staleClientCount: number               // no contact ≥30 days, still open
  overdueFollowUpCount: number           // nextFollowupDate < today
  currency: string                       // "USD"
}

// ─── Scoring & budgeting ──────────────────────────────────────────────────────

export type ContextItemType = 'client' | 'note' | 'task' | 'activity' | 'project'
export type InclusionTier = 'full' | 'summary'

/**
 * Callers build this from EngineClient/Note/Task/Activity.
 * fullContent and summaryContent are pre-rendered text blocks.
 * The budgeter decides which tier each item lands at.
 */
export interface ScoredItem {
  id: string
  type: ContextItemType
  score: number          // 0–1 composite
  reason: string         // e.g. "high value + proposal out"
  fullContent: string    // verbatim block for the prompt
  summaryContent: string // one-line distillation
  estimatedTokens: number
}

export interface IncludedItem {
  id: string
  type: ContextItemType
  tier: InclusionTier
  content: string
  score: number
  reason: string
  tokens: number
}

export interface OmittedGroup {
  type: ContextItemType
  count: number
  label: string // "3 older notes omitted"
}

export interface BudgetResult {
  included: IncludedItem[]
  omittedSummary: OmittedGroup[]
  totalTokens: number
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Weights for the five scoring dimensions from spec §7.3.
 * All five should sum to 1.0 for normalised output; the scorer
 * normalises automatically so callers can supply partial overrides.
 */
export interface ScoringWeights {
  recency: number        // w1 — newer activity ranks higher
  dealValue: number      // w2 — higher estimatedValue ranks higher
  stageUrgency: number   // w3 — active/proposal out > lead
  stalenessRisk: number  // w4 — overdue follow-ups get a boost
  relevance: number      // w5 — keyword match to the objective
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  recency: 0.30,
  dealValue: 0.25,
  stageUrgency: 0.20,
  stalenessRisk: 0.15,
  relevance: 0.10,
}

/**
 * Discriminated union: everything the scorer needs from each item type.
 * Keeps the scorer decoupled from full engine shapes.
 */
export type ScorableItem =
  | ScorableClient
  | ScorableNote
  | ScorableTask
  | ScorableActivity

export interface ScorableClient {
  kind: 'client'
  id: string
  stage: ClientStage
  estimatedValue: number | null
  lastContactDate: string | null  // ISO 8601 or null
  nextFollowupDate: string | null // ISO 8601 or null
  updatedAt: string               // ISO 8601
  /** All searchable text fields concatenated for relevance scoring. */
  searchText: string
}

export interface ScorableNote {
  kind: 'note'
  id: string
  clientStage?: ClientStage
  clientEstimatedValue?: number | null
  occurredAt: string // ISO 8601
  searchText: string
}

export interface ScorableTask {
  kind: 'task'
  id: string
  clientStage?: ClientStage
  clientEstimatedValue?: number | null
  dueDate: string | null // ISO 8601 or null
  isDone: boolean
  searchText: string
}

export interface ScorableActivity {
  kind: 'activity'
  id: string
  clientStage?: ClientStage
  clientEstimatedValue?: number | null
  occurredAt: string // ISO 8601
  searchText: string
}

/** Per-dimension breakdown alongside the composite score. */
export interface ScoreBreakdown {
  recency: number
  dealValue: number
  stageUrgency: number
  stalenessRisk: number
  relevance: number
  composite: number
  reason: string
}

// ─── Normaliser options ───────────────────────────────────────────────────────

export interface NormalizerOptions {
  currency?: string // default "USD"
  locale?: string   // default "en-US"
  now?: Date        // injectable for deterministic tests
}

// ─── Raw input shapes (what the normaliser accepts from the data layer) ───────

export interface RawClient {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  leadSource: string | null
  stage: string
  estimatedValue: number | { toNumber(): number } | null // Prisma Decimal compat
  projectType: string | null
  painPoints: string | null
  requirements: string | null
  opportunityNotes: string | null
  lastContactDate: Date | string | null
  nextFollowupDate: Date | string | null
  tags?: string[]
  customFields?: Record<string, unknown>
  createdAt: Date | string
  updatedAt: Date | string
  relationshipSummary?: string | null
}

export interface RawNote {
  id: string
  clientId: string
  body: string
  noteType: string
  occurredAt: Date | string
}

export interface RawTask {
  id: string
  clientId: string | null
  projectId: string | null
  title: string
  dueDate: Date | string | null
  isDone: boolean
}

export interface RawProject {
  id: string
  clientId: string
  title: string
  status: string
  startDate: Date | string | null
  endDate: Date | string | null
  budget: number | { toNumber(): number } | null
  deliverables: unknown[]         // JSONB array from Prisma
  createdAt: Date | string
  updatedAt: Date | string
}

export interface RawActivity {
  id: string
  clientId: string | null
  type: string
  detail: Record<string, unknown>
  createdAt: Date | string
}
