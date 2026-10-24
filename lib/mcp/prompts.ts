import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'
import type { BuiltInTemplate } from '@/lib/prompt-engine/template-types'
import { generatePrompt } from '@/lib/prompts'
import { ownsClient } from '@/lib/db/ownership'
import { rateLimit } from '@/lib/rate-limit'

/**
 * The app's prompt templates, exposed as MCP prompts.
 *
 * ── No prompt text lives here ────────────────────────────────────────────────
 *
 * Every one of these is the existing engine driven by a template key:
 * `generatePrompt` resolves the template (including a user's own override of a
 * built-in), retrieves and scores the context, applies the token budget and
 * renders. This module decides which templates to advertise and what arguments
 * each takes, and nothing else. A new template added to `BUILT_IN_TEMPLATES`
 * appears over MCP with no change here.
 */

/**
 * Templates that cannot be served by `generatePrompt`.
 *
 * `invoice_cover_email` is rendered straight through `renderTemplate` with six
 * invoice-specific `extras` (invoice number, total, due date, line-item
 * summary, payment link) — and `PipelineInput` has no `extras` field at all,
 * so driving it through the pipeline would emit a prompt with six empty
 * placeholders rather than an error. Serving it properly needs an `invoiceId`
 * argument and a second code path; that is a later phase, not a line here.
 */
const UNSUPPORTED_TEMPLATE_KEYS: ReadonlySet<string> = new Set(['invoice_cover_email'])

/**
 * Prompt generation shares one budget with `/api/prompts/generate`.
 *
 * Same bucket name, same key, same numbers — deliberately. Retrieval, scoring
 * and budgeting is the most expensive thing this app does, which is why that
 * route carries `maxDuration = 30` and a 20/min cap. If MCP had its own bucket
 * it would be a way around that cap rather than another door to the same room.
 *
 * It surfaces differently: a prompt callback cannot set an HTTP status, so this
 * becomes a thrown error the client renders as text, where the route returns a
 * real 429 with `retry-after`.
 */
const PROMPT_RATE_LIMIT = { limit: 20, windowMs: 60_000 } as const

/** Arguments every prompt accepts, whatever its scope. */
const objectiveArg = z
  .string()
  .max(500)
  .optional()
  .describe(
    'A short statement of what you are trying to achieve. This steers which ' +
      'clients, notes and tasks are selected into the context, not just what ' +
      'the prompt says.',
  )

const clientIdArg = z
  .string()
  .uuid()
  .describe('The client id, as returned by the search_clients tool')

/**
 * `templates` defaults to the built-ins and is only passed explicitly by
 * tests, which need to register a template that does not (and should not)
 * exist in the real set.
 */
export function registerPrompts(
  server: McpServer,
  ownerId: string,
  templates: readonly BuiltInTemplate[] = BUILT_IN_TEMPLATES,
): void {
  for (const template of templates) {
    if (UNSUPPORTED_TEMPLATE_KEYS.has(template.key)) continue
    register(server, ownerId, template)
  }
}

function register(server: McpServer, ownerId: string, template: BuiltInTemplate): void {
  const config = {
    // The key, not a new name. It is already the stable identifier used by the
    // REST route, the `prompt_templates` table and the override lookup in
    // `findTemplate`; a second naming scheme would be a third source of truth.
    title: template.name,
    description: template.description,
  }

  switch (template.scope) {
    case 'global':
      server.registerPrompt(
        template.key,
        { ...config, argsSchema: z.object({ objective: objectiveArg }) },
        async ({ objective }) => {
          await guardRate(ownerId)
          return toMessages(
            await generatePrompt(ownerId, {
              templateKey: template.key,
              scope: 'global',
              objective,
              source: 'mcp',
            }),
          )
        },
      )
      return

    case 'client':
    case 'notes': {
      const scope = template.scope
      server.registerPrompt(
        template.key,
        {
          ...config,
          argsSchema: z.object({ clientId: clientIdArg, objective: objectiveArg }),
        },
        async ({ clientId, objective }) => {
          await guardRate(ownerId)
          // `fetchContext` is owner-scoped, so a foreign id leaks nothing — it
          // renders an empty context block. That is a confusing success rather
          // than an answer, so say so instead.
          if (!(await ownsClient(ownerId, clientId))) {
            throw new Error(`No client with id ${clientId}.`)
          }
          return toMessages(
            await generatePrompt(ownerId, {
              templateKey: template.key,
              scope,
              clientId,
              objective,
              source: 'mcp',
            }),
          )
        },
      )
      return
    }

    case 'project':
      // No built-in declares this scope, and `fetchContext` never implemented
      // the branch — the fields are in `RetrievalSpec` but nothing reads them.
      // Throwing at registration means adding a project-scoped template fails
      // loudly here instead of quietly serving an empty context block.
      throw new Error(
        `Template "${template.key}" declares scope "project", which fetchContext ` +
          'does not implement. Implement the retrieval branch before exposing it.',
      )

    default: {
      // Exhaustiveness: a new TemplateScope stops compiling here.
      const unreachable: never = template.scope
      throw new Error(`Unhandled template scope: ${String(unreachable)}`)
    }
  }
}

function guardRate(ownerId: string): Promise<void> {
  const limit = rateLimit('prompts:generate', ownerId, PROMPT_RATE_LIMIT)
  if (!limit.ok) {
    return Promise.reject(
      new Error(
        `Too many prompt generations. Try again in ${limit.retryAfterSeconds} seconds.`,
      ),
    )
  }
  return Promise.resolve()
}

/**
 * The engine's output as a single user message.
 *
 * No extra truncation: the pipeline has already budgeted the context against
 * the template's `tokenBudget` (overridable per user in Settings). A second cap
 * here would silently cut a prompt the budgeter had deliberately filled, and
 * the `description` reports what it came to so that is visible.
 */
function toMessages(result: Awaited<ReturnType<typeof generatePrompt>>) {
  return {
    description: `${result.contextMeta.includedItems.length} context items, ~${result.tokenCount} tokens`,
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text: result.text },
      },
    ],
  }
}
