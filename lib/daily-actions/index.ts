import { prisma } from '@/lib/db/client'
import {
  PIPELINE_PROJECT_STATUSES,
  pipelineValueByClient,
} from '@/lib/clients/pipeline-value'
import { clientStagesFor } from '@/lib/clients/stage-query'
import { OPEN_STAGES, type ClientStage } from '@/lib/clients/stage'
import { VISIBLE_TRANSACTION } from '@/lib/finance/visibility'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ActionClient {
  id: string
  displayName: string
  /** Derived from the client's projects and contact history. */
  stage: ClientStage
  /**
   * Sum of the client's open project budgets. Null when they have no open
   * projects — distinct from 0, which would claim someone quoted them nothing.
   */
  pipelineValue: number | null
  /** ISO date string YYYY-MM-DD or null */
  nextFollowupDate: string | null
  /** ISO date string YYYY-MM-DD or null */
  lastContactDate: string | null
  /** Days past the scheduled follow-up date (null if not applicable). */
  daysOverdue: number | null
  /** Days since last contact (or since created, if never contacted). */
  daysSinceContact: number | null
}

export interface RecommendedAction {
  type: 'overdue_followup' | 'going_cold' | 'hot_lead' | 'retainer_due'
  clientId: string
  clientName: string
  context: string
}

export interface RetainerReminder {
  transactionId: string
  clientId: string | null
  clientName: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'annual'
  nextDueDate: string  // ISO YYYY-MM-DD
  daysUntilDue: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Days between a past date and today (midnight-to-midnight). */
function daysAgo(past: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const p = new Date(past)
  p.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((now.getTime() - p.getTime()) / 86_400_000))
}

function resolveDisplayName(c: { companyName: string | null; contactName: string | null }): string {
  return c.companyName ?? c.contactName ?? 'Unnamed Client'
}

const CLIENT_SELECT = {
  id: true,
  companyName: true,
  contactName: true,
  nextFollowupDate: true,
  lastContactDate: true,
} as const

// ─── Queue queries ─────────────────────────────────────────────────────────────

/** Clients whose nextFollowupDate has passed. Ordered oldest-first (most urgent). */
export async function getOverdueFollowUps(ownerId: string): Promise<ActionClient[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rows = await prisma.client.findMany({
    where: { ownerId, isArchived: false, nextFollowupDate: { lt: today } },
    select: CLIENT_SELECT,
    orderBy: { nextFollowupDate: 'asc' },
    take: 20,
  })

  const ids = rows.map((c) => c.id)
  const [values, stages] = await Promise.all([
    pipelineValueByClient(ownerId, ids),
    clientStagesFor(ownerId, ids),
  ])

  return rows.map((c) => ({
    id: c.id,
    displayName: resolveDisplayName(c),
    stage: stages.get(c.id) ?? 'lead',
    pipelineValue: values.get(c.id) ?? null,
    nextFollowupDate: c.nextFollowupDate ? toDateStr(c.nextFollowupDate) : null,
    lastContactDate: c.lastContactDate ? toDateStr(c.lastContactDate) : null,
    daysOverdue: c.nextFollowupDate ? daysAgo(c.nextFollowupDate) : null,
    daysSinceContact: c.lastContactDate ? daysAgo(c.lastContactDate) : null,
  }))
}

/**
 * Lead/contacted clients carrying open project value, ranked by that value.
 *
 * This queue used to be defined by `clients.estimatedValue > 0`. Value now
 * lives on projects, so "hot" means the client has at least one proposed or
 * active project with a budget — i.e. someone has actually quoted them. A lead
 * nobody has put a number against is not hot yet, which is the same bar the old
 * `> 0` filter set, just recorded against the work instead of the person.
 *
 * Ranking happens in the grouped query so only the top clients are fetched,
 * rather than loading every lead to sort them in memory.
 */
export async function getHotLeads(ownerId: string): Promise<ActionClient[]> {
  const ranked = await prisma.project.groupBy({
    by: ['clientId'],
    where: {
      ownerId,
      isArchived: false,
      status: { in: [...PIPELINE_PROJECT_STATUSES] },
      budget: { gt: 0 },
      // A quoted proposal with a budget is itself the "hot" signal — it used
      // to also require a client status of lead/contacted, which said the same
      // thing a second time and could contradict it.
      client: { isArchived: false },
    },
    _sum: { budget: true },
    orderBy: { _sum: { budget: 'desc' } },
    take: 10,
  })
  if (ranked.length === 0) return []

  const rows = await prisma.client.findMany({
    where: { ownerId, id: { in: ranked.map((r) => r.clientId) } },
    select: CLIENT_SELECT,
  })

  const stages = await clientStagesFor(ownerId, rows.map((c) => c.id))

  // groupBy carries the ordering; findMany does not preserve `in` order.
  const byId = new Map(rows.map((c) => [c.id, c]))

  return ranked.flatMap((r) => {
    const c = byId.get(r.clientId)
    if (!c) return []
    return [{
      id: c.id,
      displayName: resolveDisplayName(c),
      stage: stages.get(c.id) ?? 'lead',
      pipelineValue: Number(r._sum.budget ?? 0),
      nextFollowupDate: c.nextFollowupDate ? toDateStr(c.nextFollowupDate) : null,
      lastContactDate: c.lastContactDate ? toDateStr(c.lastContactDate) : null,
      daysOverdue: null,
      daysSinceContact: c.lastContactDate ? daysAgo(c.lastContactDate) : null,
    }]
  })
}

/**
 * Clients still in play with no contact in 30+ days.
 * Uses lastContactDate; falls back to createdAt for clients never contacted.
 * Ordered by most-stale first.
 *
 * "Still in play" used to be `status notIn (won, lost)`. It is now a stage in
 * the open set, which means the same thing without anyone having to remember
 * to mark it: a client with live work is not going cold, and a finished or
 * archived one is not worth chasing.
 */
export async function getGoingCold(ownerId: string): Promise<ActionClient[]> {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 30)
  threshold.setHours(0, 0, 0, 0)

  const rows = await prisma.client.findMany({
    where: {
      ownerId,
      isArchived: false,
      OR: [
        { lastContactDate: { lt: threshold } },
        { AND: [{ lastContactDate: null }, { createdAt: { lt: threshold } }] },
      ],
    },
    select: { ...CLIENT_SELECT, createdAt: true },
    orderBy: { lastContactDate: { sort: 'asc', nulls: 'first' } },
    take: 20,
  })

  const ids = rows.map((c) => c.id)
  const [values, stages] = await Promise.all([
    pipelineValueByClient(ownerId, ids),
    clientStagesFor(ownerId, ids),
  ])

  return rows.flatMap((c) => {
    const stage = stages.get(c.id) ?? 'lead'
    if (!OPEN_STAGES.includes(stage)) return []

    const contactRef = c.lastContactDate ?? c.createdAt
    return [{
      id: c.id,
      displayName: resolveDisplayName(c),
      stage,
      pipelineValue: values.get(c.id) ?? null,
      nextFollowupDate: c.nextFollowupDate ? toDateStr(c.nextFollowupDate) : null,
      lastContactDate: c.lastContactDate ? toDateStr(c.lastContactDate) : null,
      daysOverdue: null,
      daysSinceContact: daysAgo(contactRef),
    }]
  })
}

// ─── Retainer reminders ────────────────────────────────────────────────────────

/** Adds the billing period in months to a date, returning a new Date. */
function addBillingPeriod(
  date: Date,
  frequency: 'monthly' | 'quarterly' | 'annual',
): Date {
  const d = new Date(date)
  if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3)
  else d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d
}

/**
 * Finds recurring income transactions whose next expected payment falls within
 * the next 7 days (inclusive of today). Deduplicates per client — only the
 * most-recent transaction per client is considered.
 */
export async function getRetainerReminders(ownerId: string): Promise<RetainerReminder[]> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setUTCDate(horizon.getUTCDate() + 7)

  // Latest recurring income row per client (we look back 13 months to cover annual cadences)
  const since = new Date(today)
  since.setUTCMonth(since.getUTCMonth() - 13)

  const rows = await prisma.transaction.findMany({
    where: {
      ownerId,
      ...VISIBLE_TRANSACTION,
      type: 'income',
      isRecurring: true,
      frequency: { not: null },
      occurredAt: { gte: since },
      // Archived clients are out of the pipeline, so their retainers should not
      // be nagging from Daily Actions. The other queues on this page filter on
      // the client row directly; this one reaches the client through the
      // transaction, so the filter has to be expressed on the relation.
      // clientId is nullable — transactions with no client are not tied to an
      // archived one and are kept.
      OR: [
        { clientId: null },
        { client: { isArchived: false } },
      ],
    },
    select: {
      id: true,
      amount: true,
      frequency: true,
      occurredAt: true,
      clientId: true,
      client: { select: { companyName: true, contactName: true } },
    },
    orderBy: { occurredAt: 'desc' },
  })

  // Keep only the most-recent row per (clientId | transactionId)
  const seen = new Set<string>()
  const reminders: RetainerReminder[] = []

  for (const r of rows) {
    const dedupeKey = r.clientId ?? r.id
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const freq = r.frequency as 'monthly' | 'quarterly' | 'annual'
    const nextDue = addBillingPeriod(r.occurredAt, freq)
    nextDue.setUTCHours(0, 0, 0, 0)

    if (nextDue < today || nextDue > horizon) continue

    const daysUntilDue = Math.round(
      (nextDue.getTime() - today.getTime()) / 86_400_000,
    )
    const clientName = r.client
      ? (r.client.companyName ?? r.client.contactName ?? 'Unknown')
      : 'Unknown'

    reminders.push({
      transactionId: r.id,
      clientId: r.clientId,
      clientName,
      amount: Number(r.amount),
      frequency: freq,
      nextDueDate: toDateStr(nextDue),
      daysUntilDue,
    })
  }

  return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
}

// ─── Recommended actions (for dashboard) ──────────────────────────────────────

/**
 * Unions the three queues into a prioritised list (max 5 items).
 * Order: overdue > going cold > hot leads.
 * Deduplicates by clientId across queues.
 */
export async function getRecommendedActions(ownerId: string): Promise<RecommendedAction[]> {
  const [overdue, cold, hot, retainers] = await Promise.all([
    getOverdueFollowUps(ownerId),
    getGoingCold(ownerId),
    getHotLeads(ownerId),
    getRetainerReminders(ownerId),
  ])

  const seen = new Set<string>()
  const actions: RecommendedAction[] = []

  function push(a: RecommendedAction) {
    if (seen.has(a.clientId)) return
    seen.add(a.clientId)
    actions.push(a)
  }

  for (const c of overdue.slice(0, 3)) {
    const days = c.daysOverdue ?? 0
    push({
      type: 'overdue_followup',
      clientId: c.id,
      clientName: c.displayName,
      context: days === 1 ? '1 day overdue' : `${days} days overdue`,
    })
  }

  for (const c of cold.slice(0, 3)) {
    push({
      type: 'going_cold',
      clientId: c.id,
      clientName: c.displayName,
      context: `No contact in ${c.daysSinceContact ?? 30}d`,
    })
  }

  for (const c of hot.slice(0, 3)) {
    push({
      type: 'hot_lead',
      clientId: c.id,
      clientName: c.displayName,
      context: c.pipelineValue
        ? `$${c.pipelineValue.toLocaleString('en-US')} opportunity`
        : 'Hot lead',
    })
  }

  for (const r of retainers.slice(0, 2)) {
    const clientId = r.clientId ?? `retainer-${r.transactionId}`
    if (seen.has(clientId)) continue
    seen.add(clientId)
    const when = r.daysUntilDue === 0 ? 'today' : r.daysUntilDue === 1 ? 'tomorrow' : `in ${r.daysUntilDue}d`
    actions.push({
      type: 'retainer_due',
      clientId,
      clientName: r.clientName,
      context: `Invoice due ${when} · ${r.frequency}`,
    })
  }

  return actions.slice(0, 5)
}
