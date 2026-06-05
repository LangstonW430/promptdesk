import { prisma } from '@/lib/db/client'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ActionClient {
  id: string
  displayName: string
  status: string
  estimatedValue: number | null
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
  status: true,
  estimatedValue: true,
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

  return rows.map((c) => ({
    id: c.id,
    displayName: resolveDisplayName(c),
    status: c.status,
    estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
    nextFollowupDate: c.nextFollowupDate ? toDateStr(c.nextFollowupDate) : null,
    lastContactDate: c.lastContactDate ? toDateStr(c.lastContactDate) : null,
    daysOverdue: c.nextFollowupDate ? daysAgo(c.nextFollowupDate) : null,
    daysSinceContact: c.lastContactDate ? daysAgo(c.lastContactDate) : null,
  }))
}

/**
 * Lead/contacted clients with estimatedValue > 0, ordered by value descending.
 * "High" is relative — all valued leads surface so the user can prioritise.
 */
export async function getHotLeads(ownerId: string): Promise<ActionClient[]> {
  const rows = await prisma.client.findMany({
    where: {
      ownerId,
      isArchived: false,
      status: { in: ['lead', 'contacted'] },
      estimatedValue: { gt: 0 },
    },
    select: CLIENT_SELECT,
    orderBy: { estimatedValue: 'desc' },
    take: 10,
  })

  return rows.map((c) => ({
    id: c.id,
    displayName: resolveDisplayName(c),
    status: c.status,
    estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
    nextFollowupDate: c.nextFollowupDate ? toDateStr(c.nextFollowupDate) : null,
    lastContactDate: c.lastContactDate ? toDateStr(c.lastContactDate) : null,
    daysOverdue: null,
    daysSinceContact: c.lastContactDate ? daysAgo(c.lastContactDate) : null,
  }))
}

/**
 * Non-won/lost clients with no contact in 30+ days.
 * Uses lastContactDate; falls back to createdAt for clients never contacted.
 * Ordered by most-stale first.
 */
export async function getGoingCold(ownerId: string): Promise<ActionClient[]> {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 30)
  threshold.setHours(0, 0, 0, 0)

  const rows = await prisma.client.findMany({
    where: {
      ownerId,
      isArchived: false,
      status: { notIn: ['won', 'lost'] },
      OR: [
        { lastContactDate: { lt: threshold } },
        { AND: [{ lastContactDate: null }, { createdAt: { lt: threshold } }] },
      ],
    },
    select: { ...CLIENT_SELECT, createdAt: true },
    orderBy: { lastContactDate: { sort: 'asc', nulls: 'first' } },
    take: 20,
  })

  return rows.map((c) => {
    const contactRef = c.lastContactDate ?? c.createdAt
    return {
      id: c.id,
      displayName: resolveDisplayName(c),
      status: c.status,
      estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
      nextFollowupDate: c.nextFollowupDate ? toDateStr(c.nextFollowupDate) : null,
      lastContactDate: c.lastContactDate ? toDateStr(c.lastContactDate) : null,
      daysOverdue: null,
      daysSinceContact: daysAgo(contactRef),
    }
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
      type: 'income',
      isRecurring: true,
      frequency: { not: null },
      occurredAt: { gte: since },
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
      context: c.estimatedValue
        ? `$${c.estimatedValue.toLocaleString('en-US')} opportunity`
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
