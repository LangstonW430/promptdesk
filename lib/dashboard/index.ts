import { prisma } from '@/lib/db/client'
import {
  DEFAULT_STAGE_PROBABILITIES,
  OPEN_STAGES,
  type DashboardAggregates,
  type OpenStage,
  type StageProbabilities,
  type StageBreakdown,
} from './types'
import { computeConversionRate, computeRevenueForecast } from './forecast'

export { DEFAULT_STAGE_PROBABILITIES, OPEN_STAGES } from './types'
export type { DashboardAggregates, StageProbabilities, StageBreakdown, OpenStage } from './types'

// ─── Aggregates ───────────────────────────────────────────────────────────────

export async function getDashboardAggregates(ownerId: string): Promise<DashboardAggregates> {
  const [rawGroups, user] = await Promise.all([
    prisma.client.groupBy({
      by: ['status'],
      where: { ownerId, isArchived: false },
      _count: { id: true },
      _sum: { estimatedValue: true },
    }),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { settings: true },
    }),
  ])

  const stageProbabilities = mergeOverrides(
    DEFAULT_STAGE_PROBABILITIES,
    parseStageProbabilities(
      (user?.settings as Record<string, unknown> | null)?.stageProbabilities,
    ),
  )

  const groups = rawGroups.map((g) => ({
    status: g.status,
    count: g._count.id,
    sumValue: Number(g._sum.estimatedValue ?? 0),
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
    const totalValue = g?.sumValue ?? 0
    return {
      stage,
      count: g?.count ?? 0,
      totalValue,
      forecastContribution: totalValue * (stageProbabilities[stage] / 100),
    }
  })

  return {
    totalLeads,
    activeClients,
    totalPipelineValue,
    revenueForecast: computeRevenueForecast(openGroups, stageProbabilities),
    conversionRate: computeConversionRate(wonCount, lostCount),
    stageProbabilities,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseStageProbabilities(raw: unknown): Partial<StageProbabilities> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const result: Partial<StageProbabilities> = {}
  for (const stage of OPEN_STAGES) {
    const val = obj[stage]
    if (val === undefined) continue
    if (typeof val !== 'number' || val < 0 || val > 100) return null
    result[stage] = val
  }
  return result
}

function mergeOverrides(
  defaults: StageProbabilities,
  overrides: Partial<StageProbabilities> | null,
): StageProbabilities {
  if (!overrides) return defaults
  const result = { ...defaults }
  for (const stage of OPEN_STAGES) {
    const ov = overrides[stage as OpenStage]
    if (ov !== undefined) result[stage as OpenStage] = ov
  }
  return result
}
