export * from './types'
export * from './template-types'
export { scoreItem, scoreAll } from './scorer'
export { renderTemplate, estimateTokens } from './renderer'
export { BUILT_IN_TEMPLATES } from './templates'
export {
  normalizeClient,
  normalizeNote,
  normalizeTask,
  normalizeActivity,
  contentHash,
} from './normalizer'
export { deduplicateNotes } from './deduplicator'
export { applyBudget } from './budgeter'
export {
  computePipelineAggregate,
  buildContextBlock,
  buildScorableSet,
  buildScoredItemsFromResults,
  toScorableClient,
  toScorableNote,
  toScorableTask,
  toScorableActivity,
  toScoredClient,
  toScoredNote,
  toScoredTask,
  toScoredActivity,
} from './context-builder'
