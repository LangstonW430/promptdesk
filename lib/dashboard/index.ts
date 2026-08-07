import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { dashboardTag } from '@/lib/cache-tags'
import { pipelineValueByStage } from '@/lib/clients/pipeline-value'
import { clientStageCounts } from '@/lib/clients/stage-query'
import { OPEN_STAGES, type ClientStage } from '@/lib/clients/stage'
import type { DashboardAggregates, StageBreakdown } from './types'

export type { DashboardAggregates, StageBreakdown } from './types'

// ─── Aggregates ───────────────────────────────────────────────────────────────

// Keyed and tagged per owner so mutations can evict it — see lib/cache-tags.ts.
export const getDashboardAggregates = (
  ownerId: string,
): Promise<DashboardAggregates> =>
  unstable_cache(computeDashboardAggregates, ['dashboard-aggregates', ownerId], {
    revalidate: 60,
    tags: [dashboardTag(ownerId)],
  })(ownerId)

const computeDashboardAggregates = async (
  ownerId: string,
): Promise<DashboardAggregates> => {
  // Counts and value are aggregated separately and joined by stage here.
  // Summing them together would multiply each client by its project count, and
  // a client is one client however much work they carry.
  const [counts, valueByStage] = await Promise.all([
    clientStageCounts(ownerId),
    pipelineValueByStage(ownerId),
  ])

  const count = (s: ClientStage) => counts.get(s) ?? 0

  const totalLeads = count('lead')
  const activeClients = count('active')

  // "Won" is now a client who produced real work rather than one someone
  // remembered to mark won: an active project, or a finished one. "Lost" is a
  // client archived before any work started — archiving is the explicit signal
  // that a relationship is over.
  const wonCount = count('active') + count('past')
  const lostCount = count('lost')

  const totalPipelineValue = OPEN_STAGES.reduce(
    (sum, stage) => sum + (valueByStage.get(stage) ?? 0),
    0,
  )

  const pipelineByStage: StageBreakdown[] = OPEN_STAGES.map((stage) => ({
    stage,
    count: count(stage),
    totalValue: valueByStage.get(stage) ?? 0,
  }))

  const closed = wonCount + lostCount
  const conversionRate = closed === 0 ? null : wonCount / closed

  return {
    totalLeads,
    activeClients,
    totalPipelineValue,
    conversionRate,
    pipelineByStage,
    wonCount,
    lostCount,
  }
}

// ─── Recent activity ──────────────────────────────────────────────────────────

export interface RecentActivity {
  id: string
  type: string
  detail: unknown
  createdAt: Date
  clientName: string | null
}

export async function getRecentActivities(ownerId: string): Promise<RecentActivity[]> {
  const rows = await prisma.activity.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      client: { select: { companyName: true, contactName: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    detail: r.detail,
    createdAt: r.createdAt,
    clientName: r.client
      ? (r.client.companyName ?? r.client.contactName ?? 'Unknown Client')
      : null,
  }))
}

// ─── Generated prompts ────────────────────────────────────────────────────────

export interface RecentPrompt {
  id: string
  templateKey: string
  scope: string
  createdAt: Date
  clientName: string | null
}

export async function getRecentGeneratedPrompts(ownerId: string): Promise<RecentPrompt[]> {
  const rows = await prisma.generatedPrompt.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      client: { select: { companyName: true, contactName: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    templateKey: r.templateKey,
    scope: r.scope,
    createdAt: r.createdAt,
    clientName: r.client
      ? (r.client.companyName ?? r.client.contactName ?? null)
      : null,
  }))
}

// ─── Saved templates ──────────────────────────────────────────────────────────

export interface SavedTemplate {
  id: string
  key: string
  name: string
  description: string | null
  scope: string
}

export async function getSavedTemplates(ownerId: string): Promise<SavedTemplate[]> {
  return prisma.promptTemplate.findMany({
    where: {
      isActive: true,
      OR: [{ ownerId: null }, { ownerId }],
    },
    orderBy: { name: 'asc' },
    select: { id: true, key: true, name: true, description: true, scope: true },
  })
}
