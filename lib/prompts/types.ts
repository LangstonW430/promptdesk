import type { TemplateScope } from '@/lib/prompt-engine/template-types'
import type { ContextItemType, InclusionTier, OmittedGroup } from '@/lib/prompt-engine/types'

/**
 * Which surface asked for a prompt.
 *
 * Recorded on the history row so that a prompt an AI client pulled over MCP
 * can be told apart from one the user generated on the Prompts page. Both are
 * real history and both belong in the list; only the provenance differs.
 */
export type GenerateSource = 'app' | 'mcp'

export interface GenerateRequest {
  templateKey: string
  scope: TemplateScope
  clientId?: string
  /** When set, global-scope prompts are restricted to only these client IDs. */
  clientIds?: string[]
  objective?: string
  /** Defaults to 'app'. */
  source?: GenerateSource
}

export interface ContextMetaItem {
  id: string
  type: ContextItemType
  tier: InclusionTier
  score: number
  reason: string
  /** Human-readable label: company name, note snippet, task title, or activity summary. */
  label: string
}

export interface ContextMeta {
  templateKey: string
  templateVersion: number
  objective?: string
  includedItems: ContextMetaItem[]
  omittedGroups: OmittedGroup[]
  /** Notes removed by deduplication before scoring. */
  deduplicatedNoteCount: number
  /** Total scorable candidates before budgeting. */
  totalCandidateCount: number
}

export interface GenerateResult {
  text: string
  tokenCount: number
  contextMeta: ContextMeta
}
