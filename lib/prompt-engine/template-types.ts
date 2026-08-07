import type { ClientStage, NoteType } from './types'

export type TemplateScope = 'global' | 'client' | 'notes' | 'project'

/**
 * Pure data spec describing what the data layer should fetch before building
 * the context block. No querying happens here — callers read this and do the
 * work.
 */
export interface RetrievalSpec {
  scope: TemplateScope
  // ── Global scope ─────────────────────────────────────────────────────────
  includeClients?: boolean
  /** Undefined = all non-archived clients. */
  clientStageFilter?: ClientStage[]
  includeOpenTasks?: boolean
  includeRecentActivities?: boolean
  includePipelineAggregate?: boolean
  maxClients?: number
  maxActivities?: number
  maxOpenTasks?: number
  // ── Client scope ──────────────────────────────────────────────────────────
  includeNotes?: boolean
  includeTasks?: boolean
  includeActivities?: boolean
  maxNotes?: number
  // ── Notes scope ───────────────────────────────────────────────────────────
  noteTypeFilter?: NoteType[]
  // ── Project scope ─────────────────────────────────────────────────────────
  /** Required when scope === 'project'. */
  projectId?: string
  includeProjectTasks?: boolean
  includeProjectNotes?: boolean
}

/** A built-in template definition — the single source of truth for both the
 *  renderer and the DB seed. */
export interface BuiltInTemplate {
  key: string
  name: string
  description: string
  scope: TemplateScope
  tokenBudget: number
  version: number
  retrievalSpec: RetrievalSpec
  body: string
}

/**
 * Everything the renderer needs to resolve placeholders.
 * `contextBlock` is the pre-assembled, budgeted data string produced by the
 * engine pipeline; the renderer does not touch its contents.
 */
export interface RenderContext {
  businessName?: string
  businessType?: string
  /** Pre-formatted date string, e.g. "Jun 3, 2026". */
  today: string
  /** User-supplied objective (Business Advisor only). */
  objective?: string
  /** Output of the budgeter — the assembled context. */
  contextBlock: string
  /** Any additional per-call substitutions beyond the standard five. */
  extras?: Record<string, string>
}

export interface RenderedPrompt {
  text: string
  tokenCount: number
  templateKey: string
  templateVersion: number
  /** Placeholder keys that were present in the template and resolved. */
  usedPlaceholders: string[]
  /** Placeholder keys that appeared in the template but had no value
   *  (replaced with empty string). Useful for context_meta warnings. */
  missingPlaceholders: string[]
}
