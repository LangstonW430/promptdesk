import type { BuiltInTemplate, RenderContext, RenderedPrompt } from './template-types'

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g

/** Fast token estimator: ≈chars/4, consistent with the budgeter. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Render a template body by substituting all {{placeholder}} tokens.
 *
 * Standard placeholders resolved from RenderContext:
 *   {{business_name}}  — owner's business name
 *   {{business_type}}  — e.g. "web development"
 *   {{today}}          — formatted date string
 *   {{objective}}      — user-supplied objective (Business Advisor)
 *   {{context_block}}  — the assembled, budgeted context
 *
 * Additional substitutions can be passed via context.extras.
 * Missing placeholders are silently replaced with "" and recorded in
 * RenderedPrompt.missingPlaceholders so callers can log a warning.
 */
export function renderTemplate(
  template: Pick<BuiltInTemplate, 'key' | 'version' | 'body'>,
  context: RenderContext,
): RenderedPrompt {
  const substitutions: Record<string, string> = {
    business_name: context.businessName ?? '',
    business_type: context.businessType ?? '',
    today: context.today,
    objective: context.objective ?? '',
    context_block: context.contextBlock,
    ...(context.extras ?? {}),
  }

  // Collect all placeholder keys referenced in the body (deduplicated).
  const referencedKeys = [
    ...new Set([...template.body.matchAll(PLACEHOLDER_RE)].map((m) => m[1])),
  ]

  const usedPlaceholders: string[] = []
  const missingPlaceholders: string[] = []

  for (const key of referencedKeys) {
    if (key in substitutions) {
      usedPlaceholders.push(key)
    } else {
      missingPlaceholders.push(key)
    }
  }

  // Replace every occurrence; unknown keys become empty string.
  let text = template.body
  for (const key of referencedKeys) {
    text = text.replaceAll(`{{${key}}}`, substitutions[key] ?? '')
  }

  return {
    text,
    tokenCount: estimateTokens(text),
    templateKey: template.key,
    templateVersion: template.version,
    usedPlaceholders,
    missingPlaceholders,
  }
}
