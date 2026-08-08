import { prisma } from '@/lib/db/client'
import { ownsClient, ownsProject } from '@/lib/db/ownership'
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

  // How far standing charges are projected forward. Only that: a one-off the
  // user dated later this year is a row they entered, and clamping the whole
  // window to this month used to drop it from the table and the stat cards
  // entirely — it simply vanished, in every period including All time.
  const projectUntil = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  )

  const windowFrom = from ?? new Date(0)
  // `to` is the exclusive start of the next period, so step back off it. With
  // no period there is no upper bound at all.
  const windowTo = to ? new Date(to.getTime() - 1) : new Date(8.64e15)

  const expanded = expandRecurring(
    rows.map(serializeTransaction),
    windowFrom,
    windowTo,
    projectUntil,
  )

  return expanded.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

// Re-exported from lib/clients so the finance and invoice pickers cannot drift
// apart — this was a byte-identical copy of the one in lib/invoices.
export { listClientOptions as fetchClientsForPicker } from '@/lib/clients'
// Same idea one level down: which piece of work the money is for.
export { listProjectOptions as fetchProjectsForPicker } from '@/lib/projects'

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Validates the relation ids on a transaction before they are written.
 *
 * Both arrive from the request body, so neither can be trusted: an unchecked
 * `clientId` attaches another owner's client to your row, and an unchecked
 * `projectId` files the money against work that is not theirs. Returns a
 * message when something is wrong, or null when the pair is fine.
 */
async function checkRelations(
  ownerId: string,
  clientId: string | null | undefined,
  projectId: string | null | undefined,
): Promise<string | null> {
  if (clientId && !(await ownsClient(ownerId, clientId))) {
    return 'Client not found'
  }
  if (projectId) {
    // A project with no client on the same row still has to belong to the
    // owner; when a client is given, the project must be theirs.
    if (!(await ownsProject(ownerId, projectId, clientId ?? undefined))) {
      return clientId
        ? 'Project not found for this client'
        : 'Project not found'
    }
  }
  return null
}

export async function createTransaction(
  ownerId: string,
  input: CreateTransactionInput,
) {
  const rejection = await checkRelations(ownerId, input.clientId, input.projectId)
  if (rejection) throw new Error(rejection)

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
    select: { source: true, clientId: true, projectId: true },
  })
  if (!existing) return null

  const isStripe = existing.source === 'stripe'

  // Re-validate against the row's resulting client: a request can move the
  // project without touching the client, or vice versa.
  const nextClientId =
    input.clientId !== undefined ? input.clientId : existing.clientId
  const nextProjectId =
    input.projectId !== undefined ? input.projectId : existing.projectId
  const rejection = await checkRelations(ownerId, nextClientId, nextProjectId)
  if (rejection) throw new Error(rejection)

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
