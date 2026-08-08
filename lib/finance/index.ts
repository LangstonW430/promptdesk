import { prisma } from '@/lib/db/client'
import { getPeriodBoundaries, expandRecurring } from './calc'
import { serializeTransaction } from './serialize'
import type { SerializedTransaction } from './serialize'
import type { Period, TransactionFilters } from './types'
import type { CreateTransactionInput, UpdateTransactionInput } from './validators'

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Transactions for the finance table and its stat-card breakdowns.
 *
 * Callers should pass the period they are displaying. The finance page used to
 * call this with no filters at all, pulling every transaction ever recorded
 * (plus a client join) on every load, and then filtered by period in the
 * browser. Filtering in the query instead is the same result for far fewer
 * rows.
 *
 * Deliberately not row-capped: the stat cards itemise these into breakdown
 * dialogs, so truncating would leave a dialog whose items sum to less than the
 * total on the card it opened from.
 */
export async function listTransactions(
  ownerId: string,
  filters: TransactionFilters = {},
) {
  const { from, to } = filters.period
    ? getPeriodBoundaries(filters.period)
    : { from: null, to: null }

  const rows = await prisma.transaction.findMany({
    where: {
      ownerId,
      ...(filters.type && { type: filters.type }),
      ...(filters.source && { source: filters.source }),
      ...(filters.category && { category: filters.category }),
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.projectId && { projectId: filters.projectId }),
      ...((from || to) && {
        occurredAt: {
          ...(from && { gte: from }),
          ...(to && { lt: to }),
        },
      }),
    },
    include: {
      client: { select: { companyName: true, contactName: true } },
      project: { select: { title: true } },
    },
    orderBy: { occurredAt: 'desc' },
  })

  return rows.map(serializeTransaction)
}

/**
 * A period's transactions with standing charges expanded into their actual
 * occurrences.
 *
 * `listTransactions` returns rows as stored: a hosting fee entered once in March
 * is one row dated March, so August's totals never saw it and the transactions
 * table never listed it. Everything the finance page reports — the stat cards,
 * the category breakdown, the table — now reads this instead, so they agree with
 * the monthly chart rather than each showing a different number for the same
 * money.
 *
 * Occurrences are never projected past the current month: a charge that has not
 * been billed yet is not spending that happened.
 */
export async function listTransactionsForPeriod(
  ownerId: string,
  period?: Period,
): Promise<Array<SerializedTransaction & { isProjected: boolean }>> {
  const { from, to } = period
    ? getPeriodBoundaries(period)
    : { from: null, to: null }

  const rows = await prisma.transaction.findMany({
    where: {
      ownerId,
      ...((from || to) && {
        // A standing charge that began before the window still applies inside
        // it, so it cannot be excluded by date the way a one-off can.
        OR: [
          {
            occurredAt: {
              ...(from && { gte: from }),
              ...(to && { lt: to }),
            },
          },
          { isRecurring: true },
        ],
      }),
    },
    include: {
      client: { select: { companyName: true, contactName: true } },
      project: { select: { title: true } },
    },
    orderBy: { occurredAt: 'desc' },
  })

  const now = new Date()
  const endOfThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  )
  const windowFrom = from ?? new Date(0)
  const windowTo = to && to < endOfThisMonth ? to : endOfThisMonth

  const expanded = expandRecurring(
    rows.map(serializeTransaction),
    windowFrom,
    windowTo,
  )

  return expanded.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

// Re-exported from lib/clients so the finance and invoice pickers cannot drift
// apart — this was a byte-identical copy of the one in lib/invoices.
export { listClientOptions as fetchClientsForPicker } from '@/lib/clients'
// Same idea one level down: which piece of work the money is for.
export { listProjectOptions as fetchProjectsForPicker } from '@/lib/projects'

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTransaction(
  ownerId: string,
  input: CreateTransactionInput,
) {
  const row = await prisma.transaction.create({
    data: {
      ownerId,
      source: 'manual',
      type: input.type,
      amount: input.amount,
      currency: input.currency ?? 'usd',
      description: input.description ?? null,
      category: input.category,
      occurredAt: new Date(input.occurredAt),
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      isRecurring: input.isRecurring ?? false,
      frequency: input.isRecurring ? (input.frequency ?? 'monthly') : null,
      recurrenceEndedAt: input.isRecurring && input.recurrenceEndedAt
        ? new Date(input.recurrenceEndedAt)
        : null,
    },
  })
  return serializeTransaction(row)
}

export async function updateTransaction(
  ownerId: string,
  id: string,
  input: UpdateTransactionInput,
) {
  const existing = await prisma.transaction.findFirst({
    where: { id, ownerId },
    select: { source: true },
  })
  if (!existing) return null

  const isStripe = existing.source === 'stripe'

  // Build update payload; financial fields locked for Stripe rows
  const data: Record<string, unknown> = {}
  if (input.description !== undefined) data.description = input.description
  if (input.category !== undefined) data.category = input.category
  if (input.occurredAt !== undefined) data.occurredAt = new Date(input.occurredAt)
  if (input.clientId !== undefined) data.clientId = input.clientId ?? null
  if (input.projectId !== undefined) data.projectId = input.projectId ?? null

  if (input.isRecurring !== undefined) {
    data.isRecurring = input.isRecurring
    // Clear frequency and the end date when un-marking recurring; both only
    // mean anything for a standing charge.
    if (!input.isRecurring) {
      data.frequency = null
      data.recurrenceEndedAt = null
    }
  }
  if (input.frequency !== undefined) data.frequency = input.frequency ?? null
  if (input.recurrenceEndedAt !== undefined) {
    data.recurrenceEndedAt = input.recurrenceEndedAt
      ? new Date(input.recurrenceEndedAt)
      : null
  }

  if (!isStripe) {
    if (input.type !== undefined) data.type = input.type
    if (input.amount !== undefined) data.amount = input.amount
    if (input.currency !== undefined) data.currency = input.currency
  }

  const row = await prisma.transaction.update({ where: { id }, data })
  return serializeTransaction(row)
}

export async function deleteTransaction(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.transaction.findFirst({
    where: { id, ownerId },
    select: { source: true },
  })
  if (!existing) return false
  if (existing.source === 'stripe') return false

  const result = await prisma.transaction.deleteMany({ where: { id, ownerId } })
  return result.count > 0
}
