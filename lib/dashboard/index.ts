import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { dashboardTag } from '@/lib/cache-tags'
import { pipelineValueByClientStatus } from '@/lib/clients/pipeline-value'
import {
  OPEN_STAGES,
  type DashboardAggregates,
  type StageBreakdown,
} from './types'

export { OPEN_STAGES } from './types'
export type { DashboardAggregates, StageBreakdown, OpenStage } from './types'

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
  // Counts are still per client — a lead is one lead regardless of how many
  // projects it carries — but value now comes from those projects' budgets, so
  // the two are aggregated separately and joined by status here. Summing them
  // in one grouped join would have multiplied each client by its project count.
  const [rawGroups, valueByStatus] = await Promise.all([
    prisma.client.groupBy({
      by: ['status'],
      where: { ownerId, isArchived: false },
      _count: { id: true },
    }),
    pipelineValueByClientStatus(ownerId),
  ])

  const groups = rawGroups.map((g) => ({
    status: g.status,
    count: g._count.id,
    sumValue: valueByStatus.get(g.status) ?? 0,
  }))

  const byStatus = Object.fromEntries(groups.map((g) => [g.status, g]))
  const count = (s: string) => byStatus[s]?.count ?? 0

  const totalLeads = count('lead')
  const activeClients = count('contacted') + count('proposal_sent') + count('negotiating')
  const wonCount = count('won')
  const lostCount = count('lost')

  const openGroups = groups.filter((g) => (OPEN_STAGES as readonly string[]).includes(g.status))
  const totalPipelineValue = openGroups.reduce((sum, g) => sum + g.sumValue, 0)

  const pipelineByStage: StageBreakdown[] = OPEN_STAGES.map((stage) => {
    const g = byStatus[stage]
    return {
      stage,
      count: g?.count ?? 0,
      totalValue: g?.sumValue ?? 0,
    }
  })

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
