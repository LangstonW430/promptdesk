import { prisma } from '@/lib/db/client'
import { findTemplate, getUserProfile, fetchContext } from './retrieval'
import { buildPrompt } from './pipeline'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'
import type { GenerateRequest, GenerateResult } from './types'

export type { GenerateRequest, GenerateResult }

/**
 * Full generate pipeline: retrieval → normalize → dedup → score → budget →
 * render → persist generated_prompts row.
 * Makes NO external AI call.
 */
export async function generatePrompt(
  ownerId: string,
  req: GenerateRequest,
): Promise<GenerateResult> {
  // ── Find template ───────────────────────────────────────────────────────────
  const templateRecord = await findTemplate(ownerId, req.templateKey)
  if (!templateRecord) {
    throw new Error(`Template not found: ${req.templateKey}`)
  }

  // Resolve the retrievalSpec from the in-memory built-in (DB row has no spec col)
  const builtIn = BUILT_IN_TEMPLATES.find((t) => t.key === req.templateKey)
  const retrievalSpec =
    builtIn?.retrievalSpec ?? {
      scope: req.scope,
      includeClients: true,
      includeNotes: true,
      includeTasks: true,
      includeActivities: true,
      includePipelineAggregate: true,
    }

  // ── Fetch raw data ──────────────────────────────────────────────────────────
  const [profile, rawData] = await Promise.all([
    getUserProfile(ownerId),
    fetchContext(ownerId, retrievalSpec, req.clientId),
  ])

  // ── Run pure pipeline ───────────────────────────────────────────────────────
  const result = buildPrompt({
    rawClients: rawData.clients,
    rawNotes: rawData.notes,
    rawTasks: rawData.tasks,
    rawActivities: rawData.activities,
    template: {
      key: templateRecord.key,
      version: templateRecord.version,
      body: templateRecord.body,
      scope: req.scope,
      tokenBudget: templateRecord.tokenBudget,
    },
    userProfile: profile,
    objective: req.objective,
  })

  // ── Persist ─────────────────────────────────────────────────────────────────
  await prisma.generatedPrompt.create({
    data: {
      ownerId,
      templateId: templateRecord.id || undefined,
      templateKey: templateRecord.key,
      scope: req.scope,
      clientId: req.clientId ?? null,
      renderedText: result.text,
      tokenCount: result.tokenCount,
      contextMeta: result.contextMeta as unknown as import('@prisma/client/runtime/client').InputJsonValue,
    },
  })

  return result
}
