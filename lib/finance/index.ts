import { prisma } from '@/lib/db/client'
import { getPeriodBoundaries } from './calc'
import { serializeTransaction } from './serialize'
import type { TransactionFilters } from './types'
import type { CreateTransactionInput, UpdateTransactionInput } from './validators'

// ─── Queries ──────────────────────────────────────────────────────────────────

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
      ...((from || to) && {
        occurredAt: {
          ...(from && { gte: from }),
          ...(to && { lt: to }),
        },
      }),
    },
    include: { client: { select: { companyName: true, contactName: true } } },
    orderBy: { occurredAt: 'desc' },
  })

  return rows.map(serializeTransaction)
}

export async function fetchClientsForPicker(ownerId: string) {
  const rows = await prisma.client.findMany({
    where: { ownerId, isArchived: false },
    select: { id: true, companyName: true, contactName: true },
    orderBy: [{ companyName: 'asc' }, { contactName: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.companyName ?? r.contactName ?? 'Unknown',
  }))
}

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
